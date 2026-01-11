/**
 * Critical Delay Alert Service
 * خدمة تنبيهات التأخير الحرجة
 * 
 * ✅ Features:
 * - Monitor overdue tasks (housekeeping, maintenance)
 * - Send push notifications to managers
 * - Track alert history
 * - Configurable delay thresholds
 * 
 * Adora Hotel Management System V3
 */

import { 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    Timestamp,
    onSnapshot,
    orderBy,
    limit
} from 'firebase/firestore';
import { db } from './firebase';
import { sendPushNotification } from './pushNotificationService';

// ============================================================
// TYPES
// ============================================================

export interface OverdueTask {
    id: string;
    type: 'housekeeping' | 'maintenance' | 'coffeeshop' | 'bellman';
    roomNumber: string;
    assignedTo?: string;
    assignedToName?: string;
    startedAt: Date;
    delayMinutes: number;
    status: string;
    tenantId: string;
    branchId?: string;
}

export interface DelayAlert {
    id?: string;
    taskId: string;
    taskType: string;
    roomNumber: string;
    delayMinutes: number;
    alertedAt: Date;
    managerId?: string;
    acknowledged: boolean;
    tenantId: string;
}

export interface DelayThresholds {
    housekeeping: number; // minutes
    maintenance: number;
    coffeeshop: number;
    bellman: number;
    criticalMultiplier: number; // multiply base threshold for "critical" alerts
}

// ============================================================
// DEFAULT THRESHOLDS
// ============================================================

const DEFAULT_THRESHOLDS: DelayThresholds = {
    housekeeping: 45, // 45 minutes
    maintenance: 60,  // 60 minutes
    coffeeshop: 15,   // 15 minutes
    bellman: 10,      // 10 minutes
    criticalMultiplier: 1.5 // 1.5x for critical
};

// ============================================================
// ALERT CHECKING
// ============================================================

/**
 * Check for overdue tasks and return list of tasks exceeding threshold
 */
export const checkOverdueTasks = async (
    tenantId: string,
    thresholds: Partial<DelayThresholds> = {}
): Promise<OverdueTask[]> => {
    if (!db) {
        console.warn('Firebase not initialized');
        return [];
    }

    const effectiveThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    const overdueTasks: OverdueTask[] = [];
    const now = new Date();

    try {
        // Check housekeeping tasks
        const housekeepingRef = collection(db, `tenants/${tenantId}/requests`);
        const housekeepingQuery = query(
            housekeepingRef,
            where('type', '==', 'housekeeping'),
            where('status', 'in', ['pending', 'in_progress']),
            orderBy('createdAt', 'asc'),
            limit(100)
        );

        const housekeepingSnap = await getDocs(housekeepingQuery);
        housekeepingSnap.forEach(doc => {
            const data = doc.data();
            const startTime = data.createdAt?.toDate?.() || new Date();
            const delayMinutes = Math.floor((now.getTime() - startTime.getTime()) / 60000);
            
            if (delayMinutes >= effectiveThresholds.housekeeping) {
                overdueTasks.push({
                    id: doc.id,
                    type: 'housekeeping',
                    roomNumber: data.roomNumber || 'غير محدد',
                    assignedTo: data.assignedTo,
                    assignedToName: data.assignedToName,
                    startedAt: startTime,
                    delayMinutes,
                    status: data.status,
                    tenantId,
                    branchId: data.branchId
                });
            }
        });

        // Check maintenance tasks
        const maintenanceRef = collection(db, `tenants/${tenantId}/maintenance`);
        const maintenanceQuery = query(
            maintenanceRef,
            where('status', 'in', ['pending', 'in_progress']),
            orderBy('createdAt', 'asc'),
            limit(100)
        );

        const maintenanceSnap = await getDocs(maintenanceQuery);
        maintenanceSnap.forEach(doc => {
            const data = doc.data();
            const startTime = data.createdAt?.toDate?.() || new Date();
            const delayMinutes = Math.floor((now.getTime() - startTime.getTime()) / 60000);
            
            if (delayMinutes >= effectiveThresholds.maintenance) {
                overdueTasks.push({
                    id: doc.id,
                    type: 'maintenance',
                    roomNumber: data.roomNumber || 'غير محدد',
                    assignedTo: data.assignedTo,
                    assignedToName: data.assignedToName,
                    startedAt: startTime,
                    delayMinutes,
                    status: data.status,
                    tenantId,
                    branchId: data.branchId
                });
            }
        });

        return overdueTasks;
    } catch (error) {
        console.error('Error checking overdue tasks:', error);
        return [];
    }
};

/**
 * Send critical delay alert to manager
 */
