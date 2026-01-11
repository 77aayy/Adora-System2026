/**
 * Smart Alerts Service
 * Intelligent notifications for management
 * Adora Hotel Management System V2
 */

import {
    collection, query, where, getDocs, Timestamp, orderBy, limit
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export type AlertType = 'delayed' | 'deficit' | 'backlog' | 'performance' | 'urgent' | 'sentiment';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface SmartAlert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    department: string;
    timestamp: Date;
    metadata?: Record<string, any>;
    actionRequired?: boolean;
}

// ============================================================
// ALERT THRESHOLDS
// ============================================================

const THRESHOLDS = {
    // Request delay (minutes)
    REQUEST_DELAY_WARNING: 30,
    REQUEST_DELAY_CRITICAL: 60,

    // Backlog count
    BACKLOG_WARNING: 5,
    BACKLOG_CRITICAL: 10,

    // Laundry deficit percentage
    DEFICIT_WARNING: 5,
    DEFICIT_CRITICAL: 10,

    // Pending maintenance
    MAINTENANCE_WARNING: 3,
    MAINTENANCE_CRITICAL: 5,

    // Pending procurement
    PROCUREMENT_WARNING: 3,
    PROCUREMENT_CRITICAL: 5,
};

// ============================================================
// ALERT GENERATION
// ============================================================

/**
 * Get all smart alerts for a branch
 * ✅ SaaS: tenantId is now required for data isolation
 */
export const getSmartAlerts = async (branchId: string, tenantId: string): Promise<SmartAlert[]> => {
    const alerts: SmartAlert[] = [];
    const now = new Date();

    try {
        // 1. Check delayed requests
        const delayedAlerts = await checkDelayedRequests(branchId, now, tenantId);
        alerts.push(...delayedAlerts);

        // 2. Check request backlog
        const backlogAlerts = await checkRequestBacklog(branchId, tenantId);
        alerts.push(...backlogAlerts);

        // 3. Check maintenance pending
        const maintenanceAlerts = await checkMaintenancePending(branchId, tenantId);
        alerts.push(...maintenanceAlerts);

        // 4. Check procurement pending
        const procurementAlerts = await checkProcurementPending(branchId, tenantId);
        alerts.push(...procurementAlerts);

        // 5. Check AI Sentiment (Crisis Management)
        const sentimentAlerts = await checkSentimentAlerts(branchId, tenantId);
        alerts.push(...sentimentAlerts);

        // 5. Check laundry deficit
        // const deficitAlerts = await checkLaundryDeficit(branchId);
        // alerts.push(...deficitAlerts);

    } catch (err) {
        console.error('Error generating smart alerts:', err);
    }

    // Sort by severity (critical first) then by timestamp
    alerts.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.timestamp.getTime() - a.timestamp.getTime();
    });

    return alerts;
};

/**
 * Check delayed requests
 * ✅ SaaS: tenantId is now required for data isolation
 */
const checkDelayedRequests = async (branchId: string, now: Date, tenantId: string): Promise<SmartAlert[]> => {
    const alerts: SmartAlert[] = [];
    try {
        const constraints: any[] = [
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('status', 'in', ['pending', 'in-progress'])
        ];
        constraints.push(limit(20));

        const q = query(collection(db, 'serviceRequests'), ...constraints);

        const snapshot = await getDocs(q);

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.createdAt) return;

            const created = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
            const diffMinutes = Math.floor((now.getTime() - created.getTime()) / 60000);

            if (diffMinutes > THRESHOLDS.REQUEST_DELAY_WARNING) {
                const isCritical = diffMinutes > THRESHOLDS.REQUEST_DELAY_CRITICAL;
                alerts.push({
                    id: `delay_${doc.id}`,
                    type: 'delayed',
                    severity: isCritical ? 'critical' : 'warning',
                    title: isCritical ? 'تأخير حرج' : 'تأخر في الطلبات',
                    message: `طلب ${data.item || 'خدمة'} للغرفة ${data.roomNumber} متأخر منذ ${diffMinutes} دقيقة`,
                    department: data.department || 'general',
                    timestamp: now,
                    actionRequired: true,
                    metadata: { requestId: doc.id, roomNumber: data.roomNumber }
                });
            }
        });
    } catch (error) {
        console.error("Error checking delayed requests", error);
    }
    return alerts;
};

/**
 * Check request backlog
 * ✅ SaaS: tenantId is now required for data isolation
 */
const checkRequestBacklog = async (branchId: string, tenantId: string): Promise<SmartAlert[]> => {
    const alerts: SmartAlert[] = [];
    try {
        const constraints: any[] = [
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('status', '==', 'pending')
        ];

        const q = query(collection(db, 'serviceRequests'), ...constraints);
        const snapshot = await getDocs(q);
        const count = snapshot.size;

        if (count >= THRESHOLDS.BACKLOG_WARNING) {
            alerts.push({
                id: 'backlog_requests',
                type: 'backlog',
                severity: count >= THRESHOLDS.BACKLOG_CRITICAL ? 'critical' : 'warning',
                title: 'ضغط طلبات',
                message: `يوجد ${count} طلبات معلقة بانتظار التعامل معها`,
                department: 'general',
                timestamp: new Date(),
                metadata: { count }
            });
        }
    } catch (error) {
        console.error("Error checking backlog", error);
    }
    return alerts;
};

