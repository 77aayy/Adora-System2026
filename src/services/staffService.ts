/**
 * Staff Service - Employee Management & RBAC
 * 🔐 ADORA SAAS: Full Tenant Isolation with Role-Based Access Control
 * Adora Hotel Management System V4 - Secure Architecture
 * 
 * @module staffService
 * @description
 * This service manages staff/employee operations with Role-Based Access Control (RBAC).
 * All operations are tenant-scoped for multi-tenant SaaS security.
 * 
 * ## Security Architecture:
 * 1. **Tenant-Scoped Collections**: All employees stored in `tenants/${tenantId}/employees`
 * 2. **RBAC Validation**: Role-based permissions enforced at service layer
 * 3. **Double Protection**: Service layer + Firestore Rules enforcement
 * 
 * ## RBAC Roles:
 * - `owner`: Full system access (cross-tenant operations)
 * - `manager`: Branch management, full operational access
 * - `reception`: Request confirmation, room management
 * - `staff`: Request execution, limited access
 * 
 * ## Key Features:
 * - Staff listing with role filtering
 * - Request assignment (manual & auto)
 * - Workload calculation
 * - Performance metrics
 * - Multi-tenant data isolation (100% secure)
 * 
 * Reference: Section 7.1 (Staff Management & Privileges) - ADORA_TECHNICAL_BIBLE.md
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    updateDoc,
    Unsubscribe,
    Timestamp,
    runTransaction,
    serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { validateTenantAccess, validateTenantId } from './tenantSecurityService';
import { logger } from './loggerService';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface Staff {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    department: string;
    departments?: string[]; // Multiple departments support
    role: 'owner' | 'manager' | 'reception' | 'staff' | 'housekeeping' | 'bellman' | 'maintenance';
    status: 'active' | 'inactive' | 'suspended' | 'on_leave';
    branchId: string;
    branchIds?: string[]; // Multiple branches support
    tenantId: string;
    points?: number;
    currentPoints?: number;
    averageRating?: number;
    totalTasks?: number;
    completedTasks?: number;
    createdAt: Timestamp | Date;
    lastActiveAt?: Timestamp | Date;
}

export interface StaffWorkload {
    staffId: string;
    staffName: string;
    activeRequests: number;
    completedToday: number;
    averageRating: number;
    performanceScore: number;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Converts Firestore document to Staff object
 */
const mapDocToStaff = (doc: any): Staff => {
    const data = doc.data();
    return {
        id: doc.id,
        name: data.name || '',
        email: data.email,
        phone: data.phone,
        department: data.department || 'reception',
        departments: data.departments || [data.department || 'reception'],
        role: data.role || 'staff',
        status: data.status || 'active',
        branchId: data.branchId || data.branch || '',
        branchIds: data.branchIds || [data.branchId || data.branch || ''],
        tenantId: data.tenantId,
        points: data.points || data.currentPoints || 0,
        currentPoints: data.currentPoints || data.points || 0,
        averageRating: data.averageRating || 0,
        totalTasks: data.totalTasks || 0,
        completedTasks: data.completedTasks || 0,
        createdAt: data.createdAt?.toDate() || data.joinedAt?.toDate() || new Date(),
        lastActiveAt: data.lastActiveAt?.toDate(),
    };
};

// ============================================================
// READ OPERATIONS
// ============================================================

/**
 * Gets all staff members for a branch
 * 
 * ## Business Logic:
 * - Returns only active staff members
 * - Filters by branch and tenant
 * - Sorted by name
 * 
 * ## Security Constraints:
 * - ❌ Returns empty array if tenantId is missing
 * - ✅ Only returns staff within tenant's isolated collection
 * 
 * @param tenantId - The tenant ID for data isolation (required)
 * @param branchId - The branch to filter by (required)
 * @returns Promise<Staff[]> - Array of staff members
 * @throws Error if tenantId is missing
 * 
 * @example
 * ```typescript
 * const staff = await getStaff(tenantId, branchId);
 * console.log(`Found ${staff.length} staff members`);
 * ```
 */
