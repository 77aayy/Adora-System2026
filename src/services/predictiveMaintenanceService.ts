/**
 * Predictive Maintenance Service
 * Analyzes historical data to predict potential issues
 * Adora Hotel Management System V2
 */

import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface MaintenanceRecord {
    id: string;
    roomNumber: string;
    type: 'electrical' | 'plumbing' | 'ac' | 'furniture' | 'other';
    createdAt: Date;
    completedAt?: Date;
    cost?: number;
}

export interface RoomMaintenanceHistory {
    roomNumber: string;
    totalIssues: number;
    issuesByType: Record<string, number>;
    avgResolutionTime: number; // minutes
    lastIssue?: Date;
}

export interface MaintenancePrediction {
    roomNumber: string;
    predictedIssueType: string;
    probability: number; // 0-1
    reason: string;
    suggestedAction: string;
    priority: 'low' | 'medium' | 'high';
}

export interface SystemHealth {
    category: string;
    status: 'good' | 'warning' | 'critical';
    issueCount: number;
    trend: 'improving' | 'stable' | 'declining';
}

// ============================================================
// DATA FETCHING
// ============================================================

/**
 * Get maintenance history for analysis
 * ✅ SaaS: Added tenantId filter for data isolation
 */
export const getMaintenanceHistory = async (
    tenantId: string,
    days: number = 90
): Promise<MaintenanceRecord[]> => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const requestsRef = collection(db, 'requests');
    const q = query(
        requestsRef,
        where('tenantId', '==', tenantId),
        where('type', '==', 'maintenance'),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            roomNumber: data.roomNumber,
            type: data.maintenanceType || 'other',
            createdAt: data.createdAt?.toDate() || new Date(),
            completedAt: data.completedAt?.toDate(),
            cost: data.cost,
        };
    });
};

// ============================================================
// ANALYSIS
// ============================================================

/**
 * Analyze room maintenance history
 */
export const analyzeRoomHistory = (
    records: MaintenanceRecord[]
): Map<string, RoomMaintenanceHistory> => {
    const roomMap = new Map<string, RoomMaintenanceHistory>();

    records.forEach(record => {
        const existing = roomMap.get(record.roomNumber) || {
            roomNumber: record.roomNumber,
            totalIssues: 0,
            issuesByType: {},
            avgResolutionTime: 0,
            lastIssue: undefined,
        };

        existing.totalIssues++;
        existing.issuesByType[record.type] = (existing.issuesByType[record.type] || 0) + 1;

        if (!existing.lastIssue || record.createdAt > existing.lastIssue) {
            existing.lastIssue = record.createdAt;
        }

        roomMap.set(record.roomNumber, existing);
    });

    return roomMap;
};

/**
 * Calculate average resolution time
 */
export const calculateAvgResolutionTime = (records: MaintenanceRecord[]): number => {
    const completedRecords = records.filter(r => r.completedAt);
    if (completedRecords.length === 0) return 0;

    const totalMinutes = completedRecords.reduce((sum, record) => {
        const duration = record.completedAt!.getTime() - record.createdAt.getTime();
        return sum + duration / (1000 * 60);
    }, 0);

    return totalMinutes / completedRecords.length;
};

// ============================================================
// PREDICTION ENGINE
// ============================================================

/**
 * Generate maintenance predictions based on history
 */
export const generatePredictions = (
    roomHistories: Map<string, RoomMaintenanceHistory>
): MaintenancePrediction[] => {
    const predictions: MaintenancePrediction[] = [];

    roomHistories.forEach((history, roomNumber) => {
        // High issue frequency
        if (history.totalIssues >= 5) {
            const mostCommonType = Object.entries(history.issuesByType)
                .sort((a, b) => b[1] - a[1])[0];

            predictions.push({
                roomNumber,
                predictedIssueType: mostCommonType[0],
                probability: Math.min(0.9, history.totalIssues / 10),
                reason: `تكرار مشاكل ${getTypeLabel(mostCommonType[0])} (${mostCommonType[1]} مرات)`,
                suggestedAction: `فحص شامل لنظام ${getTypeLabel(mostCommonType[0])}`,
                priority: history.totalIssues >= 8 ? 'high' : 'medium',
            });
        }

        // Recent repeated issues
        if (history.lastIssue) {
            const daysSinceLastIssue = (Date.now() - history.lastIssue.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceLastIssue < 7 && history.totalIssues >= 2) {
                predictions.push({
                    roomNumber,
                    predictedIssueType: 'recurring',
                    probability: 0.7,
                    reason: 'مشاكل متكررة في فترة قصيرة',
                    suggestedAction: 'فحص شامل للغرفة',
                    priority: 'high',
                });
            }
        }

        // AC issues in summer (example of seasonal prediction)
        const currentMonth = new Date().getMonth();
        const isSummer = currentMonth >= 5 && currentMonth <= 8;

        if (isSummer && (history.issuesByType['ac'] || 0) >= 2) {
            predictions.push({
                roomNumber,
                predictedIssueType: 'ac',
                probability: 0.6,
                reason: 'تاريخ مشاكل تكييف في موسم الصيف',
                suggestedAction: 'صيانة وقائية للتكييف',
                priority: 'medium',
            });
        }

        // 🧠 GENIUS RULE: AC Replacement Protocol
        // > 3 AC issues (High Priority)
        if ((history.issuesByType['ac'] || 0) > 3) {
            predictions.push({
                roomNumber,
                predictedIssueType: 'ac',
                probability: 0.95,
                reason: 'تكرار أعطال التكييف (أكثر من 3 مرات)',
                suggestedAction: 'REPLACE_UNIT',
                priority: 'high',
            });
        }
    });

    // Sort by probability
    return predictions.sort((a, b) => b.probability - a.probability);
};

