/**
 * Audit Trail Service
 * Immutable logging for all critical actions
 * Adora Hotel Management System V2
 * 
 * 🔥 COST-EFFICIENT: Uses polling instead of real-time listeners
 * to minimize Firebase reads on free tier
 */

import { collection, addDoc, Timestamp, query, where, orderBy, limit, getDocs, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../services/firebase';
import { logger } from '../services/loggerService';
import { formatDateTimeGregorianEn } from './dateUtils';

// ============================================================
// TYPES
// ============================================================

export type AuditAction = 
    // Authentication
    | 'LOGIN'
    | 'LOGOUT'
    | 'LOGIN_FAILED'
    | 'LOGIN_BLOCKED' // Manager suspended/deleted
    // Service Requests
    | 'REQUEST_CREATE'
    | 'REQUEST_CONFIRM'
    | 'REQUEST_START'
    | 'REQUEST_COMPLETE'
    | 'REQUEST_CANCEL'
    // Room Operations
    | 'ROOM_CREATE'
    | 'ROOM_UPDATE'
    | 'ROOM_DELETE'
    // Employee Operations
    | 'EMPLOYEE_CREATE'
    | 'EMPLOYEE_UPDATE'
    | 'EMPLOYEE_DELETE'
    | 'EMPLOYEE_SUSPEND'
    | 'EMPLOYEE_ACTIVATE'
    // Manager/Tenant Operations (SaaS)
    | 'MANAGER_CREATE'
    | 'MANAGER_UPDATE'
    | 'MANAGER_SUSPEND'
    | 'MANAGER_ACTIVATE'
    | 'MANAGER_DELETE'
    | 'MANAGER_RESTORE'
    // Branch Operations
    | 'BRANCH_CREATE'
    | 'BRANCH_UPDATE'
    | 'BRANCH_DELETE'
    // Subscription/License Operations
    | 'SUBSCRIPTION_RENEW'
    | 'SUBSCRIPTION_EXPIRE'
    | 'SUBSCRIPTION_CANCEL'
    | 'PAYMENT_RECEIVED'
    | 'INVOICE_CREATE'
    // Guest Operations
    | 'CHECKIN'
    | 'CHECKOUT'
    // System Operations
    | 'POINTS_AWARD'
    | 'SETTINGS_CHANGE'
    | 'PHOTO_UPLOAD'
    | 'SYSTEM_MAINTENANCE_ON'
    | 'SYSTEM_MAINTENANCE_OFF'
    | 'BROADCAST_CREATE'
    | 'UPDATE_PUBLISH';

export interface AuditLog {
    id?: string;
    action: AuditAction;
    userId: string;
    userName: string;
    department: string;
    targetType: string; // 'request', 'room', 'employee', 'manager', 'branch', 'subscription', etc.
    targetId: string;
    targetName?: string; // Human-readable name of the target
    details: Record<string, unknown>;
    timestamp: Date;
    tenantId?: string; // For SaaS multi-tenancy filtering
    branchId?: string;
    ipAddress?: string;
    userAgent?: string;
}

// ============================================================
// AUDIT FUNCTIONS
// ============================================================

const AUDIT_COLLECTION = 'auditLogs';

// ============================================================
// AUDIT LOGGING FUNCTIONS
// ============================================================

export interface LogAuditOptions {
    action: AuditAction;
    userId: string;
    userName: string;
    department?: string;
    targetType: string;
    targetId: string;
    targetName?: string;
    details?: Record<string, unknown>;
    tenantId?: string;
    branchId?: string;
}

/**
 * Log an action to the audit trail (immutable)
 * Enhanced with SaaS multi-tenancy support
 */
export const logAudit = async (
    action: AuditAction,
    userId: string,
    userName: string,
    department: string,
    targetType: string,
    targetId: string,
    details: Record<string, unknown> = {},
    options?: { targetName?: string; tenantId?: string; branchId?: string }
): Promise<void> => {
    try {
        const auditRef = collection(db, AUDIT_COLLECTION);
        
        await addDoc(auditRef, {
            action,
            userId,
            userName,
            department: department || 'system',
            targetType,
            targetId,
            targetName: options?.targetName || '',
            details,
            tenantId: options?.tenantId || '',
            branchId: options?.branchId || '',
            timestamp: Timestamp.now(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        });
    } catch (error: unknown) {
        // تجاهل "Document already exists" (استدعاء مزدوج من Strict Mode أو إعادة محاولة)
        const msg = error && typeof (error as { message?: string }).message === 'string' ? (error as { message: string }).message : '';
        const code = error && typeof (error as { code?: string }).code === 'string' ? (error as { code: string }).code : '';
        if (code === 'already-exists' || /already exists/i.test(msg)) {
            return;
        }
        // أي خطأ آخر: لا نرمي حتى لا نكسر التطبيق
    }
};

/**
 * Advanced audit log with full options
 */
export const logAuditAdvanced = async (options: LogAuditOptions): Promise<void> => {
    return logAudit(
        options.action,
        options.userId,
        options.userName,
        options.department || 'system',
        options.targetType,
        options.targetId,
        options.details || {},
        {
            targetName: options.targetName,
            tenantId: options.tenantId,
            branchId: options.branchId
        }
    );
};

/**
 * Quick audit log (for common actions)
 * Automatically gets user from localStorage or uses system user
 */
export const quickAudit = (
    action: AuditAction,
    targetType: string,
    targetId: string,
    details?: Record<string, unknown>,
    targetName?: string
): void => {
    // ✅ Try to get user from localStorage first
    const storedUser = localStorage.getItem('adora_user');
    let userId = 'system';
    let userName = 'النظام';
    let department = 'system';
    let tenantId: string | undefined;
    let branchId: string | undefined;
    
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            userId = user.id || 'system';
            userName = user.name || 'النظام';
            department = user.department || 'system';
            tenantId = user.tenantId;
            branchId = user.branchId;
        } catch (e) {
            console.warn('Failed to parse stored user:', e);
        }
    }
    
    // ✅ Always log audit, even if no user found (for owner actions)
    logAudit(
        action,
        userId,
        userName,
        department,
        targetType,
        targetId,
        details || {},
        {
            targetName,
            tenantId,
            branchId
        }
    ).catch(err => {
        console.error('Failed to log audit:', err);
    });
};

