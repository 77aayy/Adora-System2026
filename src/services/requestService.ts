/**
 * Request Service - Complete CRUD Operations
 * High quality, production-ready service
 * Adora Hotel Management System V3
 * 
 * @module requestService
 * @description
 * This service manages all guest/room service requests across departments:
 * Reception, Housekeeping, Bellman, Maintenance, and Procurement.
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
 * - Multi-tenant data isolation
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
import { db } from './firebase';
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
import { awardPerformancePoints, awardRatingPoints, awardPoints, getPointsConfig } from './pointsService'; // ✅ Unified Points System

const REQUESTS_COLLECTION = 'requests';

// ============================================================
// CREATE
// ============================================================

/**
 * Creates a new service request in the system
 * 
 * ## Business Logic:
 * 1. **Target Time**: Auto-calculates completion target based on config
 * 2. **Initial Department**: Routes to appropriate department by type
 * 3. **Journey Tracking**: Initializes departmentHistory for workflow
 * 4. **Attendance**: Auto-checks employee attendance on activity
 * 
 * ## Request Routing:
 * - `cleaning/inspection` → Housekeeping
 * - `maintenance` → Maintenance
 * - `bellman` → Bellman
 * - `procurement` → Procurement
 * - Others → Reception
 * 
 * ## Side Effects:
 * - Creates document in `requests` collection
 * - Triggers attendance check for creating employee
 * 
 * @param input - Request creation data (type, room, guest, etc.)
 * @param branch - Branch ID where request originates
 * @param userId - Creating employee's ID
 * @param userName - Creating employee's name
 * @returns Promise<string> - The created request ID
 * @throws Error if creation fails
 * 
 * @example
 * ```typescript
 * const requestId = await createRequest({
 *   type: RequestType.CLEANING,
 *   roomNumber: '101',
 *   guestName: 'محمد أحمد',
 *   priority: RequestPriority.NORMAL,
 *   tenantId: tenantId
 * }, branchId, userId, userName);
 * ```
 */
export const createRequest = async (
    input: CreateRequestInput,
    branch: string,
    userId: string,
    userName: string
): Promise<string> => {
    try {
        // 🕰️ Intelligent Target Time Assignment (Procurement)
        let targetCompletionTime = input.targetCompletionTime ? Timestamp.fromDate(input.targetCompletionTime) : undefined;

        if (input.type === RequestType.PROCUREMENT && input.tenantId && !targetCompletionTime) {
            // If no target time manually set, check configuration for default
            const config = await getPointsConfig(input.tenantId, branch);
            const procurementConfig = config.procurement;

            if (procurementConfig) {
                let defaultMinutes = procurementConfig.targetTime || 60;

                // Determine source department based on creator or explicit source
                // Using string comparison for flexibility with different source formats
                const sourceStr = String(input.source || '').toUpperCase();

                if (sourceStr === 'HOUSEKEEPING') {
                    defaultMinutes = procurementConfig.targetTimeHousekeeping || 60;
                } else if (sourceStr === 'MAINTENANCE') {
                    defaultMinutes = procurementConfig.targetTimeMaintenance || 4320;
                } else if (sourceStr === 'RECEPTION') {
                    defaultMinutes = procurementConfig.targetTimeReception || 1440;
                }

                // Add minutes to now
                const now = new Date();
                targetCompletionTime = Timestamp.fromDate(new Date(now.getTime() + defaultMinutes * 60000));
            }
        }

        // ✅ Determine initial department based on type
        let initialDepartment = 'reception'; // Default
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

            branch, // This is expected to be branchId
            tenantId: input.tenantId, // ✅ SaaS requirement

            createdBy: {
                id: userId,
                name: userName,
                department: initialDepartment
            },

            createdAt: Timestamp.now(),

            details: input.details || {},
            notes: input.notes,
            photos: input.photos,

            targetCompletionTime: targetCompletionTime, // ✅ Auto-calculated or Manual
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

        const docRef = await addDoc(collection(db, REQUESTS_COLLECTION), requestData);
        
        // ✅ FIX: Auto-check daily attendance when employee creates a request
        // This ensures attendance is tracked when employee is active
        if (input.tenantId && userId) {
            try {
                const { checkDailyAttendance } = await import('./challengeService');
                // Fire and forget - don't block request creation if attendance check fails
                checkDailyAttendance(input.tenantId, userId).catch(err => {
                    console.warn('Failed to check daily attendance after request creation:', err);
                });
            } catch (err) {
                console.warn('Could not load challengeService for attendance check:', err);
            }
        }
        
        return docRef.id;
    } catch (error) {
        console.error('Error creating request:', error);
        throw new Error('Failed to create request');
    }
};

