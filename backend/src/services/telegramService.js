const { Telegraf } = require('telegraf');
const botLogic = require('./botLogic');
const openaiService = require('./openaiService');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Setting } = require('../database/models');

let bot = null;

const setupTelegramBot = async () => {
    // Fetch token from DB or Env
    const tokenSetting = await Setting.findByPk('TELEGRAM_BOT_TOKEN');
    const token = tokenSetting ? tokenSetting.value : process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        console.warn('⚠️ Telegram Token not found. Bot not started.');
        return;
    }

    if (bot) {
        try {
            await bot.stop();
        } catch(e) { console.error('Error stopping prev bot', e); }
    }

    bot = new Telegraf(token);

    // Text Handler
    bot.on('text', async (ctx) => {
        const userId = ctx.from.id;
        const text = ctx.message.text;
        const profile = {
            first_name: ctx.from.first_name || 'Amigo',
            username: ctx.from.username || '',
            avatar_url: '' // Telegram doesn't give this easily without extra calls
        };

        const response = await botLogic.processMessage('telegram', userId, profile, text, 'text');
        
        if (response.text) {
            await ctx.reply(response.text);
        }
        
        // Handle Photos
        if (response.photos && response.photos.length > 0) {
            for (const p of response.photos) {
                // If local file
                const localPath = path.join(__dirname, '../../', p.url); // verify path logic
                if (fs.existsSync(localPath)) {
                   await ctx.replyWithPhoto({ source: localPath }); 
                } else if (p.url.startsWith('http')) {
                   await ctx.replyWithPhoto(p.url);
                }
            }
        }
    });

    // Voice Handler
    bot.on('voice', async (ctx) => {
        const userId = ctx.from.id;
        try {
            const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
            const downloadPath = path.join(__dirname, '../../uploads', `${userId}_${Date.now()}.ogg`);
            
            // Download file
            const writer = fs.createWriteStream(downloadPath);
            const response = await axios({
                url: fileLink.href,
                method: 'GET',
                responseType: 'stream'
            });
            response.data.pipe(writer);

            writer.on('finish', async () => {
                // Transcribe
                const text = await openaiService.transcribeAudio(downloadPath, null);
                
                // Cleanup
                fs.unlinkSync(downloadPath);

                if (text) {
                     const profile = {
                        first_name: ctx.from.first_name || 'Amigo',
                        username: ctx.from.username || '',
                        avatar_url: ''
                    };
                    const botResponse = await botLogic.processMessage('telegram', userId, profile, text, 'audio');
                    
                    if (botResponse.text) await ctx.reply(botResponse.text);
                    // Photos logic same as text...
                } else {
                    await ctx.reply("👂 No pude entender eso. ¿Puedes escribirlo?");
                }
            });

        } catch (error) {
            console.error("Telegram Voice Error:", error);
            await ctx.reply("Error procesando audio.");
        }
    });

    try {
        bot.launch();
        console.log('🚀 Telegram Bot Started via Telegraf');
    } catch (e) {
        console.error('❌ Failed to launch Telegram Bot', e);
    }
};

module.exports = { setupTelegramBot };
