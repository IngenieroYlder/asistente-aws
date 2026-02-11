require('dotenv').config();
const db = require('../src/database/models');

const test = async () => {
    try {
        await db.sequelize.authenticate();
        console.log('✅ DB Connected');

        const companyId = null; // Simulating Superadmin
        const key = 'SYSTEM_PROMPT';

        console.log(`Checking for setting with company_id: ${companyId}, key: ${key}`);

        // Test FindAll
        const all = await db.Setting.findAll({ where: { company_id: companyId } });
        console.log(`Found ${all.length} settings for this company context.`);
        console.log(JSON.stringify(all, null, 2));

        // Test FindOne
        const setting = await db.Setting.findOne({ where: { company_id: companyId, key } });
        console.log('FindOne result:', setting ? 'Found' : 'Not Found');

        if (setting) {
            console.log('Existing value:', setting.value);
            // Try updating
            setting.value = setting.value + ' (Updated)';
            await setting.save();
            console.log('✅ Update successful');
        } else {
            // Try creating
            console.log('Creating new...');
            await db.Setting.create({
                company_id: companyId,
                key: key,
                value: 'Test Value'
            });
            console.log('✅ Create successful');
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        process.exit();
    }
};

test();