// ============================================================
// READ
// ============================================================

/**
 * Get request by ID
 */
export const getRequest = async (requestId: string): Promise<Request | null> => {
    try {
        const docRef = doc(db, REQUESTS_COLLECTION, requestId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Request;
        }
        return null;
    } catch (error) {
        console.error('Error getting request:', error);
        return null;
    }
};

/**
 * Get all requests for a branch
 */
export const getRequestsByBranch = async (
    branch: string,
    status?: RequestStatus,
    limitCount?: number,
    tenantId?: string // ✅ Isolation
): Promise<Request[]> => {
    try {
        // Build constraints
        const constraints: any[] = [where('branch', '==', branch)];
        if (tenantId) constraints.push(where('tenantId', '==', tenantId));
        if (status) constraints.push(where('status', '==', status));

        constraints.push(orderBy('createdAt', 'desc'));
        if (limitCount) constraints.push(limit(limitCount));

        const q = query(
            collection(db, REQUESTS_COLLECTION),
            ...constraints
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Request));
    } catch (error) {
        console.error('Error getting requests:', error);
        return [];
    }
};

/**
 * Get requests by room number
 */
export const getRequestsByRoom = async (
    branch: string,
    roomNumber: string,
    tenantId?: string // ✅ Isolation
): Promise<Request[]> => {
    try {
        const constraints: any[] = [
            where('branch', '==', branch),
            where('roomNumber', '==', roomNumber)
        ];
        if (tenantId) constraints.push(where('tenantId', '==', tenantId));
        constraints.push(orderBy('createdAt', 'desc'));

        const q = query(
            collection(db, REQUESTS_COLLECTION),
            ...constraints
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Request));
    } catch (error) {
        console.error('Error getting requests by room:', error);
        return [];
    }
};

/**
 * Get today's requests
 */
export const getTodayRequests = async (branch: string, tenantId?: string): Promise<Request[]> => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const constraints: any[] = [
            where('branch', '==', branch),
            where('createdAt', '>=', Timestamp.fromDate(today))
        ];
        if (tenantId) constraints.push(where('tenantId', '==', tenantId));
        constraints.push(orderBy('createdAt', 'desc'));

        const q = query(
            collection(db, REQUESTS_COLLECTION),
            ...constraints
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Request));
    } catch (error) {
        console.error('Error getting today requests:', error);
        return [];
    }
};

// ============================================================
// UPDATE
// ============================================================

/**
 * Update request
 */
