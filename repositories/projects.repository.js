const { pool } = require("../utils/postgreClient");

const addProject = async (userId, data) => {
    const { name, description, live_link, github_link, techstack_used, image_links } = data;
    const query = `
        INSERT INTO projects (user_id, name, description, live_link, github_link, techstack_used, image_links)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
    `;
    const values = [
        userId,
        name,
        description || null,
        live_link || null,
        github_link || null,
        techstack_used || [],
        image_links || []
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
};

const getProjectsByUserId = async (userId) => {
    const query = `
        SELECT * FROM projects
        WHERE user_id = $1
        ORDER BY created_at DESC;
    `;
    const { rows } = await pool.query(query, [userId]);
    return rows;
};

const getProjectById = async (id, userId) => {
    const query = `
        SELECT * FROM projects
        WHERE id = $1 AND user_id = $2;
    `;
    const { rows } = await pool.query(query, [id, userId]);
    return rows[0];
};

const updateProject = async (id, userId, data) => {
    const { name, description, live_link, github_link, techstack_used, image_links } = data;
    const query = `
        UPDATE projects
        SET 
            name = COALESCE($3, name),
            description = COALESCE($4, description),
            live_link = COALESCE($5, live_link),
            github_link = COALESCE($6, github_link),
            techstack_used = COALESCE($7, techstack_used),
            image_links = COALESCE($8, image_links),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2
        RETURNING *;
    `;
    const values = [
        id,
        userId,
        name || null,
        description || null,
        live_link || null,
        github_link || null,
        techstack_used || null,
        image_links || null
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
};

const deleteProject = async (id, userId) => {
    const query = `
        DELETE FROM projects
        WHERE id = $1 AND user_id = $2
        RETURNING *;
    `;
    const { rows } = await pool.query(query, [id, userId]);
    return rows[0];
};

module.exports = {
    addProject,
    getProjectsByUserId,
    getProjectById,
    updateProject,
    deleteProject
};
