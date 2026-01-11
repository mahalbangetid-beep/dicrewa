const express = require('express');
const router = express.Router();
const { protect: auth } = require('../middleware/auth');
const { checkQuota } = require('../middleware/quota');
const InboxService = require('../services/inboxService');

// Initialize service - will be set from index.js
let inboxService = null;

const getInboxService = (req) => {
    if (!inboxService) {
        const whatsappService = req.app.get('whatsapp');
        inboxService = new InboxService(whatsappService);
    }
    return inboxService;
};

// ==================== CONVERSATIONS ====================

/**
 * GET /api/inbox/conversations
 * Get all conversations for authenticated user
 */
router.get('/conversations', auth, async (req, res) => {
    try {
        const { page = 1, limit = 50, deviceId, search, archived } = req.query;
        const service = getInboxService(req);

        console.log(`[Inbox] GET conversations - userId: ${req.user.id}, archived: ${archived}`);

        const result = await service.getConversations(req.user.id, {
            page: parseInt(page),
            limit: parseInt(limit),
            deviceId: deviceId || null,
            search: search || '',
            archived: archived === 'true'
        });

        console.log(`[Inbox] Found ${result?.conversations?.length || 0} conversations for user ${req.user.id}`);

        res.json(result);
    } catch (error) {
        console.error('[Inbox] Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

/**
 * GET /api/inbox/conversations/:id
 * Get single conversation details
 */
router.get('/conversations/:id', auth, async (req, res) => {
    try {
        const prisma = require('../utils/prisma');

        const conversation = await prisma.conversation.findUnique({
            where: { id: req.params.id },
            include: {
                device: {
                    select: { id: true, name: true, phone: true, userId: true }
                }
            }
        });

        if (!conversation || conversation.device.userId !== req.user.id) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        res.json(conversation);
    } catch (error) {
        console.error('[Inbox] Error fetching conversation:', error);
        res.status(500).json({ error: 'Failed to fetch conversation' });
    }
});

/**
 * POST /api/inbox/conversations
 * Create a new conversation manually
 */
router.post('/conversations', auth, async (req, res) => {
    try {
        const { deviceId, phone, name } = req.body;
        const prisma = require('../utils/prisma');

        if (!deviceId || !phone) {
            return res.status(400).json({ error: 'deviceId and phone are required' });
        }

        // Verify device belongs to user
        const device = await prisma.device.findFirst({
            where: { id: deviceId, userId: req.user.id }
        });

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Format phone number to proper JID
        // Remove any non-digit characters
        let cleaned = phone.toString().trim().replace(/\D/g, '');

        // Handle leading 0 -> replace with 62 (Indonesia)
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        }

        // Add @s.whatsapp.net suffix
        const remoteJid = cleaned + '@s.whatsapp.net';

        console.log(`[Inbox] Creating conversation: phone=${phone}, formatted JID=${remoteJid}`);

        // Create or update conversation
        const conversation = await prisma.conversation.upsert({
            where: {
                deviceId_remoteJid: { deviceId, remoteJid }
            },
            update: {
                name: name || null,
                updatedAt: new Date()
            },
            create: {
                deviceId,
                remoteJid,
                name: name || null,
                isGroup: false,
                lastMessageAt: new Date()
            }
        });

        res.json({ success: true, data: conversation });
    } catch (error) {
        console.error('[Inbox] Error creating conversation:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
});

/**
 * PATCH /api/inbox/conversations/:id
 * Update conversation (fix phone number)
 */
router.patch('/conversations/:id', auth, async (req, res) => {
    try {
        const { phone, name } = req.body;
        const prisma = require('../utils/prisma');

        // Get existing conversation
        const existing = await prisma.conversation.findUnique({
            where: { id: req.params.id },
            include: { device: { select: { id: true, userId: true } } }
        });

        if (!existing || existing.device.userId !== req.user.id) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const updateData = {};

        // If phone is provided, format it properly
        if (phone) {
            let cleaned = phone.toString().trim().replace(/\D/g, '');
            if (cleaned.startsWith('0')) {
                cleaned = '62' + cleaned.substring(1);
            }
            updateData.remoteJid = cleaned + '@s.whatsapp.net';
            console.log(`[Inbox] Updating conversation ${req.params.id}: new JID=${updateData.remoteJid}`);
        }

        if (name !== undefined) {
            updateData.name = name || null;
        }

        const conversation = await prisma.conversation.update({
            where: { id: req.params.id },
            data: updateData
        });

        res.json({ success: true, data: conversation });
    } catch (error) {
        console.error('[Inbox] Error updating conversation:', error);
        res.status(500).json({ error: 'Failed to update conversation' });
    }
});

/**
 * GET /api/inbox/conversations/:id/messages
 * Get messages for a conversation
 */
router.get('/conversations/:id/messages', auth, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const service = getInboxService(req);

        const result = await service.getConversationMessages(req.user.id, req.params.id, {
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.json(result);
    } catch (error) {
        console.error('[Inbox] Error fetching messages:', error);
        if (error.message === 'Conversation not found') {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

/**
 * POST /api/inbox/conversations/:id/messages
 * Send a message in a conversation
 */
router.post('/conversations/:id/messages', auth, checkQuota, async (req, res) => {
    try {
        const { message, mediaUrl } = req.body;

        if (!message && !mediaUrl) {
            return res.status(400).json({ error: 'Message or media is required' });
        }

        const service = getInboxService(req);
        const result = await service.sendMessage(req.user.id, req.params.id, message, mediaUrl);

        // Emit socket event for real-time update
        const io = req.app.get('io');
        io.emit('inbox:messageSent', {
            conversationId: req.params.id,
            message,
            mediaUrl
        });

        res.json({ success: true, result });
    } catch (error) {
        console.error('[Inbox] Error sending message:', error.message);

        if (error.message === 'Conversation not found') {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        if (error.message === 'Device not connected') {
            return res.status(400).json({ error: 'Device is not connected. Please reconnect your WhatsApp device first.' });
        }
        if (error.message === 'WhatsApp service not available') {
            return res.status(503).json({ error: 'WhatsApp service is not available. Please try again later.' });
        }

        res.status(500).json({ error: error.message || 'Failed to send message' });
    }
});

/**
 * PATCH /api/inbox/conversations/:id/read
 * Mark conversation as read
 */
router.patch('/conversations/:id/read', auth, async (req, res) => {
    try {
        const service = getInboxService(req);
        await service.markAsRead(req.user.id, req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Inbox] Error marking as read:', error);
        if (error.message === 'Conversation not found') {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

/**
 * PATCH /api/inbox/conversations/:id/pin
 * Toggle pin status
 */
router.patch('/conversations/:id/pin', auth, async (req, res) => {
    try {
        const service = getInboxService(req);
        const conversation = await service.togglePin(req.user.id, req.params.id);
        res.json(conversation);
    } catch (error) {
        console.error('[Inbox] Error toggling pin:', error);
        if (error.message === 'Conversation not found') {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.status(500).json({ error: 'Failed to toggle pin' });
    }
});

/**
 * PATCH /api/inbox/conversations/:id/archive
 * Toggle archive status
 */
router.patch('/conversations/:id/archive', auth, async (req, res) => {
    try {
        const service = getInboxService(req);
        const conversation = await service.toggleArchive(req.user.id, req.params.id);
        res.json(conversation);
    } catch (error) {
        console.error('[Inbox] Error toggling archive:', error);
        if (error.message === 'Conversation not found') {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.status(500).json({ error: 'Failed to toggle archive' });
    }
});

/**
 * GET /api/inbox/unread-count
 * Get total unread count for user
 */
router.get('/unread-count', auth, async (req, res) => {
    try {
        const service = getInboxService(req);
        const count = await service.getUnreadCount(req.user.id);
        res.json({ unreadCount: count });
    } catch (error) {
        console.error('[Inbox] Error getting unread count:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});

/**
 * DELETE /api/inbox/conversations/:id
 * Delete a conversation and its messages
 */
router.delete('/conversations/:id', auth, async (req, res) => {
    try {
        const prisma = require('../utils/prisma');
        const conversationId = req.params.id;

        // Verify ownership
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { device: true }
        });

        if (!conversation || conversation.device.userId !== req.user.id) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Delete all messages in this conversation first
        await prisma.message.deleteMany({
            where: {
                deviceId: conversation.deviceId,
                OR: [
                    { from: conversation.remoteJid },
                    { to: conversation.remoteJid }
                ]
            }
        });

        // Delete the conversation
        await prisma.conversation.delete({
            where: { id: conversationId }
        });

        res.json({ success: true, message: 'Conversation deleted' });
    } catch (error) {
        console.error('[Inbox] Error deleting conversation:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

// ==================== QUICK REPLIES ====================

/**
 * GET /api/inbox/quick-replies
 * Get all quick replies for user
 */
router.get('/quick-replies', auth, async (req, res) => {
    try {
        const service = getInboxService(req);
        const quickReplies = await service.getQuickReplies(req.user.id);
        res.json(quickReplies);
    } catch (error) {
        console.error('[Inbox] Error fetching quick replies:', error);
        res.status(500).json({ error: 'Failed to fetch quick replies' });
    }
});

/**
 * POST /api/inbox/quick-replies
 * Create a quick reply
 */
router.post('/quick-replies', auth, async (req, res) => {
    try {
        const { shortcut, content } = req.body;

        if (!shortcut || !content) {
            return res.status(400).json({ error: 'Shortcut and content are required' });
        }

        const service = getInboxService(req);
        const quickReply = await service.createQuickReply(req.user.id, shortcut, content);
        res.status(201).json(quickReply);
    } catch (error) {
        console.error('[Inbox] Error creating quick reply:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Shortcut already exists' });
        }
        res.status(500).json({ error: 'Failed to create quick reply' });
    }
});

/**
 * PUT /api/inbox/quick-replies/:id
 * Update a quick reply
 */
router.put('/quick-replies/:id', auth, async (req, res) => {
    try {
        const { shortcut, content } = req.body;
        const service = getInboxService(req);
        const quickReply = await service.updateQuickReply(req.user.id, req.params.id, { shortcut, content });
        res.json(quickReply);
    } catch (error) {
        console.error('[Inbox] Error updating quick reply:', error);
        if (error.message === 'Quick reply not found') {
            return res.status(404).json({ error: 'Quick reply not found' });
        }
        res.status(500).json({ error: 'Failed to update quick reply' });
    }
});

/**
 * DELETE /api/inbox/quick-replies/:id
 * Delete a quick reply
 */
router.delete('/quick-replies/:id', auth, async (req, res) => {
    try {
        const service = getInboxService(req);
        await service.deleteQuickReply(req.user.id, req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Inbox] Error deleting quick reply:', error);
        if (error.message === 'Quick reply not found') {
            return res.status(404).json({ error: 'Quick reply not found' });
        }
        res.status(500).json({ error: 'Failed to delete quick reply' });
    }
});

module.exports = router;
