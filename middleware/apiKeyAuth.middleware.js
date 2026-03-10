const crypto = require("crypto");
const { getApiKeyByHash, updateLastUsed } = require("../repositories/apiKeys.repository");
const { getQuotaByUserId } = require("../repositories/quotas.repository");
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const apiKeyAuth = async (req, res, next) => {
    try {
        if (req.method !== 'GET') {
            return res.status(403).json({ error: "API Keys are strictly read-only and restricted to GET requests." });
        }

        const rawKey = req.headers['x-api-key'];

        if (!rawKey) {
            return res.status(401).json({ error: "Missing x-api-key header" });
        }

        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        const cacheKey = `api_key:${keyHash}`;
        let cachedKeyData = await redis.get(cacheKey);
        let keyData;

        if (cachedKeyData) {
            keyData = JSON.parse(cachedKeyData);
        } else {
            keyData = await getApiKeyByHash(keyHash);
            if (!keyData) {
                return res.status(401).json({ error: "Invalid API Key" });
            }
            await redis.setex(cacheKey, 3600, JSON.stringify(keyData));
        }

        const userId = keyData.user_id;

        const quotaCacheKey = `user_quota:${userId}`;
        let quotaData = await redis.get(quotaCacheKey);
        let apiLimit = 1000;

        if (quotaData) {
            const parsed = JSON.parse(quotaData);
            apiLimit = parsed.api_calls_limit || 1000;
        } else {
            const quota = await getQuotaByUserId(userId);
            if (quota) {
                apiLimit = quota.api_calls_limit;
                await redis.setex(quotaCacheKey, 3600, JSON.stringify(quota));
            }
        }

        const rateLimitKey = `rate_limit:hourly:${userId}`;
        const currentCalls = await redis.incr(rateLimitKey);

        if (currentCalls === 1) {
            await redis.expire(rateLimitKey, 3600);
        }

        if (currentCalls > apiLimit) {
            return res.status(429).json({
                error: "Hourly API rate limit exceeded.",
                limit: apiLimit
            });
        }

        updateLastUsed(keyData.id).catch(err => console.error("Failed to update last_used_at", err));

        req.user = { internalId: userId, email: keyData.email };
        next();
    } catch (error) {
        console.error("API Key Auth Error:", error);
        res.status(500).json({ error: "Internal server error during authentication" });
    }
};

module.exports = apiKeyAuth;
