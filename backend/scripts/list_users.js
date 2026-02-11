const db = require('../src/database/models');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const listUsers = async () => {
    try {
        await db.sequelize.authenticate();
        const users = await db.User.findAll();
        console.log("Registered Users:");
        users.forEach(u => console.log(`- ID: ${u.id}, User: '${u.username}', Role: ${u.role}, Company: ${u.company_id}`));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
};

listUsers();
