/**
 * Knowledge Service for Smart Knowledge (RAG)
 * Handles CRUD operations and RAG query logic
 */

const prisma = require('../utils/prisma');
const chunkingService = require('./chunkingService');
const embeddingService = require('./embeddingService');
const encryption = require('../utils/encryption');

// RAG Query limits per plan
const RAG_LIMITS = {
    free: 50,
    pro: 1000,
    enterprise: 5000,
    unlimited: Infinity
};

// Simple in-memory cache for query results
const queryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

class KnowledgeService {
    constructor() {
        this.topK = 3; // Number of chunks to retrieve
        this.minSimilarity = 0.5; // Minimum similarity score
    }

    // ==================== Cache Helpers ====================

    getCacheKey(userId, query, knowledgeBaseId) {
        return `${userId}:${knowledgeBaseId || 'all'}:${query.toLowerCase().trim().substring(0, 100)}`;
    }

    getFromCache(key) {
        const cached = queryCache.get(key);
        if (cached && Date.now() < cached.expiresAt) {
            console.log(`[KnowledgeService] Cache hit for: ${key.substring(0, 50)}...`);
            return cached.result;
        }
        queryCache.delete(key);
        return null;
    }

    setCache(key, result) {
        // Limit cache size
        if (queryCache.size >= MAX_CACHE_SIZE) {
            const firstKey = queryCache.keys().next().value;
            queryCache.delete(firstKey);
        }
        queryCache.set(key, {
            result,
            expiresAt: Date.now() + CACHE_TTL
        });
    }

    clearCache(knowledgeBaseId = null) {
        if (knowledgeBaseId) {
            // Clear cache for specific knowledge base
            for (const key of queryCache.keys()) {
                if (key.startsWith(knowledgeBaseId)) {
                    queryCache.delete(key);
                }
            }
        } else {
            queryCache.clear();
        }
    }

    // ==================== CRUD Operations ====================

    /**
     * Create a new knowledge base
     */
    async createKnowledge(userId, data) {
        const { name, description, content, deviceIds } = data;

        const knowledge = await prisma.knowledgeBase.create({
            data: {
                name,
                description,
                content,
                deviceIds: deviceIds ? JSON.stringify(deviceIds) : null,
                userId,
                status: 'pending'
            }
        });

        return knowledge;
    }

    /**
     * Get all knowledge bases for a user
     */
    async getKnowledgeBases(userId, options = {}) {
        const { includeContent = false, activeOnly = false } = options;

        const where = { userId };
        if (activeOnly) {
            where.isActive = true;
        }

        const select = {
            id: true,
            name: true,
            description: true,
            deviceIds: true,
            status: true,
            chunkCount: true,
            isActive: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true
        };

        if (includeContent) {
            select.content = true;
        }

        const knowledgeBases = await prisma.knowledgeBase.findMany({
            where,
            select,
            orderBy: { createdAt: 'desc' }
        });

        // Parse deviceIds
        return knowledgeBases.map(kb => ({
            ...kb,
            deviceIds: kb.deviceIds ? JSON.parse(kb.deviceIds) : null
        }));
    }

    /**
     * Get a single knowledge base by ID
     */
    async getKnowledgeById(id, userId = null) {
        const where = { id };
        if (userId) {
            where.userId = userId;
        }

        const knowledge = await prisma.knowledgeBase.findFirst({
            where,
            include: {
                chunks: {
                    select: {
                        id: true,
                        content: true,
                        chunkIndex: true,
                        tokenCount: true
                    },
                    orderBy: { chunkIndex: 'asc' }
                }
            }
        });

        if (knowledge) {
            knowledge.deviceIds = knowledge.deviceIds ? JSON.parse(knowledge.deviceIds) : null;
        }

        return knowledge;
    }

