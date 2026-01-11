/**
 * Auth Repository Interface
 * Defines the contract for authentication operations
 * Adora Hotel Management System V3 - Repository Pattern
 * 
 * @interface IAuthRepository
 * @description
 * This interface abstracts authentication operations, allowing
 * the application to switch between different authentication
 * backends (Firebase, custom API, etc.) without changing
 * business logic.
 * 
 * ## Implementation Notes:
 * - Must maintain rate limiting for security
 * - Must support session persistence (localStorage)
 * - Must check employee/manager status before allowing login
 */

import { LoginResult } from '../../types/auth';

/**
 * Authentication Repository Interface
 * Provides abstraction for all authentication-related operations
 */
export interface IAuthRepository {
    /**
     * Authenticates an employee using their global unique code
     * 
     * ## Business Rules:
     * - Must enforce rate limiting (5 attempts, 15-min lockout)
     * - Must verify employee status is 'active'
     * - Must update lastLogin timestamp on success
     * - Must store session data for persistence
     * 
     * @param code - The unique PIN code
     * @returns Promise<LoginResult> - Success with employee, or failure with error
     */
    loginWithGlobalCode(code: string): Promise<LoginResult>;

    /**
     * Loads and validates the current session from storage
     * 
     * ## Business Rules:
     * - Must verify employee still exists
     * - Must verify employee status is 'active'
     * - Must fail if session data is missing or invalid
     * 
     * @returns Promise<LoginResult> - Success with employee, or failure
     */
    loadSession(): Promise<LoginResult>;

    /**
     * Logs out the current user
     * 
     * ## Side Effects:
     * - Clears session data from localStorage
     * - Does NOT clear user preferences (theme, branch)
     */
    logout(): void;

    /**
     * Checks if rate limit has been exceeded for login attempts
     * 
     * @param code - The PIN code being attempted
     * @returns Promise<{ allowed: boolean; remainingAttempts: number }>
     */
    checkRateLimit(code: string): Promise<{ 
        allowed: boolean; 
        remainingAttempts: number;
        lockoutUntil?: Date;
    }>;

    /**
     * Clears failed login attempts (called after successful login)
     */
    clearLoginAttempts(): void;
}
