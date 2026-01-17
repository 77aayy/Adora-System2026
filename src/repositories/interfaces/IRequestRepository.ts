/**
 * Request Repository Interface
 * Defines the contract for service request operations
 * Adora Hotel Management System V3 - Repository Pattern
 * 
 * @interface IRequestRepository
 * @description
 * This interface abstracts request CRUD operations across all
 * departments (Reception, Housekeeping, Bellman, Maintenance).
 * 
 * ## Real-time Features:
 * - Must support live subscriptions for request updates
 * - Must maintain offline persistence compatibility
 * 
 * ## Multi-tenant Isolation:
 * - All operations must respect tenantId boundaries
 */

import { 
    Request, 
    RequestStatus, 
    RequestType,
    CreateRequestInput, 
    UpdateRequestInput 
} from '../../types/request';
import { Unsubscribe } from 'firebase/firestore';

/**
 * Request statistics for analytics
 */
export interface RequestStats {
    total: number;
    pending: number;
    confirmed: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    byType: {
        cleaning: number;
        maintenance: number;
        bellman: number;
        amenities: number;
    };
    avgResponseTime: number;
    avgCompletionTime: number;
}

/**
 * Request Repository Interface
 * Provides abstraction for all request-related operations
 */
export interface IRequestRepository {
    // ============================================================
    // CREATE
    // ============================================================

    /**
     * Creates a new service request
     * 
     * ## Business Rules:
     * - Auto-routes to appropriate department by type
     * - Auto-calculates target completion time from config
     * - Initializes department history for journey tracking
     * 
     * @param input - Request creation data
     * @param branch - Branch ID where request originates
     * @param userId - Creating employee's ID
     * @param userName - Creating employee's name
     * @returns The created request ID
     */
    createRequest(
        input: CreateRequestInput,
        branch: string,
        userId: string,
        userName: string
    ): Promise<string>;

    // ============================================================
    // READ
    // ============================================================

    /**
     * Gets a request by ID
     * 
     * @param requestId - The request document ID
     * @returns Request object or null if not found
     */
    getRequest(requestId: string): Promise<Request | null>;

    /**
     * Gets requests for a branch with optional filtering
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branch - Branch ID to filter by
     * @param status - Optional status filter
     * @param limitCount - Optional limit on results
     * @returns Array of requests
     */
    getRequestsByBranch(
        tenantId: string,
        branch: string,
        status?: RequestStatus,
        limitCount?: number
    ): Promise<Request[]>;

    /**
     * Gets requests for a specific room
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branch - Branch ID
     * @param roomNumber - Room number to filter by
     * @returns Array of requests for the room
     */
    getRequestsByRoom(
        tenantId: string,
        branch: string,
        roomNumber: string
    ): Promise<Request[]>;

    /**
     * Gets today's requests for a branch
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branch - Branch ID
     * @returns Array of today's requests
     */
    getTodayRequests(
        tenantId: string,
        branch: string
    ): Promise<Request[]>;

