/**
 * AI Service - Smart Features powered by Google Gemini
 * Provides: Smart Replies, Sentiment Analysis, Categorization, Content Generation
 * NOTE: Uses user's personal API key stored in database
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached result or null
 */
const getFromCache = (key) => {
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.result;
    }
    cache.delete(key);
    return null;
};

/**
 * Store result in cache
 */
const setCache = (key, result, ttl = CACHE_TTL) => {
    cache.set(key, {
        result,
        expiresAt: Date.now() + ttl
    });
};

/**
 * Generate cache key from input
 */
const getCacheKey = (type, input) => {
    return `${type}:${JSON.stringify(input).substring(0, 200)}`;
};

/**
 * Call Gemini API with user's API key
 * @param {string} apiKey - User's Gemini API key
 * @param {string} prompt - The prompt to send
 * @param {object} options - Options like maxRetries, temperature
 */
const callGemini = async (apiKey, prompt, options = {}) => {
    const { maxRetries = 2, temperature = 0.7 } = options;

    if (!apiKey) {
        throw new Error('API Key tidak ditemukan. Silakan tambahkan API Key Gemini Anda di halaman AI Features.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp'
    });

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature,
                    maxOutputTokens: 1024,
                }
            });

            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error(`[AI] Gemini API error (attempt ${attempt + 1}):`, error.message);
            if (attempt === maxRetries) throw error;
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
    }
};

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
const parseJsonResponse = (text) => {
    try {
        return JSON.parse(text);
    } catch {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1].trim());
        }
        const objectMatch = text.match(/\{[\s\S]*\}/);
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (objectMatch) return JSON.parse(objectMatch[0]);
        if (arrayMatch) return JSON.parse(arrayMatch[0]);
        throw new Error('Failed to parse JSON from response');
    }
};

// ============================================
// Smart Reply Suggestions
// ============================================

/**
 * Generate smart reply suggestions based on incoming message
 * @param {string} apiKey - User's API key
 * @param {string} message - The incoming message
 * @param {string[]} context - Previous messages for context
 * @param {object} options - Additional options (language, tone, count, knowledgeContext)
 */
const suggestReplies = async (apiKey, message, context = [], options = {}) => {
    const { language = 'id', tone = 'friendly', count = 3, knowledgeContext = null } = options;

    const cacheKey = getCacheKey('replies', { message, context: context.slice(-2), language, tone, hasKnowledge: !!knowledgeContext });
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const contextStr = context.length > 0
        ? `\nKonteks percakapan sebelumnya:\n${context.slice(-5).map((m, i) => `${i + 1}. ${m}`).join('\n')}`
        : '';

    // Build knowledge context section if available
    let knowledgeStr = '';
    if (knowledgeContext && knowledgeContext.chunks && knowledgeContext.chunks.length > 0) {
        knowledgeStr = `\n\n=== REFERENSI KNOWLEDGE BASE ===
Berikut adalah informasi relevan dari knowledge base yang bisa digunakan untuk menjawab:

${knowledgeContext.chunks.map((chunk, i) => `[${i + 1}] ${chunk}`).join('\n\n')}

PENTING: Jika pertanyaan customer bisa dijawab berdasarkan informasi di atas, prioritaskan jawaban dari knowledge base. Berikan balasan yang akurat berdasarkan referensi tersebut.
=== END KNOWLEDGE BASE ===`;
    }

    const prompt = `Kamu adalah asisten customer service WhatsApp yang ramah dan profesional.
Bahasa: ${language === 'id' ? 'Bahasa Indonesia' : 'English'}
Nada: ${tone === 'friendly' ? 'Ramah dan sopan' : tone === 'formal' ? 'Formal dan profesional' : 'Netral'}

${contextStr}
${knowledgeStr}

Pesan masuk dari customer:
"${message}"

Berikan ${count} saran balasan yang berbeda, singkat, dan langsung menjawab pertanyaan/kebutuhan customer.
${knowledgeContext ? 'Gunakan informasi dari knowledge base jika relevan.' : ''}
Setiap balasan maksimal 2 kalimat.

Format respons dalam JSON:
{
  "suggestions": ["balasan 1", "balasan 2", "balasan 3"],
  "detected_intent": "intent yang terdeteksi (inquiry/complaint/greeting/order/etc)"${knowledgeContext ? ',\n  "used_knowledge": true jika menggunakan info dari knowledge base' : ''}
}`;

    const response = await callGemini(apiKey, prompt, { temperature: 0.8 });
    const result = parseJsonResponse(response);

    setCache(cacheKey, result);
    return result;
};