export const updateRequest = async (
    requestId: string,
    data: UpdateRequestInput
): Promise<void> => {
    try {
        const docRef = doc(db, REQUESTS_COLLECTION, requestId);
        await updateDoc(docRef, {
            ...data,
            modifiedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error updating request:', error);
        throw new Error('Failed to update request');
    }
};

/**
 * Confirms a pending request (Reception workflow)
 * 
 * ## Business Logic:
 * - Updates status to CONFIRMED
 * - Records confirming employee
 * - Calculates response time for points
 * - Awards performance points to reception
 * 
 * ## Points Calculation:
 * Response time = confirmedAt - createdAt (in minutes)
 * Points awarded based on speed (fast/normal/late)
 * 
 * ## Side Effects:
 * - Updates request document
 * - Awards points to confirming employee
 * - Updates timeline.confirmed timestamp
 * 
 * @param requestId - The request to confirm
 * @param userId - Confirming employee's ID
 * @param userName - Confirming employee's name
 */
export const confirmRequest = async (
    requestId: string,
    userId: string,
    userName: string
): Promise<void> => {
    try {
        const docRef = doc(db, REQUESTS_COLLECTION, requestId);
        await updateDoc(docRef, {
            status: RequestStatus.CONFIRMED,
            confirmedBy: {
                id: userId,
                name: userName
            },
            confirmedAt: Timestamp.now(),
            'timeline.confirmed': Timestamp.now()
        });

        // 💰 Award Points: Reception Confirmation
        const request = await getRequest(requestId);
        if (request && request.tenantId) {
            // Reception points for confirming request
            // Calculate time taken to confirm
            const createdAt = request.createdAt.toDate();
            const confirmedAt = new Date();
            const minutesTaken = Math.floor((confirmedAt.getTime() - createdAt.getTime()) / 60000);

            // Pass duration to points service for speed calculation
            await awardPerformancePoints(request.tenantId, userId, 'reception', 'confirm', minutesTaken);
        }

    } catch (error) {
        console.error('Error confirming request:', error);
        throw new Error('Failed to confirm request');
    }
};

/**
 * Marks a request as in-progress (Employee starts work)
 * 
 * ## Business Logic:
 * - Assigns employee to the request
 * - Sets status to IN_PROGRESS
 * - Records start time for duration tracking
 * 
 * ## Side Effects:
 * - Updates request with assignedTo
 * - Sets startedAt timestamp
 * - Updates timeline.started
 * 
 * @param requestId - The request to start
 * @param userId - Working employee's ID
 * @param userName - Working employee's name
 */
export const startRequest = async (
    requestId: string,
    userId: string,
    userName: string
): Promise<void> => {
    try {
        const docRef = doc(db, REQUESTS_COLLECTION, requestId);
        await updateDoc(docRef, {
            status: RequestStatus.IN_PROGRESS,
            assignedTo: {
                id: userId,
                name: userName
            },
            startedAt: Timestamp.now(),
            'timeline.started': Timestamp.now()
        });
    } catch (error) {
        console.error('Error starting request:', error);
        throw new Error('Failed to start request');
    }
};

/**
 * Completes a request (Task finished)
 * 
 * ## Business Logic:
 * 1. Sets status to COMPLETED
 * 2. Records completing employee
 * 3. Analyzes feedback sentiment (AI)
 * 4. Awards performance points
 * 5. Deducts inventory for consumable requests
 * 6. Auto-creates follow-up for critical issues
 * 
 * ## Points Calculation:
 * - Duration = completedAt - startedAt (minutes)
 * - Target = targetCompletionTime - createdAt (minutes)
 * - Fast completion = bonus points
 * - Late completion = penalty
 * 
 * ## AI Crisis Routing:
 * If feedback sentiment is NEGATIVE with high severity:
 * - CRITICAL: Creates emergency VIP_SERVICE request
 * - MODERATE: Logged for SmartAlerts dashboard
 * 
 * ## Inventory Deduction:
 * For MINIBAR/COFFEE/AMENITIES requests:
 * - Finds matching inventory items by name
 * - Deducts consumed quantities
 * 
 * ## Side Effects:
 * - Updates request document
 * - Awards points to employee
 * - May deduct inventory
 * - May create emergency request
 * 
 * @param requestId - The request to complete
 * @param userId - Completing employee's ID
 * @param userName - Completing employee's name
 * @param rating - Optional guest rating (1-5)
 * @param feedback - Optional guest feedback text
 */
export const completeRequest = async (
    requestId: string,
    userId: string,
    userName: string,
    rating?: number,
    feedback?: string
): Promise<void> => {
    try {
        const docRef = doc(db, REQUESTS_COLLECTION, requestId);

        let sentimentResult = null;
        if (feedback) {
            sentimentResult = await analyzeFeedback(feedback);
        }

        await updateDoc(docRef, {
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

        const request = await getRequest(requestId);
        if (request && request.tenantId) {

            // 📦 INVENTORY DEDUCTION (QR / Minibar / Coffee)
            if (request.status === RequestStatus.COMPLETED && request.details?.items) {
                // Determine if this request involves consumable items
                const isConsumable = [
                    RequestType.MINIBAR,
                    RequestType.COFFEE,
                    RequestType.AMENITIES
                ].includes(request.type);

                if (isConsumable && Array.isArray(request.details.items)) {
                    // Dynamic Import to avoid circular dependencies if any
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
                                    console.log(`✅ Inventory Deducted: ${item.name} (-${item.quantity})`);
                                }
                            } catch (invError) {
                                console.error(`⚠️ Inventory sync failed for ${item.name}:`, invError);
                            }
                        }
                    }
                }
            }

            // 💰 Award Points: Task Completion (Maintenance, Bellman, etc)
            let department: 'maintenance' | 'bellman' | 'housekeeping' | 'reception' | 'procurement' | null = null;
            let action = 'completeRequest'; // Default action

            if (request.type === RequestType.MAINTENANCE) {
                department = 'maintenance';
                action = 'complete'; // Matches config key
            }
            else if (request.type === RequestType.BELLMAN) department = 'bellman';
            else if (request.type === RequestType.CLEANING) department = 'housekeeping';
            else if (request.type === RequestType.PROCUREMENT) {
                department = 'procurement';
                action = 'purchase'; // Matches config key
            }

            if (department) {
                // Calculate duration in minutes
                const startTime = request.startedAt ? request.startedAt.toDate() : request.createdAt.toDate();
                const endTime = new Date();
                const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);

                // Calculate Target Minutes if applicable
                let targetMinutes = 0;
                if (request.targetCompletionTime) {
                    const targetTime = request.targetCompletionTime.toDate();
                    const createdTime = request.createdAt.toDate();
                    // Target duration in minutes relative to CREATION time
                    targetMinutes = Math.floor((targetTime.getTime() - createdTime.getTime()) / 60000);
                }

                await awardPerformancePoints(request.tenantId, userId, department, action, durationMinutes, targetMinutes);

                // ⭐ Award Rating Points
                if (rating && department !== 'procurement') {
                    // Ratings usually apply to service departments
                    if (department === 'bellman' || department === 'housekeeping' || department === 'maintenance' || department === 'reception') {
                        await awardRatingPoints(request.tenantId, userId, department, rating);
                    }
                }
            }
        }

        // 🚨 ADORA CRISIS ROUTING: Action depends on Severity
        if (sentimentResult?.sentiment === 'Negative' && sentimentResult.score > 0.7) {
            const original = await getRequest(requestId);
            if (!original) return;

            if (sentimentResult.severity === 'CRITICAL') {
                // Trigger Emergency for Infrastructure
                await createRequest({
                    type: RequestType.VIP_SERVICE,
                    roomNumber: original.roomNumber,
                    guestName: original.guestName,
                    priority: RequestPriority.EMERGENCY,
                    source: RequestSource.AUTO,
                    notes: `🚨 AI CRISIS ALERT: [CRITICAL INFRASTRUCTURE] Issue: ${sentimentResult.issue}. Summary: ${sentimentResult.summary}. Recovery Strategy: ${sentimentResult.suggestedRecovery}. Resolve immediately!`,
                    tenantId: original.tenantId
                }, original.branch, 'AI_GUARDIAN', 'Adora AI');
            } else if (sentimentResult.severity === 'MODERATE') {
                // MODERATE issues are surfaced via SmartAlerts (pulled by dashboard)
                // We just ensure the metadata is there.
                console.log(`[Adora AI] Service Issue detected. Recovery suggested: ${sentimentResult.suggestedRecovery}`);
            }
        }
    } catch (error) {
        console.error('Error completing request:', error);
        throw new Error('Failed to complete request');
    }
};

