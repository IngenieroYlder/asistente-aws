const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Fix: Point to root .env
const db = require('../src/database/models');

const check = async () => {
    try {
        await db.sequelize.authenticate();
        console.log('✅ DB Connected');
        
        // Sync Schema
        console.log('🔄 Syncing Schema (Alter)...');
        await db.sequelize.sync({ alter: true });
        console.log('✅ Schema Synced');

        // Query information_schema
        const [results] = await db.sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Tables:', results.map(r => r.table_name));
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
};

check();
