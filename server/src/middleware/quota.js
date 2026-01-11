const { errorResponse } = require('../utils/response');
const prisma = require('../utils/prisma');

/**
 * Middleware untuk mengecek kuota pesan user
 */
const checkQuota = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, plan: true, quota: true, used: true, lastQuotaReset: true }
        });

        if (!user) {
            return errorResponse(res, 'User not found', 404);
        }

        // --- Monthly Reset Logic ---
        const now = new Date();
        const lastReset = new Date(user.lastQuotaReset);

        // Simple check: is current month/year different from last reset?
        const isNewMonth = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();

        let currentUsed = user.used;

        if (isNewMonth) {
            console.log(`[Quota] Resetting monthly quota for user ${user.id}`);
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    used: 0,
                    lastQuotaReset: now
                }
            });
            currentUsed = 0;
        }
        // ----------------------------

        // Unlimited plan bypass
        if (user.plan === 'unlimited') {
            return next();
        }

        // Get effective quota based on plan if database value is 0
        let effectiveQuota = user.quota;
        if (!effectiveQuota || effectiveQuota === 0) {
            const planQuotas = {
                free: 1500,
                pro: 5000,
                enterprise: 15000
                // unlimited is already handled above with early return
            };
            effectiveQuota = planQuotas[user.plan?.toLowerCase()] || 1500;
        }

        // Check if quota is reached
        if (currentUsed >= effectiveQuota) {
            return errorResponse(res, `Your monthly message quota (${effectiveQuota}) has been reached. Please upgrade your plan.`, 403);
        }

        next();
    } catch (error) {
        console.error('[QuotaMiddleware] Error:', error);
        next(error);
    }
};

module.exports = { checkQuota };
