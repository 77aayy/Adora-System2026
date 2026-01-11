/**
 * SaaS Validation Utilities
 * Ensures proper tenant isolation and data security
 * Adora Hotel Management System V3
 */

/**
 * Validates that tenantId is present (required for SaaS isolation)
 * Throws error if tenantId is missing
 */
export function requireTenantId(tenantId: string | null | undefined, context: string = 'Operation'): string {
    if (!tenantId) {
        throw new Error(`${context}: tenantId is required for SaaS isolation`);
    }
    return tenantId;
}

/**
 * Validates that branchId is present
 * Throws error if branchId is missing
 */
export function requireBranchId(branchId: string | null | undefined, context: string = 'Operation'): string {
    if (!branchId) {
        throw new Error(`${context}: branchId is required`);
    }
    return branchId;
}

/**
 * Validates both tenantId and branchId
 * Returns validated values or throws error
 */
export function requireTenantAndBranch(
    tenantId: string | null | undefined,
    branchId: string | null | undefined,
    context: string = 'Operation'
): { tenantId: string; branchId: string } {
    return {
        tenantId: requireTenantId(tenantId, context),
        branchId: requireBranchId(branchId, context)
    };
}

/**
 * Safely gets tenantId from user object with fallback
 * Returns null if not available (for owner/system accounts)
 */
export function getTenantId(user: any): string | null {
    if (!user) return null;
    
    // Owner accounts don't have tenantId (they operate cross-tenant)
    if (user.role === 'owner') return null;
    
    return user.tenantId || null;
}

/**
 * Checks if operation requires tenant isolation
 * Returns true if user is not owner
 */
export function requiresTenantIsolation(user: any): boolean {
    return user?.role !== 'owner';
}
