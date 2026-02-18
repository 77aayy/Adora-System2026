/**
 * 🚨 Security Alert Service
 * Adora Hotel Management System
 * 
 * Sends real-time alerts to reception when suspicious access attempts occur
 */

import { db } from './firebase';
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    limit,
    onSnapshot,
    Timestamp,
    getDocs,
    updateDoc,
    doc
} from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertType = 
    | 'invalid_token'
    | 'expired_token'
    | 'device_limit_exceeded'
    | 'suspicious_ip'
    | 'rate_limit_exceeded'
    | 'no_active_checkin'
    | 'token_manipulation'
    | 'unauthorized_room_access'
    | 'brute_force_attempt'
    | 'geo_location_mismatch';

export interface SecurityAlert {
    id?: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    details: {
        roomNumber?: string;
        branchId?: string;
        tenantId: string;
        token?: string;
        ipAddress?: string;
        userAgent?: string;
        deviceFingerprint?: string;
        attemptCount?: number;
        location?: {
            latitude?: number;
            longitude?: number;
            country?: string;
            city?: string;
        };
    };
    timestamp: Date;
    isRead: boolean;
    readBy?: string;
    readAt?: Date;
    actionTaken?: string;
}

// ============================================================
// ALERT TEMPLATES
// ============================================================

const ALERT_TEMPLATES: Record<AlertType, { title: string; severity: AlertSeverity; icon: string }> = {
    'invalid_token': {
        title: '🔴 محاولة وصول برابط غير صالح',
        severity: 'high',
        icon: '🚫'
    },
    'expired_token': {
        title: '⏰ محاولة وصول برابط منتهي',
        severity: 'medium',
        icon: '⏳'
    },
    'device_limit_exceeded': {
        title: '📱 تجاوز الحد الأقصى للأجهزة',
        severity: 'high',
        icon: '📵'
    },
    'suspicious_ip': {
        title: '🌐 عنوان IP مشبوه',
        severity: 'high',
        icon: '🔍'
    },
    'rate_limit_exceeded': {
        title: '⚡ محاولات متكررة مشبوهة',
        severity: 'critical',
        icon: '⚠️'
    },
    'no_active_checkin': {
        title: '🏨 غرفة غير مسجلة دخول',
        severity: 'medium',
        icon: '🚪'
    },
    'token_manipulation': {
        title: '🔐 محاولة تلاعب بالرابط',
        severity: 'critical',
        icon: '🛡️'
    },
    'unauthorized_room_access': {
        title: '🚨 محاولة وصول غير مصرح',
        severity: 'critical',
        icon: '🚷'
    },
    'brute_force_attempt': {
        title: '💥 هجوم Brute Force',
        severity: 'critical',
        icon: '💣'
    },
    'geo_location_mismatch': {
        title: '📍 موقع جغرافي غير متطابق',
        severity: 'high',
        icon: '🗺️'
    }
};

// ============================================================
// SEND SECURITY ALERT
// ============================================================

/**
 * Send a security alert to reception
 */
export const sendSecurityAlert = async (
    type: AlertType,
    tenantId: string,
    details: Partial<SecurityAlert['details']>,
    customMessage?: string
): Promise<string | null> => {
    if (!db) {
        logger.error('Firebase not initialized', undefined, 'securityAlertService');
        return null;
    }

    try {
        const template = ALERT_TEMPLATES[type];
        
        const alert: Omit<SecurityAlert, 'id'> = {
            type,
            severity: template.severity,
            title: template.title,
            message: customMessage || generateAlertMessage(type, details),
            details: {
                tenantId,
                ...details
            },
            timestamp: new Date(),
            isRead: false
        };

        const alertsRef = collection(db, `tenants/${tenantId}/securityAlerts`);
        const docRef = await addDoc(alertsRef, {
            ...alert,
            timestamp: Timestamp.fromDate(alert.timestamp)
        });

        logger.info(`🚨 Security Alert Sent: ${type} for tenant ${tenantId}`, undefined, 'securityAlertService');
        
        // Also trigger browser notification if supported
        triggerBrowserNotification(template.title, alert.message, template.severity);
        
        return docRef.id;
    } catch (error) {
        logger.error('Error sending security alert:', error, 'securityAlertService');
        return null;
    }
};

/**
 * Generate alert message based on type and details
 */
