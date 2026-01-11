const express = require('express');
const { protect } = require('../middleware/auth');
const analyticsService = require('../services/analyticsService');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

/**
 * GET /api/analytics/overview
 * Get overall analytics summary
 */
router.get('/overview', async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        console.log('[Analytics] Getting overview for user:', req.user.id, 'period:', period);
        const stats = await analyticsService.getOverviewStats(req.user.id, period);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching overview stats:', error.message);
        if (process.env.NODE_ENV === 'development') {
            console.error('Stack:', error.stack);
        }
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics'
        });
    }
});

/**
 * GET /api/analytics/messages
 * Get message statistics
 */
router.get('/messages', async (req, res) => {
    try {
        const { period = '7d', deviceId } = req.query;
        const stats = await analyticsService.getMessageStats(req.user.id, period, deviceId);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching message stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch message statistics'
        });
    }
});

/**
 * GET /api/analytics/devices
 * Get device performance statistics
 */
router.get('/devices', async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const stats = await analyticsService.getDeviceStats(req.user.id, period);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching device stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch device statistics'
        });
    }
});

/**
 * GET /api/analytics/broadcasts
 * Get broadcast analytics
 */
router.get('/broadcasts', async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const stats = await analyticsService.getBroadcastStats(req.user.id, period);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching broadcast stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch broadcast statistics'
        });
    }
});

/**
 * GET /api/analytics/chatbots
 * Get chatbot flow statistics
 */
router.get('/chatbots', async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const stats = await analyticsService.getChatbotStats(req.user.id, period);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching chatbot stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch chatbot statistics'
        });
    }
});

/**
 * GET /api/analytics/auto-replies
 * Get auto reply statistics
 */
router.get('/auto-replies', async (req, res) => {
    try {
        const stats = await analyticsService.getAutoReplyStats(req.user.id);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching auto-reply stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch auto-reply statistics'
        });
    }
});

/**
 * GET /api/analytics/export
 * Export analytics data as CSV
 */
router.get('/export', async (req, res) => {
    try {
        const { type = 'messages', period = '30d' } = req.query;

        let csv;
        let filename;

        switch (type) {
            case 'messages':
                csv = await analyticsService.exportMessagesToCSV(req.user.id, period);
                filename = `messages_export_${period}.csv`;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid export type'
                });
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export data'
        });
    }
});

module.exports = router;
