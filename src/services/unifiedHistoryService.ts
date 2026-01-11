/**
 * Unified History Service
 * Centralized service for fetching history/logs from all departments
 * Adora Hotel Management System V2
 */

import {
    collection, getDocs, query, where, orderBy, Timestamp, limit
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export type DepartmentType = 'all' | 'bellman' | 'housekeeping' | 'maintenance' | 'procurement' | 'laundry' | 'reception';

export interface HistoryFilter {
    startDate?: Date;
    endDate?: Date;
    department?: DepartmentType;
    employeeId?: string;
    status?: string;
    roomNumber?: string;
    maxResults?: number;
}

export interface UnifiedHistoryItem {
    id: string;
    type: DepartmentType;
    action: string;
    description: string;
    roomNumber?: string;
    employeeName?: string;
    employeeId?: string;
    status?: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}

export interface HistorySummary {
    totalItems: number;
    byDepartment: Record<DepartmentType, number>;
    byStatus: Record<string, number>;
}

// ============================================================
// ACTION LABELS
// ============================================================

export const ACTION_LABELS: Record<string, string> = {
    // Bellman
    'check_in': 'إدخال نزيل',
    'check_out': 'إخراج نزيل',
    'luggage_in': 'استلام أمتعة',
    'luggage_out': 'تسليم أمتعة',

    // Housekeeping
    'cleaning_start': 'بدء تنظيف',
    'cleaning_complete': 'إنهاء تنظيف',
    'inspection_pass': 'فحص ناجح',
    'inspection_fail': 'فحص مرفوض',

    // Maintenance
    'maintenance_request': 'طلب صيانة',
    'maintenance_start': 'بدء صيانة',
    'maintenance_complete': 'إنهاء صيانة',

    // Procurement
    'purchase_request': 'طلب شراء',
    'purchase_approved': 'موافقة على شراء',
    'purchase_rejected': 'رفض شراء',
    'purchase_delivered': 'استلام مشتريات',

    // Laundry
    'laundry_delivery': 'تسليم للمغسلة',
    'laundry_receipt': 'استلام من المغسلة',
};

export const STATUS_LABELS: Record<string, string> = {
    'PENDING': 'معلق',
    'IN_PROGRESS': 'قيد التنفيذ',
    'COMPLETED': 'مكتمل',
    'CANCELLED': 'ملغي',
    'APPROVED': 'موافق عليه',
    'REJECTED': 'مرفوض',
    'delivered': 'تم التسليم',
    'received': 'تم الاستلام',
};

// ============================================================
// DATA LOADING
// ============================================================

/**
 * Get unified history from all departments
 * ✅ SaaS: Added tenantId parameter for data isolation
 */
export const getUnifiedHistory = async (
    branchId: string,
    tenantId: string,
    filter: HistoryFilter = {}
): Promise<UnifiedHistoryItem[]> => {
    const items: UnifiedHistoryItem[] = [];
    const { startDate, endDate, department, employeeId, status, maxResults = 100 } = filter;

    // Convert dates to Firestore Timestamps
    const startTimestamp = startDate ? Timestamp.fromDate(startDate) : null;
    const endTimestamp = endDate ? Timestamp.fromDate(new Date(endDate.getTime() + 86400000)) : null;

    // Fetch from each collection based on department filter
    const shouldFetch = (dept: DepartmentType) => !department || department === 'all' || department === dept;

    try {
        // 1. Bellman/Requests
        if (shouldFetch('bellman')) {
            const bellmanItems = await fetchBellmanHistory(branchId, tenantId, startTimestamp, endTimestamp, maxResults);
            items.push(...bellmanItems);
        }

        // 2. Reception
        if (shouldFetch('reception')) {
            const recItems = await fetchReceptionHistory(branchId, tenantId, startTimestamp, endTimestamp, maxResults);
            items.push(...recItems);
        }

        // 3. Housekeeping
        if (shouldFetch('housekeeping')) {
            const hkItems = await fetchHousekeepingHistory(branchId, tenantId, startTimestamp, endTimestamp, maxResults);
            items.push(...hkItems);
        }

        // 4. Maintenance
        if (shouldFetch('maintenance')) {
            const maintItems = await fetchMaintenanceHistory(branchId, tenantId, startTimestamp, endTimestamp, maxResults);
            items.push(...maintItems);
        }

        // 5. Procurement Requests (Fetch meaningful requests related to departments)
        const procDept = department === 'all' ? undefined : department;
        if (!department || department === 'all' || ['bellman', 'housekeeping', 'maintenance', 'reception', 'laundry'].includes(department)) {
            const procItems = await fetchProcurementHistory(branchId, tenantId, startTimestamp, endTimestamp, maxResults, procDept);
            items.push(...procItems);
        }

        // 6. Laundry (Only if specifically requested, otherwise typically part of housekeeping)
        if (shouldFetch('laundry')) {
            const laundryItems = await fetchLaundryHistory(branchId, tenantId, startTimestamp, endTimestamp, maxResults);
            items.push(...laundryItems);
        }
    } catch (err) {
        logger.error('Error fetching history', err, 'unifiedHistoryService');
    }

    // Apply additional filters
    let filtered = items;

    if (employeeId) {
        filtered = filtered.filter(i => i.employeeId === employeeId);
    }

    if (status) {
        filtered = filtered.filter(i => i.status === status);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Limit results
    return filtered.slice(0, maxResults);
};

/**
 * Fetch Reception history
 * ✅ SaaS: Added tenantId filter for data isolation
 */
const fetchReceptionHistory = async (
    branchId: string,
    tenantId: string,
    startTimestamp: Timestamp | null,
    endTimestamp: Timestamp | null,
    maxResults: number
): Promise<UnifiedHistoryItem[]> => {
    const items: UnifiedHistoryItem[] = [];

    try {
        let q = query(
            collection(db, 'requests'),
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('originDepartment', '==', 'reception')
        );

        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const data = doc.data();
            const timestamp = data.timestamp?.toDate?.() || new Date();

            if (startTimestamp && timestamp < startTimestamp.toDate()) return;
            if (endTimestamp && timestamp > endTimestamp.toDate()) return;

            items.push({
                id: doc.id,
                type: 'reception',
                action: data.type || 'general_request',
                description: data.notes || `طلب ${data.type}`,
                roomNumber: data.roomNumber,
                employeeName: data.createdBy?.name,
                employeeId: data.createdBy?.id,
                status: data.status,
                timestamp,
                metadata: {
                    details: data.details,
                    priority: data.priority
                }
            });
        });
    } catch (err) {
        logger.error('Error fetching reception history', err, 'unifiedHistoryService');
    }

    return items;
};

