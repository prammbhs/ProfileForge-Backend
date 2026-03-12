const express = require("express");
const Authenticate = require("../middleware/auth.middleware");
const {
    generateApiKeyController,
    getApiKeysController,
    revokeApiKeyController,
    getQuotaController,
    getPortfolioDataController,
    getProjectsAPI,
    getStatsAPI,
    getCertificatesAPI,
    getBadgesAPI,
    getPlatformDataAPI
} = require("../controllers/apiKeys.controller");
const apiKeyAuth = require("../middleware/apiKeyAuth.middleware");
const cors = require("cors");

const router = express.Router();

// Permissive CORS for public API endpoints (allows any origin to use API keys)
const publicCors = cors({
    origin: "*",
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-api-key"]
});

router.post("/", Authenticate, generateApiKeyController);
router.get("/", Authenticate, getApiKeysController);
router.delete("/:id", Authenticate, revokeApiKeyController);
router.get("/quota", Authenticate, getQuotaController);

// API Key authenticated routes (Publicly accessible from any frontend)
router.get("/data", publicCors, apiKeyAuth, getPortfolioDataController); // Unified endpoint
router.get("/projects", publicCors, apiKeyAuth, getProjectsAPI);
router.get("/stats", publicCors, apiKeyAuth, getStatsAPI);
router.get("/certificates", publicCors, apiKeyAuth, getCertificatesAPI);
router.get("/badges", publicCors, apiKeyAuth, getBadgesAPI);
router.get("/platforms/:platform", publicCors, apiKeyAuth, getPlatformDataAPI);

module.exports = router;
