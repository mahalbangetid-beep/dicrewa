const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect } = require('../middleware/auth');
const { successResponse, errorResponse, paginatedResponse, parsePagination } = require('../utils/response');

// Apply auth middleware
router.use(protect);

const validTriggerTypes = ['exact', 'contains', 'startswith', 'regex'];

// GET /api/auto-reply - List rules
router.get('/', async (req, res, next) => {
    try {
        const { page, limit, skip } = parsePagination(req.query);
        const { isActive, deviceId } = req.query;

        // Multi-tenant: always filter by userId
        const where = { userId: req.user.id };

        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        if (deviceId) {
            // Include global rules (deviceId = null) OR specific device rules
            where.AND = [{
                OR: [
                    { deviceId: null },
                    { deviceId: deviceId }
                ]
            }];
        }

        const [rules, total] = await Promise.all([
            prisma.autoReplyRule.findMany({
                where,
                skip,
                take: limit,
                orderBy: { priority: 'asc' }, // Order by priority
                include: {
                    device: { select: { name: true } }
                }
            }),
            prisma.autoReplyRule.count({ where })
        ]);

        paginatedResponse(res, rules, { page, limit, total });
    } catch (error) {
        next(error);
    }
});

// GET /api/auto-reply/:id
// GET /api/auto-reply/:id
router.get('/:id', async (req, res, next) => {
    try {
        // Multi-tenant: ensure rule belongs to user
        const rule = await prisma.autoReplyRule.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: { device: true }
        });

        if (!rule) {
            return errorResponse(res, 'Rule not found', 404);
        }
        successResponse(res, rule);
    } catch (error) {
        next(error);
    }
});

// POST /api/auto-reply
router.post('/', async (req, res, next) => {
    try {
        const { name, trigger, triggerType, response, deviceId, priority, mediaUrl } = req.body;
        const { planLimitsService } = require('../services/planLimitsService');

        if (!name || !trigger || !triggerType || !response) {
            return errorResponse(res, 'name, trigger, triggerType, and response are required', 400);
        }

        if (!validTriggerTypes.includes(triggerType)) {
            return errorResponse(res, `Invalid triggerType. Must be one of: ${validTriggerTypes.join(', ')}`, 400);
        }

        // Check plan limits
        const limitCheck = await planLimitsService.canAddAutoReplyRule(req.user.id);
        if (!limitCheck.allowed) {
            return errorResponse(res, limitCheck.reason, 403);
        }

        // If specific device, verify it exists and belongs to user
        if (deviceId) {
            const device = await prisma.device.findFirst({
                where: { id: deviceId, userId: req.user.id }
            });
            if (!device) return errorResponse(res, 'Device not found', 404);
        }

        const newRule = await prisma.autoReplyRule.create({
            data: {
                userId: req.user.id, // Multi-tenant: assign to current user
                name,
                trigger,
                triggerType,
                response,
                deviceId: deviceId || null,
                priority: priority || 0,
                mediaUrl: mediaUrl || null,
                isActive: true
            }
        });

        successResponse(res, newRule, 'Auto-reply rule created', 201);
    } catch (error) {
        next(error);
    }
});

// PUT /api/auto-reply/:id
router.put('/:id', async (req, res, next) => {
    try {
        const { name, trigger, triggerType, response, isActive, priority, deviceId, mediaUrl } = req.body;

        // Multi-tenant: ensure rule belongs to user
        const rule = await prisma.autoReplyRule.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });
        if (!rule) return errorResponse(res, 'Rule not found', 404);

        if (triggerType && !validTriggerTypes.includes(triggerType)) {
            return errorResponse(res, `Invalid triggerType. Must be one of: ${validTriggerTypes.join(', ')}`, 400);
        }

        // Verify device if changing
        if (deviceId && deviceId !== rule.deviceId) {
            const device = await prisma.device.findFirst({
                where: { id: deviceId, userId: req.user.id }
            });
            if (!device) return errorResponse(res, 'Device not found', 404);
        }

        const updatedRule = await prisma.autoReplyRule.update({
            where: { id: req.params.id },
            data: {
                name,
                trigger,
                triggerType,
                response,
                isActive,
                priority,
                deviceId,
                mediaUrl
            }
        });

        successResponse(res, updatedRule, 'Rule updated');
    } catch (error) {
        next(error);
    }
});

// PATCH /api/auto-reply/:id/toggle
router.patch('/:id/toggle', async (req, res, next) => {
    try {
        // Multi-tenant: ensure rule belongs to user
        const rule = await prisma.autoReplyRule.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });
        if (!rule) return errorResponse(res, 'Rule not found', 404);

        const updatedRule = await prisma.autoReplyRule.update({
            where: { id: req.params.id },
            data: { isActive: !rule.isActive }
        });

        successResponse(res, updatedRule, `Rule ${updatedRule.isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/auto-reply/:id
router.delete('/:id', async (req, res, next) => {
    try {
        // Multi-tenant: ensure rule belongs to user
        const rule = await prisma.autoReplyRule.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });
        if (!rule) return errorResponse(res, 'Rule not found', 404);

        await prisma.autoReplyRule.delete({ where: { id: req.params.id } });
        successResponse(res, { id: req.params.id }, 'Rule deleted');
    } catch (error) {
        next(error);
    }
});

module.exports = router;
