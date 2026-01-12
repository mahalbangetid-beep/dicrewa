const axios = require('axios');
const csv = require('csvtojson');
const prisma = require('../../utils/prisma');

/**
 * Google Sheets Integration Handler
 * Supports bidirectional sync for contacts, messages, auto-replies
 */
class GoogleSheetsHandler {
    /**
     * Test connection to Google Sheets
     */
    async testConnection(config) {
        try {
            const { spreadsheetId, sheetName } = config;

            if (!spreadsheetId) {
                return { success: false, message: 'Spreadsheet ID is required' };
            }

            // Build export URL
            const exportUrl = this.buildExportUrl(spreadsheetId, sheetName);

            const response = await axios.get(exportUrl, { timeout: 10000 });

            if (response.status === 200) {
                // Try to parse CSV
                const rows = await csv().fromString(response.data);
                return {
                    success: true,
                    message: `Connected successfully. Found ${rows.length} rows.`,
                    rowCount: rows.length
                };
            }

            return { success: false, message: 'Unable to fetch spreadsheet' };
        } catch (error) {
            if (error.response?.status === 404) {
                return { success: false, message: 'Spreadsheet not found. Make sure it\'s public or shared.' };
            }
            return { success: false, message: error.message };
        }
    }

    /**
     * Sync data with Google Sheets
     */
    async sync(config, options, userId) {
        const { spreadsheetId, sheetName, syncType, direction, fieldMapping } = config;

        const exportUrl = this.buildExportUrl(spreadsheetId, sheetName);

        try {
            const response = await axios.get(exportUrl, { timeout: 30000 });
            const rows = await csv().fromString(response.data);

            if (rows.length === 0) {
                return { success: true, message: 'No data found in spreadsheet', recordsCount: 0 };
            }

            let result;

            switch (syncType) {
                case 'contacts':
                    result = await this.syncContacts(rows, fieldMapping, direction, userId);
                    break;
                case 'autoreplies':
                    result = await this.syncAutoReplies(rows, fieldMapping, userId);
                    break;
                case 'broadcast':
                    result = await this.prepareBroadcastRecipients(rows, fieldMapping);
                    break;
                default:
                    result = { success: true, recordsCount: rows.length, data: rows };
            }

            return result;
        } catch (error) {
            throw new Error(`Sync failed: ${error.message}`);
        }
    }

