/**
 * Scheduler Routes - Advanced Scheduling API (Phase 8)
 * SECURITY: All endpoints now include ownership verification
 */

const express = require('express');
const router = express.Router();
const { protect: auth } = require('../middleware/auth');
const scheduler = require('../services/scheduler');
const prisma = require('../utils/prisma');

/**
 * Helper function to verify broadcast ownership
 * @returns broadcast if owned by user, null otherwise
 */
const verifyBroadcastOwnership = async (broadcastId, userId) => {
    const broadcast = await prisma.broadcast.findFirst({
        where: {
            id: broadcastId,
            device: {
                userId: userId
            }
        },
        include: {
            device: { select: { id: true, name: true, userId: true } }
        }
    });
    return broadcast;
};

/**
 * GET /api/scheduler/timezones - Get available timezones
 */
router.get('/timezones', auth, (req, res) => {
    res.json({
        success: true,
        data: scheduler.TIMEZONES
    });
});

/**
 * GET /api/scheduler/upcoming - Get upcoming scheduled broadcasts (user's only)
 */
router.get('/upcoming', auth, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        // FIXED: Pass userId to filter only user's broadcasts
        const broadcasts = await scheduler.getUpcoming(days, req.user.id);

        res.json({
            success: true,
            data: broadcasts
        });
    } catch (error) {
        console.error('[Scheduler] Error getting upcoming:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/scheduler/calendar - Get calendar events (user's only)
 */
router.get('/calendar', auth, async (req, res) => {
    try {
        const { start, end } = req.query;

        if (!start || !end) {
            return res.status(400).json({ error: 'Start and end dates required' });
        }

        // FIXED: Pass userId to filter only user's events
        const events = await scheduler.getCalendarEvents(start, end, req.user.id);

        res.json({
            success: true,
            data: events
        });
    } catch (error) {
        console.error('[Scheduler] Error getting calendar:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scheduler/schedule/:id - Schedule a one-time broadcast
 */
router.post('/schedule/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { scheduledAt, timezone = 'Asia/Jakarta' } = req.body;

        // FIXED: Verify ownership before scheduling
        const broadcast = await verifyBroadcastOwnership(id, req.user.id);
        if (!broadcast) {
            return res.status(404).json({ error: 'Broadcast not found' });
        }

        if (!scheduledAt) {
            return res.status(400).json({ error: 'scheduledAt is required' });
        }

        const scheduledDate = new Date(scheduledAt);
        if (scheduledDate <= new Date()) {
            return res.status(400).json({ error: 'Scheduled time must be in the future' });
        }

        const success = await scheduler.scheduleBroadcast(id, scheduledAt, timezone);

        if (success) {
            const updatedBroadcast = await prisma.broadcast.findUnique({
                where: { id },
                include: { device: { select: { id: true, name: true } } }
            });
            res.json({ success: true, data: updatedBroadcast });
        } else {
            res.status(500).json({ error: 'Failed to schedule broadcast' });
        }
    } catch (error) {
        console.error('[Scheduler] Error scheduling broadcast:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scheduler/recurring/:id - Set up recurring broadcast
 */
router.post('/recurring/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        // FIXED: Verify ownership before setting recurring
        const broadcast = await verifyBroadcastOwnership(id, req.user.id);
        if (!broadcast) {
            return res.status(404).json({ error: 'Broadcast not found' });
        }

        const {
            recurringType,  // daily, weekly, monthly
            recurringDays,  // [0,1,2,3,4,5,6] for weekly or [1,15] for monthly
            recurringTime,  // "09:00"
            timezone = 'Asia/Jakarta',
            maxRuns
        } = req.body;

        if (!recurringType || !recurringTime) {
            return res.status(400).json({ error: 'recurringType and recurringTime are required' });
        }

        const validTypes = ['daily', 'weekly', 'monthly'];
        if (!validTypes.includes(recurringType)) {
            return res.status(400).json({ error: 'Invalid recurringType' });
        }

        const success = await scheduler.setRecurring(id, {
            recurringType,
            recurringDays,
            recurringTime,
            timezone,
            maxRuns
        });

        if (success) {
            const updatedBroadcast = await prisma.broadcast.findUnique({
                where: { id },
                include: { device: { select: { id: true, name: true } } }
            });
            res.json({ success: true, data: updatedBroadcast });
        } else {
            res.status(500).json({ error: 'Failed to set recurring broadcast' });
        }
    } catch (error) {
        console.error('[Scheduler] Error setting recurring:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/scheduler/recurring/:id - Cancel recurring broadcast
 */
router.delete('/recurring/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        // FIXED: Verify ownership before canceling
        const broadcast = await verifyBroadcastOwnership(id, req.user.id);
        if (!broadcast) {
            return res.status(404).json({ error: 'Broadcast not found' });
        }

        const success = await scheduler.cancelRecurring(id);

        res.json({ success, message: success ? 'Recurring cancelled' : 'Failed to cancel' });
    } catch (error) {
        console.error('[Scheduler] Error canceling recurring:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scheduler/pause/:id - Pause recurring broadcast
 */
router.post('/pause/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        // FIXED: Verify ownership before pausing
        const broadcast = await verifyBroadcastOwnership(id, req.user.id);
        if (!broadcast) {
            return res.status(404).json({ error: 'Broadcast not found' });
        }

        const success = await scheduler.pauseRecurring(id);

        res.json({ success, message: success ? 'Broadcast paused' : 'Failed to pause' });
    } catch (error) {
        console.error('[Scheduler] Error pausing broadcast:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scheduler/resume/:id - Resume paused broadcast
 */
router.post('/resume/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        // FIXED: Verify ownership before resuming
        const broadcast = await verifyBroadcastOwnership(id, req.user.id);
        if (!broadcast) {
            return res.status(404).json({ error: 'Broadcast not found' });
        }

        const success = await scheduler.resumeRecurring(id);

        res.json({ success, message: success ? 'Broadcast resumed' : 'Failed to resume' });
    } catch (error) {
        console.error('[Scheduler] Error resuming broadcast:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/scheduler/run-now/:id - Run a scheduled broadcast immediately
 */
router.post('/run-now/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        // FIXED: Verify ownership before running
        const broadcast = await verifyBroadcastOwnership(id, req.user.id);
        if (!broadcast) {
            return res.status(404).json({ error: 'Broadcast not found' });
        }

        await scheduler.startBroadcast(id);

        res.json({ success: true, message: 'Broadcast started' });
    } catch (error) {
        console.error('[Scheduler] Error running broadcast:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
