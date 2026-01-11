/**
 * KeWhats WhatsApp Service
 * 
 * Menggunakan @whiskeysockets/baileys untuk koneksi ke WhatsApp
 * Support multi-device dan session management
 * 
 * Note: Menggunakan dynamic import karena Baileys adalah ESM module
 */

const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const AutoReplyService = require('./autoReply');
const { createProxyAgent, isProxyEnabled, isMediaBlocked } = require('../utils/proxyAgent');

// Store untuk menyimpan WhatsApp instances
const sessions = new Map();
// Note: sessionStores removed to prevent unlimited RAM usage
// Messages are stored in our own database, Baileys store is not needed

// Path untuk menyimpan sessions
const SESSIONS_DIR = path.join(__dirname, '../../sessions');

// Pastikan folder sessions ada
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Baileys modules (akan di-load secara dynamic)
let makeWASocket, DisconnectReason, useMultiFileAuthState, makeInMemoryStore, fetchLatestBaileysVersion, delay;

// Load ESM modules
async function loadBaileys() {
    if (makeWASocket) return; // Sudah loaded

    const baileys = await import('@whiskeysockets/baileys');
    console.log('[WA] Baileys imports keys:', Object.keys(baileys));
    console.log('[WA] Baileys.default type:', typeof baileys.default);

    makeWASocket = baileys.default || baileys; // Fallback if default is missing?

    // Check if makeWASocket is actually a function
    if (typeof makeWASocket !== 'function' && typeof baileys.default?.default === 'function') {
        makeWASocket = baileys.default.default;
    }

    DisconnectReason = baileys.DisconnectReason || baileys.default?.DisconnectReason;
    useMultiFileAuthState = baileys.useMultiFileAuthState || baileys.default?.useMultiFileAuthState;
    makeInMemoryStore = baileys.makeInMemoryStore || baileys.default?.makeInMemoryStore;
    fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion || baileys.default?.fetchLatestBaileysVersion;
    delay = baileys.delay || baileys.default?.delay;

    console.log('[WA] Baileys module loaded successfully');
}

// Load saat module di-require
loadBaileys().catch(err => {
    console.error('[WA] Failed to load Baileys:', err.message);
});

/**
 * WhatsApp Service Class
 */
class WhatsAppService {
    constructor(io) {
        this.io = io; // Socket.IO instance untuk realtime updates
        this.initialized = false;
        this.qrCodes = new Map(); // Store latest qr for each device
        this.autoReplyService = new AutoReplyService(this);
    }

    getLatestQR(deviceId) {
        return this.qrCodes.get(deviceId);
    }

    /**
     * Ensure Baileys is loaded
     */
    async ensureLoaded() {
        if (!makeWASocket) {
            await loadBaileys();
        }
    }

    /**
     * Get session path untuk device tertentu
     */
    getSessionPath(deviceId) {
        return path.join(SESSIONS_DIR, `session_${deviceId}`);
    }

    /**
     * Check apakah session sudah ada
     */
    hasSession(deviceId) {
        return sessions.has(deviceId);
    }

    /**
     * Get active session
     */
    getSession(deviceId) {
        return sessions.get(deviceId);
    }

    /**
     * Get all active sessions
     */
    getAllSessions() {
        const result = [];
        sessions.forEach((socket, deviceId) => {
            result.push({
                deviceId,
                status: socket.user ? 'connected' : 'connecting',
                user: socket.user || null
            });
        });
        return result;
    }

    /**
     * Get watermark configuration for a device based on user's plan
     * Centralized logic to ensure consistency across all message types
     */
    async getWatermarkConfig(deviceId) {
        const prisma = require('../utils/prisma');
        const { PLAN_LIMITS } = require('./planLimitsService');

        try {
            const device = await prisma.device.findUnique({
                where: { id: deviceId },
                include: { user: { select: { plan: true } } }
            });

            const userPlan = device?.user?.plan?.toLowerCase() || 'free';
            const planConfig = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;

            return {
                shouldAddWatermark: planConfig.watermark === true,
                watermarkText: 'Sent via KeWhats',
                watermarkFooter: 'Sent via KeWhats'
            };
        } catch (err) {
            console.error('[WA] getWatermarkConfig failed:', err.message);
            // Default to showing watermark on error (fail-safe for free plan)
            return {
                shouldAddWatermark: true,
                watermarkText: 'Sent via KeWhats',
                watermarkFooter: 'Sent via KeWhats'
            };
        }
    }


