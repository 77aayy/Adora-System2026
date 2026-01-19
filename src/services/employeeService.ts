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
    QueryConstraint,
    DocumentSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

// NOTE: Using flat 'users' collection for backward compatibility
// TODO: Migrate to hotels/{hotelId}/branches/{branchId}/employees structure
const USERS_COLLECTION = 'users';

/**
 * Convert Firestore document to User
 * ✅ Type-safe: Uses DocumentSnapshot type from Firestore
 */
const mapDocToUser = (doc: DocumentSnapshot): User => {
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
 * 
 * ✅ SaaS: Uses tenant-scoped collection (tenants/{tenantId}/employees) with fallback to users collection
 */
export const getEmployees = async (
    tenantId?: string,
    branchId?: string,
    maxResults: number = 50 // ⚡ Limit results
): Promise<User[]> => {
    if (!tenantId) {
        // ⚠️ Fallback: If no tenantId, use legacy users collection
        const usersRef = collection(db, USERS_COLLECTION);
        const constraints: QueryConstraint[] = [];
        if (branchId) constraints.push(where('branches', 'array-contains', branchId));
        constraints.push(orderBy('department'));
        constraints.push(limit(maxResults));
        
        const q = query(usersRef, ...constraints);
        const snapshot = await getDocs(q);
        const users = snapshot.docs.map(mapDocToUser);
        
        users.sort((a, b) => {
            if (a.department !== b.department) {
                return a.department.localeCompare(b.department);
            }
            return a.name.localeCompare(b.name);
        });
        
        return users;
    }

    const { cachedFetch } = await import('../utils/requestCache');
    const cacheKey = `employees:${tenantId}:${branchId || 'all'}`;
    
    return cachedFetch<User[]>(
        cacheKey,
        async () => {
            // ✅ SaaS: Try tenant-scoped collection first (tenants/{tenantId}/employees)
            try {
                const employeesRef = collection(db, `tenants/${tenantId}/employees`);
                const constraints: QueryConstraint[] = [];
                if (branchId) constraints.push(where('branchId', '==', branchId));
                constraints.push(where('status', '==', 'active'));
                constraints.push(orderBy('name', 'asc'));
                constraints.push(limit(maxResults));
                
                const q = query(employeesRef, ...constraints);
                const snapshot = await getDocs(q);
                
                // Map to User format
                const users = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        name: data.name || '',
                        code: data.code || '',
                        department: data.department || '',
                        role: data.role || 'employee',
                        points: data.lifetimePoints || data.currentPoints || data.points || 0,
                        status: data.status || 'active',
                        branches: data.branchId ? [data.branchId] : [],
                        branch: data.branchId || '',
                        tenantId: tenantId
                    } as User;
                });
                
                // If found in tenant-scoped collection, return
                if (users.length > 0) {
                    return users;
                }
            } catch (error) {
                console.warn('Failed to fetch from tenant-scoped employees collection, falling back to users:', error);
            }
            
            // ✅ Fallback: Use legacy users collection (backward compatibility)
            const usersRef = collection(db, USERS_COLLECTION);
            const constraints: QueryConstraint[] = [];
            constraints.push(where('tenantId', '==', tenantId));
            if (branchId) constraints.push(where('branches', 'array-contains', branchId));
            constraints.push(orderBy('department'));
            constraints.push(limit(maxResults));
            
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
 * 
 * ✅ SaaS: Uses tenant-scoped collection (tenants/{tenantId}/employees) with fallback to users collection
 */
export const subscribeToEmployees = (
    callback: (users: User[]) => void,
    tenantId?: string,
    branchId?: string,
    maxResults: number = 50 // ⚡ Added limit
): Unsubscribe => {
    // ✅ SaaS: Try tenant-scoped collection first if tenantId provided
    if (tenantId) {
        try {
            const employeesRef = collection(db, `tenants/${tenantId}/employees`);
            const constraints: QueryConstraint[] = [];
            if (branchId) constraints.push(where('branchId', '==', branchId));
            constraints.push(where('status', '==', 'active'));
            constraints.push(orderBy('name', 'asc'));
            constraints.push(limit(maxResults));

            const q = query(employeesRef, ...constraints);

            return onSnapshot(q, (snapshot) => {
                // Map to User format
                const users = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        name: data.name || '',
                        code: data.code || '',
                        department: data.department || '',
                        role: data.role || 'employee',
                        points: data.lifetimePoints || data.currentPoints || data.points || 0,
                        status: data.status || 'active',
                        branches: data.branchId ? [data.branchId] : [],
                        branch: data.branchId || '',
                        tenantId: tenantId
                    } as User;
                });

                // Client-side sort
                users.sort((a, b) => {
                    if (a.department !== b.department) {
                        return a.department.localeCompare(b.department);
                    }
                    return a.name.localeCompare(b.name);
                });

                callback(users);
            }, (error) => {
                console.warn('Error subscribing to tenant-scoped employees, falling back to users:', error);
                // Fallback to users collection
                return subscribeToEmployeesLegacy(callback, tenantId, branchId, maxResults);
            });
        } catch (error) {
            console.warn('Failed to subscribe to tenant-scoped employees, falling back to users:', error);
            // Fallback to users collection
            return subscribeToEmployeesLegacy(callback, tenantId, branchId, maxResults);
        }
    }

    // ✅ Fallback: Use legacy users collection
    return subscribeToEmployeesLegacy(callback, tenantId, branchId, maxResults);
};

/**
 * Legacy subscription to users collection (backward compatibility)
 */
const subscribeToEmployeesLegacy = (
    callback: (users: User[]) => void,
    tenantId?: string,
    branchId?: string,
    maxResults: number = 50
): Unsubscribe => {
    const usersRef = collection(db, USERS_COLLECTION);

    let constraints: any[] = [];
    if (tenantId) constraints.push(where('tenantId', '==', tenantId));
    if (branchId) constraints.push(where('branches', 'array-contains', branchId));
    constraints.push(orderBy('department'));
    constraints.push(limit(maxResults));

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
        const data = doc.data();
        // ✅ Type-safe: Get department from data (may be undefined)
        const dept = (data.department as string) || 'unknown';
        stats[dept] = (stats[dept] || 0) + 1;
    });

    return stats;
};
