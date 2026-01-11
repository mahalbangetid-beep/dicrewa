const prisma = require('../utils/prisma');

// Import integration handlers
const googleSheetsHandler = require('./integrations/googleSheets');
const telegramHandler = require('./integrations/telegram');
const discordHandler = require('./integrations/discord');
const slackHandler = require('./integrations/slack');
const emailHandler = require('./integrations/email');
const customWebhookHandler = require('./integrations/customWebhook');
const airtableHandler = require('./integrations/airtable');
const notionHandler = require('./integrations/notion');

/**
 * Integration Service - Core logic for managing integrations
 */
class IntegrationService {
    constructor() {
        // Handler registry
        this.handlers = {
            google_sheets: googleSheetsHandler,
            telegram: telegramHandler,
            discord: discordHandler,
            slack: slackHandler,
            email: emailHandler,
            custom_webhook: customWebhookHandler,
            airtable: airtableHandler,
            notion: notionHandler
        };

        // Available integration types with metadata
        this.availableIntegrations = [
            {
                type: 'google_sheets',
                name: 'Google Sheets',
                category: 'spreadsheet',
                description: 'Sync contacts, import broadcast recipients, export message logs',
                icon: '📊',
                color: '#0F9D58',
                features: ['Bidirectional Sync', 'Contact Import', 'Message Export', 'Auto-Reply Sync']
            },
            {
                type: 'airtable',
                name: 'Airtable',
                category: 'database',
                description: 'Connect to Airtable bases for contact and data management',
                icon: '📋',
                color: '#18BFFF',
                features: ['Contact Sync', 'Custom Tables', 'View Filters']
            },
            {
                type: 'notion',
                name: 'Notion',
                category: 'database',
                description: 'Sync with Notion databases for CRM and knowledge management',
                icon: '📝',
                color: '#000000',
                features: ['Contact Database', 'Message Archive', 'Lead Pages']
            },
            {
                type: 'telegram',
                name: 'Telegram',
                category: 'notification',
                description: 'Receive WhatsApp notifications via Telegram bot',
                icon: '💬',
                color: '#0088CC',
                features: ['Message Forward', 'Keyword Alerts', 'Daily Summary']
            },
            {
                type: 'discord',
                name: 'Discord',
                category: 'notification',
                description: 'Send notifications to Discord channels via webhook',
                icon: '🎮',
                color: '#5865F2',
                features: ['Rich Embeds', 'Channel Routing', 'Role Mentions']
            },
            {
                type: 'slack',
                name: 'Slack',
                category: 'notification',
                description: 'Send team notifications to Slack channels',
                icon: '💼',
                color: '#4A154B',
                features: ['Channel Routing', 'Block Kit Messages', 'Thread Replies']
            },
            {
                type: 'email',
                name: 'Email (SMTP)',
                category: 'notification',
                description: 'Send email notifications via custom SMTP server',
                icon: '📧',
                color: '#EA4335',
                features: ['Custom SMTP', 'HTML Templates', 'Scheduled Digest']
            },
            {
                type: 'custom_webhook',
                name: 'Custom Webhook',
                category: 'automation',
                description: 'Send events to any HTTP endpoint with custom payload',
                icon: '🔗',
                color: '#6366F1',
                features: ['Custom Headers', 'Payload Templates', 'Retry Logic']
            }
        ];
    }

    /**
     * Get all available integration types
     */
    getAvailableIntegrations() {
        return this.availableIntegrations;
    }