/**
 * Fetch Bellman history
 * ✅ SaaS: Added tenantId filter for data isolation
 */
const fetchBellmanHistory = async (
    branchId: string,
    tenantId: string,
    startTimestamp: Timestamp | null,
    endTimestamp: Timestamp | null,
    maxResults: number
): Promise<UnifiedHistoryItem[]> => {
    const items: UnifiedHistoryItem[] = [];

    try {
        let q = query(
            collection(db, 'requests'),
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('type', '==', 'bellman')
        );

        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const data = doc.data();
            const timestamp = data.timestamp?.toDate?.() || new Date();

            // Check date range
            if (startTimestamp && timestamp < startTimestamp.toDate()) return;
            if (endTimestamp && timestamp > endTimestamp.toDate()) return;

            items.push({
                id: doc.id,
                type: 'bellman',
                action: data.subType || 'check_in',
                description: data.subType === 'checkout' ? 'إخراج نزيل' : 'إدخال نزيل',
                roomNumber: data.roomNumber,
                employeeName: data.assignedTo?.name || data.createdBy?.name,
                employeeId: data.assignedTo?.id || data.createdBy?.id,
                status: data.status,
                timestamp,
                metadata: {
                    guestName: data.guestName,
                    luggageCount: data.luggageCount,
                }
            });
        });
    } catch (err) {
        logger.error('Error fetching bellman history', err, 'unifiedHistoryService');
    }

    return items;
};

/**
 * Fetch Housekeeping history
 * ✅ SaaS: Added tenantId filter for data isolation
 */
