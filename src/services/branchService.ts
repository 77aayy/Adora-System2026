/**
 * Branch Service
 * Handles all branch CRUD operations
 * ✅ Architecture: All Firebase operations isolated in services
 * ✅ SaaS: Tenant-scoped branches
 * ✅ SECURITY: Enforces licensed branch codes (RED LINE)
 */

import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs, Timestamp, serverTimestamp, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';
import { Branch } from '../types';

// ============================================================
// NULL SAFETY HELPERS
// ============================================================

/**
 * Validate db is initialized
 */
const checkDb = (): boolean => {
    if (!db) {
        logger.error('Database not initialized', new Error('db is null'), 'branchService');
        return false;
    }
    return true;
};

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Subscribe to branches for a tenant
 * ✅ Null Safety: Checks db before operations
 */
export const subscribeToBranches = (
    tenantId: string,
    callback: (branches: Branch[]) => void
): Unsubscribe | null => {
    // ✅ Null Safety: Check db
    if (!checkDb()) {
        callback([]);
        return null;
    }

    // ✅ SaaS: Validate tenantId
    if (!tenantId) {
        logger.warn('Cannot subscribe to branches: Missing tenantId', null, 'branchService');
        callback([]);
        return null;
    }

    try {
        // ✅ SaaS: Tenant-scoped collection
        const branchesRef = collection(db, `tenants/${tenantId}/branches`);

        const unsubscribe = onSnapshot(
            branchesRef,
            (snapshot) => {
                const branches: Branch[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Branch));
                callback(branches);
            },
            (error) => {
                logger.error('Error in branches subscription', error, 'branchService');
                callback([]);
            }
        );

        return unsubscribe;
    } catch (error: any) {
        logger.error('Error subscribing to branches', error, 'branchService');
        callback([]);
        return null;
    }
};

/**
 * Create a new branch
 * ✅ Null Safety: Checks db before operations
 */
export const createBranch = async (
    tenantId: string,
    branchData: Omit<Branch, 'id' | 'createdAt'>
): Promise<{ success: boolean; branchId?: string; error?: string }> => {
    // ✅ Null Safety: Check db
    if (!checkDb()) {
        return { success: false, error: 'Database not initialized' };
    }

    // ✅ SaaS: Validate tenantId
    if (!tenantId) {
        const error = 'Tenant ID is required';
        logger.error('Cannot create branch', new Error(error), 'branchService');
        return { success: false, error };
    }

    try {
        // 🛡️ SECURITY FIRST: License validation before creating branch
        // ✅ Fetch tenant info to get maxBranches limit
        const tenantRef = doc(db, 'tenants', tenantId);
        const tenantSnap = await getDoc(tenantRef);
        
        if (!tenantSnap.exists()) {
            const error = 'Tenant not found';
            logger.error('Cannot create branch', new Error(error), 'branchService');
            return { success: false, error };
        }
        
        const tenantInfo = tenantSnap.data().info || {};
        const maxBranches = tenantInfo.maxBranches || 1;
        const licensedBranchCodes = tenantInfo.branchCodes || []; // ✅ Licensed codes from owner
        
        // 🛡️ RED LINE SECURITY: Code MUST be in licensed branchCodes (Critical protection)
        // Prevents managers from creating unauthorized branches
        if (branchData.code && licensedBranchCodes.length > 0) {
            if (!licensedBranchCodes.includes(branchData.code)) {
                const error = `عفواً، الكود "${branchData.code}" غير مرخص لك. التراخيص المتاحة: ${licensedBranchCodes.join(', ')}. يرجى التواصل مع المالك.`;
                logger.warn('Unauthorized branch code', { tenantId, code: branchData.code, licensedCodes: licensedBranchCodes }, 'branchService');
                return { success: false, error };
            }
        }
        
        // ✅ Count current active branches
        const branchesRef = collection(db, `tenants/${tenantId}/branches`);
        const branchesSnapshot = await getDocs(branchesRef);
        
        // Filter only active branches (exclude deleted/soft-deleted)
        const activeBranches = branchesSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.status !== 'deleted' && data.status !== 'inactive';
        });
        const currentBranchCount = activeBranches.length;
        
        // 🛡️ SECURITY: Enforce license limit (Critical protection)
        if (currentBranchCount >= maxBranches) {
            const error = `عفواً، لقد وصلت للحد الأقصى للفروع (${maxBranches}). يرجى التواصل مع المالك لزيادة عدد التراخيص.`;
            logger.warn('License limit reached', { tenantId, currentBranchCount, maxBranches }, 'branchService');
            return { success: false, error };
        }
        
        // ✅ SaaS: Tenant-scoped collection
        // Use deterministic ID based on code: branch-{code}
        const branchId = branchData.code ? `branch-${branchData.code}` : undefined;
        const branchRef = branchId 
            ? doc(db, `tenants/${tenantId}/branches`, branchId)
            : doc(collection(db, `tenants/${tenantId}/branches`));

        await setDoc(branchRef, {
            ...branchData,
            status: 'active',
            createdAt: Timestamp.now(),
            settings: branchData.settings || { workingHours: '24/7' }
        });

        const finalBranchId = branchId || branchRef.id;
        logger.info('Branch created successfully', { tenantId, branchId: finalBranchId, licenseUsage: `${currentBranchCount + 1}/${maxBranches}` }, 'branchService');
        return { success: true, branchId: finalBranchId };
    } catch (error: any) {
        logger.error('Error creating branch', error, 'branchService');
        return { success: false, error: error.message || 'Failed to create branch' };
    }
};

