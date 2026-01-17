/**
 * useReceptionActions Hook
 * Pure business logic for Reception Dashboard actions
 * No UI elements - only Firebase operations and state management
 * Adora Hotel Management System
 */

import { useState, useCallback } from 'react';
import { TFunction } from 'i18next';
import { db } from '../services/firebase';
import {
    doc, updateDoc, addDoc, deleteDoc, collection, query, where, getDocs, Timestamp
} from 'firebase/firestore';
import { ServiceRequest } from '../types/request';
import { awardPoints } from '../services/pointsService';
import { transferRequestToDepartment, confirmCompletion, completeRequest } from '../services/requestService';
import { haptic, playSound } from '../utils/uxEffects';

export interface UseReceptionActionsParams {
    user: { id: string; name: string } | null;
    branchId: string;
    tenantId: string;
    t: TFunction;
    onSuccess?: (message: string) => void;
    onError?: (message: string) => void;
}

export interface UseReceptionActionsReturn {
    // Actions
    handleConfirmRequest: (requestId: string) => Promise<void>;
    handleCompleteRequest: (requestId: string) => Promise<void>;
    handleConfirmCompletion: (requestId: string) => Promise<void>;
    handleDeleteRequest: (requestId: string) => Promise<void>;
    handleTransferRequest: (request: ServiceRequest, targetRoomNumber: string) => Promise<void>; // Room Transfer
    handleTransferToDepartment: (request: ServiceRequest, targetDepartment: string, notes?: string) => Promise<void>; // ✅ Department Transfer
    handleCreateRequest: (data: {
        roomNumber: string;
        type: string;
        priority: 'normal' | 'urgent' | 'scheduled';
        notes: string;
        needsCart?: boolean;
        guestsInRoom?: boolean;
        scheduledAt?: Date;
        emergencyTargetDepartment?: string;
    }, existingRequests?: ServiceRequest[]) => Promise<void>;
    
    // State
    isTransferring: boolean;
    deleteConfirmation: { id: string; show: boolean } | null;
    setDeleteConfirmation: (confirmation: { id: string; show: boolean } | null) => void;
}

/**
 * Pure logic hook for Reception actions
 */