// ============================================
// Sentiment Analysis
// ============================================

/**
 * Analyze sentiment of a message
 * @param {string} apiKey - User's API key
 * @param {string} message - Message to analyze
 */
const analyzeSentiment = async (apiKey, message) => {
    const cacheKey = getCacheKey('sentiment', { message });
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const prompt = `Analisis sentimen dan emosi dari pesan berikut:

"${message}"

Berikan hasil dalam format JSON:
{
  "sentiment": "positive" | "negative" | "neutral",
  "score": angka dari -1 (sangat negatif) hingga 1 (sangat positif),
  "emotions": ["emosi1", "emosi2"],
  "urgency": "low" | "medium" | "high",
  "summary": "ringkasan singkat maksimal 10 kata"
}

Petunjuk:
- Urgency tinggi jika ada kata seperti: urgent, segera, darurat, komplain, kecewa, marah
- Emotions bisa berisi: happy, grateful, curious, frustrated, angry, confused, satisfied, etc`;

    const response = await callGemini(apiKey, prompt, { temperature: 0.3 });
    const result = parseJsonResponse(response);

    setCache(cacheKey, result, 10 * 60 * 1000);
    return result;
};

// ============================================
// Auto-Categorization
// ============================================

/**
 * Categorize a conversation based on messages
 * @param {string} apiKey - User's API key
 * @param {string[]} messages - Array of messages in conversation
 */
const categorizeConversation = async (apiKey, messages) => {
    const cacheKey = getCacheKey('categorize', { messages: messages.slice(-10) });
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const messagesStr = messages.slice(-10).map((m, i) => `${i + 1}. ${m}`).join('\n');

    const prompt = `Kategorikan percakapan WhatsApp berikut:

${messagesStr}

Berikan hasil dalam format JSON:
{
  "category": "kategori utama",
  "subcategory": "sub-kategori (opsional)",
  "confidence": angka 0-1,
  "tags": ["tag1", "tag2", "tag3"],
  "suggestedLabel": "label yang cocok untuk CRM",
  "priority": "low" | "medium" | "high"
}

Kategori yang mungkin:
- sales_inquiry (tanya produk/harga)
- order (pemesanan/pembelian)
- complaint (keluhan/komplain)
- support (bantuan teknis)
- feedback (masukan/review)
- greeting (sapaan biasa)
- payment (pembayaran)
- shipping (pengiriman)
- other`;

    const response = await callGemini(apiKey, prompt, { temperature: 0.3 });
    const result = parseJsonResponse(response);

    setCache(cacheKey, result, 15 * 60 * 1000);
    return result;
};

// ============================================
// Content Generation
// ============================================

/**
 * Generate content (replies, templates, messages)
 * @param {string} apiKey - User's API key
 * @param {object} params - Generation parameters
 */
const generateContent = async (apiKey, params) => {
    const { type, context, tone = 'friendly', language = 'id', instructions = '' } = params;

    const toneMap = {
        friendly: 'Ramah, sopan, menggunakan emoji sesekali',
        formal: 'Formal, profesional, tanpa emoji',
        casual: 'Santai, seperti teman',
        persuasive: 'Persuasif, untuk penjualan'
    };

    let prompt = '';

    switch (type) {
        case 'reply':
            prompt = `Buat balasan pesan WhatsApp.
Konteks: ${context}
Nada: ${toneMap[tone] || toneMap.friendly}
Bahasa: ${language === 'id' ? 'Indonesia' : 'English'}
${instructions ? `Instruksi tambahan: ${instructions}` : ''}

Format JSON:
{
  "content": "balasan utama",
  "alternatives": ["alternatif 1", "alternatif 2"]
}`;
            break;

        case 'template':
            prompt = `Buat template pesan WhatsApp untuk: ${context}
Nada: ${toneMap[tone] || toneMap.friendly}
Bahasa: ${language === 'id' ? 'Indonesia' : 'English'}
${instructions ? `Instruksi tambahan: ${instructions}` : ''}

Template harus memiliki placeholder dengan format {{variable_name}}.

Format JSON:
{
  "name": "nama template",
  "content": "isi template dengan {{placeholder}}",
  "variables": ["variable1", "variable2"],
  "category": "kategori template"
}`;
            break;

        case 'broadcast':
            prompt = `Buat pesan broadcast WhatsApp untuk: ${context}
Nada: ${toneMap[tone] || toneMap.friendly}
Bahasa: ${language === 'id' ? 'Indonesia' : 'English'}
${instructions ? `Instruksi tambahan: ${instructions}` : ''}

Pesan harus menarik perhatian dan tidak terlalu panjang (maks 300 karakter).

Format JSON:
{
  "content": "isi broadcast",
  "headline": "judul/headline singkat",
  "callToAction": "ajakan bertindak"
}`;
            break;

        case 'improve':
            prompt = `Perbaiki dan tingkatkan pesan berikut:
"${context}"

Nada yang diinginkan: ${toneMap[tone] || toneMap.friendly}
Bahasa: ${language === 'id' ? 'Indonesia' : 'English'}
${instructions ? `Instruksi tambahan: ${instructions}` : ''}

Format JSON:
{
  "improved": "pesan yang sudah diperbaiki",
  "changes": ["perubahan 1", "perubahan 2"],
  "tips": ["saran 1", "saran 2"]
}`;
            break;

        default:
            throw new Error(`Unknown content type: ${type}`);
    }

    const response = await callGemini(apiKey, prompt, { temperature: 0.7 });
    return parseJsonResponse(response);
};

