/**
 * Plan Limits Service
 * Centralized plan feature enforcement
 * Based on PLAN_FEATURES.md configuration
 */

const prisma = require('../utils/prisma');

// Plan limits configuration
const PLAN_LIMITS = {
    free: {
        // Device
        maxDevices: 1,
        multiDevice: false,

        // Messaging
        messageQuota: 1500,
        messageHistoryDays: 7,
        watermark: true, // Only free plan has watermark

        // Broadcast
        broadcastEnabled: true,
        scheduledBroadcast: false,
        broadcastAnalytics: false,

        // Auto-Reply
        maxAutoReplyRules: 5,
        regexMatching: false,
        mediaResponse: false,

        // Chatbot
        chatbotEnabled: true,
        maxChatbots: 2, // Limited for free plan

        // RAG / Smart Knowledge
        ragEnabled: false,
        maxKnowledgeBases: 0,
        maxRagQueriesPerMonth: 0,
        maxFileSize: 0,

        // Contacts
        maxContacts: 100,
        contactNotes: false,

        // Analytics
        broadcastAnalyticsEnabled: false,
        exportReports: false,

        // Templates  
        templatesEnabled: true,
        maxTemplates: 5, // Limited for free plan

        // AI Features
        aiEnabled: true,
        embeddingEnabled: false,

        // Support (label only, no enforcement)
        supportLevel: 'community'
    },

    pro: {
        // Device
        maxDevices: 3,
        multiDevice: true,

        // Messaging
        messageQuota: 5000,
        messageHistoryDays: Infinity, // No auto-delete for paid plans
        watermark: false, // No watermark for paid plans

        // Broadcast
        broadcastEnabled: true,
        scheduledBroadcast: true,
        broadcastAnalytics: true,
        maxRecipientsPerBroadcast: Infinity,

        // Auto-Reply
        maxAutoReplyRules: Infinity,
        regexMatching: true,
        mediaResponse: true,

        // Chatbot
        chatbotEnabled: true,
        maxChatbots: Infinity,

        // RAG / Smart Knowledge
        ragEnabled: true,
        maxKnowledgeBases: 3,
        maxRagQueriesPerMonth: 50,
        maxFileSize: 5 * 1024 * 1024, // 5MB

        // Contacts
        maxContacts: 5000,
        contactNotes: true,

        // Analytics
        broadcastAnalyticsEnabled: true,
        exportReports: true,

        // Templates
        templatesEnabled: true,
        maxTemplates: 20,

        // AI Features
        aiEnabled: true,
        embeddingEnabled: true,

        // Support
        supportLevel: 'priority'
    },

    enterprise: {
        // Device
        maxDevices: 10,
        multiDevice: true,

        // Messaging
        messageQuota: 15000,
        messageHistoryDays: Infinity,
        watermark: false, // No watermark for paid plans

        // Broadcast
        broadcastEnabled: true,
        scheduledBroadcast: true,
        broadcastAnalytics: true,
        maxRecipientsPerBroadcast: Infinity,

        // Auto-Reply
        maxAutoReplyRules: Infinity,
        regexMatching: true,
        mediaResponse: true,

        // Chatbot
        chatbotEnabled: true,
        maxChatbots: 10,
        maxNodesPerFlow: 50,

        // RAG / Smart Knowledge
        ragEnabled: true,
        maxKnowledgeBases: 20,
        maxRagQueriesPerMonth: 1000,
        maxFileSize: 25 * 1024 * 1024, // 25MB

        // Contacts
        maxContacts: 50000,
        contactNotes: true,

        // Analytics
        broadcastAnalyticsEnabled: true,
        exportReports: true,

        // Templates
        templatesEnabled: true,
        maxTemplates: 100,

        // AI Features
        aiEnabled: true,
        embeddingEnabled: true,

        // Advanced
        teamEnabled: true,
        auditLogs: true,
        whiteLabel: false,
        customBranding: false,

        // Support
        supportLevel: 'dedicated'
    },

    unlimited: {
        // Device
        maxDevices: Infinity,
        multiDevice: true,

        // Messaging
        messageQuota: Infinity,
        messageHistoryDays: Infinity,
        watermark: false, // No watermark for paid plans

        // Broadcast
        broadcastEnabled: true,
        scheduledBroadcast: true,
        broadcastAnalytics: true,
        maxRecipientsPerBroadcast: Infinity,

        // Auto-Reply
        maxAutoReplyRules: Infinity,
        regexMatching: true,
        mediaResponse: true,

        // Chatbot
        chatbotEnabled: true,
        maxChatbots: Infinity,
        maxNodesPerFlow: Infinity,

        // RAG / Smart Knowledge
        ragEnabled: true,
        maxKnowledgeBases: Infinity,
        maxRagQueriesPerMonth: Infinity,
        maxFileSize: 100 * 1024 * 1024, // 100MB

        // Contacts
        maxContacts: Infinity,
        contactNotes: true,

        // Analytics
        broadcastAnalyticsEnabled: true,
        exportReports: true,

        // Templates
        templatesEnabled: true,
        maxTemplates: Infinity,

        // AI Features
        aiEnabled: true,
        embeddingEnabled: true,

        // Advanced
        teamEnabled: true,
        auditLogs: true,
        whiteLabel: true,
        customBranding: true,

        // Support
        supportLevel: 'dedicated'
    }
};

