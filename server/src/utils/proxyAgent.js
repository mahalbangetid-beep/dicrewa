/**
 * Proxy Agent Factory
 * 
 * Creates proxy agents for WhatsApp connections.
 * Supports SOCKS5 and HTTP/HTTPS proxies.
 */

const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');

/**
 * Check if proxy is enabled
 */
function isProxyEnabled() {
    return process.env.PROXY_ENABLED === 'true';
}

/**
 * Get proxy URL from environment
 */
function getProxyUrl() {
    const { PROXY_TYPE, PROXY_HOST, PROXY_PORT, PROXY_USERNAME, PROXY_PASSWORD } = process.env;

    if (!PROXY_HOST || !PROXY_PORT) {
        return null;
    }

    const auth = PROXY_USERNAME ? `${PROXY_USERNAME}:${PROXY_PASSWORD}@` : '';
    return `${PROXY_TYPE || 'socks5'}://${auth}${PROXY_HOST}:${PROXY_PORT}`;
}

/**
 * Create proxy agent based on configuration
 * @returns {SocksProxyAgent|HttpsProxyAgent|null}
 */
function createProxyAgent() {
    if (!isProxyEnabled()) {
        return null;
    }

    const proxyUrl = getProxyUrl();
    if (!proxyUrl) {
        console.warn('[Proxy] Proxy enabled but configuration incomplete');
        return null;
    }

    const proxyType = process.env.PROXY_TYPE || 'socks5';

    try {
        if (proxyType === 'socks5' || proxyType === 'socks4') {
            console.log(`[Proxy] Using SOCKS proxy: ${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`);
            return new SocksProxyAgent(proxyUrl);
        } else {
            console.log(`[Proxy] Using HTTP/HTTPS proxy: ${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`);
            return new HttpsProxyAgent(proxyUrl);
        }
    } catch (err) {
        console.error('[Proxy] Failed to create proxy agent:', err.message);
        return null;
    }
}

/**
 * Check if media sending should be blocked (when proxy is enabled)
 */
function isMediaBlocked() {
    // We want to allow media sending via direct connection (saving bandwidth), 
    // so we never block it even if proxy is enabled.
    return false;
}

module.exports = {
    createProxyAgent,
    isProxyEnabled,
    isMediaBlocked,
    getProxyUrl
};
