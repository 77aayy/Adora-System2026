/**
 * Tenant-Scoped Hooks
 * Hooks that automatically scope data queries to current tenant
 * Adora Hotel Management System V3
 */

import { useState, useEffect, useRef } from 'react';
import {
    collection,
    query,
    onSnapshot,
    QueryConstraint,
    CollectionReference,
    getDocs,
    where
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useRequireTenant, useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { Employee, Team, TenantRoom, TenantRequest } from '../types/tenant';
import { Branch } from '../types'; // ✅ Use GLOBAL Branch type

/**
 * Get tenant-scoped collection reference
 */
export function useTenantCollection(subcollection: string): CollectionReference | null {
    const { tenantId } = useRequireTenant();
    if (!db) return null;
    return collection(db, `tenants/${tenantId}/${subcollection}`);
}

/**
 * Subscribe to tenant employees
 */
export function useTenantEmployees(constraints: QueryConstraint[] = []) {
    const { tenantId } = useRequireTenant();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenantId || !db) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, `tenants/${tenantId}/employees`),
            ...constraints
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: Employee[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Employee));
            setEmployees(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantId, ...constraints]);

    return { employees, loading };
}

/**
 * Subscribe to tenant teams
 */
export function useTenantTeams(constraints: QueryConstraint[] = []) {
    const { tenantId } = useRequireTenant();
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenantId || !db) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, `tenants/${tenantId}/teams`),
            ...constraints
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: Team[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Team));
            setTeams(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantId, ...constraints]);

    return { teams, loading };
}

/**
 * Subscribe to tenant branches
 */
/**
 * Subscribe to tenant branches
 * ✅ FIX: Filter out deleted branches and ensure isolation per tenant
 */
export function useTenantBranches() {
    const { tenantId } = useTenant(); // ✅ Changed from useRequireTenant to useTenant (Safe)
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenantId || !db) {
            setBranches([]); // ✅ Clear branches if no tenantId or db
            setLoading(false);
            return;
        }

        // ✅ FIX: Only load branches for the current tenant (SaaS isolation)
        const q = collection(db, `tenants/${tenantId}/branches`);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: Branch[] = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Branch))
                // ✅ FIX: Filter out deleted/scheduled/inactive branches (SaaS Dynamic)
                .filter(branch => 
                    branch.status !== 'scheduled_for_deletion' && 
                    branch.status !== 'deleted' && 
                    branch.status !== 'inactive'
                );
            
            // ✅ FIX: Sort by creation date (newest first) or by code
            data.sort((a, b) => {
                const aCode = (a as any).code || '';
                const bCode = (b as any).code || '';
                return aCode.localeCompare(bCode);
            });
            
            setBranches(data);
            setLoading(false);
        }, (error) => {
            console.error('Error loading branches:', error);
            setBranches([]); // ✅ Clear branches on error
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantId]); // ✅ Only reload when tenantId changes

    return { branches, loading };
}

/**
 * Subscribe to tenant rooms
 */
export function useTenantRooms(constraints: QueryConstraint[] = []) {
    const { tenantId } = useRequireTenant();
    const [rooms, setRooms] = useState<TenantRoom[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenantId || !db) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, `tenants/${tenantId}/rooms`),
            ...constraints
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: TenantRoom[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TenantRoom));
            setRooms(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantId, ...constraints]);

    return { rooms, loading };
}

/**
 * Subscribe to tenant requests
 */
export function useTenantRequests(constraints: QueryConstraint[] = []) {
    const { tenantId } = useRequireTenant();
    const [requests, setRequests] = useState<TenantRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenantId || !db) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, `tenants/${tenantId}/requests`),
            ...constraints
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: TenantRequest[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TenantRequest));
            setRequests(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantId, ...constraints]);

    return { requests, loading };
}

/**
 * Subscribe to all branches from all managers (Owner only) - Fully Dynamic SaaS
 * Returns all branches from all managers under the owner (Real-time)
 * Each branch includes manager information for context
 */
