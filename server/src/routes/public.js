const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');

// GET /api/public/settings
router.get('/settings', async (req, res) => {
    try {
        const settings = await prisma.setting.findMany({
            where: {
                key: {
                    in: ['google_analytics_id', 'site_name', 'site_description'] // Whitelist public settings
                }
            }
        });

        const config = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value; // Value is typically stored as JSON string or raw string
            // Try to parse if it looks like JSON, though GA ID is usually just a string
            try {
                if (curr.value.startsWith('"') || curr.value.startsWith('{') || curr.value.startsWith('[')) {
                    acc[curr.key] = JSON.parse(curr.value);
                }
            } catch (e) { }
            return acc;
        }, {});

        res.json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
