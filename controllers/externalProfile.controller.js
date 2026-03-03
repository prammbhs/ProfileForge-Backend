const { addExternalProfile, getExternalProfile, updateProfileData } = require("../repositories/externalProfile.repository");
const { getGithubUserdata } = require("../services/githubUserdata");
const { getGithubEvents } = require("../services/githubEvents");
const { getLeetcodeUserdata } = require("../services/leetcodeUSerdata");
const { getCredlyUserdata } = require("../services/credlyUserdata");

const { categorizeAndIngestPlatformData } = require("../services/ingestionService");

const fetchPlatformData = async (platform, username) => {
    switch (platform.toLowerCase()) {
        case 'github':
            const [githubData, githubEvents] = await Promise.all([
                getGithubUserdata(username),
                getGithubEvents(username)
            ]);
            return {
                profile: githubData,
                events: githubEvents || []
            };
        case 'leetcode':
            return await getLeetcodeUserdata(username);
        case 'credly':
            
            if (username.includes(',')) {
                const usernames = username.split(',').map(u => u.trim());
                const allData = await Promise.all(usernames.map(u => getCredlyUserdata(u)));

                
                let mergedData = [];
                allData.forEach(result => {
                    if (result && result.data && Array.isArray(result.data)) {
                        mergedData = mergedData.concat(result.data);
                    } else if (Array.isArray(result)) {
                        mergedData = mergedData.concat(result);
                    }
                });
                return { data: mergedData };
            } else {
                return await getCredlyUserdata(username);
            }
        // Add other platforms like codeforces here later
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
};

const generateProfileUrl = (platform, username) => {
    const firstUsername = username.includes(',') ? username.split(',')[0].trim() : username;
    switch (platform.toLowerCase()) {
        case 'github':
            return `https://github.com/${firstUsername}`;
        case 'leetcode':
            return `https://leetcode.com/u/${firstUsername}`;
        case 'credly':
            return `https://www.credly.com/users/${firstUsername}`;
        default:
            return '';
    }
};

const addExternalProfileController = async (req, res) => {
    try {
        const { userId, platform, username } = req.body;
        if (!userId || !platform || !username) {
            return res.status(400).json({ error: "userId, platform, and username are required" });
        }

        // Fetch the raw data from the platform
        const rawPlatformData = await fetchPlatformData(platform, username);
        if (!rawPlatformData) {
            return res.status(404).json({ error: `Could not fetch data for user ${username} on ${platform}` });
        }

        // Generate profile URL
        const profileUrl = generateProfileUrl(platform, username);

        // Save to DB first so we have an externalProfileId for FK inserts
        const externalProfile = await addExternalProfile(
            userId,
            platform.toLowerCase(),
            username,
            profileUrl,
            rawPlatformData
        );

        // Run it through the categorization process
        await categorizeAndIngestPlatformData(userId, externalProfile.id, platform, rawPlatformData);
        res.status(201).json(externalProfile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getExternalProfileController = async (req, res) => {
    try {
        const { userId, platform } = req.params;
        const externalProfile = await getExternalProfile(userId, platform.toLowerCase());
        res.status(200).json(externalProfile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateProfileDataController = async (req, res) => {
    try {
        // Here we can re-fetch and update manually if needed
        const { userId, platform, username } = req.body;

        const rawPlatformData = await fetchPlatformData(platform, username);
        if (!rawPlatformData) {
            return res.status(404).json({ error: `Could not fetch data for user ${username} on ${platform}` });
        }

        const existingProfile = await getExternalProfile(userId, platform.toLowerCase());
        const externalProfileId = existingProfile ? existingProfile.id : null;
        const categorizedData = await categorizeAndIngestPlatformData(userId, externalProfileId, platform, rawPlatformData);

        const externalProfile = await updateProfileData(userId, platform.toLowerCase(), categorizedData);
        res.status(200).json(externalProfile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    addExternalProfileController,
    getExternalProfileController,
    updateProfileDataController,
    categorizeAndIngestPlatformData,
    fetchPlatformData
};