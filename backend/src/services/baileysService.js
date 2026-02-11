/**
 * baileysService.js - WhatsApp Web (Baileys) Integration for Quick Testing
 * 
 * Uses @whiskeysockets/baileys to connect via QR code scanning.
 * This is NOT the official Meta WhatsApp API - for testing only.
 * 
 * Features:
 *   - Multi-tenant connections (Map<companyId, { sock, status, qr }>)
 *   - QR codes emitted via Socket.IO in real-time
 *   - Audio download + Whisper transcription
 *   - Image download + optimization
 *   - Typing indicator while processing
 *   - Messages routed through botLogic.processMessage()
 *   - Full messageBuffer debounce integration
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const botLogic = require('./botLogic');
const openaiService = require('./openaiService');
const { bufferMessage } = require('./messageBuffer');

// Map<companyKey, { sock, status, qr, retries }>
const connections = new Map();
const AUTH_DIR = path.join(__dirname, '../../uploads/baileys_auth');
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Socket.IO instance (set from app.js)
let io = null;

/**
 * Set the Socket.IO server instance
 */
function setIO(socketIO) {
    io = socketIO;
}

/**
 * Get a unique key for the company
 */
function getKey(companyId) {
    return companyId ? `company_${companyId}` : 'global';
}

/**
 * Show "typing..." indicator in WhatsApp
 */
async function sendTyping(sock, jid) {
    try {
        await sock.presenceSubscribe(jid);
        await sock.sendPresenceUpdate('composing', jid);
    } catch (e) { /* ignore typing errors */ }
}

/**
 * Stop "typing..." indicator
 */
async function stopTyping(sock, jid) {
    try {
        await sock.sendPresenceUpdate('paused', jid);
    } catch (e) { /* ignore */ }
}

/**
 * Download media from a Baileys message and save to uploads/
 */
async function downloadBaileysMedia(msg, type, companyId, senderId) {
    try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        if (!buffer || buffer.length === 0) return null;

        // Limit: 25MB
        if (buffer.length > 25 * 1024 * 1024) {
            console.warn(`[Baileys] Media too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);
            return null;
        }

        const ext = type === 'audio' ? '.ogg' : '.jpg';
        const filename = `baileys_${companyId || 'global'}_${senderId.replace('@s.whatsapp.net', '')}_${Date.now()}${ext}`;
        const filePath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, buffer);
        console.log(`[Baileys] Downloaded ${type}: ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
        return filePath;
    } catch (e) {
        console.error('[Baileys] Media download error:', e.message);
        return null;
    }
}

/**
 * Start a Baileys WhatsApp connection for a company
 */
async function startBaileys(companyId) {
    const key = getKey(companyId);

    // Stop existing connection if any
    await stopBaileys(companyId);

    // Ensure auth directory exists
    const authPath = path.join(AUTH_DIR, key);
    if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Asistente AWS', 'Chrome', '120.0'],
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
    });

    const conn = {
        sock,
        status: 'connecting',
        qr: null,
        retries: 0,
        companyId
    };
    connections.set(key, conn);

    // --- Connection Events ---
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            try {
                const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
                conn.qr = qrDataUrl;
                conn.status = 'qr';
                emitStatus(key, { status: 'qr', qr: qrDataUrl });
                console.log(`[Baileys] QR generated for ${key}`);
            } catch (e) {
                console.error('[Baileys] QR generation error:', e.message);
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(`[Baileys] Connection closed for ${key}. Code: ${statusCode}. Reconnect: ${shouldReconnect}`);

            conn.status = 'disconnected';
            conn.qr = null;
            emitStatus(key, { status: 'disconnected', reason: statusCode });

            if (shouldReconnect && conn.retries < 5) {
                conn.retries++;
                const delay = Math.min(1000 * Math.pow(2, conn.retries), 30000);
                console.log(`[Baileys] Reconnecting ${key} in ${delay / 1000}s (attempt ${conn.retries})...`);
                setTimeout(() => startBaileys(companyId), delay);
            } else if (statusCode === DisconnectReason.loggedOut) {
                console.log(`[Baileys] Logged out for ${key}. Clearing auth.`);
                if (fs.existsSync(authPath)) {
                    fs.rmSync(authPath, { recursive: true, force: true });
                }
                connections.delete(key);
                emitStatus(key, { status: 'logged_out' });
            }
        }

        if (connection === 'open') {
            conn.status = 'connected';
            conn.qr = null;
            conn.retries = 0;

            const phoneNumber = sock.user?.id?.replace(/:.*$/, '') || 'Unknown';
            const pushName = sock.user?.name || '';

            console.log(`[Baileys] ✅ Connected for ${key} as ${phoneNumber} (${pushName})`);
            emitStatus(key, { 
                status: 'connected', 
                phone: phoneNumber,
                name: pushName
            });
        }
    });

    // --- Message Handler ---
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (msg.key.fromMe) continue;
            if (msg.key.remoteJid === 'status@broadcast') continue;
            if (!msg.message) continue;

            const senderId = msg.key.remoteJid;
            const pushName = msg.pushName || 'Usuario';

            let text = '';
            let msgType = 'text';
            let mediaUrl = null;

            if (msg.message.conversation) {
                text = msg.message.conversation;
            } else if (msg.message.extendedTextMessage) {
                text = msg.message.extendedTextMessage.text || '';
            } else if (msg.message.imageMessage) {
                // Download image
                const localPath = await downloadBaileysMedia(msg, 'image', companyId, senderId);
                if (localPath) {
                    text = msg.message.imageMessage.caption || '';
                    msgType = 'image';
                    mediaUrl = localPath;
                } else {
                    text = msg.message.imageMessage.caption || '[Imagen no descargada]';
                }
            } else if (msg.message.audioMessage) {
                msgType = 'audio';
                // Download audio and transcribe
                const localPath = await downloadBaileysMedia(msg, 'audio', companyId, senderId);
                if (localPath) {
                    // Show typing while transcribing
                    await sendTyping(sock, senderId);

                    try {
                        const transcription = await openaiService.transcribeAudio(localPath, companyId);
                        fs.unlinkSync(localPath); // Clean up temp file

                        if (transcription) {
                            text = transcription;
                            console.log(`[Baileys] Transcribed audio: "${text.substring(0, 60)}..."`);
                        } else {
                            text = '';
                            await sock.sendMessage(senderId, { text: '👂 No pude entender el audio.' });
                            await stopTyping(sock, senderId);
                            continue;
                        }
                    } catch (e) {
                        console.error('[Baileys] Transcription error:', e.message);
                        try { fs.unlinkSync(localPath); } catch(ue) {}
                        await sock.sendMessage(senderId, { text: '❌ Error procesando tu audio.' });
                        await stopTyping(sock, senderId);
                        continue;
                    }
                } else {
                    await sock.sendMessage(senderId, { text: '🙉 No pude descargar el audio.' });
                    continue;
                }
            } else if (msg.message.documentMessage) {
                text = `[Documento: ${msg.message.documentMessage.fileName || 'archivo'}]`;
            } else if (msg.message.videoMessage) {
                text = msg.message.videoMessage.caption || '[Video]';
            } else if (msg.message.stickerMessage) {
                text = '[Sticker]';
            } else {
                continue;
            }

            const profile = {
                first_name: pushName,
                username: senderId.replace('@s.whatsapp.net', ''),
                avatar_url: '',
                bio: '',
                platform_link: `https://wa.me/${senderId.replace('@s.whatsapp.net', '')}`
            };

            console.log(`[Baileys] Message from ${senderId}: "${text.substring(0, 50)}"`);

            // Audio goes direct (already transcribed), text/image go through buffer
            if (msgType === 'audio') {
                await sendTyping(sock, senderId);
                const response = await botLogic.processMessage(companyId, 'whatsapp', senderId, profile, text, msgType, mediaUrl);
                await stopTyping(sock, senderId);
                if (response && response.text) {
                    await sock.sendMessage(senderId, { text: response.text });
                }
                await sendBotPhotos(sock, senderId, response);
            } else {
                await bufferMessage(companyId, 'whatsapp', senderId, text, msgType, mediaUrl, profile,
                    async (cId, platform, platformId, prof, combinedText, type, mUrl) => {
                        await sendTyping(sock, platformId);
                        const response = await botLogic.processMessage(cId, platform, platformId, prof, combinedText, type, mUrl);
                        await stopTyping(sock, platformId);
                        if (response && response.text) {
                            await sock.sendMessage(platformId, { text: response.text });
                        }
                        await sendBotPhotos(sock, platformId, response);
                    }
                );
            }
        }
    });

    return { status: 'connecting' };
}

