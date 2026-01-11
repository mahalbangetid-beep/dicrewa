/**
 * Branding Service
 * Handle white-label and custom branding features
 * Only available for Unlimited plan
 */

const prisma = require('../utils/prisma');
const { planLimitsService } = require('./planLimitsService');

class BrandingService {
    /**
     * Check if user has access to branding features
     */
    async checkAccess(userId) {
        const limits = await planLimitsService.getUserLimits(userId);

        if (!limits.whiteLabel && !limits.customBranding) {
            return {
                allowed: false,
                reason: 'White-label dan Custom Branding hanya tersedia di plan Unlimited. Silakan upgrade untuk mengakses fitur ini.'
            };
        }

        return { allowed: true };
    }

    /**
     * Get branding settings for a user
     */
    async getBranding(userId) {
        const branding = await prisma.branding.findUnique({
            where: { userId }
        });

        // Return defaults if no custom branding
        if (!branding) {
            return {
                appName: 'WA Gateway',
                logoUrl: null,
                faviconUrl: null,
                primaryColor: '#22c55e',
                secondaryColor: '#16a34a',
                accentColor: '#4ade80',
                footerText: null,
                showPoweredBy: true,
                customDomain: null,
                isDefault: true
            };
        }

        return {
            ...branding,
            isDefault: false
        };
    }

    /**
     * Get branding for public display (API widget, etc)
     */
    async getPublicBranding(userId) {
        const branding = await this.getBranding(userId);

        // Only return non-sensitive branding info
        return {
            appName: branding.appName || 'WA Gateway',
            logoUrl: branding.logoUrl,
            primaryColor: branding.primaryColor || '#22c55e',
            footerText: branding.footerText,
            showPoweredBy: branding.showPoweredBy
        };
    }

    /**
     * Update branding settings
     */
    async updateBranding(userId, data) {
        // Check access
        const access = await this.checkAccess(userId);
        if (!access.allowed) {
            throw new Error(access.reason);
        }

        const {
            appName,
            logoUrl,
            faviconUrl,
            primaryColor,
            secondaryColor,
            accentColor,
            footerText,
            showPoweredBy,
            customDomain
        } = data;

        // Validate colors if provided
        const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

        if (primaryColor && !colorRegex.test(primaryColor)) {
            throw new Error('Invalid primary color format. Use hex color (e.g., #22c55e)');
        }
        if (secondaryColor && !colorRegex.test(secondaryColor)) {
            throw new Error('Invalid secondary color format. Use hex color (e.g., #16a34a)');
        }
        if (accentColor && !colorRegex.test(accentColor)) {
            throw new Error('Invalid accent color format. Use hex color (e.g., #4ade80)');
        }

        // Upsert branding
        const branding = await prisma.branding.upsert({
            where: { userId },
            update: {
                appName,
                logoUrl,
                faviconUrl,
                primaryColor,
                secondaryColor,
                accentColor,
                footerText,
                showPoweredBy: showPoweredBy !== undefined ? showPoweredBy : true,
                customDomain
            },
            create: {
                userId,
                appName,
                logoUrl,
                faviconUrl,
                primaryColor,
                secondaryColor,
                accentColor,
                footerText,
                showPoweredBy: showPoweredBy !== undefined ? showPoweredBy : true,
                customDomain
            }
        });

        return branding;
    }

    /**
     * Reset branding to defaults
     */
    async resetBranding(userId) {
        // Check access
        const access = await this.checkAccess(userId);
        if (!access.allowed) {
            throw new Error(access.reason);
        }

        // Delete branding record
        await prisma.branding.delete({
            where: { userId }
        }).catch(() => {
            // Ignore if doesn't exist
        });

        return {
            success: true,
            message: 'Branding settings reset to defaults'
        };
    }

    /**
     * Upload logo (placeholder - actual upload handled by file upload endpoint)
     */
    async setLogo(userId, logoUrl) {
        const access = await this.checkAccess(userId);
        if (!access.allowed) {
            throw new Error(access.reason);
        }

        return this.updateBranding(userId, { logoUrl });
    }

    /**
     * Toggle "Powered by" visibility
     */
    async togglePoweredBy(userId, show) {
        const access = await this.checkAccess(userId);
        if (!access.allowed) {
            throw new Error(access.reason);
        }

        return this.updateBranding(userId, { showPoweredBy: show });
    }
}

module.exports = new BrandingService();
