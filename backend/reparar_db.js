require('dotenv').config();
const db = require('./src/database/models');

async function fix() {
    try {
        console.log("--- INICIANDO REPARACIÓN DE BASE DE DATOS ---");
        await db.sequelize.authenticate();
        console.log("✅ Conexión establecida.");

        console.log("⚠️ Borrando tabla 'active_sessions' para corregir error de UUID...");
        await db.sequelize.query('DROP TABLE IF EXISTS "active_sessions" CASCADE;');
        console.log("✅ Tabla borrada con éxito.");

        console.log("\n🚀 Ahora puedes iniciar el servidor con 'npm start'.");
        process.exit(0);
    } catch (e) {
        console.error("❌ ERROR DURANTE LA REPARACIÓN:");
        console.error(e);
        process.exit(1);
    }
}

fix();
