/**
 * Request Service - Complete CRUD Operations
 * 🔐 ADORA SAAS: Full Tenant Isolation with Custom Claims Validation
 * Adora Hotel Management System V4 - Secure Architecture
 * 
 * @module requestService
 * @description
 * This service manages all guest/room service requests across departments:
 * Reception, Housekeeping, Bellman, Maintenance, and Procurement.
 * 
 * ## Security Architecture:
 * 1. **Tenant-Scoped Collections**: All requests stored in `tenants/${tenantId}/requests`
 * 2. **Custom Claims Validation**: Validates user's tenantId from Firebase Auth token
 * 3. **Double Protection**: Service layer + Firestore Rules enforcement
 * 
 * ## Request Lifecycle:
 * 1. **Created**: Request submitted (PENDING_RECEPTION)
 * 2. **Confirmed**: Reception validates and confirms (CONFIRMED)
 * 3. **In Progress**: Employee starts work (IN_PROGRESS)
 * 4. **Completed**: Work finished (COMPLETED)
 * 
 * ## Request Types:
 * - `cleaning`: Housekeeping tasks
 * - `maintenance`: Repair/fix issues
 * - `bellman`: Luggage, check-in/out assistance
 * - `amenities`: Guest amenity requests
 * - `vip_service`: Special guest services
 * - `procurement`: Purchasing requests
 * 
 * ## Key Features:
 * - Points/rewards integration for employee performance
 * - AI sentiment analysis on guest feedback
 * - WhatsApp-style read receipts
 * - Request journey tracking across departments
 * - Real-time subscriptions for live updates
 * - Multi-tenant data isolation (100% secure)
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    Timestamp,
    increment,
    Unsubscribe,
    writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {
    Request,
    RequestType,
    RequestStatus,
    RequestPriority,
    RequestSource,
    CreateRequestInput,
    UpdateRequestInput,
    ReadReceiptStatus
} from '../types/request';
import { analyzeFeedback } from './ai/sentimentService';
import { awardPerformancePoints, awardRatingPoints, awardPoints, awardPointsWithQualityCheck, getPointsConfig } from './pointsService';
import { logger } from './loggerService';
import { validateTenantAccess, validateTenantId } from './tenantSecurityService';
import { logAction, LogAction } from './advancedLogService';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

type QueryConstraint = ReturnType<typeof where> | ReturnType<typeof orderBy> | ReturnType<typeof limit>;

interface ViewedByEntry {
    userId: string;
    userName: string;
    department: string;
    viewedAt: Timestamp;
}

// ============================================================
// CREATE
// ============================================================

/**
 * Creates a new service request in the system
 * 🔐 SECURITY: Validates tenant access before creation
 * 
 * @param input - Request creation data (type, room, guest, etc.)
 * @param branch - Branch ID where request originates
 * @param userId - Creating employee's ID
 * @param userName - Creating employee's name
 * @returns Promise<string> - The created request ID
 * @throws Error if creation fails or tenant access denied
 */
