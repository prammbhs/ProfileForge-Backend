const express = require("express");
const apiKeyAuth = require("../middleware/apiKeyAuth.middleware");
const Authenticate = require("../middleware/auth.middleware");
const { validate } = require("../middleware/schemavalidation.middleware");
const { projectSchema, updateProjectSchema } = require("../validation/projects.validation");

const {
    getProjectPresignedUrlController,
    addProjectController,
    getProjectsController,
    updateProjectController,
    deleteProjectController
} = require("../controllers/projects.controller");

const router = express.Router();

// Publicly read via API Key auth
router.get("/:userId", apiKeyAuth, getProjectsController);

// Authenticated mutations via Dashboard cookies
router.get("/", Authenticate, async (req, res) => {
    try {
        const userId = req.user.internalId;
        const { getProjectsByUserId } = require("../repositories/projects.repository");
        const projects = await getProjectsByUserId(userId);
        res.status(200).json(projects);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch projects." });
    }
});
router.post("/presign", Authenticate, getProjectPresignedUrlController);
router.post("/", Authenticate, validate(projectSchema), addProjectController);
router.put("/:id", Authenticate, validate(updateProjectSchema), updateProjectController);
router.delete("/:id", Authenticate, deleteProjectController);

module.exports = router;
