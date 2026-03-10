const { Queue } = require("bullmq");

const connection = {
    url: process.env.REDIS_URL || "redis://localhost:6379"
};

const profileSyncQueue = new Queue("ProfileSync", {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: {
            age: 24 * 3600
        }
    }
});

const s3JobQueue = new Queue("S3Jobs", {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: {
            age: 24 * 3600 // Keep failed jobs for 1 day for manual inspection if needed
        },
        attempts: 3, // Retry failed deletions
        backoff: {
            type: 'exponential',
            delay: 5000 // 5s, 10s, 20s
        }
    }
});

module.exports = {
    profileSyncQueue,
    s3JobQueue,
    connection
};
