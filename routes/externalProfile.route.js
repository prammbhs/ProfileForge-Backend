const express = require("express");
const {
    addExternalProfileController,
    getExternalProfileController,
    updateProfileDataController
} = require("../controllers/externalProfile.controller");
const Authenticate = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/add", Authenticate, addExternalProfileController);
router.get("/:platform/:userId", Authenticate, getExternalProfileController);
router.put("/update", Authenticate, updateProfileDataController);

module.exports = router;
