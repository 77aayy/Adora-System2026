/**
 * 🚩 Feature Flags Service
 * نظام الأعلام للميزات الجديدة
 * 
 * يسمح بالتبديل بين النظام القديم والجديد تدريجياً
 * بدون كسر النظام الحالي
 */

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface FeatureFlags {
    // Universal Action Card
    useUniversalActionCard: boolean;
    
    // State Machine
    useUnifiedStateMachine: boolean;
    
    // Department-specific flags
    useUniversalCardInHousekeeping: boolean;
    useUniversalCardInMaintenance: boolean;
    useUniversalCardInBellman: boolean;
    useUniversalCardInReception: boolean;
    
    // Gradual rollout
    rolloutPercentage: number; // 0-100 (percentage of users to enable for)
}

// ============================================================
// DEFAULTS
// ============================================================

const DEFAULT_FLAGS: FeatureFlags = {
    useUniversalActionCard: true, // ✅ Enabled by default (unified system)
    useUnifiedStateMachine: true, // ✅ Enabled by default (core feature)
    useUniversalCardInHousekeeping: true, // ✅ Enabled in all departments
    useUniversalCardInMaintenance: true, // ✅ Enabled in all departments
    useUniversalCardInBellman: true, // ✅ Enabled in all departments
    useUniversalCardInReception: true, // ✅ Enabled in all departments
    rolloutPercentage: 100 // ✅ 100% rollout - all departments
};

// Cache for feature flags per tenant
let cachedFlags: Record<string, FeatureFlags> = {};

// ============================================================
// SERVICE
// ============================================================

/**
 * Get feature flags for a tenant
 * Falls back to defaults if not configured
 */
export async function getFeatureFlags(tenantId: string): Promise<FeatureFlags> {
    if (!db) {
        logger.warn('⚠️ Database not initialized, using default flags', undefined, 'featureFlagsService');
        return DEFAULT_FLAGS;
    }
    
    // Check cache first
    if (cachedFlags[tenantId]) {
        return cachedFlags[tenantId];
    }
    
    try {
        const flagsRef = doc(db, `tenants/${tenantId}/settings`, 'featureFlags');
        const flagsSnap = await getDoc(flagsRef);
        
        if (flagsSnap.exists()) {
            const flags = flagsSnap.data() as FeatureFlags;
            cachedFlags[tenantId] = flags;
            return flags;
        }
        
        // Not configured yet, return defaults
        cachedFlags[tenantId] = DEFAULT_FLAGS;
        return DEFAULT_FLAGS;
    } catch (error) {
        logger.error('❌ Error loading feature flags:', error, 'featureFlagsService');
        return DEFAULT_FLAGS;
    }
}

/**
 * Set feature flags for a tenant (Admin only)
 */
export async function setFeatureFlags(
    tenantId: string,
    flags: Partial<FeatureFlags>
): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    try {
        const flagsRef = doc(db, `tenants/${tenantId}/settings`, 'featureFlags');
        const currentFlags = await getFeatureFlags(tenantId);
        
        const updatedFlags: FeatureFlags = {
            ...currentFlags,
            ...flags
        };
        
        await setDoc(flagsRef, updatedFlags, { merge: true });
        cachedFlags[tenantId] = updatedFlags;
        
        logger.info(`✅ Feature flags updated for tenant ${tenantId}`, undefined, 'featureFlagsService');
    } catch (error) {
        logger.error('❌ Error setting feature flags:', error, 'featureFlagsService');
        throw error;
    }
}

/**
 * Subscribe to feature flags changes (real-time)
 */
export function subscribeToFeatureFlags(
    tenantId: string,
    callback: (flags: FeatureFlags) => void
): () => void {
    if (!db) {
        logger.warn('⚠️ Database not initialized, using default flags', undefined, 'featureFlagsService');
        callback(DEFAULT_FLAGS);
        return () => {}; // No-op unsubscribe
    }
    
    const flagsRef = doc(db, `tenants/${tenantId}/settings`, 'featureFlags');
    
    const unsubscribe = onSnapshot(
        flagsRef,
        (snap) => {
            if (snap.exists()) {
                const flags = snap.data() as FeatureFlags;
                cachedFlags[tenantId] = flags;
                callback(flags);
            } else {
                cachedFlags[tenantId] = DEFAULT_FLAGS;
                callback(DEFAULT_FLAGS);
            }
        },
        (error) => {
            logger.error('❌ Error subscribing to feature flags:', error, 'featureFlagsService');
            callback(DEFAULT_FLAGS);
        }
    );
    
    return unsubscribe;
}

