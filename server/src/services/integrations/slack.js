const axios = require('axios');

/**
 * Slack Integration Handler
 * Send notifications via Slack Webhook
 */
class SlackHandler {
    /**
     * Test webhook connection
     */
    async testConnection(config) {
        try {
            const { webhookUrl } = config;

            if (!webhookUrl) {
                return { success: false, message: 'Webhook URL is required' };
            }

            // Validate Slack webhook URL format
            if (!webhookUrl.includes('hooks.slack.com')) {
                return { success: false, message: 'Invalid Slack webhook URL' };
            }

            // Send test message
            await axios.post(webhookUrl, {
                text: '✅ KeepWhatsApp connected successfully!',
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: '*✅ KeepWhatsApp Connected*\nThis Slack channel is now connected to receive WhatsApp notifications.'
                        }
                    }
                ]
            }, { timeout: 10000 });

            return {
                success: true,
                message: 'Webhook connected! Test message sent to Slack.'
            };
        } catch (error) {
            if (error.response?.status === 404) {
                return { success: false, message: 'Webhook not found. Check the URL.' };
            }
            return { success: false, message: error.message };
        }
    }

    /**
     * Handle events and send notifications
     */
    async handleEvent(eventName, data, config) {
        const { webhookUrl, channel, username, iconEmoji } = config;

        const blocks = this.buildBlocks(eventName, data);
        const text = this.buildFallbackText(eventName, data);

        try {
            await axios.post(webhookUrl, {
                channel: channel || undefined,
                username: username || 'KeepWhatsApp',
                icon_emoji: iconEmoji || ':whatsapp:',
                text,
                blocks
            }, { timeout: 10000 });
        } catch (error) {
            console.error('[Slack] Failed to send webhook:', error.message);
            throw error;
        }
    }

    /**
     * Build Slack blocks for rich formatting
     */
    buildBlocks(eventName, data) {
        const blockBuilders = {
            'message.received': () => [
                {
                    type: 'header',
                    text: { type: 'plain_text', text: '📱 New WhatsApp Message', emoji: true }
                },
                {
                    type: 'section',
                    fields: [
                        { type: 'mrkdwn', text: `*From:*\n${data.from || data.fromName || 'Unknown'}` },
                        { type: 'mrkdwn', text: `*Device:*\n${data.deviceName || 'Unknown'}` }
                    ]
                },
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `*Message:*\n${this.truncate(data.message || 'No content', 2000)}` }
                },
                { type: 'divider' }
            ],

            'message.sent': () => [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `✅ *Message Sent* to ${data.to || 'Unknown'}` }
                }
            ],

            'message.failed': () => [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `❌ *Message Failed* to ${data.to || 'Unknown'}\nError: ${data.error || 'Unknown'}` }
                }
            ],

            'device.connected': () => [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `🟢 *Device Connected:* ${data.deviceName || 'Unknown'}` }
                }
            ],

            'device.disconnected': () => [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `🔴 *Device Disconnected:* ${data.deviceName || 'Unknown'}` }
                }
            ],

            'broadcast.started': () => [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `📢 *Broadcast Started:* ${data.name || 'Untitled'}\nRecipients: ${data.totalRecipients || 0}` }
                }
            ],

            'broadcast.completed': () => [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `✅ *Broadcast Completed:* ${data.name || 'Untitled'}\n✓ Sent: ${data.sent || 0} | ✗ Failed: ${data.failed || 0}` }
                }
            ]
        };

        const builder = blockBuilders[eventName];
        return builder ? builder() : [
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `*🔔 ${eventName}*\n\`\`\`${JSON.stringify(data, null, 2).substring(0, 2000)}\`\`\`` }
            }
        ];
    }

    /**
     * Build fallback text for notifications
     */
    buildFallbackText(eventName, data) {
        const texts = {
            'message.received': `📱 New message from ${data.from || 'Unknown'}: ${data.message || ''}`.substring(0, 200),
            'message.sent': `✅ Message sent to ${data.to || 'Unknown'}`,
            'message.failed': `❌ Message failed to ${data.to || 'Unknown'}`,
            'device.connected': `🟢 Device connected: ${data.deviceName || 'Unknown'}`,
            'device.disconnected': `🔴 Device disconnected: ${data.deviceName || 'Unknown'}`,
            'broadcast.started': `📢 Broadcast started: ${data.name || 'Untitled'}`,
            'broadcast.completed': `✅ Broadcast completed: ${data.name || 'Untitled'}`
        };

        return texts[eventName] || `🔔 ${eventName}`;
    }

    /**
     * Truncate text
     */
    truncate(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
}

module.exports = new SlackHandler();
