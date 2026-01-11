/**
 * Billing Service - Subscription & Payment Management (Phase 10)
 */

const prisma = require('../utils/prisma');

// Default pricing plans with complete features based on PLAN_FEATURES.md
const DEFAULT_PLANS = [
    {
        name: 'free',
        displayName: 'Free',
        description: 'Perfect for getting started',
        monthlyPrice: 0,
        yearlyPrice: 0,
        quota: 1500,
        features: JSON.stringify([
            // Messaging
            '1,500 pesan/bulan',
            '1 Device',
            'Message History 7 hari',
            // Broadcast
            'Broadcast Messages',
            // Auto-Reply
            'Basic Auto-Reply (5 rules)',
            'Keyword Matching',
            'Google Sheets Sync',
            // Chatbot
            'Visual Chatbot Builder',
            // Contacts
            '100 Contacts',
            'Tags & Labels',
            'Import/Export CSV',
            // Inbox
            'Inbox View & Reply',
            'Quick Replies',
            // Integrations
            'Webhook & API Access',
            'All Integrations',
            // Templates
            'Message Templates',
            // AI
            'AI Features (tanpa embedding)',
            // Support
            'Community Support',
            // Limitation
            '⚠️ Watermark pada pesan'
        ]),
        sortOrder: 1
    },
    {
        name: 'pro',
        displayName: 'Pro',
        description: 'For growing businesses',
        monthlyPrice: 20000,
        yearlyPrice: 200000,
        quota: 5000,
        features: JSON.stringify([
            // Messaging
            '5,000 pesan/bulan',
            '3 Devices',
            'Multi-device Support',
            'Message History (permanen)',
            // Broadcast
            'Unlimited Broadcast',
            'Scheduled Broadcast',
            'Broadcast Analytics',
            'Template Variables',
            // Auto-Reply
            'Unlimited Auto-Reply Rules',
            'Regex Matching',
            'Media Response',
            'Google Sheets Sync',
            // Chatbot
            'Visual Chatbot Builder',
            'Semua Node Types',
            // RAG
            'Smart Knowledge (RAG)',
            '3 Knowledge Bases',
            '50 Query/bulan',
            'BYOK OpenAI & Gemini',
            // Contacts
            '5,000 Contacts',
            'Contact Notes',
            // Inbox
            'Full Inbox Features',
            // Integrations
            'All Integrations',
            'Custom Webhook',
            'Full API Access',
            // Analytics
            'Full Analytics',
            'Export Reports',
            // Templates
            '20 Templates',
            'Template Categories',
            // AI
            'Smart Reply (Gemini)',
            'AI-powered RAG',
            // Support
            'Priority Support'
        ]),
        sortOrder: 2
    },
    {
        name: 'enterprise',
        displayName: 'Enterprise',
        description: 'For large organizations',
        monthlyPrice: 50000,
        yearlyPrice: 500000,
        quota: 15000,
        features: JSON.stringify([
            // Messaging
            '15,000 pesan/bulan',
            '10 Devices',
            'Multi-device Support',
            'Message History (permanen)',
            // Broadcast
            'Unlimited Broadcast',
            'Scheduled Broadcast',
            'Broadcast Analytics',
            'Template Variables',
            // Auto-Reply
            'Unlimited Auto-Reply Rules',
            'All Auto-Reply Features',
            // Chatbot
            '10 Chatbots',
            '50 Nodes/flow',
            'All Node Types',
            // RAG
            'Smart Knowledge (RAG)',
            '20 Knowledge Bases',
            '1,000 Query/bulan',
            '25MB Max File Size',
            'BYOK OpenAI & Gemini',
            // Contacts
            '50,000 Contacts',
            'Contact Notes',
            // Integrations
            'All Integrations',
            'Full API Access',
            // Analytics
            'Full Analytics',
            'Export Reports',
            // Templates
            '100 Templates',
            // AI
            'Smart Reply (Gemini)',
            'AI-powered RAG',
            // Advanced
            'Team Management',
            'Audit Logs',
            // Support
            'Dedicated Support',
            'SLA Guarantee'
        ]),
        sortOrder: 3
    },
    {
        name: 'unlimited',
        displayName: 'Unlimited',
        description: 'No limits, full power',
        monthlyPrice: 100000,
        yearlyPrice: 1000000,
        quota: -1,
        features: JSON.stringify([
            // Messaging
            '∞ Unlimited Messages',
            '∞ Unlimited Devices',
            'Multi-device Support',
            'Message History (permanen)',
            // Broadcast
            '∞ Unlimited Broadcast',
            'Scheduled Broadcast',
            'Broadcast Analytics',
            'Template Variables',
            // Auto-Reply
            '∞ Unlimited Auto-Reply Rules',
            'All Auto-Reply Features',
            // Chatbot
            '∞ Unlimited Chatbots',
            '∞ Unlimited Nodes/flow',
            'All Node Types',
            // RAG
            'Smart Knowledge (RAG)',
            '∞ Unlimited Knowledge Bases',
            '∞ Unlimited Query',
            '100MB Max File Size',
            'BYOK OpenAI & Gemini',
            // Contacts
            '∞ Unlimited Contacts',
            'Contact Notes',
            // Integrations
            'All Integrations',
            'Full API Access',
            // Analytics
            'Full Analytics',
            'Export Reports',
            // Templates
            '∞ Unlimited Templates',
            // AI
            'Smart Reply (Gemini)',
            'AI-powered RAG',
            // Advanced
            'Team Management',
            'Audit Logs',
            'White-label',
            'Custom Branding',
            // Support
            'Dedicated Support',
            'SLA Guarantee',
            '24/7 Priority Support'
        ]),
        sortOrder: 4
    }
];


