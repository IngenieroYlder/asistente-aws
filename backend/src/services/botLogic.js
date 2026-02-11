const { Contact, Session, Message, Summary, Setting, Asset, Company } = require('../database/models');
const openaiService = require('./openaiService');
const { Op } = require('sequelize');

exports.processMessage = async (companyId, platform, platformId, userProfile, text, type = 'text', mediaUrl = null) => {
    try {
        // 0. Persistence: If user sent mediaUrl (from Telegram/Meta), download it locally
        if (mediaUrl && (type === 'image' || type === 'audio')) {
            try {
                const fs = require('fs');
                const path = require('path');
                const axios = require('axios');
                const { optimizeFile } = require('./mediaService');

                // --- SECURITY: Validate file BEFORE downloading ---
                const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB raw (optimizer will compress)
                const ALLOWED_MIMES = {
                    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                    audio: ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a', 'application/octet-stream']
                };

                let skipDownload = false;
                try {
                    const headRes = await axios.head(mediaUrl, { timeout: 5000 });
                    const contentLength = parseInt(headRes.headers['content-length'] || '0');
                    const contentType = (headRes.headers['content-type'] || '').split(';')[0].trim();

                    if (contentLength > MAX_FILE_SIZE) {
                        console.warn(`[BotLogic] REJECTED: File too large (${(contentLength / 1024 / 1024).toFixed(1)}MB > 25MB)`);
                        skipDownload = true;
                    }
                    if (contentType && !ALLOWED_MIMES[type]?.includes(contentType)) {
                        console.warn(`[BotLogic] REJECTED: Invalid MIME ${contentType} for type ${type}`);
                        skipDownload = true;
                    }
                } catch (headErr) {
                    console.warn(`[BotLogic] HEAD check failed, proceeding: ${headErr.message}`);
                }

                if (!skipDownload) {
                    const ext = type === 'image' ? '.jpg' : '.ogg';
                    const filename = `persist_${platform}_${platformId}_${Date.now()}${ext}`;
                    const localPath = path.join(__dirname, '../../uploads', filename);
                    
                    const response = await axios({ url: mediaUrl, method: 'GET', responseType: 'stream', timeout: 30000 });
                    const writer = fs.createWriteStream(localPath);
                    
                    let bytesReceived = 0;
                    response.data.on('data', (chunk) => {
                        bytesReceived += chunk.length;
                        if (bytesReceived > MAX_FILE_SIZE) {
                            response.data.destroy();
                            writer.destroy();
                            try { fs.unlinkSync(localPath); } catch(e) {}
                            console.warn(`[BotLogic] Download aborted: exceeded 25MB during stream`);
                        }
                    });
                    response.data.pipe(writer);
                    
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });

                    if (bytesReceived <= MAX_FILE_SIZE) {
                        // Optimize with mediaService (WebP for images, Opus for audio)
                        const result = await optimizeFile(localPath, type);
                        mediaUrl = `uploads/${result.filename}`;
                    }
                }
            } catch (err) {
                console.error("[Persistence Error] Failed to download user media:", err.message);
            }
        }
        // Construct Platform Link
        let platformLink = userProfile.platform_link;
        if (!platformLink && platform === 'telegram' && userProfile.username) {
            platformLink = `https://t.me/${userProfile.username}`;
        }

        // 1. Find or Create Contact (Scoped by Company)
        let [contact] = await Contact.findOrCreate({
            where: { company_id: companyId, platform, platform_id: platformId.toString() },
            defaults: {
                first_name: userProfile.first_name,
                username: userProfile.username,
                avatar_url: userProfile.avatar_url,
                bio: userProfile.bio,
                platform_link: platformLink,
                last_interaction: new Date()
            }
        });

        // Update contact info
        contact.last_interaction = new Date();
        if (userProfile.first_name) contact.first_name = userProfile.first_name;
        if (userProfile.username) contact.username = userProfile.username;
        if (userProfile.avatar_url) contact.avatar_url = userProfile.avatar_url;
        if (userProfile.bio) contact.bio = userProfile.bio;
        if (platformLink) contact.platform_link = platformLink;
        
        await contact.save();

        // 0. Subscription Check (Skip if Global Bot)
        if (companyId) {
            const company = await Company.findByPk(companyId);
            if (!company) return { text: null };
            
            // Check Status
            if (!company.is_active || (company.plan_status === 'expired') || (company.plan_status === 'cancelled')) {
                console.log(`Company ${companyId} inactive/expired. Ignoring message.`);
                return { text: null };
            }

            // Check Date
            if (company.subscription_end && new Date() > new Date(company.subscription_end)) {
                console.log(`Company ${companyId} subscription ended. Updating status.`);
                company.plan_status = 'expired';
                await company.save();
                return { text: null };
            }
        }

        // 2. Handle Commands
        const sysSettings = await Setting.findAll({ where: { company_id: companyId } });
        const settingsMap = sysSettings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
        
        const loweredText = (text || '').toLowerCase().trim();
        if (loweredText === '/reset' || loweredText === '/new' || loweredText === '/start') {
            await Session.update(
                { is_active: false }, 
                { where: { company_id: companyId, contact_id: contact.id, is_active: true } }
            );
            // If it was just a reset, we return. If it was /new or /start, we continue to create a new session
            if (loweredText === '/reset') return { text: "🔄 Sesión reiniciada." };
            // For /new and /start, we want to proceed so it triggers the greeting in a NEW session
            text = "hola"; // Force a greeting in the new session
        }

        // 0. Check if bot is paused for this contact
        if (contact.bot_paused_until && new Date(contact.bot_paused_until) > new Date()) {
            console.log(`[BotLogic] Bot paused for contact ${platformId} until ${contact.bot_paused_until}`);
            return { text: null }; // Silence
        }

        // 1. Get or Create Session
        let session = await Session.findOne({
            where: { company_id: companyId, contact_id: contact.id, is_active: true },
            order: [['start_time', 'DESC']]
        });

        // 4. Expiration Logic
        if (session) {
            const lastMsg = await Message.findOne({ where: { session_id: session.id }, order: [['timestamp', 'DESC']] });
            const lastTime = lastMsg ? new Date(lastMsg.timestamp).getTime() : new Date(session.start_time).getTime();
            
            if (new Date().getTime() - lastTime > 86400000) {
                 const allMsgs = await Message.findAll({ where: { session_id: session.id }, order: [['timestamp', 'ASC']] });
                 const transcript = allMsgs.map(m => `${m.role}: ${m.content}`).join('\n');
                 const summaryText = await openaiService.summarizeSession(transcript, companyId);
                 if (summaryText) {
                     await Summary.create({
                         company_id: companyId,
                         contact_id: contact.id,
                         summary_text: summaryText,
                         date_range_start: session.start_time,
                         date_range_end: new Date()
                     });
                 }
                 session.is_active = false;
                 await session.save();
                 session = null;
            }
        }

        if (!session) {
            session = await Session.create({ company_id: companyId, contact_id: contact.id });
        } else {
            // Touch session to update updatedAt for inbox sorting
            session.changed('updatedAt', true);
            await session.save();
        }

        // 5. Save User Message
        await Message.create({
            company_id: companyId,
            session_id: session.id,
            role: 'user',
            content: text || '[Media]',
            content_type: type,
            media_url: mediaUrl,
            timestamp: new Date()
        });

        // 6. Build Context & Grounding
        let systemPrompt = settingsMap[`SYSTEM_PROMPT_${platform.toUpperCase()}`] || settingsMap['SYSTEM_PROMPT'] || "Eres un asistente amable.";
        
        // Grounding Rule: Dynamically load from settings or use safe default
        const groundingRules = settingsMap['GROUNDING_RULES'] || `- Solo responde basándote en la información oficial de la empresa.\n- Si el usuario pregunta por un producto o precio no mencionado, responde que no tienes esa información.\n- NUNCA inventes productos e ingredientes. Es mejor decir "no lo sé".`;

        systemPrompt += `\n\n=== REGLAS CRÍTICAS ===\n${groundingRules}`;

        // Fetch Assets for Context Awareness (Metadata + Content) - ONLY Knowledge Source
        const assets = await Asset.findAll({ 
            where: { company_id: companyId, is_knowledge: true }, 
            limit: 15 
        });
        if (assets.length > 0) {
            systemPrompt += `\n\n=== FUENTES DE INFORMACIÓN DISPONIBLES ===
Tienes acceso a los siguientes documentos para tu conocimiento (los nombres de archivos indican su contenido):
${assets.map(a => `- ${a.name} (${a.filename})`).join('\n')}`;

            const knowledgeContent = assets
                .filter(a => a.extracted_text)
                .map(a => `--- CONTENIDO DE: ${a.name} ---\n${a.extracted_text}`)
                .join('\n\n');

            if (knowledgeContent) {
                systemPrompt += `\n\n=== ENTRENAMIENTO EXCLUSIVO DE LA EMPRESA ===
Usa ESTA información para responder preguntas sobre precios, platos, servicios y disponibilidad:
${knowledgeContent}`;
            }
        }

        const recentSummaries = await Summary.findAll({
            where: { company_id: companyId, contact_id: contact.id },
            order: [['createdAt', 'DESC']],
            limit: 3
        });
        
        if (recentSummaries.length > 0) {
            systemPrompt += `\n\n=== MEMORIA DE CONVERSACIONES ANTERIORES ===\n${recentSummaries.map(s => `- ${s.summary_text}`).join('\n')}`;
        }

        const historyDESC = await Message.findAll({ where: { session_id: session.id }, order: [['timestamp', 'DESC']], limit: 20 });
        const history = historyDESC.reverse();
        const messages = [{ role: 'system', content: systemPrompt }, ...history.map(m => ({ role: m.role, content: m.content }))];

        // 7. Get AI Response
        let reply = await openaiService.getChatCompletion(companyId, messages);

        // 8. Asset & Button Substitution
        const photoRegex = /\[\s*SEND_PHOTO\s*:\s*([^\]\s]+)\s*\]/gi;
        const buttonRegex = /\[\s*BUTTON\s*:\s*([^|\]]+)\|\s*([^\]]+)\]/gi;
        
        let resolvedPhotos = [];
        let buttons = [];
        let match;

        // Photos
        while ((match = photoRegex.exec(reply)) !== null) {
            const assetName = match[1];
            const asset = await Asset.findOne({ where: { company_id: companyId, name: assetName } });
            if (asset) resolvedPhotos.push(asset);
        }

        // Buttons
        while ((match = buttonRegex.exec(reply)) !== null) {
            buttons.push({ label: match[1].trim(), url: match[2].trim() });
        }

        reply = reply.replace(photoRegex, '').replace(buttonRegex, '');
        
        // Clean up orphan list markers (e.g., "- ", "1. ") left behind after tag removal
        reply = reply.replace(/^[*\-\•\d\.]+\s*$/gm, '');
        
        // Collapse 3 or more newlines into 2 and trim
        reply = reply.replace(/\n{3,}/g, '\n\n').trim();
        
        // 9. Save Assistant Message
        if (reply) {
            await Message.create({
                company_id: companyId,
                session_id: session.id,
                role: 'assistant',
                content: reply,
                content_type: 'text',
                timestamp: new Date()
            });
        }

        // Save Photos as separate messages for history
        if (resolvedPhotos.length > 0) {
            for (const p of resolvedPhotos) {
                await Message.create({
                    company_id: companyId,
                    session_id: session.id,
                    role: 'assistant',
                    content: `Sent photo: ${p.name}`,
                    content_type: 'image',
                    media_url: p.url,
                    timestamp: new Date()
                });
            }
        }

        return { text: reply, photos: resolvedPhotos, buttons };

    } catch (error) {
        console.error("BotLogic Error:", error);
        return { text: "⚠️ Error interno." };
    }
};
