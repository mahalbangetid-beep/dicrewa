const prisma = require('../utils/prisma');
const spreadsheetService = require('./spreadsheet');
const knowledgeService = require('./knowledgeService');
const quotaService = require('./quotaService');

/**
 * Auto Reply Service Logic
 */
class AutoReplyService {
    constructor(whatsappService) {
        this.whatsapp = whatsappService;
        this.processedMessages = new Set(); // In-memory cache for fast lookup
        this.sheetCache = new Map(); // Cache for spreadsheet rules { deviceId: { rules: [], expiry: timestamp } }
        this.DEDUP_TTL_HOURS = 24; // Keep processed message records for 24 hours
    }

    /**
     * Check if message was already processed (with database persistence)
     * @param {string} msgKey 
     * @returns {Promise<boolean>}
     */
    async isMessageProcessed(msgKey) {
        // Fast path: check in-memory cache first
        if (this.processedMessages.has(msgKey)) {
            return true;
        }

        // Slow path: check database
        try {
            const existing = await prisma.processedAutoReply.findUnique({
                where: { messageKey: msgKey }
            });
            if (existing) {
                // Add to in-memory cache for future fast lookups
                this.processedMessages.add(msgKey);
                return true;
            }
        } catch (error) {
            // Table might not exist yet, ignore
            console.error('[AutoReply] DB check error:', error.message);
        }

        return false;
    }

    /**
     * Mark message as processed (persist to database)
     * @param {string} msgKey 
     */
    async markMessageProcessed(msgKey) {
        // Add to in-memory cache
        this.processedMessages.add(msgKey);

        // Cleanup in-memory cache if too large
        if (this.processedMessages.size > 5000) {
            // Keep only last 2500 items
            const arr = Array.from(this.processedMessages);
            this.processedMessages = new Set(arr.slice(-2500));
        }

        // Persist to database
        try {
            await prisma.processedAutoReply.create({
                data: {
                    messageKey: msgKey,
                    processedAt: new Date()
                }
            });
        } catch (error) {
            // Ignore duplicate key errors
            if (!error.message.includes('Unique constraint')) {
                console.error('[AutoReply] DB save error:', error.message);
            }
        }
    }

    /**
     * Cleanup old processed message records (call periodically)
     */
    async cleanupOldRecords() {
        try {
            const cutoff = new Date(Date.now() - (this.DEDUP_TTL_HOURS * 60 * 60 * 1000));
            const result = await prisma.processedAutoReply.deleteMany({
                where: {
                    processedAt: { lt: cutoff }
                }
            });
            if (result.count > 0) {
                console.log(`[AutoReply] Cleaned up ${result.count} old processed message records`);
            }
        } catch (error) {
            console.error('[AutoReply] Cleanup error:', error.message);
        }
    }

