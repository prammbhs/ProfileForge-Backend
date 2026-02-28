const express = require("express");
const { getUser, updateProfileImage, updateName, deleteUser } = require("../controllers/user.controller");
const Authenticate = require("../middleware/auth.middleware");
const router = express.Router();

router.get("/profile", Authenticate, getUser);
router.put("/profile/image", Authenticate, updateProfileImage);
router.put("/profile/name", Authenticate, updateName);
router.delete("/profile/delete", Authenticate, deleteUser);

module.exports = router;