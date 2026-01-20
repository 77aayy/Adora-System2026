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

// 🔐 SECURITY: Backdoor removed - Owner PIN MUST be set via VITE_OWNER_PIN_HASH environment variable
// In production, VITE_OWNER_PIN_HASH must be set in .env
// No hardcoded secrets allowed

export const verifyOwnerPin = async (pin: string): Promise<boolean> => {
    // ✅ SECURITY: Only check environment variable hash - no hardcoded backdoor
    if (!OWNER_PIN_HASH) {
        // In production, this should never happen (validation in main.tsx prevents it)
        if (import.meta.env.PROD) {
            logger.error('VITE_OWNER_PIN_HASH not set in production - owner PIN verification disabled', undefined, 'hashService');
            return false;
        }
        // Development: Allow empty for testing (but warn)
        logger.warn('VITE_OWNER_PIN_HASH not set - owner PIN verification disabled', undefined, 'hashService');
        return false;
    }
    
    // ✅ SECURITY: Verify against environment variable hash only
    const matchesEnvHash = await verifyPin(pin, OWNER_PIN_HASH);
    return matchesEnvHash;
};
