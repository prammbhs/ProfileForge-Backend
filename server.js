require("dotenv").config();
const app = require("./app.js");
const { connectDB } = require("./utils/postgreClient");
const startSyncService = require("./services/syncService");
const port = process.env.PORT || 8000;

app.listen(port, async () => {
    console.log(`Server is running on http://localhost:${port}/`);
    await connectDB();
    startSyncService();
});