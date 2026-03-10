const crypto = require("crypto");
const {
    createApiKey,
    getKeysByUserId,
    revokeApiKey
} = require("../repositories/apiKeys.repository");
const { getQuotaByUserId } = require("../repositories/quotas.repository");
const { getProjectsByUserId } = require("../repositories/projects.repository");
const { getUserCertificates } = require("../repositories/certificates.repository");
const { pool } = require("../utils/postgreClient");

// Helper to generate an API key and its hash
const generateKey = () => {
    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    return { rawKey, keyHash };
};

exports.generateApiKeyController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const { name } = req.body;

        // Ensure user hasn't exceeded a sensible limit of API keys (e.g. 5)
        const existingKeys = await getKeysByUserId(userId);
        if (existingKeys.length >= 5) {
            return res.status(403).json({ error: "Maximum number of API keys reached. Revoke an existing key to generate a new one." });
        }

        const { rawKey, keyHash } = generateKey();
        const keyData = await createApiKey(userId, keyHash, name || "Default Key");

        res.status(201).json({
            message: "API Key generated successfully. Make sure to copy it now, as you won't be able to see it again.",
            apiKey: rawKey,
            keyDetails: {
                id: keyData.id,
                name: keyData.name,
                created_at: keyData.created_at
            }
        });
    } catch (error) {
        console.error("Error generating API Key", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.getApiKeysController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const keys = await getKeysByUserId(userId);
        res.status(200).json({ keys });
    } catch (error) {
        console.error("Error fetching API keys", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.revokeApiKeyController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const keyId = req.params.id;

        const revokedKey = await revokeApiKey(keyId, userId);
        if (!revokedKey) {
            return res.status(404).json({ error: "API Key not found or does not belong to user" });
        }

        res.status(200).json({ message: "API Key revoked successfully" });
    } catch (error) {
        console.error("Error revoking API key", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.getQuotaController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const quota = await getQuotaByUserId(userId);
        res.status(200).json({ quota });
    } catch (error) {
        console.error("Error fetching quota", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.getPortfolioDataController = async (req, res) => {
    try {
        const userId = req.user.internalId;

        const [projects, certificates, { rows: externalProfiles }] = await Promise.all([
            getProjectsByUserId(userId),
            getUserCertificates(userId),
            pool.query('SELECT * FROM external_profiles WHERE user_id = $1', [userId])
        ]);

        res.status(200).json({
            projects,
            certificates,
            externalProfiles
        });
    } catch (error) {
        console.error("Error fetching portfolio data", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
