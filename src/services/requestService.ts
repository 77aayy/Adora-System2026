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
import { db, auth, functions as firebaseFunctions, httpsCallable } from './firebase';
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
import {
    confirmCompletionPayloadSchema,
    completeRequestPayloadSchema,
    transferRequestPayloadSchema
} from '../schemas/requestSchemas';

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
        // F2: Idempotency — if key provided, return existing request id when duplicate within last 2 minutes
        // Note: Firestore may require a composite index on (idempotencyKey, createdAt) for this query
        if (input.idempotencyKey) {
            const twoMinutesAgo = Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 1000));
            const requestsRef = collection(db, 'tenants', tenantId, 'requests');
            const q = query(
                requestsRef,
                where('idempotencyKey', '==', input.idempotencyKey),
                where('createdAt', '>=', twoMinutesAgo),
                limit(1)
            );
            const existing = await getDocs(q);
            if (!existing.empty) {
                const existingId = existing.docs[0].id;
                logger.info(`F2: Idempotent createRequest — returning existing id ${existingId}`, undefined, 'requestService');
                return existingId;
            }
        }

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
        } else if (input.type === RequestType.COFFEE || input.type === RequestType.MINIBAR) {
            initialDepartment = 'coffee_shop'; // ✅ Coffee shop department
        }

        const requestData: Omit<Request, 'id'> & { idempotencyKey?: string } = {
            type: input.type,
            status: RequestStatus.NEW, // ✅ Unified: Always start as NEW
            priority: input.priority || RequestPriority.NORMAL,
            source: input.source || RequestSource.RECEPTION,

            roomNumber: input.roomNumber,
            guestName: input.guestName,

            branch,
            tenantId, // ✅ SaaS requirement

            ...(input.idempotencyKey && { idempotencyKey: input.idempotencyKey }),

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
        
        // ✅ STEP 4.3: Initialize Unified State Machine (if feature enabled)
        // This ensures new requests have all unified state fields (involvedDepartments, isActionRequiredByReception, stateHistory)
        try {
            const { isFeatureEnabled } = await import('./featureFlagsService');
            const useUnifiedStateMachine = await isFeatureEnabled(tenantId, 'useUnifiedStateMachine');
            
            if (useUnifiedStateMachine) {
                const { initializeRequest } = await import('./stateTransitionService');
                const { REQUEST_TYPE_TO_DEPARTMENT, DEPARTMENTS } = await import('./workflowService');
                
                // Determine target department from request type
                const targetDepartment = REQUEST_TYPE_TO_DEPARTMENT[input.type] || DEPARTMENTS.RECEPTION;
                
                await initializeRequest(
                    tenantId,
                    docRef.id,
                    input.type,
                    initialDepartment as any,
                    targetDepartment,
                    userId,
                    userName,
                    input.notes || 'تم إنشاء الطلب'
                );
                logger.info('Unified State Machine initialized for new request', { requestId: docRef.id }, 'requestService');
            }
        } catch (initError: any) {
            // Non-critical: Log but don't fail request creation
            logger.warn('Failed to initialize Unified State Machine (non-critical)', initError, 'requestService');
        }
        
        // ✅ STEP 4.5: Check if target department is disabled and transfer immediately
        try {
            const { checkImmediateTransferForDisabledDepartment } = await import('./autoTransferService');
            // Check if the target department is disabled and transfer immediately if auto-transfer rule exists
            checkImmediateTransferForDisabledDepartment(
                docRef.id,
                initialDepartment,
                tenantId,
                branch
            ).catch(err => {
                logger.warn('Failed to check immediate transfer for disabled department', err, 'requestService');
            });
        } catch (err) {
            logger.warn('Could not load autoTransferService for immediate transfer check', err, 'requestService');
        }
        
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

        // ✅ Use Unified State Machine
        try {
            const { moveRequest } = await import('./stateTransitionService');
            const { REQUEST_TYPE_TO_DEPARTMENT, DEPARTMENTS } = await import('./workflowService');
            
            // Determine target department from request type
            const targetDepartment = REQUEST_TYPE_TO_DEPARTMENT[request.type] || DEPARTMENTS.RECEPTION;
            
            // Confirm = Keep status as NEW but ensure it's ready for target department
            await moveRequest(
                validatedTenantId,
                requestId,
                'NEW',
                targetDepartment,
                userId,
                userName,
                'تم تأكيد الطلب'
            );
            
            // Update legacy fields for backward compatibility
            const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
            await updateDoc(requestRef, {
                confirmedBy: {
                    id: userId,
                    name: userName
                },
                confirmedAt: Timestamp.now(),
                'timeline.confirmed': Timestamp.now()
            });
        } catch (stateMachineError: any) {
            // Fallback to legacy update if State Machine fails
            logger.warn('State Machine failed, using legacy update', stateMachineError, 'requestService');
            const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
            await updateDoc(requestRef, {
                status: RequestStatus.NEW,
                confirmedBy: {
                    id: userId,
                    name: userName
                },
                confirmedAt: Timestamp.now(),
                'timeline.confirmed': Timestamp.now()
            });
        }

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
                    description: `تم تأكيد الطلب من ${oldStatus} إلى NEW`,
                    previousValue: oldStatus,
                    newValue: RequestStatus.NEW,
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
        const currentDept = request.currentDepartment || 'reception';

        // ✅ Use Unified State Machine
        try {
            const { moveRequest } = await import('./stateTransitionService');
            
            await moveRequest(
                validatedTenantId,
                requestId,
                'IN_PROGRESS',
                currentDept as any,
                userId,
                userName,
                'بدأ العمل على الطلب'
            );
            
            // Update legacy fields for backward compatibility
            const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
            await updateDoc(requestRef, {
                assignedTo: {
                    id: userId,
                    name: userName
                },
                startedAt: Timestamp.now(),
                'timeline.started': Timestamp.now()
            });
        } catch (stateMachineError: any) {
            // Fallback to legacy update if State Machine fails
            logger.warn('State Machine failed, using legacy update', stateMachineError, 'requestService');
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
        }

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
                    description: `تم بدء العمل على الطلب من ${oldStatus} إلى IN_PROGRESS`,
                    previousValue: oldStatus,
                    newValue: 'IN_PROGRESS',
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
    const payload = completeRequestPayloadSchema.safeParse({
        requestId,
        tenantId,
        userId,
        userName,
        rating,
        feedback
    });
    if (!payload.success) {
        const msg = payload.error.issues[0]?.message ?? 'بيانات غير صحيحة';
        throw new Error(msg);
    }
    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    if (!firebaseFunctions) {
        logger.error('Firebase Functions not initialized - cannot complete request', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const request = await getRequest(requestId, validatedTenantId);
    if (!request) {
        throw new Error('Request not found');
    }
    const oldStatus = request.status;

    let sentimentResult: { sentiment?: string; [key: string]: unknown } | null = null;
    if (feedback) {
        sentimentResult = await analyzeFeedback(feedback);
    }

    try {
        const requestCompleteFn = httpsCallable<
            { requestId: string; tenantId: string; userId: string; userName: string; rating?: number; feedback?: string; sentimentResult?: Record<string, unknown> },
            { success: boolean }
        >(firebaseFunctions, 'requestComplete');
        await requestCompleteFn({
            requestId,
            tenantId: validatedTenantId,
            userId,
            userName,
            ...(rating !== undefined && { rating }),
            ...(feedback !== undefined && { feedback }),
            ...(sentimentResult !== null && { sentimentResult: sentimentResult as Record<string, unknown> })
        });
    } catch (err: unknown) {
        const msg = (err as { message?: string })?.message ?? '';
        logger.error('Error completing request', err, 'requestService');
        throw new Error(msg || 'فشل إكمال الطلب. يرجى المحاولة مرة أخرى.');
    }

    try {
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
                    description: `تم إتمام الطلب من ${oldStatus} إلى COMPLETED${rating ? ` - تقييم: ${rating}` : ''}`,
                    previousValue: oldStatus,
                    newValue: 'COMPLETED',
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
            // 📦 INVENTORY DEDUCTION (request completed via CF above)
            if (request.details?.items) {
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
    const payload = transferRequestPayloadSchema.safeParse({
        requestId,
        tenantId,
        targetDepartment: toDepartment,
        userId,
        userName,
        fromDepartment,
        status: status != null ? String(status) : undefined,
        notes
    });
    if (!payload.success) {
        const msg = payload.error.issues[0]?.message ?? 'بيانات غير صحيحة';
        throw new Error(msg);
    }
    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    if (!firebaseFunctions) {
        logger.error('Firebase Functions not initialized - cannot transfer request', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const request = await getRequest(requestId, validatedTenantId);
    if (!request) {
        throw new Error('Request not found');
    }
    const oldDepartment = request.currentDepartment || fromDepartment;
    const oldStatus = request.status;

    try {
        const requestTransferFn = httpsCallable<
            {
                requestId: string;
                tenantId: string;
                targetDepartment: string;
                userId: string;
                userName: string;
                fromDepartment?: string;
                status?: string;
                notes?: string;
            },
            { success: boolean }
        >(firebaseFunctions, 'requestTransferToDepartment');
        await requestTransferFn({
            requestId,
            tenantId: validatedTenantId,
            targetDepartment: toDepartment,
            userId,
            userName,
            fromDepartment,
            status: status != null ? String(status) : undefined,
            notes
        });
    } catch (err: unknown) {
        const msg = (err as { message?: string })?.message ?? '';
        logger.error('Error transferring request', err, 'requestService');
        throw new Error(msg || 'فشل نقل الطلب. يرجى المحاولة مرة أخرى.');
    }

    try {
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
    const payload = confirmCompletionPayloadSchema.safeParse({
        requestId,
        tenantId,
        userId,
        userName,
        department
    });
    if (!payload.success) {
        const msg = payload.error.issues[0]?.message ?? 'بيانات غير صحيحة';
        throw new Error(msg);
    }
    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    if (!firebaseFunctions) {
        logger.error('Firebase Functions not initialized - cannot confirm completion', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    try {
        const requestConfirmCompletionFn = httpsCallable<
            { requestId: string; tenantId: string; userId: string; userName: string; department: string },
            { success: boolean }
        >(firebaseFunctions, 'requestConfirmCompletion');
        await requestConfirmCompletionFn({
            requestId,
            tenantId: validatedTenantId,
            userId,
            userName,
            department
        });
    } catch (error: unknown) {
        const msg = (error as { message?: string })?.message ?? '';
        logger.error('Error confirming completion', error, 'requestService');
        throw new Error(msg || 'فشل تأكيد الإكمال. يرجى المحاولة مرة أخرى.');
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

/** F6: Result of bulk confirm/complete */
export interface BulkResult {
    successCount: number;
    failedCount: number;
    failedIds?: string[];
}

/**
 * Bulk confirm requests
 * 🔐 SECURITY: Validates tenant access
 * F6: Returns successCount and failedCount (and failedIds on partial failure)
 */
export const bulkConfirmRequests = async (
    requestIds: string[],
    tenantId: string,
    userId: string,
    userName: string
): Promise<BulkResult> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot bulk confirm requests', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    let successCount = 0;
    const failedIds: string[] = [];

    try {
        const batch = writeBatch(db);
        let hasLegacyUpdates = false;

        for (const requestId of requestIds) {
            try {
                const { moveRequest } = await import('./stateTransitionService');
                const request = await getRequest(requestId, validatedTenantId);
                if (request) {
                    const { REQUEST_TYPE_TO_DEPARTMENT, DEPARTMENTS } = await import('./workflowService');
                    const targetDepartment = REQUEST_TYPE_TO_DEPARTMENT[request.type] || DEPARTMENTS.RECEPTION;
                    await moveRequest(
                        validatedTenantId,
                        requestId,
                        'NEW',
                        targetDepartment,
                        userId,
                        userName,
                        'تم التأكيد الجماعي'
                    );
                    const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
                    await updateDoc(requestRef, {
                        confirmedBy: { id: userId, name: userName },
                        confirmedAt: Timestamp.now()
                    });
                    successCount++;
                } else {
                    failedIds.push(requestId);
                }
            } catch (err: any) {
                logger.warn(`Failed to confirm request ${requestId} using State Machine, using legacy update`, err, 'requestService');
                const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
                batch.update(requestRef, {
                    status: RequestStatus.NEW,
                    confirmedBy: { id: userId, name: userName },
                    confirmedAt: Timestamp.now()
                });
                hasLegacyUpdates = true;
                successCount++;
            }
        }

        if (hasLegacyUpdates) await batch.commit();
        return { successCount, failedCount: failedIds.length, ...(failedIds.length ? { failedIds } : {}) };
    } catch (error) {
        logger.error('Error bulk confirming requests', error, 'requestService');
        const failedCount = requestIds.length - successCount;
        throw new Error(
            failedCount > 0
                ? `فشل تأكيد ${failedCount} من ${requestIds.length}. تم تأكيد ${successCount}.`
                : 'فشل تأكيد الطلبات. يرجى المحاولة مرة أخرى.'
        );
    }
};

/**
 * Bulk complete requests
 * 🔐 SECURITY: Validates tenant access
 * F6: Returns successCount and failedCount (and failedIds on partial failure)
 */
export const bulkCompleteRequests = async (
    requestIds: string[],
    tenantId: string,
    userId: string,
    userName: string
): Promise<BulkResult> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot bulk complete requests', undefined, 'requestService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    let successCount = 0;
    const failedIds: string[] = [];

    try {
        const batch = writeBatch(db);
        let hasLegacyUpdates = false;

        for (const requestId of requestIds) {
            try {
                const { moveRequest } = await import('./stateTransitionService');
                const { DEPARTMENTS } = await import('./workflowService');
                await moveRequest(
                    validatedTenantId,
                    requestId,
                    'COMPLETED',
                    DEPARTMENTS.RECEPTION,
                    userId,
                    userName,
                    'تم الإكمال الجماعي'
                );
                const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
                await updateDoc(requestRef, {
                    completedBy: { id: userId, name: userName },
                    completedAt: Timestamp.now()
                });
                successCount++;
            } catch (err: any) {
                logger.warn(`Failed to complete request ${requestId} using State Machine`, err, 'requestService');
                const requestRef = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
                const snap = await getDoc(requestRef);
                const currentStatus = snap.exists() ? (snap.data().status || '').toString().toUpperCase() : '';
                const allowedForCompletion = ['IN_PROGRESS', 'CONFIRMED', 'IN PROGRESS'];
                if (allowedForCompletion.includes(currentStatus)) {
                    batch.update(requestRef, {
                        status: RequestStatus.COMPLETED,
                        currentDepartment: 'reception',
                        isActionRequiredByReception: true,
                        completedBy: { id: userId, name: userName },
                        completedAt: Timestamp.now()
                    });
                    hasLegacyUpdates = true;
                    successCount++;
                } else {
                    failedIds.push(requestId);
                }
            }
        }

        if (hasLegacyUpdates) await batch.commit();
        return { successCount, failedCount: failedIds.length, ...(failedIds.length ? { failedIds } : {}) };
    } catch (error: any) {
        logger.error('Error bulk completing requests', error, 'requestService');
        const failedCount = requestIds.length - successCount;
        const msg = failedCount > 0
            ? `فشل إكمال ${failedCount} من ${requestIds.length}. تم إكمال ${successCount}. يرجى التحقق من القائمة وإعادة المحاولة للباقي.`
            : 'فشل إكمال الطلبات. يرجى المحاولة مرة أخرى.';
        throw new Error(msg);
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

        // ✅ Unified: Use new status system
        return {
            total: requests.length,
            new: requests.filter(r => {
                const status = (r as any).status || r.status;
                return status === 'NEW' || status === 'PENDING_RECEPTION' || status === 'PENDING';
            }).length,
            inProgress: requests.filter(r => {
                const status = (r as any).status || r.status;
                return status === 'IN_PROGRESS' || status === 'CONFIRMED';
            }).length,
            completed: requests.filter(r => {
                const status = (r as any).status || r.status;
                return status === 'COMPLETED';
            }).length,
            // Legacy compatibility
            pending: requests.filter(r => {
                const status = (r as any).status || r.status;
                return status === 'NEW' || status === 'PENDING_RECEPTION' || status === 'PENDING';
            }).length,
            confirmed: requests.filter(r => {
                const status = (r as any).status || r.status;
                return status === 'NEW' || status === 'CONFIRMED';
            }).length,
            cancelled: requests.filter(r => {
                const status = (r as any).status || r.status;
                return status === 'CANCELLED' || (r as any).isCancelled;
            }).length,

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
