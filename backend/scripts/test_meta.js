const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Setting } = require('../src/database/models');
const { Op } = require('sequelize');
const db = require('../src/database/models');

async function testMetaAuth() {
    try {
        await db.sequelize.authenticate();
        console.log('✅ DB Connected');
        
        // Fetch Token
        const setting = await Setting.findOne({
            where: { key: 'META_ACCESS_TOKEN' }
        });

        if (!setting || !setting.value) {
            console.error('❌ META_ACCESS_TOKEN not found in DB.');
            return;
        }

        const token = setting.value;
        console.log(`🔑 Testing Token: ${token.substring(0, 15)}...`);

        // 1. Verify Token & Get Page Info
        console.log('\n--- GRAPH API: GET /me ---');
        try {
            const res = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${token}`);
            console.log('✅ Success!');
            console.log('Page Name:', res.data.name);
            console.log('Page ID:', res.data.id);
        } catch (e) {
            console.error('❌ Token Verification Failed:', e.response ? e.response.data : e.message);
            return;
        }

        // 2. Check Permissions / Subscribed Apps
        // This confirms if the app is subscribed to the page's webhooks
        console.log('\n--- GRAPH API: GET /me/subscribed_apps ---');
        try {
             const res = await axios.get(`https://graph.facebook.com/v19.0/me/subscribed_apps?access_token=${token}`);
             console.log('✅ Subscription Status:', res.data.data && res.data.data.length > 0 ? 'Active' : 'Inactive (Empty List)');
             if (res.data.data) console.log(JSON.stringify(res.data.data, null, 2));
        } catch (e) {
            // It might fail if permissions are missing
            console.error('⚠️ Could not check subscriptions:', e.response ? e.response.data : e.message);
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

testMetaAuth();
