const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect } = require('../middleware/auth');
const { checkQuota } = require('../middleware/quota');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

/**
 * Extract proper filename from URL
 * Handles query strings, dynamic URLs, and edge cases
 */
const getFilenameFromUrl = (url) => {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const lastSegment = pathname.split('/').filter(s => s).pop() || '';

        // If valid filename with extension (2-5 chars), use it
        if (lastSegment && /\.[a-z0-9]{2,5}$/i.test(lastSegment)) {
            return lastSegment;
        }

        // Try to get from common query params
        const filename = urlObj.searchParams.get('filename')
            || urlObj.searchParams.get('name')
            || urlObj.searchParams.get('file');
        if (filename) return filename;

        // If we have any segment, use it with a generic extension
        if (lastSegment) {
            return `${lastSegment}.file`;
        }

        return 'document.pdf';
    } catch {
        // If URL parsing fails, try simple split
        const simple = url.split('/').pop()?.split('?')[0];
        return simple || 'document.pdf';
    }
};

// All routes are protected
router.use(protect);

// GET /api/messages - List messages
router.get('/', async (req, res, next) => {
    try {
        const { page, limit, skip } = parsePagination(req.query);
        const { type, status, deviceId } = req.query;

        const where = {};

        if (deviceId) {
            const device = await prisma.device.findFirst({
                where: { id: deviceId, userId: req.user.id }
            });
            if (!device) return errorResponse(res, 'Device not found', 404);
            where.deviceId = deviceId;
        } else {
            const userDevices = await prisma.device.findMany({
                where: { userId: req.user.id },
                select: { id: true }
            });
            where.deviceId = { in: userDevices.map(d => d.id) };
        }

        if (type) where.type = type;
        if (status) where.status = status;

        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    device: {
                        select: { name: true, phone: true }
                    }
                }
            }),
            prisma.message.count({ where })
        ]);

        paginatedResponse(res, messages, { page, limit, total });
    } catch (error) {
        next(error);
    }
});

// GET /api/messages/:id - Get message by ID
router.get('/:id', async (req, res, next) => {
    try {
        const message = await prisma.message.findFirst({
            where: {
                id: req.params.id,
                device: {
                    userId: req.user.id
                }
            },
            include: {
                device: true
            }
        });

        if (!message) {
            return errorResponse(res, 'Message not found', 404);
        }
        successResponse(res, message);
    } catch (error) {
        next(error);
    }
});

// POST /api/messages/send - Send text message
router.post('/send', checkQuota, async (req, res, next) => {
    try {
        const { deviceId, to, message } = req.body;
        const whatsappService = req.app.get('whatsapp');

        if (!deviceId || !to || !message) {
            return errorResponse(res, 'deviceId, to, and message are required', 400);
        }

        const device = await prisma.device.findFirst({
            where: { id: deviceId, userId: req.user.id }
        });
        if (!device) return errorResponse(res, 'Device not found', 404);

        // Send via WhatsApp Service
        try {
            const result = await whatsappService.sendMessage(deviceId, to, message);

            // Save to DB
            const savedMessage = await prisma.message.create({
                data: {
                    deviceId,
                    type: 'outgoing',
                    to: result.to,
                    waMessageId: result.messageId, // Save WA ID
                    message,
                    status: 'sent',
                    mediaType: 'text'
                }
            });

            successResponse(res, savedMessage, 'Message sent successfully', 201);

            // Increment Quota
            await prisma.user.update({
                where: { id: req.user.id },
                data: { used: { increment: 1 } }
            });
        } catch (waError) {
            await prisma.message.create({
                data: {
                    deviceId,
                    type: 'outgoing',
                    to,
                    message,
                    status: 'failed',
                    error: waError.message,
                    mediaType: 'text'
                }
            });
            throw waError;
        }

    } catch (error) {
        next(error);
    }
});