const fetchHousekeepingHistory = async (
    branchId: string,
    tenantId: string,
    startTimestamp: Timestamp | null,
    endTimestamp: Timestamp | null,
    maxResults: number
): Promise<UnifiedHistoryItem[]> => {
    const items: UnifiedHistoryItem[] = [];

    try {
        let q = query(
            collection(db, 'requests'),
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('type', 'in', ['cleaning', 'inspection'])
        );

        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const data = doc.data();
            const timestamp = data.timestamp?.toDate?.() || new Date();

            if (startTimestamp && timestamp < startTimestamp.toDate()) return;
            if (endTimestamp && timestamp > endTimestamp.toDate()) return;

            const isInspection = data.type === 'inspection';
            const action = isInspection
                ? (data.status === 'COMPLETED' ? 'inspection_pass' : 'inspection_fail')
                : (data.status === 'COMPLETED' ? 'cleaning_complete' : 'cleaning_start');

            items.push({
                id: doc.id,
                type: 'housekeeping',
                action,
                description: isInspection ? 'فحص غرفة' : `تنظيف ${data.cleaningType === 'checkout' ? 'خروج' : 'مشغولة'}`,
                roomNumber: data.roomNumber,
                employeeName: data.assignedTo?.name,
                employeeId: data.assignedTo?.id,
                status: data.status,
                timestamp,
                metadata: {
                    cleaningType: data.cleaningType,
                    duration: data.duration,
                }
            });
        });
    } catch (err) {
        logger.error('Error fetching housekeeping history', err, 'unifiedHistoryService');
    }

    return items;
};

/**
 * Fetch Maintenance history
 * ✅ SaaS: Added tenantId filter for data isolation
 */
const fetchMaintenanceHistory = async (
    branchId: string,
    tenantId: string,
    startTimestamp: Timestamp | null,
    endTimestamp: Timestamp | null,
    maxResults: number
): Promise<UnifiedHistoryItem[]> => {
    const items: UnifiedHistoryItem[] = [];

    try {
        let q = query(
            collection(db, 'requests'),
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('type', '==', 'maintenance')
        );

        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const data = doc.data();
            const timestamp = data.timestamp?.toDate?.() || new Date();

            if (startTimestamp && timestamp < startTimestamp.toDate()) return;
            if (endTimestamp && timestamp > endTimestamp.toDate()) return;

            items.push({
                id: doc.id,
                type: 'maintenance',
                action: data.status === 'COMPLETED' ? 'maintenance_complete' : 'maintenance_request',
                description: data.issueType || 'صيانة عامة',
                roomNumber: data.roomNumber,
                employeeName: data.assignedTo?.name,
                employeeId: data.assignedTo?.id,
                status: data.status,
                timestamp,
                metadata: {
                    priority: data.priority,
                    issueType: data.issueType,
                }
            });
        });
    } catch (err) {
        logger.error('Error fetching maintenance history', err, 'unifiedHistoryService');
    }

    return items;
};

/**
 * Fetch Procurement history
 * ✅ SaaS: Added tenantId filter for data isolation
 */
const fetchProcurementHistory = async (
    branchId: string,
    tenantId: string,
    startTimestamp: Timestamp | null,
    endTimestamp: Timestamp | null,
    maxResults: number,
    targetDepartment?: DepartmentType
): Promise<UnifiedHistoryItem[]> => {
    const items: UnifiedHistoryItem[] = [];

    try {
        let q;

        if (targetDepartment && targetDepartment !== 'all') {
            q = query(
                collection(db, 'procurementRequests'),
                where('branch', '==', branchId),
                where('tenantId', '==', tenantId),
                where('department', '==', targetDepartment)
            );
        } else {
            q = query(
                collection(db, 'procurementRequests'),
                where('branch', '==', branchId),
                where('tenantId', '==', tenantId)
            );
        }

        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const data = doc.data();
            const timestamp = data.createdAt?.toDate?.() || new Date();

            if (startTimestamp && timestamp < startTimestamp.toDate()) return;
            if (endTimestamp && timestamp > endTimestamp.toDate()) return;

            // Map department string to DepartmentType safely
            const deptType = (data.department && ['bellman', 'housekeeping', 'maintenance', 'reception', 'laundry'].includes(data.department))
                ? data.department as DepartmentType
                : 'procurement';

            items.push({
                id: doc.id,
                type: deptType, // Now attributed to the requesting department
                action: 'purchase_request',
                description: `طلب شراء - ${data.department}`,
                employeeName: data.requestedBy?.name,
                employeeId: data.requestedBy?.id,
                status: data.status,
                timestamp,
                metadata: {
                    department: data.department,
                    totalAmount: data.totalAmount,
                    itemsCount: data.items?.length || 0,
                    source: 'procurement' // Tag to identify it came from procurement collection
                }
            });
        });
    } catch (err) {
        logger.error('Error fetching procurement history', err, 'unifiedHistoryService');
    }

    return items;
};

