/**
 * Firebase Auth Repository Implementation
 * Implements IAuthRepository using Firebase/Firestore
 * Adora Hotel Management System V3 - Repository Pattern
 * 
 * @description
 * This implementation wraps the existing authService functions
 * to provide the IAuthRepository interface. This approach:
 * - Maintains backward compatibility with existing code
 * - Provides a clean interface for future migration
 * - Allows gradual adoption without breaking changes
 */

import { IAuthRepository } from '../interfaces/IAuthRepository';
import { LoginResult } from '../../types/auth';
import {
    loginWithGlobalCode as firebaseLoginWithGlobalCode,
    loadSession as firebaseLoadSession,
    logout as firebaseLogout
} from '../../services/authService';

/**
 * Rate limiting storage keys
 */
const LOGIN_ATTEMPTS_KEY = 'login_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

/**
 * Firebase implementation of IAuthRepository
 * 
 * @example
 * ```typescript
 * const authRepo = new FirebaseAuthRepository();
 * const result = await authRepo.loginWithGlobalCode('1234');
 * ```
 */
export class FirebaseAuthRepository implements IAuthRepository {
    /**
     * Authenticates an employee using their global unique code
     * Delegates to the existing authService implementation
     */
    async loginWithGlobalCode(code: string): Promise<LoginResult> {
        return firebaseLoginWithGlobalCode(code);
    }

    /**
     * Loads and validates the current session from localStorage
     * Delegates to the existing authService implementation
     */
    async loadSession(): Promise<LoginResult> {
        return firebaseLoadSession();
    }

    /**
     * Logs out the current user
     * Delegates to the existing authService implementation
     */
    logout(): void {
        firebaseLogout();
    }

    /**
     * Checks if rate limit has been exceeded
     */
    async checkRateLimit(code: string): Promise<{
        allowed: boolean;
        remainingAttempts: number;
        lockoutUntil?: Date;
    }> {
        const stored = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
        if (!stored) {
            return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
        }

        const { count, lastAttempt } = JSON.parse(stored);
        
        if (count >= MAX_ATTEMPTS) {
            const timePassed = Date.now() - lastAttempt;
            if (timePassed < LOCKOUT_TIME) {
                const lockoutUntil = new Date(lastAttempt + LOCKOUT_TIME);
                return {
                    allowed: false,
                    remainingAttempts: 0,
                    lockoutUntil
                };
            } else {
                // Lockout expired, clear attempts
                this.clearLoginAttempts();
                return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
            }
        }

        return {
            allowed: true,
            remainingAttempts: MAX_ATTEMPTS - count
        };
    }

    /**
     * Clears failed login attempts
     */
    clearLoginAttempts(): void {
        localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
    }
}

/**
 * Singleton instance for convenience
 * Use this when you don't need dependency injection
 */
export const authRepository = new FirebaseAuthRepository();
