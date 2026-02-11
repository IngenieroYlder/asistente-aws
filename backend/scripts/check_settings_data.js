require('dotenv').config();
const { sequelize } = require('../src/database/models');

const check = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB Connected');
        
        const [results] = await sequelize.query(`SELECT * FROM "Settings"`);
        console.log('--- Current Settings in DB ---');
        console.log(JSON.stringify(results, null, 2));
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
};

check();
