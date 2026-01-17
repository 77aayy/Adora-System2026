/**
 * useRequests Hook
 * React hook for managing requests state and actions
 * Adora Hotel Management System V2
 * 
 * ✅ Supports:
 * - Single branch employees
 * - Multiple branch employees/managers
 * - Real-time updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Request, RequestStatus } from '../types';
import {
    subscribeToRequests,
    subscribeToMultipleBranches,
    confirmRequest,
    completeRequest,
    startRequest,
} from '../services/requestService';
import { playNewRequestAlert } from '../utils/soundService';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

interface UseRequestsReturn {
    requests: Request[];
    loading: boolean;
    error: string | null;
    handleConfirm: (id: string) => Promise<void>;
    handleStart: (id: string) => Promise<void>;
    handleComplete: (id: string, rating?: number, feedback?: string) => Promise<void>;
    getRequestsByStatus: (status: RequestStatus) => Request[];
}

/**
 * Get user's branches (handles single branch or multiple branches)
 */
const getUserBranches = (user: any): string[] => {
    // If user has branches array, use it
    if (user.branches && Array.isArray(user.branches) && user.branches.length > 0) {
        return user.branches;
    }
    // Fallback to single branch
    if (user.branch) {
        return [user.branch];
    }
    // Default fallback
    return ['default'];
};

/**
 * Hook for managing requests with real-time Firebase updates
 * ✅ Supports employees with multiple branches
 */
export const useRequests = (): UseRequestsReturn => {
    const { user } = useAuth();
    const { tenantId } = useTenant();
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const previousCountRef = useRef<number>(0);

    // Subscribe to requests on mount
    useEffect(() => {
        if (!user || !tenantId) return;

        setLoading(true);
        setError(null);

        // ✅ Get all branches for this user
        const branches = getUserBranches(user);

        // ✅ Use multi-branch subscription if needed
        const unsubscribe = subscribeToMultipleBranches(branches, tenantId, (updatedRequests) => {
            // Check for new requests and play sound
            const newCount = updatedRequests.length;
            if (previousCountRef.current > 0 && newCount > previousCountRef.current) {
                playNewRequestAlert();
            }
            previousCountRef.current = newCount;

            // Convert new requests to old format for compatibility
            const converted = updatedRequests.map(r => ({
                ...r,
                timestamp: r.createdAt?.toDate ? r.createdAt.toDate() : new Date(),
                timeline: {
                    created: r.createdAt?.toDate ? r.createdAt.toDate() : null,
                    confirmed: r.confirmedAt?.toDate ? r.confirmedAt.toDate() : null,
                    startedAt: r.startedAt?.toDate ? r.startedAt.toDate() : null,
                    completed: r.completedAt?.toDate ? r.completedAt.toDate() : null,
                },
                assignedTo: r.assignedTo?.id || null
            })) as any;

            setRequests(converted);
            setLoading(false);
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, [user, tenantId]);

    /**
     * Confirm a request
     */
    const handleConfirm = useCallback(
        async (id: string): Promise<void> => {
            if (!user || !tenantId) return;
            try {
                await confirmRequest(id, tenantId, user.id, user.name || 'User');
            } catch (err) {
                setError('فشل في تأكيد الطلب');
                console.error('Confirm error:', err);
            }
        },
        [user, tenantId]
    );

    /**
     * Start work on a request
     */
    const handleStart = useCallback(
        async (id: string): Promise<void> => {
            if (!user || !tenantId) return;
            try {
                await startRequest(id, tenantId, user.id, user.name || 'User');
            } catch (err) {
                setError('فشل في بدء العمل');
                console.error('Start work error:', err);
            }
        },
        [user, tenantId]
    );

    /**
     * Complete a request
     */
    const handleComplete = useCallback(
        async (id: string, rating?: number, feedback?: string): Promise<void> => {
            if (!user || !tenantId) return;
            try {
                await completeRequest(id, tenantId, user.id, user.name || 'User', rating, feedback);
            } catch (err) {
                setError('فشل في إتمام الطلب');
                console.error('Complete error:', err);
            }
        },
        [user, tenantId]
    );

    /**
     * Filter requests by status
     */
    const getRequestsByStatus = useCallback(
        (status: RequestStatus): Request[] => {
            return requests.filter((r) => r.status === status);
        },
        [requests]
    );

    return {
        requests,
        loading,
        error,
        handleConfirm,
        handleStart,
        handleComplete,
        getRequestsByStatus,
    };
};

export default useRequests;