    /**
     * Update a knowledge base
     */
    async updateKnowledge(id, userId, data) {
        const { name, description, content, deviceIds, isActive } = data;

        const existing = await prisma.knowledgeBase.findFirst({
            where: { id, userId }
        });

        if (!existing) {
            throw new Error('Knowledge base not found');
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (deviceIds !== undefined) {
            updateData.deviceIds = deviceIds ? JSON.stringify(deviceIds) : null;
        }

        // If content changed, need to reprocess
        const contentChanged = content !== undefined && content !== existing.content;
        if (contentChanged) {
            updateData.content = content;
            updateData.status = 'pending';
            updateData.chunkCount = 0;
            updateData.errorMessage = null;

            // Delete existing chunks
            await prisma.knowledgeChunk.deleteMany({
                where: { knowledgeBaseId: id }
            });
        }

        const updated = await prisma.knowledgeBase.update({
            where: { id },
            data: updateData
        });

        return {
            ...updated,
            deviceIds: updated.deviceIds ? JSON.parse(updated.deviceIds) : null,
            needsReprocessing: contentChanged
        };
    }

    /**
     * Delete a knowledge base
     */
    async deleteKnowledge(id, userId) {
        const existing = await prisma.knowledgeBase.findFirst({
            where: { id, userId }
        });

        if (!existing) {
            throw new Error('Knowledge base not found');
        }

        // Chunks will be deleted automatically due to onDelete: Cascade
        await prisma.knowledgeBase.delete({
            where: { id }
        });

        return { success: true };
    }

    // ==================== Processing ====================

    /**
     * Process knowledge base: chunk text and create embeddings
     */
    async processKnowledge(id, userApiKey = null) {
        // Get knowledge base
        const knowledge = await prisma.knowledgeBase.findUnique({
            where: { id }
        });

        if (!knowledge) {
            throw new Error('Knowledge base not found');
        }

        // Update status to processing
        await prisma.knowledgeBase.update({
            where: { id },
            data: { status: 'processing', errorMessage: null }
        });

        try {
            // Step 1: Analyze and chunk text
            const analysis = chunkingService.analyzeText(knowledge.content);
            const chunks = chunkingService.chunkText(knowledge.content, {
                strategy: analysis.suggestedStrategy
            });

            if (chunks.length === 0) {
                throw new Error('No valid chunks created from content');
            }

            console.log(`[KnowledgeService] Processing ${knowledge.name}: ${chunks.length} chunks, strategy: ${analysis.suggestedStrategy}`);

            // Step 2: Create embeddings for all chunks
            const { embeddings, totalTokens } = await embeddingService.batchEmbeddings(chunks, userApiKey);

            console.log(`[KnowledgeService] Created embeddings: ${embeddings.length}, tokens used: ${totalTokens}`);

            // Step 3: Save chunks with embeddings to database
            const chunkData = chunks.map((content, index) => ({
                knowledgeBaseId: id,
                content,
                embedding: JSON.stringify(embeddings[index]),
                tokenCount: chunkingService.countTokens(content),
                chunkIndex: index
            }));

            // Delete old chunks first
            await prisma.knowledgeChunk.deleteMany({
                where: { knowledgeBaseId: id }
            });

            // Create new chunks
            await prisma.knowledgeChunk.createMany({
                data: chunkData
            });

            // Update knowledge base status
            await prisma.knowledgeBase.update({
                where: { id },
                data: {
                    status: 'ready',
                    chunkCount: chunks.length,
                    errorMessage: null
                }
            });

            return {
                success: true,
                chunkCount: chunks.length,
                tokensUsed: totalTokens,
                strategy: analysis.suggestedStrategy
            };

        } catch (error) {
            console.error(`[KnowledgeService] Processing failed for ${id}:`, error.message);

            // Update status to error
            await prisma.knowledgeBase.update({
                where: { id },
                data: {
                    status: 'error',
                    errorMessage: error.message
                }
            });

            throw error;
        }
    }

    // ==================== RAG Query ====================

    /**
     * Query knowledge base(s) using RAG
     */
    async queryKnowledge(query, options = {}) {
        const {
            userId,
            knowledgeBaseIds = [],
            deviceId = null,
            userApiKey = null,
            topK = this.topK,
            minSimilarity = this.minSimilarity,
            skipQuotaCheck = false
        } = options;

        // Step 1: Check quota (unless skipped for testing)
        if (!skipQuotaCheck && userId) {
            const quotaCheck = await this.checkQuota(userId);
            if (!quotaCheck.allowed) {
                throw new Error(`Query limit exceeded. Used ${quotaCheck.used}/${quotaCheck.limit} this month.`);
            }
        }

        // Step 2: Get relevant knowledge bases
        let kbWhere = { status: 'ready', isActive: true };

        if (knowledgeBaseIds.length > 0) {
            kbWhere.id = { in: knowledgeBaseIds };
        } else if (userId) {
            kbWhere.userId = userId;
        }

        const knowledgeBases = await prisma.knowledgeBase.findMany({
            where: kbWhere,
            select: { id: true, name: true, deviceIds: true }
        });

        // Filter by deviceId if specified
        let relevantKBIds = knowledgeBases
            .filter(kb => {
                if (!deviceId) return true;
                if (!kb.deviceIds) return true; // null = all devices
                try {
                    const devices = JSON.parse(kb.deviceIds);
                    return Array.isArray(devices) && devices.includes(deviceId);
                } catch (e) {
                    // If deviceIds is malformed, treat as all devices
                    console.warn(`[KnowledgeService] Malformed deviceIds for KB ${kb.id}:`, e.message);
                    return true;
                }
            })
            .map(kb => kb.id);

        if (relevantKBIds.length === 0) {
            return {
                answer: 'Tidak ditemukan knowledge base yang aktif.',
                chunks: [],
                confidence: 0
            };
        }

        // Step 3: Get chunks with OPTIMIZED pre-filtering
        // Extract keywords from query for pre-filtering (reduces memory usage)
        const queryKeywords = query
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3) // Only meaningful words
            .slice(0, 5); // Max 5 keywords

        // Build pre-filter conditions
        let chunkWhereCondition = { knowledgeBaseId: { in: relevantKBIds } };

        // If we have keywords, add content filter to reduce chunks loaded
        // This is a trade-off: might miss some relevant chunks but prevents OOM
        if (queryKeywords.length > 0) {
            chunkWhereCondition = {
                AND: [
                    { knowledgeBaseId: { in: relevantKBIds } },
                    {
                        OR: queryKeywords.map(keyword => ({
                            content: { contains: keyword }
                        }))
                    }
                ]
            };
        }

        // OPTIMIZATION: Limit chunks to prevent memory overflow
        const MAX_CHUNKS = 500; // Hard limit to prevent OOM

        let chunks = await prisma.knowledgeChunk.findMany({
            where: chunkWhereCondition,
            take: MAX_CHUNKS,
            include: {
                knowledgeBase: {
                    select: { name: true }
                }
            }
        });

        // If pre-filter returned too few results, fall back to broader search
        if (chunks.length < 10 && queryKeywords.length > 0) {
            console.log('[KnowledgeService] Pre-filter too restrictive, falling back to broader search');
            chunks = await prisma.knowledgeChunk.findMany({
                where: { knowledgeBaseId: { in: relevantKBIds } },
                take: MAX_CHUNKS,
                include: {
                    knowledgeBase: {
                        select: { name: true }
                    }
                }
            });
        }

        console.log(`[KnowledgeService] Processing ${chunks.length} chunks (max: ${MAX_CHUNKS})`);

        if (chunks.length === 0) {
            return {
                answer: 'Knowledge base kosong. Silakan tambahkan konten.',
                chunks: [],
                confidence: 0
            };
        }

        // Step 4: Create query embedding
        const { embedding: queryEmbedding } = await embeddingService.createEmbedding(query, userApiKey);

        // Step 5: Find similar chunks with BATCHED PROCESSING
        // Process in batches to avoid loading all embeddings into memory at once
        const BATCH_SIZE = 100;
        let allSimilarChunks = [];

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);

