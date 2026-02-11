const path = require('path');
// Load env vars first!
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { sequelize } = require('../src/database/models');
const fs = require('fs');

async function backup() {
    try {
        console.log('Environment:', process.env.NODE_ENV || 'development');
        console.log('DB User:', process.env.DB_USER || 'Not Set');

        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, '../backups', `backup_${timestamp}`);
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const models = Object.keys(sequelize.models);
        console.log(`📦 Backing up ${models.length} tables to ${backupDir}...`);

        for (const modelName of models) {
            if (modelName === 'SequelizeMeta') continue;
            
            const data = await sequelize.models[modelName].findAll();
            const filePath = path.join(backupDir, `${modelName}.json`);
            
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`  - ${modelName}: ${data.length} records`);
        }

        console.log(`✅ Backup completed successfully at ${backupDir}!`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Backup failed:', error);
        process.exit(1);
    }
}

backup();
