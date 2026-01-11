const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect } = require('../middleware/auth');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

// Apply auth middleware
router.use(protect);

// GET /api/broadcast - List campaigns
router.get('/', async (req, res, next) => {
    try {
        const { page, limit, skip } = parsePagination(req.query);
        const { status } = req.query;

        const where = {};
        if (status) where.status = status;

        // Filter by user's permission (assuming they can see all broadcasts for devices they own)
        const userDevices = await prisma.device.findMany({
            where: { userId: req.user.id },
            select: { id: true }
        });
        where.deviceId = { in: userDevices.map(d => d.id) };

        const [campaigns, total] = await Promise.all([
            prisma.broadcast.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    device: { select: { name: true, phone: true } }
                }
            }),
            prisma.broadcast.count({ where })
        ]);

        paginatedResponse(res, campaigns, { page, limit, total });
    } catch (error) {
        next(error);
    }
});

// GET /api/broadcast/:id
router.get('/:id', async (req, res, next) => {
    try {
        const campaign = await prisma.broadcast.findUnique({
            where: { id: req.params.id },
            include: { device: true }
        });

        if (!campaign) {
            return errorResponse(res, 'Campaign not found', 404);
        }

        // Check ownership
        if (campaign.device.userId !== req.user.id) {
            return errorResponse(res, 'Unauthorized to view this campaign', 403);
        }

        successResponse(res, campaign);
    } catch (error) {
        next(error);
    }
});

// POST /api/broadcast - Create broadcast
router.post('/', async (req, res, next) => {
    try {
        const { name, deviceId, recipients, message, mediaUrl, scheduledAt } = req.body;

        if (!name || !deviceId || !recipients || !message) {
            return errorResponse(res, 'name, deviceId, recipients, and message are required', 400);
        }

        if (!Array.isArray(recipients) || recipients.length === 0) {
            return errorResponse(res, 'recipients must be a non-empty array', 400);
        }

        // Verify device
        const device = await prisma.device.findFirst({
            where: { id: deviceId, userId: req.user.id }
        });
        if (!device) return errorResponse(res, 'Device not found', 404);

        // Create Broadcast and Recipients in transaction
        const campaign = await prisma.$transaction(async (tx) => {
            const broadcast = await tx.broadcast.create({
                data: {
                    name,
                    deviceId,
                    userId: req.user.id, // Store userId for quota tracking
                    message,
                    mediaUrl,
                    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                    status: scheduledAt ? 'scheduled' : 'running', // Simplification: running immediately if no schedule
                    totalRecipients: recipients.length
                }
            });

            // Create recipients entries
            // For large arrays checking `createMany` support or batching
            // SQLite supports createMany in Prisma recently? Yes.
            const recipientData = recipients.map(r => ({
                broadcastId: broadcast.id,
                phone: r.phone || r, // Handle if object or string
                name: r.name || null,
                status: 'pending'
            }));

            await tx.broadcastRecipient.createMany({
                data: recipientData
            });

            return broadcast;
        });

        // Trigger Queue Processing
        if (campaign.status === 'running') {
            const broadcastService = req.app.get('broadcast');
            broadcastService.trigger(campaign.id);
        }

        successResponse(res, campaign, 'Broadcast campaign created', 201);
    } catch (error) {
        next(error);
    }
});

// POST /api/broadcast/:id/cancel
router.post('/:id/cancel', async (req, res, next) => {
    try {
        const campaign = await prisma.broadcast.findUnique({
            where: { id: req.params.id },
            include: { device: true }
        });

        if (!campaign) return errorResponse(res, 'Campaign not found', 404);
        if (campaign.device.userId !== req.user.id) return errorResponse(res, 'Unauthorized', 403);

        const updated = await prisma.broadcast.update({
            where: { id: req.params.id },
            data: { status: 'cancelled' }
        });

        successResponse(res, updated, 'Broadcast cancelled');
    } catch (error) {
        next(error);
    }
});

// GET /api/broadcast/:id/recipients
router.get('/:id/recipients', async (req, res, next) => {
    try {
        // SECURITY: Verify broadcast ownership before returning recipients
        const broadcast = await prisma.broadcast.findUnique({
            where: { id: req.params.id },
            include: { device: { select: { userId: true } } }
        });

        if (!broadcast) {
            return errorResponse(res, 'Broadcast not found', 404);
        }

        // Check if user owns the device
        if (broadcast.device.userId !== req.user.id) {
            return errorResponse(res, 'Unauthorized to view this broadcast', 403);
        }

        const { page, limit, skip } = parsePagination(req.query);
        const { status } = req.query;

        const where = { broadcastId: req.params.id };
        if (status) where.status = status;

        const [recipients, total] = await Promise.all([
            prisma.broadcastRecipient.findMany({
                where,
                skip,
                take: limit
            }),
            prisma.broadcastRecipient.count({ where })
        ]);

        paginatedResponse(res, recipients, { page, limit, total });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
