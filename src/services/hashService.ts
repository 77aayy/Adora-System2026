/**
 * Hash Service
 * Secure hashing for PIN codes using SHA-256
 * Adora Hotel Management System V3
 */

import { logger } from './loggerService';

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

// 🔐 SECURITY: Owner PIN hash from environment variable
// Fallback: In development, use default owner PIN 765255 (hashed)
// SHA-256 hash of "765255" = "4e0ca1ba71b351230a9c4fa7e5a224ab955dfc986c04a660053bca16a95990f4"
const DEFAULT_OWNER_PIN_HASH = '4e0ca1ba71b351230a9c4fa7e5a224ab955dfc986c04a660053bca16a95990f4';

export const verifyOwnerPin = async (pin: string): Promise<boolean> => {
    // ✅ Use environment variable hash if available, otherwise use default (development only)
    const hashToCheck = OWNER_PIN_HASH || (import.meta.env.DEV ? DEFAULT_OWNER_PIN_HASH : null);
    
    if (!hashToCheck) {
        // In production, this should never happen (validation in main.tsx prevents it)
        if (import.meta.env.PROD) {
            logger.error('VITE_OWNER_PIN_HASH not set in production - owner PIN verification disabled', undefined, 'hashService');
            return false;
        }
        // Development: Should not reach here, but just in case
        logger.warn('VITE_OWNER_PIN_HASH not set - owner PIN verification disabled', undefined, 'hashService');
        return false;
    }
    
    // ✅ Verify against hash (environment variable or default)
    const matchesHash = await verifyPin(pin, hashToCheck);
    
    if (matchesHash && !OWNER_PIN_HASH && import.meta.env.DEV) {
        logger.warn('Using default owner PIN hash (development mode only)', undefined, 'hashService');
    }
    
    return matchesHash;
};
