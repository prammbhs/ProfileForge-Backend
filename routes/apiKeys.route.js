const express = require("express");
const Authenticate = require("../middleware/auth.middleware");
const {
    generateApiKeyController,
    getApiKeysController,
    revokeApiKeyController,
    getQuotaController,
    getPortfolioDataController
} = require("../controllers/apiKeys.controller");
const apiKeyAuth = require("../middleware/apiKeyAuth.middleware");

const router = express.Router();

router.post("/", Authenticate, generateApiKeyController);
router.get("/", Authenticate, getApiKeysController);
router.delete("/:id", Authenticate, revokeApiKeyController);
router.get("/quota", Authenticate, getQuotaController);

// API Key authenticated route to get unified user data
router.get("/data", apiKeyAuth, getPortfolioDataController);

module.exports = router;