    /**
     * Initialize dan connect WhatsApp session
     */
    async createSession(deviceId, callbacks = {}) {
        await this.ensureLoaded();

        const sessionPath = this.getSessionPath(deviceId);

        // Ensure store factory is available
        if (!makeInMemoryStore) {
            const baileys = await import('@whiskeysockets/baileys');
            makeInMemoryStore = baileys.makeInMemoryStore || baileys.default?.makeInMemoryStore;
        }

        // Cleanup existing session jika ada
        if (sessions.has(deviceId)) {
            try {
                const oldSocket = sessions.get(deviceId);
                oldSocket.ev.removeAllListeners();
                await oldSocket.end();
            } catch (e) {
                // Ignore cleanup errors
            }
            sessions.delete(deviceId);
        }

        // Check for corrupt creds
        const credsPath = path.join(sessionPath, 'creds.json');
        if (fs.existsSync(credsPath)) {
            const stats = fs.statSync(credsPath);
            if (stats.size === 0) {
                console.log(`[WA:${deviceId}] Found corrupted (empty) creds.json. Resetting session...`);
                fs.rmSync(sessionPath, { recursive: true, force: true });
                fs.mkdirSync(sessionPath, { recursive: true });
            }
        }

        // Setup auth state (multi-file untuk persistence)
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        // NOTE: In-memory store DISABLED to prevent RAM growth
        // Messages are stored in our own database, we don't need Baileys internal store
        // This prevents unlimited memory accumulation over time
        // const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

        // Fetch versi terbaru
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`[WA:${deviceId}] Using WA version ${version.join('.')}, isLatest: ${isLatest}`);

        // Create proxy agent if configured
        const proxyAgent = createProxyAgent();
        if (proxyAgent) {
            console.log(`[WA:${deviceId}] Using residential proxy for connection`);
        }

