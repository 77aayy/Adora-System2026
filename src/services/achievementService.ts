/**
 * Achievement Service
 * Handles all achievement CRUD operations
 * ✅ Architecture: All Firebase operations isolated in services
 * ✅ SaaS: Tenant-scoped achievements
 */

import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, serverTimestamp, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';
import { Achievement } from '../types';

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Subscribe to achievements for a tenant
 * ✅ Null Safety: Checks db before operations
 */
export const subscribeToAchievements = (
    tenantId: string,
    callback: (achievements: Achievement[]) => void
): Unsubscribe | null => {
    // ✅ Null Safety: Check db
    if (!db) {
        logger.error('Cannot subscribe to achievements', new Error('Database not initialized'), 'achievementService');
        callback([]);
        return null;
    }

    // ✅ SaaS: Tenant-scoped collection
    try {
        const q = query(
            collection(db, `tenants/${tenantId}/achievements`),
            orderBy('requirement.value', 'asc')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const achievements: Achievement[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Achievement));
                callback(achievements);
            },
            (error) => {
                logger.error('Error in achievements subscription', error, 'achievementService');
                callback([]);
            }
        );

        return unsubscribe;
    } catch (error: any) {
        logger.error('Error subscribing to achievements', error, 'achievementService');
        callback([]);
        return null;
    }
};

/**
 * Create a new achievement
 * ✅ Null Safety: Checks db before operations
 */
export const createAchievement = async (
    tenantId: string,
    achievement: Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; achievementId?: string; error?: string }> => {
    // ✅ Null Safety: Check db
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Cannot create achievement', new Error(error), 'achievementService');
        return { success: false, error };
    }

    // ✅ SaaS: Validate tenantId
    if (!tenantId) {
        const error = 'Tenant ID is required';
        logger.error('Cannot create achievement', new Error(error), 'achievementService');
        return { success: false, error };
    }

    try {
        // ✅ SaaS: Tenant-scoped collection
        const docRef = await addDoc(
            collection(db, `tenants/${tenantId}/achievements`),
            {
                ...achievement,
                active: true,
                createdAt: serverTimestamp()
            }
        );

        logger.info('Achievement created successfully', { tenantId, achievementId: docRef.id }, 'achievementService');
        return { success: true, achievementId: docRef.id };
    } catch (error: any) {
        logger.error('Error creating achievement', error, 'achievementService');
        return { success: false, error: error.message || 'Failed to create achievement' };
    }
};

/**
 * Update an existing achievement
 * ✅ Null Safety: Checks db before operations
 */
export const updateAchievement = async (
    tenantId: string,
    achievementId: string,
    updates: Partial<Achievement>
): Promise<{ success: boolean; error?: string }> => {
    // ✅ Null Safety: Check db
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Cannot update achievement', new Error(error), 'achievementService');
        return { success: false, error };
    }

    // ✅ SaaS: Validate tenantId
    if (!tenantId || !achievementId) {
        const error = 'Tenant ID and Achievement ID are required';
        logger.error('Cannot update achievement', new Error(error), 'achievementService');
        return { success: false, error };
    }

    try {
        // ✅ SaaS: Tenant-scoped collection
        await updateDoc(
            doc(db, `tenants/${tenantId}/achievements`, achievementId),
            {
                ...updates,
                updatedAt: serverTimestamp()
            }
        );

        logger.info('Achievement updated successfully', { tenantId, achievementId }, 'achievementService');
        return { success: true };
    } catch (error: any) {
        logger.error('Error updating achievement', error, 'achievementService');
        return { success: false, error: error.message || 'Failed to update achievement' };
    }
};

/**
 * Delete an achievement
 * ✅ Null Safety: Checks db before operations
 */
export const deleteAchievement = async (
    tenantId: string,
    achievementId: string
): Promise<{ success: boolean; error?: string }> => {
    // ✅ Null Safety: Check db
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Cannot delete achievement', new Error(error), 'achievementService');
        return { success: false, error };
    }

    // ✅ SaaS: Validate tenantId
    if (!tenantId || !achievementId) {
        const error = 'Tenant ID and Achievement ID are required';
        logger.error('Cannot delete achievement', new Error(error), 'achievementService');
        return { success: false, error };
    }

    try {
        // ✅ SaaS: Tenant-scoped collection
        await deleteDoc(doc(db, `tenants/${tenantId}/achievements`, achievementId));

        logger.info('Achievement deleted successfully', { tenantId, achievementId }, 'achievementService');
        return { success: true };
    } catch (error: any) {
        logger.error('Error deleting achievement', error, 'achievementService');
        return { success: false, error: error.message || 'Failed to delete achievement' };
    }
};

/**
 * Delete multiple achievements (batch)
 * ✅ Null Safety: Checks db before operations
 */
export const deleteAchievementsBatch = async (
    tenantId: string,
    achievementIds: string[]
): Promise<{ success: boolean; error?: string }> => {
    // ✅ Null Safety: Check db
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Cannot delete achievements batch', new Error(error), 'achievementService');
        return { success: false, error };
    }

    // ✅ SaaS: Validate tenantId
    if (!tenantId || !achievementIds.length) {
        const error = 'Tenant ID and Achievement IDs are required';
        logger.error('Cannot delete achievements batch', new Error(error), 'achievementService');
        return { success: false, error };
    }

    try {
        // ✅ SaaS: Delete in parallel
        const deletePromises = achievementIds.map(id =>
            deleteDoc(doc(db, `tenants/${tenantId}/achievements`, id))
        );
        await Promise.all(deletePromises);

        logger.info('Achievements batch deleted successfully', { tenantId, count: achievementIds.length }, 'achievementService');
        return { success: true };
    } catch (error: any) {
        logger.error('Error deleting achievements batch', error, 'achievementService');
        return { success: false, error: error.message || 'Failed to delete achievements' };
    }
};

/**
 * Create multiple achievements (batch)
 * ✅ Null Safety: Checks db before operations
 */
export const createAchievementsBatch = async (
    tenantId: string,
    achievements: Array<Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<{ success: boolean; error?: string }> => {
    // ✅ Null Safety: Check db
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Cannot create achievements batch', new Error(error), 'achievementService');
        return { success: false, error };
    }

    // ✅ SaaS: Validate tenantId
    if (!tenantId || !achievements.length) {
        const error = 'Tenant ID and achievements are required';
        logger.error('Cannot create achievements batch', new Error(error), 'achievementService');
        return { success: false, error };
    }

    try {
        // ✅ SaaS: Create in parallel
        const createPromises = achievements.map(achievement =>
            addDoc(
                collection(db, `tenants/${tenantId}/achievements`),
                {
                    ...achievement,
                    active: true,
                    createdAt: serverTimestamp()
                }
            )
        );
        await Promise.all(createPromises);

        logger.info('Achievements batch created successfully', { tenantId, count: achievements.length }, 'achievementService');
        return { success: true };
    } catch (error: any) {
        logger.error('Error creating achievements batch', error, 'achievementService');
        return { success: false, error: error.message || 'Failed to create achievements' };
    }
};
