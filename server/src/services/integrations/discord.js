const axios = require('axios');

/**
 * Discord Integration Handler
 * Send notifications via Discord Webhook
 */
class DiscordHandler {
    /**
     * Test webhook connection
     */
    async testConnection(config) {
        try {
            const { webhookUrl } = config;

            if (!webhookUrl) {
                return { success: false, message: 'Webhook URL is required' };
            }

            // Validate Discord webhook URL format
            if (!webhookUrl.includes('discord.com/api/webhooks/')) {
                return { success: false, message: 'Invalid Discord webhook URL' };
            }

            // Send test message
            const embed = {
                title: '✅ KeepWhatsApp Connected',
                description: 'This Discord channel is now connected to KeepWhatsApp!',
                color: 0x25D366,
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'KeepWhatsApp Notifications'
                }
            };

            await axios.post(webhookUrl, {
                username: config.username || 'KeepWhatsApp',
                avatar_url: config.avatarUrl || null,
                embeds: [embed]
            }, { timeout: 10000 });

            return {
                success: true,
                message: 'Webhook connected! Test message sent to Discord.'
            };
        } catch (error) {
            if (error.response?.status === 404) {
                return { success: false, message: 'Webhook not found. Check the URL.' };
            }
            if (error.response?.status === 401) {
                return { success: false, message: 'Invalid webhook token.' };
            }
            return { success: false, message: error.message };
        }
    }

    /**
     * Handle events and send notifications
     */
    async handleEvent(eventName, data, config) {
        const { webhookUrl, username, avatarUrl, embedColor, mentionRoleId } = config;

        const embed = this.buildEmbed(eventName, data, embedColor);

        let content = null;
        if (mentionRoleId) {
            content = `<@&${mentionRoleId}>`;
        }

        try {
            await axios.post(webhookUrl, {
                username: username || 'KeepWhatsApp',
                avatar_url: avatarUrl || null,
                content,
                embeds: [embed]
            }, { timeout: 10000 });
        } catch (error) {
            console.error('[Discord] Failed to send webhook:', error.message);
            throw error;
        }
    }

    /**
     * Build Discord embed based on event
     */
    buildEmbed(eventName, data, customColor) {
        const colors = {
            'message.received': 0x25D366,    // WhatsApp green
            'message.sent': 0x00FF00,         // Green
            'message.failed': 0xFF0000,       // Red
            'device.connected': 0x00FF00,     // Green
            'device.disconnected': 0xFF0000,  // Red
            'broadcast.started': 0x0099FF,    // Blue
            'broadcast.completed': 0x25D366,  // Green
            'broadcast.failed': 0xFF0000      // Red
        };

        const color = customColor ? parseInt(customColor.replace('#', ''), 16) : (colors[eventName] || 0x6366F1);

        const embedBuilders = {
            'message.received': () => ({
                title: '📱 New WhatsApp Message',
                fields: [
                    { name: '👤 From', value: data.from || data.fromName || 'Unknown', inline: true },
                    { name: '📱 Device', value: data.deviceName || 'Unknown', inline: true },
                    { name: '💬 Message', value: this.truncate(data.message || 'No content', 1024) }
                ],
                color
            }),

            'message.sent': () => ({
                title: '✅ Message Sent',
                fields: [
                    { name: '👤 To', value: data.to || data.toName || 'Unknown', inline: true },
                    { name: '📱 Device', value: data.deviceName || 'Unknown', inline: true },
                    { name: '💬 Message', value: this.truncate(data.message || 'No content', 1024) }
                ],
                color
            }),

            'message.failed': () => ({
                title: '❌ Message Failed',
                fields: [
                    { name: '👤 To', value: data.to || 'Unknown', inline: true },
                    { name: '❌ Error', value: data.error || 'Unknown error', inline: true }
                ],
                color
            }),

            'device.connected': () => ({
                title: '🟢 Device Connected',
                fields: [
                    { name: '📱 Device', value: data.deviceName || 'Unknown', inline: true },
                    { name: '📞 Phone', value: data.phone || 'N/A', inline: true }
                ],
                color
            }),

            'device.disconnected': () => ({
                title: '🔴 Device Disconnected',
                fields: [
                    { name: '📱 Device', value: data.deviceName || 'Unknown', inline: true }
                ],
                color
            }),

            'broadcast.started': () => ({
                title: '📢 Broadcast Started',
                fields: [
                    { name: '📋 Name', value: data.name || 'Untitled', inline: true },
                    { name: '👥 Recipients', value: String(data.totalRecipients || 0), inline: true }
                ],
                color
            }),

            'broadcast.completed': () => ({
                title: '✅ Broadcast Completed',
                fields: [
                    { name: '📋 Name', value: data.name || 'Untitled', inline: true },
                    { name: '✅ Sent', value: String(data.sent || 0), inline: true },
                    { name: '❌ Failed', value: String(data.failed || 0), inline: true }
                ],
                color
            })
        };

        const builder = embedBuilders[eventName];
        const embed = builder ? builder() : {
            title: `🔔 ${eventName}`,
            description: '```json\n' + JSON.stringify(data, null, 2).substring(0, 2000) + '\n```',
            color
        };

        embed.timestamp = new Date().toISOString();
        embed.footer = { text: 'KeepWhatsApp Notifications' };

        return embed;
    }

    /**
     * Truncate text to max length
     */
    truncate(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
}

module.exports = new DiscordHandler();
