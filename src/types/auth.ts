/**
 * Authentication Types
 * Types related to authentication flow and session management
 * Adora Hotel Management System V3 - SaaS Multi-Tenant
 */

import { User } from './index';
import { Employee } from './tenant';

/**
 * Result of a login attempt
 */
export interface LoginResult {
    success: boolean;
    employee?: Employee;
    tenantId?: string;
    error?: string;
}

/**
 * Result of PIN-based login (for managers/employees)
 */
export interface PinLoginResult {
    success: boolean;
    user?: User;
    tenantId?: string;
    error?: string;
    availableBranches?: Array<{ id: string; code?: string; name: string }>;
    preferredBranchId?: string;
}

/**
 * Minimal Auth Context State
 * Used to check authentication state without full context dependency
 */
export interface AuthContextState {
    authReady: boolean;
    user: User | null;
}

/**
 * Session data stored in localStorage
 */
export interface SessionData {
    employeeId: string;
    tenantId: string;
    code: string;
    loginAt: number;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
    allowed: boolean;
    remainingAttempts: number;
    lockoutUntil?: Date;
}

/**
 * Biometric verification result
 */
export interface BiometricResult {
    success: boolean;
    userId?: string;
    error?: string;
}

/**
 * User binding for Firestore rules
 */
export interface UserBinding {
    tenantId: string;
    role: string;
    updatedAt?: Date;
}