export const createRequest = async (
    input: CreateRequestInput,
    branch: string,
    userId: string,
    userName: string
): Promise<string> => {
    // ✅ STEP 1: Null safety check
    if (!db) {
        logger.error('Firebase not initialized - cannot create request', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    // ✅ STEP 2: Validate tenantId
    const tenantId = validateTenantId(input.tenantId);

    // ✅ STEP 3: Validate tenant access (Custom Claims check)
    validateTenantAccess(tenantId);

    try {
        // 🕰️ Intelligent Target Time Assignment (Procurement)
        let targetCompletionTime = input.targetCompletionTime ? Timestamp.fromDate(input.targetCompletionTime) : undefined;

        if (input.type === RequestType.PROCUREMENT && !targetCompletionTime) {
            const config = await getPointsConfig(tenantId, branch);
            const procurementConfig = config.procurement;

            if (procurementConfig) {
                let defaultMinutes = procurementConfig.targetTime || 60;
                const sourceStr = String(input.source || '').toUpperCase();

                if (sourceStr === 'HOUSEKEEPING') {
                    defaultMinutes = procurementConfig.targetTimeHousekeeping || 60;
                } else if (sourceStr === 'MAINTENANCE') {
                    defaultMinutes = procurementConfig.targetTimeMaintenance || 4320;
                } else if (sourceStr === 'RECEPTION') {
                    defaultMinutes = procurementConfig.targetTimeReception || 1440;
                }

                const now = new Date();
                targetCompletionTime = Timestamp.fromDate(new Date(now.getTime() + defaultMinutes * 60000));
            }
        }

        // ✅ Determine initial department based on type
        let initialDepartment = 'reception';
        if (input.type === RequestType.CLEANING || input.type === RequestType.INSPECTION) {
            initialDepartment = 'housekeeping';
        } else if (input.type === RequestType.MAINTENANCE) {
            initialDepartment = 'maintenance';
        } else if (input.type === RequestType.BELLMAN) {
            initialDepartment = 'bellman';
        } else if (input.type === RequestType.PROCUREMENT) {
            initialDepartment = 'procurement';
        }

        const requestData: Omit<Request, 'id'> = {
            type: input.type,
            status: RequestStatus.PENDING_RECEPTION,
            priority: input.priority || RequestPriority.NORMAL,
            source: input.source || RequestSource.RECEPTION,

            roomNumber: input.roomNumber,
            guestName: input.guestName,

            branch,
            tenantId, // ✅ SaaS requirement

            createdBy: {
                id: userId,
                name: userName,
                department: initialDepartment
            },

            createdAt: Timestamp.now(),

            details: input.details || {},
            notes: input.notes,
            photos: input.photos,

            targetCompletionTime,
            scheduledDate: input.scheduledDate ? Timestamp.fromDate(input.scheduledDate) : undefined,

            // ✅ Request Journey Tracking
            currentDepartment: initialDepartment,
            originDepartment: initialDepartment,
            departmentHistory: [{
                department: initialDepartment,
                status: RequestStatus.PENDING_RECEPTION,
                enteredAt: Timestamp.now(),
                handledBy: {
                    id: userId,
                    name: userName
                }
            }]
        };

        // ✅ STEP 4: Use tenant-scoped collection (Pattern 1)
        const requestsRef = collection(db, `tenants/${tenantId}/requests`);
        const docRef = await addDoc(requestsRef, requestData);
        
        // ✅ Auto-check daily attendance
        if (userId) {
            try {
                const { checkDailyAttendance } = await import('./challengeService');
                checkDailyAttendance(tenantId, userId).catch(err => {
                    logger.warn('Failed to check daily attendance after request creation', err, 'requestService');
                });
            } catch (err) {
                logger.warn('Could not load challengeService for attendance check', err, 'requestService');
            }
        }
        
        // ✅ STEP 5: Send Push Notification to Department (Real-time notification)
        try {
            const { sendNotificationToDepartment } = await import('./notificationService');
            
            // Map request type to department for notifications
            let notificationDepartment: 'housekeeping' | 'bellman' | 'maintenance' | 'reception' | 'procurement' | 'coffeeShop' = 'reception';
            let notificationTitle = 'طلب جديد';
            let notificationMessage = `طلب جديد: ${input.roomNumber}`;
            
            if (input.type === RequestType.CLEANING || input.type === RequestType.INSPECTION) {
                notificationDepartment = 'housekeeping';
                notificationTitle = 'طلب تنظيف جديد';
                notificationMessage = `طلب تنظيف - الغرفة ${input.roomNumber}`;
            } else if (input.type === RequestType.MAINTENANCE) {
                notificationDepartment = 'maintenance';
                notificationTitle = 'طلب صيانة جديد';
                notificationMessage = `طلب صيانة - الغرفة ${input.roomNumber}`;
            } else if (input.type === RequestType.BELLMAN) {
                notificationDepartment = 'bellman';
                notificationTitle = 'طلب بيلمان جديد';
                notificationMessage = `طلب بيلمان - الغرفة ${input.roomNumber}`;
            } else if (input.type === RequestType.PROCUREMENT) {
                notificationDepartment = 'procurement';
                notificationTitle = 'طلب شراء جديد';
                notificationMessage = `طلب شراء - الغرفة ${input.roomNumber}`;
            } else if (input.type === RequestType.COFFEE) {
                notificationDepartment = 'coffeeShop';
                notificationTitle = 'طلب قهوة جديد';
                notificationMessage = `طلب قهوة - الغرفة ${input.roomNumber}`;
            }
            
            // Send notification to all staff in the department (non-blocking)
            sendNotificationToDepartment(
                notificationDepartment,
                notificationTitle,
                notificationMessage,
                tenantId,
                branch,
                'info',
                docRef.id
            ).catch(err => {
                logger.warn('Failed to send department notification', err, 'requestService');
            });
        } catch (err) {
            logger.warn('Could not load notificationService for department notification', err, 'requestService');
        }
        
        logger.info(`Request created: ${docRef.id} in tenant ${tenantId}`, undefined, 'requestService');
        return docRef.id;
    } catch (error: any) {
        if (error.message?.includes('Tenant access denied')) {
            throw error; // Re-throw security errors
        }
        logger.error('Error creating request', error, 'requestService');
        throw new Error('فشل إنشاء الطلب. يرجى المحاولة مرة أخرى.');
    }
};

// ============================================================
// READ
// ============================================================

/**
 * Get request by ID
 * 🔐 SECURITY: Validates tenant access
 */
export const getRequest = async (requestId: string, tenantId: string): Promise<Request | null> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot get request', undefined, 'requestService');
        return null;
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Use tenant-scoped collection
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        const docSnap = await getDoc(requestRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Request;
        }
        return null;
    } catch (error) {
        logger.error('Error getting request', error, 'requestService');
        return null;
    }
};

/**
 * Get all requests for a branch
 * 🔐 SECURITY: Validates tenant access
 */
export const getRequestsByBranch = async (
    branch: string,
    tenantId: string,
    status?: RequestStatus,
    limitCount?: number
): Promise<Request[]> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot get requests', undefined, 'requestService');
        return [];
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        const constraints: QueryConstraint[] = [where('branch', '==', branch)];
        if (status) constraints.push(where('status', '==', status));
        constraints.push(orderBy('createdAt', 'desc'));
        if (limitCount) constraints.push(limit(limitCount));

        // ✅ Use tenant-scoped collection
        const requestsRef = collection(db, `tenants/${validatedTenantId}/requests`);
        const q = query(requestsRef, ...constraints);

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Request));
    } catch (error) {
        logger.error('Error getting requests', error, 'requestService');
        return [];
    }
};

/**
 * Get requests by room number
 * 🔐 SECURITY: Validates tenant access
 */
export const getRequestsByRoom = async (
    branch: string,
    roomNumber: string,
    tenantId: string
): Promise<Request[]> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot get requests by room', undefined, 'requestService');
        return [];
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        const constraints: QueryConstraint[] = [
            where('branch', '==', branch),
            where('roomNumber', '==', roomNumber)
        ];
        constraints.push(orderBy('createdAt', 'desc'));

        // ✅ Use tenant-scoped collection
        const requestsRef = collection(db, `tenants/${validatedTenantId}/requests`);
        const q = query(requestsRef, ...constraints);

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Request));
    } catch (error) {
        logger.error('Error getting requests by room', error, 'requestService');
        return [];
    }
};