export const useReceptionActions = ({
    user,
    branchId,
    tenantId,
    t,
    onSuccess,
    onError
}: UseReceptionActionsParams): UseReceptionActionsReturn => {
    const [isTransferring, setIsTransferring] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; show: boolean } | null>(null);

    const success = useCallback((message: string) => {
        onSuccess?.(message);
        haptic('success');
        playSound('success');
    }, [onSuccess]);

    const error = useCallback((message: string) => {
        onError?.(message);
        haptic('error');
        playSound('error');
    }, [onError]);

    const handleConfirmRequest = useCallback(async (requestId: string) => {
        try {
            // ✅ Use tenant-scoped collection
            const requestsRef = collection(db, `tenants/${tenantId}/requests`);
            const requestRef = doc(requestsRef, requestId);
            const requestSnap = await getDocs(query(requestsRef, where('__name__', '==', requestId)));

            if (requestSnap.empty) return;

            const requestData = requestSnap.docs[0].data();

            // ⭐ Check if this is an inspection request
            if (requestData.type === 'inspection' && requestData.source === 'bellman_checkout') {
                // Auto-create cleaning request after confirming inspection receipt
                const cleaningRequestData: any = {
                    type: 'cleaning',
                    cleaningType: 'post_inspection',
                    status: 'CONFIRMED',
                    roomNumber: requestData.roomNumber,
                    guestName: requestData.guestName || '',
                    priority: 'normal' as const,
                    currentDepartment: 'housekeeping',
                    originDepartment: 'reception',
                    notes: t('reception.cleaningAfterInspection', { room: requestData.roomNumber }),
                    createdAt: Timestamp.now(),
                    createdBy: { id: user?.id || '', name: user?.name || 'Unknown' },
                    linkedInspectionId: requestId,
                    minibarConsumption: requestData.minibarConsumption || [],
                    minibarTotal: requestData.minibarTotal || 0,
                    branch: branchId,
                    tenantId: tenantId
                };
                
                if (requestData.inspectionResult) {
                    cleaningRequestData.inspectionResult = requestData.inspectionResult;
                }
                
                // ✅ Use tenant-scoped collection
                await addDoc(collection(db, `tenants/${tenantId}/requests`), cleaningRequestData);

                await updateDoc(requestRef, {
                    status: 'COMPLETED',
                    confirmedAt: Timestamp.now(),
                    confirmedBy: { id: user?.id || '', name: user?.name || 'Unknown' },
                    currentDepartment: 'reception'
                });

                if (user?.id) {
                    await awardPoints(tenantId || 'default', user.id, 5, t('reception.confirmInspectionRoom'));
                }

                success(t('reception.requestConfirmedSuccess'));
                return;
            }

            // ✅ QR Request Confirmation - Transfer to appropriate department
            if (requestData.source === 'QR' && requestData.status === 'PENDING_RECEPTION') {
                const getTargetDepartment = (type: string): string => {
                    switch (type) {
                        case 'cleaning': return 'housekeeping';
                        case 'maintenance': return 'maintenance';
                        case 'bellman': return 'bellman';
                        case 'room_service':
                        case 'coffee': return 'coffee_shop';
                        case 'minibar': return 'reception';
                        case 'extension': return 'reception';
                        default: return 'reception';
                    }
                };

                const targetDepartment = getTargetDepartment(requestData.type || requestData.serviceType);

                await updateDoc(requestRef, {
                    status: 'CONFIRMED',
                    confirmedBy: { id: user?.id || '', name: user?.name || '' },
                    confirmedAt: Timestamp.now()
                });

                if (targetDepartment !== 'reception') {
                    await transferRequestToDepartment(
                        requestId,
                        tenantId,
                        'reception',
                        targetDepartment,
                        user?.id || '',
                        user?.name || '',
                        'CONFIRMED' as any,
                        t('reception.confirmedFromReceptionQR')
                    );
                } else {
                    const departmentHistory = requestData.departmentHistory || [];
                    if (departmentHistory.length > 0) {
                        const lastEntry = departmentHistory[departmentHistory.length - 1];
                        lastEntry.status = 'CONFIRMED';
                        lastEntry.handledBy = { id: user?.id || '', name: user?.name || '' };
                        lastEntry.exitedAt = Timestamp.now();
                    }
                    await updateDoc(requestRef, {
                        departmentHistory,
                        currentDepartment: 'reception'
                    });
                }

                if (user?.id) {
                    await awardPoints(tenantId || 'default', user.id, 5, t('reception.confirmQRRequest'));
                }

                success(t('reception.requestConfirmedAutoTransfer'));
                return;
            }

            // Normal confirmation
            await updateDoc(requestRef, {
                status: 'CONFIRMED',
                confirmedBy: { id: user?.id || '', name: user?.name || t('reception.unknownUser') },
                confirmedAt: Timestamp.now()
            });

            if (user?.id) {
                await awardPoints(tenantId || 'default', user.id, 5, t('reception.confirmRequestLabel'));
            }

            success(t('reception.requestConfirmedSuccess'));
        } catch (err) {
            console.error('Error confirming:', err);
            error(t('reception.requestConfirmFailed'));
        }
    }, [user, branchId, tenantId, t, success, error]);

    const handleCompleteRequest = useCallback(async (requestId: string) => {
        if (!user?.id || !user?.name) {
            error(t('reception.completeRequestFailedNoUser'));
            return;
        }

        if (!tenantId) {
            error(t('reception.completeRequestFailedNoTenant'));
            return;
        }

        try {
            // ✅ FIX: Use completeRequest from requestService (includes Quality Check)
            await completeRequest(
                requestId,
                tenantId,
                user.id,
                user.name,
                undefined, // rating (optional)
                undefined  // feedback (optional)
            );

            success(t('reception.requestCompletedSuccess'));
        } catch (err) {
            console.error('Error completing:', err);
            error(t('reception.requestCompleteFailed'));
        }
    }, [user, tenantId, t, success, error]);

    const handleConfirmCompletion = useCallback(async (requestId: string) => {
        try {
            await confirmCompletion(requestId, tenantId, user?.id || '', user?.name || '', 'reception');
            success(t('reception.requestClosedAndCompleted'));
        } catch (err) {
            console.error('Error confirming completion:', err);
            error(t('reception.requestCloseFailed'));
        }
    }, [user, tenantId, t, success, error]);

    const handleDeleteRequest = useCallback(async (requestId: string) => {
        setDeleteConfirmation(null);

        try {
            // ✅ Use tenant-scoped collection
            const requestRef = doc(db, `tenants/${tenantId}/requests`, requestId);
            await deleteDoc(requestRef);
            success(t('reception.requestDeletedSuccess'));
        } catch (err: any) {
            console.error('❌ Delete failed:', err);
            const errorMsg = err?.code === 'permission-denied'
                ? t('reception.noPermissionToDelete')
                : t('reception.requestDeleteFailed') + ' ' + (err?.message || t('reception.unknownError'));
            error(errorMsg);
        }
    }, [tenantId, t, success, error]);

    // ✅ Room Transfer (Transfer request to different room)
    const handleTransferRequest = useCallback(async (request: ServiceRequest, targetRoomNumber: string) => {
        if (targetRoomNumber === request.roomNumber) {
            error(t('reception.cannotTransferToSameRoom'));
            return;
        }

        setIsTransferring(true);

        try {
            // ✅ Use tenant-scoped collection
            const requestRef = doc(db, `tenants/${tenantId}/requests`, request.id);
            await updateDoc(requestRef, {
                roomNumber: targetRoomNumber,
                modifiedAt: Timestamp.now(),
                modifiedBy: { id: user?.id || '', name: user?.name || '' }
            });

            success(t('reception.requestTransferredSuccess'));
        } catch (err) {
            console.error('Error transferring:', err);
            error(t('reception.requestTransferFailed'));
        } finally {
            setIsTransferring(false);
        }
    }, [user, tenantId, t, success, error]);

    // ✅ Department Transfer (Transfer request between departments)
    const handleTransferToDepartment = useCallback(async (
        request: ServiceRequest,
        targetDepartment: string,
        notes?: string
    ) => {
        if (!request.currentDepartment) {
            error(t('reception.cannotTransferRequestWithoutDepartment'));
            return;
        }

        if (request.currentDepartment === targetDepartment) {
            error(t('reception.cannotTransferToSameDepartment'));
            return;
        }

        setIsTransferring(true);

        try {
            await transferRequestToDepartment(
                request.id,
                tenantId,
                request.currentDepartment,
                targetDepartment,
                user?.id || '',
                user?.name || '',
                'CONFIRMED' as any,
                notes
            );

            success(t('reception.requestTransferredToDepartment', { department: targetDepartment }));
        } catch (err) {
            console.error('Error transferring to department:', err);
            error(t('reception.requestTransferFailed'));
        } finally {
            setIsTransferring(false);
        }
    }, [user, tenantId, t, success, error]);

    const handleCreateRequest = useCallback(async (data: {
        roomNumber: string;
        type: string;
        priority: 'normal' | 'urgent' | 'scheduled';
        notes: string;
        needsCart?: boolean;
        guestsInRoom?: boolean;
        scheduledAt?: Date;
        emergencyTargetDepartment?: string;
    }, existingRequests?: ServiceRequest[]) => {
        try {
            if (!user || !user.id) {
                throw new Error(t('reception.mustLoginFirst'));
            }

            // ✅ Determine which department should handle this request
            const getDepartment = (type: string, emergencyDept?: string): 'reception' | 'housekeeping' | 'maintenance' | 'bellman' | 'coffee_shop' | 'procurement' => {
                if (type === 'other' && emergencyDept) {
                    return emergencyDept as any;
                }

                switch (type) {
                    case 'cleaning':
                    case 'laundry':
                    case 'minibar':
                        return 'housekeeping';
                    case 'maintenance':
                        return 'maintenance';
                    case 'bellman':
                        return 'bellman';
                    case 'coffee':
                        return 'coffee_shop';
                    case 'inspection':
                        return 'housekeeping';
                    case 'extension':
                        return 'reception';
                    default:
                        return 'reception';
                }
            };

            // ✅ Duplication Prevention
            const activeRequests = existingRequests?.filter(r =>
                r.roomNumber === data.roomNumber &&
                r.id &&
                ['CONFIRMED', 'IN_PROGRESS', 'NEEDS_INSPECTION', 'SCHEDULED', 'PENDING'].includes(r.status)
            ) || [];

            if (data.type === 'coffee') {
                const serviceCount = activeRequests.filter(r => r.type === 'coffee').length;
                if (serviceCount >= 5) {
                    error(t('reception.maxServiceRequestsExceeded'));
                    throw new Error('Max service requests reached');
                }
            }

            const isDuplicate = activeRequests.some(r => r.type === data.type);

            // ✅ Prepare request data
            const requestData: any = {
                type: data.type,
                serviceType: data.type,
                roomNumber: data.roomNumber,
                priority: data.priority || 'normal',
                notes: data.notes || '',
                status: data.priority === 'scheduled' ? 'SCHEDULED' as const : 'CONFIRMED' as const,
                branch: branchId,
                guestName: t('reception.requestFromReception'),
                needsCart: data.needsCart || false,
                guestsInRoom: data.guestsInRoom || false,
                guestStatus: data.guestsInRoom ? 'in' : 'out',
                createdBy: {
                    id: user.id,
                    name: user.name || t('reception.unknownUser')
                },
                confirmedBy: {
                    id: user.id,
                    name: user.name || t('reception.unknownUser')
                },
                originDepartment: 'reception',
                tenantId: tenantId,
                currentDepartment: getDepartment(data.type, data.emergencyTargetDepartment),
                createdAt: Timestamp.now(),
                confirmedAt: Timestamp.now(),
                timeline: {
                    created: Timestamp.now(),
                    confirmed: Timestamp.now()
                },
                isPotentialDuplicate: isDuplicate,
                workflow: {
                    originDept: 'reception',
                    targetDept: getDepartment(data.type, data.emergencyTargetDepartment),
                    currentHolder: getDepartment(data.type, data.emergencyTargetDepartment),
                    workflowStatus: 'NEW',
                    sentAt: Timestamp.now(),
                    isLocked: true,
                    lockedBy: getDepartment(data.type, data.emergencyTargetDepartment),
                    journey: [{
                        department: 'reception',
                        action: 'created',
                        timestamp: Timestamp.now(),
                        userId: user.id,
                        userName: user.name || t('reception.userLabel')
                    }, {
                        department: 'reception',
                        action: 'sent',
                        timestamp: Timestamp.now(),
                        userId: user.id,
                        userName: user.name || t('reception.userLabel'),
                        notes: `${t('reception.sentToDepartmentNote')} ${getDepartment(data.type, data.emergencyTargetDepartment)}`
                    }]
                }
            };

            if (data.type === 'other') {
                requestData.isEmergency = true;
                requestData.emergencyStatus = 'pending';
                requestData.emergencyTargetDepartment = data.emergencyTargetDepartment;
            }

            if (data.scheduledAt) {
                requestData.scheduledDate = Timestamp.fromDate(data.scheduledAt);
                requestData.scheduledAt = Timestamp.fromDate(data.scheduledAt);
            }

            // ✅ Use tenant-scoped collection
            await addDoc(collection(db, `tenants/${tenantId}/requests`), requestData);

            // ✅ Auto-check daily attendance
            if (tenantId && user?.id) {
                try {
                    const { checkDailyAttendance } = await import('../services/challengeService');
                    checkDailyAttendance(tenantId, user.id).catch(err => {
                        console.warn('Failed to check daily attendance:', err);
                    });
                } catch (err) {
                    console.warn('Could not load challengeService:', err);
                }
            }

            // ✅ FIX: Award points but don't fail request creation if points award fails
            if (user?.id && tenantId) {
                try {
                    await awardPoints(tenantId, user.id, 3, t('reception.createRequestLabel'));
                } catch (pointsError: any) {
                    // ⚠️ Log but don't fail request creation if points award fails
                    console.warn('⚠️ Failed to award points (request still created):', pointsError?.message || pointsError);
                }
            }

            success(isDuplicate ? t('reception.requestCreatedDuplicate') : t('reception.requestCreatedSuccess'));
        } catch (err: any) {
            console.error('Error creating request:', err);
            const errorMessage = err?.message?.includes('permission')
                ? t('reception.noPermissionToCreate')
                : err?.message?.includes('network') || err?.message?.includes('offline')
                    ? t('reception.checkInternetConnection')
                    : t('reception.requestCreationFailed') + ' ' + (err?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || t('reception.unknownError'));
            error(errorMessage);
            throw err;
        }
    }, [user, branchId, tenantId, t, success, error]);

    return {
        handleConfirmRequest,
        handleCompleteRequest,
        handleConfirmCompletion,
        handleDeleteRequest,
        handleTransferRequest,
        handleTransferToDepartment, // ✅ Department Transfer
        handleCreateRequest,
        isTransferring,
        deleteConfirmation,
        setDeleteConfirmation
    };
};
