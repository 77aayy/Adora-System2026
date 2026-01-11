/**
 * Notification Service
 * Simple in-app notification system
 */

import {
    collection,
    addDoc,
    updateDoc,
    doc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    Timestamp,
    Unsubscribe,
    getDocs
} from 'firebase/firestore';
import { db } from './firebase';

export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    relatedRequestId?: string;
    createdAt: Timestamp;
}

const NOTIFICATIONS_COLLECTION = 'notifications';

/**
 * Send notification to user
 */
export const sendNotification = async (
    userId: string,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    relatedRequestId?: string
): Promise<void> => {
    try {
        await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
            userId,
            title,
            message,
            type,
            read: false,
            relatedRequestId,
            createdAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error sending notification:', error);
    }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (notificationId: string): Promise<void> => {
    try {
        const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
        await updateDoc(docRef, { read: true });
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId: string): Promise<void> => {
    try {
        const q = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where('userId', '==', userId),
            where('read', '==', false)
        );

        const snapshot = await getDocs(q);
        const updates = snapshot.docs.map(doc =>
            updateDoc(doc.ref, { read: true })
        );

        await Promise.all(updates);
    } catch (error) {
        console.error('Error marking all as read:', error);
    }
};

/**
 * Subscribe to user notifications
 */
export const subscribeToNotifications = (
    userId: string,
    callback: (notifications: Notification[]) => void,
    limitCount: number = 20
): Unsubscribe => {
    try {
        const q = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        return onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Notification));
            callback(notifications);
        }, (error) => {
            console.error('Error in notifications subscription:', error);
            callback([]);
        });
    } catch (error) {
        console.error('Error setting up notifications subscription:', error);
        return () => { };
    }
};

/**
 * Get unread count
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
    try {
        const q = query(
            collection(db, NOTIFICATIONS_COLLECTION),
            where('userId', '==', userId),
            where('read', '==', false)
        );

        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
};