/**
 * Get today's requests
 * 🔐 SECURITY: Validates tenant access
 */
export const getTodayRequests = async (branch: string, tenantId: string): Promise<Request[]> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot get today requests', undefined, 'requestService');
        return [];
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const constraints: QueryConstraint[] = [
            where('branch', '==', branch),
            where('createdAt', '>=', Timestamp.fromDate(today))
        ];
        constraints.push(orderBy('createdAt', 'desc'));

        // ✅ Use tenant-scoped collection
        const requestsRef = collection(db, `tenants/${validatedTenantId}/requests`);
        const q = query(requestsRef, ...constraints);

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Request));
    } catch (error) {
        logger.error('Error getting today requests', error, 'requestService');
        return [];
    }
};

// ============================================================
// UPDATE
// ============================================================

/**
 * Update request
 * 🔐 SECURITY: Validates tenant access
 */
export const updateRequest = async (
    requestId: string,
    tenantId: string,
    data: UpdateRequestInput
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot update request', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Use tenant-scoped collection
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        await updateDoc(requestRef, {
            ...data,
            modifiedAt: Timestamp.now()
        });
    } catch (error) {
        logger.error('Error updating request', error, 'requestService');
        throw new Error('فشل تحديث الطلب. يرجى المحاولة مرة أخرى.');
    }
};

/**
 * Confirms a pending request (Reception workflow)
 * 🔐 SECURITY: Validates tenant access
 */
export const confirmRequest = async (
    requestId: string,
    tenantId: string,
    userId: string,
    userName: string
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot confirm request', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Get request before update (for audit log)
        const request = await getRequest(requestId, validatedTenantId);
        if (!request) {
            throw new Error('Request not found');
        }
        const oldStatus = request.status;

        // ✅ Use tenant-scoped collection
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        await updateDoc(requestRef, {
            status: RequestStatus.CONFIRMED,
            confirmedBy: {
                id: userId,
                name: userName
            },
            confirmedAt: Timestamp.now(),
            'timeline.confirmed': Timestamp.now()
        });

        // 📝 Audit Log: Request Confirmed
        try {
            const storedUser = localStorage.getItem('adora_user');
            const userData = storedUser ? JSON.parse(storedUser) : {};
            await logAction(
                'REQUEST_CONFIRM' as LogAction,
                {
                    id: userId,
                    name: userName,
                    role: userData.role || 'reception',
                    department: userData.department || 'reception'
                },
                {
                    type: 'request',
                    id: requestId,
                    name: `طلب ${request.type} - غرفة ${request.roomNumber}`
                },
                {
                    tenantId: validatedTenantId,
                    branchId: request.branch || 'default',
                    roomNumber: request.roomNumber
                },
                {
                    description: `تم تأكيد الطلب من ${oldStatus} إلى ${RequestStatus.CONFIRMED}`,
                    previousValue: oldStatus,
                    newValue: RequestStatus.CONFIRMED,
                    metadata: { requestType: request.type, requestPriority: request.priority }
                }
            ).catch(err => logger.warn('Failed to log request confirmation', err, 'requestService'));
        } catch (auditError) {
            logger.warn('Failed to create audit log for request confirmation', auditError, 'requestService');
        }

        // 💰 Award Points: Reception Confirmation
        if (request) {
            const createdAt = request.createdAt.toDate();
            const confirmedAt = new Date();
            const minutesTaken = Math.floor((confirmedAt.getTime() - createdAt.getTime()) / 60000);
            await awardPerformancePoints(validatedTenantId, userId, 'reception', 'confirm', minutesTaken);
        }
    } catch (error) {
        logger.error('Error confirming request', error, 'requestService');
        throw new Error('فشل تأكيد الطلب. يرجى المحاولة مرة أخرى.');
    }
};

/**
 * Marks a request as in-progress (Employee starts work)
 * 🔐 SECURITY: Validates tenant access
 */
export const startRequest = async (
    requestId: string,
    tenantId: string,
    userId: string,
    userName: string
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot start request', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Get request before update (for audit log)
        const request = await getRequest(requestId, validatedTenantId);
        if (!request) {
            throw new Error('Request not found');
        }
        const oldStatus = request.status;

        // ✅ Use tenant-scoped collection
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        await updateDoc(requestRef, {
            status: RequestStatus.IN_PROGRESS,
            assignedTo: {
                id: userId,
                name: userName
            },
            startedAt: Timestamp.now(),
            'timeline.started': Timestamp.now()
        });

        // 📝 Audit Log: Request Started
        try {
            const storedUser = localStorage.getItem('adora_user');
            const userData = storedUser ? JSON.parse(storedUser) : {};
            await logAction(
                'REQUEST_START' as LogAction,
                {
                    id: userId,
                    name: userName,
                    role: userData.role || 'staff',
                    department: userData.department || request.currentDepartment || 'general'
                },
                {
                    type: 'request',
                    id: requestId,
                    name: `طلب ${request.type} - غرفة ${request.roomNumber}`
                },
                {
                    tenantId: validatedTenantId,
                    branchId: request.branch || 'default',
                    roomNumber: request.roomNumber
                },
                {
                    description: `تم بدء العمل على الطلب من ${oldStatus} إلى ${RequestStatus.IN_PROGRESS}`,
                    previousValue: oldStatus,
                    newValue: RequestStatus.IN_PROGRESS,
                    metadata: { requestType: request.type, assignedTo: userId }
                }
            ).catch(err => logger.warn('Failed to log request start', err, 'requestService'));
        } catch (auditError) {
            logger.warn('Failed to create audit log for request start', auditError, 'requestService');
        }
    } catch (error) {
        logger.error('Error starting request', error, 'requestService');
        throw new Error('فشل بدء الطلب. يرجى المحاولة مرة أخرى.');
    }
};

