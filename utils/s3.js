const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({
    region: process.env.REGION || "ap-south-1",
    // If running locally, explicitly load from dotenv. In production inside AWS, it falls back to IAM roles.
    ...(process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY && {
        credentials: {
            accessKeyId: process.env.ACCESS_KEY_ID,
            secretAccessKey: process.env.SECRET_ACCESS_KEY,
        }
    })
});

const generatePresignedUploadUrl = async (fileKey, contentType) => {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;

    if (!bucketName) {
        throw new Error("AWS_S3_BUCKET_NAME environment variable is not defined.");
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        throw new Error("Missing AWS configuration. You must define AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file!");
    }

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        ContentType: contentType
    });

    // The URL will expire after 15 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return {
        uploadUrl,
        fileKey
    };
};

module.exports = {
    s3Client,
    generatePresignedUploadUrl
};
