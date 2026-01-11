/**
 * Smart Knowledge (RAG) Routes
 * API endpoints for knowledge base management and RAG queries
 */

const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const knowledgeService = require('../services/knowledgeService');
const embeddingService = require('../services/embeddingService');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const encryption = require('../utils/encryption');

// All routes require authentication
router.use(protect);

// ==================== Knowledge Base CRUD ====================

/**
 * GET /api/knowledge
 * List all knowledge bases for current user
 */
router.get('/', async (req, res, next) => {
    try {
        const { includeContent, activeOnly } = req.query;

        const knowledgeBases = await knowledgeService.getKnowledgeBases(req.user.id, {
            includeContent: includeContent === 'true',
            activeOnly: activeOnly === 'true'
        });

        successResponse(res, knowledgeBases);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/knowledge/usage
 * Get RAG query usage statistics for current user
 */
router.get('/usage', async (req, res, next) => {
    try {
        const usage = await knowledgeService.getUsageStats(req.user.id);
        successResponse(res, usage);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/knowledge/:id
 * Get a specific knowledge base with chunks
 */
router.get('/:id', async (req, res, next) => {
    try {
        const knowledge = await knowledgeService.getKnowledgeById(req.params.id, req.user.id);

        if (!knowledge) {
            return errorResponse(res, 'Knowledge base not found', 404);
        }

        successResponse(res, knowledge);
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/knowledge
 * Create a new knowledge base
 */
router.post('/', async (req, res, next) => {
    try {
        const { name, description, content, deviceIds } = req.body;
        const { planLimitsService } = require('../services/planLimitsService');

        if (!name || !content) {
            return errorResponse(res, 'Name and content are required', 400);
        }

        if (content.length < 50) {
            return errorResponse(res, 'Content must be at least 50 characters', 400);
        }

        // Check plan limits for RAG
        const limitCheck = await planLimitsService.canAddKnowledgeBase(req.user.id);
        if (!limitCheck.allowed) {
            return errorResponse(res, limitCheck.reason, 403);
        }

        const knowledge = await knowledgeService.createKnowledge(req.user.id, {
            name,
            description,
            content,
            deviceIds
        });

        successResponse(res, knowledge, 'Knowledge base created', 201);
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/knowledge/:id
 * Update a knowledge base
 */
router.put('/:id', async (req, res, next) => {
    try {
        const { name, description, content, deviceIds, isActive } = req.body;

        const updated = await knowledgeService.updateKnowledge(req.params.id, req.user.id, {
            name,
            description,
            content,
            deviceIds,
            isActive
        });

        successResponse(res, updated, 'Knowledge base updated');
    } catch (error) {
        if (error.message === 'Knowledge base not found') {
            return errorResponse(res, error.message, 404);
        }
        next(error);
    }
});

/**
 * DELETE /api/knowledge/:id
 * Delete a knowledge base
 */
router.delete('/:id', async (req, res, next) => {
    try {
        await knowledgeService.deleteKnowledge(req.params.id, req.user.id);
        successResponse(res, { id: req.params.id }, 'Knowledge base deleted');
    } catch (error) {
        if (error.message === 'Knowledge base not found') {
            return errorResponse(res, error.message, 404);
        }
        next(error);
    }
});

// ==================== Processing ====================

/**
 * POST /api/knowledge/:id/process
 * Process knowledge base: chunk and create embeddings
 */
router.post('/:id/process', async (req, res, next) => {
    try {
        // Check if knowledge belongs to user
        const knowledge = await knowledgeService.getKnowledgeById(req.params.id, req.user.id);

        if (!knowledge) {
            return errorResponse(res, 'Knowledge base not found', 404);
        }

        // Use user's API key if available, otherwise platform key
        // Decrypt the key if it's encrypted
        const rawKey = req.user.embeddingApiKey;
        const apiKey = rawKey ? (encryption.safeDecrypt(rawKey) || rawKey) : null;

        const result = await knowledgeService.processKnowledge(req.params.id, apiKey);

        successResponse(res, result, 'Knowledge base processed successfully');
    } catch (error) {
        // Check for API key errors
        if (error.message.includes('API key')) {
            return errorResponse(res, error.message, 400);
        }
        next(error);
    }
});

// ==================== RAG Query ====================

/**
 * POST /api/knowledge/query
 * Query knowledge base(s) using RAG
 */
router.post('/query', async (req, res, next) => {
    try {
        const { query, knowledgeBaseIds, deviceId } = req.body;

        if (!query || query.trim().length < 3) {
            return errorResponse(res, 'Query must be at least 3 characters', 400);
        }

        // Use user's API key if available
        // Decrypt the key if it's encrypted
        const rawKey = req.user.embeddingApiKey;
        const apiKey = rawKey ? (encryption.safeDecrypt(rawKey) || rawKey) : null;

        const result = await knowledgeService.queryKnowledge(query, {
            userId: req.user.id,
            knowledgeBaseIds,
            deviceId,
            userApiKey: apiKey
        });

        successResponse(res, result);
    } catch (error) {
        if (error.message.includes('limit exceeded')) {
            return errorResponse(res, error.message, 429);
        }
        if (error.message.includes('API key')) {
            return errorResponse(res, error.message, 400);
        }
        next(error);
    }
});

/**
 * POST /api/knowledge/test-query
 * Test query without counting towards quota
 */
router.post('/test-query', async (req, res, next) => {
    try {
        const { query, knowledgeBaseId } = req.body;

        if (!query || !knowledgeBaseId) {
            return errorResponse(res, 'Query and knowledgeBaseId are required', 400);
        }

        // Verify ownership
        const knowledge = await knowledgeService.getKnowledgeById(knowledgeBaseId, req.user.id);
        if (!knowledge) {
            return errorResponse(res, 'Knowledge base not found', 404);
        }

        // Use user's API key if available
        // Decrypt the key if it's encrypted
        const rawKey = req.user.embeddingApiKey;
        const apiKey = rawKey ? (encryption.safeDecrypt(rawKey) || rawKey) : null;

        const result = await knowledgeService.queryKnowledge(query, {
            userId: req.user.id,
            knowledgeBaseIds: [knowledgeBaseId],
            userApiKey: apiKey,
            skipQuotaCheck: true // Don't count test queries
        });

        successResponse(res, result);
    } catch (error) {
        if (error.message.includes('API key')) {
            return errorResponse(res, error.message, 400);
        }
        next(error);
    }
});

// ==================== Device-specific ====================

/**
 * GET /api/knowledge/device/:deviceId
 * Get knowledge bases available for a specific device
 */
router.get('/device/:deviceId', async (req, res, next) => {
    try {
        const knowledgeBases = await knowledgeService.getKnowledgeForDevice(
            req.params.deviceId,
            req.user.id
        );

        successResponse(res, knowledgeBases);
    } catch (error) {
        next(error);
    }
});

// ==================== Admin Settings ====================

/**
 * POST /api/knowledge/validate-key
 * Validate an OpenAI API key
 */
router.post('/validate-key', async (req, res, next) => {
    try {
        const { apiKey } = req.body;

        if (!apiKey) {
            return errorResponse(res, 'API key is required', 400);
        }

        const result = await embeddingService.validateApiKey(apiKey);

        if (result.valid) {
            successResponse(res, { valid: true }, 'API key is valid');
        } else {
            return errorResponse(res, `Invalid API key: ${result.error}`, 400);
        }
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/knowledge/config
 * Get RAG configuration (admin only)
 */
router.get('/config', adminOnly, async (req, res, next) => {
    try {
        const hasPlatformKey = embeddingService.hasPlatformKey();

        successResponse(res, {
            hasPlatformKey,
            model: 'text-embedding-3-small',
            limits: {
                free: 50,
                pro: 1000,
                enterprise: 5000,
                unlimited: 'unlimited'
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