/**
 * Completes a request (Task finished)
 * 🔐 SECURITY: Validates tenant access
 */
export const completeRequest = async (
    requestId: string,
    tenantId: string,
    userId: string,
    userName: string,
    rating?: number,
    feedback?: string
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot complete request', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Get request before update (for audit log)
        const request = await getRequest(requestId, validatedTenantId);
        if (!request) {
            throw new Error('Request not found');
        }
        const oldStatus = request.status;

        // ✅ Use tenant-scoped collection
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);

        let sentimentResult = null;
        if (feedback) {
            sentimentResult = await analyzeFeedback(feedback);
        }

        await updateDoc(requestRef, {
            status: RequestStatus.COMPLETED,
            completedBy: {
                id: userId,
                name: userName
            },
            completedAt: Timestamp.now(),
            'timeline.completed': Timestamp.now(),
            ...(rating && { rating }),
            ...(feedback && { feedback }),
            ...(sentimentResult && { sentimentResult })
        });

        // 📝 Audit Log: Request Completed
        try {
            const storedUser = localStorage.getItem('adora_user');
            const userData = storedUser ? JSON.parse(storedUser) : {};
            const startTime = request.startedAt ? request.startedAt.toDate() : request.createdAt.toDate();
            const endTime = new Date();
            const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
            
            await logAction(
                'REQUEST_COMPLETE' as LogAction,
                {
                    id: userId,
                    name: userName,
                    role: userData.role || 'staff',
                    department: userData.department || request.currentDepartment || 'general'
                },
                {
                    type: 'request',
                    id: requestId,
                    name: `طلب ${request.type} - غرفة ${request.roomNumber}`
                },
                {
                    tenantId: validatedTenantId,
                    branchId: request.branch || 'default',
                    roomNumber: request.roomNumber
                },
                {
                    description: `تم إتمام الطلب من ${oldStatus} إلى ${RequestStatus.COMPLETED}${rating ? ` - تقييم: ${rating}` : ''}`,
                    previousValue: oldStatus,
                    newValue: RequestStatus.COMPLETED,
                    duration: durationSeconds,
                    metadata: { 
                        requestType: request.type, 
                        rating,
                        hasFeedback: !!feedback,
                        sentiment: sentimentResult?.sentiment 
                    }
                }
            ).catch(err => logger.warn('Failed to log request completion', err, 'requestService'));
        } catch (auditError) {
            logger.warn('Failed to create audit log for request completion', auditError, 'requestService');
        }
        if (request) {
            // 📦 INVENTORY DEDUCTION
            if (request.status === RequestStatus.COMPLETED && request.details?.items) {
                const isConsumable = [
                    RequestType.MINIBAR,
                    RequestType.COFFEE,
                    RequestType.AMENITIES
                ].includes(request.type);

                if (isConsumable && Array.isArray(request.details.items)) {
                    const { findInventoryItemByName, updateItemQuantity } = await import('./inventoryService');

                    for (const item of request.details.items) {
                        if (item.name && item.quantity) {
                            try {
                                const inventoryItem = await findInventoryItemByName(item.name, request.branch);
                                if (inventoryItem) {
                                    await updateItemQuantity(
                                        inventoryItem.id,
                                        item.quantity,
                                        'out',
                                        `استهلاك نزيل - طلب #${request.roomNumber}`,
                                        userId,
                                        userName,
                                        request.branch,
                                        requestId
                                    );
                                }
                            } catch (invError) {
                                logger.warn(`Inventory sync failed for ${item.name}`, invError, 'requestService');
                            }
                        }
                    }
                }
            }

            // 💰 Award Points with Quality Check (Points Flow - FIXED)
            // ✅ FIX: Now uses awardPointsWithQualityCheck to ensure suspicious speed detection
            let department: 'maintenance' | 'bellman' | 'housekeeping' | 'reception' | 'procurement' | null = null;
            let action = 'completeRequest';

            if (request.type === RequestType.MAINTENANCE) {
                department = 'maintenance';
                action = 'complete';
            }
            else if (request.type === RequestType.BELLMAN) department = 'bellman';
            else if (request.type === RequestType.CLEANING) department = 'housekeeping';
            else if (request.type === RequestType.PROCUREMENT) {
                department = 'procurement';
                action = 'purchase';
            }

            if (department) {
                const startTime = request.startedAt ? request.startedAt.toDate() : request.createdAt.toDate();
                const endTime = new Date();
                const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);

                // ✅ Step 1: Calculate base points (using awardPerformancePoints logic but without awarding)
                // We'll calculate manually to avoid double-awarding, then use awardPointsWithQualityCheck
                const config = await getPointsConfig(validatedTenantId);
                const deptConfig = config[department];
                let basePoints = 0;
                let bonusReason = '';

                if (deptConfig) {
                    switch (department) {
                        case 'maintenance':
                            if (action === 'complete') basePoints = deptConfig.complete ?? 1;
                            break;
                        case 'bellman':
                            if (action === 'complete') basePoints = deptConfig.complete ?? 1;
                            break;
                        case 'housekeeping':
                            // Determine if occupied or checkout cleaning
                            const isCheckoutCleaning = request.type === RequestType.CLEANING && request.source === 'bellman_checkout';
                            if (isCheckoutCleaning) {
                                basePoints = deptConfig.completeCheckout ?? 1;
                            } else {
                                basePoints = deptConfig.completeOccupied ?? 1;
                            }
                            break;
                        case 'procurement':
                            if (action === 'purchase') {
                                basePoints = deptConfig.purchase ?? 1;
                                // Procurement has time-based bonuses
                                const targetMinutes = request.targetCompletionTime 
                                    ? Math.floor((request.targetCompletionTime.toDate().getTime() - request.createdAt.toDate().getTime()) / 60000)
                                    : 0;
                                if (targetMinutes > 0) {
                                    const earlyThreshold = targetMinutes * 0.8;
                                    if (durationMinutes <= earlyThreshold) {
                                        basePoints += (deptConfig.early || 0);
                                        bonusReason = ` (Early: ${durationMinutes}/${targetMinutes} min)`;
                                    } else if (durationMinutes > targetMinutes) {
                                        basePoints += (deptConfig.delay || 0);
                                        bonusReason = ` (Delay: ${durationMinutes}/${targetMinutes} min)`;
                                    } else {
                                        basePoints += (deptConfig.ontime || 0);
                                        bonusReason = ` (On time: ${durationMinutes}/${targetMinutes} min)`;
                                    }
                                }
                            }
                            break;
                        case 'reception':
                            if (action === 'complete') basePoints = deptConfig.complete ?? 1;
                            break;
                    }
                }

                // ✅ Step 2: Apply Quality Check (Suspicious Speed Check) via awardPointsWithQualityCheck
                // This ensures points are held for review if completion speed is suspicious
                if (basePoints > 0) {
                    // Map department names for quality check (coffeeShop vs coffee_shop)
                    const qualityCheckDepartment = department === 'coffee_shop' ? 'coffeeShop' : department;
                    
                    const qualityResult = await awardPointsWithQualityCheck(
                        validatedTenantId,
                        request.branch || 'default',
                        userId,
                        userName,
                        qualityCheckDepartment,
                        basePoints,
                        `${action} - Room ${request.roomNumber}${bonusReason}`,
                        durationMinutes,
                        requestId
                    );

                    // Log quality check result (for audit)
                    if (qualityResult.held) {
                        logger.warn(`Points held for review: ${qualityResult.message}`, undefined, 'requestService');
                    } else {
                        logger.info(`Points awarded: ${qualityResult.message}`, undefined, 'requestService');
                    }
                }

                if (rating && department !== 'procurement') {
                    if (department === 'bellman' || department === 'housekeeping' || department === 'maintenance' || department === 'reception') {
                        await awardRatingPoints(validatedTenantId, userId, department, rating);
                    }
                }
            }
        }

        // 🚨 ADORA CRISIS ROUTING
        if (sentimentResult?.sentiment === 'Negative' && sentimentResult.score > 0.7) {
            const original = await getRequest(requestId, validatedTenantId);
            if (!original) return;

            if (sentimentResult.severity === 'CRITICAL') {
                await createRequest({
                    type: RequestType.VIP_SERVICE,
                    roomNumber: original.roomNumber,
                    guestName: original.guestName,
                    priority: RequestPriority.EMERGENCY,
                    source: RequestSource.AUTO,
                    notes: `🚨 AI CRISIS ALERT: [CRITICAL INFRASTRUCTURE] Issue: ${sentimentResult.issue}. Summary: ${sentimentResult.summary}. Recovery Strategy: ${sentimentResult.suggestedRecovery}. Resolve immediately!`,
                    tenantId: validatedTenantId
                }, original.branch, 'AI_GUARDIAN', 'Adora AI');
            }
        }
    } catch (error) {
        logger.error('Error completing request', error, 'requestService');
        throw new Error('فشل إكمال الطلب. يرجى المحاولة مرة أخرى.');
    }
};

