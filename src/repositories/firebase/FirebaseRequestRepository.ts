/**
 * Firebase Request Repository Implementation
 * Implements IRequestRepository using Firebase/Firestore
 * Adora Hotel Management System V3 - Repository Pattern
 * 
 * @description
 * This implementation wraps the existing requestService functions
 * to provide the IRequestRepository interface. Maintains:
 * - Real-time subscriptions (onSnapshot)
 * - Points/rewards integration
 * - AI sentiment analysis
 * - Multi-tenant data isolation
 */

import { IRequestRepository, RequestStats } from '../interfaces/IRequestRepository';
import { 
    Request, 
    RequestStatus, 
    RequestType,
    CreateRequestInput, 
    UpdateRequestInput 
} from '../../types/request';
import { Unsubscribe } from 'firebase/firestore';
import {
    createRequest as firebaseCreateRequest,
    getRequest as firebaseGetRequest,
    getRequestsByBranch as firebaseGetRequestsByBranch,
    getRequestsByRoom as firebaseGetRequestsByRoom,
    getTodayRequests as firebaseGetTodayRequests,
    getRequestStats as firebaseGetRequestStats,
    updateRequest as firebaseUpdateRequest,
    confirmRequest as firebaseConfirmRequest,
    startRequest as firebaseStartRequest,
    completeRequest as firebaseCompleteRequest,
    cancelRequest as firebaseCancelRequest,
    assignRequest as firebaseAssignRequest,
    transferRequestToDepartment as firebaseTransferRequestToDepartment,
    deleteRequest as firebaseDeleteRequest,
    subscribeToRequests as firebaseSubscribeToRequests,
    subscribeToRequest as firebaseSubscribeToRequest,
    subscribeToMultipleBranches as firebaseSubscribeToMultipleBranches,
    bulkConfirmRequests as firebaseBulkConfirmRequests,
    bulkCompleteRequests as firebaseBulkCompleteRequests,
    cancelAllActiveRequestsByBranch as firebaseCancelAllActiveRequestsByBranch
} from '../../services/requestService';

/**
 * Firebase implementation of IRequestRepository
 * 
 * @example
 * ```typescript
 * const requestRepo = new FirebaseRequestRepository();
 * const unsubscribe = requestRepo.subscribeToRequests(
 *   tenantId, branchId, setRequests, RequestStatus.PENDING_RECEPTION
 * );
 * ```
 */
export class FirebaseRequestRepository implements IRequestRepository {
    // ============================================================
    // CREATE
    // ============================================================

    async createRequest(
        input: CreateRequestInput,
        branch: string,
        userId: string,
        userName: string
    ): Promise<string> {
        return firebaseCreateRequest(input, branch, userId, userName);
    }

    // ============================================================
    // READ
    // ============================================================

    async getRequest(requestId: string): Promise<Request | null> {
        return firebaseGetRequest(requestId);
    }

    async getRequestsByBranch(
        tenantId: string,
        branch: string,
        status?: RequestStatus,
        limitCount?: number
    ): Promise<Request[]> {
        return firebaseGetRequestsByBranch(branch, status, limitCount, tenantId);
    }

    async getRequestsByRoom(
        tenantId: string,
        branch: string,
        roomNumber: string
    ): Promise<Request[]> {
        return firebaseGetRequestsByRoom(branch, roomNumber, tenantId);
    }

    async getTodayRequests(tenantId: string, branch: string): Promise<Request[]> {
        return firebaseGetTodayRequests(branch, tenantId);
    }

    async getRequestStats(
        tenantId: string,
        branch: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<RequestStats | null> {
        return firebaseGetRequestStats(branch, startDate, endDate, tenantId);
    }

    // ============================================================
    // UPDATE
    // ============================================================

    async updateRequest(requestId: string, data: UpdateRequestInput): Promise<void> {
        return firebaseUpdateRequest(requestId, data);
    }

    async confirmRequest(
        requestId: string,
        userId: string,
        userName: string
    ): Promise<void> {
        return firebaseConfirmRequest(requestId, userId, userName);
    }

    async startRequest(
        requestId: string,
        userId: string,
        userName: string
    ): Promise<void> {
        return firebaseStartRequest(requestId, userId, userName);
    }

    async completeRequest(
        requestId: string,
        userId: string,
        userName: string,
        rating?: number,
        feedback?: string
    ): Promise<void> {
        return firebaseCompleteRequest(requestId, userId, userName, rating, feedback);
    }

    async cancelRequest(
        requestId: string,
        userId: string,
        userName: string,
        reason: string
    ): Promise<void> {
        return firebaseCancelRequest(requestId, userId, userName, reason);
    }

    async assignRequest(
        requestId: string,
        employeeId: string,
        employeeName: string
    ): Promise<void> {
        return firebaseAssignRequest(requestId, employeeId, employeeName);
    }

    async transferRequestToDepartment(
        requestId: string,
        fromDepartment: string,
        toDepartment: string,
        userId: string,
        userName: string,
        status?: RequestStatus,
        notes?: string
    ): Promise<void> {
        return firebaseTransferRequestToDepartment(
            requestId, fromDepartment, toDepartment, userId, userName, status, notes
        );
    }

    // ============================================================
    // DELETE
    // ============================================================

    async deleteRequest(requestId: string): Promise<void> {
        return firebaseDeleteRequest(requestId);
    }

    // ============================================================
    // SUBSCRIPTIONS
    // ============================================================

    subscribeToRequests(
        tenantId: string,
        branch: string,
        callback: (requests: Request[]) => void,
        status?: RequestStatus
    ): Unsubscribe {
        return firebaseSubscribeToRequests(branch, callback, status, tenantId);
    }

    subscribeToRequest(
        requestId: string,
        callback: (request: Request | null) => void
    ): Unsubscribe {
        return firebaseSubscribeToRequest(requestId, callback);
    }

    subscribeToMultipleBranches(
        tenantId: string,
        branches: string[],
        callback: (requests: Request[]) => void,
        options?: { status?: RequestStatus; type?: RequestType }
    ): Unsubscribe {
        return firebaseSubscribeToMultipleBranches(branches, callback, options);
    }

    // ============================================================
    // BATCH
    // ============================================================

    async bulkConfirmRequests(
        requestIds: string[],
        userId: string,
        userName: string
    ): Promise<void> {
        return firebaseBulkConfirmRequests(requestIds, userId, userName);
    }

    async bulkCompleteRequests(
        requestIds: string[],
        userId: string,
        userName: string
    ): Promise<void> {
        return firebaseBulkCompleteRequests(requestIds, userId, userName);
    }

    async cancelAllActiveRequestsByBranch(
        tenantId: string,
        branchId: string,
        userId: string,
        userName: string,
        reason?: string
    ): Promise<number> {
        return firebaseCancelAllActiveRequestsByBranch(
            tenantId, branchId, userId, userName, reason
        );
    }
}

/**
 * Singleton instance for convenience
 */
export const requestRepository = new FirebaseRequestRepository();
