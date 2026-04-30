const rateLimit = require("express-rate-limit");


const globalRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again after a minute." }
});

module.exports = globalRateLimiter;