const generateAlertMessage = (type: AlertType, details: Partial<SecurityAlert['details']>): string => {
    const room = details.roomNumber ? `الغرفة ${details.roomNumber}` : 'غرفة غير محددة';
    
    switch (type) {
        case 'invalid_token':
            return `محاولة وصول لـ ${room} باستخدام رابط QR غير صالح أو مزور.`;
        
        case 'expired_token':
            return `محاولة استخدام رابط QR منتهي الصلاحية لـ ${room}.`;
        
        case 'device_limit_exceeded':
            return `تم تجاوز الحد الأقصى للأجهزة المسموح بها (3) لـ ${room}. قد يكون هناك محاولة مشاركة غير مصرح بها للرابط.`;
        
        case 'suspicious_ip':
            return `تم رصد محاولة وصول من عنوان IP مشبوه (${details.ipAddress || 'غير معروف'}) لـ ${room}.`;
        
        case 'rate_limit_exceeded':
            return `تم رصد ${details.attemptCount || 'عدد كبير من'} محاولات متكررة للوصول لـ ${room} في فترة قصيرة.`;
        
        case 'no_active_checkin':
            return `محاولة وصول لـ ${room} وهي غير مسجلة دخول حالياً.`;
        
        case 'token_manipulation':
            return `تم رصد محاولة تلاعب في رابط QR لـ ${room}. قد يكون هجوم أمني.`;
        
        case 'unauthorized_room_access':
            return `محاولة وصول غير مصرح بها لـ ${room}. يرجى التحقق من هوية الضيف.`;
        
        case 'brute_force_attempt':
            return `🚨 تم رصد هجوم Brute Force على نظام QR. تم حظر المصدر مؤقتاً.`;
        
        case 'geo_location_mismatch':
            return `موقع الجهاز (${details.location?.city || 'غير معروف'}) لا يتطابق مع موقع الفندق.`;
        
        default:
            return `حدث تنبيه أمني لـ ${room}.`;
    }
};

/**
 * Trigger browser notification (for reception staff)
 */
const triggerBrowserNotification = (title: string, message: string, severity: AlertSeverity) => {
    // Check if notifications are supported and permitted
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: severity === 'critical' ? '/alert-critical.png' : '/alert.png',
            tag: 'security-alert',
            requireInteraction: severity === 'critical' // Critical alerts stay until dismissed
        });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, {
                    body: message,
                    icon: '/alert.png',
                    tag: 'security-alert'
                });
            }
        });
    }
};

// ============================================================
// LISTEN TO ALERTS (Real-time)
// ============================================================

/**
 * Subscribe to security alerts for a tenant
 * Used by reception dashboard
 */
export const subscribeToSecurityAlerts = (
    tenantId: string,
    branchId: string | null,
    onAlert: (alerts: SecurityAlert[]) => void,
    options: {
        unreadOnly?: boolean;
        severityFilter?: AlertSeverity[];
        limit?: number;
    } = {}
): (() => void) => {
    if (!db) {
        logger.error('Firebase not initialized', undefined, 'securityAlertService');
        return () => {};
    }

    const { unreadOnly = false, severityFilter = [], limit: limitCount = 50 } = options;

    let q = query(
        collection(db, `tenants/${tenantId}/securityAlerts`),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
    );

    // Note: Complex filters would need composite indexes in Firebase
    // For now, we filter client-side

    const unsubscribe = onSnapshot(q, (snapshot) => {
        let alerts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || new Date()
        })) as SecurityAlert[];

        // Client-side filters
        if (unreadOnly) {
            alerts = alerts.filter(a => !a.isRead);
        }
        
        if (severityFilter.length > 0) {
            alerts = alerts.filter(a => severityFilter.includes(a.severity));
        }

        if (branchId) {
            alerts = alerts.filter(a => !a.details.branchId || a.details.branchId === branchId);
        }

        onAlert(alerts);
    }, (error) => {
        logger.error('Error subscribing to security alerts:', error, 'securityAlertService');
    });

    return unsubscribe;
};

// ============================================================
// MARK ALERT AS READ
// ============================================================

/**
 * Mark an alert as read
 */
export const markAlertAsRead = async (
    tenantId: string,
    alertId: string,
    readBy: string,
    actionTaken?: string
): Promise<boolean> => {
    if (!db) return false;

    try {
        const alertRef = doc(db, `tenants/${tenantId}/securityAlerts`, alertId);
        await updateDoc(alertRef, {
            isRead: true,
            readBy,
            readAt: Timestamp.fromDate(new Date()),
            ...(actionTaken && { actionTaken })
        });
        return true;
    } catch (error) {
        logger.error('Error marking alert as read:', error, 'securityAlertService');
        return false;
    }
};

// ============================================================
// GET UNREAD COUNT
// ============================================================

/**
 * Get count of unread alerts
 */
export const getUnreadAlertCount = async (
    tenantId: string,
    branchId?: string
): Promise<number> => {
    if (!db) return 0;

    try {
        const alertsRef = collection(db, `tenants/${tenantId}/securityAlerts`);
        const q = query(
            alertsRef,
            where('isRead', '==', false),
            orderBy('timestamp', 'desc'),
            limit(100)
        );

        const snapshot = await getDocs(q);
        
        if (branchId) {
            return snapshot.docs.filter(doc => 
                !doc.data().details?.branchId || doc.data().details?.branchId === branchId
            ).length;
        }

        return snapshot.size;
    } catch (error) {
        logger.error('Error getting unread alert count:', error, 'securityAlertService');
        return 0;
    }
};

// ============================================================
// EXPORT TYPES
// ============================================================

export type { SecurityAlert };
