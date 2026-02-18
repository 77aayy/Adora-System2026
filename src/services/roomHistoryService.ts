/**
 * Room History Service
 * Migrated from room-history.js with TypeScript
 * Adora Hotel Management System V2
 * 
 * Provides history for each room:
 * - Cleaning records
 * - Service requests
 * - Maintenance history
 */

import { db } from './firebase';
import {
    collection, getDocs, query, where, orderBy, limit, Timestamp
} from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type HistoryTabType = 'cleaning' | 'requests' | 'maintenance';

export interface CleaningRecord {
    id: string;
    roomNumber: string;
    type: 'occupied' | 'checkout';
    employee: string;
    employeeId?: string;
    startTime?: any;
    finishTime?: any;
    duration?: string;
    status: string;
    notes?: string;
    timestamp?: any;
}

export interface RequestRecord {
    id: string;
    roomNumber: string;
    requestType?: string;
    serviceType?: string;
    description?: string;
    status: string;
    createdBy?: { name: string; id: string };
    assignedTo?: { name: string; id: string };
    createdAt?: any;
    completedAt?: any;
    notes?: string;
}

export interface MaintenanceRecord {
    id: string;
    roomNumber: string;
    issueType?: string;
    description?: string;
    priority?: string;
    status: string;
    assignedTo?: string;
    createdAt?: any;
    completedAt?: any;
    photoUrl?: string;
    notes?: string;
}

export interface RoomHistoryData {
    cleaning: CleaningRecord[];
    requests: RequestRecord[];
    maintenance: MaintenanceRecord[];
    stats: {
        totalCleanings: number;
        totalRequests: number;
        totalMaintenance: number;
    };
}

export interface SessionContext {
    hotelId: string;
    branchId: string;
}

// ============================================================
// CONSTANTS
// ============================================================

export const TAB_ICONS: Record<HistoryTabType, string> = {
    cleaning: '🧹',
    requests: '🛎️',
    maintenance: '🔧'
};

export const TAB_LABELS: Record<HistoryTabType, string> = {
    cleaning: 'التنظيف',
    requests: 'الطلبات',
    maintenance: 'الصيانة'
};

export const STATUS_NAMES: Record<string, string> = {
    COMPLETED: 'مكتمل',
    IN_PROGRESS: 'قيد التنفيذ',
    PENDING: 'معلق',
    CONFIRMED: 'مؤكد',
    CANCELLED: 'ملغي'
};

// ============================================================
// DATA LOADING
// ============================================================

/**
 * Load cleaning history for a room
 */
/**
 * Load cleaning history for a room
 */
export const loadCleaningHistory = async (
    session: SessionContext,
    roomNumber: string,
    maxResults: number = 20
): Promise<CleaningRecord[]> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const basePath = `tenants/${session.hotelId}/branches/${session.branchId}`;

        // ✅ Fix: Remove orderBy to prevent index errors
        const cleaningQuery = query(
            collection(db, `${basePath}/cleaningLogs`),
            where('roomNumber', '==', roomNumber)
        );

        const snapshot = await getDocs(cleaningQuery);
        const records: CleaningRecord[] = [];

        snapshot.forEach(doc => {
            records.push({ id: doc.id, ...doc.data() } as CleaningRecord);
        });

        // ✅ Client-side Sort & Limit
        records.sort((a, b) => {
            const tA = a.timestamp?.toMillis?.() || 0;
            const tB = b.timestamp?.toMillis?.() || 0;
            return tB - tA;
        });

        return records.slice(0, maxResults);
    } catch (error) {
        logger.error('Error loading cleaning history:', error, 'roomHistoryService');
        return [];
    }
};

/**
 * Load requests history for a room
 */
export const loadRequestsHistory = async (
    session: SessionContext,
    roomNumber: string,
    maxResults: number = 20
): Promise<RequestRecord[]> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const basePath = `tenants/${session.hotelId}/branches/${session.branchId}`;

        // ✅ Fix: Remove orderBy to prevent index errors
        const requestsQuery = query(
            collection(db, `${basePath}/requests`),
            where('roomNumber', '==', roomNumber)
        );

        const snapshot = await getDocs(requestsQuery);
        const records: RequestRecord[] = [];

        snapshot.forEach(doc => {
            records.push({ id: doc.id, ...doc.data() } as RequestRecord);
        });

        // ✅ Client-side Sort & Limit
        records.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || 0;
            return tB - tA;
        });

        return records.slice(0, maxResults);
    } catch (error) {
        logger.error('Error loading requests history:', error, 'roomHistoryService');
        return [];
    }
};

/**
 * Load maintenance history for a room
 */