export const sendDelayAlert = async (
    task: OverdueTask,
    managerFcmTokens: string[]
): Promise<boolean> => {
    if (!db || managerFcmTokens.length === 0) return false;

    try {
        // Create alert record
        const alertRef = collection(db, `tenants/${task.tenantId}/delayAlerts`);
        await addDoc(alertRef, {
            taskId: task.id,
            taskType: task.type,
            roomNumber: task.roomNumber,
            delayMinutes: task.delayMinutes,
            alertedAt: Timestamp.now(),
            acknowledged: false,
            tenantId: task.tenantId,
            branchId: task.branchId
        });

        // Send push notifications
        const typeLabels: Record<string, string> = {
            housekeeping: 'تنظيف',
            maintenance: 'صيانة',
            coffeeshop: 'كافي شوب',
            bellman: 'بيلمان'
        };

        const title = `⚠️ تنبيه تأخير: ${typeLabels[task.type] || task.type}`;
        const body = `مهمة الغرفة ${task.roomNumber} متأخرة ${task.delayMinutes} دقيقة!`;

        for (const token of managerFcmTokens) {
            await sendPushNotification(token, {
                title,
                body,
                icon: '/adora-logo.png',
                data: {
                    type: 'critical_delay',
                    taskId: task.id,
                    taskType: task.type,
                    roomNumber: task.roomNumber
                }
            });
        }

        console.log(`✅ Delay alert sent for task ${task.id}`);
        return true;
    } catch (error) {
        console.error('Error sending delay alert:', error);
        return false;
    }
};

// ============================================================
// REAL-TIME MONITORING
// ============================================================

/**
 * Start real-time monitoring for overdue tasks
 * Returns unsubscribe function
 */
export const startDelayMonitoring = (
    tenantId: string,
    onOverdueTasksFound: (tasks: OverdueTask[]) => void,
    thresholds: Partial<DelayThresholds> = {},
    checkIntervalMs: number = 60000 // 1 minute
): (() => void) => {
    let intervalId: NodeJS.Timeout | null = null;
    let isRunning = true;

    const runCheck = async () => {
        if (!isRunning) return;
        
        const overdueTasks = await checkOverdueTasks(tenantId, thresholds);
        if (overdueTasks.length > 0) {
            onOverdueTasksFound(overdueTasks);
        }
    };

    // Initial check
    runCheck();

    // Periodic checks
    intervalId = setInterval(runCheck, checkIntervalMs);

    // Return cleanup function
    return () => {
        isRunning = false;
        if (intervalId) {
            clearInterval(intervalId);
        }
    };
};

// ============================================================
// ALERT HISTORY
// ============================================================

/**
 * Get recent delay alerts for a tenant
 */
export const getDelayAlertHistory = async (
    tenantId: string,
    limitCount: number = 50
): Promise<DelayAlert[]> => {
    if (!db) return [];

    try {
        const alertsRef = collection(db, `tenants/${tenantId}/delayAlerts`);
        const alertsQuery = query(
            alertsRef,
            orderBy('alertedAt', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(alertsQuery);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            alertedAt: doc.data().alertedAt?.toDate?.() || new Date()
        })) as DelayAlert[];
    } catch (error) {
        console.error('Error getting alert history:', error);
        return [];
    }
};

/**
 * Acknowledge a delay alert
 */
export const acknowledgeAlert = async (
    tenantId: string,
    alertId: string,
    managerId: string
): Promise<boolean> => {
    if (!db) return false;

    try {
        const { doc: docRef, updateDoc } = await import('firebase/firestore');
        const alertRef = docRef(db, `tenants/${tenantId}/delayAlerts`, alertId);
        
        await updateDoc(alertRef, {
            acknowledged: true,
            acknowledgedBy: managerId,
            acknowledgedAt: Timestamp.now()
        });

        return true;
    } catch (error) {
        console.error('Error acknowledging alert:', error);
        return false;
    }
};

// ============================================================
// REACT HOOK
// ============================================================

/**
 * React Hook for Critical Delay Alerts
 * Use in Manager Dashboard to monitor tasks in real-time
 */
export const useCriticalDelayAlerts = (
    tenantId: string | undefined,
    enabled: boolean = true
) => {
    // This will be implemented as a custom hook in a separate file
    // For now, return the service functions
    return {
        checkOverdueTasks: () => tenantId ? checkOverdueTasks(tenantId) : Promise.resolve([]),
        startMonitoring: (callback: (tasks: OverdueTask[]) => void) => 
            tenantId ? startDelayMonitoring(tenantId, callback) : () => {},
        getAlertHistory: () => tenantId ? getDelayAlertHistory(tenantId) : Promise.resolve([])
    };
};

export default {
    checkOverdueTasks,
    sendDelayAlert,
    startDelayMonitoring,
    getDelayAlertHistory,
    acknowledgeAlert,
    DEFAULT_THRESHOLDS
};