/**
 * ✅ Transfer request to another department
 * Tracks the complete journey of the request through departments
 */
export const transferRequestToDepartment = async (
    requestId: string,
    fromDepartment: string,
    toDepartment: string,
    userId: string,
    userName: string,
    status?: RequestStatus,
    notes?: string
): Promise<void> => {
    try {
        const docRef = doc(db, REQUESTS_COLLECTION, requestId);
        const request = await getRequest(requestId);
        
        if (!request) {
            throw new Error('Request not found');
        }

        const now = Timestamp.now();
        const history = request.departmentHistory || [];
        
        // Update the last entry's exit time
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

        // Add new department entry
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

        await updateDoc(docRef, {
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
    } catch (error) {
        console.error('Error transferring request:', error);
        throw new Error('Failed to transfer request');
    }
};

/**
 * ✅ Confirm completion and close the request circle
 * Used when a department receives a completed request and confirms it
 */
export const confirmCompletion = async (
    requestId: string,
    userId: string,
    userName: string,
    department: string
): Promise<void> => {
    try {
        const docRef = doc(db, REQUESTS_COLLECTION, requestId);
        const request = await getRequest(requestId);
        
        if (!request) {
            throw new Error('Request not found');
        }

        const now = Timestamp.now();
        const history = request.departmentHistory || [];
        
        // Update the last entry to mark as confirmed
        if (history.length > 0) {
            const lastEntry = history[history.length - 1];
            if (lastEntry.department === department) {
                lastEntry.exitedAt = now;
                lastEntry.status = RequestStatus.COMPLETED;
            }
        }

        await updateDoc(docRef, {
            status: RequestStatus.COMPLETED,
            completedAt: now,
            'timeline.completed': now,
            departmentHistory: history,
            currentDepartment: undefined, // No longer in any department
            modifiedAt: now,
            modifiedBy: {
                id: userId,
                name: userName,
                department: department
            }
        });
    } catch (error) {
        console.error('Error confirming completion:', error);
        throw new Error('Failed to confirm completion');
    }
};

/**
 * Cancel request
 */
export const cancelRequest = async (
    requestId: string,
    userId: string,
    userName: string,
    reason: string
): Promise<void> => {
    try {
        const docRef = doc(db, REQUESTS_COLLECTION, requestId);
        await updateDoc(docRef, {
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
        console.error('Error cancelling request:', error);
        throw new Error('Failed to cancel request');
    }
};

/**
 * Assign request to employee
 */
export const assignRequest = async (
    requestId: string,
    employeeId: string,
    employeeName: string
): Promise<void> => {
    try {
        const docRef = doc(db, REQUESTS_COLLECTION, requestId);
        await updateDoc(docRef, {
            assignedTo: {
                id: employeeId,
                name: employeeName
            },
            modifiedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error assigning request:', error);
        throw new Error('Failed to assign request');
    }
};

// ============================================================
// DELETE
// ============================================================

/**
 * Delete request (soft delete by setting status to cancelled)
 */
export const deleteRequest = async (requestId: string): Promise<void> => {
    try {
        const docRef = doc(db, REQUESTS_COLLECTION, requestId);
        // Soft delete: mark as cancelled instead of actual deletion
        await updateDoc(docRef, {
            status: RequestStatus.CANCELLED,
            isCancelled: true,
            cancelReason: 'Deleted by user',
            modifiedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error deleting request:', error);
        throw new Error('Failed to delete request');
    }
};

// ============================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================

/**
 * Subscribes to real-time request updates for a branch
 * 
 * ## Business Logic:
 * - Returns requests for specified branch
 * - Optionally filters by status
 * - Sorted by creation date (newest first)
 * - Updates callback on any change
 * 
 * ## Security:
 * - Filters by tenantId for data isolation
 * 
 * ## Side Effects:
 * - Creates Firestore listener (cleanup required)
 * 
 * @param branch - Branch ID to filter by
 * @param callback - Function called with updated requests
 * @param status - Optional status filter
 * @param tenantId - Tenant ID for isolation
 * @returns Unsubscribe function
 * 
 * @example
 * ```typescript
 * useEffect(() => {
 *   const unsub = subscribeToRequests(
 *     branchId,
 *     setRequests,
 *     RequestStatus.PENDING_RECEPTION,
 *     tenantId
 *   );
 *   return () => unsub();
 * }, [branchId, tenantId]);
 * ```
 */
export const subscribeToRequests = (
    branch: string,
    callback: (requests: Request[]) => void,
    status?: RequestStatus,
    tenantId?: string,
    maxResults: number = 50 // ⚡ PERFORMANCE: Limit results
): Unsubscribe => {
    try {
        const constraints: any[] = [where('branch', '==', branch)];
        if (tenantId) constraints.push(where('tenantId', '==', tenantId));
        if (status) constraints.push(where('status', '==', status));
        constraints.push(orderBy('createdAt', 'desc'));
        constraints.push(limit(maxResults)); // ⚡ LIMIT

        const q = query(
            collection(db, REQUESTS_COLLECTION),
            ...constraints
        );

        return onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Request));
            callback(requests);
        }, (error) => {
            console.error('Error in requests subscription:', error);
            callback([]);
        });
    } catch (error) {
        console.error('Error setting up subscription:', error);
        return () => { };
    }
};

/**
 * Subscribe to requests for MULTIPLE branches
 * Used for employees/managers assigned to multiple branches
 * Firestore 'in' query limit: max 30 values
 * ⚡ PERFORMANCE: Added maxResults limit
 */
export const subscribeToMultipleBranches = (
    branches: string[],
    callback: (requests: Request[]) => void,
    options?: {
        status?: RequestStatus;
        type?: RequestType;
        maxResults?: number; // ⚡ Added
    }
): Unsubscribe => {
    const maxResults = options?.maxResults || 50; // ⚡ Default limit
    
    // If only one branch, use the simpler query
    if (branches.length === 1) {
        return subscribeToRequests(branches[0], callback, options?.status, undefined, maxResults);
    }

    // If no branches, return empty
    if (branches.length === 0) {
        callback([]);
        return () => { };
    }

    try {
        // Firestore 'in' query supports max 30 values
        const branchesToQuery = branches.slice(0, 30);

        let q = query(
            collection(db, REQUESTS_COLLECTION),
            where('branch', 'in', branchesToQuery),
            orderBy('createdAt', 'desc'),
            limit(maxResults) // ⚡ LIMIT
        );

        if (options?.status) {
            q = query(q, where('status', '==', options.status));
        }

        // Note: type filtering will be done client-side to avoid composite index
        return onSnapshot(q, (snapshot) => {
            let requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Request));

            // Client-side type filter if needed
            if (options?.type) {
                requests = requests.filter(r => r.type === options.type);
            }

            callback(requests);
        }, (error) => {
            console.error('Error in multi-branch subscription:', error);
            callback([]);
        });
    } catch (error) {
        console.error('Error setting up multi-branch subscription:', error);
        return () => { };
    }
};

/**
 * Subscribe to a single request
 */
export const subscribeToRequest = (
    requestId: string,
    callback: (request: Request | null) => void
): Unsubscribe => {
    try {
        const docRef = doc(db, REQUESTS_COLLECTION, requestId);

        return onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                callback({ id: doc.id, ...doc.data() } as Request);
            } else {
                callback(null);
            }
        }, (error) => {
            console.error('Error in request subscription:', error);
            callback(null);
        });
    } catch (error) {
        console.error('Error setting up subscription:', error);
        return () => { };
    }
};