    /**
     * Process incoming message for auto-reply matching
     * @param {Object} messageData 
     */
    async processMessage(messageData) {
        try {
            // Hanya proses pesan text
            if (messageData.type !== 'text') return;

            // Check duplicate processing - now includes 'from' for better uniqueness
            const msgKey = `${messageData.deviceId}:${messageData.from}:${messageData.messageId}`;

            if (await this.isMessageProcessed(msgKey)) {
                console.log(`[AutoReply] Duplicate message skipped: ${msgKey}`);
                return;
            }

            // Mark as processed immediately to prevent race conditions
            await this.markMessageProcessed(msgKey);

            // 1a. Get device to find the owner's userId (for multi-tenant isolation)
            const device = await prisma.device.findUnique({
                where: { id: messageData.deviceId },
                select: { spreadsheetUrl: true, userId: true }
            });

            if (!device) {
                console.log(`[AutoReply] Device not found: ${messageData.deviceId}`);
                return;
            }

            // 1b. Ambil semua rule aktif dari Database (include knowledgeBase for RAG)
            // Multi-tenant: only get rules belonging to the device owner
            const dbRules = await prisma.autoReplyRule.findMany({
                where: {
                    userId: device.userId, // Multi-tenant: filter by device owner
                    isActive: true,
                    OR: [
                        { deviceId: null }, // Global rule (for this user)
                        { deviceId: messageData.deviceId } // Device specific rule
                    ]
                },
                include: {
                    knowledgeBase: {
                        select: { id: true, status: true, userId: true }
                    }
                },
                orderBy: {
                    priority: 'asc'
                }
            });

            // 1c. Ambil rule dari Spreadsheet jika ada
            let sheetRules = [];

            if (device?.spreadsheetUrl) {
                const now = Date.now();
                const cached = this.sheetCache.get(messageData.deviceId);

                if (cached && cached.expiry > now) {
                    sheetRules = cached.rules;
                } else {
                    try {
                        sheetRules = await spreadsheetService.fetchRules(device.spreadsheetUrl);
                        this.sheetCache.set(messageData.deviceId, {
                            rules: sheetRules,
                            expiry: now + (1000 * 60 * 5) // Cache for 5 minutes
                        });
                    } catch (err) {
                        console.error(`[AutoReply] Failed to fetch sheet rules for ${messageData.deviceId}:`, err.message);
                        // Fallback to cache if exists even if expired, or just empty
                        sheetRules = cached?.rules || [];
                    }
                }
            }

            const rules = [...dbRules, ...sheetRules];

            if (rules.length === 0) {
                return;
            }

            const text = messageData.message?.toLowerCase().trim();
            if (!text) return;

            console.log(`[AutoReply] Processing '${text}' from ${messageData.from} on ${messageData.deviceId}. Rules found: ${rules.length}`);

            let matchedRule = null;

            // 2. Matching Logic
            for (const rule of rules) {
                if (this.isMatch(text, rule)) {
                    matchedRule = rule;
                    break; // Ambil first match saja berdasarkan prioritas
                }
            }

            if (matchedRule) {
                console.log(`[AutoReply] Match rule '${matchedRule.name}' for message '${text}'`);

                // Check quota before sending (get userId from device)
                if (device?.userId) {
                    const messagesCount = matchedRule.mediaUrl ? 2 : 1; // text + media = 2 messages
                    const quotaCheck = await quotaService.checkAndIncrement(device.userId, messagesCount);

                    if (!quotaCheck.allowed) {
                        console.log(`[AutoReply] Quota exceeded for user ${device.userId}, skipping auto-reply`);
                        return;
                    }
                }

                // 3. Process Variables Substitution
                let responseText = matchedRule.response;
                responseText = responseText.replace(/{name}/g, messageData.pushName || 'Kak');
                responseText = responseText.replace(/{phone}/g, messageData.from.split('@')[0]);

                // 4. Send Reply
                try {
                    await this.whatsapp.sendMessage(messageData.deviceId, messageData.from, responseText);

                    // Send Media if exists
                    if (matchedRule.mediaUrl) {
                        try {
                            // Simple content type check by extension
                            const isImage = /\.(jpeg|jpg|png|gif)$/i.test(matchedRule.mediaUrl);
                            if (isImage) {
                                await this.whatsapp.sendImage(messageData.deviceId, messageData.from, matchedRule.mediaUrl);
                            } else {
                                const filename = matchedRule.mediaUrl.split('/').pop() || 'file';
                                await this.whatsapp.sendDocument(messageData.deviceId, messageData.from, matchedRule.mediaUrl, filename);
                            }
                        } catch (mediaErr) {
                            console.error('[AutoReply] Failed to send media:', mediaErr.message);
                        }
                    }

                    // 5. Update Stat (Only for DB rules)
                    if (matchedRule.id) {
                        await prisma.autoReplyRule.update({
                            where: { id: matchedRule.id },
                            data: { triggerCount: { increment: 1 } }
                        });
                    }

                } catch (sendErr) {
                    console.error('[AutoReply] Failed to send reply:', sendErr.message);
                }
            } else {
                // No matched rule found - check for RAG fallback
                await this.handleRagFallback(messageData, text, dbRules, device);
            }

        } catch (error) {
            console.error('[AutoReply] Error processing message:', error);
        }
    }

