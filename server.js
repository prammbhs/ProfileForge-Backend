require("dotenv").config();
require("node:dns").setDefaultResultOrder("ipv4first"); // Fix for Node native fetch failing on IPv6
const app = require("./app.js");
const { connectDB } = require("./utils/postgreClient");
const startSyncService = require("./services/syncService");
const port = process.env.PORT || 8000;

// Initialize workers
require("./workers/profileSync.worker");

app.listen(port, async () => {
    console.log(`Server is running on http://localhost:${port}/`);
    await connectDB();
    startSyncService();
});