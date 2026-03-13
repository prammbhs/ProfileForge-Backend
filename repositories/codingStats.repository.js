const { pool } = require("../utils/postgreClient");

const getCodingStatsCache = async (userId) => {
    const query = `
        SELECT stats, last_synced_at 
        FROM coding_stats 
        WHERE user_id = $1;
    `;
    const { rows } = await pool.query(query, [userId]);
    return rows[0] || null;
};

const upsertCodingStatsCache = async (userId, stats) => {
    const query = `
        INSERT INTO coding_stats (user_id, stats, last_synced_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            stats = EXCLUDED.stats,
            last_synced_at = CURRENT_TIMESTAMP
        RETURNING stats, last_synced_at;
    `;
    const { rows } = await pool.query(query, [userId, stats]);
    return rows[0];
};

const deleteCodingStatsCache = async (userId) => {
    const query = 'DELETE FROM coding_stats WHERE user_id = $1;';
    await pool.query(query, [userId]);
};

module.exports = {
    getCodingStatsCache,
    upsertCodingStatsCache,
    deleteCodingStatsCache
};
