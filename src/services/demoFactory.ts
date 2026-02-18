/**
 * Demo Factory Service
 * Creates isolated demo instances with pre-populated data
 * Adora Hotel Management System
 *
 * SECURITY: Demo instances are completely isolated via Firebase Security Rules
 *
 * SaaS/tenant: Demo may use root requests/rooms for isolated demo tenants; or use
 * tenants/${demoTenantId}/... for consistency. Document if root is intentional.
 */

/** @license Property of Ayman Ahmed - Adora Hotels Management System */
import { db, auth } from './firebase';
import {
    collection,
    doc,
    setDoc,
    addDoc,
    Timestamp,
    writeBatch,
    serverTimestamp,
    getDocs,
    query,
    where,
    deleteDoc
} from 'firebase/firestore';
import { signInAnonymously, signOut } from 'firebase/auth';
import { logger } from './loggerService';

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Generate a unique demo tenant ID using timestamp + random string
 * Format: demo-tenant-{timestamp}-{random}
 */
const generateUniqueDemoTenantId = (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `demo-tenant-${timestamp}-${random}`;
};

/**
 * Generate a unique demo branch ID
 */
const generateUniqueDemoBranchId = (tenantId: string): string => {
    return `demo-branch-${tenantId.split('-').pop()}`;
};

// ============================================================
// CONSTANTS (Now dynamic per instance)
// ============================================================

const DEMO_MANAGER_PIN = '9999'; // Hard-coded for demo access

// ============================================================
// TYPES
// ============================================================

export interface DemoInstance {
    branchId: string;
    tenantId: string;
    managerId: string;
    managerPin: string;
    createdAt: Date;
}

export interface DemoFactoryOptions {
    branchName?: string;
    tenantName?: string;
    populateData?: boolean;
    tenantId?: string; // Optional: Use existing tenant ID or generate new one
}

// ============================================================
// DEMO DATA TEMPLATES
// ============================================================

const DEMO_ROOMS = [
    { number: '101', floor: 1, type: 'standard', status: 'occupied' },
    { number: '102', floor: 1, type: 'standard', status: 'occupied' },
    { number: '103', floor: 1, type: 'standard', status: 'cleaning' },
    { number: '201', floor: 2, type: 'deluxe', status: 'occupied' },
    { number: '202', floor: 2, type: 'deluxe', status: 'occupied' },
    { number: '301', floor: 3, type: 'suite', status: 'occupied' },
    { number: '302', floor: 3, type: 'suite', status: 'maintenance' },
    { number: '401', floor: 4, type: 'presidential', status: 'occupied' },
];

const DEMO_EMPLOYEES = [
    { name: 'أحمد محمد', department: 'reception', role: 'employee', pin: '1001' },
    { name: 'فاطمة علي', department: 'housekeeping', role: 'employee', pin: '1002' },
    { name: 'خالد حسن', department: 'maintenance', role: 'employee', pin: '1003' },
    { name: 'سارة أحمد', department: 'bellman', role: 'employee', pin: '1004' },
];

const DEMO_REQUESTS = [
    {
        type: 'cleaning',
        status: 'PENDING_RECEPTION',
        roomNumber: '101',
        guestName: 'محمد السيد',
        priority: 'normal',
        notes: 'تنظيف الغرفة بعد المغادرة',
        createdAt: new Date(Date.now() - 30 * 60000), // 30 minutes ago
    },
    {
        type: 'maintenance',
        status: 'CONFIRMED',
        roomNumber: '302',
        guestName: 'علي محمود',
        priority: 'urgent',
        notes: 'مشكلة في التكييف',
        createdAt: new Date(Date.now() - 60 * 60000), // 1 hour ago
    },
    {
        type: 'bellman',
        status: 'IN_PROGRESS',
        roomNumber: '201',
        guestName: 'نورا أحمد',
        priority: 'normal',
        notes: 'مساعدة في نقل الأمتعة',
        createdAt: new Date(Date.now() - 15 * 60000), // 15 minutes ago
    },
    {
        type: 'coffee',
        status: 'CONFIRMED',
        roomNumber: '301',
        guestName: 'يوسف خالد',
        priority: 'normal',
        notes: 'طلب قهوة ووجبة خفيفة',
        createdAt: new Date(Date.now() - 10 * 60000), // 10 minutes ago
    },
    {
        type: 'cleaning',
        status: 'COMPLETED',
        roomNumber: '103',
        guestName: 'ليلى حسن',
        priority: 'normal',
        notes: 'تنظيف شامل',
        createdAt: new Date(Date.now() - 120 * 60000), // 2 hours ago
        completedAt: new Date(Date.now() - 60 * 60000), // 1 hour ago
    },
];