    /**
     * Handle RAG fallback when no regular rule matches
     */
    async handleRagFallback(messageData, text, rules, device) {
        // Find any rule that has RAG fallback enabled
        const ragRule = rules.find(r =>
            r.useRagFallback &&
            r.knowledgeBaseId &&
            r.knowledgeBase?.status === 'ready'
        );

        if (!ragRule) return;

        console.log(`[AutoReply] No rule matched, trying RAG fallback with knowledge base: ${ragRule.knowledgeBaseId}`);

        try {
            const userId = ragRule.knowledgeBase.userId;
            const queryResult = await knowledgeService.queryKnowledge(
                userId,
                text, // Use original message text
                ragRule.knowledgeBaseId
            );

            if (queryResult.answer && queryResult.confidence >= 50) {
                // RAG found an answer with decent confidence
                console.log(`[AutoReply] RAG answer found with ${queryResult.confidence}% confidence`);

                // Check quota before sending
                if (device?.userId) {
                    const quotaCheck = await quotaService.checkAndIncrement(device.userId, 1);
                    if (!quotaCheck.allowed) {
                        console.log(`[AutoReply] Quota exceeded for user ${device.userId}, skipping RAG response`);
                        return;
                    }
                }

                let responseText = queryResult.answer;
                responseText = responseText.replace(/{name}/g, messageData.pushName || 'Kak');

                await this.whatsapp.sendMessage(messageData.deviceId, messageData.from, responseText);

                // Update stat
                if (ragRule.id) {
                    await prisma.autoReplyRule.update({
                        where: { id: ragRule.id },
                        data: { triggerCount: { increment: 1 } }
                    });
                }
            } else if (ragRule.ragFallbackMessage) {
                // RAG couldn't find answer, use fallback message
                console.log(`[AutoReply] RAG no answer, using fallback message`);

                // Check quota before sending
                if (device?.userId) {
                    const quotaCheck = await quotaService.checkAndIncrement(device.userId, 1);
                    if (!quotaCheck.allowed) {
                        console.log(`[AutoReply] Quota exceeded for user ${device.userId}, skipping fallback`);
                        return;
                    }
                }

                let fallbackText = ragRule.ragFallbackMessage;
                fallbackText = fallbackText.replace(/{name}/g, messageData.pushName || 'Kak');
                fallbackText = fallbackText.replace(/{phone}/g, messageData.from.split('@')[0]);

                await this.whatsapp.sendMessage(messageData.deviceId, messageData.from, fallbackText);
            }
        } catch (error) {
            console.error('[AutoReply] RAG fallback error:', error.message);

            // If RAG fails and there's a fallback message, send it
            if (ragRule.ragFallbackMessage) {
                try {
                    // Check quota before sending error fallback
                    if (device?.userId) {
                        const quotaCheck = await quotaService.checkAndIncrement(device.userId, 1);
                        if (!quotaCheck.allowed) {
                            console.log(`[AutoReply] Quota exceeded for user ${device.userId}, skipping error fallback`);
                            return;
                        }
                    }

                    await this.whatsapp.sendMessage(
                        messageData.deviceId,
                        messageData.from,
                        ragRule.ragFallbackMessage
                    );
                } catch (sendErr) {
                    console.error('[AutoReply] Failed to send fallback:', sendErr.message);
                }
            }
        }
    }

    isMatch(text, rule) {
        // Trigger bisa multiple pisah koma: "halo, hi, tes"
        const triggers = rule.trigger.toLowerCase().split(',').map(t => t.trim()).filter(t => t);

        for (const trigger of triggers) {
            switch (rule.triggerType) {
                case 'exact':
                    if (text === trigger) return true;
                    break;
                case 'contains':
                    if (text.includes(trigger)) return true;
                    break;
                case 'startswith':
                    if (text.startsWith(trigger)) return true;
                    break;
                case 'regex':
                    try {
                        const regex = new RegExp(trigger, 'i');
                        if (regex.test(text)) return true;
                    } catch (e) {
                        console.warn(`[AutoReply] Invalid regex rule ${rule.id}:`, e.message);
                    }
                    break;
            }
        }
        return false;
    }
}

module.exports = AutoReplyService;
