const { addExternalProfile, getExternalProfile, updateProfileData } = require("../repositories/externalProfile.repository");
const { fetchPlatformData, generateProfileUrl } = require("../services/externalProfile.service");
const { enqueueJob, QUEUE_URL } = require("../utils/sqsClient");

const SUPPORTED_PLATFORMS = new Set(["github", "leetcode", "credly", "codeforces"]);

/**
 * Dispatch profile fetch via SQS (preferred) or setImmediate (fallback for local dev).
 */
const backgroundFetchAndIngest = (userId, platform, username) => {
    if (QUEUE_URL) {
        enqueueJob("profile-sync", { userId, platform: platform.toLowerCase(), username }).catch(err =>
            console.error(`[Profile Sync] Failed to enqueue:`, err.message)
        );
    } else {
        setImmediate(async () => {
            try {
                console.log(`[Background] Starting profile fetch for ${platform}:${username}`);
                const rawPlatformData = await fetchPlatformData(platform, username);
                if (rawPlatformData) {
                    await updateProfileData(userId, platform.toLowerCase(), rawPlatformData);
                    console.log(`[Background] Successfully synced ${platform}:${username}`);
                } else {
                    console.warn(`[Background] No data returned for ${platform}:${username}`);
                }
            } catch (error) {
                console.error(`[Background] Failed to fetch ${platform}:${username}:`, error.message);
            }
        });
    }
};

const addExternalProfileController = async (req, res) => {
    try {
        const { platform, username } = req.body;
        if (!platform || !username) {
            return res.status(400).json({ error: "platform and username are required" });
        }

        const userId = req.user.internalId;

        if (!SUPPORTED_PLATFORMS.has(platform.toLowerCase())) {
            return res.status(400).json({ error: `Unsupported platform: ${platform}` });
        }

        const existingProfile = await getExternalProfile(userId, platform.toLowerCase());
        if (existingProfile) {
            return res.status(409).json({ error: `You have already added a ${platform} profile.` });
        }

        const profileUrl = generateProfileUrl(platform, username);

        const externalProfile = await addExternalProfile(
            userId,
            platform.toLowerCase(),
            username,
            profileUrl,
            {}
        );

        backgroundFetchAndIngest(userId, platform, username);

        res.status(202).json({
            message: "Profile accepted and background fetch started",
            externalProfile
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getExternalProfileController = async (req, res) => {
    try {
        const { platform } = req.params;
        const userId = req.user.internalId;
        const externalProfile = await getExternalProfile(userId, platform.toLowerCase());

        if (!externalProfile) {
            return res.status(404).json({ error: `You have not connected a ${platform} profile yet.` });
        }

        res.status(200).json(externalProfile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateProfileDataController = async (req, res) => {
    try {
        const { platform, username } = req.body;
        const userId = req.user.internalId;

        const rawPlatformData = await fetchPlatformData(platform, username);
        if (!rawPlatformData) {
            return res.status(404).json({ error: `Could not fetch data for user ${username} on ${platform}` });
        }

        const externalProfile = await updateProfileData(userId, platform.toLowerCase(), rawPlatformData);
        res.status(200).json(externalProfile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    addExternalProfileController,
    getExternalProfileController,
    updateProfileDataController
};