/**
 * Update an existing branch
 * ✅ Null Safety: Checks db before operations
 */
export const updateBranch = async (
    tenantId: string,
    branchId: string,
    updates: Partial<Branch>
): Promise<{ success: boolean; error?: string }> => {
    // ✅ Null Safety: Check db
    if (!checkDb()) {
        return { success: false, error: 'Database not initialized' };
    }

    // ✅ SaaS: Validate tenantId and branchId
    if (!tenantId || !branchId) {
        const error = 'Tenant ID and Branch ID are required';
        logger.error('Cannot update branch', new Error(error), 'branchService');
        return { success: false, error };
    }

    try {
        // ✅ SaaS: Tenant-scoped collection
        await updateDoc(doc(db, `tenants/${tenantId}/branches`, branchId), updates);

        logger.info('Branch updated successfully', { tenantId, branchId }, 'branchService');
        return { success: true };
    } catch (error: any) {
        logger.error('Error updating branch', error, 'branchService');
        return { success: false, error: error.message || 'Failed to update branch' };
    }
};

/**
 * Delete/Soft delete a branch
 * ✅ Null Safety: Checks db before operations
 */
export const deleteBranch = async (
    tenantId: string,
    branchId: string,
    softDelete: boolean = true
): Promise<{ success: boolean; error?: string }> => {
    // ✅ Null Safety: Check db
    if (!checkDb()) {
        return { success: false, error: 'Database not initialized' };
    }

    // ✅ SaaS: Validate tenantId and branchId
    if (!tenantId || !branchId) {
        const error = 'Tenant ID and Branch ID are required';
        logger.error('Cannot delete branch', new Error(error), 'branchService');
        return { success: false, error };
    }

    try {
        if (softDelete) {
            // ✅ Soft delete: Mark as deleted
            await updateDoc(doc(db, `tenants/${tenantId}/branches`, branchId), {
                status: 'deleted',
                deletedAt: serverTimestamp()
            });
        } else {
            // ✅ Hard delete: Permanently remove
            await deleteDoc(doc(db, `tenants/${tenantId}/branches`, branchId));
        }

        logger.info('Branch deleted successfully', { tenantId, branchId, softDelete }, 'branchService');
        return { success: true };
    } catch (error: any) {
        logger.error('Error deleting branch', error, 'branchService');
        return { success: false, error: error.message || 'Failed to delete branch' };
    }
};

/**
 * Restore a soft-deleted branch
 * ✅ Null Safety: Checks db before operations
 */