/**
 * Initialize default pricing plans
 */
const initializePlans = async () => {
    for (const plan of DEFAULT_PLANS) {
        await prisma.pricingPlan.upsert({
            where: { name: plan.name },
            update: plan,
            create: plan
        });
    }
    console.log('[Billing] Pricing plans initialized');
};

/**
 * Get all pricing plans
 */
const getPlans = async () => {
    return prisma.pricingPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
    });
};

/**
 * Get plan by name
 */
const getPlanByName = async (name) => {
    return prisma.pricingPlan.findUnique({
        where: { name }
    });
};

/**
 * Get user's subscription
 */
const getSubscription = async (userId) => {
    return prisma.subscription.findUnique({
        where: { userId },
        include: {
            invoices: {
                orderBy: { createdAt: 'desc' },
                take: 10
            }
        }
    });
};

/**
 * Create or update subscription
 * @param {string} status - 'active' for free plans/immediate, 'pending' for paid plans awaiting payment
 */
const createSubscription = async (userId, plan, billingCycle = 'monthly', status = 'active') => {
    const planData = await getPlanByName(plan);
    if (!planData) throw new Error('Invalid plan');

    const now = new Date();
    const periodEnd = new Date(now);

    if (billingCycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const priceAmount = billingCycle === 'yearly' ? planData.yearlyPrice : planData.monthlyPrice;

    const subscription = await prisma.subscription.upsert({
        where: { userId },
        update: {
            plan,
            status,  // Use provided status (pending for paid, active for free)
            billingCycle,
            priceAmount,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd
        },
        create: {
            userId,
            plan,
            status,  // Use provided status
            billingCycle,
            priceAmount,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd
        }
    });

    // Only update user's plan and quota if subscription is ACTIVE
    // For pending subscriptions, this will be done after payment confirmation
    if (status === 'active') {
        await prisma.user.update({
            where: { id: userId },
            data: {
                plan,
                quota: planData.quota === -1 ? 999999 : planData.quota,
                used: 0
            }
        });
    }

    return subscription;
};

/**
 * Activate a pending subscription after successful payment
 */
const activateSubscription = async (subscriptionId) => {
    const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId }
    });

    if (!subscription) {
        throw new Error('Subscription not found');
    }

    // Update subscription status to active
    const updated = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'active' }
    });

    // Now update user's plan and quota
    const planData = await getPlanByName(subscription.plan);
    if (planData) {
        await prisma.user.update({
            where: { id: subscription.userId },
            data: {
                plan: subscription.plan,
                quota: planData.quota === -1 ? 999999 : planData.quota,
                used: 0
            }
        });
    }

    console.log(`[Billing] Subscription ${subscriptionId} activated for user ${subscription.userId}`);
    return updated;
};

/**
 * Cancel subscription
 */
const cancelSubscription = async (userId) => {
    const subscription = await prisma.subscription.update({
        where: { userId },
        data: {
            status: 'cancelled',
            cancelledAt: new Date()
        }
    });

    return subscription;
};

/**
 * Create invoice
 */
