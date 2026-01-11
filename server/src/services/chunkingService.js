/**
 * Chunking Service for Smart Knowledge
 * Handles text splitting strategies for RAG
 */

class ChunkingService {
    constructor() {
        this.defaultMaxChunkSize = 1000; // characters
        this.defaultOverlapSize = 100; // characters
        this.minChunkSize = 50; // minimum characters for a valid chunk
    }

    /**
     * Main chunking method - Hybrid strategy
     * Splits by paragraph first, then by size if needed
     */
    chunkText(text, options = {}) {
        const {
            maxChunkSize = this.defaultMaxChunkSize,
            overlapSize = this.defaultOverlapSize,
            strategy = 'hybrid' // hybrid, paragraph, size, qa
        } = options;

        if (!text || typeof text !== 'string') {
            return [];
        }

        let chunks;
        switch (strategy) {
            case 'paragraph':
                chunks = this.chunkByParagraph(text);
                break;
            case 'size':
                chunks = this.chunkBySize(text, maxChunkSize, overlapSize);
                break;
            case 'qa':
                chunks = this.chunkByQA(text);
                break;
            case 'hybrid':
            default:
                chunks = this.chunkHybrid(text, maxChunkSize, overlapSize);
                break;
        }

        // Filter out tiny chunks and normalize whitespace
        return chunks
            .map(chunk => chunk.trim().replace(/\s+/g, ' '))
            .filter(chunk => chunk.length >= this.minChunkSize);
    }

    /**
     * Hybrid chunking: paragraph first, then split long paragraphs
     */
    chunkHybrid(text, maxChunkSize, overlapSize) {
        // Step 1: Split by paragraph (double newline or more)
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim());

        const chunks = [];
        for (const para of paragraphs) {
            if (para.length <= maxChunkSize) {
                // Paragraph fits in one chunk
                chunks.push(para.trim());
            } else {
                // Split long paragraph with overlap
                const subChunks = this.chunkBySize(para, maxChunkSize, overlapSize);
                chunks.push(...subChunks);
            }
        }

        return chunks;
    }

    /**
     * Split by paragraph only
     */
    chunkByParagraph(text) {
        return text
            .split(/\n\n+/)
            .filter(p => p.trim())
            .map(p => p.trim());
    }

    /**
     * Split by fixed character size with overlap
     */
    chunkBySize(text, maxSize = 1000, overlap = 100) {
        if (text.length <= maxSize) {
            return [text];
        }

        const chunks = [];
        let start = 0;

        while (start < text.length) {
            let end = Math.min(start + maxSize, text.length);

            // Try to break at a sentence or word boundary
            if (end < text.length) {
                // Look for sentence boundary (., !, ?)
                const sentenceBreak = text.lastIndexOf('. ', end);
                const exclamationBreak = text.lastIndexOf('! ', end);
                const questionBreak = text.lastIndexOf('? ', end);
                const bestSentenceBreak = Math.max(sentenceBreak, exclamationBreak, questionBreak);

                if (bestSentenceBreak > start + maxSize * 0.5) {
                    end = bestSentenceBreak + 1;
                } else {
                    // Look for word boundary
                    const spaceIndex = text.lastIndexOf(' ', end);
                    if (spaceIndex > start + maxSize * 0.5) {
                        end = spaceIndex;
                    }
                }
            }

            chunks.push(text.slice(start, end).trim());
            start = end - overlap;

            // Prevent infinite loop
            if (start >= end) {
                start = end;
            }
        }

        return chunks;
    }

    /**
     * Split by Q&A pattern (for FAQ-style content)
     * Looks for patterns like "Q:", "A:", "Pertanyaan:", "Jawaban:", etc.
     */
    chunkByQA(text) {
        // Patterns to match Q&A formats
        const qaPattern = /(?:^|\n)(?:Q|A|Pertanyaan|Jawaban|Tanya|Jawab|\d+\.)\s*[:.)]/gim;

        const matches = [...text.matchAll(qaPattern)];

        if (matches.length < 2) {
            // Not Q&A format, fall back to paragraph
            return this.chunkByParagraph(text);
        }

        const chunks = [];
        let currentQA = '';
        let lastIndex = 0;

        // Group Q&A pairs together
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const isQuestion = /^[QqPpTt\d]/.test(match[0].trim());

            if (isQuestion && currentQA) {
                // Start of new Q, save current
                chunks.push(currentQA.trim());
                currentQA = '';
            }

            const nextMatch = matches[i + 1];
            const endIndex = nextMatch ? nextMatch.index : text.length;
            currentQA += text.slice(match.index, endIndex);
            lastIndex = endIndex;
        }

        // Add last Q&A pair
        if (currentQA) {
            chunks.push(currentQA.trim());
        }

        return chunks;
    }

    /**
     * Count approximate tokens (rough estimate)
     * OpenAI uses ~4 chars per token for English, ~2-3 for Indonesian
     */
    countTokens(text) {
        if (!text) return 0;
        // Use ~3 chars per token as middle ground for mixed content
        return Math.ceil(text.length / 3);
    }

    /**
     * Analyze text to suggest best chunking strategy
     */
    analyzeText(text) {
        const paragraphCount = (text.match(/\n\n+/g) || []).length + 1;
        const qaCount = (text.match(/(?:Q|A|Pertanyaan|Jawaban)\s*[:.)]/gi) || []).length;
        const avgParagraphLength = text.length / paragraphCount;

        return {
            totalLength: text.length,
            estimatedTokens: this.countTokens(text),
            paragraphCount,
            qaPatternCount: qaCount,
            avgParagraphLength,
            suggestedStrategy: qaCount >= 4 ? 'qa' :
                avgParagraphLength < 500 ? 'paragraph' :
                    'hybrid'
        };
    }
}

// Export singleton instance
module.exports = new ChunkingService();
