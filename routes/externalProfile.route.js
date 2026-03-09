const express = require("express");
const {
    addExternalProfileController,
    getExternalProfileController,
    updateProfileDataController
} = require("../controllers/externalProfile.controller");
const Authenticate = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/add", Authenticate, addExternalProfileController);
router.get("/:platform", Authenticate, getExternalProfileController);
router.put("/update", Authenticate, updateProfileDataController);

module.exports = router;