/**
 * Send bot response photos if any
 */
async function sendBotPhotos(sock, jid, response) {
    if (response && response.photos && response.photos.length > 0) {
        for (const p of response.photos) {
            const localPath = path.join(__dirname, '../../', p.url);
            if (fs.existsSync(localPath)) {
                await sock.sendMessage(jid, { 
                    image: fs.readFileSync(localPath),
                    caption: p.caption || ''
                });
            }
        }
    }
}

/**
 * Stop a Baileys connection
 */
async function stopBaileys(companyId) {
    const key = getKey(companyId);
    const conn = connections.get(key);
    if (conn && conn.sock) {
        try {
            await conn.sock.logout();
        } catch (e) {}
        try {
            conn.sock.end();
        } catch (e) {}
        connections.delete(key);
        
        const authPath = path.join(AUTH_DIR, key);
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }
        
        emitStatus(key, { status: 'disconnected' });
        console.log(`[Baileys] Stopped for ${key}`);
    }
}

/**
 * Get connection status
 */
function getStatus(companyId) {
    const key = getKey(companyId);
    const conn = connections.get(key);
    if (!conn) {
        return { status: 'disconnected', qr: null, phone: null };
    }
    return {
        status: conn.status,
        qr: conn.status === 'qr' ? conn.qr : null,
        phone: conn.sock?.user?.id?.replace(/:.*$/, '') || null,
        name: conn.sock?.user?.name || null
    };
}

/**
 * Check if Baileys has an active connection for a company
 */
function isConnected(companyId) {
    const key = getKey(companyId);
    const conn = connections.get(key);
    return conn && conn.status === 'connected';
}

/**
 * Send a message via Baileys (for manual messages from admin panel)
 */
async function sendMessage(companyId, to, text, media = []) {
    const key = getKey(companyId);
    const conn = connections.get(key);
    if (!conn || conn.status !== 'connected') {
        throw new Error('WhatsApp (Baileys) is not connected');
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    if (text) {
        await conn.sock.sendMessage(jid, { text });
    }

    for (const m of media) {
        const localPath = path.join(__dirname, '../../', m.url);
        if (fs.existsSync(localPath)) {
            if (m.type === 'video') {
                await conn.sock.sendMessage(jid, { video: fs.readFileSync(localPath) });
            } else {
                await conn.sock.sendMessage(jid, { image: fs.readFileSync(localPath) });
            }
        }
    }
}

/**
 * Emit status update via Socket.IO
 */
function emitStatus(key, data) {
    if (io) {
        io.emit(`baileys:${key}`, data);
    }
}

module.exports = {
    setIO,
    startBaileys,
    stopBaileys,
    getStatus,
    isConnected,
    sendMessage
};
