const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const { fetchPlatformData } = require("../services/externalProfile.service");
const { updateProfileData } = require("../repositories/externalProfile.repository");
const { deleteFileFromS3 } = require("../utils/s3");

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
let isRunning = false;

/**
 * Process a single SQS message based on job type.
 */
async function processMessage(message) {
    const body = JSON.parse(message.Body);
    const { type, data } = body;

    switch (type) {
        case "profile-sync": {
            const { userId, platform, username } = data;
            console.log(`[SQS Worker] Syncing profile ${platform}:${username}`);
            const rawPlatformData = await fetchPlatformData(platform, username);
            if (rawPlatformData) {
                await updateProfileData(userId, platform.toLowerCase(), rawPlatformData);
                console.log(`[SQS Worker] Successfully synced ${platform}:${username}`);
            } else {
                console.warn(`[SQS Worker] No data returned for ${platform}:${username}`);
            }
            break;
        }
        case "s3-delete": {
            const { url } = data;
            console.log(`[SQS Worker] Deleting S3 file: ${url}`);
            const success = await deleteFileFromS3(url);
            if (success) {
                console.log(`[SQS Worker] Deleted: ${url}`);
            } else {
                console.warn(`[SQS Worker] Could not delete: ${url}`);
            }
            break;
        }
        default:
            console.warn(`[SQS Worker] Unknown job type: ${type}`);
    }
}

/**
 * Long-poll SQS queue. Each poll waits up to 20s for messages (free when empty).
 * Runs as a background loop inside the same Node process.
 */
async function startSQSWorker() {
    if (!QUEUE_URL) {
        console.log("[SQS Worker] No SQS_QUEUE_URL configured — worker disabled.");
        return;
    }

    isRunning = true;
    console.log("[SQS Worker] Started. Long-polling for jobs...");

    while (isRunning) {
        try {
            const command = new ReceiveMessageCommand({
                QueueUrl: QUEUE_URL,
                MaxNumberOfMessages: 10,
                WaitTimeSeconds: 20, // Long poll — free when queue is empty
            });

            const response = await sqsClient.send(command);

            if (response.Messages && response.Messages.length > 0) {
                for (const message of response.Messages) {
                    try {
                        await processMessage(message);

                        // Delete message after successful processing
                        await sqsClient.send(new DeleteMessageCommand({
                            QueueUrl: QUEUE_URL,
                            ReceiptHandle: message.ReceiptHandle,
                        }));
                    } catch (err) {
                        console.error(`[SQS Worker] Error processing message ${message.MessageId}:`, err.message);
                        // Message will become visible again after VisibilityTimeout (120s)
                    }
                }
            }
        } catch (err) {
            console.error("[SQS Worker] Polling error:", err.message);
            // Wait 5s before retrying on error
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

function stopSQSWorker() {
    isRunning = false;
}

module.exports = { startSQSWorker, stopSQSWorker };
