# Guía técnica para Desarrolladores

Esta guía describe la arquitectura interna del sistema **UnifiedBot**, su stack tecnológico y las medidas de seguridad implementadas.

## Stack Tecnológico
- **Backend**: Node.js + Express.
- **ORM**: Sequelize (PostgreSQL).
- **Frontend**: React + Vite + TailwindCSS.
- **Bot Engine**: Telegraf (Telegram), Open AI API (Cerebro).

## Arquitectura Multi-Empresa (SaaS)
El sistema está diseñado para ser escalable horizontalmente. La clave es el campo `company_id` presente en casi todas las tablas:
- `Users`: Pertenecen a una empresa.
- `Contacts`: Aislados por empresa.
- `Sessions` y `Messages`: Vinculados a una empresa específica.

> [!IMPORTANT]
> **Aislamiento de Datos**: Cada consulta al backend utiliza obligatoriamente el `companyId` extraído del token JWT del usuario. Es imposible que un usuario de la "Empresa A" vea chats de la "Empresa B".

## Flujo de Mensajería
1. **Entrada**: `botManager.js` escucha eventos (Telegram/Instagram).
2. **Procesamiento**: Pasa el mensaje a `botLogic.js`.
3. **Inteligencia**: `botLogic` busca el contexto de la empresa, el historial y consulta a OpenAI.
4. **Salida**: Se envía la respuesta al usuario y se guarda en la base de datos.

## Seguridad y Protección de Datos
¿Cómo estamos de seguridad? Actualmente el sistema implementa:

### 1. Autenticación Robusta
- Uso de **JSON Web Tokens (JWT)** con tiempo de expiración (24h).
- Contraseñas hasheadas con **bcrypt** (nunca se guardan en texto plano).

### 2. Aislamiento de Base de Datos
- Todas las rutas protegidas usan un middleware de verificación que inyecta la identidad del usuario.
- Los controladores aplican filtros `where: { company_id: ... }` en cada operación de lectura/escritura.

### 3. Integridad de Media
- **Local Persistence**: A diferencia de otras plataformas que dependen de links temporales externos, nosotros descargamos el contenido multimedia al servidor privado (`uploads/`). Esto asegura que el historial sea íntegro y privado.

### 4. Seguridad en el VPS
- El backend corre bajo procesos aislados.
- Las variables de entorno críticas (API Keys, DB Secret) se manejan en un archivo `.env` no público.

## Próximos Pasos (Hoja de Ruta)
- Implementación de **Refresh Tokens** para mayor seguridad en sesiones largas.
- **Rate Limiting** para prevenir ataques de fuerza bruta en el login.
- **SSL/TLS**: Obligatorio en el despliegue final para encriptar todo el tráfico entre el navegador y el servidor.
