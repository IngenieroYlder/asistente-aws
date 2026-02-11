const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Setting } = require('../src/database/models');
const { Op } = require('sequelize');
const db = require('../src/database/models');

async function findText() {
    try {
        await db.sequelize.authenticate();
        console.log('✅ DB Connected');
        
        const textToFind = "Ingeniero YLDER";
        
        const settings = await Setting.findAll({
            where: {
                value: { [Op.like]: `%${textToFind}%` }
            }
        });

        console.log('--- FOUND SETTINGS ---');
        if (settings.length > 0) {
            settings.forEach(s => {
                console.log(`Key: ${s.key}, CompanyID: ${s.company_id}`);
                console.log(`Value: ${s.value}`);
                console.log('-------------------');
            });
        } else {
            console.log('Text not found in Settings table.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

findText();
