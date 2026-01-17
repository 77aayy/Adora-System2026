/**
 * Branch Service
 * Handles all branch CRUD operations
 * ✅ Architecture: All Firebase operations isolated in services
 * ✅ SaaS: Tenant-scoped branches
 */

import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, Timestamp, serverTimestamp, Unsubscribe } from 'firebase/firestore';
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
        logger.info('Branch created successfully', { tenantId, branchId: finalBranchId }, 'branchService');
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
