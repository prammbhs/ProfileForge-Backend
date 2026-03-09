const { pool } = require("../utils/postgreClient");
const crypto = require("crypto");

const addCertificate = async (userId, data) => {
    const { title, issuer, issue_date, credential_url, file_url, details } = data;

    const id = crypto.randomUUID();

    const insertQuery = `
        INSERT INTO certificates (id, user_id, title, issuer, issue_date, credential_url, file_url, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
    `;
    const values = [
        id,
        userId,
        title,
        issuer || null,
        issue_date || null,
        credential_url || null,
        file_url || null,
        details ? JSON.stringify(details) : null
    ];

    const { rows } = await pool.query(insertQuery, values);
    return rows[0];
};

const getUserCertificates = async (userId) => {
    const selectQuery = `
        SELECT * FROM certificates WHERE user_id = $1 ORDER BY issue_date DESC;
    `;
    const values = [userId];
    const { rows } = await pool.query(selectQuery, values);
    return rows;
};

const deleteCertificate = async (id, userId) => {
    const deleteQuery = `
        DELETE FROM certificates WHERE id = $1 AND user_id = $2 RETURNING *;
    `;
    const values = [id, userId];
    const { rows } = await pool.query(deleteQuery, values);
    return rows[0];
};

const updateCertificate = async (id, userId, data) => {
    const { title, issuer, issue_date, credential_url, file_url, details } = data;

    const updateQuery = `
        UPDATE certificates 
        SET 
            title = COALESCE($3, title),
            issuer = COALESCE($4, issuer),
            issue_date = COALESCE($5, issue_date),
            credential_url = COALESCE($6, credential_url),
            file_url = COALESCE($7, file_url),
            details = COALESCE($8, details)
        WHERE id = $1 AND user_id = $2
        RETURNING *;
    `;
    const values = [
        id,
        userId,
        title || null,
        issuer || null,
        issue_date || null,
        credential_url || null,
        file_url || null,
        details ? JSON.stringify(details) : null
    ];

    const { rows } = await pool.query(updateQuery, values);
    return rows[0];
};

module.exports = {
    addCertificate,
    getUserCertificates,
    deleteCertificate,
    updateCertificate
};
