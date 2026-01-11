const express = require('express');
const { protect } = require('../middleware/auth');
const securityService = require('../services/securityService');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

/**
 * GET /api/security/audit-logs
 * Get audit logs for the authenticated user
 */
router.get('/audit-logs', async (req, res) => {
    try {
        const { action, resource, startDate, endDate, page = 1, limit = 50 } = req.query;

        const result = await securityService.getAuditLogs({
            userId: req.user.id,
            action,
            resource,
            startDate,
            endDate,
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 100) // Max 100 per page
        });

        res.json({
            success: true,
            data: result.logs,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit logs'
        });
    }
});

/**
 * GET /api/security/sessions
 * Get active sessions for the authenticated user
 */
router.get('/sessions', async (req, res) => {
    try {
        const sessions = await securityService.getUserSessions(req.user.id);

        // Mark current session
        const sessionsWithCurrent = sessions.map(session => ({
            ...session,
            isCurrent: false // We can't easily detect this without storing token hash
        }));

        res.json({
            success: true,
            data: sessionsWithCurrent
        });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sessions'
        });
    }
});

/**
 * DELETE /api/security/sessions/:id
 * Revoke a specific session
 */
router.delete('/sessions/:id', async (req, res) => {
    try {
        await securityService.revokeSession(req.params.id, req.user.id);

        // Log the action
        await securityService.logAction.update(
            req.user.id,
            'sessions',
            req.params.id,
            { action: 'revoke' },
            req.ip
        );

        res.json({
            success: true,
            message: 'Session revoked successfully'
        });
    } catch (error) {
        console.error('Error revoking session:', error);

        if (error.message === 'Session not found') {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to revoke session'
        });
    }
});

/**
 * POST /api/security/sessions/revoke-all
 * Revoke all sessions except current
 */
router.post('/sessions/revoke-all', async (req, res) => {
    try {
        const currentToken = req.headers.authorization?.replace('Bearer ', '');
        const count = await securityService.revokeAllSessions(req.user.id, currentToken);

        // Log the action
        await securityService.logAction.update(
            req.user.id,
            'sessions',
            null,
            { action: 'revoke_all', count },
            req.ip
        );

        res.json({
            success: true,
            message: `${count} session(s) revoked successfully`
        });
    } catch (error) {
        console.error('Error revoking all sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to revoke sessions'
        });
    }
});

/**
 * GET /api/security/stats
 * Get security statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const [sessions, recentLogs] = await Promise.all([
            securityService.getUserSessions(req.user.id),
            securityService.getAuditLogs({
                userId: req.user.id,
                limit: 10
            })
        ]);

        // Count login attempts in last 24 hours
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const loginAttempts = await securityService.getAuditLogs({
            userId: req.user.id,
            action: 'login',
            startDate: oneDayAgo.toISOString(),
            limit: 100
        });

        res.json({
            success: true,
            data: {
                activeSessions: sessions.length,
                recentActivity: recentLogs.logs,
                loginAttemptsLast24h: loginAttempts.pagination.total
            }
        });
    } catch (error) {
        console.error('Error fetching security stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch security stats'
        });
    }
});

/**
 * GET /api/security/activity
 * Get recent activity summary
 */
router.get('/activity', async (req, res) => {
    try {
        const { days = 7 } = req.query;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const result = await securityService.getAuditLogs({
            userId: req.user.id,
            startDate: startDate.toISOString(),
            limit: 200
        });

        // Group by action
        const activityByAction = {};
        for (const log of result.logs) {
            if (!activityByAction[log.action]) {
                activityByAction[log.action] = 0;
            }
            activityByAction[log.action]++;
        }

        // Group by day
        const activityByDay = {};
        for (const log of result.logs) {
            const day = log.createdAt.toISOString().split('T')[0];
            if (!activityByDay[day]) {
                activityByDay[day] = 0;
            }
            activityByDay[day]++;
        }

        res.json({
            success: true,
            data: {
                total: result.pagination.total,
                byAction: activityByAction,
                byDay: activityByDay,
                logs: result.logs.slice(0, 50) // Last 50 entries
            }
        });
    } catch (error) {
        console.error('Error fetching activity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch activity'
        });
    }
});

module.exports = router;
