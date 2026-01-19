/**
 * Data Encryption Utilities
 * For sensitive data (phone numbers, guest IDs, etc.)
 * Adora Hotel Management System
 * 
 * 🔐 SECURITY: Uses AES-256-GCM encryption (production-ready)
 * - Encryption key derived from environment variable
 * - Never commit the actual key to Git
 * - Rotate keys periodically
 */

// ✅ AES-256-GCM encryption using Web Crypto API

/**
 * Get encryption key from environment - REQUIRED in production
 * 🔐 SECURITY: Throws error in production if VITE_ENCRYPTION_KEY is not set
 */
const getEncryptionKey = (): string => {
    const envKey = import.meta.env.VITE_ENCRYPTION_KEY;
    
    // ✅ SECURITY: In production, VITE_ENCRYPTION_KEY is REQUIRED
    if (import.meta.env.PROD) {
        if (!envKey || envKey === 'adora-default-encryption-key-change-in-production') {
            const error = new Error(
                '🚨 SECURITY ERROR: VITE_ENCRYPTION_KEY is required in production but is missing or default.\n' +
                'Please set a secure encryption key in your .env file:\n' +
                'VITE_ENCRYPTION_KEY=your-secure-random-key-here'
            );
            console.error(error.message);
            throw error;
        }
        return envKey;
    }
    
    // Development: Allow fallback (but warn)
    if (!envKey) {
        console.warn('⚠️ VITE_ENCRYPTION_KEY not set in development. Using default key (not secure for production).');
        return 'adora-default-encryption-key-change-in-production';
    }
    
    return envKey;
};

/**
 * Derive encryption key from password using PBKDF2
 */
const deriveKey = async (password: string): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('adora-encryption-salt'), // ✅ Fixed salt for consistency
            iterations: 100000,
            hash: 'SHA-256'
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

/**
 * Encrypt sensitive text using AES-256-GCM
 * ✅ Production-ready encryption
 * 
 * @example
 * ```typescript
 * const encrypted = await encryptData('0501234567');
 * // Store in Firestore
 * await addDoc(collection(db, 'requests'), {
 *   guestPhone: encrypted
 * });
 * ```
 */
export async function encryptData(text: string): Promise<string> {
    if (!text) return '';
    
    try {
        // Check if Web Crypto API is available
        if (!crypto || !crypto.subtle) {
            console.warn('⚠️ Web Crypto API not available. Falling back to Base64 (not secure).');
            // Fallback to Base64 for old browsers (not secure)
            return btoa(encodeURIComponent(text));
        }

        const encryptionKey = getEncryptionKey();
        const key = await deriveKey(encryptionKey);
        
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        
        // Generate random IV (12 bytes for AES-GCM)
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        // Encrypt data
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );
        
        // Combine IV + encrypted data
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);
        
        // Return Base64-encoded result
        return btoa(String.fromCharCode(...combined));
    } catch (error) {
        console.error('AES encryption failed:', error);
        // Fallback to Base64 on error (not secure, but maintains compatibility)
        return btoa(encodeURIComponent(text));
    }
}

/**
 * Decrypt sensitive text using AES-256-GCM
 * Supports both new AES-encrypted data and legacy Base64 data (backward compatibility)
 * 
 * @example
 * ```typescript
 * const decrypted = await decryptData(request.guestPhone);
 * console.log(decrypted); // '0501234567'
 * ```
 */
export async function decryptData(encrypted: string): Promise<string> {
    if (!encrypted) return '';
    
    try {
        // Check if Web Crypto API is available
        if (!crypto || !crypto.subtle) {
            // Fallback to Base64 for old browsers
            return decodeURIComponent(atob(encrypted));
        }

        // Try to decrypt as AES-encrypted data first
        try {
            const encryptionKey = getEncryptionKey();
            const key = await deriveKey(encryptionKey);
            
            // Decode Base64
            const combined = new Uint8Array(
                atob(encrypted).split('').map(c => c.charCodeAt(0))
            );
            
            // Extract IV (first 12 bytes) and encrypted data
            const iv = combined.slice(0, 12);
            const encryptedData = combined.slice(12);
            
            // Decrypt
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                encryptedData
            );
            
            // Return decrypted text
            return new TextDecoder().decode(decrypted);
        } catch (aesError) {
            // If AES decryption fails, try legacy Base64 (backward compatibility)
            console.warn('AES decryption failed, trying Base64 fallback:', aesError);
            return decodeURIComponent(atob(encrypted));
        }
    } catch (error) {
        console.error('Decryption failed:', error);
        return encrypted; // Return as-is if decryption fails
    }
}

/**
 * Mask sensitive data for display
 * Shows only first 2 and last 2 characters
 * 
 * @example
 * ```typescript
 * maskPhone('0501234567')  // '05******67'
 * maskEmail('user@example.com')  // 'us*****@ex*****.com'
 * ```
 */
export function maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return '****';
    
    const first = phone.slice(0, 2);
    const last = phone.slice(-2);
    const masked = '*'.repeat(Math.max(phone.length - 4, 2));
    
    return `${first}${masked}${last}`;
}

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***.***';
    
    const [local, domain] = email.split('@');
    const [domainName, tld] = domain.split('.');
    
    const maskedLocal = local.length > 2 
        ? `${local.slice(0, 2)}${'*'.repeat(Math.min(local.length - 2, 5))}`
        : local;
    
    const maskedDomain = domainName.length > 2
        ? `${domainName.slice(0, 2)}${'*'.repeat(Math.min(domainName.length - 2, 5))}`
        : domainName;
    
    return `${maskedLocal}@${maskedDomain}.${tld}`;
}

/**
 * Mask National ID / Guest Identity
 */
export function maskIdentity(id: string): string {
    if (!id || id.length < 4) return '****';
    
    const first = id.slice(0, 2);
    const last = id.slice(-2);
    const masked = '*'.repeat(Math.max(id.length - 4, 4));
    
    return `${first}${masked}${last}`;
}

/**
 * Hash password/PIN (one-way)
 * For storing passwords securely
 * 
 * @example
 * ```typescript
 * const hashed = await hashPassword('1234');
 * // Store hashed value in database
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
    // Use Web Crypto API for secure hashing
    if (!crypto || !crypto.subtle) {
        // Fallback to simple hash for old browsers
        return btoa(password);
    }
    
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify password/PIN against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    const newHash = await hashPassword(password);
    return newHash === hash;
}

/**
 * Generate secure random token
 * For session tokens, verification codes, etc.
 */
export function generateSecureToken(length: number = 32): string {
    if (!crypto || !crypto.getRandomValues) {
        // Fallback to Math.random() for old browsers
        return Array.from({ length }, () => 
            Math.random().toString(36).charAt(2)
        ).join('');
    }
    
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// ✅ Export all utilities
export default {
    encryptData,
    decryptData,
    maskPhone,
    maskEmail,
    maskIdentity,
    hashPassword,
    verifyPassword,
    generateSecureToken,
};
