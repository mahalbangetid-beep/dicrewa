const axios = require('axios');
const prisma = require('../../utils/prisma');

/**
 * Airtable Integration Handler
 * Sync contacts and custom data with Airtable bases
 */
class AirtableHandler {
    constructor() {
        this.baseUrl = 'https://api.airtable.com/v0';
    }

    /**
     * Test connection to Airtable
     */
    async testConnection(config) {
        try {
            const { apiKey, baseId, tableId } = config;

            if (!apiKey) {
                return { success: false, message: 'API Key is required' };
            }

            if (!baseId) {
                return { success: false, message: 'Base ID is required' };
            }

            if (!tableId) {
                return { success: false, message: 'Table ID or Name is required' };
            }

            // Test by fetching first record
            const response = await axios.get(
                `${this.baseUrl}/${baseId}/${tableId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    params: { maxRecords: 1 },
                    timeout: 10000
                }
            );

            if (response.data?.records !== undefined) {
                return {
                    success: true,
                    message: `Connected to Airtable. Table has ${response.data.records.length > 0 ? 'records' : 'no records yet'}.`
                };
            }

            return { success: false, message: 'Unexpected response from Airtable' };
        } catch (error) {
            if (error.response?.status === 401) {
                return { success: false, message: 'Invalid API key' };
            }
            if (error.response?.status === 404) {
                return { success: false, message: 'Base or Table not found' };
            }
            return { success: false, message: error.message };
        }
    }

    /**
     * Sync data with Airtable
     */
    async sync(config, options, userId) {
        const { apiKey, baseId, tableId, syncType, fieldMapping, direction } = config;

        switch (syncType) {
            case 'contacts':
                return await this.syncContacts(apiKey, baseId, tableId, fieldMapping, direction);
            default:
                return await this.fetchRecords(apiKey, baseId, tableId);
        }
    }

    /**
     * Sync contacts with Airtable
     */
    async syncContacts(apiKey, baseId, tableId, fieldMapping = {}, direction = 'import') {
        const mapping = {
            name: fieldMapping.name || 'Name',
            phone: fieldMapping.phone || 'Phone',
            email: fieldMapping.email || 'Email',
            notes: fieldMapping.notes || 'Notes'
        };

        if (direction === 'import' || direction === 'bidirectional') {
            // Import from Airtable
            const records = await this.fetchAllRecords(apiKey, baseId, tableId);

            let created = 0;
            let errors = [];

            for (const record of records) {
                try {
                    const fields = record.fields;
                    const phone = this.normalizePhone(fields[mapping.phone]);

                    if (!phone) continue;

                    await prisma.contact.upsert({
                        where: { phone },
                        create: {
                            name: fields[mapping.name] || 'Unknown',
                            phone,
                            email: fields[mapping.email] || null,
                            notes: fields[mapping.notes] || null
                        },
                        update: {
                            name: fields[mapping.name] || 'Unknown',
                            email: fields[mapping.email] || null,
                            notes: fields[mapping.notes] || null
                        }
                    });

                    created++;
                } catch (error) {
                    errors.push({ record: record.id, error: error.message });
                }
            }

            return {
                success: true,
                recordsCount: created,
                message: `Imported ${created} contacts from Airtable`,
                errors: errors.length > 0 ? errors : undefined
            };
        }

        return { success: true, recordsCount: 0, message: 'Sync direction not supported yet' };
    }

    /**
     * Fetch all records with pagination
     */
    async fetchAllRecords(apiKey, baseId, tableId) {
        const allRecords = [];
        let offset = null;

        do {
            const params = { pageSize: 100 };
            if (offset) params.offset = offset;

            const response = await axios.get(
                `${this.baseUrl}/${baseId}/${tableId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    params,
                    timeout: 30000
                }
            );

            allRecords.push(...response.data.records);
            offset = response.data.offset;

        } while (offset);

        return allRecords;
    }

    /**
     * Fetch records from Airtable (simple fetch)
     */
    async fetchRecords(apiKey, baseId, tableId) {
        const records = await this.fetchAllRecords(apiKey, baseId, tableId);

        return {
            success: true,
            recordsCount: records.length,
            message: `Fetched ${records.length} records`,
            data: records.map(r => r.fields)
        };
    }

    /**
     * Create record in Airtable
     */
    async createRecord(apiKey, baseId, tableId, fields) {
        const response = await axios.post(
            `${this.baseUrl}/${baseId}/${tableId}`,
            { fields },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        return response.data;
    }

    /**
     * Handle events (for automation triggers)
     */
    async handleEvent(eventName, data, config) {
        // Could be used to create records on events
        console.log(`[Airtable] Event ${eventName} received`);

        // Example: Create a contact record when new message received
        if (eventName === 'message.received' && config.createOnNewMessage) {
            const { apiKey, baseId, tableId, fieldMapping } = config;
            const mapping = fieldMapping || { Name: 'name', Phone: 'phone' };

            try {
                await this.createRecord(apiKey, baseId, tableId, {
                    [mapping.Name || 'Name']: data.fromName || data.from,
                    [mapping.Phone || 'Phone']: data.from,
                    [mapping.Message || 'Message']: data.message
                });
            } catch (error) {
                console.error('[Airtable] Failed to create record:', error.message);
            }
        }
    }

    /**
     * Normalize phone number
     */
    normalizePhone(phone) {
        if (!phone) return null;
        let cleaned = String(phone).replace(/\D/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        }
        return cleaned.length >= 10 ? cleaned : null;
    }
}

module.exports = new AirtableHandler();