// ============================================
// Smart Insights
// ============================================

/**
 * Generate AI insights from analytics data
 * @param {string} apiKey - User's API key
 * @param {object} data - Analytics data
 */
const generateInsights = async (apiKey, data) => {
    const {
        totalMessages,
        sentimentBreakdown,
        categoryBreakdown,
        peakHours,
        responseTime,
        period = '7 days'
    } = data;

    const prompt = `Analisis data berikut dan berikan insight bisnis:

Periode: ${period}
Total Pesan: ${totalMessages}
Breakdown Sentimen: ${JSON.stringify(sentimentBreakdown)}
Breakdown Kategori: ${JSON.stringify(categoryBreakdown)}
Jam Sibuk: ${JSON.stringify(peakHours)}
Waktu Respons Rata-rata: ${responseTime} menit

Berikan insight dalam format JSON Bahasa Indonesia:
{
  "summary": "ringkasan singkat performa (1-2 kalimat)",
  "highlights": [
    { "type": "positive" | "warning" | "info", "text": "insight 1" },
    { "type": "positive" | "warning" | "info", "text": "insight 2" }
  ],
  "recommendations": [
    "rekomendasi aksi 1",
    "rekomendasi aksi 2",
    "rekomendasi aksi 3"
  ],
  "trends": [
    { "metric": "nama metrik", "direction": "up" | "down" | "stable", "change": "persentase atau deskripsi" }
  ]
}`;

    const response = await callGemini(apiKey, prompt, { temperature: 0.5 });
    return parseJsonResponse(response);
};

// ============================================
// Quick Actions
// ============================================

/**
 * Get suggested quick actions based on message
 * @param {string} apiKey - User's API key
 * @param {string} message - Incoming message
 */
const suggestActions = async (apiKey, message) => {
    const prompt = `Berdasarkan pesan WhatsApp berikut, sarankan aksi cepat yang relevan:

"${message}"

Format JSON:
{
  "actions": [
    { "type": "reply", "label": "label tombol", "action": "deskripsi aksi" },
    { "type": "template", "label": "label tombol", "templateId": "suggested_template_type" },
    { "type": "tag", "label": "label tombol", "tag": "suggested_tag" }
  ],
  "priority": "low" | "medium" | "high",
  "requiresHumanReview": true | false
}

Tipe aksi yang tersedia:
- reply: balasan langsung
- template: gunakan template
- tag: tambahkan label/tag
- forward: teruskan ke tim lain
- escalate: eskalasi ke supervisor`;

    const response = await callGemini(apiKey, prompt, { temperature: 0.4 });
    return parseJsonResponse(response);
};

// ============================================
// Test API Key
// ============================================

/**
 * Test if an API key is valid
 * @param {string} apiKey - API key to test
 */
const testApiKey = async (apiKey) => {
    try {
        await callGemini(apiKey, 'Say "OK" if you can hear me.', { maxRetries: 0 });
        return {
            success: true,
            message: 'API Key valid dan berfungsi! ✓'
        };
    } catch (error) {
        return {
            success: false,
            message: error.message.includes('API_KEY')
                ? 'API Key tidak valid. Pastikan key benar.'
                : error.message
        };
    }
};

module.exports = {
    suggestReplies,
    analyzeSentiment,
    categorizeConversation,
    generateContent,
    generateInsights,
    suggestActions,
    testApiKey
};