class PlanLimitsService {
    /**
     * Get plan limits for a user
     */
    async getUserLimits(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true }
        });

        if (!user) return PLAN_LIMITS.free;

        const planKey = user.plan?.toLowerCase() || 'free';
        return PLAN_LIMITS[planKey] || PLAN_LIMITS.free;
    }

    /**
     * Check if user can add more devices
     */
    async canAddDevice(userId) {
        const limits = await this.getUserLimits(userId);

        const deviceCount = await prisma.device.count({
            where: { userId }
        });

        if (deviceCount >= limits.maxDevices) {
            return {
                allowed: false,
                reason: `Maximum limit of ${limits.maxDevices} devices for your plan has been reached`,
                current: deviceCount,
                limit: limits.maxDevices
            };
        }

        return { allowed: true, current: deviceCount, limit: limits.maxDevices };
    }

    /**
     * Check if user can add more auto-reply rules
     */
    async canAddAutoReplyRule(userId) {
        const limits = await this.getUserLimits(userId);

        const ruleCount = await prisma.autoReplyRule.count({
            where: { userId }
        });

        if (ruleCount >= limits.maxAutoReplyRules) {
            return {
                allowed: false,
                reason: `Maximum limit of ${limits.maxAutoReplyRules} auto-reply rules for your plan has been reached`,
                current: ruleCount,
                limit: limits.maxAutoReplyRules
            };
        }

        return { allowed: true, current: ruleCount, limit: limits.maxAutoReplyRules };
    }

    /**
     * Check if user can add more contacts
     */
    async canAddContact(userId, count = 1) {
        const limits = await this.getUserLimits(userId);

        const contactCount = await prisma.contact.count({
            where: { userId }
        });

        if (contactCount + count > limits.maxContacts) {
            return {
                allowed: false,
                reason: `Maximum limit of ${limits.maxContacts} contacts for your plan has been reached`,
                current: contactCount,
                limit: limits.maxContacts
            };
        }

        return { allowed: true, current: contactCount, limit: limits.maxContacts };
    }

    /**
     * Check if user can add more templates
     */
    async canAddTemplate(userId) {
        const limits = await this.getUserLimits(userId);

        const templateCount = await prisma.template.count({
            where: { userId }
        });

        if (templateCount >= limits.maxTemplates) {
            return {
                allowed: false,
                reason: `Maximum limit of ${limits.maxTemplates} templates for your plan has been reached`,
                current: templateCount,
                limit: limits.maxTemplates
            };
        }

        return { allowed: true, current: templateCount, limit: limits.maxTemplates };
    }

    /**
     * Check if user can add more knowledge bases
     */
    async canAddKnowledgeBase(userId) {
        const limits = await this.getUserLimits(userId);

        if (!limits.ragEnabled) {
            return {
                allowed: false,
                reason: 'Smart Knowledge is not available in your plan. Please upgrade to Pro or higher.'
            };
        }

        const kbCount = await prisma.knowledgeBase.count({
            where: { userId }
        });

        if (kbCount >= limits.maxKnowledgeBases) {
            return {
                allowed: false,
                reason: `Maximum limit of ${limits.maxKnowledgeBases} knowledge bases for your plan has been reached`,
                current: kbCount,
                limit: limits.maxKnowledgeBases
            };
        }

        return { allowed: true, current: kbCount, limit: limits.maxKnowledgeBases };
    }

    /**
     * Check if user can add more chatbots
     */
    async canAddChatbot(userId) {
        const limits = await this.getUserLimits(userId);

        if (!limits.chatbotEnabled) {
            return {
                allowed: false,
                reason: 'Chatbot Builder is not available in your plan.'
            };
        }

        const chatbotCount = await prisma.chatbot.count({
            where: { userId }
        });

        if (chatbotCount >= limits.maxChatbots) {
            return {
                allowed: false,
                reason: `Maximum limit of ${limits.maxChatbots} chatbots for your plan has been reached`,
                current: chatbotCount,
                limit: limits.maxChatbots
            };
        }

        return { allowed: true, current: chatbotCount, limit: limits.maxChatbots };
    }

    /**
     * Check if file size is within limit
     */
    async checkFileSize(userId, fileSizeBytes) {
        const limits = await this.getUserLimits(userId);

        if (fileSizeBytes > limits.maxFileSize) {
            const maxMB = Math.round(limits.maxFileSize / (1024 * 1024));
            const fileMB = Math.round(fileSizeBytes / (1024 * 1024));
            return {
                allowed: false,
                reason: `File too large (${fileMB}MB). Maximum ${maxMB}MB for your plan.`
            };
        }

        return { allowed: true };
    }

    /**
     * Check if feature is enabled for user's plan
     */
    async isFeatureEnabled(userId, featureName) {
        const limits = await this.getUserLimits(userId);
        return limits[featureName] === true || limits[featureName] > 0;
    }

    /**
     * Get all limits for a user (for UI display)
     */
    async getAllLimits(userId) {
        const limits = await this.getUserLimits(userId);

        // Get current usage
        const [deviceCount, ruleCount, contactCount, templateCount, kbCount, chatbotCount] = await Promise.all([
            prisma.device.count({ where: { userId } }),
            prisma.autoReplyRule.count({ where: { userId } }),
            prisma.contact.count({ where: { userId } }),
            prisma.template.count({ where: { userId } }),
            prisma.knowledgeBase.count({ where: { userId } }),
            prisma.chatbot.count({ where: { userId } })
        ]);

        return {
            devices: { current: deviceCount, limit: limits.maxDevices },
            autoReplyRules: { current: ruleCount, limit: limits.maxAutoReplyRules },
            contacts: { current: contactCount, limit: limits.maxContacts },
            templates: { current: templateCount, limit: limits.maxTemplates },
            knowledgeBases: { current: kbCount, limit: limits.maxKnowledgeBases },
            chatbots: { current: chatbotCount, limit: limits.maxChatbots },
            features: {
                ragEnabled: limits.ragEnabled,
                scheduledBroadcast: limits.scheduledBroadcast,
                regexMatching: limits.regexMatching,
                mediaResponse: limits.mediaResponse,
                exportReports: limits.exportReports,
                teamEnabled: limits.teamEnabled || false,
                whiteLabel: limits.whiteLabel || false
            }
        };
    }
}

// Export both the service and the raw limits
module.exports = {
    planLimitsService: new PlanLimitsService(),
    PLAN_LIMITS
};
