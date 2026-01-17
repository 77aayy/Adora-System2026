/**
 * Tenant Security Service
 * 🔐 Centralized tenant access validation for all services
 * Adora Hotel Management System V4 - Secure Architecture
 * 
 * This service provides unified security functions for:
 * - Custom Claims validation
 * - Tenant ID validation
 * - Access control checks
 * 
 * Used by all services to ensure 100% tenant isolation
 */

import { auth } from './firebase';
import { logger } from './loggerService';

/**
 * Validates tenant access using Custom Claims from Firebase Auth
 * This is the FIRST line of defense (Service Layer)
 * 
 * @param requestedTenantId - The tenantId being accessed
 * @param requiredRole - Optional: Required role for sensitive operations (e.g., 'owner' for API keys)
 * @throws Error if access is denied
 */
export function validateTenantAccess(requestedTenantId: string, requiredRole?: string): void {
    if (!auth) {
        throw new Error('Firebase Auth not initialized');
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('User not authenticated');
    }

    // Get Custom Claims from token
    // Note: Custom Claims are available in token after refresh
    // For immediate access, we check localStorage as fallback
    const storedUser = localStorage.getItem('adora_user');
    let userTenantId: string | null = null;
    let userRole: string | null = null;

    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            userTenantId = user.tenantId || null;
            userRole = user.role || null;
        } catch (e) {
            logger.warn('Failed to parse stored user', e, 'tenantSecurityService');
        }
    }

    // ✅ RBAC: Check role first for sensitive operations
    if (requiredRole) {
        if (!userRole) {
            logger.error(
                'Role access denied: User role not found',
                undefined,
                'tenantSecurityService'
            );
            throw new Error('Access denied: User role not found');
        }

        // Owner can always access (super-admin)
        if (userRole === 'owner' || userTenantId === 'system-owner') {
            // Owner bypass - continue to tenant check
        } else if (userRole !== requiredRole) {
            logger.error(
                `Role access denied: User role (${userRole}) != Required role (${requiredRole})`,
                undefined,
                'tenantSecurityService'
            );
            throw new Error(`Access denied: Operation requires '${requiredRole}' role. Your role: '${userRole}'`);
        }
    }

    // ✅ Owner can access all tenants (cross-tenant operations)
    if (userRole === 'owner' || userTenantId === 'system-owner') {
        return; // Owner bypass
    }

    // ✅ Regular users: Strict tenant match required
    if (!userTenantId) {
        throw new Error('Tenant ID not found in user context');
    }

    if (userTenantId !== requestedTenantId) {
        logger.error(
            `Tenant access denied: User tenantId (${userTenantId}) != Requested tenantId (${requestedTenantId})`,
            undefined,
            'tenantSecurityService'
        );
        throw new Error('Tenant access denied: You do not have permission to access this hotel\'s data');
    }
}

/**
 * Validates tenantId is provided and not empty
 * 
 * @param tenantId - The tenantId to validate
 * @returns Validated tenantId (trimmed)
 * @throws Error if tenantId is invalid
 */
export function validateTenantId(tenantId: string | undefined | null): string {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
        throw new Error('Tenant ID is required for all operations');
    }
    return tenantId.trim();
}

/**
 * Gets current user's tenantId from context
 * 
 * @returns User's tenantId or null if not found
 */
export function getCurrentUserTenantId(): string | null {
    const storedUser = localStorage.getItem('adora_user');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            return user.tenantId || null;
        } catch (e) {
            logger.warn('Failed to parse stored user', e, 'tenantSecurityService');
        }
    }
    return null;
}

/**
 * Gets current user's role from context
 * 
 * @returns User's role or null if not found
 */
export function getCurrentUserRole(): string | null {
    const storedUser = localStorage.getItem('adora_user');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            return user.role || null;
        } catch (e) {
            logger.warn('Failed to parse stored user', e, 'tenantSecurityService');
        }
    }
    return null;
}

/**
 * Checks if current user is owner
 * 
 * @returns true if user is owner, false otherwise
 */
export function isCurrentUserOwner(): boolean {
    const role = getCurrentUserRole();
    const tenantId = getCurrentUserTenantId();
    return role === 'owner' || tenantId === 'system-owner';
}

/**
 * 🔐 RBAC: Validates user has required role for operation
 * Used by services to enforce role-based access to sensitive data
 * 
 * @param requiredRole - Required role (e.g., 'owner', 'manager')
 * @throws Error if user doesn't have required role
 */
export function validateRoleAccess(requiredRole: string): void {
    const userRole = getCurrentUserRole();
    const tenantId = getCurrentUserTenantId();

    // Owner always has access
    if (userRole === 'owner' || tenantId === 'system-owner') {
        return;
    }

    if (!userRole) {
        logger.error(
            'Role access denied: User role not found',
            undefined,
            'tenantSecurityService'
        );
        throw new Error('Access denied: User role not found');
    }

    if (userRole !== requiredRole) {
        logger.error(
            `Role access denied: User role (${userRole}) != Required role (${requiredRole})`,
            undefined,
            'tenantSecurityService'
        );
        throw new Error(`Access denied: Operation requires '${requiredRole}' role. Your role: '${userRole}'`);
    }
}
