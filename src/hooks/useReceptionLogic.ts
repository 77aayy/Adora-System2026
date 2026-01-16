/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * useReceptionLogic Hook
 * Extracted business logic from ReceptionDashboard for better code organization
 */

import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceRequest } from '../types/request';
import { useReceptionContext } from '../context/ReceptionContext';
import { useUX } from '../context/UXContext';
import { useReceptionActions } from './useReceptionActions';

type TabType = 'new' | 'in_progress' | 'completed';

interface UseReceptionLogicProps {
    user: any;
    branchId: string;
    tenantId: string;
}

export const useReceptionLogic = ({ user, branchId, tenantId }: UseReceptionLogicProps) => {
    const { t } = useTranslation();
    const { error, haptic } = useUX();
    const {
        requests,
        currentTab,
        roomSearchQuery,
        activeRoomDetails,
        selectedTransferRequest,
        targetRoomNumber,
        setTransferModalOpen,
        setSelectedTransferRequest,
        setTargetRoomNumber
    } = useReceptionContext();

    const { handleTransferRequest } = useReceptionActions({
        user,
        branchId,
        tenantId,
        t,
        onSuccess: () => {},
        onError: error
    });

    // ✅ Group requests by status
    const groupedRequests = useMemo(() => {
        const department = 'reception';
        const now = new Date();
        
        // ✅ Helper: Check if scheduled request should be shown (only if scheduledDate <= now)
        const isScheduledRequestVisible = (r: ServiceRequest): boolean => {
            if (r.status !== 'SCHEDULED' || !r.scheduledAt) return true;
            const scheduledDate = r.scheduledAt?.toDate ? r.scheduledAt.toDate() : new Date(r.scheduledAt);
            return scheduledDate <= now;
        };

        // Filter requests that belong to this department
        const newRequests = requests.filter(r => {
            // Only show scheduled requests if their time has come
            if (!isScheduledRequestVisible(r)) return false;

            const originatedFromThis = r.originDepartment === department;
            const currentlyInThis = r.currentDepartment === department;
            
            // Show if originated from reception OR currently in reception
            if (!originatedFromThis && !currentlyInThis) return false;
            
            // Status filter for "new" tab
            return r.status === 'PENDING' || r.status === 'PENDING_RECEPTION';
        });

        const inProgressRequests = requests.filter(r => {
            if (!isScheduledRequestVisible(r)) return false;

            const originatedFromThis = r.originDepartment === department;
            const currentlyInThis = r.currentDepartment === department;
            
            if (!originatedFromThis && !currentlyInThis) return false;
            
            return r.status === 'CONFIRMED' || r.status === 'IN_PROGRESS';
        });

        const completedRequests = requests.filter(r => {
            const originatedFromThis = r.originDepartment === department;
            const currentlyInThis = r.currentDepartment === department;
            
            return originatedFromThis || currentlyInThis;
        }).filter(r => {
            // Not completed yet
            if (r.status === 'COMPLETED') return false;
            
            // Currently in a different department (or no currentDepartment for legacy)
            const inDifferentDept = r.currentDepartment && r.currentDepartment !== department;
            const legacyCheck = !r.currentDepartment && r.status !== 'COMPLETED';
            
            return inDifferentDept || legacyCheck;
        });

        // Sort by creation date (newest first)
        const sortByDate = (a: ServiceRequest, b: ServiceRequest) => {
            const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
            const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
            return bTime - aTime;
        };

        return {
            new: newRequests.sort(sortByDate),
            in_progress: inProgressRequests.sort(sortByDate),
            completed: completedRequests.sort(sortByDate)
        };
    }, [requests]);

    // ✅ Current list (filtered by search)
    const currentRequests = useMemo(() => {
        let list: ServiceRequest[];
        switch (currentTab) {
            case 'new': list = groupedRequests.new; break;
            case 'in_progress': list = groupedRequests.in_progress; break;
            case 'completed': list = groupedRequests.completed; break;
            default: list = [];
        }
        // Apply room search filter
        if (roomSearchQuery.trim()) {
            const query = roomSearchQuery.trim().toLowerCase();
            list = list.filter(r => r.roomNumber?.toLowerCase().includes(query));
        }
        return list;
    }, [currentTab, groupedRequests, roomSearchQuery]);

    // ✅ Tab definitions for navigation
    const tabDefinitions = useMemo(() => [
        { 
            key: 'new' as TabType, 
            label: t('reception.newTab'), 
            count: groupedRequests.new.length, 
            activeClass: 'bg-orange-500 text-white shadow-orange-500/25', 
            inactiveClass: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400' 
        },
        { 
            key: 'in_progress' as TabType, 
            label: t('reception.inProgressTab'), 
            count: groupedRequests.in_progress.length, 
            activeClass: 'bg-blue-500 text-white shadow-blue-500/25', 
            inactiveClass: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' 
        },
        { 
            key: 'completed' as TabType, 
            label: t('reception.completedTab'), 
            count: groupedRequests.completed.length, 
            activeClass: 'bg-green-500 text-white shadow-green-500/25', 
            inactiveClass: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' 
        }
    ], [t, groupedRequests.new.length, groupedRequests.in_progress.length, groupedRequests.completed.length]);

    // ✅ Check for room mismatch
    const checkRequestMismatch = useCallback((request: ServiceRequest): string | undefined => {
        // Only check if we have guest identity and room details loaded
        if (!request.guestIdentity || Object.keys(activeRoomDetails).length === 0) return undefined;

        // 1. Check who is legally in the requested room
        const roomOwner = activeRoomDetails[request.roomNumber];

        // If room is empty or has different guest, we might have a problem
        if (!roomOwner || roomOwner.guestId !== request.guestIdentity) {
            // 2. DETECTIVE MODE: Where is this guest actually?
            // Search all occupied rooms for this guestIdentity
            const actualRoom = Object.entries(activeRoomDetails).find(([_, details]) =>
                details.guestId === request.guestIdentity
            );

            if (actualRoom) {
                // Found them! They are in a different room.
                return actualRoom[0]; // Return the actual room number
            }
        }
        return undefined;
    }, [activeRoomDetails]);

    // ✅ Handle transfer request UI
    const handleTransferRequestUI = useCallback((request: ServiceRequest) => {
        setSelectedTransferRequest(request);
        setTransferModalOpen(true);
        setTargetRoomNumber('');
    }, [setSelectedTransferRequest, setTransferModalOpen, setTargetRoomNumber]);

    // ✅ Confirm transfer
    const confirmTransfer = useCallback(async () => {
        if (!selectedTransferRequest || !targetRoomNumber) return;

        // Room number validation (basic)
        if (targetRoomNumber === selectedTransferRequest.roomNumber) {
            error(t('reception.cannotTransferToSameRoom'));
            haptic('error');
            return;
        }

        try {
            await handleTransferRequest(selectedTransferRequest, targetRoomNumber);
            setTransferModalOpen(false);
            setSelectedTransferRequest(null);
            setTargetRoomNumber('');
        } catch (err) {
            // Error already handled in hook
            console.error('Transfer failed:', err);
        }
    }, [selectedTransferRequest, targetRoomNumber, handleTransferRequest, setTransferModalOpen, setSelectedTransferRequest, setTargetRoomNumber, error, haptic, t]);

    return {
        groupedRequests,
        currentRequests,
        tabDefinitions,
        checkRequestMismatch,
        handleTransferRequestUI,
        confirmTransfer
    };
};
