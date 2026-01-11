/**
 * Rate Limiter Middleware
 * Implements sliding window rate limiting using in-memory storage
 */

// In-memory store for rate limiting
const rateLimitStore = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now - data.windowStart > data.windowMs * 2) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Create rate limiter middleware
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 1 minute)
 * @param {number} options.max - Maximum requests per window (default: 100)
 * @param {string} options.message - Error message
 * @param {Function} options.keyGenerator - Function to generate rate limit key
 * @param {boolean} options.skipSuccessfulRequests - Skip counting successful requests
 */
const createRateLimiter = (options = {}) => {
    const {
        windowMs = 60 * 1000, // 1 minute
        max = 100,
        message = 'Too many requests, please try again later.',
        keyGenerator = (req) => req.ip || req.user?.id || 'anonymous',
        skipSuccessfulRequests = false
    } = options;

    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();

        let data = rateLimitStore.get(key);

        if (!data || now - data.windowStart > windowMs) {
            // Start new window
            data = {
                count: 0,
                windowStart: now,
                windowMs
            };
        }

        data.count++;
        rateLimitStore.set(key, data);

        // Calculate remaining requests and reset time
        const remaining = Math.max(0, max - data.count);
        const resetTime = data.windowStart + windowMs;

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

        if (data.count > max) {
            res.setHeader('Retry-After', Math.ceil((resetTime - now) / 1000));
            return res.status(429).json({
                success: false,
                error: message,
                retryAfter: Math.ceil((resetTime - now) / 1000)
            });
        }

        // If skipSuccessfulRequests is true, decrement count for non-error responses
        if (skipSuccessfulRequests) {
            const originalEnd = res.end;
            res.end = function (...args) {
                if (res.statusCode < 400) {
                    const d = rateLimitStore.get(key);
                    if (d) d.count--;
                }
                originalEnd.apply(res, args);
            };
        }

        next();
    };
};

// Pre-configured rate limiters for common use cases

/**
 * General API rate limiter
 * 100 requests per minute
 */
const generalLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 100,
    message: 'Too many requests. Please slow down.'
});

/**
 * Authentication rate limiter
 * 5 attempts per 15 minutes
 */
const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts. Please try again in 15 minutes.',
    keyGenerator: (req) => `auth:${req.ip}:${req.body?.email || ''}`
});

/**
 * Message sending rate limiter
 * 30 messages per minute
 */
const messageLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Message rate limit exceeded. Please wait before sending more messages.',
    keyGenerator: (req) => `msg:${req.user?.id || req.ip}`
});

/**
 * Broadcast rate limiter
 * 5 broadcasts per hour
 */
const broadcastLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Broadcast rate limit exceeded. Maximum 5 broadcasts per hour.',
    keyGenerator: (req) => `broadcast:${req.user?.id}`
});

/**
 * Webhook rate limiter
 * 1000 requests per minute (for incoming webhooks)
 */
const webhookLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 1000,
    message: 'Webhook rate limit exceeded.'
});

/**
 * API key rate limiter
 * 500 requests per minute per API key
 */
const apiKeyLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 500,
    message: 'API rate limit exceeded. Upgrade your plan for higher limits.',
    keyGenerator: (req) => `api:${req.apiKey || req.ip}`
});

/**
 * Strict limiter for sensitive operations
 * 3 attempts per hour
 */
const strictLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many attempts. Please try again later.',
    keyGenerator: (req) => `strict:${req.ip}:${req.user?.id || ''}`
});

module.exports = {
    createRateLimiter,
    generalLimiter,
    authLimiter,
    messageLimiter,
    broadcastLimiter,
    webhookLimiter,
    apiKeyLimiter,
    strictLimiter
};