        // Buat socket connection
        const socket = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: ['KeWhats', 'Chrome', '120.0.0'],
            agent: proxyAgent,
            // getMessage uses database fallback since in-memory store is disabled
            getMessage: async (key) => {
                // Return empty placeholder - actual message retrieval is done via our database
                return { conversation: '' };
            }
        });

        // NOTE: Store binding DISABLED - we use our own database for message storage
        // This prevents unlimited RAM accumulation

        // Store socket reference
        sessions.set(deviceId, socket);

        // Handle connection update
        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Emit QR code jika ada
            if (qr) {
                try {
                    const qrImage = await QRCode.toDataURL(qr);
                    console.log(`[WA:${deviceId}] QR Code generated`);

                    // Cache it
                    this.qrCodes.set(deviceId, qrImage);

                    // Emit via Socket.IO
                    if (this.io) {
                        this.io.to(`device:${deviceId}`).emit('qr', { deviceId, qr: qrImage });
                    }

                    // Callback
                    if (callbacks.onQR) {
                        callbacks.onQR(qrImage);
                    }
                } catch (err) {
                    console.error(`[WA:${deviceId}] Error generating QR:`, err);
                }
            }

            // Connection established
            if (connection === 'open') {
                console.log(`[WA:${deviceId}] Connected!`);
                this.qrCodes.delete(deviceId); // Clear QR

                // Sync status to database
                const prisma = require('../utils/prisma');
                await prisma.device.update({
                    where: { id: deviceId },
                    data: { status: 'connected', lastActive: new Date() }
                }).catch(err => console.error(`[WA:${deviceId}] DB Update error:`, err.message));

                // Force save creds to ensure 'me' object is persisted
                console.log(`[WA:${deviceId}] Forcing saveCreds on connection open...`);
                await saveCreds();

                if (this.io) {
                    this.io.to(`device:${deviceId}`).emit('connected', {
                        deviceId,
                        user: socket.user
                    });
                    this.io.emit('device.status', { deviceId, status: 'connected' });
                }

                if (callbacks.onConnected) {
                    callbacks.onConnected(socket.user);
                }
            }

            // Connection closed
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`[WA:${deviceId}] Connection closed. StatusCode: ${statusCode}`);

                // Sync status to database
                const prisma = require('../utils/prisma');
                const newStatus = (statusCode === 401 || statusCode === 403) ? 'disconnected' : 'pending';
                await prisma.device.update({
                    where: { id: deviceId },
                    data: { status: newStatus }
                }).catch(err => console.error(`[WA:${deviceId}] DB Update error:`, err.message));

                // Check if should reconnect
                const shouldReconnect = statusCode !== 401 && statusCode !== 403;

                if (shouldReconnect && statusCode !== undefined) {
                    console.log(`[WA:${deviceId}] Reconnecting in 5s...`);
                    await delay(5000);
                    await this.createSession(deviceId, callbacks);
                } else if (statusCode === 401) {
                    // Logged out - remove session and clean up files
                    console.log(`[WA:${deviceId}] Session logged out (401). Cleaning up session files...`);
                    await this.deleteSession(deviceId);

                    if (this.io) {
                        this.io.to(`device:${deviceId}`).emit('disconnected', {
                            deviceId,
                            reason: 'logged_out'
                        });
                        this.io.emit('device.status', { deviceId, status: 'disconnected' });
                    }

                    if (callbacks.onDisconnected) {
                        callbacks.onDisconnected('logged_out');
                    }
                }
            }
        });

        // Handle credentials update (save ke file)
        socket.ev.on('creds.update', async () => {
            console.log(`[WA:${deviceId}] Credentials updated, saving...`);
            await saveCreds();
            console.log(`[WA:${deviceId}] Credentials SAVED to disk!`);
        });

        // Handle incoming messages
        socket.ev.on('messages.upsert', async ({ messages, type }) => {
            console.log(`[WA:${deviceId}] messages.upsert event - type: ${type}, count: ${messages?.length}`);
            if (type !== 'notify') return;

            for (const msg of messages) {
                // Skip status messages
                if (msg.key.remoteJid === 'status@broadcast') continue;

                // Skip messages from self if it's a reaction/edit
                if (msg.message?.protocolMessage) continue;

                const messageData = {
                    deviceId,
                    messageId: msg.key.id,
                    from: msg.key.remoteJid,
                    fromMe: msg.key.fromMe,
                    pushName: msg.pushName,
                    timestamp: msg.messageTimestamp,
                    message: this.extractMessageContent(msg.message),
                    type: this.getMessageType(msg.message),
                    rawMessage: msg
                };


                // Trigger Auto Reply (only for incoming messages)
                /* Duplicate logic removed - handled by index.js callbacks
                if (!messageData.fromMe) {
                    this.autoReplyService.processMessage(messageData).catch(err => {
                        console.error(`[WA:${deviceId}] AutoReply error:`, err);
                    });
                }
                */

                if (this.io) {
                    this.io.to(`device:${deviceId}`).emit('message', messageData);
                }

                console.log(`[WA:${deviceId}] Message received from ${messageData.from}`);

                if (callbacks.onMessage) {
                    callbacks.onMessage(messageData);
                }
            }
        });

        // Handle message status update (sent, delivered, read)
        socket.ev.on('messages.update', (updates) => {
            for (const update of updates) {
                if (this.io) {
                    this.io.to(`device:${deviceId}`).emit('message.update', {
                        deviceId,
                        messageId: update.key.id,
                        status: update.update.status
                    });
                }

                if (callbacks.onMessageUpdate) {
                    callbacks.onMessageUpdate(update);
                }
            }
        });

        return socket;
    }

    /**
     * Extract text content dari message
     * Supports: text, extended text, media captions, and interactive responses
     */
    extractMessageContent(message) {
        if (!message) return null;

        // Text message
        if (message.conversation) {
            return message.conversation;
        }

        // Extended text message
        if (message.extendedTextMessage?.text) {
            return message.extendedTextMessage.text;
        }

        // Image with caption
        if (message.imageMessage?.caption) {
            return message.imageMessage.caption;
        }

        // Video with caption
        if (message.videoMessage?.caption) {
            return message.videoMessage.caption;
        }

        // Document with caption
        if (message.documentMessage?.caption) {
            return message.documentMessage.caption;
        }

        // ==================== INTERACTIVE MESSAGES ====================

        // Button response (when user clicks a button)
        if (message.buttonsResponseMessage?.selectedButtonId) {
            return message.buttonsResponseMessage.selectedButtonId;
        }

        // Also check for button display text
        if (message.buttonsResponseMessage?.selectedDisplayText) {
            return message.buttonsResponseMessage.selectedDisplayText;
        }

        // List response (when user selects from a list)
        if (message.listResponseMessage?.singleSelectReply?.selectedRowId) {
            return message.listResponseMessage.singleSelectReply.selectedRowId;
        }

        // Also check for list title
        if (message.listResponseMessage?.title) {
            return message.listResponseMessage.title;
        }

        // Template button reply
        if (message.templateButtonReplyMessage?.selectedId) {
            return message.templateButtonReplyMessage.selectedId;
        }

        // Template button display text
        if (message.templateButtonReplyMessage?.selectedDisplayText) {
            return message.templateButtonReplyMessage.selectedDisplayText;
        }

        // Interactive response (for newer WhatsApp Business flows)
        if (message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
            try {
                const params = JSON.parse(message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
                return params.id || params.title || null;
            } catch (e) {
                console.warn('[WA] Failed to parse interactive response:', e.message);
                return null;
            }
        }

        // Interactive response body
        if (message.interactiveResponseMessage?.body?.text) {
            return message.interactiveResponseMessage.body.text;
        }

        // ===============================================================

        return null;
    }

    /**
     * Get message type
     */
    getMessageType(message) {
        if (!message) return 'unknown';

        if (message.conversation || message.extendedTextMessage) return 'text';
        if (message.imageMessage) return 'image';
        if (message.videoMessage) return 'video';
        if (message.audioMessage) return 'audio';
        if (message.documentMessage) return 'document';
        if (message.stickerMessage) return 'sticker';
        if (message.contactMessage) return 'contact';
        if (message.locationMessage) return 'location';

        return 'unknown';
    }

    /**
     * Send text message
     */
    async sendMessage(deviceId, to, text) {
        console.log(`[WA] sendMessage called - deviceId: ${deviceId}, to: ${to}, text length: ${text?.length}`);

        await this.ensureLoaded();
        const prisma = require('../utils/prisma');
        const { PLAN_LIMITS } = require('./planLimitsService');

        // Check session status first
        const sessionStatus = this.getSessionStatus(deviceId);
        console.log(`[WA] Session status for ${deviceId}:`, sessionStatus.status);

        if (sessionStatus.status !== 'connected') {
            console.error(`[WA] Device ${deviceId} is not connected (status: ${sessionStatus.status}). Need QR scan.`);
            throw new Error(`Device is not connected (${sessionStatus.status}). Please scan QR code to reconnect.`);
        }

        const socket = sessions.get(deviceId);
        if (!socket) {
            console.error(`[WA] No socket found for device ${deviceId}`);
            throw new Error('Device not connected');
        }

        // Format nomor (tambah @s.whatsapp.net jika belum ada)
        const jid = this.formatJid(to);
        console.log(`[WA] Formatted JID: ${jid}`);

        // --- Watermark Logic (Centralized) ---
        let finalMessage = text;
        const watermarkConfig = await this.getWatermarkConfig(deviceId);
        if (watermarkConfig.shouldAddWatermark) {
            finalMessage = `${text}\n\n_${watermarkConfig.watermarkText}_`;
        }
        // -----------------------

        try {
            // Subscribe to presence and send typing indicator to "wake up" the session
            // This helps prevent silent message failures due to stale session
            try {
                await socket.presenceSubscribe(jid);
                await socket.sendPresenceUpdate('composing', jid);
                // Small delay to let presence propagate
                await new Promise(resolve => setTimeout(resolve, 500));
                await socket.sendPresenceUpdate('paused', jid);
            } catch (presenceErr) {
                console.warn(`[WA] Presence update warning (non-fatal): ${presenceErr.message}`);
            }

            console.log(`[WA] Calling socket.sendMessage to ${jid}...`);
            const result = await socket.sendMessage(jid, { text: finalMessage });

            if (!result || !result.key || !result.key.id) {
                console.error(`[WA] sendMessage returned invalid result:`, result);
                throw new Error('Message send failed - invalid response from WhatsApp');
            }

            console.log(`[WA] sendMessage SUCCESS - messageId: ${result.key.id}`);

            return {
                messageId: result.key.id,
                to: jid,
                status: 'sent',
                timestamp: new Date().toISOString()
            };
        } catch (sendError) {
            console.error(`[WA] sendMessage FAILED for ${jid}:`, sendError.message);
            throw sendError;
        }
    }

    /**
     * Send image message
     */
    async sendImage(deviceId, to, imageUrl, caption = '') {
        await this.ensureLoaded();

        // Block media in proxy mode
        if (isMediaBlocked()) {
            throw new Error('Media sending is disabled in proxy mode. Only text messages are allowed.');
        }

        const socket = sessions.get(deviceId);
        if (!socket) {
            throw new Error('Device not connected');
        }

        const jid = this.formatJid(to);

        // --- Watermark Logic (Centralized) ---
        let finalCaption = caption;
        const watermarkConfig = await this.getWatermarkConfig(deviceId);
        if (watermarkConfig.shouldAddWatermark) {
            finalCaption = caption ? `${caption}\n\n*${watermarkConfig.watermarkText}*` : `*${watermarkConfig.watermarkText}*`;
        }
        // -----------------------

        const result = await socket.sendMessage(jid, {
            image: { url: imageUrl },
            caption: finalCaption
        });

        return {
            messageId: result.key.id,
            to: jid,
            status: 'sent',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Send document
     */
    async sendDocument(deviceId, to, documentUrl, filename, caption = '') {
        await this.ensureLoaded();

        // Block media in proxy mode
        if (isMediaBlocked()) {
            throw new Error('Media sending is disabled in proxy mode. Only text messages are allowed.');
        }

        const socket = sessions.get(deviceId);
        if (!socket) {
            throw new Error('Device not connected');
        }

        const jid = this.formatJid(to);

        // --- Watermark Logic (Centralized) ---
        let finalCaption = caption;
        const watermarkConfig = await this.getWatermarkConfig(deviceId);
        if (watermarkConfig.shouldAddWatermark) {
            finalCaption = caption ? `${caption}\n\n*${watermarkConfig.watermarkText}*` : `*${watermarkConfig.watermarkText}*`;
        }
        // -----------------------

        const result = await socket.sendMessage(jid, {
            document: { url: documentUrl },
            fileName: filename,
            caption: finalCaption
        });

        return {
            messageId: result.key.id,
            to: jid,
            status: 'sent',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Send video message
     */
    async sendVideo(deviceId, to, videoUrl, caption = '') {
        await this.ensureLoaded();

        // Block media in proxy mode
        if (isMediaBlocked()) {
            throw new Error('Media sending is disabled in proxy mode. Only text messages are allowed.');
        }

        const socket = sessions.get(deviceId);
        if (!socket) {
            throw new Error('Device not connected');
        }

        const jid = this.formatJid(to);

        // --- Watermark Logic (Centralized) ---
        let finalCaption = caption;
        const watermarkConfig = await this.getWatermarkConfig(deviceId);
        if (watermarkConfig.shouldAddWatermark) {
            finalCaption = caption ? `${caption}\n\n*${watermarkConfig.watermarkText}*` : `*${watermarkConfig.watermarkText}*`;
        }
        // -----------------------

        const result = await socket.sendMessage(jid, {
            video: { url: videoUrl },
            caption: finalCaption
        });

        return {
            messageId: result.key.id,
            to: jid,
            status: 'sent',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Send audio message
     */
    async sendAudio(deviceId, to, audioUrl, ptt = false) {
        await this.ensureLoaded();

        // Block media in proxy mode
        if (isMediaBlocked()) {
            throw new Error('Media sending is disabled in proxy mode. Only text messages are allowed.');
        }

        const socket = sessions.get(deviceId);
        if (!socket) {
            throw new Error('Device not connected');
        }

        const jid = this.formatJid(to);

        // Note: Audio doesn't support caption in WhatsApp
        const result = await socket.sendMessage(jid, {
            audio: { url: audioUrl },
            ptt: ptt // ptt = push to talk (voice note style)
        });

        return {
            messageId: result.key.id,
            to: jid,
            status: 'sent',
            timestamp: new Date().toISOString()
        };
    }

    async sendList(deviceId, to, listOptions) {
        await this.ensureLoaded();
        const socket = sessions.get(deviceId);
        if (!socket) throw new Error('Device not connected');
        const jid = this.formatJid(to);

        // --- Watermark Logic (Centralized) ---
        let footerText = listOptions.footer || '';
        const watermarkConfig = await this.getWatermarkConfig(deviceId);
        if (watermarkConfig.shouldAddWatermark) {
            footerText = footerText ? `${footerText} | ${watermarkConfig.watermarkFooter}` : watermarkConfig.watermarkFooter;
        }
        // -----------------------

        const result = await socket.sendMessage(jid, {
            title: listOptions.title,
            text: listOptions.text,
            footer: footerText,
            buttonText: listOptions.buttonText,
            sections: listOptions.sections
        });
        return { messageId: result.key.id, to: jid, status: 'sent', timestamp: new Date().toISOString() };
    }

    async sendButtons(deviceId, to, buttonOptions) {
        await this.ensureLoaded();
        const socket = sessions.get(deviceId);
        if (!socket) throw new Error('Device not connected');
        const jid = this.formatJid(to);

        // --- Watermark Logic (Centralized) ---
        let footerText = buttonOptions.footer || '';
        const watermarkConfig = await this.getWatermarkConfig(deviceId);
        if (watermarkConfig.shouldAddWatermark) {
            footerText = footerText ? `${footerText} | ${watermarkConfig.watermarkFooter}` : watermarkConfig.watermarkFooter;
        }
        // -----------------------

        const result = await socket.sendMessage(jid, {
            text: buttonOptions.text,
            footer: footerText,
            buttons: buttonOptions.buttons,
            headerType: 1
        });
        return { messageId: result.key.id, to: jid, status: 'sent', timestamp: new Date().toISOString() };
    }

    /**
     * Format nomor telepon ke JID WhatsApp
     */
    formatJid(number) {
        if (!number) return '';

        const strNumber = number.toString().trim();

        // If it looks like a full JID, return it as is
        // Include @lid (Linked ID) which is WhatsApp's new privacy format
        if (strNumber.includes('@s.whatsapp.net') || strNumber.includes('@g.us') || strNumber.includes('@lid') || strNumber.includes('@newsletter')) {
            return strNumber;
        }

        // WhatsApp Group IDs often have a '-' or are long numerical strings
        // If it has a '-' and no '@', assume it's a group ID
        if (strNumber.includes('-') && !strNumber.includes('@')) {
            return strNumber + '@g.us';
        }

        // Hapus karakter non-digit
        let cleaned = strNumber.replace(/\D/g, '');

        // Hapus leading 0 dan ganti dengan 62 (Indonesia)
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        }

        // Tambah @s.whatsapp.net
        return cleaned + '@s.whatsapp.net';
    }

    /**
     * Check if number is on WhatsApp
     */
    async isOnWhatsApp(deviceId, number) {
        await this.ensureLoaded();

        const socket = sessions.get(deviceId);
        if (!socket) {
            throw new Error('Device not connected');
        }

        const jid = this.formatJid(number);
        const [result] = await socket.onWhatsApp(jid.replace('@s.whatsapp.net', ''));

        return result?.exists || false;
    }

    /**
     * Close session (keep session files)
     */
    async closeSession(deviceId) {
        const socket = sessions.get(deviceId);
        if (socket) {
            try {
                socket.ev.removeAllListeners();
                await socket.end();
            } catch (e) {
                // Ignore cleanup errors
            }
            sessions.delete(deviceId);
            // Note: sessionStores removed - no longer needed
        }
    }

    /**
     * Logout and delete session files
     */
    async deleteSession(deviceId) {
        const socket = sessions.get(deviceId);
        if (socket) {
            try {
                await socket.logout();
            } catch (e) {
                // Ignore if already logged out
            }
            try {
                socket.ev.removeAllListeners();
                await socket.end();
            } catch (e) {
                // Ignore cleanup errors
            }
            sessions.delete(deviceId);
            // Note: sessionStores removed - no longer needed
        }

        // Delete session files
        const sessionPath = this.getSessionPath(deviceId);
        if (fs.existsSync(sessionPath)) {
            try {
                fs.rmSync(sessionPath, { recursive: true, force: true });
            } catch (err) {
                console.error(`[WA] Failed to delete session files for ${deviceId}:`, err.message);
                // Continue anyway to allow DB deletion
            }
        }

        this.qrCodes.delete(deviceId);
    }

    /**
     * Restart session
     */
    async restartSession(deviceId, callbacks = {}) {
        await this.closeSession(deviceId);
        await delay(2000);
        return await this.createSession(deviceId, callbacks);
    }

    /**
     * Get session status
     */
    getSessionStatus(deviceId) {
        const socket = sessions.get(deviceId);
        if (!socket) {
            // console.log(`[WA:${deviceId}] Status check: Socket not found in sessions map.`);
            return { status: 'disconnected', user: null };
        }

        const user = socket.user || socket.authState?.creds?.me;

        // Check explicit closing
        if (socket.ws?.readyState === 3) { // CLOSED
            console.log(`[WA:${deviceId}] Status check: Socket WS is CLOSED (readyState 3).`);
            return { status: 'disconnected', user: null };
        }

        const status = (user && !socket.ws?.isClosed) ? 'connected' : 'connecting';

        if (status === 'connecting') {
            console.log(`[WA:${deviceId}] Status check: Connecting... User present? ${!!user}, WS Closed? ${socket.ws?.isClosed}`);
        }

        return {
            status,
            user: user ? {
                id: user.id,
                name: user.name,
                phone: user.id?.split(':')[0] || user.id?.split('@')[0]
            } : null
        };
    }

    /**
     * Load semua existing sessions saat startup
     */
    async loadExistingSessions() {
        await this.ensureLoaded();
        const prisma = require('../utils/prisma');

        if (!fs.existsSync(SESSIONS_DIR)) return;

        const sessionFolders = fs.readdirSync(SESSIONS_DIR)
            .filter(f => f.startsWith('session_'));

        console.log(`[WA] Found ${sessionFolders.length} session folder(s) on disk`);

        // Get all device IDs from database
        const dbDevices = await prisma.device.findMany({
            select: { id: true }
        });
        const dbDeviceIds = new Set(dbDevices.map(d => d.id));
        console.log(`[WA] Found ${dbDeviceIds.size} device(s) in database`);

        let loadedCount = 0;
        let skippedCount = 0;

        for (const folder of sessionFolders) {
            const deviceId = folder.replace('session_', '');

            // Skip session if device doesn't exist in database
            if (!dbDeviceIds.has(deviceId)) {
                console.log(`[WA] Skipping orphaned session: ${deviceId} (not in database)`);
                skippedCount++;
                continue;
            }

            try {
                console.log(`[WA] Loading session for device: ${deviceId}`);
                await this.createSession(deviceId);
                loadedCount++;
            } catch (err) {
                console.error(`[WA] Failed to load session ${deviceId}:`, err.message);
            }
        }

        console.log(`[WA] Session loading complete: ${loadedCount} loaded, ${skippedCount} skipped`);
    }
}

module.exports = WhatsAppService;
