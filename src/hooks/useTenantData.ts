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
import { logger } from '../services/loggerService';
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

        let unsubscribe: (() => void) | null = null;
        
        try {
            unsubscribe = onSnapshot(q, (snapshot) => {
                const data: Employee[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Employee));
                setEmployees(data);
                setLoading(false);
            }, (error: any) => {
                const isChannelError = error?.code === 400 || error?.code === 404 || error?.message?.includes('400') || error?.message?.includes('Listen/channel');
                if (isChannelError) {
                    logger.debug('Employees Listen channel error, fallback getDocs', undefined, 'useTenantData');
                    getDocs(q).then((snap) => {
                        const data: Employee[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
                        setEmployees(data);
                        setLoading(false);
                    }).catch(() => { setEmployees([]); setLoading(false); });
                    return;
                }
                if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
                    console.warn('Firestore internal error in employees subscription (likely cache issue)', error);
                } else {
                    console.error('Error loading employees:', error);
                }
                setEmployees([]);
                setLoading(false);
            });
        } catch (error) {
            console.error('Error setting up employees subscription:', error);
            setLoading(false);
        }

        return () => {
            if (unsubscribe) {
                try {
                    unsubscribe();
                } catch (error) {
                    console.warn('Error cleaning up employees subscription:', error);
                }
            }
        };
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

        let unsubscribe: (() => void) | null = null;
        
        try {
            unsubscribe = onSnapshot(q, (snapshot) => {
                const data: Team[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Team));
                setTeams(data);
                setLoading(false);
            }, (error: any) => {
                const isChannelError = error?.code === 400 || error?.code === 404 || error?.message?.includes('400') || error?.message?.includes('Listen/channel');
                if (isChannelError) {
                    logger.debug('Teams Listen channel error, fallback getDocs', undefined, 'useTenantData');
                    getDocs(q).then((snap) => {
                        const data: Team[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
                        setTeams(data);
                        setLoading(false);
                    }).catch(() => { setTeams([]); setLoading(false); });
                    return;
                }
                if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
                    console.warn('Firestore internal error in teams subscription (likely cache issue)', error);
                } else {
                    console.error('Error loading teams:', error);
                }
                setTeams([]);
                setLoading(false);
            });
        } catch (error) {
            console.error('Error setting up teams subscription:', error);
            setLoading(false);
        }

        return () => {
            if (unsubscribe) {
                try {
                    unsubscribe();
                } catch (error) {
                    console.warn('Error cleaning up teams subscription:', error);
                }
            }
        };
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

    // ✅ NO onSnapshot: use getDocs + poll to avoid Listen/channel 400 Bad Request
    const POLL_MS = 45000;
    useEffect(() => {
        if (!tenantId || !db) {
            setBranches([]);
            setLoading(false);
            return;
        }

        const branchesCollection = collection(db, 'tenants', tenantId, 'branches');

        const fetch = () => {
            getDocs(branchesCollection)
                .then((snap) => {
                    const data: Branch[] = snap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() } as Branch))
                        .filter((b: any) => b.status !== 'scheduled_for_deletion' && b.status !== 'deleted' && b.status !== 'inactive');
                    data.sort((a, b) => ((a as any).code || '').localeCompare((b as any).code || ''));
                    setBranches(data);
                    setLoading(false);
                })
                .catch((err) => {
                    if (err?.code === 400 || err?.message?.includes('400') || err?.message?.includes('Listen')) {
                        logger.debug('Branches getDocs 400, using empty list', undefined, 'useTenantData');
                    }
                    setBranches([]);
                    setLoading(false);
                });
        };

        try {
            fetch();
        } catch (e) {
            setBranches([]);
            setLoading(false);
        }
        const interval = setInterval(fetch, POLL_MS);
        const onFocus = () => fetch();
        window.addEventListener('focus', onFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [tenantId]);

    return { branches, loading };
}

/**
 * Subscribe to tenant rooms
 * ✅ FIX: Use useTenant() instead of useRequireTenant() to handle cases where tenantId might not be set (e.g., owner)
 */
