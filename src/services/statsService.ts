/**
 * Statistics Service
 * Handles all admin statistics and analytics queries
 * ✅ Architecture: All Firebase operations isolated in services
 */

import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';
import type {
    DepartmentStats,
    EmployeePerformance,
    TimeSeriesData,
    RevenueItem,
    PayoutStats,
    InventoryAlert,
    StatsPeriod
} from '../types/stats';

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Get department statistics
 * ✅ Null Safety: Checks db before operations
 */
export const getDepartmentStats = async (
    branchId: string,
    tenantId: string,
    period?: StatsPeriod
): Promise<DepartmentStats[]> => {
    // Null safety check
    if (!db) {
        logger.error('Cannot get department stats', new Error('Database not initialized'), 'statsService');
        return [];
    }

    try {
        const conditions: any[] = [
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId)
        ];

        if (period) {
            conditions.push(where('createdAt', '>=', Timestamp.fromDate(period.start)));
            conditions.push(where('createdAt', '<=', Timestamp.fromDate(period.end)));
        }

        const q = query(collection(db, 'requests'), ...conditions);
        const snapshot = await getDocs(q);

        // Process and aggregate by department
        const departmentMap = new Map<string, DepartmentStats>();

        snapshot.forEach((doc) => {
            const data = doc.data();
            const dept = data.department || 'other';
            
            if (!departmentMap.has(dept)) {
                departmentMap.set(dept, {
                    name: dept,
                    nameAr: data.departmentAr || dept,
                    completed: 0,
                    pending: 0,
                    avgResponseTime: 0,
                    rating: 0,
                    color: getDepartmentColor(dept)
                });
            }

            const stats = departmentMap.get(dept)!;
            if (data.status === 'completed') {
                stats.completed++;
            } else {
                stats.pending++;
            }
        });

        return Array.from(departmentMap.values());
    } catch (error: any) {
        logger.error('Error getting department stats', error, 'statsService');
        return [];
    }
};

/**
 * Get employee performance leaderboard
 * ✅ Null Safety: Checks db before operations
 */
export const getEmployeePerformance = async (
    branchId: string,
    tenantId: string,
    limitCount: number = 10
): Promise<EmployeePerformance[]> => {
    // Null safety check
    if (!db) {
        logger.error('Cannot get employee performance', new Error('Database not initialized'), 'statsService');
        return [];
    }

    try {
        // Query employees with points data
        const employeesQuery = query(
            collection(db, `tenants/${tenantId}/employees`),
            where('branchId', '==', branchId),
            orderBy('currentPoints', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(employeesQuery);
        const employees: EmployeePerformance[] = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            employees.push({
                id: doc.id,
                name: data.name || 'Unknown',
                department: data.department || 'other',
                completedRequests: data.completedRequests || 0,
                avgResponseTime: data.avgResponseTime || 0,
                rating: data.rating || 0,
                points: data.currentPoints || data.personalPoints || 0
            });
        });

        return employees;
    } catch (error: any) {
        logger.error('Error getting employee performance', error, 'statsService');
        return [];
    }
};

/**
 * Get time series data for charts
 * ✅ Null Safety: Checks db before operations
 */
export const getTimeSeriesData = async (
    branchId: string,
    tenantId: string,
    days: number = 7
): Promise<TimeSeriesData[]> => {
    // Null safety check
    if (!db) {
        logger.error('Cannot get time series data', new Error('Database not initialized'), 'statsService');
        return [];
    }

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const q = query(
            collection(db, 'requests'),
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('createdAt', '>=', Timestamp.fromDate(startDate)),
            orderBy('createdAt', 'asc')
        );

        const snapshot = await getDocs(q);
        const dataMap = new Map<string, TimeSeriesData>();

        snapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
            const dateKey = date.toISOString().split('T')[0];

            if (!dataMap.has(dateKey)) {
                dataMap.set(dateKey, {
                    date: dateKey,
                    requests: 0,
                    completed: 0,
                    avgTime: 0
                });
            }

            const dayData = dataMap.get(dateKey)!;
            dayData.requests++;
            if (data.status === 'completed') {
                dayData.completed++;
            }
        });

        return Array.from(dataMap.values());
    } catch (error: any) {
        logger.error('Error getting time series data', error, 'statsService');
        return [];
    }
};