/**
 * Transfer request to another department
 * 🔐 SECURITY: Validates tenant access
 */
export const transferRequestToDepartment = async (
    requestId: string,
    tenantId: string,
    fromDepartment: string,
    toDepartment: string,
    userId: string,
    userName: string,
    status?: RequestStatus,
    notes?: string
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot transfer request', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Use tenant-scoped collection
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        const request = await getRequest(requestId, validatedTenantId);
        
        if (!request) {
            throw new Error('Request not found');
        }

        const now = Timestamp.now();
        const history = request.departmentHistory || [];
        
        if (history.length > 0) {
            const lastEntry = history[history.length - 1];
            if (lastEntry.department === fromDepartment && !lastEntry.exitedAt) {
                lastEntry.exitedAt = now;
                lastEntry.nextDepartment = toDepartment;
                if (notes) {
                    lastEntry.notes = notes;
                }
            }
        }

        history.push({
            department: toDepartment,
            status: status || RequestStatus.CONFIRMED,
            enteredAt: now,
            handledBy: {
                id: userId,
                name: userName
            },
            notes: notes
        });

        const oldDepartment = request.currentDepartment || fromDepartment;
        const oldStatus = request.status;

        await updateDoc(requestRef, {
            currentDepartment: toDepartment,
            status: status || RequestStatus.CONFIRMED,
            deliveredAt: now,
            departmentHistory: history,
            modifiedAt: now,
            modifiedBy: {
                id: userId,
                name: userName
            }
        });

        // 📝 Audit Log: Request Transferred
        try {
            const storedUser = localStorage.getItem('adora_user');
            const userData = storedUser ? JSON.parse(storedUser) : {};
            await logAction(
                'REQUEST_TRANSFER' as LogAction,
                {
                    id: userId,
                    name: userName,
                    role: userData.role || 'reception',
                    department: userData.department || fromDepartment
                },
                {
                    type: 'request',
                    id: requestId,
                    name: `طلب ${request.type} - غرفة ${request.roomNumber}`
                },
                {
                    tenantId: validatedTenantId,
                    branchId: request.branch || 'default',
                    roomNumber: request.roomNumber
                },
                {
                    description: `تم تحويل الطلب من ${oldDepartment} إلى ${toDepartment}${notes ? ` - ملاحظات: ${notes}` : ''}`,
                    previousValue: { department: oldDepartment, status: oldStatus },
                    newValue: { department: toDepartment, status: status || RequestStatus.CONFIRMED },
                    metadata: { requestType: request.type, notes }
                }
            ).catch(err => logger.warn('Failed to log request transfer', err, 'requestService'));
        } catch (auditError) {
            logger.warn('Failed to create audit log for request transfer', auditError, 'requestService');
        }
    } catch (error) {
        logger.error('Error transferring request', error, 'requestService');
        throw new Error('فشل نقل الطلب. يرجى المحاولة مرة أخرى.');
    }
};

