const express = require('express');
const router = express.Router();
const { protect: auth } = require('../middleware/auth');
const integrationService = require('../services/integrationService');

/**
 * Integration Routes
 */

// GET /api/integrations/available - Get available integration types (public)
router.get('/available', async (req, res) => {
    try {
        const integrations = integrationService.getAvailableIntegrations();
        res.json(integrations);
    } catch (error) {
        console.error('[Integrations] Error fetching available:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/integrations - Get user's integrations (auth required)
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const integrations = await integrationService.getUserIntegrations(userId);
        res.json(integrations);
    } catch (error) {
        console.error('[Integrations] Error fetching user integrations:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/integrations/:id - Get single integration
router.get('/:id', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const integration = await integrationService.getIntegration(req.params.id, userId);

        if (!integration) {
            return res.status(404).json({ error: 'Integration not found' });
        }

        res.json(integration);
    } catch (error) {
        console.error('[Integrations] Error fetching integration:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/integrations - Create new integration
router.post('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, type, config } = req.body;

        if (!name || !type) {
            return res.status(400).json({ error: 'Name and type are required' });
        }

        if (!config) {
            return res.status(400).json({ error: 'Configuration is required' });
        }

        const integration = await integrationService.createIntegration(userId, {
            name,
            type,
            config
        });

        res.status(201).json(integration);
    } catch (error) {
        console.error('[Integrations] Error creating integration:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/integrations/:id - Update integration
router.put('/:id', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, config, isActive, syncInterval } = req.body;

        const updated = await integrationService.updateIntegration(req.params.id, userId, {
            name,
            config,
            isActive,
            syncInterval
        });

        res.json(updated);
    } catch (error) {
        console.error('[Integrations] Error updating integration:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/integrations/:id - Delete integration
router.delete('/:id', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await integrationService.deleteIntegration(req.params.id, userId);
        res.json(result);
    } catch (error) {
        console.error('[Integrations] Error deleting integration:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/integrations/:id/test - Test integration connection
router.post('/:id/test', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await integrationService.testConnection(req.params.id, userId);
        res.json(result);
    } catch (error) {
        console.error('[Integrations] Error testing integration:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/integrations/:id/sync - Trigger manual sync
router.post('/:id/sync', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const options = req.body || {};
        const result = await integrationService.syncIntegration(req.params.id, userId, options);
        res.json(result);
    } catch (error) {
        console.error('[Integrations] Error syncing integration:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/integrations/:id/logs - Get integration logs
router.get('/:id/logs', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;
        const logs = await integrationService.getIntegrationLogs(req.params.id, userId, limit);
        res.json(logs);
    } catch (error) {
        console.error('[Integrations] Error fetching logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/integrations/:id/toggle - Toggle integration active status
router.post('/:id/toggle', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ error: 'isActive boolean is required' });
        }

        const updated = await integrationService.toggleIntegration(req.params.id, userId, isActive);
        res.json(updated);
    } catch (error) {
        console.error('[Integrations] Error toggling integration:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/integrations/test-config - Test configuration before saving
router.post('/test-config', auth, async (req, res) => {
    try {
        const { type, config } = req.body;

        if (!type || !config) {
            return res.status(400).json({ error: 'Type and config are required' });
        }

        // Get handler and test
        const handlers = {
            google_sheets: require('../services/integrations/googleSheets'),
            telegram: require('../services/integrations/telegram'),
            discord: require('../services/integrations/discord'),
            slack: require('../services/integrations/slack'),
            email: require('../services/integrations/email'),
            custom_webhook: require('../services/integrations/customWebhook'),
            airtable: require('../services/integrations/airtable'),
            notion: require('../services/integrations/notion')
        };

        const handler = handlers[type];
        if (!handler) {
            return res.status(400).json({ error: `Unknown integration type: ${type}` });
        }

        const result = await handler.testConnection(config);
        res.json(result);
    } catch (error) {
        console.error('[Integrations] Error testing config:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== SCHEDULER ENDPOINTS ====================

// GET /api/integrations/scheduler/status - Get scheduler status
router.get('/scheduler/status', auth, async (req, res) => {
    try {
        const integrationScheduler = require('../services/integrationScheduler');
        const status = integrationScheduler.getStatus();
        res.json(status);
    } catch (error) {
        console.error('[Integrations] Error getting scheduler status:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/integrations/scheduler/force-sync - Force sync user's scheduled integrations
router.post('/scheduler/force-sync', auth, async (req, res) => {
    try {
        const integrationScheduler = require('../services/integrationScheduler');
        // FIXED: Only sync integrations belonging to this user
        const results = await integrationScheduler.forceSyncAll(req.user.id);
        res.json({ success: true, results });
    } catch (error) {
        console.error('[Integrations] Error forcing sync:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/integrations/:id/schedule - Update sync schedule for integration
router.put('/:id/schedule', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { syncInterval } = req.body;

        // Validate syncInterval (in minutes)
        if (syncInterval !== null && (typeof syncInterval !== 'number' || syncInterval < 1)) {
            return res.status(400).json({ error: 'syncInterval must be a positive number (in minutes) or null' });
        }

        // Update integration
        const updated = await integrationService.updateIntegration(req.params.id, userId, {
            syncInterval
        });

        // Update scheduler
        const integrationScheduler = require('../services/integrationScheduler');
        await integrationScheduler.updateSchedule(req.params.id, syncInterval);

        res.json({
            success: true,
            integration: updated,
            message: syncInterval
                ? `Sync scheduled every ${syncInterval} minutes`
                : 'Scheduled sync disabled'
        });
    } catch (error) {
        console.error('[Integrations] Error updating schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/integrations/:id/next-sync - Get next scheduled sync time
router.get('/:id/next-sync', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const integration = await integrationService.getIntegration(req.params.id, userId);

        if (!integration) {
            return res.status(404).json({ error: 'Integration not found' });
        }

        const integrationScheduler = require('../services/integrationScheduler');

        // Get raw integration for accurate lastSyncAt
        const rawIntegration = await integrationService.getIntegrationRaw(req.params.id);
        const nextSync = integrationScheduler.getNextSyncTime(rawIntegration);

        res.json({
            integrationId: integration.id,
            syncInterval: integration.syncInterval,
            lastSyncAt: rawIntegration.lastSyncAt,
            nextSyncAt: nextSync,
            isScheduled: !!integration.syncInterval
        });
    } catch (error) {
        console.error('[Integrations] Error getting next sync:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
