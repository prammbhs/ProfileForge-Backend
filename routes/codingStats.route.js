const express = require("express");
const Authenticate = require("../middleware/auth.middleware");
const { getCodingStatsController } = require("../controllers/codingStats.controller");

const router = express.Router();

router.get("/", Authenticate, getCodingStatsController);

module.exports = router;
