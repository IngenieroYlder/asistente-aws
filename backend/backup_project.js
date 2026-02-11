const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver'); // unlikely to be installed, better to use system tools or simple copy? 
// actually, let's use powershell for zipping to avoid dependencies.

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(__dirname, '..', 'backups');
const zipName = `backup_full_${timestamp}.zip`;
const zipPath = path.join(backupDir, zipName);

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
}

console.log(`📦 Starting backup to: ${zipPath}`);

try {
    // 1. Dump Database
    console.log('💾 Dumping Database...');
    const dbDumpPath = path.join(backupDir, `db_${timestamp}.sql`);
    // Assumes DB settings in .env
    require('dotenv').config();
    const { DB_USER, DB_NAME, DB_PASS } = process.env;
    
    // We need pg_dump. Using env var for password.
    const PGPASSWORD = DB_PASS;
    const dumpCmd = `set "PGPASSWORD=${DB_PASS}" && pg_dump -U ${DB_USER} -h localhost -d ${DB_NAME} -f "${dbDumpPath}" -F p`;
    
    try {
        execSync(dumpCmd, { stdio: 'inherit', shell: true });
        console.log('✅ Database dump successful.');
    } catch (e) {
        console.warn('⚠️ Database dump failed (is pg_dump in PATH?). Proceeding with file backup only.');
    }

    // 2. PowerShell Zip (excluding node_modules)
    console.log('🗄️ Zipping files (this may take a while)...');
    
    // Construct powershell command to zip folders but exclude node_modules
    // It's tricky to exclude deeply with Compress-Archive.
    // simpler strategy: verify if '7z' is available or just zip the src folders directly.
    
    const sourceBackend = path.join(__dirname, 'src');
    const sourceFrontend = path.join(__dirname, '..', 'frontend', 'src');
    const sourceDocs = path.join(__dirname, '..', 'documentation');
    const sourceConfigs = path.join(__dirname, '..', 'frontend', '*.json'); // pseudo
    
    // Changing strategy: using tar if available (git bash usually has it) or just powershell compressing specific folders
    const psCommand = `powershell -Command "Compress-Archive -Path 'src', 'package.json', '.env', '../frontend/src', '../frontend/package.json' -DestinationPath '${zipPath}' -Force"`;
    
    execSync(psCommand, { stdio: 'inherit', cwd: __dirname });
    
    console.log(`✅ Backup created successfully at: ${zipPath}`);

} catch (error) {
    console.error('❌ Backup failed:', error);
}
