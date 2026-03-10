const { pool } = require("../utils/postgreClient");

const getCachedBadges = async (userId) => {
    const query = `
        SELECT badges, last_synced_at 
        FROM user_badges 
        WHERE user_id = $1;
    `;
    const { rows } = await pool.query(query, [userId]);
    return rows[0] || null;
};

const upsertCachedBadges = async (userId, badges) => {
    const query = `
        INSERT INTO user_badges (user_id, badges, last_synced_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            badges = EXCLUDED.badges,
            last_synced_at = CURRENT_TIMESTAMP
        RETURNING badges, last_synced_at;
    `;
    const { rows } = await pool.query(query, [userId, badges]);
    return rows[0];
};

module.exports = {
    getCachedBadges,
    upsertCachedBadges
};
