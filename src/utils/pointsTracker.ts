/**
 * Points Tracker Service
 * Detailed points tracking with history
 * Adora Hotel Management System V2
 */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
    Timestamp,
    increment,
} from 'firebase/firestore';
import { db } from '../services/firebase';

// ============================================================
// TYPES
// ============================================================

export type PointAction =
    | 'checkin'
    | 'checkout'
    | 'complete_bellman'
    | 'qr_response_delay'
    | 'start_cleaning'
    | 'complete_cleaning'
    | 'cleaning_delay'
    | 'complete_maintenance'
    | 'maintenance_delay'
    | 'purchase'
    | 'receive'
    | 'procurement_delay'
    | 'confirm_request'
    | 'complete_request'
    | 'create_request'
    | 'complete_inspection'
    | 'guest_rating_excellent'
    | 'guest_rating_very_good'
    | 'guest_rating_good'
    | 'guest_rating_fair'
    | 'guest_rating_poor'
    | 'daily_reward'
    | 'weekly_reward'
    | 'monthly_reward';

export interface PointDetails {
    roomNumber?: string;
    requestId?: string;
    serviceType?: string;
    delayMinutes?: number;
    itemName?: string;
    maintenanceType?: string;
    cleaningType?: 'stayover' | 'checkout';
    rank?: number;
    [key: string]: any;
}

export interface AddPointOptions {
    employeeId: string;
    action: PointAction;
    points: number;
    reason?: string;
    details?: PointDetails;
}

export interface PointHistoryEntry {
    id: string;
    action: PointAction;
    points: number;
    reason: string;
    details: PointDetails;
    timestamp: Date;
    employeeId: string;
    employeeName?: string;
}

// ============================================================
// REASON TEXT GENERATION
// ============================================================

/**
 * Get reason text in Arabic based on action and details
 */
export const getReasonText = (action: PointAction, details: PointDetails = {}): string => {
    const roomSuffix = details.roomNumber ? ` - غرفة ${details.roomNumber}` : '';
    const delaySuffix = details.delayMinutes ? ` (${details.delayMinutes} دقيقة)` : '';
    const itemSuffix = details.itemName ? ` - ${details.itemName}` : '';
    const serviceSuffix = details.serviceType ? ` - ${details.serviceType}` : '';
    const rankSuffix = details.rank ? ` (المركز ${details.rank})` : '';

    const reasons: Record<PointAction, string> = {
        // Bellman
        checkin: `تسجيل دخول نزيل${roomSuffix}`,
        checkout: `تسجيل خروج نزيل${roomSuffix}`,
        complete_bellman: `إتمام طلب بيلمان${roomSuffix}`,
        qr_response_delay: `تأخير في الاستجابة لنداء النزيل${roomSuffix}${delaySuffix}`,

        // Housekeeping
        start_cleaning: `بدء تنظيف${roomSuffix}`,
        complete_cleaning: `إتمام تنظيف${roomSuffix}${details.cleaningType === 'checkout' ? ' (مغادرة)' : ' (ساكن)'}`,
        cleaning_delay: `تأخير في إتمام التنظيف${roomSuffix}${delaySuffix}`,

        // Maintenance
        complete_maintenance: `إتمام صيانة${roomSuffix}${details.maintenanceType ? ` (${details.maintenanceType})` : ''}`,
        maintenance_delay: `تأخير في إتمام الصيانة${roomSuffix}${delaySuffix}`,

        // Procurement
        purchase: `شراء منتج${itemSuffix}`,
        receive: `استلام منتج${itemSuffix}`,
        procurement_delay: `تأخير في استلام المنتج${itemSuffix}${delaySuffix}`,

        // Reception
        confirm_request: `تأكيد طلب${serviceSuffix}${roomSuffix}`,
        complete_request: `إتمام طلب${serviceSuffix}${roomSuffix}`,
        create_request: `إنشاء طلب${serviceSuffix}${roomSuffix}`,

        // Inspection
        complete_inspection: `إتمام فحص${roomSuffix}`,

        // Ratings
        guest_rating_excellent: `تقييم نزيل ممتاز${serviceSuffix}${roomSuffix}`,
        guest_rating_very_good: `تقييم نزيل جيد جداً${serviceSuffix}${roomSuffix}`,
        guest_rating_good: `تقييم نزيل جيد${serviceSuffix}${roomSuffix}`,
        guest_rating_fair: `تقييم نزيل مقبول${serviceSuffix}${roomSuffix}`,
        guest_rating_poor: `تقييم نزيل ضعيف${serviceSuffix}${roomSuffix}`,

        // Rewards
        daily_reward: `مكافأة الأداء اليومي${rankSuffix}`,
        weekly_reward: `مكافأة الأداء الأسبوعي${rankSuffix}`,
        monthly_reward: `مكافأة الأداء الشهري${rankSuffix}`,
    };

    return reasons[action] || action;
};

// ============================================================
// POINTS OPERATIONS
// ============================================================

/**
 * Add points with detailed tracking
 */
export const addPointWithDetails = async (options: AddPointOptions): Promise<void> => {
    const { employeeId, action, points, reason, details = {} } = options;

    if (!employeeId || points === undefined) {
        console.error('Missing required parameters for addPointWithDetails');
        return;
    }

    try {
        const employeeRef = doc(db, 'users', employeeId);

        // 1. Update total points
        await updateDoc(employeeRef, {
            points: increment(points),
        });

        // 2. Add to points history
        const historyRef = collection(db, 'users', employeeId, 'pointsHistory');
        await addDoc(historyRef, {
            action,
            points,
            reason: reason || getReasonText(action, details),
            details,
            timestamp: Timestamp.now(),
            employeeId,
        });

    } catch (error) {
        console.error('Error adding point with details:', error);
    }
};

/**
 * Subscribe to points history
 */
export const subscribeToPointsHistory = (
    employeeId: string,
    callback: (history: PointHistoryEntry[]) => void,
    historyLimit = 50
): (() => void) => {
    const historyRef = collection(db, 'users', employeeId, 'pointsHistory');
    const q = query(historyRef, orderBy('timestamp', 'desc'), limit(historyLimit));

    return onSnapshot(q, (snapshot) => {
        const history = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as PointHistoryEntry[];

        callback(history);
    });
};

/**
 * Get points icon based on action
 */
export const getPointsIcon = (points: number): string => {
    if (points > 0) return '🟢';
    if (points < 0) return '🔴';
    return '⚪';
};

/**
 * Format points for display
 */
export const formatPoints = (points: number): string => {
    if (points > 0) return `+${points}`;
    return String(points);
};
