const crypto = require("crypto");
const { generatePresignedUploadUrl } = require("../utils/s3");
const { s3JobQueue } = require("../utils/queue");
const {
    addProject,
    getProjectsByUserId,
    getProjectById,
    updateProject,
    deleteProject
} = require("../repositories/projects.repository");
const { getQuotaByUserId, adjustImageUsage } = require("../repositories/quotas.repository");
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const getCachedQuota = async (userId) => {
    const cacheKey = `user_quota:${userId}`;
    let cachedQuota = await redis.get(cacheKey);
    if (cachedQuota) {
        return JSON.parse(cachedQuota);
    }
    const quota = await getQuotaByUserId(userId);
    if (quota) {
        await redis.setex(cacheKey, 3600, JSON.stringify(quota));
    }
    return quota;
};

const invalidateQuotaCache = async (userId) => {
    await redis.del(`user_quota:${userId}`);
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

        res.status(200).json(uploadData);
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
        // This is a public read endpoint, so userId comes from params
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

        // Queue images from S3 that are no longer in the array
        const removedImages = oldS3Images.filter(oldLink => !newS3Images.includes(oldLink));
        for (const link of removedImages) {
            if (getS3ImageCount([link]) > 0) {
                s3JobQueue.add("deleteImage", { url: link }).catch(err => console.error("Could not enqueue orphaned file from S3:", err));
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

        if (deleted.image_links && deleted.image_links.length > 0) {
            for (const link of deleted.image_links) {
                if (getS3ImageCount([link]) > 0) {
                    s3JobQueue.add("deleteImage", { url: link }).catch(err => console.error("Could not enqueue from S3:", err));
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
