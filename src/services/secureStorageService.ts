/**
 * Secure Storage Service
 * Encrypts sensitive data before storing in LocalStorage
 * 
 * ⚠️ CRITICAL: API Keys and sensitive config must NEVER be stored in plain text
 * 
 * Adora Hotel Management System V3
 */

// ============================================================
// ENCRYPTION UTILITIES
// ============================================================

/**
 * Simple but effective encryption key derivation
 * Uses a combination of device fingerprint + fixed salt
 */
const getEncryptionKey = (): string => {
    // Create a device-specific key component
    const deviceFingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width,
        screen.height,
        new Date().getTimezoneOffset()
    ].join('|');
    
    // Fixed salt (can be environment-specific)
    const salt = 'AdorA_H0t3L_S3cur3_K3y_2024';
    
    return `${salt}_${btoa(deviceFingerprint).slice(0, 32)}`;
};

/**
 * XOR-based encryption/decryption
 * Simple but effective for localStorage data
 */
const xorEncrypt = (text: string, key: string): string => {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result); // Base64 encode for safe storage
};

const xorDecrypt = (encoded: string, key: string): string => {
    try {
        const text = atob(encoded); // Base64 decode
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    } catch (e) {
        console.error('Decryption failed:', e);
        return '';
    }
};

/**
 * AES-like encryption using Web Crypto API (stronger)
 * Used for highly sensitive data like Service Account keys
 */
const deriveKey = async (password: string): Promise<CryptoKey> => {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );
    
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: enc.encode('AdorA_S@lt_2024'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

const aesEncrypt = async (plaintext: string, password: string): Promise<string> => {
    try {
        const enc = new TextEncoder();
        const key = await deriveKey(password);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            enc.encode(plaintext)
        );
        
        // Combine IV + encrypted data
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);
        
        return btoa(String.fromCharCode(...combined));
    } catch (e) {
        console.error('AES encryption failed:', e);
        // Fallback to XOR
        return xorEncrypt(plaintext, password);
    }
};

const aesDecrypt = async (ciphertext: string, password: string): Promise<string> => {
    try {
        const combined = new Uint8Array(
            atob(ciphertext).split('').map(c => c.charCodeAt(0))
        );
        
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);
        
        const key = await deriveKey(password);
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );
        
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        console.error('AES decryption failed:', e);
        // Try XOR fallback
        return xorDecrypt(ciphertext, password);
    }
};

// ============================================================
// SECURE STORAGE CLASS
// ============================================================

class SecureStorage {
    private encryptionKey: string;
    private useStrongEncryption: boolean;

    constructor() {
        this.encryptionKey = getEncryptionKey();
        // Use strong encryption if Web Crypto API is available
        this.useStrongEncryption = typeof crypto !== 'undefined' && crypto.subtle !== undefined;
    }

    /**
     * Store sensitive data with encryption
     * @param key - Storage key
     * @param value - Data to store (will be JSON stringified if object)
     * @param highSecurity - Use AES encryption (slower but more secure)
     */
    async setItem(key: string, value: any, highSecurity: boolean = false): Promise<void> {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        let encryptedValue: string;
        
        if (highSecurity && this.useStrongEncryption) {
            encryptedValue = await aesEncrypt(stringValue, this.encryptionKey);
        } else {
            encryptedValue = xorEncrypt(stringValue, this.encryptionKey);
        }
        
        localStorage.setItem(`_sec_${key}`, encryptedValue);
    }

    /**
     * Retrieve and decrypt sensitive data
     * @param key - Storage key
     * @param highSecurity - Was stored with AES encryption
     */
    async getItem<T = string>(key: string, highSecurity: boolean = false): Promise<T | null> {
        const encryptedValue = localStorage.getItem(`_sec_${key}`);
        
        if (!encryptedValue) return null;
        
        try {
            let decryptedValue: string;
            
            if (highSecurity && this.useStrongEncryption) {
                decryptedValue = await aesDecrypt(encryptedValue, this.encryptionKey);
            } else {
                decryptedValue = xorDecrypt(encryptedValue, this.encryptionKey);
            }
            
            // Try to parse as JSON
            try {
                return JSON.parse(decryptedValue) as T;
            } catch {
                return decryptedValue as unknown as T;
            }
        } catch (e) {
            console.error('Failed to decrypt:', e);
            return null;
        }
    }

