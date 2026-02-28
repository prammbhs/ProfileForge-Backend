const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const sslConfig = process.env.DB_CERT
    ? {
        rejectUnauthorized: true,
        ca: fs.readFileSync(path.resolve(process.env.DB_CERT)).toString(),
    }
    : false;

const pool = new Pool({
    port: parseInt(process.env.DB_PORT) || 5432,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: sslConfig,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

const connectDB = async () => {
    try {
        const client = await pool.connect();
        const res = await client.query("SELECT version()");
        console.log("✅ PostgreSQL connected:", res.rows[0].version);
        client.release();
    } catch (error) {
        console.error("❌ PostgreSQL connection failed:", error.message);
        process.exit(1);
    }
};

module.exports = { pool, connectDB };