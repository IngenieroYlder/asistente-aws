const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Setting, Company } = require('../src/database/models');
const { Op } = require('sequelize');
const db = require('../src/database/models');

async function checkApis() {
    try {
        await db.sequelize.authenticate();
        console.log('✅ DB Connected');
        
        const apiKeys = [
            'OPENAI_API_KEY', 
            'TELEGRAM_BOT_TOKEN', 
            'META_ACCESS_TOKEN', 
            'FACEBOOK_PAGE_ID',
            'INSTAGRAM_PAGE_ID'
        ];
        
        // Simpler query without include to avoid alias issues if not sure
        const settings = await Setting.findAll({
            where: {
                key: { [Op.in]: apiKeys }
            }
        });

        // Fetch company names separately if needed
        const companyIds = [...new Set(settings.map(s => s.company_id).filter(id => id))];
        const companies = await Company.findAll({
            where: { id: { [Op.in]: companyIds } }
        });
        const companyMap = companies.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});

        console.log('\n--- ACTIVE API CONNECTIONS ---');
        if (settings.length > 0) {
            settings.forEach(s => {
                const cName = s.company_id ? (companyMap[s.company_id] || `ID ${s.company_id}`) : 'Global/System';
                const maskedValue = s.value ? `${s.value.substring(0, 10)}...` : '(empty)';
                console.log(`📌 Key: ${s.key}`);
                console.log(`   Context: ${cName}`);
                console.log(`   Value: ${maskedValue}`);
                console.log('-------------------');
            });
        } else {
            console.log('❌ No API Keys found in Settings table.');
        }

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        process.exit();
    }
}

checkApis();