/**
 * Confirm completion and close the request circle
 * 🔐 SECURITY: Validates tenant access
 */
export const confirmCompletion = async (
    requestId: string,
    tenantId: string,
    userId: string,
    userName: string,
    department: string
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot confirm completion', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Use tenant-scoped collection
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        const request = await getRequest(requestId, validatedTenantId);
        
        if (!request) {
            throw new Error('Request not found');
        }

        const now = Timestamp.now();
        const history = request.departmentHistory || [];
        
        if (history.length > 0) {
            const lastEntry = history[history.length - 1];
            if (lastEntry.department === department) {
                lastEntry.exitedAt = now;
                lastEntry.status = RequestStatus.COMPLETED;
            }
        }

        await updateDoc(requestRef, {
            status: RequestStatus.COMPLETED,
            completedAt: now,
            'timeline.completed': now,
            departmentHistory: history,
            currentDepartment: undefined,
            modifiedAt: now,
            modifiedBy: {
                id: userId,
                name: userName,
                department: department
            }
        });
    } catch (error) {
        logger.error('Error confirming completion', error, 'requestService');
        throw new Error('فشل تأكيد الإكمال. يرجى المحاولة مرة أخرى.');
    }
};

/**
 * Cancel request
 * 🔐 SECURITY: Validates tenant access
 */
export const cancelRequest = async (
    requestId: string,
    tenantId: string,
    userId: string,
    userName: string,
    reason: string
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot cancel request', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Use tenant-scoped collection
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        await updateDoc(requestRef, {
            status: RequestStatus.CANCELLED,
            isCancelled: true,
            cancelReason: reason,
            completedBy: {
                id: userId,
                name: userName
            },
            completedAt: Timestamp.now(),
            'timeline.cancelled': Timestamp.now()
        });
    } catch (error) {
        logger.error('Error cancelling request', error, 'requestService');
        throw new Error('فشل إلغاء الطلب. يرجى المحاولة مرة أخرى.');
    }
};

/**
 * Assign request to employee
 * 🔐 SECURITY: Validates tenant access
 */
export const assignRequest = async (
    requestId: string,
    tenantId: string,
    employeeId: string,
    employeeName: string
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot assign request', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Use tenant-scoped collection
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        await updateDoc(requestRef, {
            assignedTo: {
                id: employeeId,
                name: employeeName
            },
            modifiedAt: Timestamp.now()
        });
    } catch (error) {
        logger.error('Error assigning request', error, 'requestService');
        throw new Error('فشل تعيين الطلب. يرجى المحاولة مرة أخرى.');
    }
};

// ============================================================
// DELETE
// ============================================================

/**
 * Delete request (soft delete by setting status to cancelled)
 * 🔐 SECURITY: Validates tenant access
 */
export const deleteRequest = async (requestId: string, tenantId: string): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot delete request', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Use tenant-scoped collection
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        await updateDoc(requestRef, {
            status: RequestStatus.CANCELLED,
            isCancelled: true,
            cancelReason: 'Deleted by user',
            modifiedAt: Timestamp.now()
        });
    } catch (error) {
        logger.error('Error deleting request', error, 'requestService');
        throw new Error('فشل حذف الطلب. يرجى المحاولة مرة أخرى.');
    }
};

// ============================================================
// REAL-TIME SUBSCRIPTIONS (⚡ OPTIMIZED WITH CACHING)
// ============================================================

/**
 * Subscribes to real-time request updates for a branch
 * ⚡ PERFORMANCE: Uses tenant-scoped collection + result limiting
 * 🔐 SECURITY: Validates tenant access
 */
export const subscribeToRequests = (
    branch: string,
    tenantId: string,
    callback: (requests: Request[]) => void,
    status?: RequestStatus,
    maxResults: number = 50
): Unsubscribe => {
    if (!db) {
        logger.error('Firebase not initialized - cannot subscribe to requests', undefined, 'requestService');
        callback([]);
        return () => { };
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        const constraints: QueryConstraint[] = [where('branch', '==', branch)];
        if (status) constraints.push(where('status', '==', status));
        constraints.push(orderBy('createdAt', 'desc'));
        constraints.push(limit(maxResults));

        // ✅ Use tenant-scoped collection
        const requestsRef = collection(db, `tenants/${validatedTenantId}/requests`);
        const q = query(requestsRef, ...constraints);

        return onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Request));
            callback(requests);
        }, (error) => {
            logger.error('Error in requests subscription', error, 'requestService');
            callback([]);
        });
    } catch (error) {
        logger.error('Error setting up subscription', error, 'requestService');
        return () => { };
    }
};

/**
 * Subscribe to requests for MULTIPLE branches
 * ⚡ PERFORMANCE: Optimized with result limiting
 * 🔐 SECURITY: Validates tenant access
 */
