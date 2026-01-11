/**
 * Xendit Payment Gateway Service (Phase 10)
 * Documentation: https://developers.xendit.co/
 */

const crypto = require('crypto');
const billingService = require('./billing');

const XENDIT_API_BASE = {
    production: 'https://api.xendit.co',
    sandbox: 'https://api.xendit.co' // Xendit uses same URL, mode determined by API key
};

/**
 * Get Xendit configuration
 */
const getConfig = async () => {
    const config = await billingService.getPaymentConfig('xendit');
    if (!config || !config.isActive) {
        throw new Error('Xendit is not configured or not active');
    }
    return config;
};

/**
 * Make Xendit API request
 */
const xenditRequest = async (endpoint, method = 'GET', body = null, config) => {
    const url = `${XENDIT_API_BASE[config.mode]}${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(config.xenditApiKey + ':').toString('base64')
    };

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        console.error('[Xendit] API Error:', data);
        throw new Error(data.message || 'Xendit API error');
    }

    return data;
};

/**
 * Create Invoice (for subscription payment)
 */
const createInvoice = async (invoiceData) => {
    const config = await getConfig();

    const {
        externalId,
        amount,
        payerEmail,
        description,
        successRedirectUrl,
        failureRedirectUrl,
        invoiceDuration = 86400, // 24 hours default
        currency = 'IDR'
    } = invoiceData;

    const payload = {
        external_id: externalId,
        amount,
        payer_email: payerEmail,
        description,
        invoice_duration: invoiceDuration,
        currency,
        success_redirect_url: successRedirectUrl,
        failure_redirect_url: failureRedirectUrl,
        payment_methods: ['CREDIT_CARD', 'BCA', 'BNI', 'BRI', 'MANDIRI', 'PERMATA', 'OVO', 'DANA', 'SHOPEEPAY', 'LINKAJA', 'QRIS']
    };

    const result = await xenditRequest('/v2/invoices', 'POST', payload, config);

    return {
        id: result.id,
        externalId: result.external_id,
        invoiceUrl: result.invoice_url,
        amount: result.amount,
        status: result.status,
        expiryDate: result.expiry_date
    };
};

/**
 * Get Invoice status
 */
const getInvoice = async (invoiceId) => {
    const config = await getConfig();
    return xenditRequest(`/v2/invoices/${invoiceId}`, 'GET', null, config);
};

/**
 * Expire Invoice
 */
const expireInvoice = async (invoiceId) => {
    const config = await getConfig();
    return xenditRequest(`/invoices/${invoiceId}/expire!`, 'POST', null, config);
};

/**
 * Verify webhook callback signature
 */
const verifyWebhookSignature = async (headers, rawBody) => {
    const config = await getConfig();

    if (!config.xenditCallbackToken) {
        console.warn('[Xendit] Callback token not configured, skipping verification');
        return true;
    }

    const callbackToken = headers['x-callback-token'];
    return callbackToken === config.xenditCallbackToken;
};

/**
 * Handle webhook callback from Xendit
 */
const handleWebhook = async (eventType, data) => {
    console.log(`[Xendit] Webhook received: ${eventType}`, data);

    switch (eventType) {
        case 'invoice.paid':
            return handleInvoicePaid(data);
        case 'invoice.expired':
            return handleInvoiceExpired(data);
        default:
            console.log(`[Xendit] Unhandled event type: ${eventType}`);
            return { success: true };
    }
};

/**
 * Handle successful payment
 */
const handleInvoicePaid = async (data) => {
    const { external_id, payment_method, paid_at } = data;

    // Find invoice by external ID
    const invoice = await billingService.getInvoiceByExternalId(external_id);
    if (!invoice) {
        console.error('[Xendit] Invoice not found for external_id:', external_id);
        return { success: false, error: 'Invoice not found' };
    }

    // Idempotency check - skip if already paid
    if (invoice.status === 'paid') {
        console.log(`[Xendit] Invoice ${invoice.id} already paid, skipping duplicate webhook`);
        return { success: true, message: 'Already processed' };
    }

    // Update invoice with payment details
    await billingService.updateInvoiceStatus(invoice.id, 'paid', {
        paymentMethod: payment_method,
        paidAt: new Date(paid_at)
    });

    // Process successful payment
    await billingService.processSuccessfulPayment(invoice.id);

    // Activate the pending subscription now that payment is confirmed
    if (invoice.subscriptionId) {
        await billingService.activateSubscription(invoice.subscriptionId);
    }

    return { success: true };
};

/**
 * Handle expired invoice
 */
const handleInvoiceExpired = async (data) => {
    const { external_id } = data;

    const invoice = await billingService.getInvoiceByExternalId(external_id);
    if (!invoice) {
        return { success: false, error: 'Invoice not found' };
    }

    await billingService.updateInvoiceStatus(invoice.id, 'expired');

    return { success: true };
};

/**
 * Create payment for subscription upgrade
 */
const createSubscriptionPayment = async (userId, plan, billingCycle, userEmail) => {
    const planData = await billingService.getPlanByName(plan);
    if (!planData) throw new Error('Invalid plan');

    const amount = billingCycle === 'yearly' ? planData.yearlyPrice : planData.monthlyPrice;

    if (amount === 0) {
        // Free plan, just create subscription with ACTIVE status immediately
        return billingService.createSubscription(userId, plan, billingCycle, 'active');
    }

    // Create or get subscription with PENDING status (will be activated after payment)
    let subscription = await billingService.getSubscription(userId);
    if (!subscription) {
        // Create with PENDING status - user won't get plan benefits yet
        subscription = await billingService.createSubscription(userId, plan, billingCycle, 'pending');
    } else {
        // Update existing subscription to pending with new plan
        subscription = await billingService.createSubscription(userId, plan, billingCycle, 'pending');
    }

    // Create invoice
    const invoice = await billingService.createInvoice({
        userId,
        subscriptionId: subscription.id,
        amount,
        description: `Upgrade to ${planData.displayName} (${billingCycle})`,
        paymentGateway: 'xendit'
    });

    // Create Xendit invoice
    const config = await getConfig();
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const xenditInvoice = await createInvoice({
        externalId: invoice.id,
        amount,
        payerEmail: userEmail,
        description: invoice.description,
        successRedirectUrl: `${baseUrl}/billing?success=true`,
        failureRedirectUrl: `${baseUrl}/billing?failed=true`
    });

    // Update invoice with Xendit data
    await billingService.updateInvoiceStatus(invoice.id, 'pending', {
        externalId: xenditInvoice.id,
        paymentUrl: xenditInvoice.invoiceUrl
    });

    return {
        invoice,
        paymentUrl: xenditInvoice.invoiceUrl
    };
};

module.exports = {
    createInvoice,
    getInvoice,
    expireInvoice,
    verifyWebhookSignature,
    handleWebhook,
    createSubscriptionPayment
};
