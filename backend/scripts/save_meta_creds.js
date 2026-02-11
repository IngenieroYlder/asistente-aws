const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Setting } = require('../src/database/models');
const db = require('../src/database/models');

async function saveCreds() {
    try {
        await db.sequelize.authenticate();
        console.log('✅ DB Connected');

        const creds = [
            { key: 'META_ACCESS_TOKEN', value: 'EAAWteIKNFh0BQvyQRMMcJhE7OpS3qR2tbZB4dhSp0DSKVY2iHQh4VuTAAQ7nZBHKvpbZAQ4qZB1xiIV0pZBHkIStwYNu9RM5foAZA6ZClStGNDvFB9IofwAaF2hXekpvq9X4ZCOr7dKQQMDqiIM9MfQ1Ug7YVeEQsOHfNx2SyuGPcUZAT03cv0ZCfOI9Sk3ooJMWSNGJ6VWmEwXvKuYHbfpgZBfDria4B4y7L4bwToD394kyWid5eCZCimqj6H8UrVh7ec0UpQJoJdnvCtZCPtOFjVZCDnBiHAxZBNYte2TpZA11TgZDZD' },
            { key: 'FACEBOOK_PAGE_ID', value: '100430343942798' },
            { key: 'META_APP_SECRET', value: '0a0fdc77dd475acba69c26e8846a7317' } // Optional but good to have
        ];

        for (const cred of creds) {
            const [setting, created] = await Setting.findOrCreate({
                where: { key: cred.key, company_id: null }, // Global
                defaults: { value: cred.value }
            });

            if (!created) {
                setting.value = cred.value;
                await setting.save();
                console.log(`Updated ${cred.key}`);
            } else {
                console.log(`Created ${cred.key}`);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

saveCreds();
