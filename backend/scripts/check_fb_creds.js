const { Setting, sequelize } = require('../src/database/models');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkCreds() {
    try {
        await sequelize.authenticate();
        console.log("✅ DB Connected");
        const fbToken = await Setting.findOne({ where: { key: 'FACEBOOK_ACCESS_TOKEN', company_id: null } });
        const fbPageId = await Setting.findOne({ where: { key: 'FACEBOOK_PAGE_ID', company_id: null } });
        const openAiKey = await Setting.findOne({ where: { key: 'OPENAI_API_KEY', company_id: null } });

        console.log("FACEBOOK_ACCESS_TOKEN:", fbToken ? (fbToken.value.substring(0, 10) + '...') : 'MISSING ❌');
        console.log("FACEBOOK_PAGE_ID:", fbPageId ? fbPageId.value : 'MISSING ❌');
        console.log("OPENAI_API_KEY:", openAiKey ? 'PRESENT ✅' : 'MISSING ❌');

    } catch (error) {
        console.error("Error:", error);
    }
}

checkCreds();
