const { Worker } = require("bullmq");
const { deleteFileFromS3 } = require("../utils/s3");
const { connection } = require("../utils/queue");

const s3Worker = new Worker("S3Jobs", async (job) => {
    if (job.name === "deleteImage") {
        const { url } = job.data;
        if (!url) {
            throw new Error("No URL provided in deleteImage job");
        }

        console.log(`[S3 Worker] Processing deletion for ${url}`);
        const success = await deleteFileFromS3(url);

        if (!success) {
            throw new Error(`Failed to delete ${url} from S3.`);
        }

        console.log(`[S3 Worker] Successfully deleted ${url}`);
        return { success: true, url };
    }
}, { connection });

s3Worker.on("completed", (job) => {
    console.log(`[S3 Worker] Job ${job.id} completed successfully`);
});

s3Worker.on("failed", (job, err) => {
    console.error(`[S3 Worker] Job ${job.id} failed with error: ${err.message}`);
});

module.exports = s3Worker;
