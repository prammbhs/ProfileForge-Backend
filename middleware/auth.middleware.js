const { getUserByCognitoSub } = require("../repositories/users.repository");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const { getRedisClient } = require("../utils/redisClient");
const { authCache } = require("../utils/lruCache");

const redis = getRedisClient();

const client = jwksClient({
    jwksUri: `https://cognito-idp.${process.env.REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
});

function getPublicKey(header, callback) {
    client.getSigningKey(header.kid, function (err, key) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, key.publicKey);
        }
    });
}

// Map to track in-flight authentication lookups to prevent "thundering herd"
const inFlightAuth = new Map();

/**
 * Try to get a value from Redis with a timeout.
 * Returns null if Redis is down or slow — never blocks the request.
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

/**
 * Perform the Actual lookup (L2 -> L3) and populate caches.
 * Wrapped in a promise for coalescing.
 */
async function performInternalIdLookup(sub) {
    const cacheKey = `auth_sub:${sub}`;

    // ── L2: Redis ─────────────────────
    let internalId = await safeRedisGet(cacheKey);

    if (!internalId) {
        // ── L3: PostgreSQL (only on cold start) ──────────
        const internalUser = await getUserByCognitoSub(sub);
        if (!internalUser) {
            throw new Error("User not found");
        }
        internalId = internalUser.id;
        // Populate L2 (fire-and-forget)
        redis.setex(cacheKey, 86400, internalId).catch(() => { });
    }

    // Populate L1
    authCache.set(sub, internalId);
    return internalId;
}

function Authenticate(req, res, next) {
    const token = req.cookies.accessToken;
    if (!token) {
        return res.status(401).json({ error: "Login to continue" });
    }
    jwt.verify(token, getPublicKey,
        {
            issuer: `https://cognito-idp.${process.env.REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
        }, async (err, decoded) => {
            if (err) {
                console.log("Authentication error", err.name, err.message);
                return res.status(401).json({ error: "Login to continue" });
            }
            try {
                // ── L1: LRU cache (in-memory, 0 Redis commands) ─────────
                let internalId = authCache.get(decoded.sub);

                if (!internalId) {
                    // ── Request Coalescing (Deduplication) ────────────────
                    // If a lookup is already in progress for this sub, wait for it.
                    if (inFlightAuth.has(decoded.sub)) {
                        internalId = await inFlightAuth.get(decoded.sub);
                    } else {
                        // Start a new lookup and track it
                        const lookupPromise = performInternalIdLookup(decoded.sub);
                        inFlightAuth.set(decoded.sub, lookupPromise);

                        try {
                            internalId = await lookupPromise;
                        } finally {
                            // Always clean up the map, regardless of success/error
                            inFlightAuth.delete(decoded.sub);
                        }
                    }
                }

                decoded.internalId = internalId;
                req.user = decoded;
                next();
            } catch (authError) {
                if (authError.message === "User not found") {
                    return res.status(401).json({ error: "User not found in system" });
                }
                console.error("Auth middleware internal error:", authError);
                return res.status(500).json({ error: "Internal server error" });
            }
        });
}


module.exports = Authenticate;