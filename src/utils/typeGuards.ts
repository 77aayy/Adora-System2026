/**
 * Type Guards for SaaS Multi-Tenancy
 * Adora Hotel Management System V3
 * 
 * ✅ Provides type-safe checks for tenant isolation
 */

// ============================================================
// TENANT TYPE GUARDS
// ============================================================

/**
 * Check if a value is a valid tenant ID
 */
export function isTenantId(value: unknown): value is string {
    return typeof value === 'string' && 
           value.length > 0 && 
           value !== 'system-owner' &&
           !value.includes('..') && // Prevent path traversal
           !value.includes('/'); // Prevent path injection
}

/**
 * Check if a value is the system owner tenant ID
 */
export function isSystemOwner(value: unknown): boolean {
    return value === 'system-owner';
}

/**
 * Check if a value is a valid branch ID
 */
export function isBranchId(value: unknown): value is string {
    return typeof value === 'string' && 
           value.length > 0 &&
           !value.includes('..') &&
           !value.includes('/');
}

/**
 * Type guard for objects with tenantId
 */
export function hasTenantId<T extends { tenantId?: unknown }>(
    obj: T
): obj is T & { tenantId: string } {
    return isTenantId(obj.tenantId);
}

/**
 * Type guard for objects with branchId
 */
export function hasBranchId<T extends { branchId?: unknown }>(
    obj: T
): obj is T & { branchId: string } {
    return isBranchId(obj.branchId);
}

/**
 * Validate tenant and branch IDs together
 */
export function validateTenantAndBranch(
    tenantId: unknown,
    branchId: unknown
): { valid: boolean; tenantId?: string; branchId?: string; error?: string } {
    if (!isTenantId(tenantId)) {
        return { valid: false, error: 'Invalid tenantId' };
    }
    
    if (!isBranchId(branchId)) {
        return { valid: false, error: 'Invalid branchId' };
    }
    
    return { valid: true, tenantId, branchId };
}

/**
 * Assert that tenantId is valid (throws if not)
 */
export function assertTenantId(tenantId: unknown): asserts tenantId is string {
    if (!isTenantId(tenantId)) {
        throw new Error(`Invalid tenantId: ${tenantId}`);
    }
}

/**
 * Assert that branchId is valid (throws if not)
 */
export function assertBranchId(branchId: unknown): asserts branchId is string {
    if (!isBranchId(branchId)) {
        throw new Error(`Invalid branchId: ${branchId}`);
    }
}
