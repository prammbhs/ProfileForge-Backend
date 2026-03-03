const express = require('express');
const { getTimelineEvents, getHeatmapCounts } = require('../repositories/heatmap.repository');
const router = express.Router();

/**
 * GET /api/v1/timeline/:userId
 * Retrieves unified paginated timeline events across all platforms
 */
router.get("/timeline/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const { cursor } = req.query; // ISO Date String

        const timeline = await getTimelineEvents(userId, cursor || new Date().toISOString());

        res.status(200).json(timeline);
    } catch (error) {
        console.error("Fetch timeline error", error.message);
        res.status(500).json({ error: "Failed to fetch user timeline" });
    }
});

/**
 * GET /api/v1/heatmap/:userId
 * Retrieves aggregated daily activity counts
 */
router.get("/heatmap/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const { start_date, end_date } = req.query; // YYYY-MM-DD format

        if (!start_date || !end_date) {
            return res.status(400).json({ error: "start_date and end_date query parameters are required." });
        }

        const heatmap = await getHeatmapCounts(userId, start_date, end_date);

        res.status(200).json(heatmap);
    } catch (error) {
        console.error("Fetch heatmap error", error.message);
        res.status(500).json({ error: "Failed to fetch user heatmap" });
    }
});

module.exports = router;
