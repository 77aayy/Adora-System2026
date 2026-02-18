/**
 * Shared Utilities for All Features
 * Common functions used across all modules
 * Adora Hotel Management System V2
 */

import { db } from '../../services/firebase';
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc,
    query, where, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { logger } from '../../services/loggerService';

// ============================================================
// TIME UTILITIES
// ============================================================

/**
 * Format timestamp to time string
 */
export const formatTime = (timestamp: any): string => {
    if (!timestamp) return '--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Format full date time
 */
export const formatFullDateTime = (timestamp: any): string => {
    if (!timestamp) return '--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Get time ago string
 */
export const getTimeAgo = (timestamp: any): string => {
    if (!timestamp) return '--';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `${diffMins} د`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} س`;
    return `${Math.floor(diffMins / 1440)} يوم`;
};

/**
 * Get duration string
 */
export const getDuration = (startTimestamp: any, endTimestamp?: any): string => {
    if (!startTimestamp) return '--';

    const start = startTimestamp.toDate ? startTimestamp.toDate() : new Date(startTimestamp);
    const end = endTimestamp
        ? (endTimestamp.toDate ? endTimestamp.toDate() : new Date(endTimestamp))
        : new Date();

    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) return `${diffMins} دقيقة`;
    if (diffHours < 24) return `${diffHours} ساعة`;
    return `${Math.floor(diffHours / 24)} يوم`;
};

/**
 * Check if timestamp is today
 */
export const isToday = (timestamp: any): boolean => {
    if (!timestamp) return false;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toDateString() === new Date().toDateString();
};

/**
 * Get date range for period
 */
export const getDateRange = (
    period: 'today' | 'yesterday' | 'week' | 'month' | 'custom',
    customFrom?: Date | null,
    customTo?: Date | null
): { from: Date; to: Date } => {
    const now = new Date();
    let from = new Date();
    let to = new Date();

    switch (period) {
        case 'today':
            from.setHours(0, 0, 0, 0);
            to.setHours(23, 59, 59, 999);
            break;
        case 'yesterday':
            from.setDate(now.getDate() - 1);
            from.setHours(0, 0, 0, 0);
            to.setDate(now.getDate() - 1);
            to.setHours(23, 59, 59, 999);
            break;
        case 'week':
            from.setDate(now.getDate() - 7);
            from.setHours(0, 0, 0, 0);
            to.setHours(23, 59, 59, 999);
            break;
        case 'month':
            from.setDate(now.getDate() - 30);
            from.setHours(0, 0, 0, 0);
            to.setHours(23, 59, 59, 999);
            break;
        case 'custom':
            if (customFrom && customTo) {
                from = new Date(customFrom);
                to = new Date(customTo);
                from.setHours(0, 0, 0, 0);
                to.setHours(23, 59, 59, 999);
            }
            break;
    }

    return { from, to };
};

/**
 * Check if date is within range
 */
export const isDateInRange = (date: Date, from: Date, to: Date): boolean => {
    return date >= from && date <= to;
};

// ============================================================
// SESSION UTILITIES
// ============================================================

const SESSION_KEY = 'adora_session';

export interface UserSession {
    employeeId: string;
    employeeName: string;
    department: string;
    branchId: string;
    branchName: string;
    hotelId: string;
    hotelName?: string;
}

/**
 * Get current session
 */
export const getSession = (): UserSession | null => {
    const session = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (session) {
        try {
            return JSON.parse(session);
        } catch (e) {
            return null;
        }
    }
    return null;
};

/**
 * Save session
 */
export const saveSession = (session: UserSession, remember: boolean = false): void => {
    const data = JSON.stringify(session);
    if (remember) {
        localStorage.setItem(SESSION_KEY, data);
    } else {
        sessionStorage.setItem(SESSION_KEY, data);
    }
};

/**
 * Clear session
 */
export const clearSession = (): void => {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
};

// ============================================================
// POINTS UTILITIES
// ============================================================

/**
 * Add points to employee
 */
export const addPointsToEmployee = async (
    hotelId: string,
    branchId: string,
    employeeId: string,
    points: number,
    action: string,
    reason: string,
    details?: Record<string, any>
): Promise<boolean> => {
    // ✅ SaaS FIX: Use 'tenants' collection
    const employeePath = `tenants/${hotelId}/branches/${branchId}/employees/${employeeId}`;
    const employeeRef = doc(db, employeePath);

    try {
        // Get current points
        const empDoc = await getDoc(employeeRef);
        const currentPoints = empDoc.data()?.kpi_points || 0;

        // Update employee points
        await updateDoc(employeeRef, {
            kpi_points: currentPoints + points
        });

        // Log points history
        await addDoc(collection(db, `${employeePath}/pointsHistory`), {
            action,
            points,
            reason,
            details: details || {},
            timestamp: serverTimestamp()
        });

        return true;
    } catch (error) {
        logger.error('Error adding points:', error, 'sharedUtils');
        return false;
    }
};

/**
 * Get employee points
 */
export const getEmployeePoints = async (
    hotelId: string,
    branchId: string,
    employeeId: string
): Promise<number> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const employeePath = `tenants/${hotelId}/branches/${branchId}/employees/${employeeId}`;
        const empDoc = await getDoc(doc(db, employeePath));
        return empDoc.data()?.kpi_points || 0;
    } catch (error) {
        logger.error('Error getting points:', error, 'sharedUtils');
        return 0;
    }
};

/**
 * Get points history
 */
export const getPointsHistory = async (
    hotelId: string,
    branchId: string,
    employeeId: string,
    maxItems: number = 50
): Promise<any[]> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const historyPath = `tenants/${hotelId}/branches/${branchId}/employees/${employeeId}/pointsHistory`;
        const snapshot = await getDocs(collection(db, historyPath));

        const history: any[] = [];
        snapshot.forEach(doc => {
            history.push({ id: doc.id, ...doc.data() });
        });

        // Sort by timestamp descending
        history.sort((a, b) => {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
            return dateB.getTime() - dateA.getTime();
        });

        return history.slice(0, maxItems);
    } catch (error) {
        logger.error('Error getting points history:', error, 'sharedUtils');
        return [];
    }
};

// ============================================================
// STATUS UTILITIES
// ============================================================

export const STATUS_NAMES: Record<string, string> = {
    'PENDING': 'جديد',
    'PENDING_RECEPTION': 'بانتظار الاستقبال',
    'PENDING_APPROVAL': 'بانتظار الموافقة',
    'PENDING_HOUSEKEEPING': 'بانتظار التدبير المنزلي',
    'PENDING_MAINTENANCE': 'بانتظار الصيانة',
    'CONFIRMED': 'مؤكد',
    'IN_PROGRESS': 'قيد التنفيذ',
    'MAINTENANCE_IN_PROGRESS': 'الصيانة جارية',
    'HOUSEKEEPING_IN_PROGRESS': 'التنظيف جاري',
    'PURCHASED': 'تم الشراء',
    'COMPLETED': 'مكتمل',
    'REJECTED': 'مرفوض',
    'CANCELLED': 'ملغي'
};

export const getStatusName = (status: string): string => STATUS_NAMES[status] || status;

// ============================================================
// SERVICE TYPE UTILITIES
// ============================================================

export const SERVICE_NAMES: Record<string, string> = {
    'cleaning': 'تنظيف',
    'maintenance': 'صيانة',
    'bellman': 'بيلمان',
    'inspection': 'فحص',
    'room_service': 'خدمة غرف',
    'coffee_shop': 'كوفي شوب',
    'procurement': 'مشتريات',
    'vip_service': 'خدمة VIP'
};

export const getServiceName = (type: string): string => SERVICE_NAMES[type] || type;

// ============================================================
// DEPARTMENT UTILITIES
// ============================================================

export const DEPARTMENT_NAMES: Record<string, string> = {
    'reception': 'استقبال',
    'bellman': 'بيلمان',
    'housekeeping': 'هاوس كيبنج',
    'maintenance': 'صيانة',
    'procurement': 'مشتريات',
    'manager': 'مدير'
};

export const getDepartmentName = (dept: string): string => DEPARTMENT_NAMES[dept] || dept;

// ============================================================
// HAPTIC FEEDBACK (Mobile)
// ============================================================

export const triggerHaptic = (type: 'light' | 'medium' | 'success' | 'warning' | 'error' = 'light'): void => {
    if ('vibrate' in navigator) {
        switch (type) {
            case 'light':
                navigator.vibrate(10);
                break;
            case 'medium':
                navigator.vibrate(20);
                break;
            case 'success':
                navigator.vibrate([10, 50, 10]);
                break;
            case 'warning':
                navigator.vibrate([20, 30, 20]);
                break;
            case 'error':
                navigator.vibrate([50, 30, 50]);
                break;
        }
    }
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Time
    formatTime,
    formatFullDateTime,
    getTimeAgo,
    getDuration,
    isToday,
    getDateRange,
    isDateInRange,

    // Session
    getSession,
    saveSession,
    clearSession,

    // Points
    addPointsToEmployee,
    getEmployeePoints,
    getPointsHistory,

    // Status & Service
    getStatusName,
    getServiceName,
    getDepartmentName,

    // Haptic
    triggerHaptic
};
