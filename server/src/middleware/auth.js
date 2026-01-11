const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const prisma = require('../utils/prisma');

/**
 * Middleware to verify JWT token
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('No token provided. Authorization header must be: Bearer <token>', 401);
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user still exists
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                plan: true,
                embeddingApiKey: true
            }
        });

        if (!user) {
            throw new AppError('User no longer exists', 401);
        }

        if (!user.isActive) {
            throw new AppError('User account is deactivated', 401);
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        console.error('[Auth Debug] Token Verification Error:', error.message);
        if (error.name === 'JsonWebTokenError') {
            return next(new AppError('Invalid token', 401));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new AppError('Token expired', 401));
        }
        next(error);
    }
};

/**
 * Middleware to verify API Key
 */
const authenticateApiKey = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('No API key provided', 401);
        }

        const apiKey = authHeader.split(' ')[1];

        // Check if it's an API key (starts with prefix)
        const prefix = process.env.API_KEY_PREFIX || 'dk_';
        if (!apiKey.startsWith(prefix)) {
            // Not an API key, might be JWT - pass to authenticate middleware
            return authenticate(req, res, next);
        }

        // Find API key in database
        const keyRecord = await prisma.apiKey.findUnique({
            where: { key: apiKey },
            include: { user: true }
        });

        if (!keyRecord) {
            throw new AppError('Invalid API key', 401);
        }

        if (!keyRecord.isActive) {
            throw new AppError('API key is deactivated', 401);
        }

        // Update last used
        await prisma.apiKey.update({
            where: { id: keyRecord.id },
            data: { lastUsed: new Date() }
        });

        // Attach user to request
        req.user = keyRecord.user;
        req.apiKey = keyRecord;
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Middleware to check user role
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Not authenticated', 401));
        }

        if (!roles.includes(req.user.role)) {
            return next(new AppError('Not authorized to access this resource', 403));
        }

        next();
    };
};

/**
 * Optional authentication - continues even if no token
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, name: true, role: true }
        });

        if (user) {
            req.user = user;
        }

        next();
    } catch (error) {
        // Token invalid but continue anyway
        next();
    }
};

/**
 * Middleware to check if user is admin
 */
const adminOnly = (req, res, next) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return next(new AppError('Feature not available', 404));
    }

    next();
};

module.exports = {
    authenticate,
    protect: authenticateApiKey, // GANTI INI BIAR BISA BACA API KEY (dk_...)
    authenticateApiKey,
    authorize,
    optionalAuth,
    adminOnly
};
