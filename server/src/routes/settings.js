const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const encryption = require('../utils/encryption');

// Get System Settings
router.get('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized: Admin only' });
        }
        const settings = await prisma.setting.findMany();
        const config = settings.reduce((acc, curr) => {
            try {
                // Try parsing JSON if value is stringified JSON, else use as is
                acc[curr.key] = JSON.parse(curr.value);
            } catch (e) {
                acc[curr.key] = curr.value;
            }
            return acc;
        }, {});

        res.json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update System Setting
router.post('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const { key, value } = req.body;

        if (!key) {
            return res.status(400).json({ success: false, message: 'Key is required' });
        }

        const setting = await prisma.setting.upsert({
            where: { key },
            update: { value: JSON.stringify(value) },
            create: { key, value: JSON.stringify(value) }
        });

        res.json({ success: true, data: setting });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get User Profile & Settings
router.get('/profile', protect, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                apiKeys: {
                    where: { isActive: true },
                    take: 1
                }
            }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Remove password
        const { password, ...userData } = user;

        // Get active API Key
        const apiKey = user.apiKeys[0]?.key || null;

        res.json({
            success: true,
            data: {
                ...userData,
                apiKey
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update Profile
router.put('/profile', protect, async (req, res) => {
    try {
        const { name, email } = req.body;

        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: { name, email }
        });

        const { password, ...userData } = user;
        res.json({ success: true, data: userData });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Change Password
router.put('/password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Incorrect current password' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await prisma.user.update({
            where: { id: req.user.id },
            data: { password: hashedPassword }
        });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Generate/Regenerate API Key
router.post('/apikey', protect, async (req, res) => {
    try {
        // Deactivate old keys
        await prisma.apiKey.updateMany({
            where: { userId: req.user.id },
            data: { isActive: false }
        });

        // Create new key
        const key = 'dk_' + crypto.randomBytes(24).toString('hex');

        await prisma.apiKey.create({
            data: {
                key,
                name: 'Default Key',
                userId: req.user.id
            }
        });

        res.json({ success: true, apiKey: key });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Save AI Embedding API Key (BYOK)
router.post('/ai-key', protect, async (req, res) => {
    try {
        const { embeddingApiKey } = req.body;

        // Encrypt the API key before saving
        const encryptedKey = embeddingApiKey ? encryption.encrypt(embeddingApiKey) : null;

        await prisma.user.update({
            where: { id: req.user.id },
            data: { embeddingApiKey: encryptedKey }
        });

        res.json({ success: true, message: 'AI API Key saved successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get AI Embedding API Key
router.get('/ai-key', protect, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { embeddingApiKey: true }
        });

        res.json({
            success: true,
            data: {
                hasKey: !!user?.embeddingApiKey,
                // Don't return actual key for security, just masked version
                maskedKey: encryption.getMaskedValue(user?.embeddingApiKey, 'sk-...', 4)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get Plan Limits & Usage
router.get('/plan-limits', protect, async (req, res) => {
    try {
        const { planLimitsService } = require('../services/planLimitsService');

        const limits = await planLimitsService.getAllLimits(req.user.id);

        // Get user's current plan
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { plan: true, quota: true, used: true }
        });

        res.json({
            success: true,
            data: {
                plan: user?.plan || 'free',
                messageQuota: { used: user?.used || 0, limit: user?.quota || 1500 },
                ...limits
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