// ============================================================
// MAIN FACTORY FUNCTION
// ============================================================

/**
 * Create a new demo instance with unique IDs
 * This function creates:
 * 1. Demo Tenant (with unique ID)
 * 2. Demo Branch (with unique ID)
 * 3. Demo Manager User
 * 4. Demo Rooms (10 rooms with realistic data)
 * 5. Demo Employees (4 employees)
 * 6. Demo Requests (10 requests with various statuses)
 */
export const createDemoInstance = async (
    options: DemoFactoryOptions = {}
): Promise<DemoInstance> => {
    const {
        branchName = 'Demo Hotel Branch',
        tenantName = 'Demo Hotel',
        populateData = true,
        tenantId: providedTenantId
    } = options;

    // ✅ Generate unique IDs for fresh start
    const DEMO_TENANT_ID = providedTenantId || generateUniqueDemoTenantId();
    const DEMO_BRANCH_ID = generateUniqueDemoBranchId(DEMO_TENANT_ID);
    const DEMO_MANAGER_ID = `demo-manager-${DEMO_TENANT_ID.split('-').pop()}`;

    const batch = writeBatch(db);

    try {
        // 1. Create Demo Tenant
        const tenantRef = doc(db, 'tenants', DEMO_TENANT_ID);
        batch.set(tenantRef, {
            name: tenantName,
            createdAt: serverTimestamp(),
            isDemo: true,
            status: 'active'
        });

        // 2. Create Demo Branch
        const branchRef = doc(db, 'branches', DEMO_BRANCH_ID);
        batch.set(branchRef, {
            name: branchName,
            tenantId: DEMO_TENANT_ID,
            address: 'Demo Address, Demo City',
            phone: '+1234567890',
            email: 'demo@adora-hotels.com',
            createdAt: serverTimestamp(),
            isDemo: true,
            status: 'active'
        });

        // 3. Create Demo Manager User
        const managerRef = doc(db, 'employees', DEMO_MANAGER_ID);
        batch.set(managerRef, {
            id: DEMO_MANAGER_ID,
            name: 'Demo Manager',
            pin: DEMO_MANAGER_PIN,
            role: 'manager',
            department: 'reception',
            tenantId: DEMO_TENANT_ID,
            branchId: DEMO_BRANCH_ID,
            availableBranches: [{ id: DEMO_BRANCH_ID, name: branchName }],
            preferredBranchId: DEMO_BRANCH_ID,
            createdAt: serverTimestamp(),
            isDemo: true,
            status: 'active'
        });

        // 4. Create Demo Rooms (10 rooms with realistic scenarios)
        if (populateData) {
            const enhancedRooms = [
                ...DEMO_ROOMS,
                { number: '205', floor: 2, type: 'deluxe', status: 'occupied' }, // VIP Guest
                { number: '402', floor: 4, type: 'presidential', status: 'occupied' }, // VIP Guest
            ];
            
            enhancedRooms.forEach((room, index) => {
                const roomRef = doc(db, `tenants/${DEMO_TENANT_ID}/rooms`, `${DEMO_BRANCH_ID}_${room.number}`);
                batch.set(roomRef, {
                    number: room.number,
                    floor: room.floor,
                    type: room.type,
                    status: room.status,
                    branchId: DEMO_BRANCH_ID,
                    tenantId: DEMO_TENANT_ID,
                    createdAt: serverTimestamp(),
                    isDemo: true,
                    // Add guest data for occupied rooms
                    ...(room.status === 'occupied' && {
                        currentGuestId: `demo_guest_${index + 1}`,
                        currentGuestName: room.number === '205' ? 'VIP Guest - محمد السيد' : room.number === '401' ? 'VIP Guest - علي محمود' : `Guest ${room.number}`,
                        checkInDate: Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)), // Yesterday
                        ...(room.number === '205' && { isVIP: true }),
                        ...(room.number === '401' && { isVIP: true }),
                    })
                });
            });

            // 5. Create Demo Employees
            DEMO_EMPLOYEES.forEach((emp, index) => {
                const empRef = doc(db, 'employees', `${DEMO_BRANCH_ID}_${emp.pin}`);
                batch.set(empRef, {
                    id: `${DEMO_BRANCH_ID}_${emp.pin}`,
                    name: emp.name,
                    pin: emp.pin,
                    role: emp.role,
                    department: emp.department,
                    tenantId: DEMO_TENANT_ID,
                    branchId: DEMO_BRANCH_ID,
                    availableBranches: [{ id: DEMO_BRANCH_ID, name: branchName }],
                    createdAt: serverTimestamp(),
                    isDemo: true,
                    status: 'active'
                });
            });

            // 6. Create Demo Requests (10 requests with realistic scenarios)
            const enhancedRequests = [
                ...DEMO_REQUESTS,
                {
                    type: 'cleaning',
                    status: 'PENDING_RECEPTION',
                    roomNumber: '205',
                    guestName: 'محمد السيد',
                    priority: 'urgent',
                    notes: 'VIP Guest - Needs immediate cleaning',
                    createdAt: new Date(Date.now() - 5 * 60000), // 5 minutes ago
                },
                {
                    type: 'maintenance',
                    status: 'PENDING',
                    roomNumber: '401',
                    guestName: 'علي محمود',
                    priority: 'urgent',
                    notes: 'VIP Guest - AC not working',
                    createdAt: new Date(Date.now() - 20 * 60000), // 20 minutes ago
                },
                {
                    type: 'bellman',
                    status: 'CONFIRMED',
                    roomNumber: '202',
                    guestName: 'سارة أحمد',
                    priority: 'normal',
                    notes: 'Luggage assistance needed',
                    createdAt: new Date(Date.now() - 45 * 60000), // 45 minutes ago
                },
                {
                    type: 'coffee',
                    status: 'IN_PROGRESS',
                    roomNumber: '301',
                    guestName: 'يوسف خالد',
                    priority: 'normal',
                    notes: 'Coffee and breakfast order',
                    createdAt: new Date(Date.now() - 25 * 60000), // 25 minutes ago
                },
                {
                    type: 'cleaning',
                    status: 'COMPLETED',
                    roomNumber: '102',
                    guestName: 'فاطمة علي',
                    priority: 'normal',
                    notes: 'Standard cleaning completed',
                    createdAt: new Date(Date.now() - 180 * 60000), // 3 hours ago
                    completedAt: new Date(Date.now() - 120 * 60000), // 2 hours ago
                },
            ];
            
            enhancedRequests.forEach((req, index) => {
                const requestRef = doc(collection(db, `tenants/${DEMO_TENANT_ID}/requests`));
                batch.set(requestRef, {
                    ...req,
                    id: requestRef.id,
                    branch: DEMO_BRANCH_ID,
                    tenantId: DEMO_TENANT_ID,
                    currentDepartment: 'reception',
                    originDepartment: 'reception',
                    createdAt: Timestamp.fromDate(req.createdAt),
                    createdBy: {
                        id: DEMO_MANAGER_ID,
                        name: 'Demo Manager'
                    },
                    ...(req.status === 'CONFIRMED' && {
                        confirmedAt: Timestamp.fromDate(new Date(req.createdAt.getTime() + 5 * 60000)),
                        confirmedBy: {
                            id: DEMO_MANAGER_ID,
                            name: 'Demo Manager'
                        }
                    }),
                    ...(req.status === 'COMPLETED' && req.completedAt && {
                        completedAt: Timestamp.fromDate(req.completedAt),
                        completedBy: {
                            id: DEMO_MANAGER_ID,
                            name: 'Demo Manager'
                        }
                    }),
                    isDemo: true
                });
            });
        }

        // Commit all writes
        await batch.commit();

        return {
            branchId: DEMO_BRANCH_ID,
            tenantId: DEMO_TENANT_ID,
            managerId: DEMO_MANAGER_ID,
            managerPin: DEMO_MANAGER_PIN,
            createdAt: new Date()
        };
    } catch (error) {
        logger.error('Error creating demo instance:', error, 'demoFactory');
        throw new Error('Failed to create demo instance');
    }
};

