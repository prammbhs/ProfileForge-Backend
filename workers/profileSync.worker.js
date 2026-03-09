const { Worker } = require("bullmq");
const { connection } = require("../utils/queue");
const { fetchPlatformData } = require("../services/externalProfile.service");
const { updateProfileData } = require("../repositories/externalProfile.repository");

const profileSyncWorker = new Worker(
    "ProfileSync",
    async (job) => {
        const { userId, platform, username } = job.data;

        console.log(`[Worker] Starting profile sync job. User: ${userId}, Platform: ${platform}, Username: ${username}`);

        try {
            const rawPlatformData = await fetchPlatformData(platform, username);
            if (!rawPlatformData) {
                console.warn(`[Worker] No data fetched for ${platform}:${username}`);
                throw new Error(`Profile sync failed. No data returned from ${platform}`);
            }

            await updateProfileData(userId, platform.toLowerCase(), rawPlatformData);

            console.log(`[Worker] Successfully completed sync for ${platform}:${username}`);
            return { status: "success", platform, username };
        } catch (error) {
            console.error(`[Worker] Background fetch failed for ${platform}:${username}`, error.message);
            throw error; // Let BullMQ handle retries if configured
        }
    },
    {
        connection,
        concurrency: 5, // Process up to 5 profiles concurrently
        limiter: {
            max: 100,
            duration: 60000, // Max 100 jobs per minute
        },
        removeOnComplete: { count: 100 }, // Keep last 100 for visibility
        removeOnFail: { age: 24 * 3600 } // Keep failed jobs for 24 hours
    }
);

profileSyncWorker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} has completed!`);
});

profileSyncWorker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job.id} failed with error ${err.message}`);
});

module.exports = profileSyncWorker;
