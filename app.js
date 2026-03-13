const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.route");
const userRoutes = require("./routes/user.route");
const app = express();
app.set("trust proxy", 1); // Trust the first proxy (Nginx) to get correct client IPs

// ── Middleware ────────────────────────────────────────────────────────────────
// ── CORS Configuration ────────────────────────────────────────────────────────
const allowedOrigins = [
    process.env.FRONTEND_URL,
    "https://profileforge.duckdns.org",
    "http://localhost:5173",
    "https://profile-forge-two.vercel.app"
].filter(Boolean).flatMap(o => o.split(",")).map(o => o.trim().replace(/\/$/, ""));

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        const normalizedOrigin = origin.replace(/\/$/, "");
        const isVercel = /\.vercel\.app$/.test(normalizedOrigin);
        const isDuckDns = /\.duckdns\.org$/.test(normalizedOrigin);
        
        if (allowedOrigins.includes(normalizedOrigin) || isVercel || isDuckDns) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Rejected origin: ${origin}`);
            // Just return false instead of an error to prevent 500 crash in some middleware setups
            callback(null, false);
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

// ── Global Rate Limiter ───────────────────────────────────────────────────────
app.use(require("./middleware/globalRateLimiter.middleware"));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
    res.json({ status: "ok", service: "ProfileForge API" });
});

// ── Routes ──────────────────────────────────────────────────────────────────────
app.use("/api/v1", authRoutes);
app.use("/api/v1", userRoutes);
app.use("/api/v1/certificates", require("./routes/certificates.route"));
app.use("/api/v1/external-profile", require("./routes/externalProfile.route"));
app.use("/api/v1/codingStats", require("./routes/codingStats.route"));
app.use("/api/v1/badges", require("./routes/badges.route"));
app.use("/api/v1/keys", require("./routes/apiKeys.route"));
app.use("/api/v1/projects", require("./routes/projects.route"));

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

module.exports = app;