/**
 * Dashboard Stats Service
 * Handles KPI and dashboard statistics queries
 * ✅ Architecture: All Firebase operations isolated in services
 */

import { collection, query, where, getDocs, Timestamp, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface DepartmentStats {
    name: string;
    nameAr: string;
    completed: number;
    pending: number;
    avgResponseTime: number;
    rating: number;
    color: string;
}

export interface EmployeePerformance {
    id: string;
    name: string;
    department: string;
    completedRequests: number;
    avgResponseTime: number;
    rating: number;
    points: number;
}

export interface TimeSeriesData {
    date: string;
    requests: number;
    completed: number;
    avgTime: number;
}

export interface PulseItem {
    id: string;
    type: 'cleaning' | 'maintenance' | 'bellman' | 'coffee' | 'reception' | 'other';
    roomNumber?: string;
    description: string;
    status: string;
    startTime: Date | any;
    assignedTo?: string;
    priority?: 'normal' | 'urgent';
    department: string;
    elapsedMinutes?: number;
    isDelayed?: boolean;
}

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
    startDate?: Date,
    endDate?: Date
): Promise<DepartmentStats[]> => {
    // Null safety check
    if (!db) {
        logger.error('Cannot get department stats', new Error('Database not initialized'), 'dashboardStatsService');
        return [];
    }

    try {
        const conditions: any[] = [
            where('branch', '==', branchId)
            // ✅ CRITICAL SaaS FIX: tenantId already in path, no need for where('tenantId')
        ];

        if (startDate && endDate) {
            conditions.push(where('createdAt', '>=', Timestamp.fromDate(startDate)));
            conditions.push(where('createdAt', '<=', Timestamp.fromDate(endDate)));
        }

        // ✅ CRITICAL SaaS FIX: Use tenant-scoped collection for data isolation
        const q = query(collection(db, `tenants/${tenantId}/requests`), ...conditions);
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
        logger.error('Error getting department stats', error, 'dashboardStatsService');
        return [];
    }
};

/**
 * Get employee performance data
 * ✅ Null Safety: Checks db before operations
 */
export const getEmployeePerformance = async (
    branchId: string,
    tenantId: string,
    limitCount: number = 10
): Promise<EmployeePerformance[]> => {
    // Null safety check
    if (!db) {
        logger.error('Cannot get employee performance', new Error('Database not initialized'), 'dashboardStatsService');
        return [];
    }

    try {
        // This would typically query from a performance/analytics collection
        // For now, return empty array - implement based on your data structure
        return [];
    } catch (error: any) {
        logger.error('Error getting employee performance', error, 'dashboardStatsService');
        return [];
    }
};

/**
 * Subscribe to live pulse items
 * ✅ Null Safety: Checks db before operations
 */
export const subscribeToLivePulse = (
    branchId: string,
    tenantId: string,
    callback: (items: PulseItem[]) => void
): (() => void) | null => {
    // Null safety check
    if (!db) {
        logger.error('Cannot subscribe to live pulse', new Error('Database not initialized'), 'dashboardStatsService');
        return null;
    }

    try {
        // ✅ CRITICAL SaaS FIX: Use tenant-scoped collection for data isolation
        const q = query(
            collection(db, `tenants/${tenantId}/requests`),
            where('branch', '==', branchId),
            where('status', 'in', ['pending', 'in_progress']),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const items: PulseItem[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    items.push({
                        id: doc.id,
                        type: mapServiceTypeToPulseType(data.serviceType),
                        roomNumber: data.roomNumber,
                        description: data.description || data.serviceType,
                        status: data.status,
                        startTime: data.createdAt,
                        assignedTo: data.assignedTo,
                        priority: data.priority || 'normal',
                        department: data.department || 'other'
                    } as PulseItem);
                });
                callback(items);
            },
            (error) => {
                logger.error('Error in live pulse subscription', error, 'dashboardStatsService');
            }
        );

        return unsubscribe;
    } catch (error: any) {
        logger.error('Error setting up live pulse subscription', error, 'dashboardStatsService');
        return null;
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
        logger.error('Cannot get time series data', new Error('Database not initialized'), 'dashboardStatsService');
        return [];
    }

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        // ✅ CRITICAL SaaS FIX: Use tenant-scoped collection for data isolation
        const q = query(
            collection(db, `tenants/${tenantId}/requests`),
            where('branch', '==', branchId),
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
        logger.error('Error getting time series data', error, 'dashboardStatsService');
        return [];
    }
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

const mapServiceTypeToPulseType = (serviceType: string): PulseItem['type'] => {
    if (serviceType.includes('cleaning') || serviceType.includes('housekeeping')) return 'cleaning';
    if (serviceType.includes('maintenance')) return 'maintenance';
    if (serviceType.includes('bellman') || serviceType.includes('luggage')) return 'bellman';
    if (serviceType.includes('coffee') || serviceType.includes('cafe')) return 'coffee';
    if (serviceType.includes('reception')) return 'reception';
    return 'other';
};
