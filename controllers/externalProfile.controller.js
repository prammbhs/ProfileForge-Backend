const { addExternalProfile, getExternalProfile, updateProfileData } = require("../repositories/externalProfile.repository");
const { fetchPlatformData, generateProfileUrl } = require("../services/externalProfile.service");
const { profileSyncQueue } = require("../utils/queue");

const SUPPORTED_PLATFORMS = new Set(["github", "leetcode", "credly", "codeforces"]);

const queueProfileFetchAndIngest = async (userId, externalProfileId, platform, username) => {
    try {
        await profileSyncQueue.add("fetch-profile", {
            userId,
            externalProfileId,
            platform: platform.toLowerCase(),
            username
        });
        console.log(`[Queue] Dispatched background fetch for ${platform}:${username}`);
    } catch (error) {
        console.error(`[Queue] Failed to dispatch job to BullMQ for ${platform}:${username}`, error.message);
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

        // Ensure the profile does not already exist
        const existingProfile = await getExternalProfile(userId, platform.toLowerCase());
        if (existingProfile) {
            return res.status(409).json({ error: `You have already added a ${platform} profile.` });
        }

        const profileUrl = generateProfileUrl(platform, username);

        // Save to DB first so we have an externalProfileId for FK inserts
        const externalProfile = await addExternalProfile(
            userId,
            platform.toLowerCase(),
            username,
            profileUrl,
            {}
        );

        // Fetch and ingest in the background using BullMQ
        await queueProfileFetchAndIngest(userId, externalProfile.id, platform, username);

        res.status(202).json({
            message: "Profile accepted and queued for ingestion",
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
        // Here we can re-fetch and update manually if needed
        const { platform, username } = req.body;
        const userId = req.user.internalId;

        const rawPlatformData = await fetchPlatformData(platform, username);
        if (!rawPlatformData) {
            return res.status(404).json({ error: `Could not fetch data for user ${username} on ${platform}` });
        }

        const existingProfile = await getExternalProfile(userId, platform.toLowerCase());

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