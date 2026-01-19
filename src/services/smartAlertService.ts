/**
 * Smart Alert Service 🚨
 * Intelligent alerting system with escalation
 * Adora Hotel Management System V3 - SaaS
 */

import { db } from './firebase';
import {
    collection, doc, setDoc, updateDoc, query,
    where, getDocs, getDoc, onSnapshot, Timestamp, serverTimestamp
} from 'firebase/firestore';
import { logger } from './loggerService';
import type { Staff } from './staffService'; // ✅ Type-only import for Staff['role']

// ============================================================
// TYPES
// ============================================================

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';
export type AlertType = 
    | 'delayed_request'      // طلب متأخر
    | 'low_staff'            // نقص موظفين
    | 'high_workload'        // ضغط عمل
    | 'guest_complaint'      // شكوى نزيل
    | 'vip_arrival'          // وصول VIP
    | 'inventory_critical'   // نقص مخزون حرج
    | 'payment_overdue'      // تأخر دفع
    | 'system_issue'         // مشكلة نظام
    | 'security_breach'      // اختراق أمني
    | 'room_overbooking'     // حجز زائد
    | 'emergency';           // طوارئ

export interface SmartAlert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    department?: string;
    roomNumber?: string;
    data?: any;
    
    // Escalation
    escalationLevel: number;
    escalatedTo?: string[];
    autoEscalateAt?: Timestamp;
    
    // Status
    status: 'active' | 'acknowledged' | 'resolved' | 'escalated';
    acknowledgedBy?: string;
    acknowledgedAt?: Timestamp;
    resolvedBy?: string;
    resolvedAt?: Timestamp;
    
    // Timestamps
    createdAt: Timestamp;
    updatedAt: Timestamp;
    tenantId: string;
    branchId: string;
}

export interface EscalationRule {
    alertType: AlertType;
    levels: {
        level: number;
        delayMinutes: number;
        notifyRoles: string[];
        notifyMethod: ('push' | 'sms' | 'call' | 'email')[];
    }[];
}

// ============================================================
// ESCALATION RULES
// ============================================================

const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
    {
        alertType: 'delayed_request',
        levels: [
            { level: 1, delayMinutes: 15, notifyRoles: ['employee'], notifyMethod: ['push'] },
            { level: 2, delayMinutes: 30, notifyRoles: ['supervisor'], notifyMethod: ['push', 'sms'] },
            { level: 3, delayMinutes: 60, notifyRoles: ['manager'], notifyMethod: ['push', 'sms', 'call'] },
        ],
    },
    {
        alertType: 'guest_complaint',
        levels: [
            { level: 1, delayMinutes: 5, notifyRoles: ['reception'], notifyMethod: ['push'] },
            { level: 2, delayMinutes: 15, notifyRoles: ['supervisor', 'manager'], notifyMethod: ['push', 'sms'] },
            { level: 3, delayMinutes: 30, notifyRoles: ['manager', 'owner'], notifyMethod: ['push', 'sms', 'call'] },
        ],
    },
    {
        alertType: 'emergency',
        levels: [
            { level: 1, delayMinutes: 0, notifyRoles: ['all'], notifyMethod: ['push', 'sms', 'call'] },
        ],
    },
    {
        alertType: 'vip_arrival',
        levels: [
            { level: 1, delayMinutes: 0, notifyRoles: ['reception', 'bellman', 'manager'], notifyMethod: ['push'] },
        ],
    },
    {
        alertType: 'inventory_critical',
        levels: [
            { level: 1, delayMinutes: 0, notifyRoles: ['procurement'], notifyMethod: ['push'] },
            { level: 2, delayMinutes: 60, notifyRoles: ['manager'], notifyMethod: ['push', 'sms'] },
        ],
    },
];

// ============================================================
// ALERT CREATION
// ============================================================

/**
 * Create a new smart alert
 */
