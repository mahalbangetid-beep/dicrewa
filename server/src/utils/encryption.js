/**
 * Encryption Service
 * Handles encryption/decryption of sensitive data (API keys, secrets)
 * Uses AES-256-GCM for authenticated encryption
 */

const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Marker to identify encrypted values
const ENCRYPTED_PREFIX = 'enc:';

class EncryptionService {
    constructor() {
        this.encryptionKey = null;
        this.isConfigured = false;
        this.init();
    }

    /**
     * Initialize encryption with key from environment
     */
    init() {
        const key = process.env.ENCRYPTION_KEY;

        if (!key) {
            console.log('[Encryption] ENCRYPTION_KEY not set. Encryption disabled.');
            console.log('[Encryption] Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
            return;
        }

        if (key.length !== 64) {
            console.error('[Encryption] ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
            return;
        }

        try {
            this.encryptionKey = Buffer.from(key, 'hex');
            this.isConfigured = true;
            console.log('[Encryption] Encryption service configured successfully');
        } catch (error) {
            console.error('[Encryption] Invalid ENCRYPTION_KEY format:', error.message);
        }
    }

    /**
     * Check if encryption is available
     */
    isAvailable() {
        return this.isConfigured && this.encryptionKey !== null;
    }

    /**
     * Encrypt a string value
     * Returns: enc:<iv>:<authTag>:<encryptedData> (base64 encoded)
     */
    encrypt(plaintext) {
        if (!plaintext) return null;

        // If encryption is not configured, return plaintext (backward compatibility)
        if (!this.isAvailable()) {
            console.log('[Encryption] Encryption not configured, storing as plaintext');
            return plaintext;
        }

        // If already encrypted, return as-is
        if (this.isEncrypted(plaintext)) {
            return plaintext;
        }

        try {
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);

            let encrypted = cipher.update(plaintext, 'utf8', 'base64');
            encrypted += cipher.final('base64');

            const authTag = cipher.getAuthTag();

            // Format: enc:<iv_base64>:<authTag_base64>:<encrypted_base64>
            const result = `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;

            return result;
        } catch (error) {
            console.error('[Encryption] Encryption failed:', error.message);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt an encrypted string value
     */
    decrypt(encryptedValue) {
        if (!encryptedValue) return null;

        // If not encrypted (legacy data), return as-is
        if (!this.isEncrypted(encryptedValue)) {
            return encryptedValue;
        }

        // If encryption is not configured but data is encrypted, error
        if (!this.isAvailable()) {
            console.error('[Encryption] Cannot decrypt: ENCRYPTION_KEY not configured');
            throw new Error('Encryption key not configured. Cannot decrypt sensitive data.');
        }

        try {
            // Remove prefix and split parts
            const parts = encryptedValue.slice(ENCRYPTED_PREFIX.length).split(':');

            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }

            const [ivBase64, authTagBase64, encryptedBase64] = parts;

            const iv = Buffer.from(ivBase64, 'base64');
            const authTag = Buffer.from(authTagBase64, 'base64');
            const encrypted = Buffer.from(encryptedBase64, 'base64');

            const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted, undefined, 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.error('[Encryption] Decryption failed:', error.message);
            throw new Error('Failed to decrypt data. Key may have changed.');
        }
    }

    /**
     * Check if a value is encrypted
     */
    isEncrypted(value) {
        return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
    }

    /**
     * Safely decrypt, returning null on error (for optional fields)
     */
    safeDecrypt(encryptedValue) {
        try {
            return this.decrypt(encryptedValue);
        } catch (error) {
            console.error('[Encryption] Safe decrypt failed:', error.message);
            return null;
        }
    }

    /**
     * Get masked version of a value (for display)
     * Works with both encrypted and plaintext values
     */
    getMaskedValue(value, prefix = '...', showLast = 4) {
        if (!value) return null;

        try {
            const decrypted = this.isEncrypted(value) ? this.safeDecrypt(value) : value;
            if (!decrypted || decrypted.length < showLast + 3) {
                return '****';
            }
            return `${prefix}${decrypted.slice(-showLast)}`;
        } catch {
            return '****';
        }
    }
}

// Export singleton instance
module.exports = new EncryptionService();
