const prisma = require('../utils/prisma');

/**
 * Analytics Service
 * Provides aggregated statistics and reporting for the messaging platform
 */

// Helper to get date range
const getDateRange = (period = '7d') => {
    const now = new Date();
    const startDate = new Date();

    switch (period) {
        case '24h':
            startDate.setHours(startDate.getHours() - 24);
            break;
        case '7d':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case '30d':
            startDate.setDate(startDate.getDate() - 30);
            break;
        case '90d':
            startDate.setDate(startDate.getDate() - 90);
            break;
        case '1y':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        default:
            startDate.setDate(startDate.getDate() - 7);
    }

    return { startDate, endDate: now };
};

// ==================== Message Analytics ====================

const getMessageStats = async (userId, period = '7d', deviceId = null) => {
    const { startDate, endDate } = getDateRange(period);

    // Get devices for this user
    const devices = await prisma.device.findMany({
        where: { userId },
        select: { id: true }
    });
    const deviceIds = deviceId ? [deviceId] : devices.map(d => d.id);

    if (deviceIds.length === 0) {
        return {
            summary: {
                total: 0,
                incoming: 0,
                outgoing: 0,
                delivered: 0,
                read: 0,
                failed: 0,
                deliveryRate: 0,
                readRate: 0
            },
            chartData: []
        };
    }

    // Get message counts
    const [total, incoming, outgoing, delivered, read, failed] = await Promise.all([
        prisma.message.count({
            where: {
                deviceId: { in: deviceIds },
                createdAt: { gte: startDate, lte: endDate }
            }
        }),
        prisma.message.count({
            where: {
                deviceId: { in: deviceIds },
                type: 'incoming',
                createdAt: { gte: startDate, lte: endDate }
            }
        }),
        prisma.message.count({
            where: {
                deviceId: { in: deviceIds },
                type: 'outgoing',
                createdAt: { gte: startDate, lte: endDate }
            }
        }),
        prisma.message.count({
            where: {
                deviceId: { in: deviceIds },
                status: 'delivered',
                createdAt: { gte: startDate, lte: endDate }
            }
        }),
        prisma.message.count({
            where: {
                deviceId: { in: deviceIds },
                status: 'read',
                createdAt: { gte: startDate, lte: endDate }
            }
        }),
        prisma.message.count({
            where: {
                deviceId: { in: deviceIds },
                status: 'failed',
                createdAt: { gte: startDate, lte: endDate }
            }
        })
    ]);

    // Get messages grouped by day
    const messages = await prisma.message.findMany({
        where: {
            deviceId: { in: deviceIds },
            createdAt: { gte: startDate, lte: endDate }
        },
        select: {
            createdAt: true,
            type: true
        }
    });

    // Group by day
    const byDay = {};
    for (const msg of messages) {
        const day = msg.createdAt.toISOString().split('T')[0];
        if (!byDay[day]) {
            byDay[day] = { incoming: 0, outgoing: 0 };
        }
        if (msg.type === 'incoming') byDay[day].incoming++;
        else byDay[day].outgoing++;
    }

    // Convert to array and fill missing days
    const chartData = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const day = currentDate.toISOString().split('T')[0];
        chartData.push({
            date: day,
            incoming: byDay[day]?.incoming || 0,
            outgoing: byDay[day]?.outgoing || 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
        summary: {
            total,
            incoming,
            outgoing,
            delivered,
            read,
            failed,
            deliveryRate: outgoing > 0 ? ((delivered + read) / outgoing * 100).toFixed(1) : 0,
            readRate: delivered > 0 ? (read / delivered * 100).toFixed(1) : 0
        },
        chartData: chartData.slice(-30) // Last 30 data points
    };
};

// ==================== Device Analytics ====================

const getDeviceStats = async (userId, period = '7d') => {
    const { startDate, endDate } = getDateRange(period);

    const devices = await prisma.device.findMany({
        where: { userId },
        include: {
            messages: {
                where: {
                    createdAt: { gte: startDate, lte: endDate }
                },
                select: {
                    type: true,
                    status: true
                }
            }
        }
    });

    const deviceStats = devices.map(device => {
        const incoming = device.messages.filter(m => m.type === 'incoming').length;
        const outgoing = device.messages.filter(m => m.type === 'outgoing').length;
        const delivered = device.messages.filter(m => m.status === 'delivered' || m.status === 'read').length;
        const failed = device.messages.filter(m => m.status === 'failed').length;

        return {
            id: device.id,
            name: device.name,
            phone: device.phone,
            status: device.status,
            messageCount: device.messages.length,
            incoming,
            outgoing,
            delivered,
            failed,
            deliveryRate: outgoing > 0 ? ((delivered / outgoing) * 100).toFixed(1) : 0
        };
    });

    return {
        devices: deviceStats,
        summary: {
            totalDevices: devices.length,
            connectedDevices: devices.filter(d => d.status === 'connected').length,
            totalMessages: deviceStats.reduce((sum, d) => sum + d.messageCount, 0)
        }
    };
};

// ==================== Broadcast Analytics ====================

const getBroadcastStats = async (userId, period = '7d') => {
    const { startDate, endDate } = getDateRange(period);

    const devices = await prisma.device.findMany({
        where: { userId },
        select: { id: true }
    });
    const deviceIds = devices.map(d => d.id);

    if (deviceIds.length === 0) {
        return {
            summary: {
                totalBroadcasts: 0,
                totalRecipients: 0,
                totalSent: 0,
                totalDelivered: 0,
                totalRead: 0,
                totalFailed: 0,
                avgDeliveryRate: 0
            },
            recentBroadcasts: []
        };
    }

    const broadcasts = await prisma.broadcast.findMany({
        where: {
            deviceId: { in: deviceIds },
            createdAt: { gte: startDate, lte: endDate }
        },
        include: {
            device: {
                select: { name: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    const summary = {
        totalBroadcasts: broadcasts.length,
        totalRecipients: broadcasts.reduce((sum, b) => sum + b.totalRecipients, 0),
        totalSent: broadcasts.reduce((sum, b) => sum + b.sent, 0),
        totalDelivered: broadcasts.reduce((sum, b) => sum + b.delivered, 0),
        totalRead: broadcasts.reduce((sum, b) => sum + b.read, 0),
        totalFailed: broadcasts.reduce((sum, b) => sum + b.failed, 0)
    };

    summary.avgDeliveryRate = summary.totalSent > 0
        ? ((summary.totalDelivered / summary.totalSent) * 100).toFixed(1)
        : 0;

    const recentBroadcasts = broadcasts.slice(0, 10).map(b => ({
        id: b.id,
        name: b.name,
        deviceName: b.device?.name,
        status: b.status,
        recipients: b.totalRecipients,
        sent: b.sent,
        delivered: b.delivered,
        read: b.read,
        failed: b.failed,
        createdAt: b.createdAt
    }));

    return { summary, recentBroadcasts };
};

// ==================== Chatbot Analytics ====================

const getChatbotStats = async (userId, period = '7d') => {
    const chatbots = await prisma.chatbot.findMany({
        where: { userId },
        include: {
            device: {
                select: { name: true }
            }
        }
    });

    const chatbotStats = chatbots.map(chatbot => {
        let nodeCount = 0;
        try {
            nodeCount = JSON.parse(chatbot.nodes || '[]').length;
        } catch (e) {
            nodeCount = 0;
        }
        return {
            id: chatbot.id,
            name: chatbot.name,
            deviceName: chatbot.device?.name || 'All Devices',
            isActive: chatbot.isActive,
            triggerType: chatbot.triggerType,
            executionCount: chatbot.executionCount || 0,
            lastExecutedAt: chatbot.lastExecutedAt,
            nodeCount
        };
    });

    const summary = {
        totalChatbots: chatbots.length,
        activeChatbots: chatbots.filter(c => c.isActive).length,
        totalExecutions: chatbots.reduce((sum, c) => sum + (c.executionCount || 0), 0)
    };

    // Top performing chatbots
    const topChatbots = [...chatbotStats]
        .sort((a, b) => b.executionCount - a.executionCount)
        .slice(0, 5);

    return { summary, chatbots: chatbotStats, topChatbots };
};

// ==================== Auto Reply Analytics ====================

const getAutoReplyStats = async (userId) => {
    // Multi-tenant: filter rules by userId directly
    const rules = await prisma.autoReplyRule.findMany({
        where: {
            userId: userId
        },
        include: {
            device: {
                select: { name: true }
            }
        },
        orderBy: { triggerCount: 'desc' }
    });

    const summary = {
        totalRules: rules.length,
        activeRules: rules.filter(r => r.isActive).length,
        totalTriggers: rules.reduce((sum, r) => sum + r.triggerCount, 0)
    };

    const ruleStats = rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        trigger: rule.trigger,
        triggerType: rule.triggerType,
        isActive: rule.isActive,
        triggerCount: rule.triggerCount,
        deviceName: rule.device?.name || 'All Devices'
    }));

    return { summary, rules: ruleStats };
};

// ==================== Overview Analytics ====================

const getOverviewStats = async (userId, period = '7d') => {
    const [messages, devices, broadcasts, chatbots, autoReplies] = await Promise.all([
        getMessageStats(userId, period),
        getDeviceStats(userId, period),
        getBroadcastStats(userId, period),
        getChatbotStats(userId, period),
        getAutoReplyStats(userId)
    ]);

    return {
        messages: messages.summary,
        devices: devices.summary,
        broadcasts: broadcasts.summary,
        chatbots: chatbots.summary,
        autoReplies: autoReplies.summary,
        messageChart: messages.chartData
    };
};

// ==================== Export Functions ====================

const exportMessagesToCSV = async (userId, period = '30d') => {
    const { startDate, endDate } = getDateRange(period);

    const devices = await prisma.device.findMany({
        where: { userId },
        select: { id: true }
    });
    const deviceIds = devices.map(d => d.id);

    if (deviceIds.length === 0) {
        return 'Date,Device,Type,From/To,Message,Status\n';
    }

    const messages = await prisma.message.findMany({
        where: {
            deviceId: { in: deviceIds },
            createdAt: { gte: startDate, lte: endDate }
        },
        include: {
            device: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Generate CSV
    const headers = ['Date', 'Device', 'Type', 'From/To', 'Message', 'Status'];
    const rows = messages.map(m => [
        m.createdAt.toISOString(),
        m.device?.name || 'Unknown',
        m.type,
        m.type === 'incoming' ? m.from : m.to,
        (m.message || '').replace(/"/g, '""'),
        m.status
    ]);

    const csv = [
        headers.join(','),
        ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
};

module.exports = {
    getMessageStats,
    getDeviceStats,
    getBroadcastStats,
    getChatbotStats,
    getAutoReplyStats,
    getOverviewStats,
    exportMessagesToCSV
};
