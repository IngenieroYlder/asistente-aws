const db = require('./src/database/models');

async function fix() {
    try {
        console.log("Dropping active_sessions table...");
        await db.sequelize.query('DROP TABLE IF EXISTS active_sessions CASCADE;');
        console.log("Table dropped successfully.");
        process.exit(0);
    } catch (e) {
        console.error("Error dropping table:", e);
        process.exit(1);
    }
}

fix();
