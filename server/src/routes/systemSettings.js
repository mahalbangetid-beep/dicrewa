const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const prisma = require('../utils/prisma');

// Get all system settings (public - for logo display)
router.get('/public', async (req, res) => {
    try {
        const settings = await prisma.systemSettings.findMany({
            where: {
                key: {
                    in: ['logo_landing', 'logo_dashboard', 'app_name', 'primary_color']
                }
            }
        });

        const result = {};
        settings.forEach(s => {
            result[s.key] = s.value;
        });

        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all system settings (admin only)
router.get('/', protect, adminOnly, async (req, res) => {
    try {
        const settings = await prisma.systemSettings.findMany({
            orderBy: { key: 'asc' }
        });

        const result = {};
        settings.forEach(s => {
            result[s.key] = s.value;
        });

        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update system setting (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
    try {
        const { key, value, description } = req.body;

        if (!key) {
            return res.status(400).json({ success: false, message: 'Key is required' });
        }

        const setting = await prisma.systemSettings.upsert({
            where: { key },
            update: { value: value || '', description },
            create: { key, value: value || '', description }
        });

        res.json({ success: true, data: setting });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update multiple settings at once (admin only)
router.post('/bulk', protect, adminOnly, async (req, res) => {
    try {
        const { settings } = req.body;

        if (!settings || !Array.isArray(settings)) {
            return res.status(400).json({ success: false, message: 'Settings array is required' });
        }

        const results = await Promise.all(
            settings.map(s =>
                prisma.systemSettings.upsert({
                    where: { key: s.key },
                    update: { value: s.value || '' },
                    create: { key: s.key, value: s.value || '' }
                })
            )
        );

        res.json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