// ============================================================
// CLEAR DEMO DATA FUNCTION (ZERO-TRACE)
// ============================================================

/**
 * Clear all demo data associated with a tenant ID
 * SECURITY: Strict guard clause - only works with demo tenant IDs
 * 
 * @param tenantId - The demo tenant ID to clear (must start with 'demo-')
 * @returns Promise with deletion statistics
 */
export const clearDemoData = async (tenantId: string): Promise<{
    success: boolean;
    deleted: {
        tenants: number;
        branches: number;
        rooms: number;
        employees: number;
        requests: number;
        [key: string]: number;
    };
    error?: string;
}> => {
    // ✅ SECURITY: Strict guard clause - only allow demo tenant IDs
    if (!tenantId || !tenantId.startsWith('demo-')) {
        logger.error(`SECURITY: clearDemoData called with non-demo tenant ID: ${tenantId}`, undefined, 'demoFactory');
        return {
            success: false,
            deleted: {
                tenants: 0,
                branches: 0,
                rooms: 0,
                employees: 0,
                requests: 0
            },
            error: 'Only demo tenant IDs are allowed'
        };
    }

    const deleted: { [key: string]: number } = {
        tenants: 0,
        branches: 0,
        rooms: 0,
        employees: 0,
        requests: 0
    };

    try {
        // 1. Delete all requests for this tenant (tenant-scoped path)
        const requestsRef = collection(db, `tenants/${tenantId}/requests`);
        const requestsSnapshot = await getDocs(requestsRef);
        const requestsBatch = writeBatch(db);
        requestsSnapshot.docs.forEach((d) => {
            requestsBatch.delete(d.ref);
            deleted.requests++;
        });
        if (requestsSnapshot.docs.length > 0) await requestsBatch.commit();

        // 2. Delete all rooms for this tenant (tenant-scoped path)
        const roomsRef = collection(db, `tenants/${tenantId}/rooms`);
        const roomsSnapshot = await getDocs(roomsRef);
        const roomsBatch = writeBatch(db);
        roomsSnapshot.docs.forEach((d) => {
            roomsBatch.delete(d.ref);
            deleted.rooms++;
        });
        if (roomsSnapshot.docs.length > 0) await roomsBatch.commit();

        // 3. Delete all employees for this tenant
        const employeesQuery = query(
            collection(db, 'employees'),
            where('tenantId', '==', tenantId)
        );
        const employeesSnapshot = await getDocs(employeesQuery);
        const employeesBatch = writeBatch(db);
        employeesSnapshot.forEach((doc) => {
            employeesBatch.delete(doc.ref);
            deleted.employees++;
        });
        await employeesBatch.commit();

        // 4. Delete all branches for this tenant
        const branchesQuery = query(
            collection(db, 'branches'),
            where('tenantId', '==', tenantId)
        );
        const branchesSnapshot = await getDocs(branchesQuery);
        const branchesBatch = writeBatch(db);
        branchesSnapshot.forEach((doc) => {
            branchesBatch.delete(doc.ref);
            deleted.branches++;
        });
        await branchesBatch.commit();

        // 5. Delete the tenant itself
        const tenantRef = doc(db, 'tenants', tenantId);
        await deleteDoc(tenantRef);
        deleted.tenants = 1;

        // 6. ✅ ZERO-TRACE: Clear ALL localStorage and sessionStorage
        // Nuclear option: Clear everything to ensure zero trace
        try {
            localStorage.clear();
            sessionStorage.clear();
            logger.info('✅ Zero-Trace: All localStorage and sessionStorage cleared', undefined, 'demoFactory');
        } catch (clearError) {
            logger.warn('Warning: Could not clear all storage:', clearError, 'demoFactory');
            // Fallback: Remove only demo-related keys
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('demo') || key.includes(tenantId))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));

            const sessionKeysToRemove: string[] = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && (key.includes('demo') || key.includes(tenantId))) {
                    sessionKeysToRemove.push(key);
                }
            }
            sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
        }

        // 7. Sign out from Firebase Auth if signed in
        if (auth.currentUser) {
            await signOut(auth);
        }

        return {
            success: true,
            deleted
        };
    } catch (error: any) {
        logger.error('Error clearing demo data:', error, 'demoFactory');
        return {
            success: false,
            deleted,
            error: error.message || 'Failed to clear demo data'
        };
    }
};

