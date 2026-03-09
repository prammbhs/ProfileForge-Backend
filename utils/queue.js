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

module.exports = {
    profileSyncQueue,
    connection
};