/**
 * ⚡ GENIUS FEATURE: Auto-Flag Rooms in Database
 * Updates the 'rooms' collection with high-priority alerts
 * Includes strict multi-tenancy security
 */
export const applyPredictiveFlags = async (
    predictions: MaintenancePrediction[],
    tenantId: string
): Promise<number> => {
    const highPriority = predictions.filter(p => p.priority === 'high' || p.suggestedAction === 'REPLACE_UNIT');
    let updateCount = 0;

    const batch = writeBatch(db);

    for (const prediction of highPriority) {
        // Find room by roomNumber and tenantId (Security Standard)
        const roomsRef = collection(db, 'rooms');
        const q = query(
            roomsRef,
            where('roomNumber', '==', prediction.roomNumber),
            where('tenantId', '==', tenantId), // 🛡️ Security Check
            limit(1)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const roomDoc = snapshot.docs[0];
            batch.update(roomDoc.ref, {
                maintenanceAlert: 'HIGH_PRIORITY_REPLACEMENT',
                maintenanceReason: prediction.reason,
                lastPredictiveScan: Timestamp.now()
            });
            updateCount++;
        }
    }

    if (updateCount > 0) {
        await batch.commit();
        logger.info(`Applied High Priority Flags to ${updateCount} rooms for tenant: ${tenantId}`, undefined, 'predictiveMaintenanceService');
    }

    return updateCount;
};

/**
 * Get system health overview
 */
export const getSystemHealth = (records: MaintenanceRecord[]): SystemHealth[] => {
    const categories = ['electrical', 'plumbing', 'ac', 'furniture', 'other'];
    const health: SystemHealth[] = [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRecords = records.filter(r => r.createdAt >= thirtyDaysAgo);

    categories.forEach(category => {
        const categoryRecords = recentRecords.filter(r => r.type === category);
        const count = categoryRecords.length;

        let status: 'good' | 'warning' | 'critical';
        if (count <= 2) status = 'good';
        else if (count <= 5) status = 'warning';
        else status = 'critical';

        // Simple trend analysis (compare to previous 30 days)
        const previousRecords = records.filter(r =>
            r.type === category &&
            r.createdAt < thirtyDaysAgo &&
            r.createdAt >= new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000)
        );

        let trend: 'improving' | 'stable' | 'declining';
        if (count < previousRecords.length) trend = 'improving';
        else if (count > previousRecords.length) trend = 'declining';
        else trend = 'stable';

        health.push({
            category: getTypeLabel(category),
            status,
            issueCount: count,
            trend,
        });
    });

    return health;
};

// ============================================================
// HELPERS
// ============================================================

const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        electrical: 'الكهرباء',
        plumbing: 'السباكة',
        ac: 'التكييف',
        furniture: 'الأثاث',
        other: 'أخرى',
        recurring: 'متكررة',
    };
    return labels[type] || type;
};

// ============================================================
// MAIN FUNCTION
// ============================================================

/**
 * Run full predictive analysis
 * ✅ SaaS: Added tenantId parameter for data isolation
 */
export const runPredictiveAnalysis = async (tenantId: string): Promise<{
    predictions: MaintenancePrediction[];
    systemHealth: SystemHealth[];
    avgResolutionTime: number;
}> => {
    const history = await getMaintenanceHistory(tenantId, 90);
    const roomHistories = analyzeRoomHistory(history);
    const predictions = generatePredictions(roomHistories);
    const systemHealth = getSystemHealth(history);
    const avgResolutionTime = calculateAvgResolutionTime(history);

    return {
        predictions: predictions.slice(0, 10), // Top 10
        systemHealth,
        avgResolutionTime,
    };
};

export default {
    getMaintenanceHistory,
    analyzeRoomHistory,
    generatePredictions,
    getSystemHealth,
    runPredictiveAnalysis,
};
