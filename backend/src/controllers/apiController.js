const db = require('../database/models');
const { Op } = require('sequelize');

// Helper to filter by company (handle null for superadmin)
const getCompanyId = (req) => req.companyId || null;

exports.getStats = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const usersCount = await db.Contact.count({ where: { company_id: companyId } });
        const activeSessions = await db.Session.count({ where: { company_id: companyId, is_active: true } });
        const msgsCount = await db.Message.count({ where: { company_id: companyId } });
        
        res.json({ usersCount, activeSessions, msgsCount });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getContacts = async (req, res) => {
    try {
        const contacts = await db.Contact.findAll({ 
            where: { company_id: getCompanyId(req) },
            order: [['last_interaction', 'DESC']], 
            limit: 50 
        });
        res.json(contacts);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getSessions = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        
        // If SuperAdmin (companyId is null), show ALL sessions. 
        // If specific company user, show only their sessions.
        const whereClause = { is_active: true };
        if (companyId) {
            whereClause.company_id = companyId;
        }

        const sessions = await db.Session.findAll({
            where: whereClause,
            include: [{ model: db.Contact }],
            order: [
                ['is_pinned', 'DESC'],
                ['updatedAt', 'DESC']
            ]
        });
        res.json(sessions);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.togglePin = async (req, res) => {
    try {
        const { id } = req.params;
        const session = await db.Session.findOne({ where: { id, company_id: getCompanyId(req) } });
        if (!session) return res.status(404).json({ message: "Sesión no encontrada" });

        session.is_pinned = !session.is_pinned;
        await session.save();
        res.json({ success: true, is_pinned: session.is_pinned });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getMessages = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const messages = await db.Message.findAll({
            where: { session_id: sessionId, company_id: getCompanyId(req) }, // Security check
            order: [['timestamp', 'ASC']]
        });
        res.json(messages);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getAssets = async (req, res) => {
    try {
        const { folderId, isKnowledge } = req.query;
        const where = { company_id: getCompanyId(req) };
        if (folderId) where.folder_id = folderId;
        if (isKnowledge !== undefined) where.is_knowledge = isKnowledge === 'true';
        
        const assets = await db.Asset.findAll({ where, order: [['createdAt', 'DESC']] });
        res.json(assets);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const asset = await db.Asset.findOne({ where: { id, company_id: getCompanyId(req) } });
        if (!asset) return res.status(404).json({ message: "Archivo no encontrado" });

        // Remove file from disk
        const filePath = path.join(__dirname, '../../', asset.url);
        const fs = require('fs');
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await asset.destroy();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
 
exports.updateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const companyId = getCompanyId(req);
 
        const asset = await db.Asset.findOne({ where: { id, company_id: companyId } });
        if (!asset) return res.status(404).json({ message: "Archivo no encontrado" });
 
        if (name) asset.name = name;
        await asset.save();
 
        res.json({ success: true, asset });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
 
const path = require('path');

exports.uploadAsset = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).send('No files uploaded.');
        
        const { folderId, names, isKnowledge } = req.body; // names can be an array if provided manually, or handle default
        const folder_id = folderId === 'null' || !folderId ? null : folderId;
        const is_knowledge = isKnowledge === 'true';
        
        const createdAssets = [];
        const fs = require('fs');
        const pdfLib = require('pdf-parse');
        // Handle pdf-parse export variation (function vs object)
        const pdf = typeof pdfLib === 'function' ? pdfLib : (pdfLib.default || pdfLib.PDFParse || pdfLib);

        const sharp = require('sharp');

        for (const file of req.files) {
            let extractedText = null;
            const fullPath = path.join(__dirname, '../../', `uploads/${file.filename}`);
            const companyId = getCompanyId(req);
            const assetName = file.filename.split('.')[0];

            // Deduplication: Check if asset with same name/company already exists
            const existingAsset = await db.Asset.findOne({ where: { company_id: companyId, name: assetName } });
            if (existingAsset) {
                // If it exists, we can either skip or return existing. 
                // User wants to avoid double storage.
                createdAssets.push(existingAsset);
                // Optionally remove the newly uploaded file? Yes, to save space.
                if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                continue;
            }

            // Image Optimization
            if (file.mimetype.startsWith('image/')) {
                try {
                    const tempPath = fullPath + '_tmp';
                    await sharp(fullPath)
                        .resize({ width: 1200, withoutEnlargement: true })
                        .jpeg({ quality: 80 })
                        .toFile(tempPath);
                    
                    fs.unlinkSync(fullPath);
                    fs.renameSync(tempPath, fullPath);
                    console.log(`[Optimization] Compressed ${file.filename}`);
                } catch (err) {
                    console.error(`[Optimization Error] Failed to compress ${file.filename}:`, err.message);
                }
            }

            try {
                if (file.mimetype === 'text/plain') {
                    extractedText = fs.readFileSync(fullPath, 'utf8');
                    console.log(`[Extraction] TXT extracted ${extractedText.length} chars from ${file.filename}`);
                } else if (file.mimetype === 'application/pdf') {
                    const dataBuffer = fs.readFileSync(fullPath);
                    console.log(`[Extraction] Processing PDF ${file.filename} (${dataBuffer.length} bytes)`);
                    const data = await pdf(dataBuffer);
                    if (data.text && data.text.trim().length > 0) {
                        extractedText = data.text;
                        console.log(`[Extraction] PDF extracted ${extractedText.length} chars from ${file.filename}`);
                    } else {
                        extractedText = '[PDF sin texto extraíble - Puede ser imagen escaneada]';
                        console.warn(`[Extraction] PDF ${file.filename} has no extractable text (possibly scanned image)`);
                    }
                }
            } catch (err) {
                console.error(`[Extraction Error] Failed to read ${file.filename}:`, err.message);
                extractedText = `[Error al extraer texto: ${err.message}]`;
            }

            const asset = await db.Asset.create({
                company_id: companyId,
                folder_id: folder_id,
                name: assetName,
                filename: file.filename,
                mimetype: file.mimetype,
                url: `uploads/${file.filename}`,
                extracted_text: extractedText,
                is_knowledge: is_knowledge
            });
            createdAssets.push(asset);
        }
        
        res.json(createdAssets);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// --- Folder Management ---

exports.getFolders = async (req, res) => {
    try {
        const folders = await db.Folder.findAll({ where: { company_id: getCompanyId(req) } });
        res.json(folders);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createFolder = async (req, res) => {
    try {
        const { name } = req.body;
        const folder = await db.Folder.create({
            company_id: getCompanyId(req),
            name
        });
        res.json(folder);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteFolder = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if folder has assets
        const assetsCount = await db.Asset.count({ where: { folder_id: id } });
        if (assetsCount > 0) return res.status(400).json({ message: "No se puede eliminar una carpeta con archivos." });

        await db.Folder.destroy({ where: { id, company_id: getCompanyId(req) } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getSettings = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const settings = await db.Setting.findAll({ where: { company_id: companyId } });
        res.json(settings);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateSetting = async (req, res) => {
    const { key, value } = req.body;
    const companyId = getCompanyId(req);
    
    console.log(`[Settings] Updating ${key} for Company: ${companyId}`);

    try {
        let setting = await db.Setting.findOne({ where: { company_id: companyId, key } });
        
        if (setting) {
            console.log(`[Settings] Found existing. Updating...`);
            setting.value = value;
            await setting.save();
        } else {
            console.log(`[Settings] Creating new...`);
            await db.Setting.create({ company_id: companyId, key, value });
        }
        
        // If critical keys changed (like Telegram Token), we might need to restart the bot
        if (key === 'TELEGRAM_BOT_TOKEN') {
             // We can emit an event or call botManager directly if available globally
             // We can emit an event or call botManager directly if available globally
             // For now, let's assume specific restart endpoint or auto-reload
             const boManager = require('../services/botManager'); // careful with circular deps, better to have a singleton
             if (companyId) {
                 await boManager.startCompanyBot(companyId);
             } else {
                 await boManager.startGlobalBot();
             }
        }

        res.json({ success: true });
    } catch (e) { 
        console.error('[Settings] Error saving:', e);
        res.status(500).json({ error: e.message, stack: e.stack }); 
    }
};

// --- Backups & Data Management ---

exports.getBackups = async (req, res) => {
    try {
        const backups = await db.SettingsBackup.findAll({ 
            where: { company_id: getCompanyId(req) },
            order: [['createdAt', 'DESC']]
        });
        res.json(backups);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createBackup = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        // 1. Snapshot all settings
        const settings = await db.Setting.findAll({ where: { company_id: companyId } });
        
        // 2. Save backup
        await db.SettingsBackup.create({
            company_id: companyId,
            snapshot: settings.map(s => ({ key: s.key, value: s.value }))
        });

        // 3. Keep only 3 (Rotation)
        const allBackups = await db.SettingsBackup.findAll({ 
            where: { company_id: companyId },
            order: [['createdAt', 'DESC']]
        });

        if (allBackups.length > 3) {
            const idsToDelete = allBackups.slice(3).map(b => b.id);
            await db.SettingsBackup.destroy({ where: { id: idsToDelete } });
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.restoreBackup = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = getCompanyId(req);
        const backup = await db.SettingsBackup.findOne({ where: { id, company_id: companyId } });
        if (!backup) return res.status(404).json({ message: "Backup no encontrado" });

        // Restore settings using findOne + save/create pattern
        for (const item of backup.snapshot) {
            const existing = await db.Setting.findOne({ 
                where: { company_id: companyId, key: item.key } 
            });
            if (existing) {
                existing.value = item.value;
                await existing.save();
            } else {
                await db.Setting.create({ company_id: companyId, key: item.key, value: item.value });
            }
        }

        res.json({ success: true, message: "Backup restaurado correctamente." });
    } catch (e) { 
        console.error('[Restore Error]', e);
        res.status(500).json({ error: e.message }); 
    }
};

exports.exportConfig = async (req, res) => {
    try {
        const companyId = getCompanyId(req);
        const archiver = require('archiver');
        const fs = require('fs');
        
        // Get all company data
        const settings = await db.Setting.findAll({ where: { company_id: companyId } });
        const folders = await db.Folder.findAll({ where: { company_id: companyId } });
        const assets = await db.Asset.findAll({ where: { company_id: companyId } });
        const company = companyId ? await db.Company.findByPk(companyId) : null;

        const config = {
            export_date: new Date().toISOString(),
            company_name: company ? company.name : 'Global',
            settings: settings.map(s => ({ key: s.key, value: s.value })),
            folders: folders.map(f => ({ id: f.id, name: f.name })),
            assets: assets.map(a => ({ 
                name: a.name, 
                filename: a.filename, 
                mimetype: a.mimetype, 
                url: a.url, 
                folder_id: a.folder_id,
                is_knowledge: a.is_knowledge,
                extracted_text: a.extracted_text
            }))
        };

        // Set response headers for ZIP download
        const zipName = `profile_export_${company ? company.slug : 'global'}_${Date.now()}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        // Add config JSON
        archive.append(JSON.stringify(config, null, 2), { name: 'config.json' });

        // Add media files
        const uploadsDir = path.join(__dirname, '../../uploads');
        for (const asset of assets) {
            const filePath = path.join(uploadsDir, asset.filename);
            if (fs.existsSync(filePath)) {
                archive.file(filePath, { name: `media/${asset.filename}` });
            }
        }

        await archive.finalize();
    } catch (e) { 
        console.error('[Export Error]', e);
        res.status(500).json({ error: e.message }); 
    }
};

exports.importConfig = async (req, res) => {
    try {
        const { settings, folders, assets } = req.body;
        const companyId = getCompanyId(req);

        // 1. Import Settings
        if (settings) {
            for (const s of settings) {
                await db.Setting.upsert({ company_id: companyId, key: s.key, value: s.value });
            }
        }

        // 2. Import Folders & Assets (Metadata only)
        // Note: Real files must already be in /uploads or handled differently.
        // This is primarily for restoring prompts and structure.
        if (folders) {
            for (const f of folders) {
                await db.Folder.upsert({ id: f.id, company_id: companyId, name: f.name });
            }
        }
        if (assets) {
            for (const a of assets) {
                await db.Asset.upsert({ ...a, company_id: companyId });
            }
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
exports.getSaaSOverview = async (req, res) => {
    try {
        if (req.userRole !== 'superadmin') return res.status(403).json({ message: "Unauthorized" });

        const companies = await db.Company.findAll({
            include: [
                { model: db.ActiveSession, attributes: ['id'] },
                { model: db.UsageLog, attributes: ['tokens_prompt', 'tokens_completion', 'cost_estimated', 'createdAt', 'date'] },
                { model: db.Asset, attributes: ['url', 'filename'] }
            ]
        });

        // Global System Stats
        const os = require('os');
        const fs = require('fs');
        const path = require('path');
        
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        
        const systemStats = {
            total_mem_gb: (totalMem / 1024 / 1024 / 1024).toFixed(2),
            used_mem_gb: (usedMem / 1024 / 1024 / 1024).toFixed(2),
            free_mem_gb: (freeMem / 1024 / 1024 / 1024).toFixed(2),
            cpus: os.cpus().length,
            load: os.loadavg()
        };

        const stats = companies.map(c => {
            const logs = c.UsageLogs || [];
            
            // 1. Token & Cost Calcs
            const totalCost = logs.reduce((sum, log) => sum + (log.cost_estimated || 0), 0);
            const totalTokens = logs.reduce((sum, log) => sum + (log.tokens_prompt || 0) + (log.tokens_completion || 0), 0);
            
            // 2. Token Period Stats
            const now = new Date();
            const startOfDay = new Date(now.setHours(0,0,0,0));
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())); 
            const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            const startOfYear = new Date(new Date().getFullYear(), 0, 1);

            const calcTokens = (filterFn) => logs.filter(filterFn).reduce((sum, log) => sum + (log.tokens_prompt || 0) + (log.tokens_completion || 0), 0);

            // 3. Disk Usage Calculation (Real-time check)
            let diskUsageBytes = 0;
            if (c.Assets && c.Assets.length > 0) {
                c.Assets.forEach(asset => {
                    if (asset.url) { // assets are stored in uploads/ relative to app root usually
                         // asset.url is stored as 'uploads/filename.ext'
                         // Code runs in backend/src/controllers/, so we need simply to resolving from project root
                         // Previously we used: path.join(__dirname, '../../', `uploads/${file.filename}`)
                         // asset.url already contains 'uploads/' prefix usually? Let's check uploadAsset
                         // uploadAsset: url: `uploads/${file.filename}`. Correct.
                         const filePath = path.join(__dirname, '../../', asset.url);
                         if (fs.existsSync(filePath)) {
                             try {
                                const stat = fs.statSync(filePath);
                                diskUsageBytes += stat.size;
                             } catch(e) {}
                         }
                    }
                });
            }
            const diskUsageMB = (diskUsageBytes / 1024 / 1024).toFixed(2);

            // 4. Est. RAM Share (Heuristic: Global Used Mem / Total Active Sessions * Company Sessions)
            // If 0 sessions, base footprint is small. This is a ROUGH approximation.
            // Better: Base + (PerSession * Sessions)
            const totalActiveSessionsGlobal = companies.reduce((sum, comp) => sum + comp.ActiveSessions.length, 0) || 1; // avoid /0
            const ramShareMB = ((usedMem / 1024 / 1024) * (c.ActiveSessions.length / totalActiveSessionsGlobal)).toFixed(0);


            return {
                id: c.id,
                name: c.name,
                plan_status: c.plan_status,
                max_slots: c.max_slots,
                active_sessions: c.ActiveSessions.length,
                total_tokens: totalTokens,
                total_cost: totalCost.toFixed(4),
                usage_period: {
                    day: calcTokens(l => new Date(l.createdAt || l.date) >= startOfDay),
                    week: calcTokens(l => new Date(l.createdAt || l.date) >= startOfWeek),
                    month: calcTokens(l => new Date(l.createdAt || l.date) >= startOfMonth),
                    year: calcTokens(l => new Date(l.createdAt || l.date) >= startOfYear)
                },
                disk_usage_mb: diskUsageMB,
                est_ram_mb: ramShareMB
            };
        });

        res.json({ system: systemStats, companies: stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getCompanySettings = async (req, res) => {
    try {
        if (req.userRole !== 'superadmin') return res.status(403).json({ message: "Unauthorized" });
        const { companyId } = req.params;
        const settings = await db.Setting.findAll({ where: { company_id: companyId } });
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.pauseContact = async (req, res) => {
    try {
        const { contactId, durationMinutes } = req.body;
        const companyId = getCompanyId(req);
        const contact = await db.Contact.findOne({ where: { id: contactId, company_id: companyId } });
        if (!contact) return res.status(404).json({ message: "Contacto no encontrado" });

        if (durationMinutes === -1) {
            // Indefinite (let's set it to 10 years in the future)
            contact.bot_paused_until = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);
        } else if (durationMinutes === 0) {
            // Unpause
            contact.bot_paused_until = null;
        } else {
            contact.bot_paused_until = new Date(Date.now() + durationMinutes * 60000);
        }

        await contact.save();
        res.json({ success: true, bot_paused_until: contact.bot_paused_until });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.bulkResumeBot = async (req, res) => {
    try {
        const { contactIds } = req.body;
        const companyId = getCompanyId(req);
        
        await db.Contact.update(
            { bot_paused_until: null },
            { where: { id: contactIds, company_id: companyId } }
        );

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.sendManualMessage = async (req, res) => {
    try {
        const { sessionId, text, existingAssetUrl, buttons } = req.body;
        const companyId = getCompanyId(req);
        const uploadedFiles = req.files || [];
        
        const parsedButtons = buttons ? (typeof buttons === 'string' ? JSON.parse(buttons) : buttons) : [];

        // 1. Get Session & Contact
        const session = await db.Session.findOne({
            where: { id: sessionId, company_id: companyId },
            include: [{ model: db.Contact }]
        });
        if (!session) return res.status(404).json({ message: "Sesión no encontrada" });

        // 2. Prepare media for botManager
        let media = uploadedFiles.map(f => ({
            url: `uploads/${f.filename}`,
            type: f.mimetype.startsWith('video') ? 'video' : 'image'
        }));

        // Append existing asset if provided
        if (existingAssetUrl) {
            media.push({
                url: existingAssetUrl,
                type: existingAssetUrl.match(/\.(mp4|mov)$/i) ? 'video' : 'image'
            });
        }

        // 3. Send to Platform
        const botManager = require('../services/botManager');
        await botManager.sendMessageExternal(companyId, session.Contact.platform, session.Contact.platform_id, text, media, parsedButtons);

        // 4. Save Text to DB
        if (text || parsedButtons.length > 0) {
            await db.Message.create({
                company_id: companyId,
                session_id: session.id,
                role: 'assistant',
                content: text || (parsedButtons.length > 0 ? '[Buttons]' : ''),
                content_type: 'text',
                buttons: parsedButtons,
                timestamp: new Date()
            });
        }

        // 5. Save Media to DB
        for (const m of media) {
            await db.Message.create({
                company_id: companyId,
                session_id: session.id,
                role: 'assistant',
                content: `Sent ${m.type}`,
                content_type: m.type,
                media_url: m.url,
                timestamp: new Date()
            });
        }

        session.updatedAt = new Date();
        await session.save();

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getReportingStats = async (req, res) => {
    try {
        const { period, platform, companyId: targetCompanyId } = req.query; // Add targetCompanyId
        let companyId = getCompanyId(req);

        // SuperAdmin Override: If providing a specific company ID, use it.
        if (req.userRole === 'superadmin' && targetCompanyId) {
            companyId = targetCompanyId;
        }
        
        let dateFrom = new Date();
        // Determine date range
        switch(period) {
            case 'week': dateFrom.setDate(dateFrom.getDate() - 7); break;
            case 'month': dateFrom.setMonth(dateFrom.getMonth() - 1); break;
            case 'year': dateFrom.setFullYear(dateFrom.getFullYear() - 1); break;
            case 'day': default: dateFrom.setHours(0,0,0,0); break;
        }

        // Build Where Clause
        const whereClause = {
            timestamp: { [Op.gte]: dateFrom }
        };
        
        // If regular user or impersonating, filter by company. 
        // If SuperAdmin (and not impersonating, so companyId is null), show ALL.
        if (companyId) {
            whereClause.company_id = companyId;
        } else if (req.userRole !== 'superadmin') {
            // Safety: if for some reason role is missing but companyId is null, force 0 matches or handle error
            return res.status(403).json({ message: "Contexto de empresa requerido" });
        }

        // Include Logic for Platform Filter
        // We need to query Messages and filter by associated Session->Contact->platform
        const include = [{
            model: db.Session,
            required: true,
            include: [{
                model: db.Contact,
                required: true,
                where: platform ? { platform: platform } : {}
            }]
        }];

        const messages = await db.Message.findAll({
            where: whereClause,
            include: include,
            attributes: ['id', 'role', 'timestamp']
        });

        // Aggregation Logic (In-Memory for simplicity/DB independence)
        const stats = {
            total_incoming: 0,
            total_outgoing: 0,
            by_date: {},
            by_platform: {}
        };

        messages.forEach(msg => {
            const dateKey = msg.timestamp.toISOString().split('T')[0];
            const msgPlatform = msg.Session.Contact.platform;

            // Totals
            if (msg.role === 'user') stats.total_incoming++;
            else stats.total_outgoing++;

            // By Date
            if (!stats.by_date[dateKey]) stats.by_date[dateKey] = { incoming: 0, outgoing: 0 };
            if (msg.role === 'user') stats.by_date[dateKey].incoming++;
            else stats.by_date[dateKey].outgoing++;

            // By Platform (for pie/distribution)
            if (!stats.by_platform[msgPlatform]) stats.by_platform[msgPlatform] = { incoming: 0, outgoing: 0 };
            if (msg.role === 'user') stats.by_platform[msgPlatform].incoming++;
            else stats.by_platform[msgPlatform].outgoing++;
        });

        res.json(stats);

    } catch (e) {
        console.error('[Reporting Error]', e);
        res.status(500).json({ error: e.message });
    }
};