/**
 * Check if a specific feature is enabled
 */
export async function isFeatureEnabled(
    tenantId: string,
    feature: keyof FeatureFlags
): Promise<boolean> {
    const flags = await getFeatureFlags(tenantId);
    return flags[feature] || false;
}

/**
 * Check if Universal Action Card should be used in a specific department
 */
export async function shouldUseUniversalCard(
    tenantId: string,
    department: 'housekeeping' | 'maintenance' | 'bellman' | 'reception'
): Promise<boolean> {
    const flags = await getFeatureFlags(tenantId);
    
    // ✅ Check department-specific flag first (allows per-department control)
    const departmentFlag = `useUniversalCardIn${department.charAt(0).toUpperCase() + department.slice(1)}` as keyof FeatureFlags;
    if (flags[departmentFlag]) {
        return true; // Department-specific override
    }
    
    // Check global flag
    if (flags.useUniversalActionCard) {
        return true;
    }
    
    return false;
}

/**
 * Clear cache (useful for testing)
 */
export function clearFeatureFlagsCache(tenantId?: string): void {
    if (tenantId) {
        delete cachedFlags[tenantId];
    } else {
        cachedFlags = {};
    }
}

/**
 * Enable Unified State Machine for all active tenants (Migration utility)
 * ✅ Safe: Only enables for active tenants, preserves existing flags
 */
export async function enableUnifiedStateMachineForAllTenants(): Promise<{ enabled: number; failed: number; errors: string[] }> {
    if (!db) throw new Error('Database not initialized');
    
    const errors: string[] = [];
    let enabled = 0;
    let failed = 0;
    
    try {
        // Get all tenants
        const { collection, getDocs } = await import('firebase/firestore');
        const tenantsSnapshot = await getDocs(collection(db, 'tenants'));
        
        logger.info(`🚀 Starting Unified State Machine migration for ${tenantsSnapshot.docs.length} tenants...`, undefined, 'featureFlagsService');
        
        for (const tenantDoc of tenantsSnapshot.docs) {
            const tenantId = tenantDoc.id;
            const tenantData = tenantDoc.data();
            
            // Only enable for active tenants
            if (tenantData.info?.status !== 'active') {
                logger.info(`⏭️ Skipping tenant ${tenantId} (status: ${tenantData.info?.status || 'unknown'})`, undefined, 'featureFlagsService');
                continue;
            }
            
            try {
                // Get current flags
                const currentFlags = await getFeatureFlags(tenantId);
                
                // Only enable if not already enabled
                if (!currentFlags.useUnifiedStateMachine) {
                    await setFeatureFlags(tenantId, {
                        useUnifiedStateMachine: true
                    });
                    enabled++;
                    logger.info(`✅ Enabled Unified State Machine for tenant ${tenantId}`, undefined, 'featureFlagsService');
                } else {
                    logger.info(`⏭️ Tenant ${tenantId} already has Unified State Machine enabled`, undefined, 'featureFlagsService');
                }
            } catch (error: any) {
                failed++;
                const errorMsg = `Failed for tenant ${tenantId}: ${error.message}`;
                errors.push(errorMsg);
                logger.error(`❌ ${errorMsg}`, undefined, 'featureFlagsService');
            }
        }
        
        logger.info(`✅ Migration complete: ${enabled} enabled, ${failed} failed`, undefined, 'featureFlagsService');
        return { enabled, failed, errors };
    } catch (error: any) {
        logger.error('❌ Migration failed:', error, 'featureFlagsService');
        throw error;
    }
}

/**
 * Enable Unified State Machine for a specific tenant
 */
