/**
 * Quota Service
 * Centralized quota checking and tracking for all message sending
 * Used by: API routes, AutoReply, Chatbot, Broadcast
 */

const prisma = require('../utils/prisma');

// Plan quotas (same as in middleware)
const PLAN_QUOTAS = {
    free: 1500,
    pro: 5000,
    business: 10000,
    enterprise: 10000,
    ultimate: 20000,
    unlimited: Infinity
};

class QuotaService {
    /**
     * Check if user has quota available and increment if yes (ATOMIC)
     * Uses Prisma transaction to prevent race conditions
     * Returns { allowed: boolean, remaining: number, reason?: string }
     * 
     * @param {string} userId - User ID
     * @param {number} messageCount - Number of messages to send (default 1)
     * @returns {Promise<{ allowed: boolean, remaining: number, reason?: string }>}
     */
    async checkAndIncrement(userId, messageCount = 1) {
        try {
            // Use Prisma interactive transaction for atomic check-and-increment
            const result = await prisma.$transaction(async (tx) => {
                // Step 1: Read user data within transaction (locks the row)
                const user = await tx.user.findUnique({
                    where: { id: userId },
                    select: { id: true, plan: true, quota: true, used: true, lastQuotaReset: true }
                });

                if (!user) {
                    return { allowed: false, remaining: 0, reason: 'User not found' };
                }

                // Check for monthly reset
                const now = new Date();
                const lastReset = new Date(user.lastQuotaReset);
                const isNewMonth = now.getMonth() !== lastReset.getMonth() ||
                    now.getFullYear() !== lastReset.getFullYear();

                let currentUsed = user.used;

                if (isNewMonth) {
                    console.log(`[QuotaService] Resetting monthly quota for user ${userId}`);
                    await tx.user.update({
                        where: { id: userId },
                        data: { used: 0, lastQuotaReset: now }
                    });
                    currentUsed = 0;
                }

                // Unlimited plan bypass
                if (user.plan === 'unlimited') {
                    // Still increment for tracking purposes (within transaction)
                    await tx.user.update({
                        where: { id: userId },
                        data: { used: { increment: messageCount } }
                    });
                    return { allowed: true, remaining: Infinity };
                }

                // Get effective quota
                const effectiveQuota = this.getEffectiveQuota(user);

                // Step 2: Check if quota is available
                if (currentUsed + messageCount > effectiveQuota) {
                    return {
                        allowed: false,
                        remaining: Math.max(0, effectiveQuota - currentUsed),
                        reason: `Kuota pesan bulanan (${effectiveQuota}) telah tercapai`
                    };
                }

                // Step 3: Increment usage atomically within same transaction
                await tx.user.update({
                    where: { id: userId },
                    data: { used: { increment: messageCount } }
                });

                return {
                    allowed: true,
                    remaining: effectiveQuota - currentUsed - messageCount
                };
            }, {
                // Transaction options for better atomicity
                isolationLevel: 'Serializable', // Strictest isolation level
                timeout: 10000 // 10 second timeout
            });

            return result;

        } catch (error) {
            console.error('[QuotaService] Error checking quota:', error);
            // On error, allow the message but log it
            return { allowed: true, remaining: -1, reason: 'Quota check failed, allowing message' };
        }
    }

    /**
     * Just check quota without incrementing (for preview/validation)
     */
    async checkOnly(userId, messageCount = 1) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { plan: true, quota: true, used: true, lastQuotaReset: true }
            });

            if (!user) {
                return { allowed: false, remaining: 0, reason: 'User not found' };
            }

            // Check for monthly reset (just for calculation, don't actually reset)
            const now = new Date();
            const lastReset = new Date(user.lastQuotaReset);
            const isNewMonth = now.getMonth() !== lastReset.getMonth() ||
                now.getFullYear() !== lastReset.getFullYear();

            let currentUsed = isNewMonth ? 0 : user.used;

            if (user.plan === 'unlimited') {
                return { allowed: true, remaining: Infinity };
            }

            const effectiveQuota = this.getEffectiveQuota(user);

            if (currentUsed + messageCount > effectiveQuota) {
                return {
                    allowed: false,
                    remaining: Math.max(0, effectiveQuota - currentUsed),
                    reason: `Kuota tidak cukup (${effectiveQuota - currentUsed} tersisa)`
                };
            }

            return { allowed: true, remaining: effectiveQuota - currentUsed };

        } catch (error) {
            console.error('[QuotaService] Error checking quota:', error);
            return { allowed: true, remaining: -1 };
        }
    }

    /**
     * Increment user quota usage
     */
    async incrementUsage(userId, count = 1) {
        try {
            await prisma.user.update({
                where: { id: userId },
                data: { used: { increment: count } }
            });
        } catch (error) {
            console.error('[QuotaService] Error incrementing usage:', error);
        }
    }

    /**
     * Get user's current quota status
     */
    async getStatus(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true, quota: true, used: true, lastQuotaReset: true }
        });

        if (!user) return null;

        const effectiveQuota = this.getEffectiveQuota(user);

        return {
            plan: user.plan,
            quota: effectiveQuota,
            used: user.used,
            remaining: user.plan === 'unlimited' ? Infinity : effectiveQuota - user.used,
            lastReset: user.lastQuotaReset
        };
    }

    /**
     * Get effective quota based on plan
     */
    getEffectiveQuota(user) {
        if (user.quota && user.quota > 0) {
            return user.quota;
        }
        return PLAN_QUOTAS[user.plan?.toLowerCase()] || PLAN_QUOTAS.free;
    }
}

module.exports = new QuotaService();
