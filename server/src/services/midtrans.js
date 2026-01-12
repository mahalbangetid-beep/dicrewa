/**
 * Midtrans Payment Gateway Service (Phase 10)
 * Documentation: https://docs.midtrans.com/
 */

const crypto = require('crypto');
const billingService = require('./billing');

const MIDTRANS_API_BASE = {
    sandbox: 'https://api.sandbox.midtrans.com',
    production: 'https://api.midtrans.com'
};

const MIDTRANS_SNAP_BASE = {
    sandbox: 'https://app.sandbox.midtrans.com/snap/v1',
    production: 'https://app.midtrans.com/snap/v1'
};

/**
 * Get Midtrans configuration
 */
const getConfig = async () => {
    const config = await billingService.getPaymentConfig('midtrans');
    if (!config || !config.isActive) {
        throw new Error('Midtrans is not configured or not active');
    }
    return config;
};

/**
 * Make Midtrans API request
 */
const midtransRequest = async (baseUrl, endpoint, method = 'GET', body = null, config) => {
    const url = `${baseUrl}${endpoint}`;

    const authString = Buffer.from(config.midtransServerKey + ':').toString('base64');

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Basic ' + authString
    };

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        console.error('[Midtrans] API Error:', data);
        throw new Error(data.error_messages?.join(', ') || 'Midtrans API error');
    }

    return data;
};

/**
 * Create Snap transaction (redirect to Midtrans payment page)
 */
const createSnapTransaction = async (transactionData) => {
    const config = await getConfig();
    const baseUrl = MIDTRANS_SNAP_BASE[config.mode];

    const {
        orderId,
        amount,
        customerDetails,
        itemDetails,
        callbackUrls
    } = transactionData;

    const payload = {
        transaction_details: {
            order_id: orderId,
            gross_amount: amount
        },
        customer_details: {
            first_name: customerDetails.name,
            email: customerDetails.email,
            phone: customerDetails.phone || ''
        },
        item_details: itemDetails || [{
            id: 'subscription',
            name: 'Subscription Payment',
            price: amount,
            quantity: 1
        }],
        callbacks: {
            finish: callbackUrls?.finish || `${process.env.FRONTEND_URL}/billing?success=true`,
            error: callbackUrls?.error || `${process.env.FRONTEND_URL}/billing?failed=true`,
            pending: callbackUrls?.pending || `${process.env.FRONTEND_URL}/billing?pending=true`
        },
        enabled_payments: [
            'credit_card', 'bca_va', 'bni_va', 'bri_va', 'permata_va',
            'gopay', 'shopeepay', 'dana', 'ovo', 'qris'
        ],
        expiry: {
            unit: 'hour',
            duration: 24
        }
    };

    const result = await midtransRequest(baseUrl, '/transactions', 'POST', payload, config);

    return {
        token: result.token,
        redirectUrl: result.redirect_url
    };
};

/**
 * Get transaction status
 */
const getTransactionStatus = async (orderId) => {
    const config = await getConfig();
    const baseUrl = MIDTRANS_API_BASE[config.mode];

    return midtransRequest(baseUrl, `/v2/${orderId}/status`, 'GET', null, config);
};

/**
 * Cancel transaction
 */
const cancelTransaction = async (orderId) => {
    const config = await getConfig();
    const baseUrl = MIDTRANS_API_BASE[config.mode];

    return midtransRequest(baseUrl, `/v2/${orderId}/cancel`, 'POST', null, config);
};

/**
 * Verify webhook notification signature
 */
const verifyWebhookSignature = async (data) => {
    const config = await getConfig();

    const { order_id, status_code, gross_amount, signature_key } = data;

    // Generate signature: SHA512(order_id+status_code+gross_amount+serverKey)
    const signatureString = `${order_id}${status_code}${gross_amount}${config.midtransServerKey}`;
    const expectedSignature = crypto.createHash('sha512').update(signatureString).digest('hex');

    return signature_key === expectedSignature;
};

