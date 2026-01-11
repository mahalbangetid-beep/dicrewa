/**
 * Branding Routes
 * API endpoints for white-label and custom branding
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const brandingService = require('../services/brandingService');
const { successResponse, errorResponse } = require('../utils/response');

// All routes require authentication
router.use(protect);

/**
 * GET /api/branding
 * Get current user's branding settings
 */
router.get('/', async (req, res, next) => {
    try {
        const branding = await brandingService.getBranding(req.user.id);
        successResponse(res, branding);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/branding/access
 * Check if user has access to branding features
 */
router.get('/access', async (req, res, next) => {
    try {
        const access = await brandingService.checkAccess(req.user.id);
        successResponse(res, access);
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/branding
 * Update branding settings
 */
router.put('/', async (req, res, next) => {
    try {
        const branding = await brandingService.updateBranding(req.user.id, req.body);
        successResponse(res, branding, 'Branding settings updated successfully');
    } catch (error) {
        if (error.message.includes('Unlimited') || error.message.includes('Invalid')) {
            return errorResponse(res, error.message, 403);
        }
        next(error);
    }
});

/**
 * POST /api/branding/reset
 * Reset branding to defaults
 */
router.post('/reset', async (req, res, next) => {
    try {
        const result = await brandingService.resetBranding(req.user.id);
        successResponse(res, result, 'Branding settings reset to defaults');
    } catch (error) {
        if (error.message.includes('Unlimited')) {
            return errorResponse(res, error.message, 403);
        }
        next(error);
    }
});

/**
 * PATCH /api/branding/powered-by
 * Toggle "Powered by" visibility
 */
router.patch('/powered-by', async (req, res, next) => {
    try {
        const { show } = req.body;

        if (typeof show !== 'boolean') {
            return errorResponse(res, 'show parameter must be boolean', 400);
        }

        const branding = await brandingService.togglePoweredBy(req.user.id, show);
        successResponse(res, branding, `"Powered by" text ${show ? 'shown' : 'hidden'}`);
    } catch (error) {
        if (error.message.includes('Unlimited')) {
            return errorResponse(res, error.message, 403);
        }
        next(error);
    }
});

module.exports = router;
