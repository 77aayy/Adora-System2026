/**
 * Golden Alert Service V2
 * Manager broadcast alerts with scheduling and read receipts
 * Adora Hotel Management System V2
 */

import {
    collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp, onSnapshot, deleteDoc, arrayUnion, getDoc
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export interface GoldenAlert {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'urgent';
    createdBy: { id: string; name: string };
    createdAt: Date;
    scheduledAt: Date; // When to start showing
    expiresAt: Date;
    isActive: boolean;
    branch: string;
    departments: string[]; // 'all' or specific departments
    viewed: { id: string; name: string; time: Date }[]; // Who viewed it
}

export interface CreateGoldenAlertInput {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'urgent';
    scheduledAt: Date; // When to start showing
    durationMinutes: number; // How long to show
    departments: string[];
    createdBy: { id: string; name: string };
    branch: string;
}

// ============================================================
// SPECIAL SOUND & HAPTIC CONFIG
// ============================================================

export const GOLDEN_ALERT_CONFIG = {
    info: {
        icon: 'ℹ️',
        bgClass: 'bg-gradient-to-br from-blue-500/30 via-blue-600/20 to-purple-500/30',
        borderClass: 'border-blue-400/60 shadow-blue-500/30',
        glowClass: 'shadow-lg shadow-blue-500/40',
        textColor: 'text-blue-300',
        label: 'معلومة',
        sound: 'info',
        hapticPattern: [50, 100, 50],
    },
    warning: {
        icon: '⚠️',
        bgClass: 'bg-gradient-to-br from-yellow-500/30 via-orange-500/20 to-red-500/30',
        borderClass: 'border-yellow-400/60 shadow-yellow-500/30',
        glowClass: 'shadow-lg shadow-yellow-500/40',
        textColor: 'text-yellow-300',
        label: 'تحذير',
        sound: 'warning',
        hapticPattern: [100, 50, 100, 50, 100],
    },
    urgent: {
        icon: '🚨',
        bgClass: 'bg-gradient-to-br from-red-500/40 via-red-600/30 to-orange-500/40',
        borderClass: 'border-red-400/70 shadow-red-500/40',
        glowClass: 'shadow-xl shadow-red-500/50',
        textColor: 'text-red-300',
        label: 'عاجل',
        sound: 'urgent',
        hapticPattern: [200, 100, 200, 100, 200, 100, 200],
    },
};

// ============================================================
// FUNCTIONS
// ============================================================

/**
 * Create a new golden alert with scheduling
 */
export const createGoldenAlert = async (input: CreateGoldenAlertInput): Promise<string> => {
    const expiresAt = new Date(input.scheduledAt.getTime() + input.durationMinutes * 60000);

    const docRef = await addDoc(collection(db, 'goldenAlerts'), {
        title: input.title,
        message: input.message,
        type: input.type,
        createdBy: input.createdBy,
        createdAt: Timestamp.now(),
        scheduledAt: Timestamp.fromDate(input.scheduledAt),
        expiresAt: Timestamp.fromDate(expiresAt),
        isActive: true,
        branch: input.branch,
        departments: input.departments,
        viewed: [],
    });

    return docRef.id;
};

/**
 * Get active golden alerts for a branch/department
 */
export const getActiveGoldenAlerts = async (
    branchId: string,
    department: string
): Promise<GoldenAlert[]> => {
    const now = new Date();

    const q = query(
        collection(db, 'goldenAlerts'),
        where('branch', '==', branchId),
        where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const alerts: GoldenAlert[] = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        const scheduledAt = data.scheduledAt?.toDate?.() || new Date();
        const expiresAt = data.expiresAt?.toDate?.() || new Date();

        // Check if scheduled time has passed and not expired
        if (now >= scheduledAt && expiresAt > now) {
            const departments = data.departments || ['all'];
            if (departments.includes('all') || departments.includes(department)) {
                alerts.push({
                    id: doc.id,
                    title: data.title,
                    message: data.message,
                    type: data.type,
                    createdBy: data.createdBy,
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                    scheduledAt,
                    expiresAt,
                    isActive: data.isActive,
                    branch: data.branch,
                    departments,
                    viewed: (data.viewed || []).map((v: any) => ({
                        id: v.id,
                        name: v.name,
                        time: v.time?.toDate?.() || new Date(),
                    })),
                });
            }
        }
    });

    return alerts;
};

/**
 * Subscribe to active golden alerts (real-time)
 */
