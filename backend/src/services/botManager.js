const { Telegraf, Markup } = require('telegraf');
const { Company, Setting } = require('../database/models');
const botLogic = require('./botLogic');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const openaiService = require('./openaiService');

// Map<companyId, TelegrafInstance>
const bots = new Map();

const loadAllBots = async () => {
    console.log(`🔄 Loading SaaS Bots (PID: ${process.pid})...`);

    // 1. Load Global Bot (Superadmin)
    await startGlobalBot();

    // 2. Load Company Bots
    const companies = await Company.findAll({ where: { is_active: true } });

    for (const company of companies) {
        await startCompanyBot(company.id);
    }
};

const sendTelegramResponse = async (ctx, response) => {
    if (!response) return;

    // 1. Prepare Text + Buttons
    let extra = {};
    if (response.buttons && response.buttons.length > 0) {
        const keyboard = response.buttons.map(b => {
            let safeUrl = b.url;
            try { 
                // Only encode if it's not already encoded or has non-ascii
                if (decodeURI(b.url) === b.url) safeUrl = encodeURI(b.url); 
            } catch(e) {}
            return [Markup.button.url(b.label, safeUrl)];
        });
        extra = Markup.inlineKeyboard(keyboard);
    }

    // 2. Send Text
    if (response.text) {
        const safeText = response.text.replace(/\*\*/g, '*');
        await ctx.reply(safeText, extra);
    }

    // 3. Send Photos
    if (response.photos) {
        for (const p of response.photos) {
            const localPath = path.join(__dirname, '../../', p.url);    
            if (fs.existsSync(localPath)) await ctx.replyWithPhoto({ source: localPath });
        }
    }
};

const startCompanyBot = async (companyId) => {
    try {
        // Stop existing if any
        if (bots.has(companyId)) {
            await bots.get(companyId).stop();
            bots.delete(companyId);
        }

        const tokenSetting = await Setting.findOne({ where: { company_id: companyId, key: 'TELEGRAM_BOT_TOKEN' } });
        if (!tokenSetting || !tokenSetting.value) return;

        const bot = new Telegraf(tokenSetting.value);
        
        // --- Telegram Event Handlers (Scoped to Company) ---
        // --- Helpers ---
        const getProfileData = async (ctx) => {
            const userId = ctx.from.id;
            let avatar_url = '';
            let bio = '';
            try {
                // Fetch higher resolution photo
                const photos = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);
                if (photos.total_count > 0) {
                    const photo = photos.photos[0][photos.photos[0].length - 1]; // Get largest version
                    const fileId = photo.file_id;
                    const fileLink = await ctx.telegram.getFileLink(fileId);
                    const avatarFilename = `avatar_tg_${userId}.jpg`;
                    const avatarLocalPath = path.join(__dirname, '../../uploads', avatarFilename);
                    
                    const axios = require('axios');
                    const res = await axios({ url: fileLink.href, method: 'GET', responseType: 'stream' });
                    const writer = fs.createWriteStream(avatarLocalPath);
                    res.data.pipe(writer);
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });
                    avatar_url = `uploads/${avatarFilename}`;
                }
                
                // Get Bio via getChat
                const fullChat = await ctx.getChat();
                bio = fullChat.bio || '';
            } catch (e) { 
                console.error("Profile Fetch Error", e); 
            }

            return {
                first_name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'Amigo',
                username: ctx.from.username || '',
                avatar_url: avatar_url,
                bio: bio,
                platform_link: ctx.from.username ? `https://t.me/${ctx.from.username}` : null
            };
        };

        // --- Telegram Event Handlers ---
        bot.on('text', async (ctx) => {
            const profile = await getProfileData(ctx);
            const response = await botLogic.processMessage(companyId, 'telegram', ctx.from.id, profile, ctx.message.text, 'text');
            await sendTelegramResponse(ctx, response);
        });

        bot.on('photo', async (ctx) => {
            const profile = await getProfileData(ctx);
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const link = await ctx.telegram.getFileLink(photo.file_id);
            const response = await botLogic.processMessage(companyId, 'telegram', ctx.from.id, profile, ctx.message.caption || '', 'image', link.href);
            await sendTelegramResponse(ctx, response);
        });

        bot.on('voice', async (ctx) => {
            const userId = ctx.from.id;
             try {
                const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
                const downloadPath = path.join(__dirname, '../../uploads', `${companyId}_${userId}_${Date.now()}.ogg`);
                
                const writer = fs.createWriteStream(downloadPath);
                const response = await axios({ url: fileLink.href, method: 'GET', responseType: 'stream' });
                response.data.pipe(writer);
    
                writer.on('finish', async () => {
                    // Pass CompanyID to Whisper (Check if they have their own key?)
                    const text = await openaiService.transcribeAudio(downloadPath, companyId);
                    fs.unlinkSync(downloadPath);
    
                    if (text) {
                         const profile = { first_name: ctx.from.first_name || 'Amigo', username: ctx.from.username || '' };
                        const botResponse = await botLogic.processMessage(companyId, 'telegram', userId, profile, text, 'audio');
                        await sendTelegramResponse(ctx, botResponse);
                    } else {
                        await ctx.reply("👂 No pude entender eso.");
                    }
                });
            } catch (error) { console.error("Voice Error", error); }
        });

        bot.launch();
        bots.set(companyId, bot);
        console.log(`✅ Bot started for Company: ${companyId}`);

    } catch (e) {
        console.error(`❌ Failed to start bot for company ${companyId}:`, e.message);
    }
};

