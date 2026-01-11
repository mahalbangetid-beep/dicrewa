const prisma = require('../utils/prisma');

/**
 * Audit Log Service
 * Handles logging of user actions for security and compliance
 */

/**
 * Create an audit log entry
 */
const createAuditLog = async ({
    userId,
    action,
    resource,
    resourceId = null,
    details = null,
    ipAddress = null,
    userAgent = null
}) => {
    try {
        return await prisma.auditLog.create({
            data: {
                userId,
                action,
                resource,
                resourceId,
                details: details ? JSON.stringify(details) : null,
                ipAddress,
                userAgent
            }
        });
    } catch (error) {
        console.error('Error creating audit log:', error);
        // Don't throw - audit logging should not break the main flow
        return null;
    }
};

/**
 * Get audit logs with filters
 */
const getAuditLogs = async ({
    userId,
    action,
    resource,
    startDate,
    endDate,
    page = 1,
    limit = 50
}) => {
    const where = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;

    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma.auditLog.count({ where })
    ]);

    return {
        logs: logs.map(log => ({
            ...log,
            details: log.details ? JSON.parse(log.details) : null
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Delete old audit logs (for maintenance)
 */
const deleteOldAuditLogs = async (daysOld = 90) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.auditLog.deleteMany({
        where: {
            createdAt: { lt: cutoffDate }
        }
    });

    return result.count;
};

// ==================== Session Management ====================

/**
 * Create a new session
 */
const createSession = async ({
    userId,
    token,
    ipAddress = null,
    userAgent = null,
    expiresInDays = 7
}) => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Detect device type from user agent
    let device = 'unknown';
    if (userAgent) {
        if (userAgent.includes('Mobile')) device = 'mobile';
        else if (userAgent.includes('Tablet')) device = 'tablet';
        else device = 'desktop';
    }

    return await prisma.session.create({
        data: {
            userId,
            token,
            ipAddress,
            userAgent,
            device,
            expiresAt,
            isActive: true
        }
    });
};

/**
 * Get active sessions for a user
 */
const getUserSessions = async (userId) => {
    return await prisma.session.findMany({
        where: {
            userId,
            isActive: true,
            expiresAt: { gt: new Date() }
        },
        orderBy: { lastActive: 'desc' },
        select: {
            id: true,
            device: true,
            ipAddress: true,
            location: true,
            lastActive: true,
            createdAt: true
        }
    });
};

/**
 * Update session last active time
 */
const updateSessionActivity = async (token) => {
    try {
        await prisma.session.update({
            where: { token },
            data: { lastActive: new Date() }
        });
    } catch (error) {
        // Session might not exist, ignore
    }
};

/**
 * Revoke a specific session
 */
const revokeSession = async (sessionId, userId) => {
    const session = await prisma.session.findFirst({
        where: { id: sessionId, userId }
    });

    if (!session) {
        throw new Error('Session not found');
    }

    await prisma.session.update({
        where: { id: sessionId },
        data: { isActive: false }
    });

    return true;
};

/**
 * Revoke all sessions for a user (except current)
 */
const revokeAllSessions = async (userId, exceptToken = null) => {
    const where = { userId, isActive: true };
    if (exceptToken) {
        where.token = { not: exceptToken };
    }

    const result = await prisma.session.updateMany({
        where,
        data: { isActive: false }
    });

    return result.count;
};

/**
 * Validate session token
 */
const validateSession = async (token) => {
    const session = await prisma.session.findUnique({
        where: { token }
    });

    if (!session) return null;
    if (!session.isActive) return null;
    if (new Date() > session.expiresAt) {
        // Session expired, mark as inactive
        await prisma.session.update({
            where: { id: session.id },
            data: { isActive: false }
        });
        return null;
    }

    return session;
};

/**
 * Clean up expired sessions
 */
const cleanupExpiredSessions = async () => {
    const result = await prisma.session.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: new Date() } },
                { isActive: false }
            ]
        }
    });

    return result.count;
};

// ==================== Helper Functions ====================

/**
 * Log common actions
 */
const logAction = {
    login: (userId, ip, userAgent) =>
        createAuditLog({ userId, action: 'login', resource: 'auth', ipAddress: ip, userAgent }),

    logout: (userId, ip) =>
        createAuditLog({ userId, action: 'logout', resource: 'auth', ipAddress: ip }),

    create: (userId, resource, resourceId, details, ip) =>
        createAuditLog({ userId, action: 'create', resource, resourceId, details, ipAddress: ip }),

    update: (userId, resource, resourceId, details, ip) =>
        createAuditLog({ userId, action: 'update', resource, resourceId, details, ipAddress: ip }),

    delete: (userId, resource, resourceId, ip) =>
        createAuditLog({ userId, action: 'delete', resource, resourceId, ipAddress: ip }),

    apiCall: (userId, endpoint, ip) =>
        createAuditLog({ userId, action: 'api_call', resource: 'api', details: { endpoint }, ipAddress: ip })
};

module.exports = {
    createAuditLog,
    getAuditLogs,
    deleteOldAuditLogs,
    createSession,
    getUserSessions,
    updateSessionActivity,
    revokeSession,
    revokeAllSessions,
    validateSession,
    cleanupExpiredSessions,
    logAction
};
