require("dotenv").config();
require("node:dns").setDefaultResultOrder("ipv4first"); // Fix for Node native fetch failing on IPv6
const app = require("./app.js");
const { connectDB } = require("./utils/postgreClient");
const startSyncService = require("./services/syncService");
const { startSQSWorker } = require("./workers/sqsWorker");
const port = process.env.PORT || 8000;

app.listen(port, async () => {
    console.log(`Server is running on http://localhost:${port}/`);
    await connectDB();
    startSyncService();

    // Start SQS worker for background jobs (profile-sync, s3-delete)
    startSQSWorker();
});