    /**
     * Get user's integrations
     */
    async getUserIntegrations(userId) {
        const integrations = await prisma.integration.findMany({
            where: { userId },
            include: {
                logs: {
                    take: 5,
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Mask sensitive config data
        return integrations.map(int => ({
            ...int,
            config: this.maskConfig(int.config, int.type)
        }));
    }

    /**
     * Get single integration by ID
     */
    async getIntegration(id, userId) {
        const integration = await prisma.integration.findFirst({
            where: { id, userId },
            include: {
                logs: {
                    take: 20,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!integration) return null;

        return {
            ...integration,
            config: this.maskConfig(integration.config, integration.type)
        };
    }

    /**
     * Get integration with raw config (internal use only)
     */
    async getIntegrationRaw(id) {
        return await prisma.integration.findUnique({
            where: { id }
        });
    }

    /**
     * Create new integration
     */
    async createIntegration(userId, data) {
        const { name, type, config } = data;

        // Validate type
        const typeInfo = this.availableIntegrations.find(i => i.type === type);
        if (!typeInfo) {
            throw new Error(`Invalid integration type: ${type}`);
        }

        // Create integration
        const integration = await prisma.integration.create({
            data: {
                name,
                type,
                category: typeInfo.category,
                config: JSON.stringify(config),
                status: 'pending',
                userId
            }
        });

        // Log creation
        await this.logAction(integration.id, 'create', 'outbound', 'success', {
            message: 'Integration created'
        });

        return integration;
    }

    /**
     * Update integration
     */
    async updateIntegration(id, userId, data) {
        const existing = await prisma.integration.findFirst({
            where: { id, userId }
        });

        if (!existing) {
            throw new Error('Integration not found');
        }

        // Merge config if provided
        let configToSave = existing.config;
        if (data.config) {
            const existingConfig = JSON.parse(existing.config);
            configToSave = JSON.stringify({ ...existingConfig, ...data.config });
        }

        const updated = await prisma.integration.update({
            where: { id },
            data: {
                name: data.name || existing.name,
                config: configToSave,
                isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
                syncInterval: data.syncInterval !== undefined ? data.syncInterval : existing.syncInterval
            }
        });

        await this.logAction(id, 'update', 'outbound', 'success', {
            message: 'Integration updated'
        });

        return updated;
    }

    /**
     * Delete integration
     */
    async deleteIntegration(id, userId) {
        const integration = await prisma.integration.findFirst({
            where: { id, userId }
        });

        if (!integration) {
            throw new Error('Integration not found');
        }

        await prisma.integration.delete({
            where: { id }
        });

        return { success: true, message: 'Integration deleted' };
    }

    /**
     * Test integration connection
     */
    async testConnection(id, userId) {
        const integration = await prisma.integration.findFirst({
            where: { id, userId }
        });

        if (!integration) {
            throw new Error('Integration not found');
        }

        const handler = this.handlers[integration.type];
        if (!handler) {
            throw new Error(`No handler for integration type: ${integration.type}`);
        }

        const startTime = Date.now();
        let status = 'failed';
        let details = {};

        try {
            const config = JSON.parse(integration.config);
            const result = await handler.testConnection(config);

            status = result.success ? 'success' : 'failed';
            details = result;

            // Update integration status
            await prisma.integration.update({
                where: { id },
                data: {
                    status: result.success ? 'connected' : 'error',
                    errorMessage: result.success ? null : result.message
                }
            });

        } catch (error) {
            details = { message: error.message };

            await prisma.integration.update({
                where: { id },
                data: {
                    status: 'error',
                    errorMessage: error.message
                }
            });
        }

        const duration = Date.now() - startTime;

        // Log test
        await this.logAction(id, 'test', 'outbound', status, details, 0, duration);

        return { status, ...details };
    }

    /**
     * Trigger sync for an integration
     */
    async syncIntegration(id, userId, options = {}) {
        const integration = await prisma.integration.findFirst({
            where: { id, userId }
        });

        if (!integration) {
            throw new Error('Integration not found');
        }

        if (!integration.isActive) {
            throw new Error('Integration is not active');
        }

        const handler = this.handlers[integration.type];
        if (!handler || !handler.sync) {
            throw new Error(`Sync not supported for integration type: ${integration.type}`);
        }

        // ATOMIC LOCK: Try to acquire sync lock by updating status to 'syncing'
        // Only succeeds if status is NOT already 'syncing' (prevents race condition)
        const lockResult = await prisma.integration.updateMany({
            where: {
                id,
                status: { not: 'syncing' } // Only update if not already syncing
            },
            data: { status: 'syncing' }
        });

        // If no rows were updated, another sync is already in progress
        if (lockResult.count === 0) {
            console.log(`[IntegrationService] Sync skipped for ${id} - already syncing`);
            return {
                status: 'skipped',
                reason: 'Another sync is already in progress',
                recordsCount: 0
            };
        }

        console.log(`[IntegrationService] Acquired sync lock for ${id}`);

        const startTime = Date.now();
        let status = 'failed';
        let recordsCount = 0;
        let details = {};

        try {
            const config = JSON.parse(integration.config);
            const result = await handler.sync(config, options, userId);

            status = result.success ? 'success' : 'failed';
            recordsCount = result.recordsCount || 0;
            details = result;

            // Update integration
            await prisma.integration.update({
                where: { id },
                data: {
                    status: 'connected',
                    lastSyncAt: new Date(),
                    syncCount: { increment: 1 },
                    errorMessage: null
                }
            });

        } catch (error) {
            details = { message: error.message };

            await prisma.integration.update({
                where: { id },
                data: {
                    status: 'error',
                    errorMessage: error.message
                }
            });
        }

        const duration = Date.now() - startTime;

        // Log sync
        await this.logAction(id, 'sync', options.direction || 'outbound', status, details, recordsCount, duration);

        return { status, recordsCount, ...details };
    }

    /**
     * Trigger integrations for a specific event
     * Called from other services when events occur
     * Includes rate limiting to prevent overwhelming external services
     */
    async triggerEvent(eventName, data, userId = null) {
        // Rate limiting: delay between integration calls (ms)
        const DELAY_BETWEEN_CALLS = 100;

        try {
            // Find active integrations that handle events
            const where = {
                isActive: true,
                status: 'connected',
                category: { in: ['notification', 'automation'] }
            };
            if (userId) where.userId = userId;

            const integrations = await prisma.integration.findMany({ where });

            for (let i = 0; i < integrations.length; i++) {
                const integration = integrations[i];
                const handler = this.handlers[integration.type];
                if (!handler || !handler.handleEvent) continue;

                try {
                    const config = JSON.parse(integration.config);

                    // Check if this integration is subscribed to this event
                    if (config.events && !config.events.includes(eventName)) {
                        continue;
                    }

                    await handler.handleEvent(eventName, data, config);

                    await this.logAction(integration.id, eventName, 'outbound', 'success', {
                        event: eventName
                    });

                } catch (error) {
                    console.error(`[Integration] Error triggering ${integration.type} for ${eventName}:`, error.message);

                    await this.logAction(integration.id, eventName, 'outbound', 'failed', {
                        event: eventName,
                        error: error.message
                    });
                }

                // Rate limiting: add delay between calls to prevent overwhelming external services
                // Skip delay for the last integration
                if (i < integrations.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS));
                }
            }
        } catch (error) {
            console.error('[Integration] Error finding integrations:', error);
        }
    }

    /**
     * Get integration logs
     */
    async getIntegrationLogs(id, userId, limit = 50) {
        const integration = await prisma.integration.findFirst({
            where: { id, userId }
        });

        if (!integration) {
            throw new Error('Integration not found');
        }

        return await prisma.integrationLog.findMany({
            where: { integrationId: id },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }

    /**
     * Log integration action
     */
    async logAction(integrationId, action, direction, status, details = {}, recordsCount = 0, duration = null) {
        try {
            await prisma.integrationLog.create({
                data: {
                    integrationId,
                    action,
                    direction,
                    status,
                    recordsCount,
                    duration,
                    details: JSON.stringify(details)
                }
            });
        } catch (error) {
            console.error('[Integration] Failed to log action:', error);
        }
    }

    /**
     * Mask sensitive config data for API responses
     */
    maskConfig(configJson, type) {
        try {
            const config = JSON.parse(configJson);
            const masked = { ...config };

            // Mask sensitive fields
            const sensitiveFields = ['apiKey', 'token', 'botToken', 'secret', 'pass', 'password', 'webhookUrl'];

            for (const field of sensitiveFields) {
                if (masked[field]) {
                    const value = masked[field];
                    if (typeof value === 'string' && value.length > 8) {
                        masked[field] = value.substring(0, 4) + '****' + value.substring(value.length - 4);
                    } else {
                        masked[field] = '****';
                    }
                }
            }

            // Handle nested auth object
            if (masked.auth) {
                if (masked.auth.pass) masked.auth.pass = '****';
                if (masked.auth.password) masked.auth.password = '****';
            }

            return JSON.stringify(masked);
        } catch {
            return configJson;
        }
    }

    /**
     * Toggle integration active status
     */
    async toggleIntegration(id, userId, isActive) {
        const integration = await prisma.integration.findFirst({
            where: { id, userId }
        });

        if (!integration) {
            throw new Error('Integration not found');
        }

        return await prisma.integration.update({
            where: { id },
            data: { isActive }
        });
    }
}

module.exports = new IntegrationService();