    /**
     * Sync contacts from Google Sheets
     */
    async syncContacts(rows, fieldMapping = {}, direction = 'import', userId) {
        if (!userId) {
            throw new Error('userId is required for contact sync');
        }

        const mapping = {
            name: fieldMapping.name || 'name',
            phone: fieldMapping.phone || 'phone',
            email: fieldMapping.email || 'email',
            notes: fieldMapping.notes || 'notes'
        };

        let created = 0;
        let updated = 0;
        let errors = [];

        for (const row of rows) {
            try {
                const phone = this.normalizePhone(row[mapping.phone]);
                if (!phone) continue;

                const name = row[mapping.name] || 'Unknown';
                const email = row[mapping.email] || null;
                const notes = row[mapping.notes] || null;

                // Upsert contact with multi-tenant isolation
                await prisma.contact.upsert({
                    where: {
                        userId_phone: { userId, phone }  // Composite unique constraint
                    },
                    create: { userId, name, phone, email, notes },
                    update: { name, email, notes }
                });

                created++;
            } catch (error) {
                errors.push({ row, error: error.message });
            }
        }

        return {
            success: true,
            recordsCount: created,
            message: `Synced ${created} contacts`,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * Sync auto-reply rules from Google Sheets
     */
    async syncAutoReplies(rows, fieldMapping = {}, userId) {
        // SECURITY: userId is required for multi-tenant isolation
        if (!userId) {
            throw new Error('userId is required for auto-reply sync');
        }

        const mapping = {
            trigger: fieldMapping.trigger || 'keyword',
            response: fieldMapping.response || 'response',
            type: fieldMapping.type || 'type',
            media: fieldMapping.media || 'media'
        };

        let synced = 0;
        let updated = 0;
        let created = 0;

        for (const row of rows) {
            const trigger = row[mapping.trigger];
            const response = row[mapping.response];

            if (!trigger || !response) continue;

            const triggerType = row[mapping.type] || 'contains';
            const mediaUrl = row[mapping.media] || null;

            // FIXED: Filter by userId to prevent cross-tenant data access
            const existing = await prisma.autoReplyRule.findFirst({
                where: {
                    trigger,
                    userId  // Multi-tenant isolation
                }
            });

            if (existing) {
                // Only update if rule belongs to this user
                await prisma.autoReplyRule.update({
                    where: { id: existing.id },
                    data: { response, triggerType, mediaUrl }
                });
                updated++;
            } else {
                // FIXED: Include userId when creating new rules
                await prisma.autoReplyRule.create({
                    data: {
                        name: `Sheet: ${trigger}`,
                        trigger,
                        triggerType,
                        response,
                        mediaUrl,
                        isActive: true,
                        userId  // Multi-tenant isolation
                    }
                });
                created++;
            }

            synced++;
        }

        return {
            success: true,
            recordsCount: synced,
            message: `Synced ${synced} auto-reply rules (${created} created, ${updated} updated)`
        };
    }

    /**
     * Prepare broadcast recipients from Google Sheets
     */
    async prepareBroadcastRecipients(rows, fieldMapping = {}) {
        const mapping = {
            phone: fieldMapping.phone || 'phone',
            name: fieldMapping.name || 'name'
        };

        const recipients = [];

        for (const row of rows) {
            const phone = this.normalizePhone(row[mapping.phone]);
            if (!phone) continue;

            recipients.push({
                phone,
                name: row[mapping.name] || null
            });
        }

        return {
            success: true,
            recordsCount: recipients.length,
            message: `Prepared ${recipients.length} recipients`,
            data: recipients
        };
    }

    /**
     * Build Google Sheets export URL
     * Note: Google Sheets uses numeric gid for sheet selection, not sheet name
     */
    buildExportUrl(spreadsheetId, sheetName = null) {
        // Handle full URL or just ID
        let id = spreadsheetId;
        if (spreadsheetId.includes('docs.google.com')) {
            const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (match) id = match[1];
        }

        let url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;

        if (sheetName) {
            // Google Sheets requires numeric gid, not sheet name
            // If sheetName is numeric, use as gid; otherwise default to first sheet (gid=0)
            const gid = /^\d+$/.test(String(sheetName)) ? sheetName : '0';
            url += `&gid=${gid}`;

            if (!/^\d+$/.test(String(sheetName))) {
                console.warn(`[GoogleSheets] sheetName "${sheetName}" is not a numeric gid, using first sheet (gid=0)`);
            }
        }

        return url;
    }

    /**
     * Normalize phone number
     */
    normalizePhone(phone) {
        if (!phone) return null;

        // Get country code from environment or default to 62 (Indonesia)
        const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || '62';

        // Remove all non-digits
        let cleaned = String(phone).replace(/\D/g, '');

        // Handle local numbers starting with 0
        if (cleaned.startsWith('0')) {
            cleaned = defaultCountryCode + cleaned.substring(1);
        } else if (!cleaned.startsWith(defaultCountryCode) && cleaned.length <= 12) {
            // Assume local number if short and doesn't start with country code
            cleaned = defaultCountryCode + cleaned;
        }

        return cleaned.length >= 10 ? cleaned : null;
    }

    /**
     * Handle events (not applicable for sheets, but required by interface)
     */
    async handleEvent(eventName, data, config) {
        // Google Sheets doesn't handle events in real-time
        // This would require Apps Script for push updates
        console.log(`[GoogleSheets] Event ${eventName} received but not handled for sheets`);
    }
}

module.exports = new GoogleSheetsHandler();