export const subscribeToMultipleBranches = (
    branches: string[],
    tenantId: string,
    callback: (requests: Request[]) => void,
    options?: {
        status?: RequestStatus;
        type?: RequestType;
        maxResults?: number;
    }
): Unsubscribe => {
    const maxResults = options?.maxResults || 50;
    
    if (branches.length === 0) {
        callback([]);
        return () => { };
    }

    if (!db) {
        logger.error('Firebase not initialized - cannot subscribe to multiple branches', undefined, 'requestService');
        callback([]);
        return () => { };
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // Firestore 'in' query supports max 30 values
        const branchesToQuery = branches.slice(0, 30);

        // ✅ Use tenant-scoped collection
        const requestsRef = collection(db, `tenants/${validatedTenantId}/requests`);
        let q = query(
            requestsRef,
            where('branch', 'in', branchesToQuery),
            orderBy('createdAt', 'desc'),
            limit(maxResults)
        );

        if (options?.status) {
            q = query(q, where('status', '==', options.status));
        }

        return onSnapshot(q, (snapshot) => {
            let requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Request));

            if (options?.type) {
                requests = requests.filter(r => r.type === options.type);
            }

            callback(requests);
        }, (error) => {
            logger.error('Error in multi-branch subscription', error, 'requestService');
            callback([]);
        });
    } catch (error) {
        logger.error('Error setting up multi-branch subscription', error, 'requestService');
        return () => { };
    }
};

/**
 * Subscribe to a single request
 * 🔐 SECURITY: Validates tenant access
 */
export const subscribeToRequest = (
    requestId: string,
    tenantId: string,
    callback: (request: Request | null) => void
): Unsubscribe => {
    if (!db) {
        logger.error('Firebase not initialized - cannot subscribe to request', undefined, 'requestService');
        callback(null);
        return () => { };
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Use tenant-scoped collection
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);

        return onSnapshot(requestRef, (doc) => {
            if (doc.exists()) {
                callback({ id: doc.id, ...doc.data() } as Request);
            } else {
                callback(null);
            }
        }, (error) => {
            logger.error('Error in request subscription', error, 'requestService');
            callback(null);
        });
    } catch (error) {
        logger.error('Error setting up subscription', error, 'requestService');
        return () => { };
    }
};

// ============================================================
// BATCH OPERATIONS
// ============================================================

/**
 * Bulk confirm requests
 * 🔐 SECURITY: Validates tenant access
 */
export const bulkConfirmRequests = async (
    requestIds: string[],
    tenantId: string,
    userId: string,
    userName: string
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot bulk confirm requests', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        const batch = writeBatch(db);

        requestIds.forEach(requestId => {
            // ✅ Use tenant-scoped collection
            const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
            batch.update(requestRef, {
                status: RequestStatus.CONFIRMED,
                confirmedBy: {
                    id: userId,
                    name: userName
                },
                confirmedAt: Timestamp.now()
            });
        });

        await batch.commit();
    } catch (error) {
        logger.error('Error bulk confirming requests', error, 'requestService');
        throw new Error('فشل تأكيد الطلبات. يرجى المحاولة مرة أخرى.');
    }
};

/**
 * Bulk complete requests
 * 🔐 SECURITY: Validates tenant access
 */
export const bulkCompleteRequests = async (
    requestIds: string[],
    tenantId: string,
    userId: string,
    userName: string
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot bulk complete requests', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        const batch = writeBatch(db);

        requestIds.forEach(requestId => {
            // ✅ Use tenant-scoped collection
            const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
            batch.update(requestRef, {
                status: RequestStatus.COMPLETED,
                completedBy: {
                    id: userId,
                    name: userName
                },
                completedAt: Timestamp.now()
            });
        });

        await batch.commit();
    } catch (error) {
        logger.error('Error bulk completing requests', error, 'requestService');
        throw new Error('فشل إكمال الطلبات. يرجى المحاولة مرة أخرى.');
    }
};

// ============================================================
// ANALYTICS
// ============================================================

/**
 * Get request statistics
 * 🔐 SECURITY: Validates tenant access
 */
export const getRequestStats = async (
    branch: string,
    tenantId: string,
    startDate?: Date,
    endDate?: Date
) => {
    if (!db) {
        logger.error('Firebase not initialized - cannot get request stats', undefined, 'requestService');
        return null;
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        const constraints: QueryConstraint[] = [where('branch', '==', branch)];

        if (startDate) {
            constraints.push(where('createdAt', '>=', Timestamp.fromDate(startDate)));
        }
        if (endDate) {
            constraints.push(where('createdAt', '<=', Timestamp.fromDate(endDate)));
        }

        // ✅ Use tenant-scoped collection
        const requestsRef = collection(db, `tenants/${validatedTenantId}/requests`);
        const q = query(requestsRef, ...constraints);

        const snapshot = await getDocs(q);
        const requests = snapshot.docs.map(doc => doc.data() as Request);

        return {
            total: requests.length,
            pending: requests.filter(r => r.status === RequestStatus.PENDING_RECEPTION).length,
            confirmed: requests.filter(r => r.status === RequestStatus.CONFIRMED).length,
            inProgress: requests.filter(r => r.status === RequestStatus.IN_PROGRESS).length,
            completed: requests.filter(r => r.status === RequestStatus.COMPLETED).length,
            cancelled: requests.filter(r => r.status === RequestStatus.CANCELLED).length,

            byType: {
                cleaning: requests.filter(r => r.type === RequestType.CLEANING).length,
                maintenance: requests.filter(r => r.type === RequestType.MAINTENANCE).length,
                bellman: requests.filter(r => r.type === RequestType.BELLMAN).length,
                amenities: requests.filter(r => r.type === RequestType.AMENITIES).length,
            },

            avgResponseTime: calculateAverageResponseTime(requests),
            avgCompletionTime: calculateAverageCompletionTime(requests)
        };
    } catch (error) {
        logger.error('Error getting request stats', error, 'requestService');
        return null;
    }
};

