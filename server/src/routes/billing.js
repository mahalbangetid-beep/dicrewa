/**
 * Billing Routes (Phase 10)
 * Handles subscription, payment, and invoice management
 */

const express = require('express');
const router = express.Router();
const { protect: auth, adminOnly } = require('../middleware/auth');
const billingService = require('../services/billing');
const xenditService = require('../services/xendit');
const midtransService = require('../services/midtrans');
const prisma = require('../utils/prisma');

// ==================== PLANS ====================

/**
 * GET /api/billing/plans - Get all pricing plans
 */
router.get('/plans', async (req, res) => {
    try {
        const plans = await billingService.getPlans();

        // Parse features JSON for each plan
        const formattedPlans = plans.map(plan => ({
            ...plan,
            features: JSON.parse(plan.features)
        }));

        res.json({ success: true, data: formattedPlans });
    } catch (error) {
        console.error('[Billing] Error getting plans:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== SUBSCRIPTION ====================

/**
 * GET /api/billing/subscription - Get current user's subscription
 */
router.get('/subscription', auth, async (req, res) => {
    try {
        const subscription = await billingService.getSubscription(req.user.id);
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { plan: true, quota: true, used: true }
        });

        res.json({
            success: true,
            data: {
                subscription,
                currentPlan: user.plan,
                quota: user.quota,
                used: user.used
            }
        });
    } catch (error) {
        console.error('[Billing] Error getting subscription:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/billing/subscribe - Subscribe to a plan
 */
router.post('/subscribe', auth, async (req, res) => {
    try {
        const { plan, billingCycle = 'monthly' } = req.body;

        if (!plan) {
            return res.status(400).json({ error: 'Plan is required' });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        // Get active payment gateway
        const paymentConfig = await billingService.getActivePaymentConfig();

        // If plan is free, just update subscription
        const planData = await billingService.getPlanByName(plan);
        if (!planData) {
            return res.status(400).json({ error: 'Invalid plan' });
        }

        const amount = billingCycle === 'yearly' ? planData.yearlyPrice : planData.monthlyPrice;

        if (amount === 0) {
            // Free plan
            const subscription = await billingService.createSubscription(req.user.id, plan, billingCycle);
            return res.json({
                success: true,
                data: { subscription, paymentRequired: false }
            });
        }

        // Payment required
        if (!paymentConfig) {
            return res.status(400).json({ error: 'No payment gateway configured' });
        }

        let paymentResult;

        if (paymentConfig.gateway === 'xendit') {
            paymentResult = await xenditService.createSubscriptionPayment(
                req.user.id,
                plan,
                billingCycle,
                user.email
            );
        } else if (paymentConfig.gateway === 'midtrans') {
            paymentResult = await midtransService.createSubscriptionPayment(
                req.user.id,
                plan,
                billingCycle,
                { name: user.name, email: user.email }
            );
        } else {
            return res.status(400).json({ error: 'Invalid payment gateway' });
        }

        res.json({
            success: true,
            data: {
                paymentRequired: true,
                paymentUrl: paymentResult.paymentUrl,
                invoice: paymentResult.invoice,
                snapToken: paymentResult.snapToken // For Midtrans Snap
            }
        });
    } catch (error) {
        console.error('[Billing] Error subscribing:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/billing/cancel - Cancel subscription
 */
router.post('/cancel', auth, async (req, res) => {
    try {
        const subscription = await billingService.cancelSubscription(req.user.id);
        res.json({ success: true, data: subscription });
    } catch (error) {
        console.error('[Billing] Error cancelling subscription:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== INVOICES ====================

/**
 * GET /api/billing/invoices - Get user's invoices
 */
router.get('/invoices', auth, async (req, res) => {
    try {
        const { limit = 20, offset = 0, status } = req.query;
        const invoices = await billingService.getInvoices(req.user.id, {
            limit: parseInt(limit),
            offset: parseInt(offset),
            status
        });

        res.json({ success: true, data: invoices });
    } catch (error) {
        console.error('[Billing] Error getting invoices:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/billing/invoices/:id - Get invoice details
 */
router.get('/invoices/:id', auth, async (req, res) => {
    try {
        const invoice = await billingService.getInvoiceById(req.params.id);

        if (!invoice || invoice.userId !== req.user.id) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        res.json({ success: true, data: invoice });
    } catch (error) {
        console.error('[Billing] Error getting invoice:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== PAYMENT CONFIG (Admin) ====================

/**
 * GET /api/billing/payment-config - Get payment configuration status
 */
router.get('/payment-config', auth, adminOnly, async (req, res) => {
    try {
        const activeConfig = await billingService.getActivePaymentConfig();

        // Don't expose sensitive keys to frontend
        const safeConfig = activeConfig ? {
            gateway: activeConfig.gateway,
            mode: activeConfig.mode,
            isActive: activeConfig.isActive,
            hasXenditKey: !!activeConfig.xenditApiKey,
            hasMidtransKey: !!activeConfig.midtransServerKey
        } : null;

        res.json({
            success: true,
            data: {
                active: safeConfig,
                available: ['xendit', 'midtrans']
            }
        });
    } catch (error) {
        console.error('[Billing] Error getting payment config:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/billing/payment-config/:gateway - Get specific gateway config (for admin)
 */
router.get('/payment-config/:gateway', auth, adminOnly, async (req, res) => {
    try {
        const { gateway } = req.params;
        const config = await billingService.getPaymentConfig(gateway);

        if (!config) {
            return res.json({
                success: true,
                data: { gateway, isActive: false, mode: 'sandbox' }
            });
        }

        // Mask sensitive keys
        const maskedConfig = {
            ...config,
            xenditApiKey: config.xenditApiKey ? '••••' + config.xenditApiKey.slice(-4) : null,
            xenditSecretKey: config.xenditSecretKey ? '••••••••' : null,
            xenditCallbackToken: config.xenditCallbackToken ? '••••••••' : null,
            midtransServerKey: config.midtransServerKey ? '••••' + config.midtransServerKey.slice(-4) : null,
            midtransClientKey: config.midtransClientKey ? '••••' + config.midtransClientKey.slice(-4) : null
        };

        res.json({ success: true, data: maskedConfig });
    } catch (error) {
        console.error('[Billing] Error getting gateway config:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/billing/payment-config/:gateway - Save payment gateway config
 */
router.post('/payment-config/:gateway', auth, adminOnly, async (req, res) => {
    try {
        const { gateway } = req.params;
        const {
            isActive,
            mode,
            xenditApiKey,
            xenditSecretKey,
            xenditCallbackToken,
            midtransServerKey,
            midtransClientKey
        } = req.body;

        const config = {
            isActive: isActive || false,
            mode: mode || 'sandbox'
        };

        if (gateway === 'xendit') {
            if (xenditApiKey && !xenditApiKey.startsWith('••••')) {
                config.xenditApiKey = xenditApiKey;
            }
            if (xenditSecretKey && !xenditSecretKey.startsWith('••••')) {
                config.xenditSecretKey = xenditSecretKey;
            }
            if (xenditCallbackToken && !xenditCallbackToken.startsWith('••••')) {
                config.xenditCallbackToken = xenditCallbackToken;
            }
        } else if (gateway === 'midtrans') {
            if (midtransServerKey && !midtransServerKey.startsWith('••••')) {
                config.midtransServerKey = midtransServerKey;
            }
            if (midtransClientKey && !midtransClientKey.startsWith('••••')) {
                config.midtransClientKey = midtransClientKey;
            }
        } else {
            return res.status(400).json({ error: 'Invalid gateway' });
        }

        // Generate webhook URL
        const backendUrl = process.env.BACKEND_URL;
        if (!backendUrl) {
            console.warn('[Billing] WARNING: BACKEND_URL not set - webhook URL will use localhost and will NOT work in production!');
        }
        config.webhookUrl = `${backendUrl || 'http://localhost:3001'}/api/billing/webhook/${gateway}`;

        const result = await billingService.savePaymentConfig(gateway, config);

        res.json({
            success: true,
            data: {
                gateway: result.gateway,
                isActive: result.isActive,
                mode: result.mode,
                webhookUrl: result.webhookUrl
            }
        });
    } catch (error) {
        console.error('[Billing] Error saving payment config:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== WEBHOOKS ====================

/**
 * POST /api/billing/webhook/xendit - Xendit webhook callback
 */
router.post('/webhook/xendit', async (req, res) => {
    try {
        // Verify signature
        const isValid = await xenditService.verifyWebhookSignature(req.headers, req.body);
        if (!isValid) {
            console.error('[Billing] Invalid Xendit webhook signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Handle webhook based on event type
        const eventType = req.headers['x-callback-event'] || 'invoice.paid';
        const result = await xenditService.handleWebhook(eventType, req.body);

        res.json(result);
    } catch (error) {
        console.error('[Billing] Xendit webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/billing/webhook/midtrans - Midtrans webhook notification
 */
router.post('/webhook/midtrans', async (req, res) => {
    try {
        const result = await midtransService.handleWebhook(req.body);
        res.json(result);
    } catch (error) {
        console.error('[Billing] Midtrans webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== STATS (Admin) ====================

/**
 * GET /api/billing/stats - Get billing statistics
 */
router.get('/stats', auth, adminOnly, async (req, res) => {
    try {
        const stats = await billingService.getBillingStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[Billing] Error getting stats:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/billing/midtrans-client-key - Get Midtrans client key for Snap
 */
router.get('/midtrans-client-key', auth, async (req, res) => {
    try {
        const config = await midtransService.getClientKey();
        res.json({ success: true, data: config });
    } catch (error) {
        res.status(400).json({ error: 'Midtrans not configured' });
    }
});

module.exports = router;
