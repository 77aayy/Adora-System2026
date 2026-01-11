/**
 * Room History Service
 * Track all activities for each room
 * Adora Hotel Management System V2
 */

import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';

// ============================================================
// TYPES
// ============================================================

export type RoomEventType =
    | 'CHECKIN'
    | 'CHECKOUT'
    | 'CLEANING_START'
    | 'CLEANING_COMPLETE'
    | 'MAINTENANCE_START'
    | 'MAINTENANCE_COMPLETE'
    | 'INSPECTION'
    | 'GUEST_REQUEST'
    | 'STATUS_CHANGE';

export interface RoomHistoryEntry {
    id?: string;
    roomNumber: string;
    eventType: RoomEventType;
    description: string;
    performedBy: string;
    performedByName: string;
    guestName?: string;
    details?: Record<string, unknown>;
    timestamp: Date;
}

// ============================================================
// COLLECTION
// ============================================================

const ROOM_HISTORY_COLLECTION = 'roomHistory';

// ============================================================
// FUNCTIONS
// ============================================================

/**
 * Log a room event
 */
export const logRoomEvent = async (
    roomNumber: string,
    eventType: RoomEventType,
    description: string,
    performedBy: string,
    performedByName: string,
    guestName?: string,
    details?: Record<string, unknown>
): Promise<void> => {
    try {
        const historyRef = collection(db, ROOM_HISTORY_COLLECTION);

        await addDoc(historyRef, {
            roomNumber,
            eventType,
            description,
            performedBy,
            performedByName,
            guestName,
            details,
            timestamp: Timestamp.now(),
        });
    } catch (error) {
        console.error('Failed to log room event:', error);
    }
};

/**
 * Get history for a specific room
 */
export const getRoomHistory = async (
    roomNumber: string,
    limitCount = 50
): Promise<RoomHistoryEntry[]> => {
    try {
        const historyRef = collection(db, ROOM_HISTORY_COLLECTION);
        const q = query(
            historyRef,
            where('roomNumber', '==', roomNumber),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as RoomHistoryEntry[];
    } catch (error) {
        console.error('Failed to get room history:', error);
        return [];
    }
};

/**
 * Get recent history across all rooms
 */
export const getRecentHistory = async (limitCount = 100): Promise<RoomHistoryEntry[]> => {
    try {
        const historyRef = collection(db, ROOM_HISTORY_COLLECTION);
        const q = query(historyRef, orderBy('timestamp', 'desc'), limit(limitCount));

        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as RoomHistoryEntry[];
    } catch (error) {
        console.error('Failed to get recent history:', error);
        return [];
    }
};

/**
 * Get event type label in Arabic
 */
export const getEventTypeLabel = (eventType: RoomEventType): string => {
    const labels: Record<RoomEventType, string> = {
        CHECKIN: 'تسجيل دخول',
        CHECKOUT: 'تسجيل خروج',
        CLEANING_START: 'بدء التنظيف',
        CLEANING_COMPLETE: 'إتمام التنظيف',
        MAINTENANCE_START: 'بدء الصيانة',
        MAINTENANCE_COMPLETE: 'إتمام الصيانة',
        INSPECTION: 'فحص',
        GUEST_REQUEST: 'طلب نزيل',
        STATUS_CHANGE: 'تغيير الحالة',
    };
    return labels[eventType];
};

/**
 * Get event type color
 */
export const getEventTypeColor = (eventType: RoomEventType): string => {
    const colors: Record<RoomEventType, string> = {
        CHECKIN: 'green',
        CHECKOUT: 'blue',
        CLEANING_START: 'yellow',
        CLEANING_COMPLETE: 'green',
        MAINTENANCE_START: 'orange',
        MAINTENANCE_COMPLETE: 'green',
        INSPECTION: 'purple',
        GUEST_REQUEST: 'primary',
        STATUS_CHANGE: 'gray',
    };
    return colors[eventType];
};
