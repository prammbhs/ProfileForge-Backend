const express = require("express");
const Authenticate = require("../middleware/auth.middleware");
const { getBadgesController } = require("../controllers/badges.controller");

const router = express.Router();

router.get("/", Authenticate, getBadgesController);

module.exports = router;