// POST /api/messages/send-media - Send media message
router.post('/send-media', checkQuota, async (req, res, next) => {
    try {
        const { deviceId, to, type, mediaUrl, caption } = req.body;
        const whatsappService = req.app.get('whatsapp');

        if (!deviceId || !to || !mediaUrl) {
            return errorResponse(res, 'deviceId, to, and mediaUrl are required', 400);
        }

        const device = await prisma.device.findFirst({
            where: { id: deviceId, userId: req.user.id }
        });
        if (!device) return errorResponse(res, 'Device not found', 404);

        try {
            let result;
            const msgType = type || 'image';

            if (msgType === 'image') {
                result = await whatsappService.sendImage(deviceId, to, mediaUrl, caption);
            } else if (msgType === 'document') {
                const filename = getFilenameFromUrl(mediaUrl);
                result = await whatsappService.sendDocument(deviceId, to, mediaUrl, filename, caption);
            } else if (msgType === 'video') {
                result = await whatsappService.sendVideo(deviceId, to, mediaUrl, caption);
            } else if (msgType === 'audio') {
                result = await whatsappService.sendAudio(deviceId, to, mediaUrl, false);
            } else {
                return errorResponse(res, 'Unsupported media type. Supports: image, document, video, audio', 400);
            }

            // Save to DB
            const savedMessage = await prisma.message.create({
                data: {
                    deviceId,
                    type: 'outgoing',
                    to: result.to,
                    waMessageId: result.messageId, // Save WA ID
                    message: caption || '',
                    mediaUrl,
                    mediaType: msgType,
                    status: 'sent'
                }
            });

            successResponse(res, savedMessage, 'Media sent successfully', 201);

            // Increment Quota
            await prisma.user.update({
                where: { id: req.user.id },
                data: { used: { increment: 1 } }
            });
        } catch (waError) {
            await prisma.message.create({
                data: {
                    deviceId,
                    type: 'outgoing',
                    to,
                    message: caption || '',
                    mediaUrl,
                    mediaType: type || 'image',
                    status: 'failed',
                    error: waError.message
                }
            });
            throw waError;
        }
    } catch (error) {
        next(error);
    }
});

// POST /api/messages/send-list - Send list message
router.post('/send-list', checkQuota, async (req, res, next) => {
    try {
        const { deviceId, to, title, text, footer, buttonText, sections } = req.body;
        const whatsappService = req.app.get('whatsapp');

        if (!deviceId || !to || !text || !buttonText || !sections) {
            return errorResponse(res, 'deviceId, to, text, buttonText, and sections are required', 400);
        }

        const device = await prisma.device.findFirst({ where: { id: deviceId, userId: req.user.id } });
        if (!device) return errorResponse(res, 'Device not found', 404);

        const result = await whatsappService.sendList(deviceId, to, { title, text, footer, buttonText, sections });

        // Save to DB
        const savedMessage = await prisma.message.create({
            data: {
                deviceId, type: 'outgoing', to: result.to, waMessageId: result.messageId,
                message: text, status: 'sent', mediaType: 'list'
            }
        });

        // Increment Quota
        await prisma.user.update({ where: { id: req.user.id }, data: { used: { increment: 1 } } });

        successResponse(res, savedMessage, 'List message sent', 201);
    } catch (error) {
        next(error);
    }
});

// POST /api/messages/send-buttons - Send buttons message
router.post('/send-buttons', checkQuota, async (req, res, next) => {
    try {
        const { deviceId, to, text, footer, buttons } = req.body;
        const whatsappService = req.app.get('whatsapp');

        if (!deviceId || !to || !text || !buttons) {
            return errorResponse(res, 'deviceId, to, text, and buttons are required', 400);
        }

        const device = await prisma.device.findFirst({ where: { id: deviceId, userId: req.user.id } });
        if (!device) return errorResponse(res, 'Device not found', 404);

        const result = await whatsappService.sendButtons(deviceId, to, { text, footer, buttons });

        // Save to DB
        const savedMessage = await prisma.message.create({
            data: {
                deviceId, type: 'outgoing', to: result.to, waMessageId: result.messageId,
                message: text, status: 'sent', mediaType: 'buttons'
            }
        });

        // Increment Quota
        await prisma.user.update({ where: { id: req.user.id }, data: { used: { increment: 1 } } });

        successResponse(res, savedMessage, 'Button message sent', 201);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
