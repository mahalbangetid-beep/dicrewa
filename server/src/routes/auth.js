const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const prisma = require('../utils/prisma');
const { successResponse, createdResponse } = require('../utils/response');
const { AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { authLimiter, strictLimiter } = require('../middleware/rateLimiter');
const crypto = require('crypto');
const securityService = require('../services/securityService');

/**
 * Generate JWT Token
 */
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

/**
 * Generate API Key
 */
const generateApiKey = () => {
    const prefix = process.env.API_KEY_PREFIX || 'dk_';
    const key = crypto.randomBytes(32).toString('hex');
    return `${prefix}${key}`;
};

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res, next) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            throw new AppError('Email, password, and name are required', 400);
        }

        // Check if email exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            throw new AppError('Email already registered', 400);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: 'user'
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true
            }
        });

        // Generate token
        const token = generateToken(user.id);

        // Generate default API key
        const apiKey = await prisma.apiKey.create({
            data: {
                key: generateApiKey(),
                name: 'Default API Key',
                userId: user.id
            }
        });

        createdResponse(res, {
            user,
            token,
            apiKey: apiKey.key
        }, 'Registration successful');
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new AppError('Email and password are required', 400);
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            throw new AppError('Invalid email or password', 401);
        }

        if (!user.isActive) {
            throw new AppError('Account is deactivated', 401);
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            throw new AppError('Invalid email or password', 401);
        }

        // Generate token
        const token = generateToken(user.id);

        successResponse(res, {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            token
        }, 'Login successful');
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticate, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatar: true,
                createdAt: true,
                updatedAt: true,
                apiKeys: {
                    select: {
                        id: true,
                        name: true,
                        key: true,
                        isActive: true,
                        lastUsed: true,
                        createdAt: true
                    }
                }
            }
        });

        // Mask API keys
        user.apiKeys = user.apiKeys.map(key => ({
            ...key,
            key: key.key.substring(0, 10) + '...' + key.key.substring(key.key.length - 4)
        }));

        successResponse(res, user);
    } catch (error) {
        next(error);
    }
});

// PUT /api/auth/me - Update current user
router.put('/me', authenticate, async (req, res, next) => {
    try {
        const { name, avatar } = req.body;

        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                ...(name && { name }),
                ...(avatar && { avatar })
            },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                role: true
            }
        });

        successResponse(res, user, 'Profile updated');
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            throw new AppError('Current password and new password are required', 400);
        }

        if (newPassword.length < 6) {
            throw new AppError('New password must be at least 6 characters', 400);
        }

        // Get user with password
        const user = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            throw new AppError('Current password is incorrect', 400);
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: req.user.id },
            data: { password: hashedPassword }
        });

        // SECURITY: Invalidate all other sessions except current
        const currentToken = req.headers.authorization?.replace('Bearer ', '');
        try {
            const revokedCount = await securityService.revokeAllSessions(req.user.id, currentToken);
            console.log(`[Auth] Revoked ${revokedCount} sessions after password change for user ${req.user.id}`);
        } catch (sessionError) {
            // Log but don't fail the password change
            console.error('[Auth] Failed to revoke sessions:', sessionError.message);
        }

        successResponse(res, null, 'Password changed successfully. Other sessions have been logged out.');
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/api-keys - Generate new API key
router.post('/api-keys', authenticate, strictLimiter, async (req, res, next) => {
    try {
        const { name } = req.body;

        const apiKey = await prisma.apiKey.create({
            data: {
                key: generateApiKey(),
                name: name || 'API Key',
                userId: req.user.id
            }
        });

        // Return full key only on creation
        createdResponse(res, {
            id: apiKey.id,
            name: apiKey.name,
            key: apiKey.key,
            createdAt: apiKey.createdAt
        }, 'API key created. Save this key, it will not be shown again.');
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/api-keys - List API keys
router.get('/api-keys', authenticate, async (req, res, next) => {
    try {
        const apiKeys = await prisma.apiKey.findMany({
            where: { userId: req.user.id },
            select: {
                id: true,
                name: true,
                key: true,
                isActive: true,
                lastUsed: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // Mask keys
        const maskedKeys = apiKeys.map(key => ({
            ...key,
            key: key.key.substring(0, 10) + '...' + key.key.substring(key.key.length - 4)
        }));

        successResponse(res, maskedKeys);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/auth/api-keys/:id - Revoke API key
router.delete('/api-keys/:id', authenticate, async (req, res, next) => {
    try {
        const apiKey = await prisma.apiKey.findFirst({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!apiKey) {
            throw new AppError('API key not found', 404);
        }

        await prisma.apiKey.delete({
            where: { id: req.params.id }
        });

        successResponse(res, null, 'API key revoked');
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/refresh - Refresh token
router.post('/refresh', authenticate, async (req, res, next) => {
    try {
        const token = generateToken(req.user.id);
        successResponse(res, { token }, 'Token refreshed');
    } catch (error) {
        next(error);
    }
});

// ==================== PASSWORD RESET ====================

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', authLimiter, async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            throw new AppError('Email is required', 400);
        }

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() }
        });

        // Always return success to prevent email enumeration
        const successMessage = 'If an account with that email exists, a password reset link has been sent.';

        if (!user) {
            // Don't reveal that user doesn't exist
            return successResponse(res, null, successMessage);
        }

        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        // Invalidate any existing tokens for this user
        await prisma.passwordResetToken.updateMany({
            where: { userId: user.id, used: false },
            data: { used: true }
        });

        // Create new reset token
        await prisma.passwordResetToken.create({
            data: {
                token: resetToken,
                userId: user.id,
                expiresAt
            }
        });

        // Send reset email
        const emailService = require('../services/emailService');
        const emailResult = await emailService.sendPasswordResetEmail(
            user.email,
            resetToken,
            user.name
        );

        // Log for development (token visible if email not configured)
        if (!emailResult.success && emailResult.devToken) {
            console.log('[Auth] Password reset token (dev mode):', emailResult.devToken);
        }

        successResponse(res, null, successMessage);
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', authLimiter, async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            throw new AppError('Token and new password are required', 400);
        }

        if (newPassword.length < 6) {
            throw new AppError('Password must be at least 6 characters', 400);
        }

        // Find valid reset token
        const resetToken = await prisma.passwordResetToken.findFirst({
            where: {
                token,
                used: false,
                expiresAt: { gt: new Date() }
            },
            include: { user: true }
        });

        if (!resetToken) {
            throw new AppError('Invalid or expired reset token', 400);
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update user password
        await prisma.user.update({
            where: { id: resetToken.userId },
            data: { password: hashedPassword }
        });

        // Mark token as used
        await prisma.passwordResetToken.update({
            where: { id: resetToken.id },
            data: { used: true }
        });

        // Invalidate all other tokens for this user
        await prisma.passwordResetToken.updateMany({
            where: { userId: resetToken.userId, used: false },
            data: { used: true }
        });

        console.log(`[Auth] Password reset successful for user: ${resetToken.user.email}`);

        successResponse(res, null, 'Password has been reset successfully. You can now login with your new password.');
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/verify-reset-token/:token - Verify if reset token is valid
router.get('/verify-reset-token/:token', async (req, res, next) => {
    try {
        const { token } = req.params;

        const resetToken = await prisma.passwordResetToken.findFirst({
            where: {
                token,
                used: false,
                expiresAt: { gt: new Date() }
            }
        });

        if (!resetToken) {
            return res.json({ valid: false, message: 'Invalid or expired reset token' });
        }

        res.json({ valid: true });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
