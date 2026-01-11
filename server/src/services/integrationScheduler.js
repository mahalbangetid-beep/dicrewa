/**
 * Integration Scheduler Service (Phase 6 - Periodic Sync)
 * Handles scheduled periodic sync for integrations with syncInterval
 */

const cron = require('node-cron');
const prisma = require('../utils/prisma');
const integrationService = require('./integrationService');

class IntegrationScheduler {
    constructor() {
        this.jobs = new Map(); // Map of integrationId -> cron job
        this.mainScheduler = null;
    }

    /**
     * Initialize the scheduler
     * Runs every minute to check for integrations that need syncing
     */
    async initialize() {
        console.log('[IntegrationScheduler] Initializing...');

        // Main scheduler runs every minute to check for due syncs
        this.mainScheduler = cron.schedule('* * * * *', async () => {
            await this.checkAndRunDueSyncs();
        });

        // Load initial sync schedule
        await this.loadScheduledIntegrations();

        console.log('[IntegrationScheduler] Initialized successfully');
    }

    /**
     * Load all active integrations with sync interval
     */
    async loadScheduledIntegrations() {
        try {
            const integrations = await prisma.integration.findMany({
                where: {
                    isActive: true,
                    syncInterval: { not: null },
                    category: { in: ['spreadsheet', 'database'] }
                }
            });

            console.log(`[IntegrationScheduler] Found ${integrations.length} scheduled integrations`);

            for (const integration of integrations) {
                this.registerIntegration(integration);
            }
        } catch (error) {
            console.error('[IntegrationScheduler] Error loading scheduled integrations:', error);
        }
    }

    /**
     * Register an integration for scheduled sync
     */
    registerIntegration(integration) {
        if (!integration.syncInterval) return;

        // Calculate cron expression based on interval (in minutes)
        const cronExpression = this.intervalToCron(integration.syncInterval);

        if (this.jobs.has(integration.id)) {
            this.jobs.get(integration.id).stop();
        }

        const job = cron.schedule(cronExpression, async () => {
            await this.syncIntegration(integration.id);
        });

        this.jobs.set(integration.id, job);
        console.log(`[IntegrationScheduler] Registered integration ${integration.id} with interval ${integration.syncInterval} mins`);
    }

    /**
     * Unregister an integration from scheduled sync
     */
    unregisterIntegration(integrationId) {
        if (this.jobs.has(integrationId)) {
            this.jobs.get(integrationId).stop();
            this.jobs.delete(integrationId);
            console.log(`[IntegrationScheduler] Unregistered integration ${integrationId}`);
        }
    }

    /**
     * Update integration schedule
     */
    async updateSchedule(integrationId, syncInterval) {
        this.unregisterIntegration(integrationId);

        if (syncInterval) {
            const integration = await prisma.integration.findUnique({
                where: { id: integrationId }
            });
            if (integration && integration.isActive) {
                this.registerIntegration({ ...integration, syncInterval });
            }
        }
    }

    /**
     * Check and run any integrations that are due for sync
     * This is a fallback mechanism in case individual cron jobs miss
     */
    async checkAndRunDueSyncs() {
        try {
            const now = new Date();

            // Find integrations that are:
            // 1. Active
            // 2. Have a sync interval
            // 3. Last sync was more than interval ago (or never synced)
            // 4. Not currently syncing
            const integrations = await prisma.integration.findMany({
                where: {
                    isActive: true,
                    status: { not: 'syncing' },
                    syncInterval: { not: null },
                    category: { in: ['spreadsheet', 'database'] }
                }
            });

            for (const integration of integrations) {
                const shouldSync = this.shouldSync(integration, now);
                if (shouldSync) {
                    console.log(`[IntegrationScheduler] Due sync for ${integration.name} (${integration.id})`);
                    this.syncIntegration(integration.id).catch(err => {
                        console.error(`[IntegrationScheduler] Error syncing ${integration.id}:`, err);
                    });
                }
            }
        } catch (error) {
            console.error('[IntegrationScheduler] Error checking due syncs:', error);
        }
    }