/**
 * Handle webhook notification from Midtrans
 */
const handleWebhook = async (data) => {
    console.log('[Midtrans] Webhook received:', data);

    // Verify signature
    const isValid = await verifyWebhookSignature(data);
    if (!isValid) {
        console.error('[Midtrans] Invalid webhook signature');
        return { success: false, error: 'Invalid signature' };
    }

    const { order_id, transaction_status, payment_type } = data;

    // Find invoice by order_id (which is our invoice ID or external ID)
    let invoice = await billingService.getInvoiceById(order_id);
    if (!invoice) {
        invoice = await billingService.getInvoiceByExternalId(order_id);
    }

    if (!invoice) {
        console.error('[Midtrans] Invoice not found for order_id:', order_id);
        return { success: false, error: 'Invoice not found' };
    }

    switch (transaction_status) {
        case 'capture':
        case 'settlement':
            // Idempotency check - skip if already paid
            if (invoice.status === 'paid') {
                console.log(`[Midtrans] Invoice ${invoice.id} already paid, skipping duplicate webhook`);
                return { success: true, message: 'Already processed' };
            }

            // Payment successful - atomic update returns null if already processed
            const updateResult = await billingService.updateInvoiceStatus(invoice.id, 'paid', {
                paymentMethod: payment_type,
                paidAt: new Date()
            });

            if (!updateResult) {
                console.log(`[Midtrans] Race condition prevented for invoice ${invoice.id}`);
                return { success: true, message: 'Already processed (atomic)' };
            }

            await billingService.processSuccessfulPayment(invoice.id);

            // Activate the pending subscription now that payment is confirmed
            if (invoice.subscriptionId) {
                await billingService.activateSubscription(invoice.subscriptionId);
            }

            console.log(`[Midtrans] Payment successful for invoice ${invoice.id}`);
            break;

        case 'pending':
            await billingService.updateInvoiceStatus(invoice.id, 'pending', {
                paymentMethod: payment_type
            });
            break;

        case 'deny':
        case 'cancel':
            await billingService.updateInvoiceStatus(invoice.id, 'failed');
            break;

        case 'expire':
            await billingService.updateInvoiceStatus(invoice.id, 'expired');
            break;

        case 'refund':
        case 'partial_refund':
            await billingService.updateInvoiceStatus(invoice.id, 'refunded');
            break;

        default:
            console.log(`[Midtrans] Unhandled transaction status: ${transaction_status}`);
    }

    return { success: true };
};

/**
 * Create payment for subscription upgrade
 */
const createSubscriptionPayment = async (userId, plan, billingCycle, userDetails) => {
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
        paymentGateway: 'midtrans'
    });

    // Create Midtrans Snap transaction
    const snapResult = await createSnapTransaction({
        orderId: invoice.id,
        amount,
        customerDetails: {
            name: userDetails.name,
            email: userDetails.email,
            phone: userDetails.phone
        },
        itemDetails: [{
            id: plan,
            name: `${planData.displayName} Plan - ${billingCycle}`,
            price: amount,
            quantity: 1
        }]
    });

    // Update invoice with Midtrans data
    await billingService.updateInvoiceStatus(invoice.id, 'pending', {
        externalId: invoice.id,
        paymentUrl: snapResult.redirectUrl,
        metadata: JSON.stringify({ snapToken: snapResult.token })
    });

    return {
        invoice,
        paymentUrl: snapResult.redirectUrl,
        snapToken: snapResult.token
    };
};

/**
 * Get Midtrans client key for frontend Snap
 */
const getClientKey = async () => {
    const config = await getConfig();
    return {
        clientKey: config.midtransClientKey,
        mode: config.mode
    };
};

module.exports = {
    createSnapTransaction,
    getTransactionStatus,
    cancelTransaction,
    verifyWebhookSignature,
    handleWebhook,
    createSubscriptionPayment,
    getClientKey
};
