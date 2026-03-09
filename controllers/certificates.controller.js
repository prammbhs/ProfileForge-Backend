const crypto = require("crypto");
const { generatePresignedUploadUrl } = require("../utils/s3");
const { addCertificate, getUserCertificates, deleteCertificate } = require("../repositories/certificates.repository");

const getPresignedUrlController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const { contentType, fileExtension } = req.body; // e.g., 'image/png', 'png'

        if (!contentType || !fileExtension) {
            return res.status(400).json({ error: "contentType and fileExtension are required" });
        }

        // Generate a random UUID-like key for the file to prevent collisions
        const randomHash = crypto.randomBytes(16).toString("hex");
        const fileKey = `certificates/${userId}/${randomHash}.${fileExtension}`;

        const uploadData = await generatePresignedUploadUrl(fileKey, contentType);

        res.status(200).json(uploadData);
    } catch (error) {
        console.error("Presigned URL Error:", error);
        res.status(500).json({ error: "Could not generate presigned URL. Check AWS configuration." });
    }
};

const addCertificateController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const { title, issuer, issue_date, credential_url, fileKey, details } = req.body;

        if (!title) {
            return res.status(400).json({ error: "title is required" });
        }

        let file_url = null;
        if (fileKey) {
            const cloudfrontUrl = process.env.AWS_CLOUDFRONT_URL;
            if (!cloudfrontUrl) {
                return res.status(500).json({ error: "AWS_CLOUDFRONT_URL is not configured on the server." });
            }
            // Ensure it ends with a slash if not provided, or simply construct it safely
            const sanitizedDomain = cloudfrontUrl.replace(/\/$/, "");
            file_url = `${sanitizedDomain}/${fileKey}`;
        }

        const data = {
            title,
            issuer,
            issue_date,
            credential_url,
            file_url,
            details
        };

        const newCertificate = await addCertificate(userId, data);
        res.status(201).json({ message: "Certificate saved successfully", certificate: newCertificate });
    } catch (error) {
        console.error("Add Certificate Error:", error);
        res.status(500).json({ error: "Failed to save certificate metadata." });
    }
};

const getUserCertificatesController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const certificates = await getUserCertificates(userId);
        res.status(200).json(certificates);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user certificates." });
    }
};

const deleteCertificateController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const { id } = req.params;

        const deleted = await deleteCertificate(id, userId);
        if (!deleted) {
            return res.status(404).json({ error: "Certificate not found or unauthorized to delete." });
        }
        res.status(200).json({ message: "Certificate deleted successfully", certificate: deleted });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete certificate" });
    }
}

module.exports = {
    getPresignedUrlController,
    addCertificateController,
    getUserCertificatesController,
    deleteCertificateController
};
