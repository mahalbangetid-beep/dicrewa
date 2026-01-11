const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect } = require('../middleware/auth');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

// Apply auth middleware to all routes
router.use(protect);

// GET /api/devices - List all devices
router.get('/', async (req, res, next) => {
    try {
        const { page, limit, skip } = parsePagination(req.query);
        const whatsappService = req.app.get('whatsapp');

        // Fetch devices from DB
        const [devices, total] = await Promise.all([
            prisma.device.findMany({
                where: { userId: req.user.id },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.device.count({
                where: { userId: req.user.id }
            })
        ]);

        // Merge with real-time status
        const devicesWithStatus = devices.map(device => {
            const sessionStatus = whatsappService.getSessionStatus(device.id);
            return {
                ...device,
                status: sessionStatus.status,
                phone: sessionStatus.user?.id?.split(':')[0]?.split('@')[0] || device.phone,
                // If connected, update basic info if available
                user: sessionStatus.user || null
            };
        });

        paginatedResponse(res, devicesWithStatus, {
            page,
            limit,
            total
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/devices/:id - Get device by ID
router.get('/:id', async (req, res, next) => {
    try {
        const whatsappService = req.app.get('whatsapp');

        const device = await prisma.device.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!device) {
            return errorResponse(res, 'Device not found', 404);
        }

        const sessionStatus = whatsappService.getSessionStatus(device.id);

        const deviceWithStatus = {
            ...device,
            status: sessionStatus.status,
            phone: sessionStatus.user?.id?.split(':')[0]?.split('@')[0] || device.phone,
            sessionInfo: sessionStatus.user
        };

        successResponse(res, deviceWithStatus);
    } catch (error) {
        next(error);
    }
});

// POST /api/devices - Add new device
router.post('/', async (req, res, next) => {
    try {
        const { name } = req.body;
        const whatsappService = req.app.get('whatsapp');
        const { planLimitsService } = require('../services/planLimitsService');

        if (!name) {
            return errorResponse(res, 'Device name is required', 400);
        }

        // Check plan limits
        const limitCheck = await planLimitsService.canAddDevice(req.user.id);
        if (!limitCheck.allowed) {
            return errorResponse(res, limitCheck.reason, 403);
        }

        // Create pending device in DB
        const device = await prisma.device.create({
            data: {
                name,
                userId: req.user.id,
                status: 'pending'
            }
        });

        // Initialize session and wait for QR
        try {
            // Start session creation (async)
            whatsappService.createSession(device.id);

            // Wait for QR to be ready (max 10 seconds)
            let qrCode = null;
            const maxWaitTime = 10000; // 10 seconds
            const pollInterval = 500; // Check every 500ms
            const startTime = Date.now();

            while (Date.now() - startTime < maxWaitTime) {
                qrCode = whatsappService.getLatestQR(device.id);
                if (qrCode) break;
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }

            // Return device with QR (if available)
            const responseData = {
                ...device,
                qr: qrCode || null
            };

            if (qrCode) {
                successResponse(res, responseData, 'Device created. QR code ready.', 201);
            } else {
                // QR not ready yet, but device created - frontend will poll
                successResponse(res, responseData, 'Device created. QR code will be available shortly.', 201);
            }
        } catch (waError) {
            // If WA initialization fails, rollback DB creation
            await prisma.device.delete({ where: { id: device.id } });
            throw waError;
        }

    } catch (error) {
        next(error);
    }
});

// DELETE /api/devices/:id - Disconnect and delete device
router.delete('/:id', async (req, res, next) => {
    try {
        const whatsappService = req.app.get('whatsapp');
        const { id } = req.params;

        const device = await prisma.device.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });

        if (!device) {
            return errorResponse(res, 'Device not found', 404);
        }

        // Close WA Session
        await whatsappService.deleteSession(id);

        // Delete from DB
        await prisma.device.delete({
            where: { id }
        });

        successResponse(res, { id }, 'Device disconnected and removed successfully');
    } catch (error) {
        next(error);
    }
});

// PUT /api/devices/:id - Update device
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, spreadsheetUrl } = req.body;

        const device = await prisma.device.findFirst({
            where: { id, userId: req.user.id }
        });

        if (!device) {
            return errorResponse(res, 'Device not found', 404);
        }

        const updatedDevice = await prisma.device.update({
            where: { id },
            data: {
                ...(name && { name }),
                spreadsheetUrl: spreadsheetUrl === undefined ? device.spreadsheetUrl : spreadsheetUrl
            }
        });

        successResponse(res, updatedDevice, 'Device updated successfully');
    } catch (error) {
        next(error);
    }
});

// POST /api/devices/:id/restart - Restart device session
router.post('/:id/restart', async (req, res, next) => {
    try {
        const whatsappService = req.app.get('whatsapp');
        const { id } = req.params;

        const device = await prisma.device.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });

        if (!device) {
            return errorResponse(res, 'Device not found', 404);
        }

        // Restart session
        await whatsappService.restartSession(id);

        successResponse(res, { id }, 'Device session restarting...');
    } catch (error) {
        next(error);
    }
});

// GET /api/devices/:id/qr - Get latest QR (Experimental)
// Note: Best practice is to use WebSocket
router.get('/:id/qr', async (req, res, next) => {
    try {
        const whatsappService = req.app.get('whatsapp');
        const qr = whatsappService.getLatestQR(req.params.id);

        if (!qr) {
            return errorResponse(res, 'QR code not available yet. Please wait or check socket.', 404);
        }

        successResponse(res, { qr });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
