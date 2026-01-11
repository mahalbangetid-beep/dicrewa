const prisma = require('../utils/prisma');
const quotaService = require('./quotaService');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Broadcast Service
 * Handles processing of broadcast campaigns with rate limiting to avoid spam detection
 */
class BroadcastService {
    constructor() {
        this.whatsapp = null;
        this.isProcessing = false;
        this.processingCampaigns = new Set();
    }

    /**
     * Initialize with WhatsApp service
     */
    init(whatsappService) {
        this.whatsapp = whatsappService;
        console.log('[Broadcast] Service initialized');

        // Start background worker to pick up stalled or "running" campaigns on startup
        this.startWorker();
    }

    /**
     * Start background worker to check for campaigns to process
     */
    async startWorker() {
        setInterval(async () => {
            if (this.isProcessing) return;
            await this.checkAndProcess();
        }, 30000); // Check every 30 seconds
    }

    /**
     * Check for campaigns that need processing
     */
    async checkAndProcess() {
        try {
            // Find campaigns that are "running" or "scheduled" and past their time
            const campaigns = await prisma.broadcast.findMany({
                where: {
                    status: { in: ['running', 'scheduled'] },
                    OR: [
                        { scheduledAt: null },
                        { scheduledAt: { lte: new Date() } }
                    ]
                },
                take: 5
            });

            for (const campaign of campaigns) {
                if (!this.processingCampaigns.has(campaign.id)) {
                    this.processCampaign(campaign.id).catch(err => {
                        console.error(`[Broadcast] Error processing campaign ${campaign.id}:`, err);
                    });
                }
            }
        } catch (error) {
            console.error('[Broadcast] Worker error:', error);
        }
    }

