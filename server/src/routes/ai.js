/**
 * AI Routes - Smart Features API endpoints
 * Uses user's personal API key from database
 */

const express = require('express');
const router = express.Router();
const { protect: auth } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');
const aiService = require('../services/aiService');
const prisma = require('../utils/prisma');
const encryption = require('../utils/encryption');

// AI-specific rate limiter: 20 requests per minute to prevent API cost abuse
const aiLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: 'Too many AI requests. Please wait a moment before trying again.'
});

/**
 * Helper: Get user's API key from database (decrypted)
 */
const getUserApiKey = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { aiApiKey: true }
    });

    if (!user?.aiApiKey) return null;

    // Decrypt the API key (handles both encrypted and legacy plaintext)
    return encryption.safeDecrypt(user.aiApiKey) || user.aiApiKey;
};

/**
 * GET /api/ai/status - Check AI configuration status for user
 */
router.get('/status', auth, async (req, res) => {
    try {
        const apiKey = await getUserApiKey(req.user.id);

        if (!apiKey) {
            return res.json({
                configured: false,
                message: 'API Key not configured. Please add your Gemini API Key.'
            });
        }

        // Test the API key
        const testResult = await aiService.testApiKey(apiKey);
        res.json({
            configured: testResult.success,
            message: testResult.message,
            provider: 'Google Gemini'
        });
    } catch (error) {
        console.error('[AI] Status check error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai/save-key - Save user's API key
 */
router.post('/save-key', auth, async (req, res) => {
    try {
        const { apiKey } = req.body;

        if (!apiKey || !apiKey.trim()) {
            return res.status(400).json({ error: 'API Key is required' });
        }

        // Test the key first
        const testResult = await aiService.testApiKey(apiKey.trim());
        if (!testResult.success) {
            return res.status(400).json({ error: testResult.message });
        }

        // Encrypt and save to database
        const encryptedKey = encryption.encrypt(apiKey.trim());
        await prisma.user.update({
            where: { id: req.user.id },
            data: { aiApiKey: encryptedKey }
        });

        res.json({
            success: true,
            message: 'API Key saved successfully!'
        });
    } catch (error) {
        console.error('[AI] Save key error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/ai/remove-key - Remove user's API key
 */
router.delete('/remove-key', auth, async (req, res) => {
    try {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { aiApiKey: null }
        });

        res.json({
            success: true,
            message: 'API Key removed successfully'
        });
    } catch (error) {
        console.error('[AI] Remove key error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai/test-key - Test an API key without saving
 */
router.post('/test-key', auth, async (req, res) => {
    try {
        const { apiKey } = req.body;

        if (!apiKey) {
            return res.status(400).json({ error: 'API Key is required' });
        }

        const result = await aiService.testApiKey(apiKey);
        res.json(result);
    } catch (error) {
        console.error('[AI] Test key error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai/suggest-replies - Get smart reply suggestions
 * Supports optional knowledge base augmentation
 */
router.post('/suggest-replies', auth, aiLimiter, async (req, res) => {
    try {
        const apiKey = await getUserApiKey(req.user.id);
        if (!apiKey) {
            return res.status(400).json({ error: 'API Key not configured' });
        }

        const {
            message,
            context = [],
            language = 'id',
            tone = 'friendly',
            count = 3,
            knowledgeBaseId = null,
            useKnowledge = false
        } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        let knowledgeContext = null;

        // If knowledge base is specified, search for relevant context
        if (useKnowledge || knowledgeBaseId) {
            try {
                const knowledgeService = require('../services/knowledgeService');

                // Find a suitable knowledge base
                let kbId = knowledgeBaseId;
                if (!kbId) {
                    // Try to find user's first active knowledge base
                    const kb = await prisma.knowledgeBase.findFirst({
                        where: {
                            userId: req.user.id,
                            status: 'ready',
                            isActive: true
                        },
                        select: { id: true, name: true }
                    });
                    kbId = kb?.id;
                }

                if (kbId) {
                    // Search knowledge base for relevant chunks
                    const searchResult = await knowledgeService.searchSimilar(
                        req.user.id,
                        message,
                        kbId,
                        3 // Get top 3 relevant chunks
                    );

                    if (searchResult.chunks && searchResult.chunks.length > 0) {
                        knowledgeContext = {
                            fromKnowledge: true,
                            chunks: searchResult.chunks.map(c => c.content),
                            knowledgeBaseName: searchResult.knowledgeBaseName
                        };
                        console.log(`[AI] Found ${searchResult.chunks.length} relevant knowledge chunks`);
                    }
                }
            } catch (kbError) {
                console.error('[AI] Knowledge search error:', kbError.message);
                // Continue without knowledge context
            }
        }

        const result = await aiService.suggestReplies(apiKey, message, context, {
            language,
            tone,
            count,
            knowledgeContext
        });

        // Add knowledge indicator to response
        if (knowledgeContext) {
            result.fromKnowledge = true;
            result.knowledgeBaseName = knowledgeContext.knowledgeBaseName;
        }

        res.json(result);
    } catch (error) {
        console.error('[AI] Suggest replies error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai/analyze-sentiment - Analyze message sentiment
 */
router.post('/analyze-sentiment', auth, aiLimiter, async (req, res) => {
    try {
        const apiKey = await getUserApiKey(req.user.id);
        if (!apiKey) {
            return res.status(400).json({ error: 'API Key not configured' });
        }

        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await aiService.analyzeSentiment(apiKey, message);
        res.json(result);
    } catch (error) {
        console.error('[AI] Sentiment analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai/categorize - Categorize conversation
 */
router.post('/categorize', auth, aiLimiter, async (req, res) => {
    try {
        const apiKey = await getUserApiKey(req.user.id);
        if (!apiKey) {
            return res.status(400).json({ error: 'API Key not configured' });
        }

        const { messages } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        const result = await aiService.categorizeConversation(apiKey, messages);
        res.json(result);
    } catch (error) {
        console.error('[AI] Categorization error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai/generate - Generate content (replies, templates, broadcast)
 */
router.post('/generate', auth, aiLimiter, async (req, res) => {
    try {
        const apiKey = await getUserApiKey(req.user.id);
        if (!apiKey) {
            return res.status(400).json({ error: 'API Key not configured' });
        }

        const { type, context, tone = 'friendly', language = 'id', instructions = '' } = req.body;

        if (!type || !context) {
            return res.status(400).json({ error: 'Type and context are required' });
        }

        const validTypes = ['reply', 'template', 'broadcast', 'improve'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        const result = await aiService.generateContent(apiKey, { type, context, tone, language, instructions });
        res.json(result);
    } catch (error) {
        console.error('[AI] Content generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai/insights - Generate AI insights from analytics data
 */
router.post('/insights', auth, aiLimiter, async (req, res) => {
    try {
        const apiKey = await getUserApiKey(req.user.id);
        if (!apiKey) {
            return res.status(400).json({ error: 'API Key not configured' });
        }

        const data = req.body;

        if (!data.totalMessages) {
            return res.status(400).json({ error: 'Analytics data is required' });
        }

        const result = await aiService.generateInsights(apiKey, data);
        res.json(result);
    } catch (error) {
        console.error('[AI] Insights generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai/suggest-actions - Get suggested quick actions
 */
router.post('/suggest-actions', auth, aiLimiter, async (req, res) => {
    try {
        const apiKey = await getUserApiKey(req.user.id);
        if (!apiKey) {
            return res.status(400).json({ error: 'API Key not configured' });
        }

        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await aiService.suggestActions(apiKey, message);
        res.json(result);
    } catch (error) {
        console.error('[AI] Suggest actions error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
