require('dotenv').config();
const { sequelize } = require('../src/database/models');

const fixPrompt = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB Connected');
        
        // Remove " (Updated)" from the end of SYSTEM_PROMPT
        const [results] = await sequelize.query(`
            UPDATE "Settings" 
            SET value = REPLACE(value, ' (Updated)', '')
            WHERE key = 'SYSTEM_PROMPT' AND company_id IS NULL;
        `);
        
        console.log('✅ System Prompt fixed.');

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
};

fixPrompt();