    /**
     * Process a single campaign
     */
    async processCampaign(campaignId) {
        if (this.processingCampaigns.has(campaignId)) return;

        console.log(`[Broadcast] Starting processing for campaign: ${campaignId}`);
        this.processingCampaigns.add(campaignId);

        try {
            // 1. Get campaign and device
            const campaign = await prisma.broadcast.findUnique({
                where: { id: campaignId },
                include: { device: true }
            });

            if (!campaign || campaign.status === 'cancelled' || campaign.status === 'completed') {
                this.processingCampaigns.delete(campaignId);
                return;
            }

            // Update startedAt if not set
            if (!campaign.startedAt) {
                await prisma.broadcast.update({
                    where: { id: campaignId },
                    data: { startedAt: new Date(), status: 'running' }
                });
            }

            // 2. Check device session
            const sessionStatus = this.whatsapp.getSessionStatus(campaign.deviceId);
            if (sessionStatus.status !== 'connected') {
                console.log(`[Broadcast] Device ${campaign.deviceId} is not connected. Pausing campaign.`);
                this.processingCampaigns.delete(campaignId);
                return;
            }

            // 3. Get pending recipients
            const recipients = await prisma.broadcastRecipient.findMany({
                where: {
                    broadcastId: campaignId,
                    status: 'pending'
                },
                orderBy: { id: 'asc' }
            });

            console.log(`[Broadcast] Found ${recipients.length} pending recipients for campaign ${campaignId}`);

            for (const recipient of recipients) {
                // Check if campaign was cancelled during processing
                const currentStatus = await prisma.broadcast.findUnique({
                    where: { id: campaignId },
                    select: { status: true }
                });

                if (currentStatus.status === 'cancelled') {
                    console.log(`[Broadcast] Campaign ${campaignId} cancelled during processing.`);
                    break;
                }

                // ATOMIC LOCKING: Try to claim this recipient by updating status from 'pending' to 'sending'
                // This prevents race condition on server restart or multi-instance deployment
                const lockResult = await prisma.broadcastRecipient.updateMany({
                    where: {
                        id: recipient.id,
                        status: 'pending'  // Only update if still pending
                    },
                    data: { status: 'sending' }
                });

                // If updateMany count is 0, another process already claimed this recipient
                if (lockResult.count === 0) {
                    console.log(`[Broadcast] Recipient ${recipient.phone} already being processed, skipping`);
                    continue;
                }

                try {
                    // Check quota before sending (use direct userId or fallback to device.userId)
                    const quotaUserId = campaign.userId || campaign.device?.userId;
                    if (quotaUserId) {
                        const messageCount = campaign.mediaUrl ? 2 : 1; // text + media = 2
                        const quotaCheck = await quotaService.checkAndIncrement(quotaUserId, messageCount);

                        if (!quotaCheck.allowed) {
                            console.log(`[Broadcast] Quota exceeded for user ${quotaUserId}, stopping broadcast`);

                            // Mark remaining recipients as failed due to quota
                            await prisma.broadcastRecipient.updateMany({
                                where: { broadcastId: campaignId, status: { in: ['pending', 'sending'] } },
                                data: { status: 'failed', error: 'Quota exceeded' }
                            });

                            // Update campaign status
                            await prisma.broadcast.update({
                                where: { id: campaignId },
                                data: { status: 'failed', completedAt: new Date() }
                            });

                            break; // Stop processing
                        }
                    }

                    console.log(`[Broadcast] Sending to ${recipient.phone}...`);

                    let result;
                    if (campaign.mediaUrl) {
                        const mediaUrl = campaign.mediaUrl.toLowerCase();
                        const isImage = /\.(jpeg|jpg|png|gif|webp)$/i.test(mediaUrl);
                        const isVideo = /\.(mp4|mov|avi|mkv|3gp)$/i.test(mediaUrl);
                        const isAudio = /\.(mp3|ogg|m4a|wav|aac)$/i.test(mediaUrl);

                        if (isImage) {
                            result = await this.whatsapp.sendImage(campaign.deviceId, recipient.phone, campaign.mediaUrl, campaign.message);
                        } else if (isVideo) {
                            result = await this.whatsapp.sendVideo(campaign.deviceId, recipient.phone, campaign.mediaUrl, campaign.message);
                        } else if (isAudio) {
                            // Send audio first, then text message separately (audio doesn't support caption)
                            result = await this.whatsapp.sendAudio(campaign.deviceId, recipient.phone, campaign.mediaUrl);
                            if (campaign.message) {
                                await this.whatsapp.sendMessage(campaign.deviceId, recipient.phone, campaign.message);
                            }
                        } else {
                            // Default to document for other file types
                            const filename = campaign.mediaUrl.split('/').pop() || 'file';
                            result = await this.whatsapp.sendDocument(campaign.deviceId, recipient.phone, campaign.mediaUrl, filename, campaign.message);
                        }
                    } else {
                        result = await this.whatsapp.sendMessage(campaign.deviceId, recipient.phone, campaign.message);
                    }

                    // Save message to database logs
                    await prisma.message.create({
                        data: {
                            deviceId: campaign.deviceId,
                            waMessageId: result.messageId,
                            type: 'outgoing',
                            to: recipient.phone,
                            message: campaign.message,
                            mediaUrl: campaign.mediaUrl,
                            status: 'sent',
                            broadcastId: campaignId
                        }
                    });

                    // Update recipient status
                    await prisma.broadcastRecipient.update({
                        where: { id: recipient.id },
                        data: { status: 'sent', sentAt: new Date() }
                    });

                    // Update campaign stats
                    await prisma.broadcast.update({
                        where: { id: campaignId },
                        data: { sent: { increment: 1 } }
                    });

                } catch (sendError) {
                    console.error(`[Broadcast] Failed to send to ${recipient.phone}:`, sendError.message);

                    await prisma.broadcastRecipient.update({
                        where: { id: recipient.id },
                        data: { status: 'failed', error: sendError.message }
                    });

                    await prisma.broadcast.update({
                        where: { id: campaignId },
                        data: { failed: { increment: 1 } }
                    });
                }

                // Random delay between 3-8 seconds to avoid spam detection
                const randomDelay = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;
                await delay(randomDelay);
            }

            // 4. Finalize campaign
            const pendingCount = await prisma.broadcastRecipient.count({
                where: { broadcastId: campaignId, status: 'pending' }
            });

            if (pendingCount === 0) {
                await prisma.broadcast.update({
                    where: { id: campaignId },
                    data: { status: 'completed', completedAt: new Date() }
                });
                console.log(`[Broadcast] Campaign ${campaignId} completed.`);
            }

        } catch (error) {
            console.error(`[Broadcast] Major error in campaign ${campaignId}:`, error);
        } finally {
            this.processingCampaigns.delete(campaignId);
        }
    }

    /**
     * Trigger immediate processing for a campaign
     */
    trigger(campaignId) {
        this.processCampaign(campaignId).catch(err => {
            console.error(`[Broadcast] Trigger error for ${campaignId}:`, err);
        });
    }
}

module.exports = new BroadcastService();
