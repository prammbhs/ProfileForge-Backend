const crypto = require("crypto");
const { getApiKeyByHash, updateLastUsed } = require("../repositories/apiKeys.repository");
const { getQuotaByUserId } = require("../repositories/quotas.repository");
const { getRedisClient } = require("../utils/redisClient");
const { apiKeyCache, quotaCache } = require("../utils/lruCache");

const redis = getRedisClient();

/**
 * Try to get a value from Redis with a timeout.
 */
async function safeRedisGet(key) {
    try {
        if (redis.status !== "ready") return null;
        return await Promise.race([
            redis.get(key),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 2000))
        ]);
    } catch {
        return null;
    }
}

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

        // ── Resolve keyData: L1 (LRU) → L2 (Redis) → L3 (PostgreSQL) ─────
        let keyData = apiKeyCache.get(keyHash);

        if (!keyData) {
            const cached = await safeRedisGet(`api_key:${keyHash}`);
            if (cached) {
                keyData = JSON.parse(cached);
            } else {
                keyData = await getApiKeyByHash(keyHash);
                if (!keyData) {
                    return res.status(401).json({ error: "Invalid API Key" });
                }
                // Populate L2 (fire-and-forget)
                redis.setex(`api_key:${keyHash}`, 3600, JSON.stringify(keyData)).catch(() => {});
            }
            // Populate L1
            apiKeyCache.set(keyHash, keyData);
        }

        const userId = keyData.user_id;

        // ── Resolve quota: L1 (LRU) → L2 (Redis) → L3 (PostgreSQL) ─────
        let apiLimit = 1000;
        let currentQuota = quotaCache.get(userId);

        if (!currentQuota) {
            const cachedQuota = await safeRedisGet(`user_quota:${userId}`);
            if (cachedQuota) {
                currentQuota = JSON.parse(cachedQuota);
            } else {
                currentQuota = await getQuotaByUserId(userId);
                if (currentQuota) {
                    redis.setex(`user_quota:${userId}`, 3600, JSON.stringify(currentQuota)).catch(() => {});
                }
            }
            if (currentQuota) {
                quotaCache.set(userId, currentQuota);
            }
        }

        if (currentQuota) {
            apiLimit = currentQuota.api_calls_limit || 1000;
        }

        // ── Rate limiting (Redis only — needed for distributed accuracy) ──
        let currentCalls = 1;
        try {
            if (redis.status === "ready") {
                const rateLimitKey = `rate_limit:hourly:${userId}`;
                currentCalls = await Promise.race([
                    redis.incr(rateLimitKey),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000))
                ]);
                if (currentCalls === 1) {
                    redis.expire(rateLimitKey, 3600).catch(() => {});
                }
            }
        } catch { /* Redis down — allow request */ }

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
