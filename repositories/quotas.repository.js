const { pool } = require("../utils/postgreClient");

const getQuotaByUserId = async (userId) => {
    const query = `
        SELECT total_images_uploaded, max_image_limit, api_calls_count, api_calls_limit, quota_reset_at
        FROM user_quotas
        WHERE user_id = $1;
    `;
    const { rows } = await pool.query(query, [userId]);
    if (rows.length === 0) {
        const createQuery = `
            INSERT INTO user_quotas (user_id)
            VALUES ($1)
            RETURNING total_images_uploaded, max_image_limit, api_calls_count, api_calls_limit, quota_reset_at;
        `;
        const { rows: newRows } = await pool.query(createQuery, [userId]);
        return newRows[0];
    }
    return rows[0];
};

const resetHourlyQuota = async (userId) => {
    const query = `
        UPDATE user_quotas
        SET api_calls_count = 0,
            quota_reset_at = CURRENT_TIMESTAMP + INTERVAL '1 hour'
        WHERE user_id = $1 AND CURRENT_TIMESTAMP > quota_reset_at
        RETURNING total_images_uploaded, max_image_limit, api_calls_count, api_calls_limit, quota_reset_at;
    `;
    const { rows } = await pool.query(query, [userId]);
    return rows[0];
};

const incrementApiUsage = async (userId) => {
    const query = `
        UPDATE user_quotas
        SET api_calls_count = api_calls_count + 1
        WHERE user_id = $1
        RETURNING total_images_uploaded, max_image_limit, api_calls_count, api_calls_limit, quota_reset_at;
    `;
    const { rows } = await pool.query(query, [userId]);
    return rows[0];
};

const adjustImageUsage = async (userId, amount) => {
    const query = `
        UPDATE user_quotas
        SET total_images_uploaded = GREATEST(0, total_images_uploaded + $2)
        WHERE user_id = $1
        RETURNING total_images_uploaded, max_image_limit;
    `;
    const { rows } = await pool.query(query, [userId, amount]);
    return rows[0];
};

module.exports = {
    getQuotaByUserId,
    resetHourlyQuota,
    incrementApiUsage,
    adjustImageUsage
};
