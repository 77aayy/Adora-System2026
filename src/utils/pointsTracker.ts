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
    t?: (key: string) => string; // Optional i18n function
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
 * Get reason text with i18n support
 * Note: This function should be called with t() from useTranslation hook
 * For backward compatibility, it returns English fallback if t is not provided
 */
export const getReasonText = (action: PointAction, details: PointDetails = {}, t?: (key: string) => string): string => {
    // If t is not provided, return action name (will be translated in component)
    if (!t) return action;
    
    const roomSuffix = details.roomNumber ? ` - ${t('points.room') || 'Room'} ${details.roomNumber}` : '';
    const delaySuffix = details.delayMinutes ? ` (${details.delayMinutes} ${t('points.minutes') || 'min'})` : '';
    const itemSuffix = details.itemName ? ` - ${details.itemName}` : '';
    const serviceSuffix = details.serviceType ? ` - ${details.serviceType}` : '';
    const rankSuffix = details.rank ? ` (${t('points.rank') || 'Rank'} ${details.rank})` : '';

    const reasons: Partial<Record<PointAction, string>> = {
        // Bellman
        checkin: t('points.checkin') + roomSuffix,
        checkout: t('points.checkout') + roomSuffix,
        complete_bellman: t('points.completeBellman') + roomSuffix,
        qr_response_delay: t('points.qrResponseDelay') + roomSuffix + delaySuffix,

        // Housekeeping
        start_cleaning: t('points.startCleaning') + roomSuffix,
        complete_cleaning: t('points.completeCleaning') + roomSuffix + (details.cleaningType === 'checkout' ? ` (${t('points.checkout')})` : ` (${t('points.stayover')})`),
        cleaning_delay: t('points.cleaningDelay') + roomSuffix + delaySuffix,

        // Maintenance
        complete_maintenance: t('points.completeMaintenance') + roomSuffix + (details.maintenanceType ? ` (${details.maintenanceType})` : ''),
        maintenance_delay: t('points.maintenanceDelay') + roomSuffix + delaySuffix,

        // Procurement
        purchase: t('points.purchase') + itemSuffix,
        receive: t('points.receive') + itemSuffix,
        procurement_delay: t('points.procurementDelay') + itemSuffix + delaySuffix,

        // Reception
        confirm_request: t('points.confirmRequest') + serviceSuffix + roomSuffix,
        complete_request: t('points.completeRequest') + serviceSuffix + roomSuffix,
        create_request: t('points.createRequest') + serviceSuffix + roomSuffix,

        // Inspection
        complete_inspection: t('points.completeInspection') + roomSuffix,

        // Ratings
        guest_rating_excellent: t('points.guestRatingExcellent') + serviceSuffix + roomSuffix,
        guest_rating_very_good: t('points.guestRatingVeryGood') + serviceSuffix + roomSuffix,
        guest_rating_good: t('points.guestRatingGood') + serviceSuffix + roomSuffix,
        guest_rating_fair: t('points.guestRatingFair') + serviceSuffix + roomSuffix,
        guest_rating_poor: t('points.guestRatingPoor') + serviceSuffix + roomSuffix,

        // Rewards
        daily_reward: t('points.dailyReward') + rankSuffix,
        weekly_reward: t('points.weeklyReward') + rankSuffix,
        monthly_reward: t('points.monthlyReward') + rankSuffix,
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
            reason: reason || getReasonText(action, details, options.t),
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