const createInvoice = async (data) => {
    const { userId, amount, description, subscriptionId, paymentGateway } = data;

    // Generate invoice number
    const date = new Date();
    const prefix = `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const count = await prisma.invoice.count({
        where: {
            invoiceNumber: { startsWith: prefix }
        }
    });
    const invoiceNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    // Set expiry (24 hours from now)
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return prisma.invoice.create({
        data: {
            invoiceNumber,
            userId,
            subscriptionId,
            amount,
            description,
            paymentGateway,
            expiredAt,
            status: 'pending'
        }
    });
};

/**
 * Get user invoices
 */
const getInvoices = async (userId, options = {}) => {
    const { limit = 20, offset = 0, status } = options;

    const where = { userId };
    if (status) where.status = status;

    return prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
    });
};

/**
 * Get invoice by ID
 */
const getInvoiceById = async (invoiceId) => {
    return prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
            subscription: true
        }
    });
};

/**
 * Get invoice by external ID (from payment gateway)
 */
const getInvoiceByExternalId = async (externalId) => {
    return prisma.invoice.findFirst({
        where: { externalId },
        include: {
            subscription: true
        }
    });
};

/**
 * Update invoice status
 */
const updateInvoiceStatus = async (invoiceId, status, additionalData = {}) => {
    const data = { status, ...additionalData };

    if (status === 'paid') {
        data.paidAt = new Date();
    }

    return prisma.invoice.update({
        where: { id: invoiceId },
        data
    });
};

/**
 * Process successful payment - activate subscription
 * Has idempotency check to prevent duplicate processing
 */
const processSuccessfulPayment = async (invoiceId) => {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    // Idempotency check - if already paid, skip subscription processing
    if (invoice.status === 'paid') {
        console.log(`[Billing] Invoice ${invoiceId} already processed, skipping duplicate`);
        return invoice;
    }

    // Update invoice status
    await updateInvoiceStatus(invoiceId, 'paid');

    // If this is a subscription payment, activate/renew subscription
    if (invoice.subscriptionId) {
        const subscription = invoice.subscription;

        // Get plan data
        const planData = await getPlanByName(subscription.plan);

        // Calculate new period
        const now = new Date();
        const periodEnd = new Date(now);
        if (subscription.billingCycle === 'yearly') {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        // Update subscription
        await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: 'active',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelledAt: null
            }
        });

        // Update user plan and quota
        await prisma.user.update({
            where: { id: invoice.userId },
            data: {
                plan: subscription.plan,
                quota: planData.quota === -1 ? 999999 : planData.quota,
                used: 0,
                lastQuotaReset: now
            }
        });

        console.log(`[Billing] User ${invoice.userId} upgraded to ${subscription.plan}`);
    }

    return invoice;
};

/**
 * Get active payment configuration
 */
const getActivePaymentConfig = async () => {
    return prisma.paymentConfig.findFirst({
        where: { isActive: true }
    });
};

/**
 * Get payment configuration by gateway
 */
const getPaymentConfig = async (gateway) => {
    return prisma.paymentConfig.findFirst({
        where: { gateway }
    });
};

/**
 * Save payment configuration
 */
const savePaymentConfig = async (gateway, config) => {
    const existing = await prisma.paymentConfig.findFirst({
        where: { gateway }
    });

    // If activating this gateway, deactivate others
    if (config.isActive) {
        await prisma.paymentConfig.updateMany({
            where: { gateway: { not: gateway } },
            data: { isActive: false }
        });
    }

    if (existing) {
        return prisma.paymentConfig.update({
            where: { id: existing.id },
            data: config
        });
    }

    return prisma.paymentConfig.create({
        data: { gateway, ...config }
    });
};

/**
 * Get billing statistics
 */
const getBillingStats = async () => {
    const [
        totalRevenue,
        monthlyRevenue,
        activeSubscriptions,
        planDistribution
    ] = await Promise.all([
        // Total revenue (all time)
        prisma.invoice.aggregate({
            where: { status: 'paid' },
            _sum: { amount: true }
        }),
        // This month's revenue
        prisma.invoice.aggregate({
            where: {
                status: 'paid',
                paidAt: {
                    gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                }
            },
            _sum: { amount: true }
        }),
        // Active subscriptions count
        prisma.subscription.count({
            where: { status: 'active' }
        }),
        // Plan distribution
        prisma.subscription.groupBy({
            by: ['plan'],
            where: { status: 'active' },
            _count: true
        })
    ]);

    return {
        totalRevenue: totalRevenue._sum.amount || 0,
        monthlyRevenue: monthlyRevenue._sum.amount || 0,
        activeSubscriptions,
        planDistribution: planDistribution.reduce((acc, item) => {
            acc[item.plan] = item._count;
            return acc;
        }, {})
    };
};

module.exports = {
    initializePlans,
    getPlans,
    getPlanByName,
    getSubscription,
    createSubscription,
    activateSubscription,
    cancelSubscription,
    createInvoice,
    getInvoices,
    getInvoiceById,
    getInvoiceByExternalId,
    updateInvoiceStatus,
    processSuccessfulPayment,
    getActivePaymentConfig,
    getPaymentConfig,
    savePaymentConfig,
    getBillingStats
};
