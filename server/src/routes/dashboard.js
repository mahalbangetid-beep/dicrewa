const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect } = require('../middleware/auth');
const { successResponse } = require('../utils/response');

router.use(protect);

router.get('/', async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Parallel Data Fetching for Performance
        const [
            deviceCount,
            connectedDeviceCount,
            contactCount,
            messageStats,
            recentMessages,
            broadcastCount
        ] = await Promise.all([
            // 1. Total Devices
            prisma.device.count({ where: { userId } }),

            // 2. Connected Devices
            prisma.device.count({ where: { userId, status: 'connected' } }),

            // 3. Contacts (filtered by userId for multi-tenant)
            prisma.contact.count({ where: { userId } }),

            // 4. Message Stats (Sent vs Received)
            prisma.message.groupBy({
                by: ['type'],
                where: {
                    device: { userId }
                },
                _count: {
                    id: true
                }
            }),

            // 5. Recent Messages (for list)
            prisma.message.findMany({
                where: { device: { userId } },
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: { device: { select: { name: true } } }
            }),

            // 6. Active Broadcasts
            prisma.broadcast.count({
                where: {
                    device: { userId },
                    status: { in: ['running', 'scheduled'] }
                }
            })
        ]);

        // Process Message Stats
        let sentCount = 0;
        let receivedCount = 0;
        messageStats.forEach(stat => {
            if (stat.type === 'outgoing') sentCount = stat._count.id;
            if (stat.type === 'incoming') receivedCount = stat._count.id;
        });

        // 7. Get Chart Data (Last 7 days volume)
        // OPTIMIZED: Use raw SQL for database-side aggregation instead of loading all rows
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // SQLite compatible date aggregation
        const dailyStats = await prisma.$queryRaw`
            SELECT 
                DATE(m.createdAt) as date,
                m.type,
                COUNT(*) as count
            FROM Message m
            JOIN Device d ON m.deviceId = d.id
            WHERE d.userId = ${userId} 
            AND m.createdAt >= ${sevenDaysAgo.toISOString()}
            GROUP BY DATE(m.createdAt), m.type
            ORDER BY date ASC
        `;

        // Pre-initialize daily counts for the last 7 days
        const dailyCounts = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dailyCounts[dateStr] = {
                name: d.toLocaleDateString('en-US', { weekday: 'short' }),
                sent: 0,
                received: 0
            };
        }

        // Apply aggregated results from database
        for (const stat of dailyStats) {
            const dateStr = stat.date;
            if (dailyCounts[dateStr]) {
                if (stat.type === 'outgoing') {
                    dailyCounts[dateStr].sent = Number(stat.count);
                } else if (stat.type === 'incoming') {
                    dailyCounts[dateStr].received = Number(stat.count);
                }
            }
        }

        // Convert to array (maintains chronological order)
        const chartData = Object.values(dailyCounts);

        // 8. Get User Plan/Quota
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true, quota: true, used: true }
        });

        // Ensure quota is set based on plan if not explicitly defined
        const planQuotas = {
            free: 1500,
            pro: 5000,
            enterprise: 15000,
            unlimited: 0 // handled as special case (Infinity)
        };

        if (user && (!user.quota || user.quota === 0)) {
            user.quota = planQuotas[user.plan?.toLowerCase()] || 1500;
        }

        const stats = {
            totalDevices: deviceCount,
            onlineDevices: connectedDeviceCount,
            totalContacts: contactCount,
            totalMessages: sentCount + receivedCount,
            messagesSent: sentCount,
            messagesReceived: receivedCount,
            activeBroadcasts: broadcastCount,
            subscription: user, // user.plan, user.quota, user.used
            recentActivity: recentMessages.map(m => ({
                id: m.id,
                action: m.type === 'outgoing' ? 'Message Sent' : 'Message Received',
                target: m.to || m.from,
                time: m.createdAt,
                status: m.status,
                device: m.device.name
            })),
            overview: chartData
        };

        successResponse(res, stats);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