export async function createAlert(
    tenantId: string,
    branchId: string,
    type: AlertType,
    title: string,
    message: string,
    options?: {
        severity?: AlertSeverity;
        department?: string;
        roomNumber?: string;
        data?: any;
    }
): Promise<string> {
    try {
        const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const severity = options?.severity || determineSeverity(type);
        
        const alert: SmartAlert = {
            id: alertId,
            type,
            severity,
            title,
            message,
            department: options?.department,
            roomNumber: options?.roomNumber,
            data: options?.data,
            escalationLevel: 1,
            status: 'active',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            tenantId,
            branchId,
        };
        
        // Calculate auto-escalation time
        const rule = DEFAULT_ESCALATION_RULES.find(r => r.alertType === type);
        if (rule && rule.levels.length > 1) {
            const nextLevel = rule.levels[1];
            const escalateTime = new Date();
            escalateTime.setMinutes(escalateTime.getMinutes() + nextLevel.delayMinutes);
            alert.autoEscalateAt = Timestamp.fromDate(escalateTime);
        }
        
        await setDoc(doc(db, `tenants/${tenantId}/alerts`, alertId), alert);
        
        // Trigger initial notifications
        await triggerNotifications(tenantId, alert, 1);
        
        logger.info(`Alert created: ${type}`, { alertId, severity }, 'smartAlertService');
        
        return alertId;
    } catch (error) {
        logger.error('Error creating alert:', error, 'smartAlertService');
        throw error;
    }
}

/**
 * Determine severity based on alert type
 */
function determineSeverity(type: AlertType): AlertSeverity {
    const severityMap: Record<AlertType, AlertSeverity> = {
        'info': 'info',
        'delayed_request': 'warning',
        'low_staff': 'warning',
        'high_workload': 'warning',
        'guest_complaint': 'critical',
        'vip_arrival': 'info',
        'inventory_critical': 'critical',
        'payment_overdue': 'warning',
        'system_issue': 'critical',
        'security_breach': 'emergency',
        'room_overbooking': 'critical',
        'emergency': 'emergency',
    };
    return severityMap[type] || 'warning';
}

