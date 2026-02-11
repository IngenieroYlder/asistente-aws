const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/database/models');

async function test() {
    try {
        console.log('--- DB Check ---');
        await db.sequelize.authenticate();
        console.log('✅ DB Connected');
        
        // Check Plans table exists and count
        const plans = await db.Plan.findAll();
        console.log('Plans in DB:', plans.length);

        console.log('--- API Check ---');
        // We expect 403/401 because we are not authenticated, but that proves the route exists.
        // If 404, route is missing.
        try {
            await axios.get('http://localhost:3000/api/plans');
        } catch (e) {
            console.log('GET /plans status:', e.response ? e.response.status : e.message);
            if (e.response && e.response.status === 404) {
                console.error('CRITICAL: /api/plans returned 404. Route not registered.');
            } else {
                console.log('Route reachable (Authentication guard active).');
            }
        }

    } catch (e) {
        console.error('Test Failed:', e.message);
    } finally {
        process.exit();
    }
}

test();