    /**
     * Gets request statistics for analytics
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branch - Branch ID
     * @param startDate - Optional start date filter
     * @param endDate - Optional end date filter
     * @returns Request statistics
     */
    getRequestStats(
        tenantId: string,
        branch: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<RequestStats | null>;

    // ============================================================
    // UPDATE
    // ============================================================

    /**
     * Updates a request with partial data
     * 
     * @param requestId - Request to update
     * @param data - Partial request data
     */
    updateRequest(
        requestId: string,
        data: UpdateRequestInput
    ): Promise<void>;

    /**
     * Confirms a pending request (Reception)
     * 
     * ## Business Rules:
     * - Awards points to confirming employee
     * - Calculates response time for performance
     * 
     * @param requestId - Request to confirm
     * @param userId - Confirming employee's ID
     * @param userName - Confirming employee's name
     */
    confirmRequest(
        requestId: string,
        userId: string,
        userName: string
    ): Promise<void>;

    /**
     * Starts work on a request
     * 
     * @param requestId - Request to start
     * @param userId - Working employee's ID
     * @param userName - Working employee's name
     */
    startRequest(
        requestId: string,
        userId: string,
        userName: string
    ): Promise<void>;

    /**
     * Completes a request
     * 
     * ## Business Rules:
     * - Awards performance points
     * - Awards rating points if rating provided
     * - Analyzes feedback sentiment
     * - Deducts inventory for consumable requests
     * 
     * @param requestId - Request to complete
     * @param userId - Completing employee's ID
     * @param userName - Completing employee's name
     * @param rating - Optional guest rating (1-5)
     * @param feedback - Optional feedback text
     */
    completeRequest(
        requestId: string,
        userId: string,
        userName: string,
        rating?: number,
        feedback?: string
    ): Promise<void>;

    /**
     * Cancels a request
     * 
     * @param requestId - Request to cancel
     * @param userId - Cancelling user's ID
     * @param userName - Cancelling user's name
     * @param reason - Cancellation reason
     */
    cancelRequest(
        requestId: string,
        userId: string,
        userName: string,
        reason: string
    ): Promise<void>;

    /**
     * Assigns a request to an employee
     * ✅ FIX: Updated to match staffService.assignRequest signature (includes branchId)
     * 
     * @param requestId - Request to assign
     * @param tenantId - Tenant ID for SaaS isolation
     * @param employeeId - Employee to assign to
     * @param employeeName - Employee's name
     * @param branchId - Branch ID for workload check (required)
     * @param maxWorkload - Maximum allowed workload (optional, default: 5)
     */
    assignRequest(
        requestId: string,
        tenantId: string,
        employeeId: string,
        employeeName: string,
        branchId: string,
        maxWorkload?: number
    ): Promise<void>;

    /**
     * Transfers a request to another department
     * 
     * @param requestId - Request to transfer
     * @param fromDepartment - Source department
     * @param toDepartment - Target department
     * @param userId - Transferring user's ID
     * @param userName - Transferring user's name
     * @param status - Optional new status
     * @param notes - Optional transfer notes
     */
    transferRequestToDepartment(
        requestId: string,
        fromDepartment: string,
        toDepartment: string,
        userId: string,
        userName: string,
        status?: RequestStatus,
        notes?: string
    ): Promise<void>;

    // ============================================================
    // DELETE
    // ============================================================

    /**
     * Soft-deletes a request (marks as cancelled)
     * 
     * @param requestId - Request to delete
     */
    deleteRequest(requestId: string): Promise<void>;

    // ============================================================
    // SUBSCRIPTIONS (Real-time)
    // ============================================================

    /**
     * Subscribes to real-time request updates for a branch
     * 
     * ## CRITICAL: Real-time Feature
     * Must support live updates via subscription pattern
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branch - Branch ID to filter by
     * @param callback - Function called with updated requests
     * @param status - Optional status filter
     * @returns Unsubscribe function
     */
    subscribeToRequests(
        tenantId: string,
        branch: string,
        callback: (requests: Request[]) => void,
        status?: RequestStatus
    ): Unsubscribe;

    /**
     * Subscribes to a single request for real-time updates
     * 
     * @param requestId - Request to watch
     * @param callback - Function called on updates
     * @returns Unsubscribe function
     */
    subscribeToRequest(
        requestId: string,
        callback: (request: Request | null) => void
    ): Unsubscribe;

    /**
     * Subscribes to requests from multiple branches
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branches - Array of branch IDs (max 30)
     * @param callback - Function called with updated requests
     * @param options - Optional filters (status, type)
     * @returns Unsubscribe function
     */
    subscribeToMultipleBranches(
        tenantId: string,
        branches: string[],
        callback: (requests: Request[]) => void,
        options?: { status?: RequestStatus; type?: RequestType }
    ): Unsubscribe;

    // ============================================================
    // BATCH OPERATIONS
    // ============================================================

    /**
     * Bulk confirms multiple requests
     * 
     * @param requestIds - Array of request IDs
     * @param userId - Confirming user's ID
     * @param userName - Confirming user's name
     */
    bulkConfirmRequests(
        requestIds: string[],
        userId: string,
        userName: string
    ): Promise<void>;

    /**
     * Bulk completes multiple requests
     * 
     * @param requestIds - Array of request IDs
     * @param userId - Completing user's ID
     * @param userName - Completing user's name
     */
    bulkCompleteRequests(
        requestIds: string[],
        userId: string,
        userName: string
    ): Promise<void>;

    /**
     * Cancels all active requests for a branch
     * Used when branch is deleted/disabled
     * 
     * @param tenantId - Tenant ID
     * @param branchId - Branch being closed
     * @param userId - User performing action
     * @param userName - User's name
     * @param reason - Cancellation reason
     * @returns Number of requests cancelled
     */
    cancelAllActiveRequestsByBranch(
        tenantId: string,
        branchId: string,
        userId: string,
        userName: string,
        reason?: string
    ): Promise<number>;
}
