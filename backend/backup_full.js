const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
// Save backup in a directory outside the project if possible, or in a 'backups' folder ignored by git
const backupDir = path.join(__dirname, '..', '..', 'Backups_UnifiedBot'); 
const zipName = `UnifiedBot_Backup_${timestamp}.zip`;
const zipPath = path.join(backupDir, zipName);

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

console.log(`📦 Iniciando respaldo en: ${zipPath}`);

try {
    // 1. Dump Database
    // Try to find pg_dump
    require('dotenv').config({ path: path.join(__dirname, '.env') });
    const { DB_USER, DB_NAME, DB_PASS, DB_HOST } = process.env;
    
    if (DB_USER && DB_NAME) {
        console.log('💾 Exportando Base de Datos...');
        const dbDumpPath = path.join(backupDir, `db_${timestamp}.sql`);
        // Password setup for Windows
        const dumpCmd = `set "PGPASSWORD=${DB_PASS}" && pg_dump -U ${DB_USER} -h ${DB_HOST || 'localhost'} -d ${DB_NAME} -f "${dbDumpPath}" -F p`;
        
        try {
            execSync(dumpCmd, { stdio: 'inherit', shell: true });
            console.log('✅ Base de datos exportada.');
        } catch (e) {
            console.warn('⚠️ No se pudo exportar la BD (¿pg_dump instalado?). Continuando con archivos...');
        }
    }

    // 2. PowerShell Zip
    console.log('🗄️ Comprimiendo archivos (esto tomará unos segundos)...');
    
    // We want to zip 'UnifiedBot/backend' and 'UnifiedBot/frontend' but EXCLUDE node_modules.
    // PowerShell's Compress-Archive is simple but hard to exclude complex patterns.
    // Strategy: Copy allowed files to a temp folder, then zip that.
    
    const tempDir = path.join(backupDir, `temp_${timestamp}`);
    fs.mkdirSync(tempDir);
    
    console.log('   - Copiando archivos fuente...');
    // Robocopy is standard on Windows and fast for mirroring with exclusions
    // Mirror backend
    try {
        execSync(`robocopy "d:\\Colombia Picture\\AWS Asistente\\UnifiedBot" "${tempDir}" /E /XD node_modules .git .gemini /XF *.log`, { stdio: 'ignore', shell: true }); 
    } catch (e) { 
        // Robocopy returns exit codes < 8 for success (1=files copied)
        if (e.status > 7) console.error("Error copiando archivos", e);
    }
    
    console.log('   - Creando ZIP...');
    execSync(`powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit', shell: true });
    
    // Clean temp
    console.log('   - Limpiando temporales...');
    execSync(`rmdir /s /q "${tempDir}"`, { shell: true });
    
    console.log(`✅ ¡Respaldo COMPLETADO! Archivo: ${zipPath}`);

} catch (error) {
    console.error('❌ Error general en respaldo:', error);
}
