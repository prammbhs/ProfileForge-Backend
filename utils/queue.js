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
            age: 24 * 3600
        },
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000
        }
    }
});

module.exports = {
    profileSyncQueue,
    s3JobQueue,
    connection
};