export const loadMaintenanceHistory = async (
    session: SessionContext,
    roomNumber: string,
    maxResults: number = 20
): Promise<MaintenanceRecord[]> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const basePath = `tenants/${session.hotelId}/branches/${session.branchId}`;

        // ✅ Fix: Remove orderBy to prevent index errors
        const maintenanceQuery = query(
            collection(db, `${basePath}/maintenance`),
            where('roomNumber', '==', roomNumber)
        );

        const snapshot = await getDocs(maintenanceQuery);
        const records: MaintenanceRecord[] = [];

        snapshot.forEach(doc => {
            records.push({ id: doc.id, ...doc.data() } as MaintenanceRecord);
        });

        // ✅ Client-side Sort & Limit
        records.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || 0;
            return tB - tA;
        });

        return records.slice(0, maxResults);
    } catch (error) {
        logger.error('Error loading maintenance history:', error, 'roomHistoryService');
        return [];
    }
};


/**
 * Load all history for a room
 */
export const loadRoomHistory = async (
    session: SessionContext,
    roomNumber: string
): Promise<RoomHistoryData> => {
    const [cleaning, requests, maintenance] = await Promise.all([
        loadCleaningHistory(session, roomNumber),
        loadRequestsHistory(session, roomNumber),
        loadMaintenanceHistory(session, roomNumber)
    ]);

    return {
        cleaning,
        requests,
        maintenance,
        stats: {
            totalCleanings: cleaning.length,
            totalRequests: requests.length,
            totalMaintenance: maintenance.length
        }
    };
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Format date for display
 */
export const formatHistoryDate = (timestamp: any): string => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return `اليوم ${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
        return 'أمس';
    } else if (diffDays < 7) {
        return `منذ ${diffDays} أيام`;
    } else {
        return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    }
};

/**
 * Calculate duration between two times
 */
export const calculateDuration = (startTime: any, finishTime: any): string => {
    if (!startTime || !finishTime) return '';

    const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
    const end = finishTime.toDate ? finishTime.toDate() : new Date(finishTime);
    const mins = Math.round((end.getTime() - start.getTime()) / 60000);

    if (mins < 60) {
        return `${mins} دقيقة`;
    }

    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours} ساعة ${remainingMins > 0 ? `و ${remainingMins} دقيقة` : ''}`;
};

/**
 * Get title for history item
 */
export const getItemTitle = (tabType: HistoryTabType, item: any): string => {
    switch (tabType) {
        case 'cleaning':
            const type = item.type === 'checkout' ? 'مغادرة' : 'ساكن';
            return `تنظيف ${type}`;
        case 'requests':
            return item.requestType || item.serviceType || item.description || 'طلب';
        case 'maintenance':
            return item.issueType || item.description || 'صيانة';
        default:
            return '';
    }
};

/**
 * Translate status
 */
export const translateStatus = (status: string): string => {
    return STATUS_NAMES[status] || status;
};

/**
 * Get status color class
 */
export const getStatusColorClass = (status: string): string => {
    switch (status) {
        case 'COMPLETED':
            return 'bg-green-100 text-green-700';
        case 'IN_PROGRESS':
        case 'CONFIRMED':
            return 'bg-blue-100 text-blue-700';
        case 'PENDING':
            return 'bg-yellow-100 text-yellow-700';
        case 'CANCELLED':
            return 'bg-red-100 text-red-700';
        default:
            return 'bg-gray-100 text-gray-700';
    }
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback, useEffect } from 'react';

interface UseRoomHistoryReturn {
    data: RoomHistoryData | null;
    loading: boolean;
    error: string | null;
    activeTab: HistoryTabType;
    setActiveTab: (tab: HistoryTabType) => void;
    refresh: () => Promise<void>;
}

export const useRoomHistory = (
    session: SessionContext | null,
    roomNumber: string | null
): UseRoomHistoryReturn => {
    const [data, setData] = useState<RoomHistoryData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<HistoryTabType>('cleaning');

    const refresh = useCallback(async () => {
        if (!session?.hotelId || !session?.branchId || !roomNumber) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const historyData = await loadRoomHistory(session, roomNumber);
            setData(historyData);
        } catch (err: any) {
            setError(err.message || 'حدث خطأ في تحميل السجل');
        } finally {
            setLoading(false);
        }
    }, [session, roomNumber]);

    useEffect(() => {
        if (session && roomNumber) {
            refresh();
        }
    }, [session, roomNumber, refresh]);

    return {
        data,
        loading,
        error,
        activeTab,
        setActiveTab,
        refresh
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Constants
    TAB_ICONS,
    TAB_LABELS,
    STATUS_NAMES,

    // Data loading
    loadCleaningHistory,
    loadRequestsHistory,
    loadMaintenanceHistory,
    loadRoomHistory,

    // Helpers
    formatHistoryDate,
    calculateDuration,
    getItemTitle,
    translateStatus,
    getStatusColorClass,

    // Hook
    useRoomHistory
};