            // Parse embeddings only for this batch
            const batchWithEmbeddings = batch.map(chunk => ({
                ...chunk,
                embedding: JSON.parse(chunk.embedding)
            }));

            // Find similar in this batch
            const batchResults = embeddingService.findSimilar(
                queryEmbedding,
                batchWithEmbeddings,
                topK * 2, // Get more candidates from each batch
                minSimilarity
            );

            allSimilarChunks.push(...batchResults);

            // Early termination: if we have enough high-quality results, stop
            if (allSimilarChunks.length >= topK * 3) {
                console.log(`[KnowledgeService] Early termination at batch ${Math.floor(i / BATCH_SIZE) + 1}`);
                break;
            }
        }

        // Final sort and selection across all batches
        allSimilarChunks.sort((a, b) => b.similarity - a.similarity);
        const similarChunks = allSimilarChunks.slice(0, topK);

        if (similarChunks.length === 0) {
            return {
                answer: 'Tidak ditemukan informasi yang relevan dengan pertanyaan Anda.',
                chunks: [],
                confidence: 0
            };
        }

        // Step 6: Build context from similar chunks
        const context = similarChunks
            .map(chunk => chunk.content)
            .join('\n\n');

        // Step 7: Generate answer using LLM (supports OpenAI and Gemini)
        const answer = await this.generateAnswer(query, context, userApiKey);

        // Step 8: Increment usage (unless skipped)
        if (!skipQuotaCheck && userId) {
            await this.incrementUsage(userId);
        }

        // Step 9: Handle LLM failure gracefully
        // FIXED: Don't return raw chunks to user, return a friendly message instead
        let finalAnswer = answer;
        if (!answer) {
            // LLM generation failed - provide user-friendly fallback
            finalAnswer = 'Maaf, saya menemukan beberapa informasi terkait pertanyaan Anda, namun saat ini tidak dapat memberikan jawaban yang terformat. Silakan coba lagi nanti atau hubungi customer service kami.';
            console.log('[KnowledgeService] Using friendly fallback message instead of raw chunks');
        }

        // Return result
        return {
            answer: finalAnswer,
            chunks: similarChunks.map(chunk => ({
                id: chunk.id,
                content: chunk.content,
                similarity: Math.round(chunk.similarity * 100),
                knowledgeBase: chunk.knowledgeBase?.name
            })),
            confidence: Math.round(similarChunks[0]?.similarity * 100) || 0,
            llmUsed: answer ? true : false // Indicate if LLM was used
        };
    }

    /**
     * Generate answer using LLM with context
     * Supports both OpenAI and Google Gemini
     */
    async generateAnswer(query, context, userApiKey = null, geminiApiKey = null) {
        const systemPrompt = `Kamu adalah asisten yang membantu menjawab pertanyaan berdasarkan informasi yang diberikan.
Jawab dengan singkat, jelas, dan akurat berdasarkan konteks yang tersedia.
Jika informasi tidak cukup untuk menjawab, katakan bahwa kamu tidak menemukan informasi yang relevan.
Gunakan bahasa Indonesia yang baik dan sopan.`;

        const userPrompt = `Berdasarkan informasi berikut:\n\n${context}\n\nJawab pertanyaan ini: ${query}`;

        // Try OpenAI first
        const openaiKey = userApiKey || process.env.OPENAI_API_KEY;
        if (openaiKey) {
            try {
                const OpenAI = require('openai');
                const client = new OpenAI({ apiKey: openaiKey });

                const response = await client.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                });

                const answer = response.choices[0]?.message?.content;
                if (answer) {
                    console.log('[KnowledgeService] Answer generated using OpenAI');
                    return answer;
                }
            } catch (error) {
                // Enhanced error logging for OpenAI
                const errorCode = error.code || error.status || 'unknown';
                const isApiKeyError = error.status === 401 || error.message?.toLowerCase().includes('api key');
                const isRateLimitError = error.status === 429 || error.message?.toLowerCase().includes('rate limit');
                const isQuotaError = error.message?.toLowerCase().includes('quota') || error.message?.toLowerCase().includes('billing');

                console.error(`[KnowledgeService] OpenAI FAILED - Code: ${errorCode}`);
                console.error(`[KnowledgeService] Error Type: ${isApiKeyError ? 'API_KEY_INVALID' : isRateLimitError ? 'RATE_LIMIT' : isQuotaError ? 'QUOTA_EXCEEDED' : 'OTHER'}`);
                console.error(`[KnowledgeService] Message: ${error.message}`);

                if (isApiKeyError) {
                    console.error('[KnowledgeService] ⚠️ ACTION REQUIRED: Check OpenAI API key in settings');
                } else if (isQuotaError) {
                    console.error('[KnowledgeService] ⚠️ ACTION REQUIRED: Check OpenAI billing/quota');
                }

                // Continue to try Gemini
            }
        }

        // Try Gemini as fallback
        const geminiKey = geminiApiKey || process.env.GEMINI_API_KEY;
        if (geminiKey) {
            try {
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(geminiKey);
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

                const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
                const result = await model.generateContent(fullPrompt);
                const answer = result.response?.text();

                if (answer) {
                    console.log('[KnowledgeService] Answer generated using Gemini');
                    return answer;
                }
            } catch (error) {
                // Enhanced error logging for Gemini
                const errorCode = error.code || error.status || 'unknown';
                const isApiKeyError = error.status === 401 || error.status === 403 || error.message?.toLowerCase().includes('api key');
                const isRateLimitError = error.status === 429 || error.message?.toLowerCase().includes('rate limit') || error.message?.toLowerCase().includes('quota');

                console.error(`[KnowledgeService] Gemini FAILED - Code: ${errorCode}`);
                console.error(`[KnowledgeService] Error Type: ${isApiKeyError ? 'API_KEY_INVALID' : isRateLimitError ? 'RATE_LIMIT/QUOTA' : 'OTHER'}`);
                console.error(`[KnowledgeService] Message: ${error.message}`);

                if (isApiKeyError) {
                    console.error('[KnowledgeService] ⚠️ ACTION REQUIRED: Check Gemini API key in settings');
                }
            }
        }

        // FIXED: Instead of returning raw context, return a user-friendly message
        // The old behavior was returning raw chunks which is poor UX
        console.log('[KnowledgeService] No LLM available, returning friendly fallback');
        return null; // Return null to indicate LLM generation failed
    }

    // ==================== Quota Management ====================

    /**
     * Check if user has remaining quota
     */
    async checkQuota(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true }
        });

        if (!user) {
            throw new Error('User not found');
        }

        const limit = RAG_LIMITS[user.plan] || RAG_LIMITS.free;

        // Unlimited plan always allowed
        if (limit === Infinity) {
            return { allowed: true, used: 0, limit: 'unlimited', remaining: 'unlimited' };
        }

        const currentMonth = new Date().toISOString().slice(0, 7); // "2024-01"

        const usage = await prisma.knowledgeUsage.findUnique({
            where: {
                userId_month: { userId, month: currentMonth }
            }
        });

        const used = usage?.queryCount || 0;
        const remaining = limit - used;

        return {
            allowed: remaining > 0,
            used,
            limit,
            remaining: Math.max(0, remaining),
            resetsAt: this.getNextResetDate()
        };
    }

    /**
     * Increment usage count
     */
    async incrementUsage(userId) {
        const currentMonth = new Date().toISOString().slice(0, 7);

        await prisma.knowledgeUsage.upsert({
            where: {
                userId_month: { userId, month: currentMonth }
            },
            update: {
                queryCount: { increment: 1 }
            },
            create: {
                userId,
                month: currentMonth,
                queryCount: 1
            }
        });
    }

    /**
     * Get usage statistics for a user
     */
    async getUsageStats(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true }
        });

        if (!user) {
            throw new Error('User not found');
        }

        const limit = RAG_LIMITS[user.plan] || RAG_LIMITS.free;
        const currentMonth = new Date().toISOString().slice(0, 7);

        const usage = await prisma.knowledgeUsage.findUnique({
            where: {
                userId_month: { userId, month: currentMonth }
            }
        });

        const used = usage?.queryCount || 0;

        return {
            plan: user.plan,
            used,
            limit: limit === Infinity ? 'unlimited' : limit,
            remaining: limit === Infinity ? 'unlimited' : Math.max(0, limit - used),
            percentage: limit === Infinity ? 0 : Math.round((used / limit) * 100),
            resetsAt: this.getNextResetDate()
        };
    }

    /**
     * Get next quota reset date
     */
    getNextResetDate() {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth.toISOString();
    }

    // ==================== Utility ====================

    /**
     * Get knowledge bases available for a specific device
     */
    async getKnowledgeForDevice(deviceId, userId) {
        const knowledgeBases = await prisma.knowledgeBase.findMany({
            where: {
                userId,
                status: 'ready',
                isActive: true
            },
            select: {
                id: true,
                name: true,
                description: true,
                deviceIds: true,
                chunkCount: true
            }
        });

        // Filter by device
        return knowledgeBases.filter(kb => {
            if (!kb.deviceIds) return true; // null = all devices
            const devices = JSON.parse(kb.deviceIds);
            return devices.includes(deviceId);
        }).map(kb => ({
            ...kb,
            deviceIds: kb.deviceIds ? JSON.parse(kb.deviceIds) : null
        }));
    }

    /**
     * Search for similar chunks without generating answer (for SmartReply augmentation)
     * @param {string} userId - User ID
     * @param {string} query - Query text
     * @param {string} knowledgeBaseId - Optional specific knowledge base ID
     * @param {number} topK - Number of chunks to return
     */
    async searchSimilar(userId, query, knowledgeBaseId = null, topK = 3) {
        // Check cache first
        const cacheKey = this.getCacheKey(userId, query, knowledgeBaseId);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Get user's API key for embedding
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { embeddingApiKey: true }
            });

            // Get relevant knowledge base
            let kbWhere = { userId, status: 'ready', isActive: true };
            if (knowledgeBaseId) {
                kbWhere.id = knowledgeBaseId;
            }

            const knowledgeBase = await prisma.knowledgeBase.findFirst({
                where: kbWhere,
                select: { id: true, name: true }
            });

            if (!knowledgeBase) {
                return { chunks: [], knowledgeBaseName: null };
            }

            // Get chunks
            const chunks = await prisma.knowledgeChunk.findMany({
                where: { knowledgeBaseId: knowledgeBase.id },
                select: {
                    id: true,
                    content: true,
                    embedding: true
                }
            });

            if (chunks.length === 0) {
                return { chunks: [], knowledgeBaseName: knowledgeBase.name };
            }

            // Create query embedding
            // Decrypt the API key if it's encrypted
            const rawKey = user?.embeddingApiKey;
            const apiKey = rawKey ? (encryption.safeDecrypt(rawKey) || rawKey) : null;

            const { embedding: queryEmbedding } = await embeddingService.createEmbedding(
                query,
                apiKey
            );

            // Find similar chunks
            const chunksWithEmbeddings = chunks.map(chunk => ({
                ...chunk,
                embedding: JSON.parse(chunk.embedding)
            }));

            const similarChunks = embeddingService.findSimilar(
                queryEmbedding,
                chunksWithEmbeddings,
                topK,
                this.minSimilarity
            );

            const result = {
                chunks: similarChunks.map(chunk => ({
                    id: chunk.id,
                    content: chunk.content,
                    similarity: Math.round(chunk.similarity * 100)
                })),
                knowledgeBaseName: knowledgeBase.name
            };

            // Cache result
            this.setCache(cacheKey, result);

            return result;

        } catch (error) {
            console.error('[KnowledgeService] searchSimilar error:', error.message);
            return { chunks: [], knowledgeBaseName: null, error: error.message };
        }
    }
}

// Export singleton instance
module.exports = new KnowledgeService();