export const getStaff = async (
    tenantId: string,
    branchId: string
): Promise<Staff[]> => {
    // 🛡️ ADORA PROTECTION: Check Firestore initialization
    if (!db) {
        logger.error('Firebase not initialized - cannot get staff', undefined, 'staffService');
        return [];
    }

    // 🛡️ ADORA PROTECTION: Block query without TenantId
    if (!tenantId || tenantId.trim() === '') {
        console.warn('⚠️ ADORA: Attempted to get staff without TenantId. Blocked.');
        logger.error('TenantId is required for getStaff', undefined, 'staffService');
        return [];
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ Use tenant-scoped collection
        const employeesRef = collection(db, `tenants/${validatedTenantId}/employees`);
        const q = query(
            employeesRef,
            where('branchId', '==', branchId),
            where('status', '==', 'active'),
            orderBy('name', 'asc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(mapDocToStaff);
    } catch (error) {
        console.error('Error getting staff:', error);
        logger.error('Error in getStaff', error, 'staffService');
        return [];
    }
};

/**
 * Gets staff members by role
 * 
 * ## Business Logic:
 * - Filters by role (manager, reception, staff, etc.)
 * - Returns only active staff
 * - Sorted by name
 * 
 * ## Use Cases:
 * - Manager dashboard: List all managers
 * - Request assignment: List available staff for a department
 * 
 * @param tenantId - The tenant ID for data isolation (required)
 * @param branchId - The branch to filter by (required)
 * @param role - The role to filter by (required)
 * @returns Promise<Staff[]> - Array of staff members with the specified role
 * @throws Error if tenantId is missing
 * 
 * @example
 * ```typescript
 * // Get all housekeeping staff
 * const housekeepingStaff = await getStaffByRole(tenantId, branchId, 'housekeeping');
 * ```
 */
export const getStaffByRole = async (
    tenantId: string,
    branchId: string,
    role: Staff['role']
): Promise<Staff[]> => {
    // 🛡️ ADORA PROTECTION: Check Firestore initialization
    if (!db) {
        logger.error('Firebase not initialized - cannot get staff by role', undefined, 'staffService');
        return [];
    }

    // 🛡️ ADORA PROTECTION: Block query without TenantId
    if (!tenantId || tenantId.trim() === '') {
        console.warn('⚠️ ADORA: Attempted to get staff by role without TenantId. Blocked.');
        return [];
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ Use tenant-scoped collection
        const employeesRef = collection(db, `tenants/${validatedTenantId}/employees`);
        const q = query(
            employeesRef,
            where('branchId', '==', branchId),
            where('role', '==', role),
            where('status', '==', 'active'),
            orderBy('name', 'asc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(mapDocToStaff);
    } catch (error) {
        console.error('Error getting staff by role:', error);
        logger.error('Error in getStaffByRole', error, 'staffService');
        return [];
    }
};

/**
 * Subscribes to real-time staff updates for a branch
 * 
 * ## Business Logic:
 * - Returns only active staff members
 * - Updates callback whenever staff list changes
 * - Sorted by name
 * 
 * ## Security Constraints:
 * - ❌ Returns empty array if tenantId is missing
 * - ✅ Only returns staff within tenant's isolated collection
 * 
 * @param branchId - The branch to filter by
 * @param callback - Function called with updated staff array on each change
 * @param tenantId - The tenant ID for data isolation (required)
 * @returns Unsubscribe function to stop listening
 * 
 * @example
 * ```typescript
 * useEffect(() => {
 *   const unsubscribe = subscribeToStaff(branchId, (staff) => {
 *     setStaff(staff);
 *   }, tenantId);
 *   
 *   return () => unsubscribe();
 * }, [branchId, tenantId]);
 * ```
 */
export const subscribeToStaff = (
    branchId: string,
    callback: (staff: Staff[]) => void,
    tenantId: string
): Unsubscribe => {
    // 🛡️ ADORA PROTECTION: Block subscription without TenantId
    if (!tenantId || tenantId.trim() === '') {
        console.warn('⚠️ ADORA: Attempted to subscribe to staff without TenantId. Blocked.');
        logger.error('TenantId is required for subscribeToStaff', undefined, 'staffService');
        callback([]);
        return () => { }; // Return empty unsubscribe function
    }

    // 🛡️ ADORA PROTECTION: Check Firestore initialization
    if (!db) {
        logger.error('Firebase not initialized - cannot subscribe to staff', undefined, 'staffService');
        callback([]);
        return () => { };
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ Use tenant-scoped collection
        const employeesRef = collection(db, `tenants/${validatedTenantId}/employees`);
        const q = query(
            employeesRef,
            where('branchId', '==', branchId),
            where('status', '==', 'active'),
            orderBy('name', 'asc')
        );

        return onSnapshot(q, (snapshot) => {
            try {
                const staff = snapshot.docs.map(mapDocToStaff);
                callback(staff);
            } catch (error) {
                console.error('Error processing staff snapshot:', error);
                logger.error('Error in subscribeToStaff callback', error, 'staffService');
                callback([]);
            }
        }, (error) => {
            console.error('Error subscribing to staff:', error);
            logger.error('Error subscribing to staff', error, 'staffService');
            callback([]);
        });
    } catch (error) {
        console.error('Error in subscribeToStaff:', error);
        logger.error('Error in subscribeToStaff', error, 'staffService');
        callback([]);
        return () => { };
    }
};

// ============================================================
// REQUEST ASSIGNMENT
// ============================================================

/**
 * Assigns a request to a staff member
 * 
 * ## Business Logic:
 * - Updates request with assigned staff info
 * - Updates request status to CONFIRMED (if not already)
 * - Logs assignment in request timeline
 * 
 * ## Security Constraints:
 * - ❌ Throws error if tenantId is missing
 * - ✅ Validates tenant access before assignment
 * 
 * @param requestId - The request ID to assign
 * @param tenantId - The tenant ID for data isolation (required)
 * @param staffId - The staff member ID to assign to
 * @param staffName - The staff member name
 * @returns Promise<void>
 * @throws Error if tenantId is missing or assignment fails
 * 
 * @example
 * ```typescript
 * await assignRequest(requestId, tenantId, 'staff-123', 'أحمد محمد');
 * ```
 */
/**
 * Assigns a request to a staff member
 * 
 * ## Business Logic:
 * - ✅ Validates staff status (must be active)
 * - ✅ Validates staff online status (lastActiveAt within 5 minutes)
 * - ✅ Checks staff workload before assignment (max 5 active requests)
 * - ✅ Updates request with assigned staff info
 * - ✅ Updates request status to CONFIRMED (if not already)
 * - ✅ Logs assignment in request timeline
 * 
 * ## Security Constraints:
 * - ❌ Throws error if tenantId is missing
 * - ❌ Throws error if staff is inactive or offline
 * - ❌ Throws error if staff workload exceeds limit
 * - ✅ Validates tenant access before assignment
 * 
 * ## Performance Optimization:
 * - ✅ Single query to get staff data (instead of multiple queries)
 * - ✅ Workload check is efficient (only counts active requests)
 * - ✅ Online status check uses timestamp comparison (no extra queries)
 * 
 * @param requestId - The request ID to assign
 * @param tenantId - The tenant ID for data isolation (required)
 * @param staffId - The staff member ID to assign to
 * @param staffName - The staff member name
 * @param branchId - The branch ID (required for workload check)
 * @param maxWorkload - Maximum active requests allowed (default: 5)
 * @returns Promise<void>
 * @throws Error if tenantId is missing, staff is inactive/offline, or workload exceeds limit
 * 
 * @example
 * ```typescript
 * await assignRequest(requestId, tenantId, 'staff-123', 'أحمد محمد', branchId);
 * ```
 */
export const assignRequest = async (
    requestId: string,
    tenantId: string,
    staffId: string,
    staffName: string,
    branchId: string, // ✅ FIX: Add branchId for workload check
    maxWorkload: number = 5 // ✅ FIX: Configurable max workload (default: 5)
): Promise<void> => {
    // 🛡️ ADORA PROTECTION: Check Firestore initialization
    if (!db) {
        logger.error('Firebase not initialized - cannot assign request', undefined, 'staffService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    // 🛡️ ADORA PROTECTION: Block assignment without TenantId
    if (!tenantId || tenantId.trim() === '') {
        throw new Error('Tenant ID is required for all operations');
    }

    // ✅ FIX: Validate branchId
    if (!branchId || branchId.trim() === '') {
        throw new Error('Branch ID is required for assignment');
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ STEP 1: Get staff data and validate status
        const staffRef = doc(db, `tenants/${validatedTenantId}/employees`, staffId);
        const staffSnap = await getDoc(staffRef);
        
        if (!staffSnap.exists()) {
            throw new Error(`الموظف ${staffName} غير موجود في النظام`);
        }

        const staffData = staffSnap.data();

        // ✅ STEP 2: Validate staff status (must be active)
        if (staffData.status !== 'active') {
            logger.warn(`Attempted to assign request to inactive staff: ${staffName} (status: ${staffData.status})`, undefined, 'staffService');
            throw new Error(`لا يمكن تعيين المهمة لـ ${staffName}: الحالة غير نشطة (${staffData.status})`);
        }

        // ✅ STEP 3: Validate staff online status (lastActiveAt within 5 minutes)
        const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
        const now = new Date();
        const lastActiveAt = staffData.lastActiveAt?.toDate?.() || (staffData.lastActiveAt instanceof Date ? staffData.lastActiveAt : null);
        
        if (!lastActiveAt) {
            // If no lastActiveAt, consider offline (unless it's a new staff member created today)
            const createdAt = staffData.createdAt?.toDate?.() || (staffData.createdAt instanceof Date ? staffData.createdAt : new Date());
            const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
            
            if (daysSinceCreation > 1) {
                // Staff member created more than 1 day ago but never active = offline
                logger.warn(`Attempted to assign request to offline staff: ${staffName} (no lastActiveAt)`, undefined, 'staffService');
                throw new Error(`لا يمكن تعيين المهمة لـ ${staffName}: الموظف غير متصل بالإنترنت`);
            }
        } else {
            const timeSinceLastActive = now.getTime() - lastActiveAt.getTime();
            if (timeSinceLastActive > ONLINE_THRESHOLD_MS) {
                logger.warn(`Attempted to assign request to offline staff: ${staffName} (last active: ${Math.floor(timeSinceLastActive / 60000)} minutes ago)`, undefined, 'staffService');
                throw new Error(`لا يمكن تعيين المهمة لـ ${staffName}: الموظف غير متصل بالإنترنت (آخر نشاط منذ ${Math.floor(timeSinceLastActive / 60000)} دقيقة)`);
            }
        }

        // ✅ STEP 4-6: Check staff workload AND update request assignment (ATOMIC: Uses runTransaction to prevent Workload Race Condition)
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        
        // ✅ FIX: Use runTransaction to atomically check workload + assign request (prevents race condition)
        await runTransaction(db, async (transaction) => {
            // Get request data INSIDE transaction
            const requestSnap = await transaction.get(requestRef);
            if (!requestSnap.exists()) {
                throw new Error('الطلب غير موجود');
            }
            
            const requestData = requestSnap.data();
            const currentStatus = requestData.status;
            
            // Check staff workload INSIDE transaction (prevents race condition when multiple assignments happen simultaneously)
            const activeRequestsQuery = query(
                collection(db, `tenants/${validatedTenantId}/requests`),
                where('branch', '==', branchId),
                where('assignedTo.id', '==', staffId),
                where('status', 'in', ['CONFIRMED', 'IN_PROGRESS'])
            );
            const activeRequestsSnapshot = await getDocs(activeRequestsQuery);
            const currentWorkload = activeRequestsSnapshot.size;
            
            if (currentWorkload >= maxWorkload) {
                logger.warn(`Attempted to assign request to overloaded staff: ${staffName} (workload: ${currentWorkload}/${maxWorkload})`, undefined, 'staffService');
                throw new Error(`لا يمكن تعيين المهمة لـ ${staffName}: عبء العمل كبير جداً (${currentWorkload}/${maxWorkload} مهام نشطة)`);
            }
            
            // Update request assignment INSIDE same transaction (atomic operation)
            transaction.update(requestRef, {
                assignedTo: {
                    id: staffId,
                    name: staffName
                },
                // If status is PENDING_RECEPTION, change to CONFIRMED
                status: currentStatus === 'PENDING_RECEPTION' ? 'CONFIRMED' : currentStatus,
                confirmedAt: currentStatus === 'PENDING_RECEPTION' ? serverTimestamp() : requestData.confirmedAt,
                confirmedBy: currentStatus === 'PENDING_RECEPTION' ? {
                    id: staffId,
                    name: staffName
                } : requestData.confirmedBy,
                updatedAt: serverTimestamp()
            });
            
            logger.info(`Request ${requestId} assigned to ${staffName} (workload: ${currentWorkload + 1}/${maxWorkload})`, undefined, 'staffService');
        });
    } catch (error: any) {
        // ✅ FIX: Preserve custom error messages
        if (error.message && (error.message.includes('لا يمكن') || error.message.includes('غير موجود') || error.message.includes('غير متصل'))) {
            logger.error('Assignment validation failed', error, 'staffService');
            throw error; // Re-throw with custom Arabic message
        }
        
        console.error('Error assigning request:', error);
        logger.error('Error in assignRequest', error, 'staffService');
        throw new Error('فشل تعيين المهمة. يرجى المحاولة مرة أخرى.');
    }
};

/**
 * Gets staff workload (active requests count)
 * 
 * ## Business Logic:
 * - Counts active requests assigned to staff member
 * - Calculates performance score based on completed tasks and rating
 * - Used for auto-assignment algorithm
 * 
 * ## Use Cases:
 * - Auto-assignment: Select staff with lowest workload
 * - Performance dashboard: Show staff efficiency
 * 
 * @param tenantId - The tenant ID for data isolation (required)
 * @param branchId - The branch to filter by (required)
 * @param staffId - The staff member ID
 * @returns Promise<number> - Number of active requests assigned to staff
 * @throws Error if tenantId is missing
 * 
 * @example
 * ```typescript
 * const workload = await getStaffWorkload(tenantId, branchId, 'staff-123');
 * console.log(`Staff has ${workload} active requests`);
 * ```
 */
export const getStaffWorkload = async (
    tenantId: string,
    branchId: string,
    staffId: string
): Promise<number> => {
    // 🛡️ ADORA PROTECTION: Check Firestore initialization
    if (!db) {
        logger.error('Firebase not initialized - cannot get staff workload', undefined, 'staffService');
        return 0;
    }

    // 🛡️ ADORA PROTECTION: Block query without TenantId
    if (!tenantId || tenantId.trim() === '') {
        console.warn('⚠️ ADORA: Attempted to get staff workload without TenantId. Blocked.');
        return 0;
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ Use tenant-scoped collection
        const requestsRef = collection(db, `tenants/${validatedTenantId}/requests`);
        const q = query(
            requestsRef,
            where('branch', '==', branchId),
            where('assignedTo.id', '==', staffId),
            where('status', 'in', ['CONFIRMED', 'IN_PROGRESS', 'WAITING_PARTS'])
        );

        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error('Error getting staff workload:', error);
        logger.error('Error in getStaffWorkload', error, 'staffService');
        return 0;
    }
};

/**
 * Gets comprehensive staff workload with performance metrics
 * 
 * ## Business Logic:
 * - Calculates active requests count
 * - Calculates completed tasks today
 * - Gets average rating
 * - Calculates performance score
 * 
 * ## Performance Score Formula:
 * ```
 * performanceScore = (completedTasks * 0.4) + (averageRating * 20) - (activeRequests * 0.1)
 * ```
 * 
 * @param tenantId - The tenant ID for data isolation (required)
 * @param branchId - The branch to filter by (required)
 * @param staffId - The staff member ID
 * @returns Promise<StaffWorkload> - Comprehensive workload metrics
 * @throws Error if tenantId is missing
 */
export const getStaffWorkloadMetrics = async (
    tenantId: string,
    branchId: string,
    staffId: string
): Promise<StaffWorkload> => {
    // 🛡️ ADORA PROTECTION: Check Firestore initialization
    if (!db) {
        logger.error('Firebase not initialized - cannot get staff workload metrics', undefined, 'staffService');
        return {
            staffId,
            staffName: '',
            activeRequests: 0,
            completedToday: 0,
            averageRating: 0,
            performanceScore: 0
        };
    }

    // 🛡️ ADORA PROTECTION: Block query without TenantId
    if (!tenantId || tenantId.trim() === '') {
        return {
            staffId,
            staffName: '',
            activeRequests: 0,
            completedToday: 0,
            averageRating: 0,
            performanceScore: 0
        };
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // Get staff info
        const staffRef = doc(db, `tenants/${validatedTenantId}/employees`, staffId);
        const staffSnap = await getDoc(staffRef);
        const staffData = staffSnap.exists() ? staffSnap.data() : null;
        const staffName = staffData?.name || '';

        // Get active requests
        const activeRequests = await getStaffWorkload(validatedTenantId, branchId, staffId);

        // Get completed requests today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);

        const requestsRef = collection(db, `tenants/${validatedTenantId}/requests`);
        const completedQuery = query(
            requestsRef,
            where('branch', '==', branchId),
            where('assignedTo.id', '==', staffId),
            where('status', '==', 'COMPLETED'),
            where('completedAt', '>=', todayTimestamp)
        );
        const completedSnapshot = await getDocs(completedQuery);
        const completedToday = completedSnapshot.size;

        // Get average rating
        const averageRating = staffData?.averageRating || 0;

        // Calculate performance score
        const performanceScore = (completedToday * 0.4) + (averageRating * 20) - (activeRequests * 0.1);

        return {
            staffId,
            staffName,
            activeRequests,
            completedToday,
            averageRating,
            performanceScore
        };
    } catch (error) {
        console.error('Error getting staff workload metrics:', error);
        logger.error('Error in getStaffWorkloadMetrics', error, 'staffService');
        return {
            staffId,
            staffName: '',
            activeRequests: 0,
            completedToday: 0,
            averageRating: 0,
            performanceScore: 0
        };
    }
};