// ============================================================
// FETCHING AUDIT LOGS
// ============================================================

/**
 * Get recent audit logs
 * 🔥 COST-EFFICIENT: Single query, no real-time listener
 */
export const getRecentAuditLogs = async (limitCount: number = 50): Promise<AuditLog[]> => {
    try {
        const auditRef = collection(db, AUDIT_COLLECTION);
        const q = query(auditRef, orderBy('timestamp', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as AuditLog[];
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        return [];
    }
};

/**
 * Get audit logs for a specific tenant (SaaS)
 */
export const getAuditLogsForTenant = async (
    tenantId: string,
    limitCount: number = 50
): Promise<AuditLog[]> => {
    try {
        const auditRef = collection(db, AUDIT_COLLECTION);
        const q = query(
            auditRef,
            where('tenantId', '==', tenantId),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as AuditLog[];
    } catch (error) {
        console.error('Failed to fetch audit logs for tenant:', error);
        return [];
    }
};

/**
 * Get audit logs for a specific target
 */
export const getAuditLogsForTarget = async (
    targetType: string,
    targetId: string
): Promise<AuditLog[]> => {
    try {
        const auditRef = collection(db, AUDIT_COLLECTION);
        const q = query(
            auditRef,
            where('targetType', '==', targetType),
            where('targetId', '==', targetId),
            orderBy('timestamp', 'desc')
        );
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as AuditLog[];
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        return [];
    }
};

// ============================================================
// SMART ACTIVITY FEED (Zero Automatic Firebase Usage)
// ============================================================

/**
 * 🎯 SMART CLASSIFICATION - What needs real-time vs on-demand:
 * 
 * ✅ REAL-TIME (onSnapshot) - Critical for operations:
 *    - Service requests (reception, housekeeping, maintenance)
 *    - Room status changes
 *    - Restaurant/Coffee shop orders
 *    - Emergency notifications
 * 
 * ❌ ON-DEMAND ONLY - Activity Log (this service):
 *    - Fetches ONLY when user clicks refresh
 *    - NO automatic polling = ZERO Firebase reads when idle
 *    - 5 minute cache = prevents repeated fetches
 *    - Perfect for "nice to have" features
 */

// Local cache - persists during session
let cachedLogs: AuditLog[] = [];
let lastFetchTimestamp: Date | null = null;

// Configuration for MAXIMUM Firebase savings
const CACHE_CONFIG = {
    maxLogs: 20, // Fetch only 20 logs
    cacheValidityMs: 5 * 60 * 1000, // Cache valid for 5 MINUTES
};

/**
 * Get cached logs WITHOUT any Firebase read
 */
export const getCachedActivityLogs = (): AuditLog[] => {
    return cachedLogs;
};

/**
 * Check if cache is still valid (5 minutes)
 */
export const isCacheValid = (): boolean => {
    if (!lastFetchTimestamp || cachedLogs.length === 0) return false;
    const elapsed = Date.now() - lastFetchTimestamp.getTime();
    return elapsed < CACHE_CONFIG.cacheValidityMs;
};

/**
 * Get time until cache expires (for UI display)
 */
export const getCacheTimeRemaining = (): number => {
    if (!lastFetchTimestamp) return 0;
    const elapsed = Date.now() - lastFetchTimestamp.getTime();
    return Math.max(0, CACHE_CONFIG.cacheValidityMs - elapsed);
};

/**
 * Fetch activity logs - ONLY called manually by user
 * 🔥 ZERO automatic Firebase reads
 * 
 * @param forceRefresh If true, ignores cache and fetches fresh data
 */
export const fetchActivityLogs = async (forceRefresh: boolean = false): Promise<{
    logs: AuditLog[];
    fromCache: boolean;
}> => {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && isCacheValid()) {
        logger.debug('Activity: Returning cached data (no Firebase read)', undefined, 'auditService');
        return { logs: cachedLogs, fromCache: true };
    }
    
    try {
        logger.debug('Activity: Fetching from Firebase...', undefined, 'auditService');
        const auditRef = collection(db, AUDIT_COLLECTION);
        const q = query(
            auditRef,
            orderBy('timestamp', 'desc'),
            limit(CACHE_CONFIG.maxLogs)
        );
        
        const snapshot = await getDocs(q);
        
        cachedLogs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as AuditLog[];
        
        lastFetchTimestamp = new Date();
        
        logger.debug(`Activity: Fetched ${cachedLogs.length} logs, cached for 5 minutes`, undefined, 'auditService');
        
        return { logs: cachedLogs, fromCache: false };
    } catch (error: any) {
        const isChannelError = error?.code === 400 || error?.code === 404 ||
            error?.message?.includes('400') || error?.message?.includes('404') || error?.message?.includes('Listen/channel');
        if (isChannelError) {
            logger.debug('Activity fetch: Listen channel error, using cache', undefined, 'auditService');
        } else {
            logger.warn('Activity fetch error:', error?.message || error, 'auditService');
        }
        return { logs: cachedLogs, fromCache: true };
    }
};

/**
 * Force refresh activity logs (manual refresh button)
 * This is the ONLY way to trigger a Firebase read
 */
export const forceRefreshActivity = async (): Promise<AuditLog[]> => {
    const { logs } = await fetchActivityLogs(true);
    return logs;
};

/**
 * Clear activity cache (when logging out)
 */
export const clearActivityCache = (): void => {
    cachedLogs = [];
    lastFetchTimestamp = null;
    logger.debug('Activity cache cleared', undefined, 'auditService');
};

// ============================================================
// DEPRECATED - Keep for backwards compatibility but do nothing
// ============================================================

/**
 * @deprecated Activity feed no longer uses polling to save Firebase
 * Use fetchActivityLogs() for on-demand fetch instead
 */
export const startActivityPolling = (
    callback: (logs: AuditLog[]) => void,
    _intervalMs?: number
): () => void => {
    logger.debug('startActivityPolling is deprecated - using on-demand fetch instead', undefined, 'auditService');
    
    // Just do initial fetch, no polling
    fetchActivityLogs().then((result) => {
        const logs = result?.logs || [];
        if (logs.length > 0) {
            callback(logs);
        }
    }).catch(err => {
        console.error('Failed to fetch activity logs in startActivityPolling:', err);
        callback([]); // Call with empty array on error
    });
    
    // Return empty cleanup
    return () => {};
};

/**
 * @deprecated No longer needed
 */
export const stopActivityPolling = (): void => {
    // No-op
};

// ============================================================
// ACTION LABELS & ICONS
// ============================================================

/**
 * Get action label in Arabic
 */
export const getActionLabel = (action: AuditAction): string => {
    const labels: Record<AuditAction, string> = {
        // Authentication
        LOGIN: 'تسجيل دخول',
        LOGOUT: 'تسجيل خروج',
        LOGIN_FAILED: 'فشل تسجيل الدخول',
        LOGIN_BLOCKED: 'حظر تسجيل الدخول',
        // Service Requests
        REQUEST_CREATE: 'إنشاء طلب',
        REQUEST_CONFIRM: 'تأكيد طلب',
        REQUEST_START: 'بدء العمل',
        REQUEST_COMPLETE: 'إتمام طلب',
        REQUEST_CANCEL: 'إلغاء طلب',
        // Room Operations
        ROOM_CREATE: 'إنشاء غرفة',
        ROOM_UPDATE: 'تحديث غرفة',
        ROOM_DELETE: 'حذف غرفة',
        // Employee Operations
        EMPLOYEE_CREATE: 'إنشاء موظف',
        EMPLOYEE_UPDATE: 'تحديث موظف',
        EMPLOYEE_DELETE: 'حذف موظف',
        EMPLOYEE_SUSPEND: 'إيقاف موظف',
        EMPLOYEE_ACTIVATE: 'تفعيل موظف',
        // Manager/Tenant Operations (SaaS)
        MANAGER_CREATE: 'إنشاء مدير جديد',
        MANAGER_UPDATE: 'تحديث بيانات مدير',
        MANAGER_SUSPEND: 'إيقاف مدير',
        MANAGER_ACTIVATE: 'تفعيل مدير',
        MANAGER_DELETE: 'حذف مدير',
        MANAGER_RESTORE: 'استعادة مدير محذوف',
        // Branch Operations
        BRANCH_CREATE: 'إنشاء فرع جديد',
        BRANCH_UPDATE: 'تحديث فرع',
        BRANCH_DELETE: 'حذف فرع',
        // Subscription/License Operations
        SUBSCRIPTION_RENEW: 'تجديد اشتراك',
        SUBSCRIPTION_EXPIRE: 'انتهاء اشتراك',
        SUBSCRIPTION_CANCEL: 'إلغاء اشتراك',
        PAYMENT_RECEIVED: 'استلام دفعة',
        INVOICE_CREATE: 'إنشاء فاتورة',
        // Guest Operations
        CHECKIN: 'تسجيل دخول نزيل',
        CHECKOUT: 'تسجيل خروج نزيل',
        // System Operations
        POINTS_AWARD: 'منح نقاط',
        SETTINGS_CHANGE: 'تغيير إعدادات',
        PHOTO_UPLOAD: 'رفع صورة',
        SYSTEM_MAINTENANCE_ON: 'تفعيل وضع الصيانة',
        SYSTEM_MAINTENANCE_OFF: 'إلغاء وضع الصيانة',
        BROADCAST_CREATE: 'إرسال إشعار عام',
        UPDATE_PUBLISH: 'نشر تحديث',
    };
    return labels[action] || action;
};

/**
 * Get action icon emoji
 */
export const getActionIcon = (action: AuditAction): string => {
    const icons: Record<AuditAction, string> = {
        // Authentication
        LOGIN: '🔓',
        LOGOUT: '🔒',
        LOGIN_FAILED: '❌',
        LOGIN_BLOCKED: '🚫',
        // Service Requests
        REQUEST_CREATE: '📝',
        REQUEST_CONFIRM: '✅',
        REQUEST_START: '▶️',
        REQUEST_COMPLETE: '✔️',
        REQUEST_CANCEL: '❌',
        // Room Operations
        ROOM_CREATE: '🏠',
        ROOM_UPDATE: '🔧',
        ROOM_DELETE: '🗑️',
        // Employee Operations
        EMPLOYEE_CREATE: '👤',
        EMPLOYEE_UPDATE: '✏️',
        EMPLOYEE_DELETE: '🗑️',
        EMPLOYEE_SUSPEND: '⏸️',
        EMPLOYEE_ACTIVATE: '▶️',
        // Manager/Tenant Operations (SaaS)
        MANAGER_CREATE: '👔',
        MANAGER_UPDATE: '✏️',
        MANAGER_SUSPEND: '⏸️',
        MANAGER_ACTIVATE: '▶️',
        MANAGER_DELETE: '🗑️',
        MANAGER_RESTORE: '♻️',
        // Branch Operations
        BRANCH_CREATE: '🏢',
        BRANCH_UPDATE: '🔧',
        BRANCH_DELETE: '🗑️',
        // Subscription/License Operations
        SUBSCRIPTION_RENEW: '🔄',
        SUBSCRIPTION_EXPIRE: '⏰',
        SUBSCRIPTION_CANCEL: '❌',
        PAYMENT_RECEIVED: '💰',
        INVOICE_CREATE: '🧾',
        // Guest Operations
        CHECKIN: '🛎️',
        CHECKOUT: '🚪',
        // System Operations
        POINTS_AWARD: '⭐',
        SETTINGS_CHANGE: '⚙️',
        PHOTO_UPLOAD: '📷',
        SYSTEM_MAINTENANCE_ON: '🔧',
        SYSTEM_MAINTENANCE_OFF: '✅',
        BROADCAST_CREATE: '📢',
        UPDATE_PUBLISH: '🚀',
    };
    return icons[action] || '📋';
};

/**
 * Get action color class
 */
export const getActionColor = (action: AuditAction): string => {
    const colors: Record<string, string> = {
        // Success actions (green)
        LOGIN: 'text-green-400',
        REQUEST_COMPLETE: 'text-green-400',
        MANAGER_CREATE: 'text-green-400',
        MANAGER_ACTIVATE: 'text-green-400',
        EMPLOYEE_CREATE: 'text-green-400',
        EMPLOYEE_ACTIVATE: 'text-green-400',
        BRANCH_CREATE: 'text-green-400',
        SUBSCRIPTION_RENEW: 'text-green-400',
        PAYMENT_RECEIVED: 'text-green-400',
        MANAGER_RESTORE: 'text-green-400',
        CHECKIN: 'text-green-400',
        SYSTEM_MAINTENANCE_OFF: 'text-green-400',
        
        // Warning actions (yellow/orange)
        MANAGER_SUSPEND: 'text-yellow-400',
        EMPLOYEE_SUSPEND: 'text-yellow-400',
        SUBSCRIPTION_EXPIRE: 'text-orange-400',
        SYSTEM_MAINTENANCE_ON: 'text-yellow-400',
        
        // Danger actions (red)
        LOGIN_FAILED: 'text-red-400',
        LOGIN_BLOCKED: 'text-red-400',
        MANAGER_DELETE: 'text-red-400',
        EMPLOYEE_DELETE: 'text-red-400',
        BRANCH_DELETE: 'text-red-400',
        SUBSCRIPTION_CANCEL: 'text-red-400',
        REQUEST_CANCEL: 'text-red-400',
        ROOM_DELETE: 'text-red-400',
        
        // Info actions (blue)
        LOGOUT: 'text-blue-400',
        REQUEST_CREATE: 'text-blue-400',
        REQUEST_START: 'text-blue-400',
        MANAGER_UPDATE: 'text-blue-400',
        EMPLOYEE_UPDATE: 'text-blue-400',
        ROOM_CREATE: 'text-blue-400',
        ROOM_UPDATE: 'text-blue-400',
        BRANCH_UPDATE: 'text-blue-400',
        INVOICE_CREATE: 'text-blue-400',
        CHECKOUT: 'text-blue-400',
        SETTINGS_CHANGE: 'text-blue-400',
        BROADCAST_CREATE: 'text-blue-400',
        UPDATE_PUBLISH: 'text-blue-400',
    };
    return colors[action] || 'text-white/60';
};

/**
 * Format time ago in Arabic
 */
export const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'الآن';
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    if (diffHour < 24) return `منذ ${diffHour} ساعة`;
    if (diffDay < 7) return `منذ ${diffDay} يوم`;
    
    return formatDateTimeGregorianEn(date, { dateStyle: 'medium', showSeconds: false });
};
