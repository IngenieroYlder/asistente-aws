require('dotenv').config();
const db = require('../src/database/models');

const fixSettings = async () => {
    try {
        await db.sequelize.authenticate();
        console.log('✅ DB Connected');
        
        // Force DROP NOT NULL
        // Note: Sequelize defaults to pluralized table names usually: 'Settings'
        await db.sequelize.query('ALTER TABLE "Settings" ALTER COLUMN "company_id" DROP NOT NULL;');
        console.log('✅ Altered Settings table successfully.');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        process.exit();
    }
};

fixSettings();
