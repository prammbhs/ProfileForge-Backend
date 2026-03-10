require('dotenv').config();
const { pool } = require('./utils/postgreClient');
const crypto = require('crypto');

async function runTests() {
    try {
        console.log("Starting backend tests...");

        // 1. Create a dummy user
        const testSub = "test-sub-12345";
        await pool.query('DELETE FROM users WHERE cognito_sub = $1', [testSub]);
        const { rows: userRows } = await pool.query(`
            INSERT INTO users (cognito_sub, email, name)
            VALUES ($1, $2, $3)
            RETURNING id;
        `, [testSub, 'test@example.com', 'Test User']);

        const userId = userRows[0].id;
        console.log("Dummy user created with ID:", userId);

        // 2. Test Quota DB rules directly
        const { getQuotaByUserId, incrementApiUsage, adjustImageUsage, resetHourlyQuota } = require('./repositories/quotas.repository');

        let quota = await getQuotaByUserId(userId);
        console.log("Initial Quota:", quota);

        // 3. Increment API Usage
        quota = await incrementApiUsage(userId);
        if (quota.api_calls_count !== 1) throw new Error("API count did not increment");

        // 4. Adjust Image Usage
        quota = await adjustImageUsage(userId, 3);
        if (quota.total_images_uploaded !== 3) throw new Error("Image count did not increment to 3");

        // 5. Test API Keys DB rules
        const { createApiKey, getKeysByUserId, getApiKeyByHash } = require('./repositories/apiKeys.repository');

        const rawKey = crypto.randomBytes(32).toString('hex');
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        const newKey = await createApiKey(userId, keyHash, "Test Key");

        const keys = await getKeysByUserId(userId);
        if (keys.length !== 1) throw new Error("Key not created properly");

        const fetchedKey = await getApiKeyByHash(keyHash);
        if (fetchedKey.user_id !== userId) throw new Error("Key hash lookup failed");

        console.log("DB Rules passed.");

        // Clean up
        await pool.query('DELETE FROM users WHERE cognito_sub = $1', [testSub]);

        console.log("All manual validation tests passed!");
    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        pool.end();
        process.exit(0);
    }
}

runTests();