// Helper functions
function calculateAverageResponseTime(requests: Request[]): number {
    const confirmedRequests = requests.filter(r => r.confirmedAt);
    if (confirmedRequests.length === 0) return 0;

    const totalTime = confirmedRequests.reduce((sum, r) => {
        const created = r.createdAt.toDate();
        const confirmed = r.confirmedAt!.toDate();
        return sum + (confirmed.getTime() - created.getTime());
    }, 0);

    return Math.round(totalTime / confirmedRequests.length / 1000 / 60); // minutes
}

function calculateAverageCompletionTime(requests: Request[]): number {
    const completedRequests = requests.filter(r => r.completedAt);
    if (completedRequests.length === 0) return 0;

    const totalTime = completedRequests.reduce((sum, r) => {
        const created = r.createdAt.toDate();
        const completed = r.completedAt!.toDate();
        return sum + (completed.getTime() - created.getTime());
    }, 0);

    return Math.round(totalTime / completedRequests.length / 1000 / 60); // minutes
}

// ============================================================
// WHATSAPP-STYLE TRACKING
// ============================================================

export type { ReadReceiptStatus };

/**
 * Mark request as delivered to department
 * 🔐 SECURITY: Validates tenant access
 */
export async function markAsDelivered(
    requestId: string,
    tenantId: string,
    department: string
): Promise<void> {
    if (!db) {
        logger.error('Firebase not initialized - cannot mark as delivered', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Use tenant-scoped collection
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        await updateDoc(requestRef, {
            currentDepartment: department,
            deliveredAt: Timestamp.now(),
        });
    } catch (error) {
        logger.error('Error marking request as delivered', error, 'requestService');
        throw new Error('فشل تحديث حالة التسليم. يرجى المحاولة مرة أخرى.');
    }
}

/**
 * Mark request as viewed by user
 * 🔐 SECURITY: Validates tenant access
 */
export async function markAsViewed(
    requestId: string,
    tenantId: string,
    userId: string,
    userName: string,
    department: string
): Promise<void> {
    if (!db) {
        logger.error('Firebase not initialized - cannot mark as viewed', undefined, 'requestService');
        return;
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Use tenant-scoped collection
        const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        const requestDoc = await getDoc(requestRef);

        if (!requestDoc.exists()) return;

        const data = requestDoc.data();
        const viewedBy = (data.viewedBy || []) as ViewedByEntry[];

        const alreadyViewed = viewedBy.some((v: ViewedByEntry) => v.userId === userId);
        if (alreadyViewed) return;

        await updateDoc(requestRef, {
            viewedBy: [
                ...viewedBy,
                {
                    userId,
                    userName,
                    department,
                    viewedAt: Timestamp.now(),
                }
            ]
        });
    } catch (error) {
        logger.error('Error marking request as viewed', error, 'requestService');
    }
}

/**
 * Get read receipt status for a request
 */
export function getReadStatus(request: Request): ReadReceiptStatus {
    if (request.viewedBy && request.viewedBy.length > 0) {
        return 'read';
    }
    if (request.deliveredAt || request.confirmedAt) {
        return 'delivered';
    }
    return 'sent';
}

/**
 * Check if request was viewed by specific department
 */
export function wasViewedByDepartment(request: Request, department: string): boolean {
    if (!request.viewedBy) return false;
    return request.viewedBy.some(v => v.department === department);
}

/**
 * Get viewers list for a request
 */
export function getViewers(request: Request): { userId: string; userName: string; department: string; viewedAt: Date }[] {
    if (!request.viewedBy) return [];
    return request.viewedBy.map(v => ({
        userId: v.userId,
        userName: v.userName,
        department: v.department,
        viewedAt: v.viewedAt.toDate(),
    }));
}

/**
 * Cancel all active requests for a branch (Cascading Cleanup)
 * 🔐 SECURITY: Validates tenant access
 */
export const cancelAllActiveRequestsByBranch = async (
    tenantId: string,
    branchId: string,
    userId: string,
    userName: string,
    reason: string = 'تعطيل أو حذف الفرع'
): Promise<number> => {
    if (!db) {
        throw new Error('Firebase not initialized');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        // ✅ Use tenant-scoped collection
        const requestsRef = collection(db, `tenants/${validatedTenantId}/requests`);
        const q = query(
            requestsRef,
            where('branch', '==', branchId),
            where('status', 'in', [
                RequestStatus.PENDING_RECEPTION,
                RequestStatus.CONFIRMED,
                RequestStatus.IN_PROGRESS,
                RequestStatus.PENDING_HOUSEKEEPING,
                RequestStatus.PENDING_MAINTENANCE
            ])
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return 0;

        const batch = writeBatch(db);
        snapshot.docs.forEach(requestDoc => {
            batch.update(requestDoc.ref, {
                status: RequestStatus.CANCELLED,
                isCancelled: true,
                cancelReason: reason,
                completedBy: { id: userId, name: userName },
                completedAt: Timestamp.now(),
                'timeline.cancelled': Timestamp.now()
            });
        });

        await batch.commit();
        return snapshot.size;
    } catch (error) {
        logger.error('Error in cascading request cancellation', error, 'requestService');
        throw error;
    }
};

// ============================================================
// BACKWARD COMPATIBILITY
// ============================================================

/**
 * @deprecated Use createRequest instead
 */
export const addRequest = createRequest;

/**
 * @deprecated Use startRequest instead
 */
export const startWork = startRequest;
