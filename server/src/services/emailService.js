/**
 * Email Service
 * Handles email sending for password reset and notifications
 */

const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
        this.initTransporter();
    }

    /**
     * Initialize email transporter from environment variables
     */
    initTransporter() {
        const host = process.env.SMTP_HOST;
        const port = parseInt(process.env.SMTP_PORT) || 587;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (!host || !user || !pass) {
            console.log('[Email] SMTP not configured. Email features disabled.');
            console.log('[Email] Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to enable.');
            return;
        }

        try {
            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass }
            });

            this.isConfigured = true;
            console.log('[Email] SMTP configured successfully');
        } catch (error) {
            console.error('[Email] Failed to configure SMTP:', error.message);
        }
    }

    /**
     * Check if email service is available
     */
    isAvailable() {
        return this.isConfigured && this.transporter !== null;
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(email, resetToken, userName = 'User') {
        if (!this.isAvailable()) {
            console.log('[Email] Service not available. Skipping email send.');
            // Return the token for development/testing purposes
            return {
                success: false,
                reason: 'Email service not configured',
                devToken: resetToken // Remove in production
            };
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
        const appName = process.env.APP_NAME || 'KeWhats';

        const mailOptions = {
            from: `"${appName}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Reset Your ${appName} Password`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Password Reset</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .button { display: inline-block; background: #25D366; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                        .button:hover { background: #128C7E; }
                        .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
                        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${appName}</h1>
                            <p>Password Reset Request</p>
                        </div>
                        <div class="content">
                            <p>Hi <strong>${userName}</strong>,</p>
                            <p>We received a request to reset your password. Click the button below to create a new password:</p>
                            
                            <div style="text-align: center;">
                                <a href="${resetLink}" class="button">Reset My Password</a>
                            </div>
                            
                            <p>Or copy and paste this link into your browser:</p>
                            <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px; font-size: 12px;">
                                ${resetLink}
                            </p>
                            
                            <div class="warning">
                                <strong>⚠️ Important:</strong>
                                <ul>
                                    <li>This link will expire in <strong>1 hour</strong></li>
                                    <li>If you didn't request this, please ignore this email</li>
                                    <li>Your password won't change until you create a new one</li>
                                </ul>
                            </div>
                        </div>
                        <div class="footer">
                            <p>This email was sent by ${appName}. Please do not reply to this email.</p>
                            <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
Hi ${userName},

We received a request to reset your password for your ${appName} account.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request this password reset, please ignore this email. Your password won't change until you create a new one.

Thanks,
The ${appName} Team
            `
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('[Email] Password reset email sent:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('[Email] Failed to send password reset email:', error.message);
            return { success: false, reason: error.message };
        }
    }

    /**
     * Verify SMTP connection
     */
    async verifyConnection() {
        if (!this.isAvailable()) {
            return { success: false, reason: 'Email service not configured' };
        }

        try {
            await this.transporter.verify();
            return { success: true };
        } catch (error) {
            return { success: false, reason: error.message };
        }
    }
}

module.exports = new EmailService();
