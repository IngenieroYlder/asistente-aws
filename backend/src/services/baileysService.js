/**
 * baileysService.js - WhatsApp Web (Baileys) Integration for Quick Testing
 * 
 * Uses @whiskeysockets/baileys to connect via QR code scanning.
 * This is NOT the official Meta WhatsApp API - for testing only.
 * 
 * Architecture:
 *   Map<companyId, { sock, status, qr }> for multi-tenant support
 *   QR codes are emitted via Socket.IO in real-time
 *   Messages are routed through botLogic.processMessage()
 *   The messageBuffer debounce applies automatically
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const botLogic = require('./botLogic');
const { bufferMessage } = require('./messageBuffer');

// Map<companyKey, { sock, status, qr, retries }>
const connections = new Map();
const AUTH_DIR = path.join(__dirname, '../../uploads/baileys_auth');

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
            // Generate QR as base64 data URL
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
                // Clear auth state on logout
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

            // Get connected phone info
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
            // Skip messages from self, status broadcasts, and protocol messages
            if (msg.key.fromMe) continue;
            if (msg.key.remoteJid === 'status@broadcast') continue;
            if (!msg.message) continue;

            const senderId = msg.key.remoteJid;
            const pushName = msg.pushName || 'Usuario';

            // Extract text from various message types
            let text = '';
            let msgType = 'text';
            let mediaUrl = null;

            if (msg.message.conversation) {
                text = msg.message.conversation;
            } else if (msg.message.extendedTextMessage) {
                text = msg.message.extendedTextMessage.text || '';
            } else if (msg.message.imageMessage) {
                text = msg.message.imageMessage.caption || '[Imagen]';
                msgType = 'image';
                // TODO: Download image if needed
            } else if (msg.message.audioMessage) {
                // Voice notes - skip buffer, process directly
                msgType = 'audio';
                text = '[Audio]';
                // TODO: Download and transcribe audio
            } else if (msg.message.documentMessage) {
                text = `[Documento: ${msg.message.documentMessage.fileName || 'archivo'}]`;
            } else if (msg.message.videoMessage) {
                text = msg.message.videoMessage.caption || '[Video]';
            } else if (msg.message.stickerMessage) {
                text = '[Sticker]';
            } else {
                continue; // Skip unsupported message types
            }

            const profile = {
                first_name: pushName,
                username: senderId.replace('@s.whatsapp.net', ''),
                avatar_url: '',
                bio: '',
                platform_link: `https://wa.me/${senderId.replace('@s.whatsapp.net', '')}`
            };

            console.log(`[Baileys] Message from ${senderId}: "${text.substring(0, 50)}"`);

            // Use buffer for text messages, direct for audio
            if (msgType === 'audio') {
                // Audio goes direct (transcription adds delay)
                const response = await botLogic.processMessage(companyId, 'whatsapp', senderId, profile, text, msgType, mediaUrl);
                if (response && response.text) {
                    await sock.sendMessage(senderId, { text: response.text });
                }
            } else {
                // Text/image go through debounce buffer
                await bufferMessage(companyId, 'whatsapp', senderId, text, msgType, mediaUrl, profile,
                    async (cId, platform, platformId, prof, combinedText, type, mUrl) => {
                        const response = await botLogic.processMessage(cId, platform, platformId, prof, combinedText, type, mUrl);
                        if (response && response.text) {
                            await sock.sendMessage(platformId, { text: response.text });
                        }
                        // Send photos if any
                        if (response && response.photos && response.photos.length > 0) {
                            for (const p of response.photos) {
                                const localPath = path.join(__dirname, '../../', p.url);
                                if (fs.existsSync(localPath)) {
                                    await sock.sendMessage(platformId, { 
                                        image: fs.readFileSync(localPath),
                                        caption: p.caption || ''
                                    });
                                }
                            }
                        }
                    }
                );
            }
        }
    });

    return { status: 'connecting' };
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
        } catch (e) {
            // Ignore logout errors
        }
        try {
            conn.sock.end();
        } catch (e) {}
        connections.delete(key);
        
        // Clear auth state
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
 * Send a message via Baileys (for manual messages from admin panel)
 */
async function sendMessage(companyId, to, text, media = []) {
    const key = getKey(companyId);
    const conn = connections.get(key);
    if (!conn || conn.status !== 'connected') {
        throw new Error('WhatsApp (Baileys) is not connected');
    }

    // Ensure JID format
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
    sendMessage
};
