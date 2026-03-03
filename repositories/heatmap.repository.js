const { pool } = require("../utils/postgreClient");

/**
 * Inserts a new timeline event (e.g., a GitHub commit, a LeetCode submission).
 * This acts as the raw chronological feed.
 */
const addActivityEvent = async (userId, externalProfileId, platform, category, activityType, activityDate, title, url, metadata) => {
    const query = `
        INSERT INTO activity_events 
        (user_id, external_profile_id, platform, category, activity_type, activity_date, title, url, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
    `;
    const values = [userId, externalProfileId, platform, category, activityType, activityDate, title, url, metadata];
    const { rows } = await pool.query(query, values);
    return rows[0];
};

/**
 * Increments the user's heatmap numeric tracking by 1 for a specific day.
 * If the day doesn't exist, it seeds it at 1.
 */
const incrementHeatmapCount = async (userId, activityDate) => {
    const query = `
        INSERT INTO activity_heatmap (user_id, activity_date, activity_count)
        VALUES ($1, $2, 1)
        ON CONFLICT (user_id, activity_date)
        DO UPDATE SET activity_count = activity_heatmap.activity_count + 1
        RETURNING *;
    `;
    const values = [userId, activityDate];
    const { rows } = await pool.query(query, values);
    return rows[0];
};

/**
 * Specifically wipes existing events for an exact user + platform.
 * Crucial when we fully-resync to avoid infinite duplicate commits in the DB.
 */
const rebuildHeatmapForUser = async (userId) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `
                DELETE FROM activity_heatmap
                WHERE user_id = $1;
            `,
            [userId]
        );
        await client.query(
            `
                INSERT INTO activity_heatmap (user_id, activity_date, activity_count)
                SELECT user_id, activity_date, COUNT(*)
                FROM activity_events
                WHERE user_id = $1
                GROUP BY user_id, activity_date;
            `,
            [userId]
        );
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const purgePlatformActivityEvents = async (userId, platform) => {
    const query = `
        DELETE FROM activity_events
        WHERE user_id = $1 AND platform = $2;
    `;
    const values = [userId, platform];
    await pool.query(query, values);

    // Rebuild heatmap from remaining events so other platforms are preserved.
    await rebuildHeatmapForUser(userId);
};

/**
 * API query: Retrieves the timeline grouping based on `ai_agent_db_architecture_readme.md`.
 */
const getTimelineEvents = async (userId, cursorDate = new Date().toISOString()) => {
    const query = `
        SELECT
            activity_date,
            json_agg(
                json_build_object(
                    'title', title,
                    'platform', platform,
                    'category', category,
                    'type', activity_type,
                    'metadata', metadata,
                    'url', url
                )
            ) AS activities
        FROM activity_events
        WHERE user_id = $1 AND activity_date <= $2
        GROUP BY activity_date
        ORDER BY activity_date DESC
        LIMIT 30;
    `;
    const values = [userId, cursorDate];
    const { rows } = await pool.query(query, values);
    return rows;
};

/**
 * API query: retrieves exactly the raw heatmap counter map.
 */
const getHeatmapCounts = async (userId, startDate, endDate) => {
    const query = `
        SELECT activity_date, activity_count
        FROM activity_heatmap
        WHERE user_id = $1
        AND activity_date BETWEEN $2 AND $3
        ORDER BY activity_date ASC;
    `;
    const values = [userId, startDate, endDate];
    const { rows } = await pool.query(query, values);
    return rows;
};

module.exports = {
    addActivityEvent,
    incrementHeatmapCount,
    purgePlatformActivityEvents,
    rebuildHeatmapForUser,
    getTimelineEvents,
    getHeatmapCounts
};
