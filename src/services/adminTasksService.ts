/**
 * Admin Tasks Service
 * Handles admin task creation and management
 * ✅ Architecture: All Firebase operations isolated in services
 */

import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface AdminTask {
    id?: string;
    type: string;
    title: string;
    description: string;
    createdAt: any; // Firestore serverTimestamp
    status: 'dispatched' | 'pending' | 'completed' | 'cancelled';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    createdBy: string;
    assignedTo?: string;
    completedAt?: any;
    notes?: string;
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Create an admin task
 * ✅ Null Safety: Checks db before operations
 * ✅ Error Handling: Wrapped in try-catch with proper logging
 */
export const createAdminTask = async (
    tenantId: string,
    branchId: string,
    task: Omit<AdminTask, 'id' | 'createdAt' | 'status'>
): Promise<{ success: boolean; taskId?: string; error?: string }> => {
    // Null safety check
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Admin task creation failed', new Error(error), 'adminTasksService');
        return { success: false, error };
    }

    try {
        const taskRef = await addDoc(
            collection(db, `tenants/${tenantId}/branches/${branchId}/adminTasks`),
            {
                ...task,
                status: 'dispatched',
                createdAt: serverTimestamp()
            } as Omit<AdminTask, 'id'>
        );

        logger.info('Admin task created successfully', { taskId: taskRef.id, type: task.type }, 'adminTasksService');

        return { success: true, taskId: taskRef.id };
    } catch (error: any) {
        logger.error('Error creating admin task', error, 'adminTasksService');
        return { success: false, error: error.message || 'Failed to create admin task' };
    }
};

/**
 * Subscribe to admin tasks for a branch
 * ✅ Null Safety: Checks db before operations
 */
export const subscribeToAdminTasks = (
    tenantId: string,
    branchId: string,
    callback: (tasks: AdminTask[]) => void
): (() => void) | null => {
    // Null safety check
    if (!db) {
        logger.error('Cannot subscribe to admin tasks', new Error('Database not initialized'), 'adminTasksService');
        return null;
    }

    try {
        const q = query(
            collection(db, `tenants/${tenantId}/branches/${branchId}/adminTasks`),
            where('status', '!=', 'completed')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const tasks: AdminTask[] = [];
                snapshot.forEach((doc) => {
                    tasks.push({
                        id: doc.id,
                        ...doc.data()
                    } as AdminTask);
                });
                callback(tasks);
            },
            (error) => {
                logger.error('Error in admin tasks subscription', error, 'adminTasksService');
            }
        );

        return unsubscribe;
    } catch (error: any) {
        logger.error('Error setting up admin tasks subscription', error, 'adminTasksService');
        return null;
    }
};

/**
 * Get admin tasks for a branch
 * ✅ Null Safety: Checks db before operations
 */
export const getAdminTasks = async (
    tenantId: string,
    branchId: string,
    status?: AdminTask['status']
): Promise<AdminTask[]> => {
    // Null safety check
    if (!db) {
        logger.error('Cannot get admin tasks', new Error('Database not initialized'), 'adminTasksService');
        return [];
    }

    try {
        const conditions: any[] = [];
        if (status) {
            conditions.push(where('status', '==', status));
        }

        const q = query(
            collection(db, `tenants/${tenantId}/branches/${branchId}/adminTasks`),
            ...conditions
        );

        const snapshot = await getDocs(q);
        const tasks: AdminTask[] = [];

        snapshot.forEach((doc) => {
            tasks.push({
                id: doc.id,
                ...doc.data()
            } as AdminTask);
        });

        return tasks;
    } catch (error: any) {
        logger.error('Error getting admin tasks', error, 'adminTasksService');
        return [];
    }
};
