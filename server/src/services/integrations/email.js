const nodemailer = require('nodemailer');

/**
 * Email (SMTP) Integration Handler
 * Send email notifications via custom SMTP server
 */
class EmailHandler {
    /**
     * Test SMTP connection
     */
    async testConnection(config) {
        try {
            const { host, port, secure, auth, from, to } = config;

            if (!host || !port) {
                return { success: false, message: 'SMTP host and port are required' };
            }

            if (!auth?.user || !auth?.pass) {
                return { success: false, message: 'SMTP authentication is required' };
            }

            if (!from || !to || to.length === 0) {
                return { success: false, message: 'From and To email addresses are required' };
            }

            // Create transporter
            const transporter = nodemailer.createTransport({
                host,
                port: parseInt(port),
                secure: secure === true || port === 465,
                auth: {
                    user: auth.user,
                    pass: auth.pass
                },
                connectionTimeout: 10000
            });

            // Verify connection
            await transporter.verify();

            // Send test email
            const recipients = Array.isArray(to) ? to.join(', ') : to;

            await transporter.sendMail({
                from,
                to: recipients,
                subject: '✅ KeepWhatsApp Connected',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #25D366;">✅ KeepWhatsApp Email Notifications</h2>
                        <p>Your email notifications are now configured successfully!</p>
                        <p style="color: #888; font-size: 12px;">This is a test email from KeepWhatsApp.</p>
                    </div>
                `
            });

            return {
                success: true,
                message: `Connected! Test email sent to ${recipients}`
            };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Handle events and send email notifications
     */
    async handleEvent(eventName, data, config) {
        const { host, port, secure, auth, from, to } = config;

        const transporter = nodemailer.createTransport({
            host,
            port: parseInt(port),
            secure: secure === true || port === 465,
            auth: {
                user: auth.user,
                pass: auth.pass
            }
        });

        const { subject, html } = this.buildEmail(eventName, data);
        const recipients = Array.isArray(to) ? to.join(', ') : to;

        try {
            await transporter.sendMail({
                from,
                to: recipients,
                subject,
                html
            });
        } catch (error) {
            console.error('[Email] Failed to send email:', error.message);
            throw error;
        }
    }

    /**
     * Build email content based on event
     */
    buildEmail(eventName, data) {
        const templates = {
            'message.received': {
                subject: `📱 New WhatsApp Message from ${data.from || 'Unknown'}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #25D366; margin-bottom: 20px;">📱 New WhatsApp Message</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px; background: #f5f5f5; font-weight: bold; width: 120px;">From:</td>
                                <td style="padding: 10px;">${data.from || data.fromName || 'Unknown'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; background: #f5f5f5; font-weight: bold;">Device:</td>
                                <td style="padding: 10px;">${data.deviceName || 'Unknown'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; background: #f5f5f5; font-weight: bold;">Time:</td>
                                <td style="padding: 10px;">${new Date().toLocaleString('id-ID')}</td>
                            </tr>
                        </table>
                        <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-left: 4px solid #25D366;">
                            <strong>Message:</strong><br>
                            ${this.escapeHtml(data.message || 'No content')}
                        </div>
                        <p style="color: #888; font-size: 12px; margin-top: 30px;">Sent by KeepWhatsApp</p>
                    </div>
                `
            },

            'message.failed': {
                subject: `❌ WhatsApp Message Failed to ${data.to || 'Unknown'}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #FF0000; margin-bottom: 20px;">❌ Message Failed</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px; background: #f5f5f5; font-weight: bold; width: 120px;">To:</td>
                                <td style="padding: 10px;">${data.to || 'Unknown'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; background: #f5f5f5; font-weight: bold;">Error:</td>
                                <td style="padding: 10px; color: red;">${data.error || 'Unknown error'}</td>
                            </tr>
                        </table>
                        <p style="color: #888; font-size: 12px; margin-top: 30px;">Sent by KeepWhatsApp</p>
                    </div>
                `
            },

            'device.disconnected': {
                subject: `🔴 WhatsApp Device Disconnected: ${data.deviceName || 'Unknown'}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #FF0000; margin-bottom: 20px;">🔴 Device Disconnected</h2>
                        <p>Your WhatsApp device <strong>${data.deviceName || 'Unknown'}</strong> has been disconnected.</p>
                        <p>Please reconnect your device as soon as possible to continue receiving messages.</p>
                        <p style="color: #888; font-size: 12px; margin-top: 30px;">Sent by KeepWhatsApp</p>
                    </div>
                `
            },

            'broadcast.completed': {
                subject: `✅ WhatsApp Broadcast Completed: ${data.name || 'Untitled'}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #25D366; margin-bottom: 20px;">✅ Broadcast Completed</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px; background: #f5f5f5; font-weight: bold; width: 120px;">Name:</td>
                                <td style="padding: 10px;">${data.name || 'Untitled'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; background: #f5f5f5; font-weight: bold;">Total:</td>
                                <td style="padding: 10px;">${data.totalRecipients || 0}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; background: #f5f5f5; font-weight: bold;">Sent:</td>
                                <td style="padding: 10px; color: green;">${data.sent || 0}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; background: #f5f5f5; font-weight: bold;">Failed:</td>
                                <td style="padding: 10px; color: red;">${data.failed || 0}</td>
                            </tr>
                        </table>
                        <p style="color: #888; font-size: 12px; margin-top: 30px;">Sent by KeepWhatsApp</p>
                    </div>
                `
            }
        };

        const template = templates[eventName];
        if (template) return template;

        // Default template
        return {
            subject: `🔔 KeepWhatsApp: ${eventName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #6366F1; margin-bottom: 20px;">🔔 ${eventName}</h2>
                    <pre style="background: #f5f5f5; padding: 15px; overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>
                    <p style="color: #888; font-size: 12px; margin-top: 30px;">Sent by KeepWhatsApp</p>
                </div>
            `
        };
    }

    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/\n/g, '<br>');
    }
}

module.exports = new EmailHandler();
