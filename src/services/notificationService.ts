/**
 * Notification Service
 * Real-time notification system with Tenant Isolation & Push Notifications
 * Adora Hotel Management System
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
import { validateTenantId, validateTenantAccess } from './tenantSecurityService';
import { logger } from './loggerService';

export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    relatedRequestId?: string;
    department?: string;
    branchId?: string;
    createdAt: Timestamp;
}

/**
 * Send notification to user (Tenant-Isolated)
 * 🔐 SECURITY: Validates tenant access before sending
 */
export const sendNotification = async (
    userId: string,
    title: string,
    message: string,
    tenantId: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    relatedRequestId?: string,
    department?: string,
    branchId?: string
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot send notification', undefined, 'notificationService');
        return;
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ Use tenant-scoped collection
        const notificationsRef = collection(db, `tenants/${validatedTenantId}/notifications`);
        await addDoc(notificationsRef, {
            userId,
            title,
            message,
            type,
            read: false,
            relatedRequestId,
            department,
            branchId,
            createdAt: Timestamp.now()
        });

        // ✅ Send Push Notification (Browser Notifications API)
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    body: message,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                    tag: relatedRequestId || `notification-${Date.now()}`,
                    requireInteraction: type === 'error' || type === 'warning'
                });
            } catch (pushError) {
                // Push notifications are optional, don't fail if they're not supported
                logger.warn('Failed to send push notification', pushError, 'notificationService');
            }
        }

        logger.info(`Notification sent to ${userId} in tenant ${validatedTenantId}`, undefined, 'notificationService');
    } catch (error) {
        logger.error('Error sending notification', error, 'notificationService');
    }
};

/**
 * Send notification to all staff members in a department
 * 🔐 SECURITY: Validates tenant access before sending
 */
export const sendNotificationToDepartment = async (
    department: 'housekeeping' | 'bellman' | 'maintenance' | 'reception' | 'procurement' | 'coffeeShop',
    title: string,
    message: string,
    tenantId: string,
    branchId: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    relatedRequestId?: string
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot send department notification', undefined, 'notificationService');
        return;
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ Get all staff members in the department
        const { getStaffByRole } = await import('./staffService');
        const staffMembers = await getStaffByRole(validatedTenantId, branchId, department);

        if (staffMembers.length === 0) {
            logger.warn(`No active staff found in department ${department}`, undefined, 'notificationService');
            return;
        }

        // ✅ Send notification to each staff member
        const notificationPromises = staffMembers.map(staff =>
            sendNotification(
                staff.id,
                title,
                message,
                validatedTenantId,
                type,
                relatedRequestId,
                department,
                branchId
            )
        );

        await Promise.all(notificationPromises);
        logger.info(`Notifications sent to ${staffMembers.length} staff members in ${department}`, undefined, 'notificationService');
    } catch (error) {
        logger.error('Error sending department notification', error, 'notificationService');
    }
};

/**
 * Request notification permission from user
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
        logger.warn('Browser does not support notifications', undefined, 'notificationService');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
};

/**
 * Mark notification as read (Tenant-Isolated)
 * 🔐 SECURITY: Validates tenant access before updating
 */
export const markAsRead = async (notificationId: string, tenantId: string): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot mark notification as read', undefined, 'notificationService');
        return;
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ Use tenant-scoped collection
        const docRef = doc(db, `tenants/${validatedTenantId}/notifications`, notificationId);
        await updateDoc(docRef, { read: true });
    } catch (error) {
        logger.error('Error marking notification as read', error, 'notificationService');
    }
};

/**
 * Mark all notifications as read for a user (Tenant-Isolated)
 * 🔐 SECURITY: Validates tenant access before updating
 */
export const markAllAsRead = async (userId: string, tenantId: string): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot mark all as read', undefined, 'notificationService');
        return;
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ Use tenant-scoped collection
        const q = query(
            collection(db, `tenants/${validatedTenantId}/notifications`),
            where('userId', '==', userId),
            where('read', '==', false)
        );

        const snapshot = await getDocs(q);
        const updates = snapshot.docs.map(doc =>
            updateDoc(doc.ref, { read: true })
        );

        await Promise.all(updates);
    } catch (error) {
        logger.error('Error marking all as read', error, 'notificationService');
    }
};

/**
 * Subscribe to user notifications (Tenant-Isolated, Real-time)
 * 🔐 SECURITY: Validates tenant access before subscribing
 */
export const subscribeToNotifications = (
    userId: string,
    tenantId: string,
    callback: (notifications: Notification[]) => void,
    limitCount: number = 20
): Unsubscribe => {
    if (!tenantId || tenantId.trim() === '') {
        logger.error('TenantId is required for subscribeToNotifications', undefined, 'notificationService');
        callback([]);
        return () => { };
    }

    if (!db) {
        logger.error('Firebase not initialized - cannot subscribe to notifications', undefined, 'notificationService');
        callback([]);
        return () => { };
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ Use tenant-scoped collection
        const q = query(
            collection(db, `tenants/${validatedTenantId}/notifications`),
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
            logger.error('Error in notifications subscription', error, 'notificationService');
            callback([]);
        });
    } catch (error) {
        logger.error('Error setting up notifications subscription', error, 'notificationService');
        return () => { };
    }
};

/**
 * Get unread count (Tenant-Isolated)
 * 🔐 SECURITY: Validates tenant access before querying
 */
export const getUnreadCount = async (userId: string, tenantId: string): Promise<number> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot get unread count', undefined, 'notificationService');
        return 0;
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ Use tenant-scoped collection
        const q = query(
            collection(db, `tenants/${validatedTenantId}/notifications`),
            where('userId', '==', userId),
            where('read', '==', false)
        );

        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        logger.error('Error getting unread count', error, 'notificationService');
        return 0;
    }
};
