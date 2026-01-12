const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { protect } = require('../middleware/auth');
const axios = require('axios'); // Needed for test
const encryption = require('../utils/encryption');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

// Apply auth middleware
router.use(protect);

const validEvents = [
    'message.received',
    'message.sent',
    'message.delivered',
    'message.read',
    'message.failed',
    'contact.new',
    'device.connected',
    'device.disconnected'
];

// GET /api/webhooks
router.get('/', async (req, res, next) => {
    try {
        const { page, limit, skip } = parsePagination(req.query);

        // Multi-tenant: filter webhooks by userId
        const where = { userId: req.user.id };

        const [webhooks, total] = await Promise.all([
            prisma.webhook.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.webhook.count({ where })
        ]);

        // Hide secrets
        const safeWebhooks = webhooks.map(w => ({
            ...w,
            secret: w.secret ? `${w.secret.substring(0, 5)}...` : '***'
        }));

        paginatedResponse(res, safeWebhooks, { page, limit, total });
    } catch (error) {
        next(error);
    }
});

// GET /api/webhooks/:id
router.get('/:id', async (req, res, next) => {
    try {
        // Multi-tenant: ensure webhook belongs to user
        const webhook = await prisma.webhook.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });
        if (!webhook) return errorResponse(res, 'Webhook not found', 404);

        // Mask secret
        webhook.secret = webhook.secret ? `${webhook.secret.substring(0, 5)}...` : '***';

        successResponse(res, webhook);
    } catch (error) {
        next(error);
    }
});

// POST /api/webhooks
router.post('/', async (req, res, next) => {
    try {
        const { name, url, events, secret } = req.body;

        if (!name || !url || !events) {
            return errorResponse(res, 'name, url, and events are required', 400);
        }

        // Validate events (events is JSON string or array?)
        // Schema says `String` // JSON array of events
        // So we expect array in body, convert to string for DB
        let eventList = events;
        if (typeof events === 'string') {
            try {
                eventList = JSON.parse(events);
            } catch (e) {
                return errorResponse(res, 'events must be a valid JSON array or array', 400);
            }
        }

        if (!Array.isArray(eventList)) {
            return errorResponse(res, 'events must be an array', 400);
        }

        const invalidEvents = eventList.filter(e => !validEvents.includes(e));
        if (invalidEvents.length > 0) {
            return errorResponse(res, `Invalid events: ${invalidEvents.join(', ')}`, 400);
        }

        // Validate secret if provided (minimum 16 characters for security)
        if (secret && secret.length < 16) {
            return errorResponse(res, 'Secret must be at least 16 characters for security', 400);
        }

        // Generate cryptographically secure secret if not provided
        const webhookSecret = secret || `whsec_${crypto.randomBytes(24).toString('hex')}`;

        // Encrypt secret before storing (security best practice)
        const encryptedSecret = encryption.encrypt(webhookSecret);

        const newWebhook = await prisma.webhook.create({
            data: {
                userId: req.user.id, // Multi-tenant: assign to current user
                name,
                url,
                events: JSON.stringify(eventList),
                secret: encryptedSecret,
                status: 'active'
            }
        });

        // Return response with masked secret (don't expose full secret after creation)
        const responseWebhook = {
            ...newWebhook,
            secret: encryption.getMaskedValue(encryptedSecret, 'whsec_...', 8)
        };

        successResponse(res, responseWebhook, 'Webhook created', 201);
    } catch (error) {
        next(error);
    }
});

// PUT /api/webhooks/:id
router.put('/:id', async (req, res, next) => {
    try {
        const { name, url, events, status, secret } = req.body;

        // Multi-tenant: ensure webhook belongs to user
        const webhook = await prisma.webhook.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });
        if (!webhook) return errorResponse(res, 'Webhook not found', 404);

        let eventsString = webhook.events;
        if (events) {
            let eventList = events;
            if (typeof events === 'string') {
                try { eventList = JSON.parse(events); } catch (e) { }
            }
            if (!Array.isArray(eventList)) return errorResponse(res, 'events must be array', 400);

            const invalidEvents = eventList.filter(e => !validEvents.includes(e));
            if (invalidEvents.length > 0) return errorResponse(res, `Invalid events: ${invalidEvents.join(', ')}`, 400);

            eventsString = JSON.stringify(eventList);
        }

        // Validate secret if provided (minimum 16 characters for security)
        if (secret && secret.length < 16) {
            return errorResponse(res, 'Secret must be at least 16 characters for security', 400);
        }

        // Encrypt secret if provided
        const encryptedSecret = secret ? encryption.encrypt(secret) : undefined;

        const updated = await prisma.webhook.update({
            where: { id: req.params.id },
            data: {
                name,
                url,
                events: eventsString,
                status,
                ...(encryptedSecret && { secret: encryptedSecret })
            }
        });

        // Mask secret in response
        const responseWebhook = {
            ...updated,
            secret: encryption.getMaskedValue(updated.secret, 'whsec_...', 8)
        };

        successResponse(res, responseWebhook, 'Webhook updated');
    } catch (error) {
        next(error);
    }
});

// DELETE /api/webhooks/:id
router.delete('/:id', async (req, res, next) => {
    try {
        // Multi-tenant: ensure webhook belongs to user
        const webhook = await prisma.webhook.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });
        if (!webhook) return errorResponse(res, 'Webhook not found', 404);

        await prisma.webhook.delete({ where: { id: req.params.id } });
        successResponse(res, { id: req.params.id }, 'Webhook deleted');
    } catch (error) {
        next(error);
    }
});

// POST /api/webhooks/:id/test
router.post('/:id/test', async (req, res, next) => {
    try {
        // Multi-tenant: ensure webhook belongs to user
        const webhook = await prisma.webhook.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });
        if (!webhook) return errorResponse(res, 'Webhook not found', 404);

        // SSRF Protection: Validate URL before making request
        const spreadsheetService = require('../services/spreadsheet');
        if (!spreadsheetService.isValidExternalUrl(webhook.url)) {
            return errorResponse(res, 'Webhook URL is blocked for security reasons (internal/private addresses not allowed)', 403);
        }

        const payload = {
            event: 'ping',
            timestamp: new Date().toISOString(),
            data: { message: 'This is a test event from KeWhats' }
        };

        const startTime = Date.now();
        let responseCode = 0;
        let responseBody = '';
        let status = 'failed';

        try {
            const response = await axios.post(webhook.url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-KeWhats-Signature': 'sha256=test_signature', // mocked signature
                    'User-Agent': 'KeWhats-Webhook/1.0'
                },
                timeout: 5000
            });
            responseCode = response.status;
            responseBody = JSON.stringify(response.data);
            status = 'success';
        } catch (err) {
            responseCode = err.response?.status || 0;
            responseBody = err.message;
        }

        const duration = Date.now() - startTime;

        // Log the attempt
        await prisma.webhookLog.create({
            data: {
                webhookId: webhook.id,
                event: 'ping',
                payload: JSON.stringify(payload),
                responseCode,
                responseBody: typeof responseBody === 'string' ? responseBody.substring(0, 1000) : 'Invalid Body',
                duration,
                status
            }
        });

        successResponse(res, {
            success: status === 'success',
            responseCode,
            duration: `${duration}ms`
        }, `Webhook test ${status}`);

    } catch (error) {
        next(error);
    }
});

// GET /api/webhooks/meta/events
router.get('/meta/events', async (req, res, next) => {
    try {
        successResponse(res, validEvents);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
