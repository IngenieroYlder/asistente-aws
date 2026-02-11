const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const createDb = async () => {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        password: process.env.DB_PASS,
        port: process.env.DB_PORT,
        database: 'postgres' // Connect to default DB first
    });

    try {
        await client.connect();
        console.log("🔌 Connected to 'postgres' database.");
        
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = 'unified_bot_db'`);
        if (res.rowCount === 0) {
            console.log("🛠 Database 'unified_bot_db' not found. Creating...");
            await client.query(`CREATE DATABASE unified_bot_db`);
            console.log("✅ Database 'unified_bot_db' created successfully.");
        } else {
            console.log("✅ Database 'unified_bot_db' already exists.");
        }
    } catch (err) {
        console.error("❌ Error creating database:", err.message);
    } finally {
        await client.end();
    }
};

createDb();
