const axios = require('axios');
const csv = require('csvtojson');

class SpreadsheetService {
    /**
     * Validate URL to prevent SSRF attacks
     * @param {string} url - URL to validate
     * @returns {boolean} True if URL is safe to fetch
     */
    isValidExternalUrl(url) {
        try {
            const parsed = new URL(url);

            // 1. Only allow HTTP and HTTPS protocols
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                console.log(`[Spreadsheet] Blocked URL: Invalid protocol ${parsed.protocol}`);
                return false;
            }

            // 2. Block localhost and known internal/metadata hosts
            const blockedHosts = [
                'localhost',
                '127.0.0.1',
                '::1',
                '0.0.0.0',
                '169.254.169.254',           // AWS metadata
                'metadata.google.internal',   // GCP metadata
                'metadata.azure.com',         // Azure metadata
                '100.100.100.200',            // Alibaba Cloud metadata
            ];

            const hostname = parsed.hostname.toLowerCase();
            if (blockedHosts.includes(hostname)) {
                console.log(`[Spreadsheet] Blocked URL: Blocked host ${hostname}`);
                return false;
            }

            // 3. Block private IP ranges (IPv4)
            const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (ipv4Pattern.test(hostname)) {
                const parts = hostname.split('.').map(Number);

                // Validate parts are valid IP octets
                if (parts.some(p => p < 0 || p > 255)) {
                    return false;
                }

                // 10.0.0.0/8 - Private
                if (parts[0] === 10) {
                    console.log(`[Spreadsheet] Blocked URL: Private IP range 10.x.x.x`);
                    return false;
                }

                // 172.16.0.0/12 - Private
                if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
                    console.log(`[Spreadsheet] Blocked URL: Private IP range 172.16-31.x.x`);
                    return false;
                }

                // 192.168.0.0/16 - Private
                if (parts[0] === 192 && parts[1] === 168) {
                    console.log(`[Spreadsheet] Blocked URL: Private IP range 192.168.x.x`);
                    return false;
                }

                // 127.0.0.0/8 - Loopback
                if (parts[0] === 127) {
                    console.log(`[Spreadsheet] Blocked URL: Loopback address`);
                    return false;
                }

                // 169.254.0.0/16 - Link-local
                if (parts[0] === 169 && parts[1] === 254) {
                    console.log(`[Spreadsheet] Blocked URL: Link-local address`);
                    return false;
                }
            }

            // 4. For Google Sheets specifically, only allow docs.google.com
            // This is an extra safety measure
            if (!hostname.endsWith('docs.google.com') &&
                !hostname.endsWith('googleapis.com') &&
                !hostname.endsWith('googleusercontent.com')) {
                // Allow other hosts but log a warning
                console.log(`[Spreadsheet] Warning: Non-Google URL being accessed: ${hostname}`);
            }

            return true;
        } catch (error) {
            console.log(`[Spreadsheet] Blocked URL: Invalid URL format - ${error.message}`);
            return false;
        }
    }

    /**
     * Fetch rules from a public Google Sheet CSV link
     * @param {string} sheetUrl - Link to CSV export of Google Sheet
     * @returns {Promise<Array>} List of rules
     */
    async fetchRules(sheetUrl) {
        try {
            // Ensure we are using the CSV export link if it's a standard sheet link
            let exportUrl = sheetUrl;
            if (sheetUrl.includes('docs.google.com/spreadsheets/d/')) {
                const id = sheetUrl.split('/d/')[1].split('/')[0];
                exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
            }

            // SSRF Protection: Validate URL before making request
            if (!this.isValidExternalUrl(exportUrl)) {
                throw new Error('Invalid or blocked URL. Only public Google Sheets URLs are allowed.');
            }

            console.log(`[Spreadsheet] Fetching rules from: ${exportUrl}`);
            const response = await axios.get(exportUrl, {
                timeout: 10000, // 10 second timeout
                maxRedirects: 2 // Limit redirects
            });

            if (!response.data) {
                throw new Error('Empty response from spreadsheet');
            }

            const jsonArray = await csv().fromString(response.data);

            // Map common column names to our internal format
            return jsonArray.map(row => ({
                trigger: row.keyword || row.trigger || row.Keyword || '',
                response: row.response || row.reply || row.Response || '',
                triggerType: row.type || row.match || 'contains',
                mediaUrl: row.media || row.attachment || null
            })).filter(r => r.trigger && r.response);

        } catch (error) {
            console.error('[Spreadsheet] Error fetching rules:', error.message);
            throw error;
        }
    }
}

module.exports = new SpreadsheetService();