/**
 * Check if demo instance exists
 * @param tenantId - Optional tenant ID to check (defaults to checking any demo tenant)
 */
export const checkDemoInstance = async (tenantId?: string): Promise<boolean> => {
    try {
        if (tenantId) {
            const tenantRef = doc(db, 'tenants', tenantId);
            const tenantSnap = await getDoc(tenantRef);
            return tenantSnap.exists() && tenantSnap.data()?.isDemo === true;
        }
        // Check for any demo tenant
        const tenantsQuery = query(
            collection(db, 'tenants'),
            where('isDemo', '==', true)
        );
        const tenantsSnapshot = await getDocs(tenantsQuery);
        return !tenantsSnapshot.empty;
    } catch {
        return false;
    }
};

/**
 * Auto-login as Demo Manager
 * @param tenantId - Optional tenant ID (if not provided, finds first demo tenant)
 * @param branchId - Optional branch ID (if not provided, finds first demo branch for tenant)
 */
export const autoLoginDemoManager = async (tenantId?: string, branchId?: string): Promise<any> => {
    try {
        // 1. Find demo tenant if not provided
        let demoTenantId = tenantId;
        let demoBranchId = branchId;
        let demoManagerId: string;

        if (!demoTenantId) {
            const tenantsQuery = query(
                collection(db, 'tenants'),
                where('isDemo', '==', true)
            );
            const tenantsSnapshot = await getDocs(tenantsQuery);
            if (tenantsSnapshot.empty) {
                throw new Error('No demo instance found. Please create demo instance first.');
            }
            demoTenantId = tenantsSnapshot.docs[0].id;
        }

        // 2. Find demo branch if not provided
        if (!demoBranchId) {
            const branchesQuery = query(
                collection(db, 'branches'),
                where('tenantId', '==', demoTenantId),
                where('isDemo', '==', true)
            );
            const branchesSnapshot = await getDocs(branchesQuery);
            if (branchesSnapshot.empty) {
                throw new Error('No demo branch found for tenant.');
            }
            demoBranchId = branchesSnapshot.docs[0].id;
        }

        // 3. Find demo manager
        const employeesQuery = query(
            collection(db, 'employees'),
            where('tenantId', '==', demoTenantId),
            where('branchId', '==', demoBranchId),
            where('role', '==', 'manager'),
            where('isDemo', '==', true)
        );
        const employeesSnapshot = await getDocs(employeesQuery);
        if (employeesSnapshot.empty) {
            throw new Error('Demo manager not found. Please create demo instance first.');
        }
        demoManagerId = employeesSnapshot.docs[0].id;
        const managerData = employeesSnapshot.docs[0].data();

        // 4. Sign in anonymously (required for Firestore access)
        let firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            const userCredential = await signInAnonymously(auth);
            firebaseUser = userCredential.user;
        }

        // 5. Return user object compatible with AuthContext
        return {
            id: demoManagerId,
            name: managerData.name,
            role: 'manager',
            department: 'reception',
            tenantId: demoTenantId,
            branchId: demoBranchId,
            availableBranches: managerData.availableBranches || [],
            preferredBranchId: demoBranchId,
            isDemo: true
        };
    } catch (error) {
        logger.error('Error auto-logging in demo manager:', error, 'demoFactory');
        throw error;
    }
};

/**
 * Get demo login URL
 * @param tenantId - Optional tenant ID (if not provided, uses /demo-access)
 */
export const getDemoLoginUrl = (tenantId?: string): string => {
    const baseUrl = window.location.origin;
    if (tenantId) {
        return `${baseUrl}/demo-access?tenantId=${tenantId}`;
    }
    return `${baseUrl}/demo-access?key=${DEMO_MANAGER_PIN}`;
};

/**
 * Validate demo key from URL
 */
export const validateDemoKey = (key: string): boolean => {
    return key === DEMO_MANAGER_PIN;
};

// ============================================================
// EXPORTS
// ============================================================

export const DEMO_CONSTANTS = {
    MANAGER_PIN: DEMO_MANAGER_PIN
};
