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

const router = express.Router();

router.post("/", Authenticate, generateApiKeyController);
router.get("/", Authenticate, getApiKeysController);
router.delete("/:id", Authenticate, revokeApiKeyController);
router.get("/quota", Authenticate, getQuotaController);

// API Key authenticated routes (Publicly accessible from any frontend)
router.get("/data", apiKeyAuth, getPortfolioDataController); // Unified endpoint
router.get("/projects", apiKeyAuth, getProjectsAPI);
router.get("/stats", apiKeyAuth, getStatsAPI);
router.get("/certificates", apiKeyAuth, getCertificatesAPI);
router.get("/badges", apiKeyAuth, getBadgesAPI);
router.get("/platforms/:platform", apiKeyAuth, getPlatformDataAPI);

module.exports = router;