// ============================================================
// BATCH OPERATIONS
// ============================================================

/**
 * Bulk confirm requests
 */
export const bulkConfirmRequests = async (
    requestIds: string[],
    userId: string,
    userName: string
): Promise<void> => {
    try {
        const batch = writeBatch(db);

        requestIds.forEach(requestId => {
            const docRef = doc(db, REQUESTS_COLLECTION, requestId);
            batch.update(docRef, {
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
        console.error('Error bulk confirming requests:', error);
        throw new Error('Failed to bulk confirm requests');
    }
};

/**
 * Bulk complete requests
 */
export const bulkCompleteRequests = async (
    requestIds: string[],
    userId: string,
    userName: string
): Promise<void> => {
    try {
        const batch = writeBatch(db);

        requestIds.forEach(requestId => {
            const docRef = doc(db, REQUESTS_COLLECTION, requestId);
            batch.update(docRef, {
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
        console.error('Error bulk completing requests:', error);
        throw new Error('Failed to bulk complete requests');
    }
};

// ============================================================
// ANALYTICS
// ============================================================

/**
 * Get request statistics
 */
export const getRequestStats = async (branch: string, startDate?: Date, endDate?: Date, tenantId?: string) => {
    try {
        const constraints: any[] = [where('branch', '==', branch)];
        if (tenantId) constraints.push(where('tenantId', '==', tenantId));

        if (startDate) {
            constraints.push(where('createdAt', '>=', Timestamp.fromDate(startDate)));
        }
        if (endDate) {
            constraints.push(where('createdAt', '<=', Timestamp.fromDate(endDate)));
        }

        const q = query(
            collection(db, REQUESTS_COLLECTION),
            ...constraints
        );

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
        console.error('Error getting request stats:', error);
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
// BACKWARD COMPATIBILITY (for existing code)
// ============================================================

/**
 * @deprecated Use createRequest instead
 */
export const addRequest = createRequest;

/**
 * @deprecated Use startRequest instead
 */
export const startWork = startRequest;

// ============================================================
// WHATSAPP-STYLE TRACKING (Phase 11)
// ============================================================

// Re-export for backward compatibility (type now in ../types/request.ts)
export type { ReadReceiptStatus };

/**
 * Mark request as delivered to department
 */
export async function markAsDelivered(
    requestId: string,
    department: string
): Promise<void> {
    const requestRef = doc(db, REQUESTS_COLLECTION, requestId);
    await updateDoc(requestRef, {
        currentDepartment: department,
        deliveredAt: Timestamp.now(),
    });
}

/**
 * Mark request as viewed by user
 */
export async function markAsViewed(
    requestId: string,
    userId: string,
    userName: string,
    department: string
): Promise<void> {
    const requestRef = doc(db, REQUESTS_COLLECTION, requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) return;

    const data = requestDoc.data();
    const viewedBy = data.viewedBy || [];

    // Check if already viewed by this user
    const alreadyViewed = viewedBy.some((v: any) => v.userId === userId);
    if (alreadyViewed) return;

    // Add to viewedBy array
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
}

/**
 * Get read receipt status for a request
 */
export function getReadStatus(request: Request): ReadReceiptStatus {
    // If someone viewed it -> read
    if (request.viewedBy && request.viewedBy.length > 0) {
        return 'read';
    }

    // If delivered to department -> delivered
    if (request.deliveredAt || request.confirmedAt) {
        return 'delivered';
    }

    // Otherwise -> sent
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
 * Used when a branch is deleted or disabled
 */
export const cancelAllActiveRequestsByBranch = async (
    tenantId: string,
    branchId: string,
    userId: string,
    userName: string,
    reason: string = 'تعطيل أو حذف الفرع'
): Promise<number> => {
    try {
        const q = query(
            collection(db, REQUESTS_COLLECTION),
            where('tenantId', '==', tenantId),
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
        console.error('Error in cascading request cancellation:', error);
        throw error;
    }
};
