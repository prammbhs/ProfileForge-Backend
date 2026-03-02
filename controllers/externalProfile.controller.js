const { addExternalProfile, getExternalProfile, updateProfileData } = require("../repositories/externalProfile.repository");

const addExternalProfileController = async (req, res) => {
    try {
        const { userId, platform, username, profileUrl, platformData } = req.body;
        if (!userId || !platform || !username || !profileUrl || !platformData) {
            return res.status(400).json({ error: "All fields are required" });
        }
        const externalProfile = await addExternalProfile(userId, platform, username, profileUrl, platformData);
        res.status(201).json(externalProfile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getExternalProfileController = async (req, res) => {
    try {
        const { userId, platform } = req.params;
        const externalProfile = await getExternalProfile(userId, platform);
        res.status(200).json(externalProfile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateProfileDataController = async (req, res) => {
    try {
        const { userId, platform, platformData } = req.body;
        const externalProfile = await updateProfileData(userId, platform, platformData);
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