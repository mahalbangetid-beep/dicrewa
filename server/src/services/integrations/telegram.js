const axios = require('axios');

/**
 * Telegram Integration Handler
 * Send notifications via Telegram Bot
 */
class TelegramHandler {
    constructor() {
        this.baseUrl = 'https://api.telegram.org/bot';
    }

    /**
     * Test connection by getting bot info
     */
    async testConnection(config) {
        try {
            const { botToken, chatId } = config;

            if (!botToken) {
                return { success: false, message: 'Bot Token is required' };
            }

            if (!chatId) {
                return { success: false, message: 'Chat ID is required' };
            }

            // Get bot info
            const response = await axios.get(`${this.baseUrl}${botToken}/getMe`, {
                timeout: 10000
            });

            if (response.data?.ok) {
                const botName = response.data.result.username;

                // Try sending a test message
                await this.sendMessage(botToken, chatId, '✅ KeepWhatsApp connected successfully!');

                return {
                    success: true,
                    message: `Connected to bot @${botName}. Test message sent!`,
                    botName
                };
            }

            return { success: false, message: 'Invalid bot token' };
        } catch (error) {
            if (error.response?.data?.description) {
                return { success: false, message: error.response.data.description };
            }
            return { success: false, message: error.message };
        }
    }

    /**
     * Handle events and send notifications
     */
    async handleEvent(eventName, data, config) {
        const { botToken, chatId, formatTemplate, includeMedia, keywords } = config;

        // Check keyword filter for message events
        if (eventName === 'message.received' && keywords && keywords.length > 0) {
            const messageText = data.message?.toLowerCase() || '';
            const hasKeyword = keywords.some(kw => messageText.includes(kw.toLowerCase()));
            if (!hasKeyword) return; // Skip if no keyword match
        }

        // Format message
        const message = this.formatMessage(eventName, data, formatTemplate);

        // Send message
        await this.sendMessage(botToken, chatId, message, 'Markdown');

        // Send media if applicable
        if (includeMedia && data.mediaUrl) {
            await this.sendMedia(botToken, chatId, data.mediaUrl, data.mediaType);
        }
    }

    /**
     * Send text message to Telegram
     */
    async sendMessage(botToken, chatId, text, parseMode = 'Markdown') {
        try {
            await axios.post(`${this.baseUrl}${botToken}/sendMessage`, {
                chat_id: chatId,
                text,
                parse_mode: parseMode,
                disable_web_page_preview: true
            }, { timeout: 10000 });
        } catch (error) {
            console.error('[Telegram] Failed to send message:', error.message);
            throw error;
        }
    }

    /**
     * Send media to Telegram
     */
    async sendMedia(botToken, chatId, mediaUrl, mediaType = 'document') {
        try {
            const endpoint = mediaType === 'image' ? 'sendPhoto' :
                mediaType === 'video' ? 'sendVideo' :
                    mediaType === 'audio' ? 'sendAudio' : 'sendDocument';

            const fieldName = mediaType === 'image' ? 'photo' :
                mediaType === 'video' ? 'video' :
                    mediaType === 'audio' ? 'audio' : 'document';

            await axios.post(`${this.baseUrl}${botToken}/${endpoint}`, {
                chat_id: chatId,
                [fieldName]: mediaUrl
            }, { timeout: 30000 });
        } catch (error) {
            console.error('[Telegram] Failed to send media:', error.message);
        }
    }

    /**
     * Format message based on event and template
     */
    formatMessage(eventName, data, template) {
        // Default templates for each event type
        const defaultTemplates = {
            'message.received': '📱 *New WhatsApp Message*\n\n👤 *From:* {{from}}\n📝 *Message:* {{message}}\n⏰ {{time}}',
            'message.sent': '✅ *Message Sent*\n\n👤 *To:* {{to}}\n📝 *Message:* {{message}}',
            'message.failed': '❌ *Message Failed*\n\n👤 *To:* {{to}}\n📝 *Error:* {{error}}',
            'device.connected': '🟢 *Device Connected*\n\n📱 *Device:* {{deviceName}}',
            'device.disconnected': '🔴 *Device Disconnected*\n\n📱 *Device:* {{deviceName}}',
            'broadcast.started': '📢 *Broadcast Started*\n\n📋 *Name:* {{name}}\n👥 *Recipients:* {{total}}',
            'broadcast.completed': '✅ *Broadcast Completed*\n\n📋 *Name:* {{name}}\n✅ *Sent:* {{sent}}\n❌ *Failed:* {{failed}}'
        };

        const templateToUse = template || defaultTemplates[eventName] || '🔔 *{{event}}*\n\n{{json}}';

        // Replace placeholders
        let message = templateToUse
            .replace(/\{\{event\}\}/g, eventName)
            .replace(/\{\{from\}\}/g, data.from || data.fromName || 'Unknown')
            .replace(/\{\{to\}\}/g, data.to || data.toName || 'Unknown')
            .replace(/\{\{message\}\}/g, this.escapeMarkdown(data.message || ''))
            .replace(/\{\{error\}\}/g, data.error || 'Unknown error')
            .replace(/\{\{deviceName\}\}/g, data.deviceName || 'Unknown')
            .replace(/\{\{name\}\}/g, data.name || 'Untitled')
            .replace(/\{\{total\}\}/g, data.totalRecipients || 0)
            .replace(/\{\{sent\}\}/g, data.sent || 0)
            .replace(/\{\{failed\}\}/g, data.failed || 0)
            .replace(/\{\{time\}\}/g, new Date().toLocaleString('id-ID'))
            .replace(/\{\{json\}\}/g, JSON.stringify(data, null, 2));

        return message;
    }

    /**
     * Escape markdown special characters
     */
    escapeMarkdown(text) {
        if (!text) return '';
        return text.replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
    }
}

module.exports = new TelegramHandler();
