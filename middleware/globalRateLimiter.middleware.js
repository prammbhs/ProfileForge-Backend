const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis").default;
const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
// Initialize the Redis client. Ensure host/port match connection settings.
const client = new Redis(redisUrl);

const globalRateLimiter = rateLimit({
    store: new RedisStore({
        sendCommand: (...args) => client.call(...args),
    }),
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true, // Return limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: "Too many requests from this IP, please try again after a minute." }
});

module.exports = globalRateLimiter;
