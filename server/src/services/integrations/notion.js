const axios = require('axios');
const prisma = require('../../utils/prisma');

/**
 * Notion Integration Handler
 * Sync with Notion databases for contacts and leads
 */
class NotionHandler {
    constructor() {
        this.baseUrl = 'https://api.notion.com/v1';
        this.notionVersion = '2022-06-28';
    }

    /**
     * Test connection to Notion
     */
    async testConnection(config) {
        try {
            const { apiKey, databaseId } = config;

            if (!apiKey) {
                return { success: false, message: 'Integration Token is required' };
            }

            if (!databaseId) {
                return { success: false, message: 'Database ID is required' };
            }

            // Test by querying database
            const response = await axios.post(
                `${this.baseUrl}/databases/${databaseId}/query`,
                { page_size: 1 },
                {
                    headers: this.getHeaders(apiKey),
                    timeout: 10000
                }
            );

            if (response.data?.results !== undefined) {
                return {
                    success: true,
                    message: `Connected to Notion database successfully!`
                };
            }

            return { success: false, message: 'Unexpected response from Notion' };
        } catch (error) {
            if (error.response?.status === 401) {
                return { success: false, message: 'Invalid integration token' };
            }
            if (error.response?.status === 404) {
                return { success: false, message: 'Database not found. Make sure it\'s shared with your integration.' };
            }
            return { success: false, message: error.response?.data?.message || error.message };
        }
    }

    /**
     * Sync data with Notion
     */
    async sync(config, options, userId) {
        const { apiKey, databaseId, syncType, fieldMapping } = config;

        switch (syncType) {
            case 'contacts':
                return await this.syncContacts(apiKey, databaseId, fieldMapping);
            default:
                return await this.queryDatabase(apiKey, databaseId);
        }
    }

    /**
     * Sync contacts from Notion
     */
    async syncContacts(apiKey, databaseId, fieldMapping = {}) {
        const mapping = {
            name: fieldMapping.name || 'Name',
            phone: fieldMapping.phone || 'Phone',
            email: fieldMapping.email || 'Email',
            notes: fieldMapping.notes || 'Notes'
        };

        const allPages = await this.queryAllPages(apiKey, databaseId);

        let synced = 0;
        let errors = [];

        for (const page of allPages) {
            try {
                const props = page.properties;
                const phone = this.extractPropertyValue(props[mapping.phone]);

                if (!phone) continue;

                const normalizedPhone = this.normalizePhone(phone);
                if (!normalizedPhone) continue;

                await prisma.contact.upsert({
                    where: { phone: normalizedPhone },
                    create: {
                        name: this.extractPropertyValue(props[mapping.name]) || 'Unknown',
                        phone: normalizedPhone,
                        email: this.extractPropertyValue(props[mapping.email]) || null,
                        notes: this.extractPropertyValue(props[mapping.notes]) || null
                    },
                    update: {
                        name: this.extractPropertyValue(props[mapping.name]) || 'Unknown',
                        email: this.extractPropertyValue(props[mapping.email]) || null,
                        notes: this.extractPropertyValue(props[mapping.notes]) || null
                    }
                });

                synced++;
            } catch (error) {
                errors.push({ pageId: page.id, error: error.message });
            }
        }

        return {
            success: true,
            recordsCount: synced,
            message: `Synced ${synced} contacts from Notion`,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * Query all pages with pagination
     */
    async queryAllPages(apiKey, databaseId) {
        const allPages = [];
        let hasMore = true;
        let startCursor = undefined;

        while (hasMore) {
            const body = { page_size: 100 };
            if (startCursor) body.start_cursor = startCursor;

            const response = await axios.post(
                `${this.baseUrl}/databases/${databaseId}/query`,
                body,
                {
                    headers: this.getHeaders(apiKey),
                    timeout: 30000
                }
            );

            allPages.push(...response.data.results);
            hasMore = response.data.has_more;
            startCursor = response.data.next_cursor;
        }

        return allPages;
    }

    /**
     * Query database (simple)
     */
    async queryDatabase(apiKey, databaseId) {
        const pages = await this.queryAllPages(apiKey, databaseId);

        return {
            success: true,
            recordsCount: pages.length,
            message: `Fetched ${pages.length} pages`,
            data: pages.map(p => this.flattenPageProperties(p.properties))
        };
    }

    /**
     * Create a page in Notion
     */
    async createPage(apiKey, databaseId, properties) {
        const response = await axios.post(
            `${this.baseUrl}/pages`,
            {
                parent: { database_id: databaseId },
                properties
            },
            {
                headers: this.getHeaders(apiKey),
                timeout: 10000
            }
        );

        return response.data;
    }

    /**
     * Handle events (for automation triggers)
     */
    async handleEvent(eventName, data, config) {
        console.log(`[Notion] Event ${eventName} received`);

        // Create page on new message if configured
        if (eventName === 'message.received' && config.createPageOnNewContact) {
            const { apiKey, databaseId, fieldMapping } = config;

            try {
                // Check if contact already exists
                const phone = this.normalizePhone(data.from);
                const existingContact = await prisma.contact.findUnique({
                    where: { phone }
                });

                if (!existingContact) {
                    // Create new page in Notion
                    const properties = {
                        [fieldMapping?.name || 'Name']: {
                            title: [{ text: { content: data.fromName || data.from } }]
                        },
                        [fieldMapping?.phone || 'Phone']: {
                            phone_number: data.from
                        }
                    };

                    await this.createPage(apiKey, databaseId, properties);
                }
            } catch (error) {
                console.error('[Notion] Failed to create page:', error.message);
            }
        }
    }

    /**
     * Get headers for Notion API
     */
    getHeaders(apiKey) {
        return {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Notion-Version': this.notionVersion
        };
    }

    /**
     * Extract value from Notion property
     */
    extractPropertyValue(property) {
        if (!property) return null;

        switch (property.type) {
            case 'title':
                return property.title?.[0]?.plain_text || null;
            case 'rich_text':
                return property.rich_text?.[0]?.plain_text || null;
            case 'phone_number':
                return property.phone_number || null;
            case 'email':
                return property.email || null;
            case 'number':
                return property.number;
            case 'select':
                return property.select?.name || null;
            case 'multi_select':
                return property.multi_select?.map(s => s.name).join(', ') || null;
            case 'date':
                return property.date?.start || null;
            case 'url':
                return property.url || null;
            case 'checkbox':
                return property.checkbox;
            default:
                return null;
        }
    }

    /**
     * Flatten page properties
     */
    flattenPageProperties(properties) {
        const result = {};
        for (const [key, value] of Object.entries(properties)) {
            result[key] = this.extractPropertyValue(value);
        }
        return result;
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

module.exports = new NotionHandler();
