/**
 * useAdminStats Hook
 * Bridge between statsService and admin UI components
 * ✅ Architecture: Hooks bridge services → components
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    getDepartmentStats,
    getEmployeePerformance,
    getTimeSeriesData,
    getPayoutStats,
    getRevenueItems
} from '../services/statsService';
import type {
    DepartmentStats,
    EmployeePerformance,
    TimeSeriesData,
    RevenueItem,
    PayoutStats,
    StatsPeriod
} from '../types/stats';
import { logger } from '../services/loggerService';

interface UseAdminStatsOptions {
    branchId: string;
    tenantId: string;
    period?: StatsPeriod;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

interface UseAdminStatsReturn {
    departmentStats: DepartmentStats[];
    employeePerformance: EmployeePerformance[];
    timeSeriesData: TimeSeriesData[];
    payoutStats: PayoutStats;
    revenueItems: RevenueItem[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

/**
 * Hook for admin statistics
 * ✅ Null Safety: Handles undefined data gracefully
 */
export const useAdminStats = (options: UseAdminStatsOptions): UseAdminStatsReturn => {
    const { branchId, tenantId, period, autoRefresh = false, refreshInterval = 60000 } = options;

    const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
    const [employeePerformance, setEmployeePerformance] = useState<EmployeePerformance[]>([]);
    const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
    const [payoutStats, setPayoutStats] = useState<PayoutStats>({
        totalPaid: 0,
        pendingRequests: 0,
        approvedRequests: 0
    });
    const [revenueItems, setRevenueItems] = useState<RevenueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ✅ PERFORMANCE: Cache with TTL (30 seconds)
    const cacheRef = useRef<{
        data: {
            departmentStats: DepartmentStats[];
            employeePerformance: EmployeePerformance[];
            timeSeriesData: TimeSeriesData[];
            payoutStats: PayoutStats;
            revenueItems: RevenueItem[];
        } | null;
        timestamp: number;
        cacheKey: string;
    }>({ data: null, timestamp: 0, cacheKey: '' });

    const CACHE_TTL = 30000; // 30 seconds

    const loadStats = useCallback(async () => {
        // ✅ Null Safety: Check required params
        if (!branchId || !tenantId) {
            logger.warn('useAdminStats: Missing branchId or tenantId', null, 'useAdminStats');
            setError('Missing required parameters');
            setLoading(false);
            return;
        }

        // ✅ PERFORMANCE: Check cache first
        const cacheKey = `${branchId}-${tenantId}-${period?.start?.getTime() || 'all'}-${period?.end?.getTime() || 'all'}`;
        const now = Date.now();
        
        if (
            cacheRef.current.data &&
            cacheRef.current.cacheKey === cacheKey &&
            (now - cacheRef.current.timestamp) < CACHE_TTL
        ) {
            // Return cached data
            const cached = cacheRef.current.data;
            setDepartmentStats(cached.departmentStats);
            setEmployeePerformance(cached.employeePerformance);
            setTimeSeriesData(cached.timeSeriesData);
            setPayoutStats(cached.payoutStats);
            setRevenueItems(cached.revenueItems);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Load all stats in parallel
            const [deptStats, empPerf, timeData, payout, revenue] = await Promise.all([
                getDepartmentStats(branchId, tenantId, period),
                getEmployeePerformance(branchId, tenantId, 10),
                getTimeSeriesData(branchId, tenantId, 7),
                getPayoutStats(tenantId),
                getRevenueItems(branchId, tenantId, period)
            ]);

            // ✅ Null Safety: Ensure arrays are never undefined
            const statsData = {
                departmentStats: deptStats || [],
                employeePerformance: empPerf || [],
                timeSeriesData: timeData || [],
                payoutStats: payout || { totalPaid: 0, pendingRequests: 0, approvedRequests: 0 },
                revenueItems: revenue || []
            };

            // ✅ PERFORMANCE: Update cache
            cacheRef.current = {
                data: statsData,
                timestamp: now,
                cacheKey
            };

            setDepartmentStats(statsData.departmentStats);
            setEmployeePerformance(statsData.employeePerformance);
            setTimeSeriesData(statsData.timeSeriesData);
            setPayoutStats(statsData.payoutStats);
            setRevenueItems(statsData.revenueItems);
        } catch (err: any) {
            logger.error('Error loading admin stats', err, 'useAdminStats');
            setError(err.message || 'Failed to load statistics');
            // ✅ Null Safety: Set empty arrays on error
            setDepartmentStats([]);
            setEmployeePerformance([]);
            setTimeSeriesData([]);
            setRevenueItems([]);
        } finally {
            setLoading(false);
        }
    }, [branchId, tenantId, period]);

    useEffect(() => {
        loadStats();

        // Auto-refresh if enabled
        if (autoRefresh) {
            const interval = setInterval(loadStats, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [loadStats, autoRefresh, refreshInterval]);

    return {
        departmentStats,
        employeePerformance,
        timeSeriesData,
        payoutStats,
        revenueItems,
        loading,
        error,
        refresh: loadStats
    };
};
