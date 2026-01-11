const prisma = require('../utils/prisma');
const axios = require('axios');
const crypto = require('crypto');

/**
 * Webhook Service
 */
class WebhookService {
    constructor() {
        // Queue could be added here
    }

    /**
     * Trigger webhook for specific event
     * @param {string} eventName - e.g., 'message.received' 
     * @param {Object} payload 
     * @param {string} userId - Optional: only trigger webhooks for this user (multi-tenant)
     */
    async trigger(eventName, payload, userId = null) {
        try {
            // Build where condition
            const where = {
                status: 'active',
                events: { contains: eventName } // Simple string check, more robust JSON check ideally
            };

            // Multi-tenant: if userId provided, only get webhooks for that user
            if (userId) {
                where.userId = userId;
            }

            // Find webhooks subscribed to this event
            const webhooks = await prisma.webhook.findMany({ where });

            // Filter robustly because `contains: 'message.sent'` hits 'message.sent_failed' too potentially?
            // Actually our events are distinct strings in JSON array in DB string field.
            // But 'contains' in Prisma SQLite maps to LIKE %query%.
            // So we double check in JS.

            const matchedWebhooks = webhooks.filter(w => {
                try {
                    const events = JSON.parse(w.events);
                    return events.includes(eventName);
                } catch (e) {
                    return false;
                }
            });

            if (matchedWebhooks.length === 0) return;

            console.log(`[Webhook] Triggering ${eventName} for ${matchedWebhooks.length} hooks${userId ? ` (user: ${userId})` : ''}`);

            // Execute in parallel (fire and forget mostly, but we log)
            matchedWebhooks.forEach(webhook => this.sendWebhook(webhook, eventName, payload));

        } catch (error) {
            console.error('[Webhook] Error finding webhooks:', error);
        }
    }

    /**
     * Send single webhook
     */
    async sendWebhook(webhook, event, data) {
        const payloadData = {
            id: crypto.randomUUID(),
            event,
            timestamp: new Date().toISOString(),
            data
        };
        const payloadString = JSON.stringify(payloadData);

        // Calculate Signature
        const signature = crypto
            .createHmac('sha256', webhook.secret)
            .update(payloadString)
            .digest('hex');

        const startTime = Date.now();
        let responseCode = 0;
        let responseBody = '';
        let status = 'failed';

        try {
            const response = await axios.post(webhook.url, payloadData, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-KeWhats-Signature': `sha256=${signature}`,
                    'User-Agent': 'KeWhats-Webhook/1.0'
                },
                timeout: 10000 // 10s timeout
            });

            responseCode = response.status;
            // Axios automatically parses JSON response data
            responseBody = typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data);

            if (responseCode >= 200 && responseCode < 300) {
                status = 'success';
            }
        } catch (err) {
            if (err.response) {
                responseCode = err.response.status;
                responseBody = typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : String(err.response.data);
            } else {
                responseBody = err.message || 'Network Error';
            }
        }

        const duration = Date.now() - startTime;

        // Log result
        try {
            await prisma.webhookLog.create({
                data: {
                    webhookId: webhook.id,
                    event,
                    payload: payloadString,
                    responseCode,
                    responseBody: responseBody.substring(0, 1000), // Truncate
                    duration,
                    status
                }
            });

            // Update last called
            await prisma.webhook.update({
                where: { id: webhook.id },
                data: { lastCalled: new Date() }
            });

        } catch (logErr) {
            console.error('[Webhook] Failed to log execution:', logErr);
        }
    }
}

module.exports = new WebhookService();
