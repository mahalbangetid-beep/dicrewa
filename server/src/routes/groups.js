/**
 * Group Management Routes (Phase 7)
 * Handles WhatsApp group management API endpoints
 */

const express = require('express');
const router = express.Router();
const { protect: auth } = require('../middleware/auth');
const groupService = require('../services/group');
const prisma = require('../utils/prisma');
const quotaService = require('../services/quotaService');

// ==================== GROUPS ====================

/**
 * GET /api/groups - Get all groups for user
 */
router.get('/', auth, async (req, res) => {
    try {
        const { search, deviceId, limit = 50, offset = 0 } = req.query;

        const result = await groupService.getUserGroups(req.user.id, {
            search,
            deviceId,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: result.groups,
            pagination: {
                total: result.total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        console.error('[Groups] Error getting groups:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/groups/device/:deviceId - Get groups for specific device
 */
router.get('/device/:deviceId', auth, async (req, res) => {
    try {
        // Verify device belongs to user
        const device = await prisma.device.findFirst({
            where: {
                id: req.params.deviceId,
                userId: req.user.id
            }
        });

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const { search, sortBy, sortOrder, limit = 50, offset = 0 } = req.query;

        const result = await groupService.getDeviceGroups(req.params.deviceId, {
            search,
            sortBy,
            sortOrder,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: result.groups,
            pagination: {
                total: result.total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        console.error('[Groups] Error getting device groups:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/groups/stats/:deviceId - Get group statistics
 */
router.get('/stats/:deviceId', auth, async (req, res) => {
    try {
        // Verify device belongs to user
        const device = await prisma.device.findFirst({
            where: {
                id: req.params.deviceId,
                userId: req.user.id
            }
        });

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const stats = await groupService.getGroupStats(req.params.deviceId);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Groups] Error getting stats:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/groups/sync/:deviceId - Sync groups from WhatsApp
 */
router.post('/sync/:deviceId', auth, async (req, res) => {
    try {
        // Verify device belongs to user
        const device = await prisma.device.findFirst({
            where: {
                id: req.params.deviceId,
                userId: req.user.id,
                status: 'connected'
            }
        });

        if (!device) {
            return res.status(400).json({ error: 'Device not connected' });
        }

        // Get WhatsApp service instance from app
        const whatsappService = req.app.get('whatsapp');
        if (!whatsappService) {
            return res.status(500).json({ error: 'WhatsApp service not initialized' });
        }
        const session = whatsappService.getSession(req.params.deviceId);

        if (!session) {
            return res.status(400).json({ error: 'WhatsApp session not available' });
        }

        // Fetch groups from WhatsApp
        let groups = [];
        try {
            const chats = await session.groupFetchAllParticipating();
            groups = Object.values(chats);
        } catch (waError) {
            console.error('[Groups] Error fetching from WhatsApp:', waError);
            return res.status(500).json({ error: 'Failed to fetch groups from WhatsApp' });
        }

        // Sync to database
        const syncResult = await groupService.syncGroups(req.params.deviceId, groups);

        res.json({
            success: true,
            data: syncResult,
            message: `Synced ${syncResult.synced} groups (${syncResult.added} new, ${syncResult.updated} updated)`
        });
    } catch (error) {
        console.error('[Groups] Error syncing groups:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/groups/:groupId - Get group details
 */
router.get('/:groupId', auth, async (req, res) => {
    try {
        const group = await groupService.getGroupById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Verify user owns the device
        const device = await prisma.device.findFirst({
            where: {
                id: group.deviceId,
                userId: req.user.id
            }
        });

        if (!device) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ success: true, data: group });
    } catch (error) {
        console.error('[Groups] Error getting group:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/groups/:groupId/sync-members - Sync group members
 */
router.post('/:groupId/sync-members', auth, async (req, res) => {
    try {
        const group = await groupService.getGroupById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Verify user owns the device
        const device = await prisma.device.findFirst({
            where: {
                id: group.deviceId,
                userId: req.user.id,
                status: 'connected'
            }
        });

        if (!device) {
            return res.status(400).json({ error: 'Device not connected' });
        }

        // Get WhatsApp service instance from app
        const whatsappService = req.app.get('whatsapp');
        if (!whatsappService) {
            return res.status(500).json({ error: 'WhatsApp service not initialized' });
        }
        const session = whatsappService.getSession(group.deviceId);

        if (!session) {
            return res.status(400).json({ error: 'WhatsApp session not available' });
        }

        // Fetch group metadata
        let groupMeta;
        try {
            groupMeta = await session.groupMetadata(group.groupJid);
        } catch (waError) {
            console.error('[Groups] Error fetching group metadata:', waError);
            return res.status(500).json({ error: 'Failed to fetch group from WhatsApp' });
        }

        // Sync members
        const syncResult = await groupService.syncGroupMembers(
            req.params.groupId,
            groupMeta.participants || []
        );

        // Update group info
        await prisma.groupInfo.update({
            where: { id: req.params.groupId },
            data: {
                memberCount: groupMeta.participants?.length || 0,
                subject: groupMeta.subject,
                description: groupMeta.desc,
                lastSyncAt: new Date()
            }
        });

        res.json({
            success: true,
            data: syncResult,
            message: `Synced ${syncResult.synced} members`
        });
    } catch (error) {
        console.error('[Groups] Error syncing members:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/groups/:groupId/members - Get group members
 */
router.get('/:groupId/members', auth, async (req, res) => {
    try {
        const group = await groupService.getGroupById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // SECURITY: Verify user owns the device before returning members
        const device = await prisma.device.findFirst({
            where: {
                id: group.deviceId,
                userId: req.user.id
            }
        });

        if (!device) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { search, filter, limit = 100, offset = 0 } = req.query;

        const members = await groupService.getGroupMembers(req.params.groupId, {
            search,
            filter,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({ success: true, data: members });
    } catch (error) {
        console.error('[Groups] Error getting members:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/groups/:groupId - Update group settings
 */
router.put('/:groupId', auth, async (req, res) => {
    try {
        const group = await groupService.getGroupById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Verify user owns the device
        const device = await prisma.device.findFirst({
            where: {
                id: group.deviceId,
                userId: req.user.id
            }
        });

        if (!device) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const updatedGroup = await groupService.updateGroup(req.params.groupId, req.body);
        res.json({ success: true, data: updatedGroup });
    } catch (error) {
        console.error('[Groups] Error updating group:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/groups/:groupId - Delete group from database
 */
router.delete('/:groupId', auth, async (req, res) => {
    try {
        const group = await groupService.getGroupById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Verify user owns the device
        const device = await prisma.device.findFirst({
            where: {
                id: group.deviceId,
                userId: req.user.id
            }
        });

        if (!device) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await groupService.deleteGroup(req.params.groupId);
        res.json({ success: true });
    } catch (error) {
        console.error('[Groups] Error deleting group:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/groups/:groupId/send - Send message to group
 */
router.post('/:groupId/send', auth, async (req, res) => {
    try {
        const { message, mediaUrl, mediaType } = req.body;

        if (!message && !mediaUrl) {
            return res.status(400).json({ error: 'Message or media is required' });
        }

        const group = await groupService.getGroupById(req.params.groupId);

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Verify device is connected
        const device = await prisma.device.findFirst({
            where: {
                id: group.deviceId,
                userId: req.user.id,
                status: 'connected'
            }
        });

        if (!device) {
            return res.status(400).json({ error: 'Device not connected' });
        }

        // Get WhatsApp service from app
        const whatsappService = req.app.get('whatsapp');
        if (!whatsappService) {
            return res.status(500).json({ error: 'WhatsApp service not initialized' });
        }
        const session = whatsappService.getSession(group.deviceId);

        if (!session) {
            return res.status(400).json({ error: 'WhatsApp session not available' });
        }

        // Send message
        try {
            // Check quota before sending
            const quotaCheck = await quotaService.checkAndIncrement(req.user.id, 1);
            if (!quotaCheck.allowed) {
                return res.status(403).json({ error: quotaCheck.reason || 'Message quota exceeded' });
            }

            let sentMessage;

            if (mediaUrl) {
                // Send media
                sentMessage = await session.sendMessage(group.groupJid, {
                    [mediaType || 'image']: { url: mediaUrl },
                    caption: message || ''
                });
            } else {
                // Send text
                sentMessage = await session.sendMessage(group.groupJid, {
                    text: message
                });
            }

            // Log message
            await prisma.message.create({
                data: {
                    deviceId: group.deviceId,
                    waMessageId: sentMessage.key?.id,
                    type: 'outgoing',
                    mediaType: mediaType || 'text',
                    to: group.groupJid,
                    toName: group.name,
                    message: message || '',
                    mediaUrl,
                    status: 'sent'
                }
            });

            res.json({
                success: true,
                message: 'Message sent to group',
                data: { messageId: sentMessage.key?.id }
            });
        } catch (waError) {
            console.error('[Groups] Error sending message:', waError);
            res.status(500).json({ error: 'Failed to send message' });
        }
    } catch (error) {
        console.error('[Groups] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/groups/bulk-delete - Bulk delete groups
 */
router.post('/bulk-delete', auth, async (req, res) => {
    try {
        const { groupIds } = req.body;

        if (!groupIds || !Array.isArray(groupIds)) {
            return res.status(400).json({ error: 'groupIds array is required' });
        }

        // Verify all groups belong to user's devices
        const groups = await prisma.groupInfo.findMany({
            where: {
                id: { in: groupIds },
                device: { userId: req.user.id }
            },
            select: { id: true }
        });

        const validIds = groups.map(g => g.id);
        const result = await groupService.bulkDeleteGroups(validIds);

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[Groups] Error bulk deleting:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/groups/search/members - Search members across groups
 */
router.get('/search/members', auth, async (req, res) => {
    try {
        const { q, deviceId } = req.query;

        if (!q || !deviceId) {
            return res.status(400).json({ error: 'Query and deviceId are required' });
        }

        // Verify device belongs to user
        const device = await prisma.device.findFirst({
            where: {
                id: deviceId,
                userId: req.user.id
            }
        });

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const members = await groupService.searchMembers(deviceId, q);
        res.json({ success: true, data: members });
    } catch (error) {
        console.error('[Groups] Error searching members:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
