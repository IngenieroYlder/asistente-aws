const botLogic = require('./botLogic');
const { bufferMessage } = require('./messageBuffer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Setting, Company } = require('../database/models');

const logWebhook = (msg) => {
    const logPath = path.join(__dirname, '../../webhook_debug.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
};

const verifyWebhook = async (req, res) => {
    const { companyId } = req.params;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
  
    if (mode && token) {
        // Handle 'global' keyword or standard ID
        const queryCompanyId = companyId === 'global' ? null : companyId;
        const setting = await Setting.findOne({ where: { company_id: queryCompanyId, key: 'META_VERIFY_TOKEN' } });
        const validToken = setting ? setting.value : null;

        if (mode === 'subscribe' && token === validToken) {
            console.log(`✅ Webhook Verified for Company ${companyId}`);
            res.status(200).send(challenge);
        } else {
            console.warn(`❌ Webhook Verification Failed for Company ${companyId}. Expected: ${validToken}, Got: ${token}`);
            res.sendStatus(403);      
        }
    }
};

const handleWebhook = async (req, res) => {
    const { companyId } = req.params;
    const body = req.body;
    
    logWebhook(`Received event for company: ${companyId}`);
    logWebhook(`Body: ${JSON.stringify(body)}`);
    
    // Convert 'global' to null for DB consistency
    const targetCompanyId = companyId === 'global' ? null : companyId;
  
    if (body.object === 'page' || body.object === 'instagram') {
      body.entry.forEach(async (entry) => {
        // Entry ID is Page ID, but we already know the Company ID from the URL
        if (entry.messaging) {
            entry.messaging.forEach(async (event) => {
                if (event.message) {
                    await processMetaEvent(targetCompanyId, event, body.object);
                }
            });
        }
      });
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
};

// findCompanyByPageId is no longer needed but kept if we need hybrid approaches later.
const findCompanyByPageId = async (pageId) => {
    const setting = await Setting.findOne({ where: { value: pageId } });
    return setting ? setting.company_id : null;
};

const processMetaEvent = async (companyId, event, platformType) => {
    const senderId = event.sender.id;
    const message = event.message;
    const platform = platformType === 'instagram' ? 'instagram' : 'messenger';
    
    // Fetch user profile logic (requires Page Access Token from Company Settings)
    let profile = { first_name: 'Usuario', username: '', avatar_url: '' };

    if (message.text) {
        await bufferMessage(companyId, platform, senderId, message.text, 'text', null, profile,
            async (cId, plat, platId, prof, combinedText, type, mediaUrl) => {
                const response = await botLogic.processMessage(cId, plat, platId, prof, combinedText, type, mediaUrl);
                if (response.text) {
                    await sendMetaMessage(cId, platId, response.text, plat);
                }
            }
        );
    } else if (message.attachments && message.attachments.length > 0) {
        // Handle Attachments (Audio/Voice)
        const attachment = message.attachments[0];
        if (attachment.type === 'audio') {
            const fs = require('fs');
            const path = require('path');
            const openaiService = require('./openaiService');

            try {
                const audioUrl = attachment.payload.url;
                const tempPath = path.join(__dirname, '../../uploads', `meta_${companyId}_${senderId}_${Date.now()}.mp4`); // Meta often sends mp4/aac
                
                // Download
                const writer = fs.createWriteStream(tempPath);
                const response = await axios({ url: audioUrl, method: 'GET', responseType: 'stream' });
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                // Transcribe
                // NOTE: openaiService.transcribeAudio should handle the transcription
                // Verify if openaiService requires companyId for key lookup (it should)
                const text = await openaiService.transcribeAudio(tempPath, companyId);
                fs.unlinkSync(tempPath); // Cleanup

                if (text) {
                    const botResponse = await botLogic.processMessage(companyId, platform, senderId, profile, text, 'audio');
                    if (botResponse.text) await sendMetaMessage(companyId, senderId, botResponse.text, platform);
                } else {
                    await sendMetaMessage(companyId, senderId, "🙉 No pude escuchar el audio.", platform);
                }
            } catch (error) {
                console.error("Meta Audio Error:", error.message);
                await sendMetaMessage(companyId, senderId, "Error procesando tu audio.", platform);
            }
        }
    }
};

const sendMetaMessage = async (companyId, recipientId, text, platform) => {
    // Determine which key to fetch based on platform
    let tokenKey = 'FACEBOOK_ACCESS_TOKEN'; // Default
    if (platform === 'instagram') tokenKey = 'INSTAGRAM_ACCESS_TOKEN';

    // Get Company Access Token
    let setting = await Setting.findOne({ where: { company_id: companyId, key: tokenKey } });
    
    // Fallback: Try legacy META_ACCESS_TOKEN if specific not found
    if (!setting) {
        setting = await Setting.findOne({ where: { company_id: companyId, key: 'META_ACCESS_TOKEN' } });
    }
    // Fallback: Try other platform token (sometimes users put same token in FB slot for both)
    if (!setting && platform === 'instagram') {
        setting = await Setting.findOne({ where: { company_id: companyId, key: 'FACEBOOK_ACCESS_TOKEN' } });
    }

    if (!setting) {
        console.error(`[Meta] No Access Token found for company ${companyId} on ${platform}`);
        return;
    }
    
    const accessToken = setting.value;
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`;
    
    try {
        await axios.post(url, {
            recipient: { id: recipientId },
            message: { text: text }
        });
    } catch (error) {
        console.error(`Meta Send Error (${platform} - Company ${companyId}):`, error.response ? error.response.data : error.message);
    }
};

module.exports = { verifyWebhook, handleWebhook };
