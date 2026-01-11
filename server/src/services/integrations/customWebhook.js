const axios = require('axios');

/**
 * Custom Webhook Integration Handler
 * Send events to any HTTP endpoint with custom configuration
 */
class CustomWebhookHandler {
    /**
     * Test webhook connection
     */
    async testConnection(config) {
        try {
            const { url, method, headers } = config;

            if (!url) {
                return { success: false, message: 'Webhook URL is required' };
            }

            // Validate URL
            try {
                new URL(url);
            } catch {
                return { success: false, message: 'Invalid URL format' };
            }

            // Send test request
            const testPayload = {
                event: 'test',
                timestamp: new Date().toISOString(),
                message: 'KeepWhatsApp webhook test'
            };

            const response = await axios({
                method: method || 'POST',
                url,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'KeepWhatsApp/1.0',
                    ...(headers || {})
                },
                data: testPayload,
                timeout: 10000,
                validateStatus: () => true // Accept any status
            });

            if (response.status >= 200 && response.status < 300) {
                return {
                    success: true,
                    message: `Connected! Received status ${response.status}`,
                    statusCode: response.status
                };
            } else {
                return {
                    success: false,
                    message: `Server returned status ${response.status}`,
                    statusCode: response.status
                };
            }
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                return { success: false, message: 'Connection refused. Check if the server is running.' };
            }
            if (error.code === 'ETIMEDOUT') {
                return { success: false, message: 'Connection timed out.' };
            }
            return { success: false, message: error.message };
        }
    }

    /**
     * Handle events and send to webhook
     */
    async handleEvent(eventName, data, config) {
        const { url, method, headers, payloadTemplate } = config;

        // Build payload
        let payload;
        if (payloadTemplate) {
            payload = this.buildPayloadFromTemplate(payloadTemplate, eventName, data);
        } else {
            payload = {
                event: eventName,
                timestamp: new Date().toISOString(),
                data
            };
        }

        try {
            await axios({
                method: method || 'POST',
                url,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'KeepWhatsApp/1.0',
                    ...(headers || {})
                },
                data: payload,
                timeout: 30000
            });
        } catch (error) {
            console.error('[CustomWebhook] Failed to send:', error.message);
            throw error;
        }
    }

    /**
     * Build payload from template
     */
    buildPayloadFromTemplate(template, eventName, data) {
        try {
            // Parse template as JSON string with placeholders
            let jsonString = template;

            // Replace common placeholders
            const replacements = {
                '{{event}}': eventName,
                '{{timestamp}}': new Date().toISOString(),
                '{{from}}': data.from || '',
                '{{to}}': data.to || '',
                '{{message}}': (data.message || '').replace(/"/g, '\\"'),
                '{{phone}}': data.phone || data.from || data.to || '',
                '{{deviceId}}': data.deviceId || '',
                '{{deviceName}}': data.deviceName || '',
                '{{status}}': data.status || '',
                '{{error}}': (data.error || '').replace(/"/g, '\\"')
            };

            for (const [placeholder, value] of Object.entries(replacements)) {
                jsonString = jsonString.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
            }

            return JSON.parse(jsonString);
        } catch (error) {
            console.error('[CustomWebhook] Failed to parse template:', error.message);
            // Fallback to default payload
            return {
                event: eventName,
                timestamp: new Date().toISOString(),
                data
            };
        }
    }
}

module.exports = new CustomWebhookHandler();