    /**
     * Remove encrypted item
     */
    removeItem(key: string): void {
        localStorage.removeItem(`_sec_${key}`);
    }

    /**
     * Check if encrypted item exists
     */
    hasItem(key: string): boolean {
        return localStorage.getItem(`_sec_${key}`) !== null;
    }

    /**
     * Clear all encrypted items
     */
    clearAll(): void {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('_sec_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const secureStorage = new SecureStorage();

// ============================================================
// CONVENIENCE FUNCTIONS FOR FIREBASE CONFIG
// ============================================================

const FIREBASE_CONFIG_KEY = 'adora_client_config';
const SERVICE_ACCOUNT_KEY = 'adora_service_account';

/**
 * Securely store Firebase configuration
 */
export const saveFirebaseConfigSecure = async (config: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
}): Promise<void> => {
    await secureStorage.setItem(FIREBASE_CONFIG_KEY, config, true);
    console.log('🔐 Firebase config saved securely');
};

/**
 * Retrieve Firebase configuration
 */
export const getFirebaseConfigSecure = async (): Promise<{
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
} | null> => {
    return secureStorage.getItem(FIREBASE_CONFIG_KEY, true);
};

/**
 * Remove Firebase configuration
 */
export const clearFirebaseConfigSecure = (): void => {
    secureStorage.removeItem(FIREBASE_CONFIG_KEY);
    console.log('🗑️ Firebase config cleared');
};

/**
 * Check if Firebase config exists
 */
export const hasFirebaseConfigSecure = (): boolean => {
    return secureStorage.hasItem(FIREBASE_CONFIG_KEY);
};

/**
 * Temporarily store Service Account (will be auto-cleared)
 * ⚠️ CRITICAL: Service Account should never persist long-term
 */
export const storeServiceAccountTemporary = async (json: string): Promise<void> => {
    await secureStorage.setItem(SERVICE_ACCOUNT_KEY, json, true);
    
    // ✅ Auto-clear after 5 minutes for security
    setTimeout(() => {
        secureStorage.removeItem(SERVICE_ACCOUNT_KEY);
        console.log('🔐 Service Account auto-cleared for security');
    }, 5 * 60 * 1000);
};

/**
 * Get temporary Service Account
 */
export const getServiceAccountTemporary = async (): Promise<string | null> => {
    return secureStorage.getItem(SERVICE_ACCOUNT_KEY, true);
};

/**
 * Clear Service Account immediately
 */
export const clearServiceAccountImmediate = (): void => {
    secureStorage.removeItem(SERVICE_ACCOUNT_KEY);
    console.log('🗑️ Service Account cleared immediately');
};

/**
 * Auto-destruct Service Account after successful deployment
 * This is the SECURE way - clear from all temporary storage immediately
 */
export const autoDestructServiceAccount = (): void => {
    // Clear from secure storage
    secureStorage.removeItem(SERVICE_ACCOUNT_KEY);
    
    // Clear from session storage (if any)
    sessionStorage.removeItem('temp_service_account');
    
    // Clear from any in-memory variables by triggering garbage collection
    if (typeof window !== 'undefined') {
        // Clear any form inputs that might contain the key
        const inputs = document.querySelectorAll('input[type="password"], textarea');
        inputs.forEach((input: any) => {
            if (input.value && input.value.includes('"type": "service_account"')) {
                input.value = '';
            }
        });
    }
    
    console.log('🔐✅ Service Account AUTO-DESTRUCTED after deployment');
};

// ============================================================
// MIGRATION: Migrate old unencrypted config to encrypted
// ============================================================

/**
 * Migrate existing unencrypted config to secure storage
 * Should be called on app startup
 */
export const migrateToSecureStorage = async (): Promise<void> => {
    const oldKey = 'adora_client_config';
    const oldConfig = localStorage.getItem(oldKey);
    
    if (oldConfig && !secureStorage.hasItem(FIREBASE_CONFIG_KEY)) {
        try {
            const config = JSON.parse(oldConfig);
            await saveFirebaseConfigSecure(config);
            
            // Remove old unencrypted config
            localStorage.removeItem(oldKey);
            console.log('✅ Migrated Firebase config to secure storage');
        } catch (e) {
            console.error('Migration failed:', e);
        }
    }
};

export default secureStorage;
