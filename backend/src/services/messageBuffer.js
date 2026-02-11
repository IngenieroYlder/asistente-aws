/**
 * messageBuffer.js - Message Debounce / Batching System
 * 
 * Accumulates rapid messages from the same contact and processes them 
 * as a single combined message after a configurable delay.
 * 
 * Example: User sends "hola", "como", "estas" within 10 seconds
 *          → Bot receives ONE call with "hola\ncomo\nestas"
 *          → Bot gives ONE response instead of three
 * 
 * The delay is configurable per company via the Setting key:
 *   MESSAGE_BUFFER_SECONDS (default: 8)
 */

const { Setting } = require('../database/models');

// Map<bufferKey, { messages: [], timer: NodeJS.Timeout, callback: Function }>
const buffers = new Map();

// Cache for company delay settings to avoid DB queries on every message
const delayCache = new Map();
const CACHE_TTL = 60000; // Refresh every 60 seconds

/**
 * Get the configured buffer delay for a company (in milliseconds)
 */
async function getBufferDelay(companyId) {
    const cacheKey = companyId || 'global';
    const cached = delayCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.delay;
    }

    try {
        const setting = await Setting.findOne({ 
            where: { company_id: companyId, key: 'MESSAGE_BUFFER_SECONDS' } 
        });
        const seconds = setting ? parseInt(setting.value) : 8;
        const delay = Math.max(1, Math.min(30, seconds)) * 1000; // Clamp 1-30s

        delayCache.set(cacheKey, { delay, timestamp: Date.now() });
        return delay;
    } catch (e) {
        return 8000; // Default 8 seconds
    }
}

/**
 * Buffer a message. If no new messages arrive within the delay window,
 * the callback fires with all accumulated messages combined.
 * 
 * @param {string} companyId - Company ID
 * @param {string} platform - 'telegram', 'whatsapp', etc.
 * @param {string} platformId - User's platform ID
 * @param {string} text - Message text
 * @param {string} type - 'text', 'image', 'audio'
 * @param {string|null} mediaUrl - Media URL if applicable
 * @param {Object} profile - User profile data
 * @param {Function} processCallback - Called with (combinedText, lastType, lastMediaUrl)
 */
async function bufferMessage(companyId, platform, platformId, text, type, mediaUrl, profile, processCallback) {
    const bufferKey = `${companyId || 'global'}_${platform}_${platformId}`;
    const delay = await getBufferDelay(companyId);

    // If there's an existing buffer for this contact, clear its timer
    if (buffers.has(bufferKey)) {
        const existing = buffers.get(bufferKey);
        clearTimeout(existing.timer);
        
        // Append message
        existing.messages.push({ text, type, mediaUrl });
        
        // Reset timer
        existing.timer = setTimeout(() => {
            flushBuffer(bufferKey);
        }, delay);
    } else {
        // Create new buffer
        const entry = {
            messages: [{ text, type, mediaUrl }],
            profile,
            companyId,
            platform,
            platformId,
            processCallback,
            timer: setTimeout(() => {
                flushBuffer(bufferKey);
            }, delay)
        };
        buffers.set(bufferKey, entry);
    }
}

/**
 * Flush a buffer: combine all messages and fire the callback.
 */
function flushBuffer(bufferKey) {
    const entry = buffers.get(bufferKey);
    if (!entry) return;
    
    buffers.delete(bufferKey);

    // Combine text messages
    const textParts = entry.messages
        .filter(m => m.text && m.text.trim())
        .map(m => m.text.trim());
    
    const combinedText = textParts.join('\n');
    
    // Use the last message's type and mediaUrl (if any had media)
    const lastMedia = [...entry.messages].reverse().find(m => m.mediaUrl);
    const lastType = lastMedia ? lastMedia.type : 'text';
    const lastMediaUrl = lastMedia ? lastMedia.mediaUrl : null;

    console.log(`[Buffer] Flushing ${entry.messages.length} msgs for ${entry.platform}:${entry.platformId} → "${combinedText.substring(0, 50)}..."`);

    // Fire callback with combined message
    entry.processCallback(
        entry.companyId,
        entry.platform,
        entry.platformId,
        entry.profile,
        combinedText || '[Media]',
        lastType,
        lastMediaUrl
    );
}

/**
 * Clear all buffers (for shutdown)
 */
function clearAllBuffers() {
    for (const [key, entry] of buffers) {
        clearTimeout(entry.timer);
    }
    buffers.clear();
    console.log('[Buffer] All buffers cleared.');
}

/**
 * Invalidate cached delay for a company (call when settings change)
 */
function invalidateCache(companyId) {
    delayCache.delete(companyId || 'global');
}

module.exports = { 
    bufferMessage, 
    clearAllBuffers, 
    invalidateCache,
    getBufferDelay 
};
