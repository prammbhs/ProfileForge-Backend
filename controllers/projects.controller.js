const crypto = require("crypto");
const { generatePresignedUploadUrl, deleteFileFromS3 } = require("../utils/s3");
const {
    addProject,
    getProjectsByUserId,
    getProjectById,
    updateProject,
    deleteProject
} = require("../repositories/projects.repository");
const { getQuotaByUserId, adjustImageUsage } = require("../repositories/quotas.repository");
const { getRedisClient } = require("../utils/redisClient");
const { quotaCache } = require("../utils/lruCache");
const { enqueueJob, QUEUE_URL } = require("../utils/sqsClient");

const redis = getRedisClient();

/**
 * Delete an S3 file via SQS (preferred) or setImmediate (fallback for local dev).
 */
const backgroundDeleteS3 = (url) => {
    if (QUEUE_URL) {
        enqueueJob("s3-delete", { url }).catch(err =>
            console.error("[S3 Cleanup] Failed to enqueue:", err.message)
        );
    } else {
        // Fallback for local dev without SQS
        setImmediate(async () => {
            try {
                const success = await deleteFileFromS3(url);
                console.log(success ? `[S3 Cleanup] Deleted: ${url}` : `[S3 Cleanup] Could not delete: ${url}`);
            } catch (err) {
                console.error(`[S3 Cleanup] Error: ${err.message}`);
            }
        });
    }
};

const getCachedQuota = async (userId) => {
    // ── L1: LRU (0 Redis commands) ────────────────────────────
    const lruResult = quotaCache.get(userId);
    if (lruResult) return lruResult;

    const cacheKey = `user_quota:${userId}`;

    // ── L2: Redis (1 command on LRU miss) ─────────────────────
    try {
        if (redis.status === "ready") {
            const cachedQuota = await Promise.race([
                redis.get(cacheKey),
                new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000))
            ]);
            if (cachedQuota) {
                const parsed = JSON.parse(cachedQuota);
                quotaCache.set(userId, parsed); // Populate L1
                return parsed;
            }
        }
    } catch { /* Redis unavailable */ }

    // ── L3: PostgreSQL ────────────────────────────────────────
    const quota = await getQuotaByUserId(userId);
    if (quota) {
        quotaCache.set(userId, quota); // Populate L1
        redis.setex(cacheKey, 3600, JSON.stringify(quota)).catch(() => {}); // Populate L2
    }
    return quota;
};

const invalidateQuotaCache = async (userId) => {
    quotaCache.delete(userId); // Clear L1
    redis.del(`user_quota:${userId}`).catch(() => {}); // Clear L2
};

const getS3ImageCount = (links = []) => {
    const cloudfrontUrl = process.env.AWS_CLOUDFRONT_URL;
    if (!cloudfrontUrl) return 0;
    const sanitizedDomain = cloudfrontUrl.replace(/\/$/, "");
    return links.filter(link => link && link.startsWith(sanitizedDomain)).length;
};

exports.getProjectPresignedUrlController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const { contentType, fileExtension } = req.body;

        if (!contentType || !fileExtension) {
            return res.status(400).json({ error: "contentType and fileExtension are required" });
        }

        const quota = await getCachedQuota(userId);
        if (quota.total_images_uploaded >= quota.max_image_limit) {
            return res.status(403).json({ error: "Maximum overall image upload limit reached. Delete old projects or certificates to free up space." });
        }

        const randomHash = crypto.randomBytes(16).toString("hex");
        const fileKey = `projects/${userId}/${randomHash}.${fileExtension}`;
        const uploadData = await generatePresignedUploadUrl(fileKey, contentType);

        const cloudfrontUrl = (process.env.AWS_CLOUDFRONT_URL || '').replace(/\/$/, '');
        const publicUrl = cloudfrontUrl ? `${cloudfrontUrl}/${fileKey}` : null;

        res.status(200).json({ ...uploadData, publicUrl });
    } catch (error) {
        console.error("Presigned URL Error:", error);
        res.status(500).json({ error: "Could not generate presigned URL." });
    }
};

exports.addProjectController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const data = req.body;

        const existingProjects = await getProjectsByUserId(userId);
        if (existingProjects.length >= 15) {
            return res.status(403).json({ error: "Maximum limit of 15 projects reached. Please delete an older project first." });
        }

        const quota = await getCachedQuota(userId);
        const s3ImagesCount = getS3ImageCount(data.image_links);

        if (quota.total_images_uploaded + s3ImagesCount > quota.max_image_limit) {
            return res.status(403).json({ error: "Adding this project exceeds your maximum overall image limit." });
        }

        const newProject = await addProject(userId, data);

        if (s3ImagesCount > 0) {
            await adjustImageUsage(userId, s3ImagesCount);
            await invalidateQuotaCache(userId);
        }

        res.status(201).json({ message: "Project created successfully", project: newProject });
    } catch (error) {
        console.error("Add Project Error:", error);
        res.status(500).json({ error: "Failed to create project." });
    }
};

exports.getProjectsController = async (req, res) => {
    try {
        const { userId } = req.params;
        const projects = await getProjectsByUserId(userId);
        res.status(200).json(projects);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch projects." });
    }
};

exports.updateProjectController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const { id } = req.params;
        const data = req.body;

        const oldProject = await getProjectById(id, userId);
        if (!oldProject) {
            return res.status(404).json({ error: "Project not found or unauthorized to update." });
        }

        const oldS3Images = oldProject.image_links ? oldProject.image_links.filter(link => !!link) : [];
        const newS3Images = data.image_links ? data.image_links.filter(link => !!link) : [];

        const oldS3Count = getS3ImageCount(oldS3Images);
        const newS3Count = getS3ImageCount(newS3Images);
        const diff = newS3Count - oldS3Count;

        if (diff > 0) {
            const quota = await getCachedQuota(userId);
            if (quota.total_images_uploaded + diff > quota.max_image_limit) {
                return res.status(403).json({ error: "Updating this project exceeds your maximum overall image limit." });
            }
        }

        // Delete removed S3 images in the background — non-blocking, no Redis
        const removedImages = oldS3Images.filter(oldLink => !newS3Images.includes(oldLink));
        for (const link of removedImages) {
            if (getS3ImageCount([link]) > 0) {
                backgroundDeleteS3(link);
            }
        }

        const updatedProject = await updateProject(id, userId, data);

        if (diff !== 0) {
            await adjustImageUsage(userId, diff);
            await invalidateQuotaCache(userId);
        }

        res.status(200).json({ message: "Project updated successfully", project: updatedProject });
    } catch (error) {
        console.error("Update Project Error:", error);
        res.status(500).json({ error: "Failed to update project." });
    }
};

exports.deleteProjectController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const { id } = req.params;

        const deleted = await deleteProject(id, userId);
        if (!deleted) {
            return res.status(404).json({ error: "Project not found or unauthorized to delete." });
        }

        const s3ImagesCount = getS3ImageCount(deleted.image_links);

        // Delete S3 images in the background — non-blocking, no Redis
        if (deleted.image_links && deleted.image_links.length > 0) {
            for (const link of deleted.image_links) {
                if (getS3ImageCount([link]) > 0) {
                    backgroundDeleteS3(link);
                }
            }
        }

        if (s3ImagesCount > 0) {
            await adjustImageUsage(userId, -s3ImagesCount);
            await invalidateQuotaCache(userId);
        }

        res.status(200).json({ message: "Project deleted successfully", project: deleted });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete project" });
    }
};
