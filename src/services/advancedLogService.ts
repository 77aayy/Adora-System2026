/**
 * Advanced Log Service
 * Comprehensive logging system for all departments
 * Features: Advanced filtering, PDF export, analytics, search
 * Adora Hotel Management System V3 - SaaS
 */

import {
    collection, getDocs, query, where, orderBy, Timestamp, limit, 
    addDoc, serverTimestamp, startAfter, DocumentSnapshot, onSnapshot, Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type LogCategory = 
    | 'all'
    | 'authentication'      // تسجيل الدخول/الخروج
    | 'requests'           // الطلبات (بيلمان، نظافة، صيانة)
    | 'rooms'              // عمليات الغرف
    | 'employees'          // عمليات الموظفين
    | 'guests'             // عمليات النزلاء
    | 'inventory'          // المخزون
    | 'financial'          // المالية
    | 'system'             // النظام
    | 'security';          // الأمان

export type LogSeverity = 'info' | 'warning' | 'error' | 'critical' | 'success';

export type LogAction = 
    // Authentication
    | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'LOGIN_BLOCKED' | 'PASSWORD_CHANGE' | 'SESSION_EXPIRED'
    // Requests
    | 'REQUEST_CREATE' | 'REQUEST_CONFIRM' | 'REQUEST_ASSIGN' | 'REQUEST_START' 
    | 'REQUEST_COMPLETE' | 'REQUEST_CANCEL' | 'REQUEST_TRANSFER' | 'REQUEST_ESCALATE'
    | 'REQUEST_RATE' | 'REQUEST_REOPEN'
    // Rooms
    | 'ROOM_CREATE' | 'ROOM_UPDATE' | 'ROOM_DELETE' | 'ROOM_STATUS_CHANGE'
    | 'ROOM_CARD_OPEN' | 'ROOM_CARD_CLOSE' | 'ROOM_CLEANING_START' | 'ROOM_CLEANING_COMPLETE'
    | 'ROOM_INSPECTION_PASS' | 'ROOM_INSPECTION_FAIL' | 'ROOM_MAINTENANCE_START' | 'ROOM_MAINTENANCE_COMPLETE'
    // Employees
    | 'EMPLOYEE_CREATE' | 'EMPLOYEE_UPDATE' | 'EMPLOYEE_DELETE' | 'EMPLOYEE_SUSPEND'
    | 'EMPLOYEE_ACTIVATE' | 'EMPLOYEE_SHIFT_START' | 'EMPLOYEE_SHIFT_END' | 'EMPLOYEE_BREAK_START'
    | 'EMPLOYEE_BREAK_END' | 'EMPLOYEE_POINTS_AWARD' | 'EMPLOYEE_POINTS_REDEEM'
    // Guests
    | 'GUEST_CHECKIN' | 'GUEST_CHECKOUT' | 'GUEST_REQUEST' | 'GUEST_FEEDBACK'
    | 'GUEST_COMPLAINT' | 'GUEST_VIP_MARK' | 'GUEST_BLACKLIST' | 'GUEST_LOYALTY_UPDATE'
    // Inventory
    | 'INVENTORY_ADD' | 'INVENTORY_REMOVE' | 'INVENTORY_TRANSFER' | 'INVENTORY_AUDIT'
    | 'PROCUREMENT_REQUEST' | 'PROCUREMENT_APPROVE' | 'PROCUREMENT_REJECT' | 'PROCUREMENT_RECEIVE'
    // Financial
    | 'PAYMENT_RECEIVE' | 'PAYMENT_REFUND' | 'INVOICE_CREATE' | 'INVOICE_VOID'
    | 'CHARGE_ADD' | 'CHARGE_REMOVE' | 'SUBSCRIPTION_RENEW' | 'SUBSCRIPTION_EXPIRE'
    // System
    | 'SETTINGS_CHANGE' | 'BACKUP_CREATE' | 'BACKUP_RESTORE' | 'MAINTENANCE_ON'
    | 'MAINTENANCE_OFF' | 'BROADCAST_SEND' | 'UPDATE_DEPLOY' | 'DATA_EXPORT'
    // Security
    | 'SUSPICIOUS_ACTIVITY' | 'DEVICE_BLOCKED' | 'ROOM_BLOCKED' | 'ACCESS_DENIED'
    | 'AUDIT_VIEW' | 'PERMISSION_CHANGE';

export interface AdvancedLogEntry {
    id?: string;
    
    // Core Info
    action: LogAction;
    category: LogCategory;
    severity: LogSeverity;
    
    // Description
    title: string;          // عنوان قصير
    description: string;    // وصف تفصيلي
    
    // Actor
    actorId: string;
    actorName: string;
    actorRole: string;
    actorDepartment: string;
    
    // Target
    targetType: string;     // 'request', 'room', 'employee', 'guest', etc.
    targetId: string;
    targetName?: string;
    
    // Context
    roomNumber?: string;
    branchId: string;
    branchName?: string;
    tenantId: string;
    
    // Time
    timestamp: Date;
    duration?: number;      // مدة العملية بالثواني
    
    // Technical
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    sessionId?: string;
    
    // Metadata
    metadata?: Record<string, any>;
    previousValue?: any;    // القيمة قبل التعديل
    newValue?: any;         // القيمة بعد التعديل
    
    // Relations
    relatedLogIds?: string[];
    parentLogId?: string;
}

export interface LogFilter {
    // Time Range
    startDate?: Date;
    endDate?: Date;
    
    // Category & Action
    categories?: LogCategory[];
    actions?: LogAction[];
    severities?: LogSeverity[];
    
    // Actor
    actorId?: string;
    actorDepartment?: string;
    actorRole?: string;
    
    // Target
    targetType?: string;
    targetId?: string;
    roomNumber?: string;
    
    // Search
    searchText?: string;
    
    // Pagination
    limit?: number;
    startAfterDoc?: DocumentSnapshot;
}

export interface LogStats {
    total: number;
    byCategory: Record<LogCategory, number>;
    bySeverity: Record<LogSeverity, number>;
    byHour: Record<number, number>;
    byDepartment: Record<string, number>;
    topActors: { id: string; name: string; count: number }[];
    topActions: { action: LogAction; count: number }[];
}

// ============================================================
// CONSTANTS
// ============================================================

// ✅ FIX: Use tenant-scoped collection (SaaS isolation)
const getLogsCollection = (tenantId: string): string => `tenants/${tenantId}/activityLogs`;

export const CATEGORY_CONFIG: Record<LogCategory, { label: string; icon: string; color: string }> = {
    all: { label: 'الكل', icon: '📋', color: 'slate' },
    authentication: { label: 'تسجيل الدخول', icon: '🔐', color: 'blue' },
    requests: { label: 'الطلبات', icon: '📝', color: 'teal' },
    rooms: { label: 'الغرف', icon: '🏠', color: 'purple' },
    employees: { label: 'الموظفين', icon: '👥', color: 'green' },
    guests: { label: 'النزلاء', icon: '🧑‍💼', color: 'cyan' },
    inventory: { label: 'المخزون', icon: '📦', color: 'orange' },
    financial: { label: 'المالية', icon: '💰', color: 'yellow' },
    system: { label: 'النظام', icon: '⚙️', color: 'gray' },
    security: { label: 'الأمان', icon: '🛡️', color: 'red' },
};

export const SEVERITY_CONFIG: Record<LogSeverity, { label: string; icon: string; color: string }> = {
    info: { label: 'معلومات', icon: 'ℹ️', color: 'blue' },
    success: { label: 'نجاح', icon: '✅', color: 'green' },
    warning: { label: 'تحذير', icon: '⚠️', color: 'yellow' },
    error: { label: 'خطأ', icon: '❌', color: 'red' },
    critical: { label: 'حرج', icon: '🚨', color: 'red' },
};

export const ACTION_CONFIG: Record<LogAction, { label: string; category: LogCategory; severity: LogSeverity }> = {
    // Authentication
    LOGIN: { label: 'تسجيل دخول', category: 'authentication', severity: 'success' },
    LOGOUT: { label: 'تسجيل خروج', category: 'authentication', severity: 'info' },
    LOGIN_FAILED: { label: 'فشل تسجيل الدخول', category: 'authentication', severity: 'warning' },
    LOGIN_BLOCKED: { label: 'حظر تسجيل الدخول', category: 'security', severity: 'critical' },
    PASSWORD_CHANGE: { label: 'تغيير كلمة المرور', category: 'authentication', severity: 'info' },
    SESSION_EXPIRED: { label: 'انتهاء الجلسة', category: 'authentication', severity: 'info' },
    
    // Requests
    REQUEST_CREATE: { label: 'إنشاء طلب', category: 'requests', severity: 'info' },
    REQUEST_CONFIRM: { label: 'تأكيد طلب', category: 'requests', severity: 'success' },
    REQUEST_ASSIGN: { label: 'تعيين طلب', category: 'requests', severity: 'info' },
    REQUEST_START: { label: 'بدء العمل على طلب', category: 'requests', severity: 'info' },
    REQUEST_COMPLETE: { label: 'إتمام طلب', category: 'requests', severity: 'success' },
    REQUEST_CANCEL: { label: 'إلغاء طلب', category: 'requests', severity: 'warning' },
    REQUEST_TRANSFER: { label: 'تحويل طلب', category: 'requests', severity: 'info' },
    REQUEST_ESCALATE: { label: 'تصعيد طلب', category: 'requests', severity: 'warning' },
    REQUEST_RATE: { label: 'تقييم طلب', category: 'requests', severity: 'info' },
    REQUEST_REOPEN: { label: 'إعادة فتح طلب', category: 'requests', severity: 'warning' },
    
    // Rooms
    ROOM_CREATE: { label: 'إنشاء غرفة', category: 'rooms', severity: 'info' },
    ROOM_UPDATE: { label: 'تحديث غرفة', category: 'rooms', severity: 'info' },
    ROOM_DELETE: { label: 'حذف غرفة', category: 'rooms', severity: 'warning' },
    ROOM_STATUS_CHANGE: { label: 'تغيير حالة غرفة', category: 'rooms', severity: 'info' },
    ROOM_CARD_OPEN: { label: 'فتح بطاقة غرفة', category: 'rooms', severity: 'info' },
    ROOM_CARD_CLOSE: { label: 'إغلاق بطاقة غرفة', category: 'rooms', severity: 'info' },
    ROOM_CLEANING_START: { label: 'بدء تنظيف غرفة', category: 'rooms', severity: 'info' },
    ROOM_CLEANING_COMPLETE: { label: 'إتمام تنظيف غرفة', category: 'rooms', severity: 'success' },
    ROOM_INSPECTION_PASS: { label: 'نجاح فحص غرفة', category: 'rooms', severity: 'success' },
    ROOM_INSPECTION_FAIL: { label: 'فشل فحص غرفة', category: 'rooms', severity: 'error' },
    ROOM_MAINTENANCE_START: { label: 'بدء صيانة غرفة', category: 'rooms', severity: 'info' },
    ROOM_MAINTENANCE_COMPLETE: { label: 'إتمام صيانة غرفة', category: 'rooms', severity: 'success' },
    
    // Employees
    EMPLOYEE_CREATE: { label: 'إضافة موظف', category: 'employees', severity: 'info' },
    EMPLOYEE_UPDATE: { label: 'تحديث موظف', category: 'employees', severity: 'info' },
    EMPLOYEE_DELETE: { label: 'حذف موظف', category: 'employees', severity: 'warning' },
    EMPLOYEE_SUSPEND: { label: 'إيقاف موظف', category: 'employees', severity: 'warning' },
    EMPLOYEE_ACTIVATE: { label: 'تفعيل موظف', category: 'employees', severity: 'success' },
    EMPLOYEE_SHIFT_START: { label: 'بدء وردية', category: 'employees', severity: 'info' },
    EMPLOYEE_SHIFT_END: { label: 'انتهاء وردية', category: 'employees', severity: 'info' },
    EMPLOYEE_BREAK_START: { label: 'بدء استراحة', category: 'employees', severity: 'info' },
    EMPLOYEE_BREAK_END: { label: 'انتهاء استراحة', category: 'employees', severity: 'info' },
    EMPLOYEE_POINTS_AWARD: { label: 'منح نقاط', category: 'employees', severity: 'success' },
    EMPLOYEE_POINTS_REDEEM: { label: 'استبدال نقاط', category: 'employees', severity: 'info' },
    
    // Guests
    GUEST_CHECKIN: { label: 'تسجيل دخول نزيل', category: 'guests', severity: 'info' },
    GUEST_CHECKOUT: { label: 'تسجيل خروج نزيل', category: 'guests', severity: 'info' },
    GUEST_REQUEST: { label: 'طلب نزيل', category: 'guests', severity: 'info' },
    GUEST_FEEDBACK: { label: 'تقييم نزيل', category: 'guests', severity: 'info' },
    GUEST_COMPLAINT: { label: 'شكوى نزيل', category: 'guests', severity: 'warning' },
    GUEST_VIP_MARK: { label: 'تصنيف VIP', category: 'guests', severity: 'info' },
    GUEST_BLACKLIST: { label: 'إضافة للقائمة السوداء', category: 'guests', severity: 'critical' },
    GUEST_LOYALTY_UPDATE: { label: 'تحديث ولاء النزيل', category: 'guests', severity: 'info' },
    
    // Inventory
    INVENTORY_ADD: { label: 'إضافة للمخزون', category: 'inventory', severity: 'info' },
    INVENTORY_REMOVE: { label: 'سحب من المخزون', category: 'inventory', severity: 'info' },
    INVENTORY_TRANSFER: { label: 'تحويل مخزون', category: 'inventory', severity: 'info' },
    INVENTORY_AUDIT: { label: 'جرد المخزون', category: 'inventory', severity: 'info' },
    PROCUREMENT_REQUEST: { label: 'طلب شراء', category: 'inventory', severity: 'info' },
    PROCUREMENT_APPROVE: { label: 'موافقة على شراء', category: 'inventory', severity: 'success' },
    PROCUREMENT_REJECT: { label: 'رفض شراء', category: 'inventory', severity: 'warning' },
    PROCUREMENT_RECEIVE: { label: 'استلام مشتريات', category: 'inventory', severity: 'success' },
    
    // Financial
    PAYMENT_RECEIVE: { label: 'استلام دفعة', category: 'financial', severity: 'success' },
    PAYMENT_REFUND: { label: 'استرجاع دفعة', category: 'financial', severity: 'warning' },
    INVOICE_CREATE: { label: 'إنشاء فاتورة', category: 'financial', severity: 'info' },
    INVOICE_VOID: { label: 'إلغاء فاتورة', category: 'financial', severity: 'warning' },
    CHARGE_ADD: { label: 'إضافة رسوم', category: 'financial', severity: 'info' },
    CHARGE_REMOVE: { label: 'حذف رسوم', category: 'financial', severity: 'warning' },
    SUBSCRIPTION_RENEW: { label: 'تجديد اشتراك', category: 'financial', severity: 'success' },
    SUBSCRIPTION_EXPIRE: { label: 'انتهاء اشتراك', category: 'financial', severity: 'warning' },
    
    // System
    SETTINGS_CHANGE: { label: 'تغيير إعدادات', category: 'system', severity: 'info' },
    BACKUP_CREATE: { label: 'إنشاء نسخة احتياطية', category: 'system', severity: 'info' },
    BACKUP_RESTORE: { label: 'استعادة نسخة احتياطية', category: 'system', severity: 'warning' },
    MAINTENANCE_ON: { label: 'تفعيل وضع الصيانة', category: 'system', severity: 'warning' },
    MAINTENANCE_OFF: { label: 'إلغاء وضع الصيانة', category: 'system', severity: 'success' },
    BROADCAST_SEND: { label: 'إرسال إشعار عام', category: 'system', severity: 'info' },
    UPDATE_DEPLOY: { label: 'نشر تحديث', category: 'system', severity: 'info' },
    DATA_EXPORT: { label: 'تصدير بيانات', category: 'system', severity: 'info' },
    
    // Security
    SUSPICIOUS_ACTIVITY: { label: 'نشاط مشبوه', category: 'security', severity: 'critical' },
    DEVICE_BLOCKED: { label: 'حظر جهاز', category: 'security', severity: 'warning' },
    ROOM_BLOCKED: { label: 'حظر غرفة', category: 'security', severity: 'warning' },
    ACCESS_DENIED: { label: 'رفض وصول', category: 'security', severity: 'warning' },
    AUDIT_VIEW: { label: 'عرض سجل التدقيق', category: 'security', severity: 'info' },
    PERMISSION_CHANGE: { label: 'تغيير صلاحيات', category: 'security', severity: 'warning' },
};

// ============================================================
// LOGGING FUNCTIONS
// ============================================================

/**
 * Log an action
 */
export const logAction = async (
    action: LogAction,
    actor: { id: string; name: string; role: string; department: string },
    target: { type: string; id: string; name?: string },
    context: { tenantId: string; branchId: string; branchName?: string; roomNumber?: string },
    options?: {
        description?: string;
        metadata?: Record<string, any>;
        previousValue?: any;
        newValue?: any;
        duration?: number;
    }
): Promise<string | null> => {
    try {
        const config = ACTION_CONFIG[action];
        
        const logEntry: Omit<AdvancedLogEntry, 'id'> = {
            action,
            category: config.category,
            severity: config.severity,
            title: config.label,
            description: options?.description || config.label,
            
            actorId: actor.id,
            actorName: actor.name,
            actorRole: actor.role,
            actorDepartment: actor.department,
            
            targetType: target.type,
            targetId: target.id,
            targetName: target.name,
            
            tenantId: context.tenantId,
            branchId: context.branchId,
            branchName: context.branchName,
            roomNumber: context.roomNumber,
            
            timestamp: new Date(),
            duration: options?.duration,
            
            ipAddress: 'client',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
            
            metadata: options?.metadata,
            previousValue: options?.previousValue,
            newValue: options?.newValue,
        };
        
        // ✅ FIX: Use tenant-scoped collection
        const logsCollection = getLogsCollection(context.tenantId);
        const docRef = await addDoc(collection(db, logsCollection), {
            ...logEntry,
            timestamp: serverTimestamp(),
        });
        
        logger.info(`📝 Log: ${action} by ${actor.name}`, { target, context }, 'advancedLogService');
        
        return docRef.id;
    } catch (error) {
        logger.error('Failed to log action:', error, 'advancedLogService');
        return null;
    }
};

/**
 * Quick log from localStorage user
 */
export const quickLog = async (
    action: LogAction,
    targetType: string,
    targetId: string,
    options?: {
        targetName?: string;
        roomNumber?: string;
        description?: string;
        metadata?: Record<string, any>;
    }
): Promise<void> => {
    const storedUser = localStorage.getItem('adora_user');
    if (!storedUser) return;
    
    const user = JSON.parse(storedUser);
    
    await logAction(
        action,
        {
            id: user.id,
            name: user.name,
            role: user.role || 'staff',
            department: user.department || 'general',
        },
        {
            type: targetType,
            id: targetId,
            name: options?.targetName,
        },
        {
            tenantId: user.tenantId || '',
            branchId: user.branchId || user.branch || '',
            roomNumber: options?.roomNumber,
        },
        {
            description: options?.description,
            metadata: options?.metadata,
        }
    );
};

// ============================================================
// FETCHING LOGS
// ============================================================

/**
 * Get logs with advanced filtering
 */
export const getLogs = async (
    tenantId: string,
    branchId: string,
    filter: LogFilter = {}
): Promise<{ logs: AdvancedLogEntry[]; hasMore: boolean }> => {
    try {
        // ✅ FIX: Use tenant-scoped collection
        const logsCollection = getLogsCollection(tenantId);
        const logsRef = collection(db, logsCollection);
        let constraints: any[] = [
            where('tenantId', '==', tenantId),
        ];
        
        // Branch filter
        if (branchId && branchId !== 'all') {
            constraints.push(where('branchId', '==', branchId));
        }
        
        // Date range
        if (filter.startDate) {
            constraints.push(where('timestamp', '>=', Timestamp.fromDate(filter.startDate)));
        }
        if (filter.endDate) {
            constraints.push(where('timestamp', '<=', Timestamp.fromDate(filter.endDate)));
        }
        
        // Category filter
        if (filter.categories && filter.categories.length > 0 && !filter.categories.includes('all')) {
            if (filter.categories.length === 1) {
                constraints.push(where('category', '==', filter.categories[0]));
            }
            // Note: Firestore 'in' queries limited to 30 values
        }
        
        // Severity filter
        if (filter.severities && filter.severities.length > 0) {
            if (filter.severities.length <= 10) {
                constraints.push(where('severity', 'in', filter.severities));
            }
        }
        
        // Actor filter
        if (filter.actorId) {
            constraints.push(where('actorId', '==', filter.actorId));
        }
        if (filter.actorDepartment) {
            constraints.push(where('actorDepartment', '==', filter.actorDepartment));
        }
        
        // Target filter
        if (filter.targetType) {
            constraints.push(where('targetType', '==', filter.targetType));
        }
        if (filter.roomNumber) {
            constraints.push(where('roomNumber', '==', filter.roomNumber));
        }
        
        // Order and limit
        constraints.push(orderBy('timestamp', 'desc'));
        const limitCount = filter.limit || 100;
        constraints.push(limit(limitCount + 1)); // +1 to check if there are more
        
        // Pagination
        if (filter.startAfterDoc) {
            constraints.push(startAfter(filter.startAfterDoc));
        }
        
        const q = query(logsRef, ...constraints);
        const snapshot = await getDocs(q);
        
        let logs: AdvancedLogEntry[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as AdvancedLogEntry[];
        
        // Check if there are more results
        const hasMore = logs.length > limitCount;
        if (hasMore) {
            logs = logs.slice(0, limitCount);
        }
        
        // Apply text search filter (client-side)
        if (filter.searchText) {
            const searchLower = filter.searchText.toLowerCase();
            logs = logs.filter(log => 
                log.title.toLowerCase().includes(searchLower) ||
                log.description.toLowerCase().includes(searchLower) ||
                log.actorName.toLowerCase().includes(searchLower) ||
                (log.targetName && log.targetName.toLowerCase().includes(searchLower)) ||
                (log.roomNumber && log.roomNumber.includes(searchLower))
            );
        }
        
        // Apply action filter (client-side if multiple)
        if (filter.actions && filter.actions.length > 0) {
            logs = logs.filter(log => filter.actions!.includes(log.action));
        }
        
        return { logs, hasMore };
    } catch (error: any) {
        // ✅ Handle Firestore internal errors gracefully
        if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
            logger.warn('Firestore internal error in getLogs (likely cache issue)', error, 'advancedLogService');
        } else {
            logger.error('Error fetching logs:', error, 'advancedLogService');
        }
        return { logs: [], hasMore: false };
    }
};

/**
 * ✅ Subscribe to logs with real-time updates (onSnapshot)
 * Used by View Components for live updates without refresh
 */
export const subscribeToLogs = (
    tenantId: string,
    branchId: string,
    filter: LogFilter,
    callback: (logs: AdvancedLogEntry[]) => void
): Unsubscribe => {
    if (!db || !tenantId) {
        console.warn('subscribeToLogs: db or tenantId missing');
        callback([]);
        return () => {}; // Return empty unsubscribe function
    }

    try {
        // ✅ FIX: Use tenant-scoped collection
        const logsCollection = getLogsCollection(tenantId);
        const logsRef = collection(db, logsCollection);
        let constraints: any[] = [];
        
        // Branch filter
        if (branchId && branchId !== 'all') {
            constraints.push(where('branchId', '==', branchId));
        }
        
        // Date range
        if (filter.startDate) {
            constraints.push(where('timestamp', '>=', Timestamp.fromDate(filter.startDate)));
        }
        if (filter.endDate) {
            constraints.push(where('timestamp', '<=', Timestamp.fromDate(filter.endDate)));
        }
        
        // Category filter
        if (filter.categories && filter.categories.length > 0 && !filter.categories.includes('all')) {
            if (filter.categories.length === 1) {
                constraints.push(where('category', '==', filter.categories[0]));
            }
        }
        
        // Severity filter
        if (filter.severities && filter.severities.length > 0) {
            if (filter.severities.length <= 10) {
                constraints.push(where('severity', 'in', filter.severities));
            }
        }
        
        // Actor filter
        if (filter.actorDepartment) {
            constraints.push(where('actorDepartment', '==', filter.actorDepartment));
        }
        
        // Room filter
        if (filter.roomNumber) {
            constraints.push(where('roomNumber', '==', filter.roomNumber));
        }
        
        // Order and limit
        constraints.push(orderBy('timestamp', 'desc'));
        const limitCount = filter.limit || 100;
        constraints.push(limit(limitCount));
        
        const q = query(logsRef, ...constraints);
        
        return onSnapshot(q, (snapshot) => {
            let logs: AdvancedLogEntry[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date(),
            })) as AdvancedLogEntry[];
            
            // Apply text search filter (client-side)
            if (filter.searchText) {
                const searchLower = filter.searchText.toLowerCase();
                logs = logs.filter(log => 
                    log.title.toLowerCase().includes(searchLower) ||
                    log.description.toLowerCase().includes(searchLower) ||
                    log.actorName.toLowerCase().includes(searchLower) ||
                    (log.targetName && log.targetName.toLowerCase().includes(searchLower)) ||
                    (log.roomNumber && log.roomNumber.includes(searchLower))
                );
            }
            
            callback(logs);
        }, (error: any) => {
            // ✅ Handle Firestore internal errors gracefully
            if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
                logger.warn('Firestore internal error in subscribeToLogs (likely cache issue)', error, 'advancedLogService');
            } else {
                logger.error('Error in subscribeToLogs:', error, 'advancedLogService');
            }
            callback([]);
        });
    } catch (error) {
        logger.error('Error setting up subscribeToLogs:', error, 'advancedLogService');
        callback([]);
        return () => {}; // Return empty unsubscribe function
    }
};