export async function enableUnifiedStateMachineForTenant(tenantId: string): Promise<void> {
    await setFeatureFlags(tenantId, {
        useUnifiedStateMachine: true
    });
    clearFeatureFlagsCache(tenantId); // Clear cache to force refresh
    logger.info(`✅ Unified State Machine enabled for tenant ${tenantId}`, undefined, 'featureFlagsService');
}

// ============================================================
// EXPORTS
// ============================================================

// ============================================================
// EXPORTS
// ============================================================

export default {
    getFeatureFlags,
    setFeatureFlags,
    subscribeToFeatureFlags,
    isFeatureEnabled,
    shouldUseUniversalCard,
    clearFeatureFlagsCache,
    enableUnifiedStateMachineForAllTenants,
    enableUnifiedStateMachineForTenant
};

// ============================================================
// GLOBAL CONSOLE UTILITY (for developers)
// ============================================================

/**
 * Expose utility functions to window for console access
 * Usage in browser console:
 * - window.adora.enableStateMachine('tenantId')
 * - window.adora.enableStateMachineForAll()
 */
if (typeof window !== 'undefined') {
    (window as any).adora = (window as any).adora || {};
    (window as any).adora.enableStateMachine = async (tenantId: string) => {
        try {
            await enableUnifiedStateMachineForTenant(tenantId);
            logger.info(`✅ Unified State Machine enabled for tenant: ${tenantId}`, undefined, 'featureFlagsService');
            return true;
        } catch (error: any) {
            logger.error(`❌ Failed to enable State Machine:`, error, 'featureFlagsService');
            return false;
        }
    };
    (window as any).adora.enableStateMachineForAll = async () => {
        try {
            const result = await enableUnifiedStateMachineForAllTenants();
            logger.info(`✅ Migration complete:`, result, 'featureFlagsService');
            return result;
        } catch (error: any) {
            logger.error(`❌ Migration failed:`, error, 'featureFlagsService');
            return null;
        }
    };
    (window as any).adora.getFeatureFlags = async (tenantId: string) => {
        return await getFeatureFlags(tenantId);
    };
    (window as any).adora.enableStateMachineForCurrentTenant = async () => {
        try {
            const storedUser = localStorage.getItem('adora_user');
            if (!storedUser) {
                logger.warn('⚠️ No user logged in', undefined, 'featureFlagsService');
                return false;
            }
            const user = JSON.parse(storedUser);
            const tenantId = user.tenantId || localStorage.getItem('adora_tenant_id');
            if (!tenantId || tenantId === 'system-owner') {
                logger.warn('⚠️ No tenant ID found or is owner', undefined, 'featureFlagsService');
                return false;
            }
            await enableUnifiedStateMachineForTenant(tenantId);
            logger.info(`✅ Unified State Machine enabled for current tenant: ${tenantId}`, undefined, 'featureFlagsService');
            return true;
        } catch (error: any) {
            logger.error(`❌ Failed to enable State Machine:`, error, 'featureFlagsService');
            return false;
        }
    };
    logger.info('✅ Adora Developer Utilities loaded. Use window.adora.* in console.', undefined, 'featureFlagsService');
    
    // ✅ Auto-enable State Machine for current tenant on load (development mode)
    // This ensures State Machine is active for testing
    if (import.meta.env.DEV) {
        setTimeout(async () => {
            try {
                const storedUser = localStorage.getItem('adora_user');
                if (storedUser) {
                    const user = JSON.parse(storedUser);
                    const tenantId = user.tenantId || localStorage.getItem('adora_tenant_id');
                    if (tenantId && tenantId !== 'system-owner') {
                        const flags = await getFeatureFlags(tenantId);
                        if (!flags.useUnifiedStateMachine) {
                            await enableUnifiedStateMachineForTenant(tenantId);
                            logger.info(`🚀 [AUTO] Unified State Machine enabled for tenant: ${tenantId}`, undefined, 'featureFlagsService');
                        }
                    }
                }
            } catch (error) {
                // Silent fail - non-critical
            }
        }, 2000); // Wait 2 seconds for auth to settle
    }
}