    /**
     * Determine if an integration should be synced
     */
    shouldSync(integration, now) {
        if (!integration.syncInterval) return false;

        // If never synced, sync now
        if (!integration.lastSyncAt) return true;

        // Calculate next sync time
        const lastSync = new Date(integration.lastSyncAt);
        const nextSync = new Date(lastSync.getTime() + (integration.syncInterval * 60 * 1000));

        return now >= nextSync;
    }

    /**
     * Execute sync for an integration
     */
    async syncIntegration(integrationId) {
        try {
            // Get integration with user info
            const integration = await prisma.integration.findUnique({
                where: { id: integrationId }
            });

            if (!integration || !integration.isActive) {
                console.log(`[IntegrationScheduler] Integration ${integrationId} not found or inactive`);
                return;
            }

            console.log(`[IntegrationScheduler] Starting sync for ${integration.name} (${integrationId})`);

            // Use the integration service to perform sync
            // The service has atomic locking to prevent race conditions
            const result = await integrationService.syncIntegration(
                integrationId,
                integration.userId,
                { direction: 'bidirectional', scheduled: true }
            );

            // Handle skipped syncs (another sync was already in progress)
            if (result.status === 'skipped') {
                console.log(`[IntegrationScheduler] Sync skipped for ${integration.name}: ${result.reason}`);
                return result;
            }

            console.log(`[IntegrationScheduler] Sync completed for ${integration.name}: ${result.status}`);

            return result;
        } catch (error) {
            console.error(`[IntegrationScheduler] Error syncing ${integrationId}:`, error);

            // Log the error
            await prisma.integrationLog.create({
                data: {
                    integrationId,
                    action: 'sync',
                    direction: 'outbound',
                    status: 'failed',
                    details: JSON.stringify({ error: error.message, scheduled: true })
                }
            });
        }
    }

    /**
     * Convert interval in minutes to cron expression
     */
    intervalToCron(minutes) {
        if (minutes < 1) minutes = 1;

        // Common intervals
        if (minutes === 1) return '* * * * *'; // Every minute
        if (minutes === 5) return '*/5 * * * *'; // Every 5 minutes
        if (minutes === 10) return '*/10 * * * *'; // Every 10 minutes
        if (minutes === 15) return '*/15 * * * *'; // Every 15 minutes
        if (minutes === 30) return '*/30 * * * *'; // Every 30 minutes
        if (minutes === 60) return '0 * * * *'; // Every hour
        if (minutes === 120) return '0 */2 * * *'; // Every 2 hours
        if (minutes === 360) return '0 */6 * * *'; // Every 6 hours
        if (minutes === 720) return '0 */12 * * *'; // Every 12 hours
        if (minutes === 1440) return '0 0 * * *'; // Daily

        // For other intervals, just check every minute (the checkAndRunDueSyncs will handle it)
        return '* * * * *';
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            isRunning: this.mainScheduler !== null,
            registeredJobs: this.jobs.size,
            jobs: Array.from(this.jobs.keys())
        };
    }

    /**
     * Get next sync time for an integration
     */
    getNextSyncTime(integration) {
        if (!integration.syncInterval || !integration.lastSyncAt) {
            return null;
        }

        const lastSync = new Date(integration.lastSyncAt);
        return new Date(lastSync.getTime() + (integration.syncInterval * 60 * 1000));
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (this.mainScheduler) {
            this.mainScheduler.stop();
            this.mainScheduler = null;
        }

        for (const [id, job] of this.jobs) {
            job.stop();
        }
        this.jobs.clear();

        console.log('[IntegrationScheduler] Stopped');
    }

    /**
     * Force sync all scheduled integrations
     * @param {string} userId - Optional user ID to filter by
     */
    async forceSyncAll(userId = null) {
        const results = [];

        // SECURITY: Only sync integrations belonging to the user
        for (const integrationId of this.jobs.keys()) {
            try {
                // Check ownership if userId provided
                if (userId) {
                    const integration = await prisma.integration.findFirst({
                        where: { id: integrationId, userId: userId }
                    });
                    if (!integration) {
                        // Skip integrations that don't belong to this user
                        continue;
                    }
                }

                const result = await this.syncIntegration(integrationId);
                results.push({ integrationId, result });
            } catch (error) {
                results.push({ integrationId, error: error.message });
            }
        }
        return results;
    }
}

module.exports = new IntegrationScheduler();
