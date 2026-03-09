const express = require("express");
const Authenticate = require("../middleware/auth.middleware");
const { validate } = require("../middleware/schemavalidation.middleware");
const { certificateSchema, presignSchema, updateCertificateSchema } = require("../validation/certificates.validator");
const {
    getPresignedUrlController,
    addCertificateController,
    getUserCertificatesController,
    deleteCertificateController,
    updateCertificateController
} = require("../controllers/certificates.controller");

const router = express.Router();

router.post("/presign", Authenticate, validate(presignSchema), getPresignedUrlController);
router.post("/", Authenticate, validate(certificateSchema), addCertificateController);
router.get("/", Authenticate, getUserCertificatesController);
router.put("/:id", Authenticate, validate(updateCertificateSchema), updateCertificateController);
router.delete("/:id", Authenticate, deleteCertificateController);

module.exports = router;
