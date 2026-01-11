const express = require('express');
const { protect } = require('../middleware/auth');
const chatbotService = require('../services/chatbotService');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

/**
 * GET /api/chatbots
 * Get all chatbots for the authenticated user
 */
router.get('/', async (req, res) => {
    try {
        const chatbots = await chatbotService.getChatbots(req.user.id);

        // Parse JSON fields for response
        const formattedChatbots = chatbots.map(chatbot => ({
            ...chatbot,
            nodes: JSON.parse(chatbot.nodes || '[]'),
            edges: JSON.parse(chatbot.edges || '[]')
        }));

        res.json({
            success: true,
            data: formattedChatbots
        });
    } catch (error) {
        console.error('Error fetching chatbots:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch chatbots'
        });
    }
});

/**
 * GET /api/chatbots/:id
 * Get a specific chatbot
 */
router.get('/:id', async (req, res) => {
    try {
        const chatbot = await chatbotService.getChatbotById(req.params.id, req.user.id);

        if (!chatbot) {
            return res.status(404).json({
                success: false,
                error: 'Chatbot not found'
            });
        }

        res.json({
            success: true,
            data: {
                ...chatbot,
                nodes: JSON.parse(chatbot.nodes || '[]'),
                edges: JSON.parse(chatbot.edges || '[]')
            }
        });
    } catch (error) {
        console.error('Error fetching chatbot:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch chatbot'
        });
    }
});

/**
 * POST /api/chatbots
 * Create a new chatbot
 */
router.post('/', async (req, res) => {
    try {
        const { name, description, deviceId, triggerType, triggerKeywords, nodes, edges } = req.body;
        const { planLimitsService } = require('../services/planLimitsService');

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Chatbot name is required'
            });
        }

        // Check plan limits
        const limitCheck = await planLimitsService.canAddChatbot(req.user.id);
        if (!limitCheck.allowed) {
            return res.status(403).json({
                success: false,
                error: limitCheck.reason
            });
        }

        const chatbot = await chatbotService.createChatbot({
            name,
            description,
            deviceId,
            triggerType,
            triggerKeywords,
            nodes,
            edges
        }, req.user.id);

        res.status(201).json({
            success: true,
            data: {
                ...chatbot,
                nodes: JSON.parse(chatbot.nodes || '[]'),
                edges: JSON.parse(chatbot.edges || '[]')
            },
            message: 'Chatbot created successfully'
        });
    } catch (error) {
        console.error('Error creating chatbot:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create chatbot'
        });
    }
});

/**
 * PUT /api/chatbots/:id
 * Update a chatbot
 */
router.put('/:id', async (req, res) => {
    try {
        const chatbot = await chatbotService.updateChatbot(
            req.params.id,
            req.body,
            req.user.id
        );

        res.json({
            success: true,
            data: {
                ...chatbot,
                nodes: JSON.parse(chatbot.nodes || '[]'),
                edges: JSON.parse(chatbot.edges || '[]')
            },
            message: 'Chatbot updated successfully'
        });
    } catch (error) {
        console.error('Error updating chatbot:', error);

        if (error.message === 'Chatbot not found') {
            return res.status(404).json({
                success: false,
                error: 'Chatbot not found'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to update chatbot'
        });
    }
});

/**
 * DELETE /api/chatbots/:id
 * Delete a chatbot
 */
router.delete('/:id', async (req, res) => {
    try {
        await chatbotService.deleteChatbot(req.params.id, req.user.id);

        res.json({
            success: true,
            message: 'Chatbot deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting chatbot:', error);

        if (error.message === 'Chatbot not found') {
            return res.status(404).json({
                success: false,
                error: 'Chatbot not found'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to delete chatbot'
        });
    }
});

/**
 * POST /api/chatbots/:id/activate
 * Activate or deactivate a chatbot
 */
router.post('/:id/activate', async (req, res) => {
    try {
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'isActive must be a boolean'
            });
        }

        const chatbot = await chatbotService.toggleChatbot(
            req.params.id,
            req.user.id,
            isActive
        );

        res.json({
            success: true,
            data: {
                ...chatbot,
                nodes: JSON.parse(chatbot.nodes || '[]'),
                edges: JSON.parse(chatbot.edges || '[]')
            },
            message: `Chatbot ${isActive ? 'activated' : 'deactivated'} successfully`
        });
    } catch (error) {
        console.error('Error toggling chatbot:', error);

        if (error.message === 'Chatbot not found') {
            return res.status(404).json({
                success: false,
                error: 'Chatbot not found'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to toggle chatbot status'
        });
    }
});

/**
 * POST /api/chatbots/:id/validate
 * Validate chatbot flow
 */
router.post('/:id/validate', async (req, res) => {
    try {
        const chatbot = await chatbotService.getChatbotById(req.params.id, req.user.id);

        if (!chatbot) {
            return res.status(404).json({
                success: false,
                error: 'Chatbot not found'
            });
        }

        const nodes = JSON.parse(chatbot.nodes || '[]');
        const edges = JSON.parse(chatbot.edges || '[]');

        const validation = chatbotService.validateFlow(nodes, edges);

        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        console.error('Error validating chatbot:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate chatbot'
        });
    }
});

/**
 * POST /api/chatbots/:id/duplicate
 * Duplicate a chatbot
 */
router.post('/:id/duplicate', async (req, res) => {
    try {
        const { planLimitsService } = require('../services/planLimitsService');

        const original = await chatbotService.getChatbotById(req.params.id, req.user.id);

        if (!original) {
            return res.status(404).json({
                success: false,
                error: 'Chatbot not found'
            });
        }

        // FIXED: Check plan limits before duplicating
        const limitCheck = await planLimitsService.canAddChatbot(req.user.id);
        if (!limitCheck.allowed) {
            return res.status(403).json({
                success: false,
                error: limitCheck.reason
            });
        }

        const duplicate = await chatbotService.createChatbot({
            name: `${original.name} (Copy)`,
            description: original.description,
            deviceId: original.deviceId,
            triggerType: original.triggerType,
            triggerKeywords: original.triggerKeywords,
            nodes: JSON.parse(original.nodes || '[]'),
            edges: JSON.parse(original.edges || '[]')
        }, req.user.id);

        res.status(201).json({
            success: true,
            data: {
                ...duplicate,
                nodes: JSON.parse(duplicate.nodes || '[]'),
                edges: JSON.parse(duplicate.edges || '[]')
            },
            message: 'Chatbot duplicated successfully'
        });
    } catch (error) {
        console.error('Error duplicating chatbot:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to duplicate chatbot'
        });
    }
});

module.exports = router;
