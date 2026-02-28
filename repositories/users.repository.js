const { pool } = require("../utils/postgreClient");

const createUser = async ({ cognito_sub, email, name, profile_image_url }) => {
    const insertQuery = `
        INSERT INTO users (cognito_sub, email, name, profile_image_url)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    `;
    const values = [cognito_sub, email, name, profile_image_url];

    const { rows } = await pool.query(insertQuery, values);
    return rows[0];
};


const getUserByCognitoSub = async (cognito_sub) => {
    const selectQuery = `
        SELECT id, cognito_sub, email, name, profile_image_url, created_at
        FROM users
        WHERE cognito_sub = $1;
    `;
    const values = [cognito_sub];

    const { rows } = await pool.query(selectQuery, values);
    return rows[0] || null;
};

const updateProfileImage = async (id, profile_image_url) => {
    const updateQuery = `
        UPDATE users
        SET profile_image_url = $1
        WHERE id = $2
        RETURNING *;
    `;
    const values = [profile_image_url, id];

    const { rows } = await pool.query(updateQuery, values);
    return rows[0] || null;
};

const updateName = async (id, name) => {
    const updateQuery = `
        UPDATE users
        SET name = $1
        WHERE id = $2
        RETURNING *;
    `;
    const values = [name, id];

    const { rows } = await pool.query(updateQuery, values);
    return rows[0] || null;
};
const deleteUser = async (id) => {
    const deleteQuery = `
        DELETE FROM users
        WHERE id = $1
        RETURNING *;
    `;
    const values = [id];

    const { rows } = await pool.query(deleteQuery, values);
    return rows[0] || null;
};
module.exports = {
    createUser,
    getUserByCognitoSub,
    updateProfileImage,
    updateName,
    deleteUser
};
