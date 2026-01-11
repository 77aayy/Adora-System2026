/**
 * Data Encryption Utilities
 * For sensitive data (phone numbers, guest IDs, etc.)
 * Adora Hotel Management System
 * 
 * ⚠️ SECURITY NOTE:
 * - ENCRYPTION_KEY should be stored in .env
 * - Never commit the actual key to Git
 * - Rotate keys periodically
 */

// Simple Base64 encoding/decoding for development
// In production, use crypto-js or native Web Crypto API

/**
 * Encrypt sensitive text
 * Uses Base64 for simplicity (upgrade to AES for production)
 * 
 * @example
 * ```typescript
 * const encrypted = encryptData('0501234567');
 * // Store in Firestore
 * await addDoc(collection(db, 'requests'), {
 *   guestPhone: encrypted
 * });
 * ```
 */
export function encryptData(text: string): string {
    if (!text) return '';
    
    try {
        // Simple Base64 encoding
        // TODO: Upgrade to AES-256 for production
        return btoa(encodeURIComponent(text));
    } catch (error) {
        console.error('Encryption failed:', error);
        return text; // Fallback to original
    }
}

/**
 * Decrypt sensitive text
 * 
 * @example
 * ```typescript
 * const decrypted = decryptData(request.guestPhone);
 * console.log(decrypted); // '0501234567'
 * ```
 */
export function decryptData(encrypted: string): string {
    if (!encrypted) return '';
    
    try {
        return decodeURIComponent(atob(encrypted));
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