// ============================================================
// ALERT MANAGEMENT
// ============================================================

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
    tenantId: string,
    alertId: string,
    userId: string,
    userName: string
): Promise<void> {
    try {
        await updateDoc(doc(db, `tenants/${tenantId}/alerts`, alertId), {
            status: 'acknowledged',
            acknowledgedBy: userName,
            acknowledgedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        
        logger.info(`Alert acknowledged: ${alertId}`, { userId }, 'smartAlertService');
    } catch (error) {
        logger.error('Error acknowledging alert:', error, 'smartAlertService');
        throw error;
    }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(
    tenantId: string,
    alertId: string,
    userId: string,
    userName: string,
    resolution?: string
): Promise<void> {
    try {
        await updateDoc(doc(db, `tenants/${tenantId}/alerts`, alertId), {
            status: 'resolved',
            resolvedBy: userName,
            resolvedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            resolution,
        });
        
        logger.info(`Alert resolved: ${alertId}`, { userId, resolution }, 'smartAlertService');
    } catch (error) {
        logger.error('Error resolving alert:', error, 'smartAlertService');
        throw error;
    }
}

/**
 * Escalate an alert
 */
export async function escalateAlert(
    tenantId: string,
    alertId: string,
    reason?: string
): Promise<void> {
    try {
        const alertRef = doc(db, `tenants/${tenantId}/alerts`, alertId);
        const alertSnap = await getDocs(query(
            collection(db, `tenants/${tenantId}/alerts`),
            where('id', '==', alertId)
        ));
        
        if (alertSnap.empty) return;
        
        const alert = alertSnap.docs[0].data() as SmartAlert;
        const newLevel = alert.escalationLevel + 1;
        
        const rule = DEFAULT_ESCALATION_RULES.find(r => r.alertType === alert.type);
        if (!rule || newLevel > rule.levels.length) return;
        
        await updateDoc(alertRef, {
            status: 'escalated',
            escalationLevel: newLevel,
            updatedAt: serverTimestamp(),
        });
        
        await triggerNotifications(tenantId, alert, newLevel);
        
        logger.warn(`Alert escalated: ${alertId} to level ${newLevel}`, { reason }, 'smartAlertService');
    } catch (error) {
        logger.error('Error escalating alert:', error, 'smartAlertService');
        throw error;
    }
}

// ============================================================
// NOTIFICATIONS
// ============================================================

/**
 * Trigger notifications based on escalation level
 * ✅ INTEGRATED: Uses pushNotificationService and notificationService
 */
async function triggerNotifications(
    tenantId: string,
    alert: SmartAlert,
    level: number
): Promise<void> {
    const rule = DEFAULT_ESCALATION_RULES.find(r => r.alertType === alert.type);
    if (!rule) return;
    
    const levelConfig = rule.levels.find(l => l.level === level);
    if (!levelConfig) return;
    
    try {
        // ✅ INTEGRATED: Send notifications based on roles and methods
        const notificationPromises: Promise<void>[] = [];

        for (const role of levelConfig.notifyRoles) {
            // Skip 'all' role for now (would need special handling)
            if (role === 'all') {
                logger.info('Skipping "all" role notification (not implemented)', undefined, 'smartAlertService');
                continue;
            }

            // ✅ Map role to department if it's a department role
            const departmentMap: Record<string, string> = {
                'reception': 'reception',
                'housekeeping': 'housekeeping',
                'maintenance': 'maintenance',
                'bellman': 'bellman',
                'procurement': 'procurement',
                'coffeeShop': 'coffeeShop',
                'employee': alert.department || 'reception', // Use alert department if role is generic 'employee'
                'supervisor': alert.department || 'reception',
                'manager': 'admin', // Managers use admin department
            };

            const department = departmentMap[role];
            
            // ✅ Type-safe department validation
            type ValidDepartment = 'housekeeping' | 'bellman' | 'maintenance' | 'reception' | 'procurement' | 'coffeeShop';
            const validDepartments: ValidDepartment[] = ['housekeeping', 'bellman', 'maintenance', 'reception', 'procurement', 'coffeeShop'];
            
            if (department && validDepartments.includes(department as ValidDepartment) && alert.branchId) {
                const typedDepartment = department as ValidDepartment;
                
                // ✅ Send to department using notificationService
                if (levelConfig.notifyMethod.includes('push')) {
                    try {
                        const { sendNotificationToDepartment } = await import('./notificationService');
                        notificationPromises.push(
                            sendNotificationToDepartment(
                                typedDepartment,
                                alert.title,
                                alert.message,
                                tenantId,
                                alert.branchId,
                                alert.severity === 'critical' || alert.severity === 'emergency' ? 'error' : 'warning',
                                alert.id
                            )
                        );
                    } catch (error) {
                        logger.warn('Failed to send department notification', error, 'smartAlertService');
                    }
                }

                // ✅ Send Push Notifications to FCM tokens if available
                if (levelConfig.notifyMethod.includes('push')) {
                    try {
                        // Get employees in department
                        // ✅ Map department to Staff role type
                        const departmentToRoleMap: Record<ValidDepartment, Staff['role']> = {
                            'housekeeping': 'housekeeping',
                            'bellman': 'bellman',
                            'maintenance': 'maintenance',
                            'reception': 'reception',
                            'procurement': 'staff', // Procurement uses 'staff' role
                            'coffeeShop': 'staff' // CoffeeShop uses 'staff' role
                        };
                        const staffRole = departmentToRoleMap[typedDepartment];
                        
                        const { getStaffByRole } = await import('./staffService');
                        const staffMembers = await getStaffByRole(tenantId, alert.branchId, staffRole);

                        // Get FCM tokens for staff members
                        const { sendPushNotification } = await import('./pushNotificationService');
                        for (const staff of staffMembers) {
                            try {
                                // Get FCM token from fcm_tokens collection
                                const tokenDoc = await getDoc(doc(db, 'fcm_tokens', staff.id));
                                if (tokenDoc.exists()) {
                                    const tokenData = tokenDoc.data();
                                    const fcmToken = tokenData.token;
                                    
                                    if (fcmToken) {
                                        notificationPromises.push(
                                            sendPushNotification(fcmToken, {
                                                title: alert.title,
                                                body: alert.message,
                                                icon: '/icon-192x192.png',
                                                click_action: `/admin/alerts/${alert.id}`,
                                                data: {
                                                    alertId: alert.id,
                                                    type: alert.type,
                                                    severity: alert.severity,
                                                    roomNumber: alert.roomNumber || ''
                                                }
                                            })
                                        );
                                    }
                                }
                            } catch (tokenError) {
                                logger.warn(`Failed to send push notification to staff ${staff.id}`, tokenError, 'smartAlertService');
                            }
                        }
                    } catch (pushError) {
                        logger.warn('Failed to send push notifications', pushError, 'smartAlertService');
                    }
                }
            }
        }

        // ✅ Execute all notifications in parallel
        await Promise.allSettled(notificationPromises);

        logger.info('Notifications triggered', {
            alertId: alert.id,
            level,
            roles: levelConfig.notifyRoles,
            methods: levelConfig.notifyMethod,
            sent: notificationPromises.length
        }, 'smartAlertService');
    } catch (error) {
        logger.error('Error triggering notifications', error, 'smartAlertService');
        // Don't throw - notification failure shouldn't break alert creation
    }
}

// ============================================================
// QUERIES
// ============================================================

/**
 * Get active alerts
 */
export async function getActiveAlerts(
    tenantId: string,
    branchId?: string,
    department?: string
): Promise<SmartAlert[]> {
    try {
        let q = query(
            collection(db, `tenants/${tenantId}/alerts`),
            where('status', 'in', ['active', 'escalated'])
        );
        
        const snapshot = await getDocs(q);
        let alerts = snapshot.docs.map(d => d.data() as SmartAlert);
        
        if (branchId) {
            alerts = alerts.filter(a => a.branchId === branchId);
        }
        
        if (department) {
            alerts = alerts.filter(a => !a.department || a.department === department);
        }
        
        return alerts.sort((a, b) => {
            const severityOrder = { emergency: 0, critical: 1, warning: 2, info: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    } catch (error) {
        logger.error('Error getting active alerts:', error, 'smartAlertService');
        return [];
    }
}

/**
 * Subscribe to alerts (real-time)
 */
export function subscribeToAlerts(
    tenantId: string,
    branchId: string,
    callback: (alerts: SmartAlert[]) => void
): () => void {
    const q = query(
        collection(db, `tenants/${tenantId}/alerts`),
        where('branchId', '==', branchId),
        where('status', 'in', ['active', 'escalated'])
    );
    
    return onSnapshot(q, (snapshot) => {
        const alerts = snapshot.docs.map(d => d.data() as SmartAlert);
        callback(alerts.sort((a, b) => {
            const severityOrder = { emergency: 0, critical: 1, warning: 2, info: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        }));
    });
}

// ============================================================
// AUTO-ESCALATION CHECKER
// ============================================================

/**
 * Check and escalate overdue alerts
 * Should be called periodically (e.g., every minute)
 */
export async function checkAndEscalateOverdueAlerts(tenantId: string): Promise<number> {
    try {
        const now = Timestamp.now();
        const alertsRef = collection(db, `tenants/${tenantId}/alerts`);
        const q = query(
            alertsRef,
            where('status', '==', 'active'),
            where('autoEscalateAt', '<=', now)
        );
        
        const snapshot = await getDocs(q);
        let escalatedCount = 0;
        
        for (const doc of snapshot.docs) {
            await escalateAlert(tenantId, doc.id, 'Auto-escalation due to timeout');
            escalatedCount++;
        }
        
        if (escalatedCount > 0) {
            logger.info(`Auto-escalated ${escalatedCount} alerts`, null, 'smartAlertService');
        }
        
        return escalatedCount;
    } catch (error) {
        logger.error('Error in auto-escalation:', error, 'smartAlertService');
        return 0;
    }
}

export default {
    createAlert,
    acknowledgeAlert,
    resolveAlert,
    escalateAlert,
    getActiveAlerts,
    subscribeToAlerts,
    checkAndEscalateOverdueAlerts,
};
