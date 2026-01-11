const prisma = require('../utils/prisma');
const knowledgeService = require('./knowledgeService');
const quotaService = require('./quotaService');

/**
 * Chatbot Service
 * Handles all chatbot-related business logic
 */

/**
 * Get all chatbots for a user
 */
const getChatbots = async (userId) => {
    return await prisma.chatbot.findMany({
        where: { userId },
        include: {
            device: {
                select: { id: true, name: true, phone: true, status: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
};

/**
 * Get a single chatbot by ID
 */
const getChatbotById = async (id, userId) => {
    return await prisma.chatbot.findFirst({
        where: { id, userId },
        include: {
            device: {
                select: { id: true, name: true, phone: true, status: true }
            }
        }
    });
};

/**
 * Create a new chatbot
 */
const createChatbot = async (data, userId) => {
    const { name, description, deviceId, triggerType, triggerKeywords, nodes, edges } = data;

    return await prisma.chatbot.create({
        data: {
            name,
            description,
            deviceId: deviceId || null,
            triggerType: triggerType || 'keyword',
            triggerKeywords: triggerKeywords || '',
            nodes: JSON.stringify(nodes || []),
            edges: JSON.stringify(edges || []),
            userId
        },
        include: {
            device: {
                select: { id: true, name: true, phone: true, status: true }
            }
        }
    });
};

/**
 * Update a chatbot
 */
const updateChatbot = async (id, data, userId) => {
    // First check if chatbot exists and belongs to user
    const existing = await prisma.chatbot.findFirst({
        where: { id, userId }
    });

    if (!existing) {
        throw new Error('Chatbot not found');
    }

    const updateData = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.deviceId !== undefined) updateData.deviceId = data.deviceId || null;
    if (data.triggerType !== undefined) updateData.triggerType = data.triggerType;
    if (data.triggerKeywords !== undefined) updateData.triggerKeywords = data.triggerKeywords;
    if (data.nodes !== undefined) updateData.nodes = JSON.stringify(data.nodes);
    if (data.edges !== undefined) updateData.edges = JSON.stringify(data.edges);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return await prisma.chatbot.update({
        where: { id },
        data: updateData,
        include: {
            device: {
                select: { id: true, name: true, phone: true, status: true }
            }
        }
    });
};

/**
 * Delete a chatbot
 */
const deleteChatbot = async (id, userId) => {
    const existing = await prisma.chatbot.findFirst({
        where: { id, userId }
    });

    if (!existing) {
        throw new Error('Chatbot not found');
    }

    return await prisma.chatbot.delete({
        where: { id }
    });
};

/**
 * Toggle chatbot active status
 */
const toggleChatbot = async (id, userId, isActive) => {
    const existing = await prisma.chatbot.findFirst({
        where: { id, userId }
    });

    if (!existing) {
        throw new Error('Chatbot not found');
    }

    return await prisma.chatbot.update({
        where: { id },
        data: { isActive },
        include: {
            device: {
                select: { id: true, name: true, phone: true, status: true }
            }
        }
    });
};

/**
 * Execute chatbot flow for incoming message
 * @param {string} deviceId - Device ID
 * @param {string} senderId - Sender's WhatsApp JID
 * @param {string} messageText - Incoming message text
 * @param {Function} sendMessageCallback - Callback to send messages: (deviceId, to, text, options) => Promise
 * @param {string} userId - User ID for quota tracking (optional)
 * @returns {Object|null} - Execution result or null if no chatbot triggered
 */
const executeChatbotFlow = async (deviceId, senderId, messageText, sendMessageCallback = null, userId = null) => {
    // Find active chatbots for this device (also get userId from chatbot if not provided)
    const chatbots = await prisma.chatbot.findMany({
        where: {
            isActive: true,
            OR: [
                { deviceId: deviceId },
                { deviceId: null }
            ]
        }
    });

    for (const chatbot of chatbots) {
        const shouldTrigger = checkTrigger(chatbot, messageText);

        if (shouldTrigger) {
            const nodes = JSON.parse(chatbot.nodes || '[]');
            const edges = JSON.parse(chatbot.edges || '[]');

            // Use provided userId or get from chatbot
            const effectiveUserId = userId || chatbot.userId;

            console.log(`[Chatbot] Executing flow "${chatbot.name}" for ${senderId} (userId: ${effectiveUserId})`);

            // Execute flow with real-time message sending and quota tracking
            const result = await executeFlow(nodes, edges, messageText, senderId, {
                deviceId,
                sendMessage: sendMessageCallback,
                userId: effectiveUserId
            });

            // Update execution count
            await prisma.chatbot.update({
                where: { id: chatbot.id },
                data: {
                    executionCount: { increment: 1 },
                    lastExecutedAt: new Date()
                }
            });

            if (result.messagesSent > 0) {
                return {
                    chatbotId: chatbot.id,
                    chatbotName: chatbot.name,
                    messagesSent: result.messagesSent,
                    responses: result.responses // Keep for backward compatibility
                };
            }
        }
    }

    return null;
};

/**
 * Check if message triggers the chatbot
 */
const checkTrigger = (chatbot, messageText) => {
    switch (chatbot.triggerType) {
        case 'all':
            return true;

        case 'keyword':
            if (!chatbot.triggerKeywords) return false;
            const keywords = chatbot.triggerKeywords.split(',').map(k => k.trim().toLowerCase());
            const messageLower = messageText.toLowerCase();
            return keywords.some(keyword => messageLower.includes(keyword));

        case 'exact':
            if (!chatbot.triggerKeywords) return false;
            const exactKeywords = chatbot.triggerKeywords.split(',').map(k => k.trim().toLowerCase());
            return exactKeywords.includes(messageText.toLowerCase().trim());

        case 'regex':
            if (!chatbot.triggerKeywords) return false;
            try {
                const regex = new RegExp(chatbot.triggerKeywords, 'i');
                return regex.test(messageText);
            } catch {
                return false;
            }

        default:
            return false;
    }
};

/**
 * Execute the flow with real-time message sending
 * Messages are sent IMMEDIATELY when encountered, delays are REAL delays between messages
 * 
 * @param {Array} nodes - Flow nodes
 * @param {Array} edges - Flow edges
 * @param {string} messageText - Original message
 * @param {string} senderId - Sender JID
 * @param {Object} options - { deviceId, sendMessage: callback, userId: string }
 */
const executeFlow = async (nodes, edges, messageText, senderId, options = {}) => {
    const responses = []; // Keep for backward compatibility
    let messagesSent = 0;
    let quotaExceeded = false;

    // Find start node
    const startNode = nodes.find(n => n.type === 'startNode');
    if (!startNode) return { responses, messagesSent };

    // BFS through the flow
    const queue = [startNode.id];
    const visited = new Set();
    const context = {
        message: messageText,
        senderId,
        variables: {},
        deviceId: options.deviceId,
        sendMessage: options.sendMessage,
        userId: options.userId
    };

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const node = nodes.find(n => n.id === currentId);
        if (!node) continue;

        const result = await processNode(node, context);

        // If there's a response and we have a sendMessage callback, send it immediately
        if (result.response && context.sendMessage) {
            // Check quota before sending (if userId available)
            if (context.userId && !quotaExceeded) {
                const quotaCheck = await quotaService.checkAndIncrement(context.userId, 1);
                if (!quotaCheck.allowed) {
                    console.log(`[Chatbot] Quota exceeded for user ${context.userId}, stopping flow`);
                    quotaExceeded = true;
                    break; // Stop sending more messages
                }
            }

            try {
                if (result.response.mediaUrl && result.response.mediaType === 'image') {
                    await context.sendMessage(context.deviceId, senderId, result.response.message, {
                        type: 'image',
                        mediaUrl: result.response.mediaUrl
                    });
                } else {
                    await context.sendMessage(context.deviceId, senderId, result.response.message);
                }
                messagesSent++;
                console.log(`[Chatbot] Sent message #${messagesSent} to ${senderId}`);
            } catch (err) {
                console.error(`[Chatbot] Failed to send message:`, err.message);
            }
        }

        // Also collect for backward compatibility (when no callback provided)
        if (result.response) {
            responses.push(result.response);
        }

        // Find next nodes
        let nextEdges = edges.filter(e => e.source === currentId);

        // For condition nodes, filter by the condition result
        if (node.type === 'conditionNode' && result.conditionResult !== undefined) {
            const handleSuffix = result.conditionResult ? 'yes' : 'no';
            nextEdges = nextEdges.filter(e =>
                e.sourceHandle === handleSuffix ||
                e.sourceHandle === `${handleSuffix}-handle`
            );
        }

        nextEdges.forEach(edge => {
            if (!visited.has(edge.target)) {
                queue.push(edge.target);
            }
        });
    }

    return { responses, messagesSent };
};

/**
 * Process a single node
 */
const processNode = async (node, context) => {
    const result = {};

    switch (node.type) {
        case 'startNode':
            // Start node - just pass through
            break;

        case 'messageNode':
            let message = node.data?.message || '';
            // Replace variables
            message = message.replace(/\{\{message\}\}/g, context.message);
            message = message.replace(/\{\{senderId\}\}/g, context.senderId);
            Object.keys(context.variables).forEach(key => {
                message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), context.variables[key]);
            });

            result.response = {
                type: 'message',
                message,
                mediaUrl: node.data?.mediaUrl,
                mediaType: node.data?.mediaType
            };
            break;

        case 'conditionNode':
            const field = node.data?.field || 'message';
            const operator = node.data?.operator || 'contains';
            const value = node.data?.value || '';

            let fieldValue = field === 'message' ? context.message : context.variables[field] || '';

            switch (operator) {
                case 'contains':
                    result.conditionResult = fieldValue.toLowerCase().includes(value.toLowerCase());
                    break;
                case 'equals':
                    result.conditionResult = fieldValue.toLowerCase() === value.toLowerCase();
                    break;
                case 'startsWith':
                    result.conditionResult = fieldValue.toLowerCase().startsWith(value.toLowerCase());
                    break;
                case 'endsWith':
                    result.conditionResult = fieldValue.toLowerCase().endsWith(value.toLowerCase());
                    break;
                case 'regex':
                    try {
                        result.conditionResult = new RegExp(value, 'i').test(fieldValue);
                    } catch {
                        result.conditionResult = false;
                    }
                    break;
                default:
                    result.conditionResult = false;
            }
            break;

        case 'delayNode':
            const delay = parseInt(node.data?.delay) || 1;
            const unit = node.data?.unit || 'seconds';
            let ms = delay * 1000;
            if (unit === 'minutes') ms = delay * 60 * 1000;
            if (unit === 'hours') ms = delay * 60 * 60 * 1000;
            await new Promise(resolve => setTimeout(resolve, Math.min(ms, 30000))); // Max 30s delay
            break;

        case 'apiCallNode':
            // API call node - would make HTTP request in production
            result.response = {
                type: 'message',
                message: '[API Call executed]'
            };
            break;

        case 'templateNode':
            const templateId = node.data?.templateId;
            if (templateId) {
                const template = await prisma.template.findUnique({
                    where: { id: templateId }
                });
                if (template) {
                    let templateContent = template.content;
                    // Replace variables
                    templateContent = templateContent.replace(/\{\{message\}\}/g, context.message);
                    templateContent = templateContent.replace(/\{\{senderId\}\}/g, context.senderId);

                    result.response = {
                        type: 'message',
                        message: templateContent
                    };
                }
            }
            break;

        case 'knowledgeNode':
            const knowledgeBaseId = node.data?.knowledgeBaseId;
            if (knowledgeBaseId) {
                try {
                    // Get user from knowledge base to check quota
                    const knowledgeBase = await prisma.knowledgeBase.findUnique({
                        where: { id: knowledgeBaseId },
                        include: { user: { select: { id: true, plan: true, embeddingApiKey: true } } }
                    });

                    if (knowledgeBase && knowledgeBase.status === 'ready') {
                        const user = knowledgeBase.user;
                        const queryResult = await knowledgeService.queryKnowledge(
                            user.id,
                            context.message,
                            knowledgeBaseId
                        );

                        if (queryResult.answer) {
                            result.response = {
                                type: 'message',
                                message: queryResult.answer,
                                fromKnowledge: true
                            };
                        } else if (node.data?.fallbackMessage) {
                            // Use fallback message if no relevant answer found
                            result.response = {
                                type: 'message',
                                message: node.data.fallbackMessage
                            };
                        }
                    } else if (node.data?.fallbackMessage) {
                        // Knowledge base not ready, use fallback
                        result.response = {
                            type: 'message',
                            message: node.data.fallbackMessage
                        };
                    }
                } catch (error) {
                    console.error('[Chatbot] Knowledge node error:', error.message);
                    // On error, use fallback message if available
                    if (node.data?.fallbackMessage) {
                        result.response = {
                            type: 'message',
                            message: node.data.fallbackMessage
                        };
                    }
                }
            }
            break;
    }

    return result;
};

/**
 * Validate a chatbot flow
 */
const validateFlow = (nodes, edges) => {
    const issues = [];

    // Check for start node
    const startNodes = nodes.filter(n => n.type === 'startNode');
    if (startNodes.length === 0) {
        issues.push({ type: 'error', message: 'Flow must have a Start node' });
    } else if (startNodes.length > 1) {
        issues.push({ type: 'warning', message: 'Flow has multiple Start nodes' });
    }

    // Check for disconnected nodes
    const connectedNodes = new Set();
    edges.forEach(e => {
        connectedNodes.add(e.source);
        connectedNodes.add(e.target);
    });

    const disconnected = nodes.filter(n =>
        n.type !== 'startNode' && !connectedNodes.has(n.id)
    );

    if (disconnected.length > 0) {
        issues.push({
            type: 'warning',
            message: `${disconnected.length} node(s) are not connected to the flow`
        });
    }

    // Check message nodes have content
    nodes.forEach(node => {
        if (node.type === 'messageNode' && !node.data?.message) {
            issues.push({
                type: 'warning',
                message: `Message node "${node.data?.label || node.id}" has no content`
            });
        }
    });

    return {
        isValid: issues.filter(i => i.type === 'error').length === 0,
        issues
    };
};

module.exports = {
    getChatbots,
    getChatbotById,
    createChatbot,
    updateChatbot,
    deleteChatbot,
    toggleChatbot,
    executeChatbotFlow,
    validateFlow
};
