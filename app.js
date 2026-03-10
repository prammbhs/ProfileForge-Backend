const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.route");
const userRoutes = require("./routes/user.route");
const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

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
app.use("/api/v1/keys", require("./routes/apiKeys.route"));
app.use("/api/v1/projects", require("./routes/projects.route"));

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

module.exports = app;