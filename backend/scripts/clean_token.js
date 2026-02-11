require('dotenv').config();
const { sequelize } = require('../src/database/models');

const cleanToken = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB Connected');
        
        // Hardcoded fix for the user's specific mistake
        // Extract the token part from the long string "Done! ... Use this token to access the HTTP API: 7859466134:AAEr4nTL2GU7jN7m9uhU5dtSowaaqgiPY1I Keep your token..."
        // The token format is 123456:ABC...
        
        const [results] = await sequelize.query(`
            UPDATE "Settings" 
            SET value = '7859466134:AAEr4nTL2GU7jN7m9uhU5dtSowaaqgiPY1I'
            WHERE key = 'TELEGRAM_BOT_TOKEN' AND company_id IS NULL;
        `);
        
        console.log('✅ Token cleaned in DB.');

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
};

cleanToken();