/**
 * Get log statistics
 */
export const getLogStats = async (
    tenantId: string,
    branchId: string,
    startDate: Date,
    endDate: Date
): Promise<LogStats> => {
    try {
        const { logs } = await getLogs(tenantId, branchId, {
            startDate,
            endDate,
            limit: 1000, // Get more for accurate stats
        });
        
        const stats: LogStats = {
            total: logs.length,
            byCategory: {
                all: logs.length,
                authentication: 0,
                requests: 0,
                rooms: 0,
                employees: 0,
                guests: 0,
                inventory: 0,
                financial: 0,
                system: 0,
                security: 0,
            },
            bySeverity: {
                info: 0,
                success: 0,
                warning: 0,
                error: 0,
                critical: 0,
            },
            byHour: {},
            byDepartment: {},
            topActors: [],
            topActions: [],
        };
        
        const actorCounts: Record<string, { name: string; count: number }> = {};
        const actionCounts: Record<LogAction, number> = {} as any;
        
        logs.forEach(log => {
            // By category
            if (stats.byCategory[log.category] !== undefined) {
                stats.byCategory[log.category]++;
            }
            
            // By severity
            if (stats.bySeverity[log.severity] !== undefined) {
                stats.bySeverity[log.severity]++;
            }
            
            // By hour
            const hour = log.timestamp.getHours();
            stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
            
            // By department
            stats.byDepartment[log.actorDepartment] = (stats.byDepartment[log.actorDepartment] || 0) + 1;
            
            // Top actors
            if (!actorCounts[log.actorId]) {
                actorCounts[log.actorId] = { name: log.actorName, count: 0 };
            }
            actorCounts[log.actorId].count++;
            
            // Top actions
            actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
        });
        
        // Sort top actors
        stats.topActors = Object.entries(actorCounts)
            .map(([id, { name, count }]) => ({ id, name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        // Sort top actions
        stats.topActions = Object.entries(actionCounts)
            .map(([action, count]) => ({ action: action as LogAction, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        return stats;
    } catch (error) {
        logger.error('Error getting log stats:', error, 'advancedLogService');
        return {
            total: 0,
            byCategory: { all: 0, authentication: 0, requests: 0, rooms: 0, employees: 0, guests: 0, inventory: 0, financial: 0, system: 0, security: 0 },
            bySeverity: { info: 0, success: 0, warning: 0, error: 0, critical: 0 },
            byHour: {},
            byDepartment: {},
            topActors: [],
            topActions: [],
        };
    }
};

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

/**
 * Export logs to CSV format
 */
export const exportToCSV = (logs: AdvancedLogEntry[]): string => {
    const headers = [
        'التاريخ', 'الوقت', 'الفئة', 'العملية', 'الوصف',
        'المنفذ', 'القسم', 'الهدف', 'الغرفة', 'الأهمية'
    ];
    
    const rows = logs.map(log => [
        log.timestamp.toLocaleDateString('ar-SA'),
        log.timestamp.toLocaleTimeString('ar-SA'),
        CATEGORY_CONFIG[log.category].label,
        log.title,
        log.description,
        log.actorName,
        log.actorDepartment,
        log.targetName || log.targetId,
        log.roomNumber || '-',
        SEVERITY_CONFIG[log.severity].label,
    ]);
    
    // Add BOM for Arabic support in Excel
    const BOM = '\uFEFF';
    const csvContent = BOM + [headers, ...rows].map(row => row.join(',')).join('\n');
    
    return csvContent;
};

/**
 * Download CSV file
 */
export const downloadCSV = (logs: AdvancedLogEntry[], filename: string = 'سجل_العمليات'): void => {
    const csv = exportToCSV(logs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
};

/**
 * Generate print-ready HTML
 */
export const generatePrintHTML = (
    logs: AdvancedLogEntry[],
    title: string,
    hotelName: string,
    dateRange: string
): string => {
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, sans-serif; 
            font-size: 9pt;
            color: #000;
            line-height: 1.4;
        }
        .header { 
            text-align: center; 
            border-bottom: 2px solid #14b8a6; 
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .header h1 { font-size: 18pt; color: #14b8a6; margin-bottom: 5px; }
        .header h2 { font-size: 12pt; color: #333; margin-bottom: 5px; }
        .header p { font-size: 9pt; color: #666; }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
        }
        .stat-box {
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 8px;
            text-align: center;
        }
        .stat-value { font-size: 18pt; font-weight: bold; color: #14b8a6; }
        .stat-label { font-size: 8pt; color: #666; }
        
        table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 8pt;
            margin-bottom: 20px;
        }
        th { 
            background: #14b8a6; 
            color: white;
            font-weight: bold;
            padding: 8px 4px;
            text-align: right;
        }
        td { 
            border-bottom: 1px solid #eee; 
            padding: 6px 4px;
            vertical-align: top;
        }
        tr:nth-child(even) { background: #f9f9f9; }
        
        .severity-info { color: #3b82f6; }
        .severity-success { color: #22c55e; }
        .severity-warning { color: #f59e0b; }
        .severity-error { color: #ef4444; }
        .severity-critical { color: #dc2626; font-weight: bold; }
        
        .category-tag {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 7pt;
            background: #f0f0f0;
        }
        
        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
            color: #666;
        }
        
        @media print {
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${hotelName}</h1>
        <h2>سجل العمليات التفصيلي</h2>
        <p>${dateRange}</p>
        <p>تم الإنشاء: ${new Date().toLocaleString('ar-SA')}</p>
    </div>
    
    <div class="stats-grid">
        <div class="stat-box">
            <div class="stat-value">${logs.length}</div>
            <div class="stat-label">إجمالي العمليات</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${logs.filter(l => l.severity === 'success').length}</div>
            <div class="stat-label">ناجحة</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${logs.filter(l => l.severity === 'warning').length}</div>
            <div class="stat-label">تحذيرات</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${logs.filter(l => l.severity === 'error' || l.severity === 'critical').length}</div>
            <div class="stat-label">أخطاء</div>
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th style="width: 70px">الوقت</th>
                <th style="width: 80px">الفئة</th>
                <th>العملية</th>
                <th style="width: 80px">المنفذ</th>
                <th style="width: 50px">الغرفة</th>
                <th style="width: 50px">الحالة</th>
            </tr>
        </thead>
        <tbody>
            ${logs.map(log => `
                <tr>
                    <td>
                        <div>${log.timestamp.toLocaleDateString('ar-SA', { day: '2-digit', month: '2-digit' })}</div>
                        <div style="color: #666; font-size: 7pt;">${log.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td>
                        <span class="category-tag">${CATEGORY_CONFIG[log.category].icon} ${CATEGORY_CONFIG[log.category].label}</span>
                    </td>
                    <td>
                        <div style="font-weight: 500;">${log.title}</div>
                        <div style="color: #666; font-size: 7pt;">${log.description}</div>
                    </td>
                    <td>
                        <div>${log.actorName}</div>
                        <div style="color: #666; font-size: 7pt;">${log.actorDepartment}</div>
                    </td>
                    <td>${log.roomNumber || '-'}</td>
                    <td class="severity-${log.severity}">
                        ${SEVERITY_CONFIG[log.severity].icon}
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div class="footer">
        <div>نظام أدورا لإدارة الفنادق</div>
        <div>صفحة 1 من 1</div>
        <div>سري وخاص</div>
    </div>
</body>
</html>
    `;
};

/**
 * Print logs
 */
export const printLogs = (
    logs: AdvancedLogEntry[],
    hotelName: string,
    dateRange: string
): void => {
    const html = generatePrintHTML(logs, 'سجل العمليات', hotelName, dateRange);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        
        printWindow.onafterprint = () => printWindow.close();
        
        setTimeout(() => printWindow.print(), 500);
    }
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Format duration in Arabic
 */
export const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds} ثانية`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} دقيقة`;
    return `${Math.floor(seconds / 3600)} ساعة`;
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
    
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export default {
    logAction,
    quickLog,
    getLogs,
    getLogStats,
    exportToCSV,
    downloadCSV,
    printLogs,
    CATEGORY_CONFIG,
    SEVERITY_CONFIG,
    ACTION_CONFIG,
    formatDuration,
    formatTimeAgo,
};
