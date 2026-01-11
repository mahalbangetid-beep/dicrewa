/**
 * Embedding Service for Smart Knowledge
 * Handles OpenAI embedding API calls
 */

const OpenAI = require('openai');

class EmbeddingService {
    constructor() {
        this.model = 'text-embedding-3-small';
        this.dimensions = 1536;
        this.platformApiKey = process.env.OPENAI_API_KEY || null;
    }

    /**
     * Get OpenAI client with appropriate API key
     * Priority: User's BYOK key > Platform key
     */
    getClient(userApiKey = null) {
        const apiKey = userApiKey || this.platformApiKey;

        if (!apiKey) {
            throw new Error('No OpenAI API key configured. Please set OPENAI_API_KEY in environment or provide your own key.');
        }

        return new OpenAI({ apiKey });
    }

    /**
     * Create embedding for a single text
     */
    async createEmbedding(text, userApiKey = null) {
        try {
            const client = this.getClient(userApiKey);

            const response = await client.embeddings.create({
                model: this.model,
                input: text,
                dimensions: this.dimensions
            });

            return {
                embedding: response.data[0].embedding,
                usage: response.usage
            };
        } catch (error) {
            console.error('[EmbeddingService] Error creating embedding:', error.message);
            throw new Error(`Embedding failed: ${error.message}`);
        }
    }

    /**
     * Create embeddings for multiple texts (batch)
     * OpenAI supports up to 2048 inputs per request
     */
    async batchEmbeddings(texts, userApiKey = null) {
        if (!texts || texts.length === 0) {
            return [];
        }

        try {
            const client = this.getClient(userApiKey);

            // Split into batches of 100 for safety
            const batchSize = 100;
            const results = [];
            let totalTokens = 0;

            for (let i = 0; i < texts.length; i += batchSize) {
                const batch = texts.slice(i, i + batchSize);

                const response = await client.embeddings.create({
                    model: this.model,
                    input: batch,
                    dimensions: this.dimensions
                });

                // Map embeddings back to their texts
                for (const item of response.data) {
                    results.push({
                        index: i + item.index,
                        embedding: item.embedding
                    });
                }

                totalTokens += response.usage?.total_tokens || 0;
            }

            // Sort by original index
            results.sort((a, b) => a.index - b.index);

            return {
                embeddings: results.map(r => r.embedding),
                totalTokens
            };
        } catch (error) {
            console.error('[EmbeddingService] Error in batch embedding:', error.message);
            throw new Error(`Batch embedding failed: ${error.message}`);
        }
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length) {
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Find most similar embeddings
     */
    findSimilar(queryEmbedding, embeddings, topK = 3, minScore = 0.5) {
        const scored = embeddings.map((item, index) => ({
            ...item,
            index,
            similarity: this.cosineSimilarity(queryEmbedding, item.embedding)
        }));

        // Sort by similarity descending
        scored.sort((a, b) => b.similarity - a.similarity);

        // Filter by minimum score and take top K
        return scored
            .filter(item => item.similarity >= minScore)
            .slice(0, topK);
    }

    /**
     * Check if platform API key is configured
     */
    hasPlatformKey() {
        return !!this.platformApiKey;
    }

    /**
     * Validate API key by making a small test request
     */
    async validateApiKey(apiKey) {
        try {
            const client = new OpenAI({ apiKey });
            await client.embeddings.create({
                model: this.model,
                input: 'test',
                dimensions: this.dimensions
            });
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }
}

// Export singleton instance
module.exports = new EmbeddingService();
