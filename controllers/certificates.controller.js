const crypto = require("crypto");
const { generatePresignedUploadUrl, deleteFileFromS3 } = require("../utils/s3");
const { addCertificate, getUserCertificates, getCertificateById, deleteCertificate, updateCertificate } = require("../repositories/certificates.repository");
const { enqueueJob, QUEUE_URL } = require("../utils/sqsClient");

/**
 * Delete an S3 file via SQS (preferred) or setImmediate (fallback for local dev).
 */
const backgroundDeleteS3 = (url) => {
    if (QUEUE_URL) {
        enqueueJob("s3-delete", { url }).catch(err =>
            console.error("[S3 Cleanup] Failed to enqueue:", err.message)
        );
    } else {
        setImmediate(async () => {
            try {
                const success = await deleteFileFromS3(url);
                console.log(success ? `[S3 Cleanup] Deleted: ${url}` : `[S3 Cleanup] Could not delete: ${url}`);
            } catch (err) {
                console.error(`[S3 Cleanup] Error: ${err.message}`);
            }
        });
    }
};

const getPresignedUrlController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const { contentType, fileExtension } = req.body;

        if (!contentType || !fileExtension) {
            return res.status(400).json({ error: "contentType and fileExtension are required" });
        }

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
            const sanitizedDomain = cloudfrontUrl.replace(/\/$/, "");
            file_url = `${sanitizedDomain}/${fileKey}`;
        }

        const data = { title, issuer, issue_date, credential_url, file_url, details };

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

        if (deleted.file_url) {
            backgroundDeleteS3(deleted.file_url);
        }

        res.status(200).json({ message: "Certificate deleted successfully", certificate: deleted });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete certificate" });
    }
}

const updateCertificateController = async (req, res) => {
    try {
        const userId = req.user.internalId;
        const { id } = req.params;
        const { title, issuer, issue_date, credential_url, fileKey, details } = req.body;

        const oldCert = await getCertificateById(id, userId);
        if (!oldCert) {
            return res.status(404).json({ error: "Certificate not found or unauthorized to update." });
        }

        let file_url = null;
        if (fileKey) {
            const cloudfrontUrl = process.env.AWS_CLOUDFRONT_URL;
            if (!cloudfrontUrl) {
                return res.status(500).json({ error: "AWS_CLOUDFRONT_URL is not configured on the server." });
            }
            const sanitizedDomain = cloudfrontUrl.replace(/\/$/, "");
            file_url = `${sanitizedDomain}/${fileKey}`;

            if (oldCert.file_url) {
                backgroundDeleteS3(oldCert.file_url);
            }
        }

        const data = { title, issuer, issue_date, credential_url, file_url, details };

        const updatedCertificate = await updateCertificate(id, userId, data);
        if (!updatedCertificate) {
            return res.status(404).json({ error: "Certificate not found or unauthorized to update." });
        }

        res.status(200).json({ message: "Certificate updated successfully", certificate: updatedCertificate });
    } catch (error) {
        console.error("Update Certificate Error:", error);
        res.status(500).json({ error: "Failed to update certificate metadata." });
    }
}

module.exports = {
    getPresignedUrlController,
    addCertificateController,
    getUserCertificatesController,
    deleteCertificateController,
    updateCertificateController
};
