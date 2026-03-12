const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const sqsClient = new SQSClient({
    region: process.env.REGION || "ap-south-1",
    ...(process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY && {
        credentials: {
            accessKeyId: process.env.ACCESS_KEY_ID,
            secretAccessKey: process.env.SECRET_ACCESS_KEY,
        }
    })
});

const QUEUE_URL = process.env.SQS_QUEUE_URL;

/**
 * Send a job message to SQS. Non-blocking, fire-and-forget.
 * @param {string} type - Job type: "profile-sync" | "s3-delete"
 * @param {object} data - Job payload
 */
const enqueueJob = async (type, data) => {
    if (!QUEUE_URL) {
        console.warn(`[SQS] No SQS_QUEUE_URL configured — running job "${type}" inline`);
        // Fallback: run inline if SQS is not configured (local dev)
        return null;
    }

    try {
        const command = new SendMessageCommand({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify({ type, data }),
            MessageGroupId: undefined, // Standard queue, not FIFO
        });
        const result = await sqsClient.send(command);
        console.log(`[SQS] Enqueued "${type}" job — MessageId: ${result.MessageId}`);
        return result.MessageId;
    } catch (err) {
        console.error(`[SQS] Failed to enqueue "${type}" job:`, err.message);
        return null;
    }
};

module.exports = { sqsClient, enqueueJob, QUEUE_URL };
