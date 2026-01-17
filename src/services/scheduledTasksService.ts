/**
 * Scheduled Tasks Service
 * Handles all scheduled task CRUD operations
 * ✅ Architecture: All Firebase operations isolated in services
 * ✅ SaaS: Tenant-scoped scheduled tasks
 */

import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, Timestamp, serverTimestamp, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type TaskFrequency = 'once' | 'daily' | 'weekly' | 'monthly';
export type TaskDepartment = 'housekeeping' | 'maintenance' | 'reception' | 'bellman' | 'procurement';

export interface ScheduledTask {
    id: string;
    title: string;
    description?: string;
    department: TaskDepartment;
    frequency: TaskFrequency;
    scheduledFor: any; // Timestamp
    nextRun: any; // Timestamp (for recurring)
    branchId: string;
    tenantId: string;
    createdBy: string;
    createdAt: any;
    status: 'active' | 'completed' | 'cancelled';
    targetId?: string; // Room number or specific target
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Subscribe to scheduled tasks for a branch
 * ✅ Null Safety: Checks db before operations
 */
export const subscribeToScheduledTasks = (
    branchId: string,
    tenantId: string,
    callback: (tasks: ScheduledTask[]) => void
): Unsubscribe | null => {
    // ✅ Null Safety: Check db
    if (!db) {
        logger.error('Cannot subscribe to scheduled tasks', new Error('Database not initialized'), 'scheduledTasksService');
        callback([]);
        return null;
    }

    // ✅ SaaS: Validate tenantId and branchId
    if (!tenantId || !branchId) {
        logger.warn('Cannot subscribe to scheduled tasks: Missing tenantId or branchId', null, 'scheduledTasksService');
        callback([]);
        return null;
    }

    try {
        // ✅ SaaS: Tenant-scoped query
        const q = query(
            collection(db, 'scheduled_tasks'),
            where('tenantId', '==', tenantId),
            where('branchId', '==', branchId),
            where('status', '==', 'active')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const tasks: ScheduledTask[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as ScheduledTask));

                // Sort client-side by nextRun date
                tasks.sort((a, b) => {
                    const dateA = a.nextRun?.toDate ? a.nextRun.toDate() : new Date();
                    const dateB = b.nextRun?.toDate ? b.nextRun.toDate() : new Date();
                    return dateA.getTime() - dateB.getTime();
                });

                callback(tasks);
            },
            (error) => {
                logger.error('Error in scheduled tasks subscription', error, 'scheduledTasksService');
                callback([]);
            }
        );

        return unsubscribe;
    } catch (error: any) {
        logger.error('Error subscribing to scheduled tasks', error, 'scheduledTasksService');
        callback([]);
        return null;
    }
};

/**
 * Create a new scheduled task
 * ✅ Null Safety: Checks db before operations
 */
export const createScheduledTask = async (
    task: Omit<ScheduledTask, 'id' | 'createdAt' | 'status'>
): Promise<{ success: boolean; taskId?: string; error?: string }> => {
    // ✅ Null Safety: Check db
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Cannot create scheduled task', new Error(error), 'scheduledTasksService');
        return { success: false, error };
    }

    // ✅ SaaS: Validate tenantId and branchId
    if (!task.tenantId || !task.branchId) {
        const error = 'Tenant ID and Branch ID are required';
        logger.error('Cannot create scheduled task', new Error(error), 'scheduledTasksService');
        return { success: false, error };
    }

    try {
        // ✅ SaaS: Global collection with tenant isolation
        const docRef = await addDoc(collection(db, 'scheduled_tasks'), {
            ...task,
            status: 'active',
            createdAt: serverTimestamp()
        });

        logger.info('Scheduled task created successfully', { tenantId: task.tenantId, branchId: task.branchId, taskId: docRef.id }, 'scheduledTasksService');
        return { success: true, taskId: docRef.id };
    } catch (error: any) {
        logger.error('Error creating scheduled task', error, 'scheduledTasksService');
        return { success: false, error: error.message || 'Failed to create scheduled task' };
    }
};

/**
 * Update an existing scheduled task
 * ✅ Null Safety: Checks db before operations
 */
export const updateScheduledTask = async (
    taskId: string,
    updates: Partial<ScheduledTask>
): Promise<{ success: boolean; error?: string }> => {
    // ✅ Null Safety: Check db
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Cannot update scheduled task', new Error(error), 'scheduledTasksService');
        return { success: false, error };
    }

    // ✅ SaaS: Validate taskId
    if (!taskId) {
        const error = 'Task ID is required';
        logger.error('Cannot update scheduled task', new Error(error), 'scheduledTasksService');
        return { success: false, error };
    }

    try {
        // ✅ SaaS: Global collection
        await updateDoc(doc(db, 'scheduled_tasks', taskId), updates);

        logger.info('Scheduled task updated successfully', { taskId }, 'scheduledTasksService');
        return { success: true };
    } catch (error: any) {
        logger.error('Error updating scheduled task', error, 'scheduledTasksService');
        return { success: false, error: error.message || 'Failed to update scheduled task' };
    }
};

/**
 * Delete a scheduled task
 * ✅ Null Safety: Checks db before operations
 */
export const deleteScheduledTask = async (
    taskId: string
): Promise<{ success: boolean; error?: string }> => {
    // ✅ Null Safety: Check db
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Cannot delete scheduled task', new Error(error), 'scheduledTasksService');
        return { success: false, error };
    }

    // ✅ SaaS: Validate taskId
    if (!taskId) {
        const error = 'Task ID is required';
        logger.error('Cannot delete scheduled task', new Error(error), 'scheduledTasksService');
        return { success: false, error };
    }

    try {
        // ✅ SaaS: Global collection
        await deleteDoc(doc(db, 'scheduled_tasks', taskId));

        logger.info('Scheduled task deleted successfully', { taskId }, 'scheduledTasksService');
        return { success: true };
    } catch (error: any) {
        logger.error('Error deleting scheduled task', error, 'scheduledTasksService');
        return { success: false, error: error.message || 'Failed to delete scheduled task' };
    }
};
