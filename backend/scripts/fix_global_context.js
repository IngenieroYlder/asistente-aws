require('dotenv').config();
const { sequelize } = require('../src/database/models');

const fix = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB Connected');
        
        // List of tables to fix
        const tables = ['Contacts', 'Sessions', 'Messages', 'Summaries', 'Assets'];
        
        for (const table of tables) {
            try {
                // First check if column exists
                const [cols] = await sequelize.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = '${table}' AND column_name = 'company_id'
                `);
                
                if (cols.length > 0) {
                    await sequelize.query(`ALTER TABLE "${table}" ALTER COLUMN "company_id" DROP NOT NULL;`);
                    console.log(`✅ Altered ${table} successfully.`);
                } else {
                    console.log(`ℹ️ Column company_id not found in ${table}, skipping.`);
                }
            } catch (err) {
                console.warn(`⚠️ Could not alter ${table}:`, err.message);
            }
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        process.exit();
    }
};

fix();