export const subscribeToGoldenAlerts = (
    branchId: string,
    department: string,
    callback: (alerts: GoldenAlert[]) => void
) => {
    const q = query(
        collection(db, 'goldenAlerts'),
        where('branch', '==', branchId),
        where('isActive', '==', true)
    );

    return onSnapshot(q, (snapshot) => {
        const now = new Date();
        const alerts: GoldenAlert[] = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const scheduledAt = data.scheduledAt?.toDate?.() || new Date();
            const expiresAt = data.expiresAt?.toDate?.() || new Date();

            if (now >= scheduledAt && expiresAt > now) {
                const departments = data.departments || ['all'];
                if (departments.includes('all') || departments.includes(department)) {
                    alerts.push({
                        id: doc.id,
                        title: data.title,
                        message: data.message,
                        type: data.type,
                        createdBy: data.createdBy,
                        createdAt: data.createdAt?.toDate?.() || new Date(),
                        scheduledAt,
                        expiresAt,
                        isActive: data.isActive,
                        branch: data.branch,
                        departments,
                        viewed: (data.viewed || []).map((v: any) => ({
                            id: v.id,
                            name: v.name,
                            time: v.time?.toDate?.() || new Date(),
                        })),
                    });
                }
            }
        });

        callback(alerts);
    });
};

/**
 * Mark alert as viewed by user (with name for display)
 */
export const markAlertViewed = async (
    alertId: string,
    userId: string,
    userName: string
): Promise<void> => {
    const docRef = doc(db, 'goldenAlerts', alertId);

    await updateDoc(docRef, {
        viewed: arrayUnion({
            id: userId,
            name: userName,
            time: Timestamp.now(),
        })
    });
};

/**
 * Get alert view status
 */
export const getAlertViewStatus = async (alertId: string): Promise<{
    total: number;
    viewed: { id: string; name: string; time: Date }[];
}> => {
    const docRef = doc(db, 'goldenAlerts', alertId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
        return { total: 0, viewed: [] };
    }

    const data = snapshot.data();
    const viewed = (data.viewed || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        time: v.time?.toDate?.() || new Date(),
    }));

    return { total: viewed.length, viewed };
};

/**
 * Subscribe to alert views (for manager to see who viewed)
 */
export const subscribeToAlertViews = (
    alertId: string,
    callback: (views: { id: string; name: string; time: Date }[]) => void
) => {
    const docRef = doc(db, 'goldenAlerts', alertId);

    return onSnapshot(docRef, (snapshot) => {
        if (!snapshot.exists()) {
            callback([]);
            return;
        }

        const data = snapshot.data();
        const views = (data.viewed || []).map((v: any) => ({
            id: v.id,
            name: v.name,
            time: v.time?.toDate?.() || new Date(),
        }));

        callback(views);
    });
};

/**
 * Deactivate a golden alert
 */
export const deactivateGoldenAlert = async (alertId: string): Promise<void> => {
    await updateDoc(doc(db, 'goldenAlerts', alertId), { isActive: false });
};

/**
 * Delete a golden alert
 */
export const deleteGoldenAlert = async (alertId: string): Promise<void> => {
    await deleteDoc(doc(db, 'goldenAlerts', alertId));
};

/**
 * Get scheduled alerts (not yet active)
 */
export const getScheduledAlerts = async (branchId: string): Promise<GoldenAlert[]> => {
    const now = new Date();

    const q = query(
        collection(db, 'goldenAlerts'),
        where('branch', '==', branchId),
        where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const alerts: GoldenAlert[] = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        const scheduledAt = data.scheduledAt?.toDate?.() || new Date();

        // Only scheduled (not yet visible)
        if (scheduledAt > now) {
            alerts.push({
                id: doc.id,
                title: data.title,
                message: data.message,
                type: data.type,
                createdBy: data.createdBy,
                createdAt: data.createdAt?.toDate?.() || new Date(),
                scheduledAt,
                expiresAt: data.expiresAt?.toDate?.() || new Date(),
                isActive: data.isActive,
                branch: data.branch,
                departments: data.departments || ['all'],
                viewed: [],
            });
        }
    });

    return alerts.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
};

/**
 * Get all alerts for manager (active, scheduled, expired)
 */
export const getManagerAlertHistory = async (branchId: string): Promise<GoldenAlert[]> => {
    const q = query(
        collection(db, 'goldenAlerts'),
        where('branch', '==', branchId)
    );

    const snapshot = await getDocs(q);
    const alerts: GoldenAlert[] = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        alerts.push({
            id: doc.id,
            title: data.title,
            message: data.message,
            type: data.type,
            createdBy: data.createdBy,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            scheduledAt: data.scheduledAt?.toDate?.() || new Date(),
            expiresAt: data.expiresAt?.toDate?.() || new Date(),
            isActive: data.isActive,
            branch: data.branch,
            departments: data.departments || ['all'],
            viewed: (data.viewed || []).map((v: any) => ({
                id: v.id,
                name: v.name,
                time: v.time?.toDate?.() || new Date(),
            })),
        });
    });

    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    createGoldenAlert,
    getActiveGoldenAlerts,
    subscribeToGoldenAlerts,
    markAlertViewed,
    getAlertViewStatus,
    subscribeToAlertViews,
    deactivateGoldenAlert,
    deleteGoldenAlert,
    getScheduledAlerts,
    getManagerAlertHistory,
    GOLDEN_ALERT_CONFIG,
};
