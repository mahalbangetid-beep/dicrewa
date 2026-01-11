const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect } = require('../middleware/auth');
const { successResponse } = require('../utils/response');

// Middleware: Only monitoring or admin can access
const monitoringAccess = (req, res, next) => {
    if (req.user.role !== 'monitoring' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Monitoring role required.' });
    }
    next();
};

router.use(protect);
router.use(monitoringAccess);

/**
 * GET /api/monitoring/dashboard
 * Main dashboard stats
 */
router.get('/dashboard', async (req, res, next) => {
    try {
        const [
            totalMessagesIncoming,
            totalMessagesOutgoing,
            totalMessagesFailed,
            totalUsers,
            totalApiKeys
        ] = await Promise.all([
            prisma.message.count({ where: { type: 'incoming' } }),
            prisma.message.count({ where: { type: 'outgoing', status: { not: 'failed' } } }),
            prisma.message.count({ where: { type: 'outgoing', status: 'failed' } }),
            prisma.user.count(),
            prisma.apiKey.count()
        ]);

        // API Traffic (sum of usageCount if exists, otherwise 0)
        const apiTraffic = await prisma.apiKey.aggregate({
            _sum: { usageCount: true }
        });

        successResponse(res, {
            messages: {
                incoming: totalMessagesIncoming,
                outgoing: totalMessagesOutgoing,
                failed: totalMessagesFailed,
                total: totalMessagesIncoming + totalMessagesOutgoing
            },
            users: {
                total: totalUsers
            },
            apiKeys: {
                total: totalApiKeys,
                totalRequests: apiTraffic._sum.usageCount || 0
            },
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/monitoring/users
 * User breakdown by plan
 */
router.get('/users', async (req, res, next) => {
    try {
        const [total, planBreakdown] = await Promise.all([
            prisma.user.count(),
            prisma.user.groupBy({
                by: ['plan'],
                _count: { id: true }
            })
        ]);

        const plans = {
            free: 0,
            pro: 0,
            enterprise: 0,
            unlimited: 0
        };

        planBreakdown.forEach(p => {
            if (plans.hasOwnProperty(p.plan)) {
                plans[p.plan] = p._count.id;
            }
        });

        successResponse(res, {
            total,
            byPlan: plans,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/monitoring/connections
 * Device connection stats
 */
router.get('/connections', async (req, res, next) => {
    try {
        const [total, statusBreakdown] = await Promise.all([
            prisma.device.count(),
            prisma.device.groupBy({
                by: ['status'],
                _count: { id: true }
            })
        ]);

        const statuses = {
            connected: 0,
            disconnected: 0,
            connecting: 0,
            qr: 0
        };

        statusBreakdown.forEach(s => {
            if (statuses.hasOwnProperty(s.status)) {
                statuses[s.status] = s._count.id;
            }
        });

        successResponse(res, {
            total,
            byStatus: statuses,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/monitoring/integrations
 * Integration breakdown by type
 */
router.get('/integrations', async (req, res, next) => {
    try {
        const [total, typeBreakdown] = await Promise.all([
            prisma.integration.count(),
            prisma.integration.groupBy({
                by: ['type'],
                _count: { id: true }
            })
        ]);

        const types = {};
        typeBreakdown.forEach(t => {
            types[t.type] = t._count.id;
        });

        successResponse(res, {
            total,
            byType: types,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/monitoring/chatbots
 * Chatbot stats
 */
router.get('/chatbots', async (req, res, next) => {
    try {
        const [total, activeCount] = await Promise.all([
            prisma.chatbot.count(),
            prisma.chatbot.count({ where: { isActive: true } })
        ]);

        // Count active sessions (sessions with activity in last 30 minutes)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        let activeSessions = 0;

        try {
            activeSessions = await prisma.chatbotSession.count({
                where: {
                    updatedAt: { gte: thirtyMinutesAgo }
                }
            });
        } catch (e) {
            // ChatbotSession table might not exist yet
            activeSessions = 0;
        }

        successResponse(res, {
            total,
            active: activeCount,
            activeSessions,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/monitoring/broadcasts
 * Broadcast stats
 */
router.get('/broadcasts', async (req, res, next) => {
    try {
        const [total, statusBreakdown] = await Promise.all([
            prisma.broadcast.count(),
            prisma.broadcast.groupBy({
                by: ['status'],
                _count: { id: true }
            })
        ]);

        const statuses = {
            pending: 0,
            running: 0,
            completed: 0,
            failed: 0
        };

        statusBreakdown.forEach(s => {
            if (statuses.hasOwnProperty(s.status)) {
                statuses[s.status] = s._count.id;
            }
        });

        successResponse(res, {
            total,
            byStatus: statuses,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/monitoring/contacts
 * Contact stats
 */
router.get('/contacts', async (req, res, next) => {
    try {
        const [totalContacts, totalWithEmail] = await Promise.all([
            prisma.contact.count(),
            prisma.contact.count({ where: { email: { not: null } } })
        ]);

        successResponse(res, {
            total: totalContacts,
            withEmail: totalWithEmail,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/monitoring/contacts/export
 * Export contacts or emails
 */
router.get('/contacts/export', async (req, res, next) => {
    try {
        const { type = 'contact' } = req.query;

        if (type === 'email') {
            const contacts = await prisma.contact.findMany({
                where: { email: { not: null } },
                select: { email: true }
            });

            const csv = 'email\n' + contacts.map(c => c.email).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=emails.csv');
            return res.send(csv);
        } else {
            const contacts = await prisma.contact.findMany({
                select: { name: true, phone: true, email: true, createdAt: true }
            });

            const csv = 'name,phone,email,created_at\n' +
                contacts.map(c => `"${c.name || ''}","${c.phone || ''}","${c.email || ''}","${c.createdAt?.toISOString() || ''}"`).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
            return res.send(csv);
        }
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/monitoring/webhooks
 * Webhook stats
 */
router.get('/webhooks', async (req, res, next) => {
    try {
        const [total, activeCount] = await Promise.all([
            prisma.webhook.count(),
            prisma.webhook.count({ where: { isActive: true } })
        ]);

        successResponse(res, {
            total,
            active: activeCount,
            inactive: total - activeCount,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