/**
 * Fetch Laundry history
 * ✅ SaaS: Added tenantId filter for data isolation
 */
const fetchLaundryHistory = async (
    branchId: string,
    tenantId: string,
    startTimestamp: Timestamp | null,
    endTimestamp: Timestamp | null,
    maxResults: number
): Promise<UnifiedHistoryItem[]> => {
    const items: UnifiedHistoryItem[] = [];

    try {
        let q = query(
            collection(db, 'laundryRecords'),
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId)
        );

        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {

            const data = doc.data();

            // Delivery record
            if (data.deliveredAt) {
                const timestamp = data.deliveredAt?.toDate?.() || new Date();

                if (startTimestamp && timestamp < startTimestamp.toDate()) return;
                if (endTimestamp && timestamp > endTimestamp.toDate()) return;

                const totalQty = Object.values(data.delivered || {}).reduce((s: number, q: any) => s + (q || 0), 0);

                items.push({
                    id: doc.id + '_delivery',
                    type: 'laundry',
                    action: 'laundry_delivery',
                    description: `تسليم للمغسلة - ${totalQty} قطعة`,
                    employeeName: data.deliveredBy?.name,
                    employeeId: data.deliveredBy?.id,
                    status: 'delivered',
                    timestamp,
                    metadata: {
                        totalQuantity: totalQty,
                        date: data.date,
                    }
                });
            }

            // Receipt record
            if (data.receivedAt) {
                const timestamp = data.receivedAt?.toDate?.() || new Date();

                if (startTimestamp && timestamp < startTimestamp.toDate()) return;
                if (endTimestamp && timestamp > endTimestamp.toDate()) return;

                const totalQty = Object.values(data.received || {}).reduce((s: number, q: any) => s + (q || 0), 0);
                const totalDeficit = Object.values(data.deficit || {}).reduce((s: number, q: any) => s + Math.abs(q || 0), 0);

                items.push({
                    id: doc.id + '_receipt',
                    type: 'laundry',
                    action: 'laundry_receipt',
                    description: `استلام من المغسلة - ${totalQty} قطعة${totalDeficit > 0 ? ` (عجز: ${totalDeficit})` : ''}`,
                    employeeName: data.receivedBy?.name,
                    employeeId: data.receivedBy?.id,
                    status: 'received',
                    timestamp,
                    metadata: {
                        totalQuantity: totalQty,
                        deficit: totalDeficit,
                        date: data.date,
                    }
                });
            }
        });
    } catch (err) {
        logger.error('Error fetching laundry history', err, 'unifiedHistoryService');
    }

    return items;
};

/**
 * Get history summary
 */
export const getHistorySummary = (items: UnifiedHistoryItem[]): HistorySummary => {
    const byDepartment: Record<DepartmentType, number> = {
        all: items.length,
        bellman: 0,
        housekeeping: 0,
        maintenance: 0,
        procurement: 0,
        laundry: 0,
        reception: 0,
    };

    const byStatus: Record<string, number> = {};

    items.forEach(item => {
        byDepartment[item.type]++;
        if (item.status) {
            byStatus[item.status] = (byStatus[item.status] || 0) + 1;
        }
    });

    return { totalItems: items.length, byDepartment, byStatus };
};

/**
 * Format date for display
 */
export const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * Format time only
 */
export const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
    });
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    getUnifiedHistory,
    getHistorySummary,
    formatDisplayDate,
    formatTime,
    ACTION_LABELS,
    STATUS_LABELS,
};