export const restoreBranch = async (
    tenantId: string,
    branchId: string
): Promise<{ success: boolean; error?: string }> => {
    // ✅ Null Safety: Check db
    if (!checkDb()) {
        return { success: false, error: 'Database not initialized' };
    }

    // ✅ SaaS: Validate tenantId and branchId
    if (!tenantId || !branchId) {
        const error = 'Tenant ID and Branch ID are required';
        logger.error('Cannot restore branch', new Error(error), 'branchService');
        return { success: false, error };
    }

    try {
        // ✅ SaaS: Tenant-scoped collection
        await updateDoc(doc(db, `tenants/${tenantId}/branches`, branchId), {
            status: 'active',
            deletedAt: null
        });

        logger.info('Branch restored successfully', { tenantId, branchId }, 'branchService');
        return { success: true };
    } catch (error: any) {
        logger.error('Error restoring branch', error, 'branchService');
        return { success: false, error: error.message || 'Failed to restore branch' };
    }
};

/**
 * Get a single branch by ID
 * ✅ Null Safety: Checks db before operations
 */
export const getBranch = async (
    tenantId: string,
    branchId: string
): Promise<Branch | null> => {
    // ✅ Null Safety: Check db
    if (!checkDb()) {
        return null;
    }

    // ✅ SaaS: Validate tenantId and branchId
    if (!tenantId || !branchId) {
        logger.warn('Cannot get branch: Missing tenantId or branchId', null, 'branchService');
        return null;
    }

    try {
        // ✅ SaaS: Tenant-scoped collection
        const branchDoc = await getDoc(doc(db, `tenants/${tenantId}/branches`, branchId));
        
        if (!branchDoc.exists()) {
            logger.warn('Branch not found', { tenantId, branchId }, 'branchService');
            return null;
        }

        return {
            id: branchDoc.id,
            ...branchDoc.data()
        } as Branch;
    } catch (error: any) {
        logger.error('Error getting branch', error, 'branchService');
        return null;
    }
};

// ============================================================
// LICENSE MANAGEMENT (SaaS)
// ============================================================

/**
 * Get available branch codes for a tenant (licensed but not yet activated)
 * ✅ SaaS: Reads licensed codes from tenant.info.branchCodes
 * ✅ Returns codes that are licensed but not yet used (not created in branches collection)
 * 
 * @param tenantId - Tenant ID
 * @returns Array of available branch codes with usage status
 */
export const getAvailableBranchCodes = async (tenantId: string): Promise<Array<{ code: string; name?: string; used: boolean }>> => {
    // ✅ Null Safety: Check db
    if (!checkDb()) {
        logger.warn('Cannot get available branch codes: Database not initialized', null, 'branchService');
        return [];
    }

    // ✅ SaaS: Validate tenantId
    if (!tenantId) {
        logger.warn('Cannot get available branch codes: Missing tenantId', null, 'branchService');
        return [];
    }

    try {
        // ✅ Fetch tenant info to get licensed branch codes
        const tenantRef = doc(db, 'tenants', tenantId);
        const tenantSnap = await getDoc(tenantRef);
        
        if (!tenantSnap.exists()) {
            logger.warn('Cannot get available branch codes: Tenant not found', { tenantId }, 'branchService');
            return [];
        }
        
        const tenantInfo = tenantSnap.data().info || {};
        const licensedBranchCodes: string[] = tenantInfo.branchCodes || [];
        const branchNamesMap: Record<string, string> = tenantInfo.branchNames || {};
        
        // ✅ Get existing branches (to check which codes are used)
        const branchesRef = collection(db, `tenants/${tenantId}/branches`);
        const branchesSnapshot = await getDocs(branchesRef);
        
        // Get all branch codes that are already used
        const usedCodes = new Set<string>();
        branchesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const code = data.code;
            if (code) {
                usedCodes.add(code);
            }
        });
        
        // ✅ Map licensed codes to available/used status
        const availableCodes = licensedBranchCodes.map(code => ({
            code,
            name: branchNamesMap[code], // Suggested name from owner (optional)
            used: usedCodes.has(code) // Whether this code is already used in branches collection
        }));
        
        logger.info('Available branch codes retrieved', { tenantId, total: availableCodes.length, used: availableCodes.filter(c => c.used).length }, 'branchService');
        return availableCodes;
    } catch (error: any) {
        logger.error('Error getting available branch codes', error, 'branchService');
        return [];
    }
};
