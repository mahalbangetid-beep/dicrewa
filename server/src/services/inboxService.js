const prisma = require('../utils/prisma');

class InboxService {
    constructor(whatsappService) {
        this.whatsappService = whatsappService;
    }

    /**
     * Get or create a conversation for a remote JID
     */
    async getOrCreateConversation(deviceId, remoteJid, messageData = {}) {
        const isGroup = remoteJid.endsWith('@g.us');

        let conversation = await prisma.conversation.findUnique({
            where: {
                deviceId_remoteJid: { deviceId, remoteJid }
            }
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    deviceId,
                    remoteJid,
                    name: messageData.name || null,
                    pushName: messageData.pushName || null,
                    isGroup,
                    lastMessage: messageData.message || null,
                    lastMessageAt: new Date()
                }
            });
        }

        return conversation;
    }

    /**
     * Update conversation with new message
     */
    async updateConversationWithMessage(deviceId, remoteJid, message, isIncoming = false, pushName = null) {
        const updateData = {
            lastMessage: message.substring(0, 255), // Truncate for preview
            lastMessageAt: new Date(),
            updatedAt: new Date()
        };

        // Update pushName if provided and conversation doesn't have one
        if (pushName) {
            updateData.pushName = pushName;
        }

        // Increment unread count for incoming messages
        if (isIncoming) {
            updateData.unreadCount = { increment: 1 };
        }

        try {
            await prisma.conversation.upsert({
                where: {
                    deviceId_remoteJid: { deviceId, remoteJid }
                },
                update: updateData,
                create: {
                    deviceId,
                    remoteJid,
                    isGroup: remoteJid.endsWith('@g.us'),
                    lastMessage: message.substring(0, 255),
                    lastMessageAt: new Date(),
                    unreadCount: isIncoming ? 1 : 0,
                    pushName: pushName || null
                }
            });
        } catch (error) {
            console.error('[InboxService] Error updating conversation:', error);
        }
    }

    /**
     * Get all conversations for a user's devices
     */
    async getConversations(userId, options = {}) {
        const {
            page = 1,
            limit = 50,
            deviceId = null,
            search = ''
        } = options;

        const skip = (page - 1) * limit;

        // Get user's device IDs
        const devices = await prisma.device.findMany({
            where: { userId },
            select: { id: true }
        });
        const deviceIds = devices.map(d => d.id);

        const where = {
            deviceId: deviceId ? { equals: deviceId } : { in: deviceIds }
        };

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { pushName: { contains: search } },
                { remoteJid: { contains: search } },
                { lastMessage: { contains: search } }
            ];
        }

        const [conversations, total] = await Promise.all([
            prisma.conversation.findMany({
                where,
                include: {
                    device: {
                        select: { id: true, name: true, phone: true }
                    }
                },
                orderBy: [
                    { isPinned: 'desc' },
                    { lastMessageAt: 'desc' }
                ],
                skip,
                take: limit
            }),
            prisma.conversation.count({ where })
        ]);

        return {
            conversations,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get messages for a specific conversation
     */
    async getConversationMessages(userId, conversationId, options = {}) {
        const { page = 1, limit = 50 } = options;
        const skip = (page - 1) * limit;

        // Verify user owns the conversation's device
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { device: true }
        });

        if (!conversation || conversation.device.userId !== userId) {
            throw new Error('Conversation not found');
        }

        const remoteJid = conversation.remoteJid;
        const deviceId = conversation.deviceId;

        // Get messages related to this conversation
        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where: {
                    deviceId,
                    OR: [
                        { from: remoteJid },
                        { to: remoteJid }
                    ]
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.message.count({
                where: {
                    deviceId,
                    OR: [
                        { from: remoteJid },
                        { to: remoteJid }
                    ]
                }
            })
        ]);

        // Mark as read when fetching messages
        await this.markAsRead(userId, conversationId);

        return {
            conversation,
            messages: messages.reverse(), // Oldest first for display
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Mark conversation as read
     */
    async markAsRead(userId, conversationId) {
        // Verify ownership via device
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { device: { select: { userId: true } } }
        });

        if (!conversation || conversation.device.userId !== userId) {
            throw new Error('Conversation not found');
        }

        await prisma.conversation.update({
            where: { id: conversationId },
            data: { unreadCount: 0 }
        });
    }

    /**
     * Send a message from inbox
     */
    async sendMessage(userId, conversationId, message, mediaUrl = null) {
        console.log(`[InboxService] sendMessage called - conversationId: ${conversationId}, message length: ${message?.length}`);

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { device: true }
        });

        if (!conversation || conversation.device.userId !== userId) {
            console.error('[InboxService] Conversation not found or access denied');
            throw new Error('Conversation not found');
        }

        console.log(`[InboxService] Sending to ${conversation.remoteJid} via device ${conversation.deviceId}`);

        // Check if WhatsApp service is available
        if (!this.whatsappService) {
            console.error('[InboxService] WhatsApp service is not initialized!');
            throw new Error('WhatsApp service not available');
        }

        // Send via WhatsApp service
        // Note: sendMessage only accepts 3 params (deviceId, to, text), mediaUrl is not supported here
        // For media, use sendImage/sendVideo/sendDocument separately
        const result = await this.whatsappService.sendMessage(
            conversation.deviceId,
            conversation.remoteJid,
            message
        );

        console.log(`[InboxService] Message sent successfully, messageId: ${result?.messageId}`);

        // Save outgoing message to database
        try {
            const messageData = {
                deviceId: conversation.deviceId,
                waMessageId: result.messageId || `inbox-${Date.now()}`,
                from: conversation.device.phone ? `${conversation.device.phone}@s.whatsapp.net` : 'me',
                to: conversation.remoteJid,
                message: message,
                type: 'outgoing',
                status: 'sent'
            };

            // Only add media fields if mediaUrl is provided
            if (mediaUrl) {
                messageData.mediaUrl = mediaUrl;

                // Detect media type from URL extension
                const urlLower = mediaUrl.toLowerCase();
                if (urlLower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/)) {
                    messageData.mediaType = 'image';
                } else if (urlLower.match(/\.(mp4|mov|avi|webm|mkv)(\?|$)/)) {
                    messageData.mediaType = 'video';
                } else if (urlLower.match(/\.(mp3|ogg|wav|aac|m4a|opus)(\?|$)/)) {
                    messageData.mediaType = 'audio';
                } else if (urlLower.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|csv)(\?|$)/)) {
                    messageData.mediaType = 'document';
                } else {
                    messageData.mediaType = 'file'; // Generic fallback
                }
            }

            await prisma.message.create({ data: messageData });
            console.log(`[InboxService] Outgoing message saved to database`);

            // Increment user quota usage
            const device = await prisma.device.findUnique({
                where: { id: conversation.deviceId },
                select: { userId: true }
            });
            if (device?.userId) {
                await prisma.user.update({
                    where: { id: device.userId },
                    data: { used: { increment: 1 } }
                });
                console.log(`[InboxService] Quota incremented for user ${device.userId}`);
            }
        } catch (error) {
            console.error('[InboxService] Error saving outgoing message:', error);
            // Don't throw - message was still sent successfully
        }

        // Update conversation
        await this.updateConversationWithMessage(
            conversation.deviceId,
            conversation.remoteJid,
            message,
            false
        );

        return result;
    }

    /**
     * Toggle pin status
     */
    async togglePin(userId, conversationId) {
        // Verify ownership via device
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { device: { select: { userId: true } } }
        });

        if (!conversation || conversation.device.userId !== userId) {
            throw new Error('Conversation not found');
        }

        return prisma.conversation.update({
            where: { id: conversationId },
            data: { isPinned: !conversation.isPinned }
        });
    }

    /**
     * Toggle archive status
     */
    async toggleArchive(userId, conversationId) {
        // Verify ownership via device
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { device: { select: { userId: true } } }
        });

        if (!conversation || conversation.device.userId !== userId) {
            throw new Error('Conversation not found');
        }

        return prisma.conversation.update({
            where: { id: conversationId },
            data: { isArchived: !conversation.isArchived }
        });
    }

    /**
     * Get total unread count for user
     */
    async getUnreadCount(userId) {
        const devices = await prisma.device.findMany({
            where: { userId },
            select: { id: true }
        });
        const deviceIds = devices.map(d => d.id);

        const result = await prisma.conversation.aggregate({
            where: {
                deviceId: { in: deviceIds },
                isArchived: false
            },
            _sum: { unreadCount: true }
        });

        return result._sum.unreadCount || 0;
    }

    // ==================== QUICK REPLIES ====================

    /**
     * Get all quick replies for a user
     */
    async getQuickReplies(userId) {
        return prisma.quickReply.findMany({
            where: { userId },
            orderBy: { shortcut: 'asc' }
        });
    }

    /**
     * Create a quick reply
     */
    async createQuickReply(userId, shortcut, content) {
        // Ensure shortcut starts with /
        const normalizedShortcut = shortcut.startsWith('/') ? shortcut : `/${shortcut}`;

        return prisma.quickReply.create({
            data: {
                userId,
                shortcut: normalizedShortcut,
                content
            }
        });
    }

    /**
     * Update a quick reply
     */
    async updateQuickReply(userId, id, data) {
        const quickReply = await prisma.quickReply.findFirst({
            where: { id, userId }
        });

        if (!quickReply) {
            throw new Error('Quick reply not found');
        }

        if (data.shortcut) {
            data.shortcut = data.shortcut.startsWith('/') ? data.shortcut : `/${data.shortcut}`;
        }

        return prisma.quickReply.update({
            where: { id },
            data
        });
    }

    /**
     * Delete a quick reply
     */
    async deleteQuickReply(userId, id) {
        const quickReply = await prisma.quickReply.findFirst({
            where: { id, userId }
        });

        if (!quickReply) {
            throw new Error('Quick reply not found');
        }

        return prisma.quickReply.delete({ where: { id } });
    }

    /**
     * Find quick reply by shortcut
     */
    async findQuickReplyByShortcut(userId, shortcut) {
        return prisma.quickReply.findUnique({
            where: {
                userId_shortcut: { userId, shortcut }
            }
        });
    }
}

module.exports = InboxService;