const startGlobalBot = async () => {
    try {
        const companyId = null; // Global context
        
        // Stop existing
        if (bots.has('global')) {
            await bots.get('global').stop();
            bots.delete('global');
        }

        const tokenSetting = await Setting.findOne({ where: { company_id: null, key: 'TELEGRAM_BOT_TOKEN' } });
        if (!tokenSetting || !tokenSetting.value) return;

        const bot = new Telegraf(tokenSetting.value);
        
        bot.on('text', async (ctx) => {
            const userId = ctx.from.id;
            const text = ctx.message.text;
            
            let avatar_url = '';
            let bio = '';
            try {
                const photos = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);
                if (photos.total_count > 0) {
                    const fileId = photos.photos[0][0].file_id;
                    const fileLink = await ctx.telegram.getFileLink(fileId);
                    avatar_url = fileLink.href;
                }
                const fullChat = await ctx.getChat();
                bio = fullChat.bio || '';
            } catch (e) {}

            const profile = { 
                first_name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'Amigo', 
                username: ctx.from.username,
                avatar_url: avatar_url,
                bio: bio
            };
            const response = await botLogic.processMessage(null, 'telegram', userId, profile, text, 'text');
            await sendTelegramResponse(ctx, response);
        });

        bot.on('photo', async (ctx) => {
            const userId = ctx.from.id;
            try {
                const photo = ctx.message.photo[ctx.message.photo.length - 1];
                const fileLink = await ctx.telegram.getFileLink(photo.file_id);
                const profile = { first_name: ctx.from.first_name, username: ctx.from.username };
                await botLogic.processMessage(null, 'telegram', userId, profile, `[IMAGE]`, 'image', fileLink.href);
            } catch (error) { console.error("Photo Error", error); }
        });

        bot.on('voice', async (ctx) => {
            const userId = ctx.from.id;
            try {
                const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
                const downloadPath = path.join(__dirname, '../../uploads', `global_${userId}_${Date.now()}.ogg`);
                
                const writer = fs.createWriteStream(downloadPath);
                const response = await axios({ url: fileLink.href, method: 'GET', responseType: 'stream' });
                response.data.pipe(writer);

                writer.on('finish', async () => {
                    const text = await openaiService.transcribeAudio(downloadPath, null); // null companyId for global
                    fs.unlinkSync(downloadPath);

                    console.log(`[Global Audio Debug] User: ${userId}, Transcribed: "${text}"`);

                    if (text) {
                        const profile = { 
                            first_name: ctx.from.first_name || 'Amigo', 
                            username: ctx.from.username || '', 
                            avatar_url: '', 
                            bio: '' 
                        };
                        const botResponse = await botLogic.processMessage(null, 'telegram', userId, profile, text, 'audio');
                        await sendTelegramResponse(ctx, botResponse);
                    } else {
                        await ctx.reply("👂 No pude entender el audio.");
                    }
                });
            } catch (error) { console.error("Global Voice Error", error); }
        });

        bot.launch();
        bots.set('global', bot);
        console.log(`✅ Global Bot started.`);
    } catch (e) {
        console.error(`❌ Failed to start Global Bot:`, e.message);
    }
};

const sendMessageExternal = async (companyId, platform, platformId, text, media = [], buttons = []) => {
    try {
        if (platform === 'telegram') {
            const bot = bots.get(companyId) || bots.get('global');
            if (bot) {
                // 1. Prepare Buttons
                let extra = {};
                if (buttons && buttons.length > 0) {
                    const keyboard = buttons.map(b => [Markup.button.url(b.label, b.url)]);
                    extra = Markup.inlineKeyboard(keyboard);
                }

                // 2. Send Text if present
                if (text) {
                    await bot.telegram.sendMessage(platformId, text, extra);
                } else if (buttons.length > 0 && media.length === 0) {
                    // Send buttons only if no text and no media
                    await bot.telegram.sendMessage(platformId, '[Opciones]', extra);
                }
                
                // 2. Send Media
                if (media && media.length > 0) {
                    for (const m of media) {
                        const localPath = path.join(__dirname, '../../', m.url);
                        if (!fs.existsSync(localPath)) continue;

                        if (m.type === 'video') {
                            await bot.telegram.sendVideo(platformId, { source: localPath });
                        } else {
                            await bot.telegram.sendPhoto(platformId, { source: localPath });
                        }
                    }
                }
                return true;
            }
        }
        // TODO: Implement for other platforms as they are connected
        console.warn(`[BotManager] Platform ${platform} not yet supported for manual messages.`);
        return false;
    } catch (e) {
        console.error(`[BotManager] Error sending manual message:`, e.message);
        throw e;
    }
};

module.exports = { loadAllBots, startCompanyBot, startGlobalBot, sendMessageExternal };