export function useAllBranchesForOwner() {
    const { user } = useAuth();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [managersMap, setManagersMap] = useState<Map<string, { id: string; name: string; tenantId: string }>>(new Map());

    // Step 1: Subscribe to all managers dynamically (Real-time)
    const managersSubscriptionRef = useRef<(() => void) | null>(null);
    const userIdRef = useRef<string | null>(null);
    
    useEffect(() => {
        if (!user || user.role !== 'owner') {
            setBranches([]);
            setLoading(false);
            setManagersMap(new Map());
            userIdRef.current = null;
            if (managersSubscriptionRef.current) {
                managersSubscriptionRef.current();
                managersSubscriptionRef.current = null;
            }
            return;
        }
        
        // ✅ CRITICAL FIX: Only create subscription if user ID changed or no subscription exists
        if (userIdRef.current === user.id && managersSubscriptionRef.current) {
            return;
        }
        
        userIdRef.current = user.id;

        // ✅ Guard: Check if Firebase is initialized
        if (!db) {
            console.debug('Firebase not initialized, skipping owner branches load');
            setLoading(false);
            return;
        }

        const managersRef = collection(db, 'users');
        // ✅ FIX: Only get managers (status filtering done in JS for more flexibility)
        const q = query(managersRef, where('role', '==', 'manager'));
        
        const unsubscribeManagers = onSnapshot(
            q, 
            (snapshot) => {
                // ✅ Dynamic: Build managers map with all manager info
                const newManagersMap = new Map<string, { id: string; name: string; tenantId: string }>();
                
                snapshot.docs.forEach(doc => {
                    const managerData = doc.data();
                    const tenantId = managerData.tenantId;
                    const managerName = managerData.name || 'مدير غير معروف';
                    const managerStatus = managerData.status || 'active';
                    const isDeleted = managerData.isDeleted === true;
                    const deletedAt = managerData.deletedAt;
                    const isDemo = managerData.isDemo === true; // ✅ Check if manager is demo
                    
                    // ✅ FIX: Skip deleted, suspended, or inactive managers for accurate stats
                    // Only count ACTIVE managers with valid licenses
                    if (isDeleted || deletedAt) {
                        return; // Skip soft-deleted managers
                    }
                    if (managerStatus === 'suspended' || managerStatus === 'inactive' || managerStatus === 'expired') {
                        return; // Skip suspended/inactive/expired managers
                    }
                    // ✅ Skip demo managers - their branches shouldn't be counted
                    if (isDemo) {
                        return; // Skip demo managers
                    }
                    
                    // ✅ Only include managers with valid tenantId
                    if (tenantId && typeof tenantId === 'string' && tenantId.trim()) {
                        newManagersMap.set(tenantId, {
                            id: doc.id,
                        name: managerName,
                        tenantId: tenantId.trim()
                    });
                }
            });
            
            // ✅ CRITICAL FIX: Only update if content actually changed
            // Check if sizes are different OR if any tenantId is different
            let hasChanged = newManagersMap.size !== managersMap.size;
            if (!hasChanged && newManagersMap.size > 0) {
                // Check if any tenantId is different
                for (const [tenantId] of newManagersMap) {
                    if (!managersMap.has(tenantId)) {
                        hasChanged = true;
                        break;
                    }
                }
                if (!hasChanged) {
                    // Check if any tenantId was removed
                    for (const [tenantId] of managersMap) {
                        if (!newManagersMap.has(tenantId)) {
                            hasChanged = true;
                            break;
                        }
                    }
                }
            }
            
            if (hasChanged) {
                setManagersMap(newManagersMap);
            }
        }, (error) => {
            console.error('Error loading managers:', error);
            setManagersMap(new Map());
        });
        
        managersSubscriptionRef.current = unsubscribeManagers;

        return () => {
            if (managersSubscriptionRef.current) {
                managersSubscriptionRef.current();
                managersSubscriptionRef.current = null;
            }
        };
    }, [user]);

    // Step 2: Subscribe to branches from all manager tenants dynamically (Real-time)
    const previousManagersSizeRef = useRef<number>(0);
    const subscriptionsActiveRef = useRef<boolean>(false);
    
    useEffect(() => {
        
        if (!user || user.role !== 'owner') {
            return;
        }
        
        // ✅ If managersMap is empty, just set loading to false and return
        if (managersMap.size === 0) {
            if (previousManagersSizeRef.current === 0) {
                // Still initializing, don't do anything
                setBranches([]);
                setLoading(false);
            }
            previousManagersSizeRef.current = 0;
            return;
        }
        
        // ✅ CRITICAL FIX: Only create subscriptions if:
        // 1. Previous size was 0 (initial load) OR
        // 2. Size actually changed AND subscriptions are not already active
        const sizeChanged = managersMap.size !== previousManagersSizeRef.current;
        const isInitialLoad = previousManagersSizeRef.current === 0 && managersMap.size > 0;
        
        if (!isInitialLoad && !sizeChanged) {
            return; // No change, don't recreate subscriptions
        }
        
        if (subscriptionsActiveRef.current && !isInitialLoad) {
            previousManagersSizeRef.current = managersMap.size;
            return; // Subscriptions already active, don't recreate
        }

        // ✅ Prevent re-subscription if already subscribed
        let isSubscribed = true;
        subscriptionsActiveRef.current = true;
        previousManagersSizeRef.current = managersMap.size;
        const unsubscribes: (() => void)[] = [];
        const allBranchesMap = new Map<string, Branch & { managerId?: string; managerName?: string; tenantId?: string }>();

        // ✅ Dynamic: Subscribe to branches from each tenant
        managersMap.forEach((managerInfo, tenantId) => {
            // ✅ Safe: Validate tenantId and db before using
            if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim() || !db) {
                return;
            }

            const branchesRef = collection(db, 'tenants', tenantId.trim(), 'branches');
            
            const unsubscribe = onSnapshot(
                branchesRef, 
                (snapshot) => {
                    // ✅ Dynamic: Remove old branches from this tenant
                    allBranchesMap.forEach((branch, key) => {
                        if ((branch as any).tenantId === tenantId) {
                            allBranchesMap.delete(key);
                        }
                    });

                    // ✅ Dynamic: Add new/updated branches from this tenant
                    snapshot.docs.forEach(branchDoc => {
                        const branchData = branchDoc.data();
                        
                        // ✅ Filter out deleted/scheduled branches
                        if (branchData.status === 'scheduled_for_deletion' || branchData.status === 'deleted') {
                            return;
                        }
                        
                        // ✅ Filter out demo branches
                        if (branchData.isDemo === true) {
                            return; // Skip demo branches
                        }

                        // ✅ Build branch with manager context
                        const branchKey = `${tenantId}_${branchDoc.id}`;
                        allBranchesMap.set(branchKey, {
                            id: branchDoc.id,
                            ...branchData,
                            tenantId: tenantId,
                            managerId: managerInfo.id,
                            managerName: managerInfo.name
                        } as Branch & { managerId: string; managerName: string; tenantId: string });
                    });

                    // ✅ Dynamic: Convert map to array and sort
                    // ✅ Only update if still subscribed (prevent state updates after unmount)
                    if (!isSubscribed) return;
                    
                    const allBranches = Array.from(allBranchesMap.values());
                    allBranches.sort((a, b) => {
                        const aCode = (a as any).code || '';
                        const bCode = (b as any).code || '';
                        return aCode.localeCompare(bCode);
                    });

                    setBranches(allBranches);
                    setLoading(false);
                }, 
                (error: any) => {
                    // ✅ Handle quota errors gracefully - don't spam console
                    if (error?.code === 'resource-exhausted' || error?.code === 'resource_exhausted') {
                        console.warn(`⚠️ Quota exceeded for tenant ${tenantId} branches - skipping`);
                        // ✅ Set loading to false even on quota error to prevent infinite loading
                        setLoading(false);
                    } else {
                        console.error(`Error loading branches for tenant ${tenantId}:`, error);
                        // ✅ Don't set loading to false on error - other tenants might still be loading
                    }
                }
            );

            unsubscribes.push(unsubscribe);
        });

        return () => {
            isSubscribed = false; // ✅ Mark as unsubscribed
            subscriptionsActiveRef.current = false; // ✅ Mark subscriptions as inactive
            unsubscribes.forEach(unsub => unsub());
        };
    }, [user, managersMap.size]); // ✅ Only depend on size, not the map itself

    return { branches, loading };
}

/**
 * Main hook to get current tenant data
 */
export function useTenantData() {
    const { tenantId, tenantInfo } = useTenant();

    return {
        tenantId,
        activeTenant: tenantInfo  // ✅ Fixed: Return tenantInfo as activeTenant
    };
}
