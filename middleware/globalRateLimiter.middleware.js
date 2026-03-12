const rateLimit = require("express-rate-limit");

// In-memory rate limiter — zero Redis commands.
// For a single-server student project, MemoryStore is sufficient.
// It resets on server restart, which is acceptable at this scale.
const globalRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again after a minute." }
});

module.exports = globalRateLimiter;