export function useTenantRooms(constraints: QueryConstraint[] = []) {
    const { tenantId } = useTenant(); // ✅ Changed from useRequireTenant to useTenant (Safe)
    const [rooms, setRooms] = useState<TenantRoom[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenantId || !db) {
            setRooms([]); // ✅ Clear rooms if no tenantId or db
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, `tenants/${tenantId}/rooms`),
            ...constraints
        );

        let unsubscribe: (() => void) | null = null;
        
        try {
            unsubscribe = onSnapshot(q, (snapshot) => {
                const data: TenantRoom[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as TenantRoom));
                setRooms(data);
                setLoading(false);
            }, (error: any) => {
                const isChannelError = error?.code === 400 || error?.code === 404 || error?.message?.includes('400') || error?.message?.includes('Listen/channel');
                if (isChannelError) {
                    logger.debug('Rooms Listen channel error, fallback getDocs', undefined, 'useTenantData');
                    getDocs(q).then((snap) => {
                        const data: TenantRoom[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TenantRoom));
                        setRooms(data);
                        setLoading(false);
                    }).catch(() => { setRooms([]); setLoading(false); });
                    return;
                }
                if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
                    console.warn('Firestore internal error in rooms subscription (likely cache issue)', error);
                } else {
                    console.error('Error loading rooms:', error);
                }
                setRooms([]);
                setLoading(false);
            });
        } catch (error) {
            console.error('Error setting up rooms subscription:', error);
            setRooms([]);
            setLoading(false);
        }

        return () => {
            if (unsubscribe) {
                try {
                    unsubscribe();
                } catch (error) {
                    console.warn('Error cleaning up rooms subscription:', error);
                }
            }
        };
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

        let unsubscribe: (() => void) | null = null;
        
        try {
            unsubscribe = onSnapshot(q, (snapshot) => {
                const data: TenantRequest[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as TenantRequest));
                setRequests(data);
                setLoading(false);
            }, (error: any) => {
                const isChannelError = error?.code === 400 || error?.code === 404 || error?.message?.includes('400') || error?.message?.includes('Listen/channel');
                if (isChannelError) {
                    logger.debug('Requests Listen channel error, fallback getDocs', undefined, 'useTenantData');
                    getDocs(q).then((snap) => {
                        const data: TenantRequest[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TenantRequest));
                        setRequests(data);
                        setLoading(false);
                    }).catch(() => { setRequests([]); setLoading(false); });
                    return;
                }
                if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
                    console.warn('Firestore internal error in requests subscription (likely cache issue)', error);
                } else {
                    console.error('Error loading requests:', error);
                }
                setRequests([]);
                setLoading(false);
            });
        } catch (error) {
            console.error('Error setting up requests subscription:', error);
            setLoading(false);
        }

        return () => {
            if (unsubscribe) {
                try {
                    unsubscribe();
                } catch (error) {
                    console.warn('Error cleaning up requests subscription:', error);
                }
            }
        };
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

    // Step 1: Load managers via getDocs + poll (no onSnapshot → avoids Listen/channel 400)
    const POLL_MANAGERS_MS = 45000;
    useEffect(() => {
        if (!user || user.role !== 'owner') {
            setBranches([]);
            setLoading(false);
            setManagersMap(new Map());
            return;
        }
        if (!db) {
            setLoading(false);
            return;
        }
        const q = query(collection(db, 'users'), where('role', '==', 'manager'));
        const fetchManagers = () => {
            getDocs(q)
                .then((snap) => {
                    const newMap = new Map<string, { id: string; name: string; tenantId: string }>();
                    snap.docs.forEach(doc => {
                        const d = doc.data();
                        const tenantId = d.tenantId;
                        if (tenantId && typeof tenantId === 'string' && tenantId.trim() && d.isDeleted !== true && !d.deletedAt && d.status !== 'suspended' && d.status !== 'inactive' && d.status !== 'expired' && !d.isDemo) {
                            newMap.set(tenantId.trim(), { id: doc.id, name: d.name || 'مدير غير معروف', tenantId: tenantId.trim() });
                        }
                    });
                    setManagersMap(newMap);
                })
                .catch(() => setManagersMap(new Map()));
        };
        fetchManagers();
        const interval = setInterval(fetchManagers, POLL_MANAGERS_MS);
        const onFocus = () => fetchManagers();
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [user]);

    // Step 2: Load branches via getDocs (no onSnapshot → avoids Listen/channel 400)
    const POLL_BRANCHES_MS = 45000;
    useEffect(() => {
        if (!user || user.role !== 'owner' || !db) return;
        if (managersMap.size === 0) {
            setBranches([]);
            setLoading(false);
            return;
        }

        const fetchAllBranches = () => {
            const allBranchesMap = new Map<string, Branch & { managerId?: string; managerName?: string; tenantId?: string }>();
            const promises: Promise<void>[] = [];
            managersMap.forEach((managerInfo, tenantId) => {
                if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) return;
                const ref = collection(db, 'tenants', tenantId.trim(), 'branches');
                promises.push(
                    getDocs(ref)
                        .then((snap) => {
                            snap.docs.forEach(branchDoc => {
                                const branchData = branchDoc.data();
                                if (branchData.status === 'scheduled_for_deletion' || branchData.status === 'deleted' || branchData.isDemo === true) return;
                                const key = `${tenantId}_${branchDoc.id}`;
                                allBranchesMap.set(key, {
                                    id: branchDoc.id,
                                    ...branchData,
                                    tenantId,
                                    managerId: managerInfo.id,
                                    managerName: managerInfo.name
                                } as Branch & { managerId: string; managerName: string; tenantId: string });
                            });
                        })
                        .catch(() => { /* skip tenant on permission/error */ })
                );
            });
            Promise.all(promises).then(() => {
                const allBranches = Array.from(allBranchesMap.values());
                allBranches.sort((a, b) => ((a as any).code || '').localeCompare((b as any).code || ''));
                setBranches(allBranches);
                setLoading(false);
            }).catch(() => {
                setBranches([]);
                setLoading(false);
            });
        };

        try {
            fetchAllBranches();
        } catch {
            setBranches([]);
            setLoading(false);
        }
        const interval = setInterval(fetchAllBranches, POLL_BRANCHES_MS);
        const onFocus = () => fetchAllBranches();
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [user, managersMap.size]);

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
