/**
 * Employee Service
 * Manages employee/user data for admin
 * Adora Hotel Management System V2
 */

import {
    collection,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    limit,
    Unsubscribe,
    getDocs,
    writeBatch,
    where,
} from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

// NOTE: Using flat 'users' collection for backward compatibility
// TODO: Migrate to hotels/{hotelId}/branches/{branchId}/employees structure
const USERS_COLLECTION = 'users';

/**
 * Convert Firestore document to User
 */
const mapDocToUser = (doc: any): User => {
    const data = doc.data();
    return {
        id: doc.id,
        name: data.name,
        code: data.code,
        department: data.department,
        role: data.role,
        points: data.points || 0,
        status: data.status || 'active',
        branches: data.branches || [], // ✅ FIX: Map branches
        branch: data.branch || '',     // ✅ FIX: Map branch
    } as User;
};

/**
 * ⚡ PERFORMANCE: Fetch employees ONE TIME (preferred for lists)
 * Use this instead of subscribeToEmployees for better performance
 */
export const getEmployees = async (
    tenantId?: string,
    branchId?: string,
    maxResults: number = 50 // ⚡ Limit results
): Promise<User[]> => {
    const { cachedFetch } = await import('../utils/requestCache');
    const cacheKey = `employees:${tenantId || 'all'}:${branchId || 'all'}`;
    
    return cachedFetch<User[]>(
        cacheKey,
        async () => {
            const usersRef = collection(db, USERS_COLLECTION);
            let constraints: any[] = [];
            
            if (tenantId) constraints.push(where('tenantId', '==', tenantId));
            if (branchId) constraints.push(where('branches', 'array-contains', branchId));
            constraints.push(orderBy('department'));
            constraints.push(limit(maxResults)); // ⚡ LIMIT
            
            const q = query(usersRef, ...constraints);
            const snapshot = await getDocs(q);
            
            const users = snapshot.docs.map(mapDocToUser);
            
            // Client-side sort
            users.sort((a, b) => {
                if (a.department !== b.department) {
                    return a.department.localeCompare(b.department);
                }
                return a.name.localeCompare(b.name);
            });
            
            return users;
        },
        { ttl: 30 * 1000 } // 30 second cache
    );
};

/**
 * Subscribe to employees (real-time) - USE SPARINGLY
 * ⚠️ PERFORMANCE: Only use when real-time updates are critical
 * Prefer getEmployees() for most use cases
 */
export const subscribeToEmployees = (
    callback: (users: User[]) => void,
    tenantId?: string,
    branchId?: string,
    maxResults: number = 50 // ⚡ Added limit
): Unsubscribe => {
    const usersRef = collection(db, USERS_COLLECTION);

    let constraints: any[] = [];
    if (tenantId) constraints.push(where('tenantId', '==', tenantId));
    if (branchId) constraints.push(where('branches', 'array-contains', branchId));
    constraints.push(orderBy('department'));
    constraints.push(limit(maxResults)); // ⚡ LIMIT to prevent loading all employees

    const q = query(usersRef, ...constraints);

    return onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(mapDocToUser);

        // Client-side sort by name within department
        users.sort((a, b) => {
            if (a.department !== b.department) {
                return a.department.localeCompare(b.department);
            }
            return a.name.localeCompare(b.name);
        });

        callback(users);
    }, (error) => {
        console.error('Error fetching employees:', error);
    });
};

/**
 * Add employee
 */
export const addEmployee = async (employee: User): Promise<void> => {
    const userRef = doc(db, USERS_COLLECTION, employee.id);
    await setDoc(userRef, employee);
};

/**
 * Update employee
 */
export const updateEmployee = async (userId: string, updates: Partial<User>): Promise<void> => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, updates);
};

/**
 * Delete employee
 */
export const deleteEmployee = async (userId: string): Promise<void> => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await deleteDoc(userRef);
};

/**
 * Reset employee points
 */
export const resetEmployeePoints = async (userId: string): Promise<void> => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, { points: 0 });
};

/**
 * Reset all employees points
 */
export const resetAllPoints = async (): Promise<void> => {
    const usersRef = collection(db, USERS_COLLECTION);
    const snapshot = await getDocs(usersRef);
    const batch = writeBatch(db);

    snapshot.forEach((doc) => {
        batch.update(doc.ref, { points: 0 });
    });

    await batch.commit();
};

/**
 * Generate unique PIN code
 * ✅ Enhanced: Checks across ALL collections (globalCodes + users) for complete uniqueness
 */
export const generatePinCode = async (): Promise<string> => {
    // Import from ownerService to avoid circular dependency
    const { suggestUniquePin } = await import('./ownerService');
    return await suggestUniquePin();
};

/**
 * Get employee stats by department
 */
export const getEmployeeStats = async (tenantId: string): Promise<Record<string, number>> => {
    if (!tenantId) {
        console.error("CRITICAL: getEmployeeStats called without tenantId");
        return {};
    }
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('tenantId', '==', tenantId));

    const snapshot = await getDocs(q);

    const stats: Record<string, number> = {};

    snapshot.forEach((doc) => {
        const data = doc.data() as any;
        const dept = data.department;
        stats[dept] = (stats[dept] || 0) + 1;
    });

    return stats;
};
