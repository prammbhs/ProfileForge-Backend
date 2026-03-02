const { pool } = require("../utils/postgreClient");

const addExternalProfile = async (userId, platform, username, profileUrl, platformData) => {
    const insertQuery = `
        INSERT INTO external_profiles (user_id,platform,username,profile_url,platform_data,last_sync_at)
        VALUES ($1, $2,$3,$4,$5,$6)
        RETURNING *;
    `;
    const values = [userId, platform, username, profileUrl, platformData, new Date()];
    const { rows } = await pool.query(insertQuery, values);
    return rows[0];
};

const getExternalProfile = async (userId, platform) => {
    const selectQuery = `
        SELECT * FROM external_profiles WHERE user_id = $1 AND platform = $2;
    `;
    const values = [userId, platform];
    const { rows } = await pool.query(selectQuery, values);
    return rows[0];
};
const updateProfileData = async (userId, platform, platformData) => {
    const updateQuery = `
        UPDATE external_profiles SET platform_data = $1, last_sync_at = $2 WHERE user_id = $3 AND platform = $4;
    `;
    const values = [platformData, new Date(), userId, platform];
    const { rows } = await pool.query(updateQuery, values);
    return rows[0];
};

module.exports = {
    addExternalProfile,
    getExternalProfile,
    updateProfileData
};