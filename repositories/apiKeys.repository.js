const { pool } = require("../utils/postgreClient");

const createApiKey = async (userId, keyHash, name = "Default Key") => {
    const query = `
        INSERT INTO api_keys (user_id, key_hash, name)
        VALUES ($1, $2, $3)
        RETURNING id, name, created_at, last_used_at;
    `;
    const { rows } = await pool.query(query, [userId, keyHash, name]);
    return rows[0];
};

const getKeysByUserId = async (userId) => {
    const query = `
        SELECT id, name, created_at, last_used_at
        FROM api_keys
        WHERE user_id = $1
        ORDER BY created_at DESC;
    `;
    const { rows } = await pool.query(query, [userId]);
    return rows;
};

const getApiKeyByHash = async (keyHash) => {
    const query = `
        SELECT ak.id, ak.user_id, ak.name, u.email
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.key_hash = $1;
    `;
    const { rows } = await pool.query(query, [keyHash]);
    return rows[0];
};

const revokeApiKey = async (keyId, userId) => {
    const query = `
        DELETE FROM api_keys
        WHERE id = $1 AND user_id = $2
        RETURNING id;
    `;
    const { rows } = await pool.query(query, [keyId, userId]);
    return rows[0];
};

const updateLastUsed = async (keyId) => {
    const query = `
        UPDATE api_keys
        SET last_used_at = CURRENT_TIMESTAMP
        WHERE id = $1;
    `;
    await pool.query(query, [keyId]);
};

module.exports = {
    createApiKey,
    getKeysByUserId,
    getApiKeyByHash,
    revokeApiKey,
    updateLastUsed
};