/**
 * Get payout statistics
 * ✅ Null Safety: Checks db before operations
 */
export const getPayoutStats = async (
    tenantId: string
): Promise<PayoutStats> => {
    // Null safety check
    if (!db) {
        logger.error('Cannot get payout stats', new Error('Database not initialized'), 'statsService');
        return { totalPaid: 0, pendingRequests: 0, approvedRequests: 0 };
    }

    try {
        const payoutRef = collection(db, `tenants/${tenantId}/payout_requests`);
        
        // Get approved payouts
        const approvedQuery = query(payoutRef, where('status', '==', 'approved'));
        const approvedSnap = await getDocs(approvedQuery);
        
        let totalPaid = 0;
        approvedSnap.forEach(doc => {
            totalPaid += doc.data().monetaryValue || 0;
        });

        // Get pending requests
        const pendingQuery = query(payoutRef, where('status', '==', 'pending'));
        const pendingSnap = await getDocs(pendingQuery);

        return {
            totalPaid,
            pendingRequests: pendingSnap.size,
            approvedRequests: approvedSnap.size
        };
    } catch (error: any) {
        logger.error('Error getting payout stats', error, 'statsService');
        return { totalPaid: 0, pendingRequests: 0, approvedRequests: 0 };
    }
};

/**
 * Get revenue items (from minibar/inventory)
 * ✅ Null Safety: Checks db before operations
 */
export const getRevenueItems = async (
    branchId: string,
    tenantId: string,
    period?: StatsPeriod
): Promise<RevenueItem[]> => {
    // Null safety check
    if (!db) {
        logger.error('Cannot get revenue items', new Error('Database not initialized'), 'statsService');
        return [];
    }

    try {
        // This would query from inspection reports or minibar consumption
        // Implementation depends on your data structure
        return [];
    } catch (error: any) {
        logger.error('Error getting revenue items', error, 'statsService');
        return [];
    }
};

/**
 * Calculate occupancy rate
 * ✅ Adora Physics Standard: Simple percentage calculation (occupied / total) * 100
 * ✅ Zero Guessing: Returns 0 if total is 0 to avoid division by zero
 */
export const calculateOccupancyRate = (
    occupiedRooms: number,
    totalRooms: number
): number => {
    // ✅ Adora Physics: Prevent division by zero
    if (totalRooms === 0) {
        return 0;
    }
    
    // ✅ Adora Physics: Standard occupancy formula
    const rate = (occupiedRooms / totalRooms) * 100;
    
    // ✅ Adora Physics: Ensure result is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(rate * 100) / 100));
};

/**
 * Calculate revenue from room occupancy
 * ✅ Adora Physics Standard: Revenue = (Occupied Rooms × Average Room Rate × Days)
 * ✅ Zero Guessing: All parameters must be provided, no assumptions
 */
export const calculateRevenueFromOccupancy = (
    occupiedRooms: number,
    averageRoomRate: number,
    days: number = 1
): number => {
    // ✅ Adora Physics: Validate inputs
    if (occupiedRooms < 0 || averageRoomRate < 0 || days < 0) {
        logger.warn('Invalid parameters for revenue calculation', { occupiedRooms, averageRoomRate, days }, 'statsService');
        return 0;
    }
    
    // ✅ Adora Physics: Standard revenue formula
    return Math.round(occupiedRooms * averageRoomRate * days * 100) / 100;
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getDepartmentColor = (dept: string): string => {
    const colors: Record<string, string> = {
        bellman: '#3B82F6',
        housekeeping: '#10B981',
        maintenance: '#F59E0B',
        reception: '#8B5CF6',
        coffeeShop: '#8B5CF6',
        other: '#6B7280'
    };
    return colors[dept] || colors.other;
};
