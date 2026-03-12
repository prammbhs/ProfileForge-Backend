const Redis = require("ioredis");

// Singleton shared Redis client for all application use (caching, rate limiting, etc.)
// This prevents each file from creating its own connection.
let sharedClient = null;

const getRedisClient = () => {
    if (!sharedClient) {
        const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
        sharedClient = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            lazyConnect: true,
            // Exponential backoff: retry every 2s, 4s, 8s... up to 30s max
            retryStrategy(times) {
                const delay = Math.min(times * 2000, 30000);
                return delay;
            },
            // Don't auto-reconnect more than 20 times before giving up temporarily
            reconnectOnError(err) {
                // Only reconnect on connection reset, not on auth/protocol errors
                return err.message.includes("ECONNRESET") || err.message.includes("ECONNREFUSED");
            }
        });

        sharedClient.connect().catch(err => {
            console.error("[Redis] Initial connection failed:", err.message);
        });

        // Only log once, not on every reconnect cycle
        let lastLogTime = 0;
        sharedClient.on("error", (err) => {
            const now = Date.now();
            if (now - lastLogTime > 60000) { // Log at most once per minute
                console.error("[Redis] Error:", err.message);
                lastLogTime = now;
            }
        });

        sharedClient.on("connect", () => {
            console.log("[Redis] Shared client connected.");
        });
    }
    return sharedClient;
};

module.exports = { getRedisClient };