/**
 * Check maintenance pending
 * ✅ SaaS: tenantId is now required for data isolation
 */
const checkMaintenancePending = async (branchId: string, tenantId: string): Promise<SmartAlert[]> => {
    const alerts: SmartAlert[] = [];
    try {
        const constraints: any[] = [
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('status', 'in', ['pending', 'assigned'])
        ];

        const q = query(collection(db, 'maintenance'), ...constraints);
        // Simplified check, could be expanded
    } catch (error) {
        // Silently fail if collection doesn't exist
    }
    return alerts;
};

/**
 * Check procurement pending
 * ✅ SaaS: tenantId is now required for data isolation
 */
const checkProcurementPending = async (branchId: string, tenantId: string): Promise<SmartAlert[]> => {
    const alerts: SmartAlert[] = [];
    // Placeholder logic
    return alerts;
};

/**
 * Check AI detected sentiment crises
 * ✅ SaaS: tenantId is now required for data isolation
 */
const checkSentimentAlerts = async (branchId: string, tenantId: string): Promise<SmartAlert[]> => {
    const alerts: SmartAlert[] = [];
    try {
        const constraints: any[] = [
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('sentimentResult.severity', '==', 'MODERATE')
        ];
        constraints.push(orderBy('createdAt', 'desc'));
        constraints.push(limit(10));

        const q = query(collection(db, 'requests'), ...constraints);

        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const data = doc.data();
            alerts.push({
                id: `sentiment_${doc.id}`,
                type: 'sentiment',
                severity: 'warning',
                title: 'تنبيه مشاعر سلبي (ذكاء اصطناعي)',
                message: `شكوى من الغرفة ${data.roomNumber}: ${data.sentimentResult.summary}`,
                department: 'management',
                timestamp: data.createdAt.toDate(),
                actionRequired: true,
                metadata: {
                    requestId: doc.id,
                    recovery: data.sentimentResult.suggestedRecovery,
                    issue: data.sentimentResult.issue
                }
            });
        });
    } catch (error) {
        console.error("Error checking sentiment alerts", error);
    }
    return alerts;
};

/**
 * Check for laundry deficit (Disabled temporarily - requires tenantId)
 */
/*
const checkLaundryDeficit = async (branchId: string): Promise<SmartAlert[]> => {
    const alerts: SmartAlert[] = [];

    try {
        // Get today's date
        const today = new Date().toISOString().split('T')[0];

        const q = query(
            collection(db, 'laundryRecords'),
            where('branch', '==', branchId),
            where('date', '==', today)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const record = snapshot.docs[0].data();
            const deficit = record.deficit || {};
            const totalDeficit = Object.values(deficit).reduce((s: number, v: any) => s + Math.abs(v || 0), 0);

            if (totalDeficit >= THRESHOLDS.DEFICIT_CRITICAL * 10) {
                alerts.push({
                    id: 'laundry_deficit',
                    type: 'deficit',
                    severity: 'critical',
                    title: '🧺 عجز كبير في المغسلة',
                    message: `عجز ${totalDeficit} قطعة اليوم - يحتاج مراجعة فورية`,
                    department: 'housekeeping',
                    timestamp: new Date(),
                    actionRequired: true,
                    metadata: { totalDeficit, date: today }
                });
            } else if (totalDeficit >= THRESHOLDS.DEFICIT_WARNING * 5) {
                alerts.push({
                    id: 'laundry_deficit',
                    type: 'deficit',
                    severity: 'warning',
                    title: '🧺 عجز في جرد المغسلة',
                    message: `عجز ${totalDeficit} قطعة اليوم`,
                    department: 'housekeeping',
                    timestamp: new Date(),
                    metadata: { totalDeficit, date: today }
                });
            }
        }
    } catch (err) {
        console.error('Error checking laundry deficit:', err);
    }

    return alerts;
};
*/

// ============================================================
// HELPERS
// ============================================================

const getDeptName = (dept: string): string => {
    const names: Record<string, string> = {
        bellman: 'البيلمان',
        housekeeping: 'الهاوس كيبنج',
        maintenance: 'الصيانة',
        reception: 'الاستقبال',
        procurement: 'المشتريات',
    };
    return names[dept] || dept;
};

/**
 * Get alert icon
 */
export const getAlertIcon = (type: AlertType): string => {
    const icons: Record<AlertType, string> = {
        delayed: '⏰',
        deficit: '🧺',
        backlog: '📋',
        performance: '📊',
        urgent: '🚨',
        sentiment: '🧠',
    };
    return icons[type] || '⚠️';
};

/**
 * Get severity color
 */
export const getSeverityColor = (severity: AlertSeverity): string => {
    const colors: Record<AlertSeverity, string> = {
        info: 'text-blue-400 bg-blue-500/20',
        warning: 'text-yellow-400 bg-yellow-500/20',
        critical: 'text-red-400 bg-red-500/20',
    };
    return colors[severity] || colors.info;
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    getSmartAlerts,
    getAlertIcon,
    getSeverityColor,
    THRESHOLDS,
};
