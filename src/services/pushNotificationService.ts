/**
 * Push Notification Service
 * Firebase Cloud Messaging integration
 * Adora Hotel Management System V2
 */

import { getMessaging, getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getVapidKey } from './systemConfigsService';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface NotificationData {
    title: string;
    body: string;
    icon?: string;
    click_action?: string;
    data?: Record<string, string>;
}

export type NotificationTopic =
    | 'all'
    | 'reception'
    | 'housekeeping'
    | 'maintenance'
    | 'bellman'
    | 'procurement'
    | 'managers';

// ============================================================
// STATE
// ============================================================

let messaging: ReturnType<typeof getMessaging> | null = null;
let currentToken: string | null = null;
let onMessageCallback: ((payload: MessagePayload) => void) | null = null;

// VAPID Key - loaded dynamically from system_configs
let VAPID_KEY: string | null = null;

// Load VAPID key from system configs
const loadVapidKey = async (): Promise<string> => {
    if (!VAPID_KEY) {
        VAPID_KEY = await getVapidKey();
    }
    return VAPID_KEY || '';
};

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize Firebase Cloud Messaging
 */
export const initPushNotifications = async (): Promise<boolean> => {
    try {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            logger.warn('Push notifications not supported', undefined, 'pushNotificationService');
            return false;
        }

        // Check permission
        if (Notification.permission === 'denied') {
            logger.warn('Push notifications denied by user', undefined, 'pushNotificationService');
            return false;
        }

        // Get messaging instance
        messaging = getMessaging();

        // Request permission if not granted
        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                return false;
            }
        }

        // Get VAPID key dynamically
        const vapidKey = await loadVapidKey();
        if (!vapidKey) {
            logger.warn('No VAPID key configured - push notifications disabled', undefined, 'pushNotificationService');
            return false;
        }

        // Get FCM token
        currentToken = await getToken(messaging, { vapidKey });

        if (currentToken) {
            logger.info('✅ Push notifications initialized', undefined, 'pushNotificationService');
            return true;
        }

        return false;
    } catch (error) {
        logger.error('Failed to initialize push notifications:', error, 'pushNotificationService');
        return false;
    }
};

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

/**
 * Get current FCM token
 */
export const getFCMToken = (): string | null => currentToken;

/**
 * Save token to Firestore for user
 */
export const saveTokenForUser = async (userId: string, department: string): Promise<void> => {
    if (!currentToken) return;

    await setDoc(doc(db, 'fcm_tokens', userId), {
        token: currentToken,
        userId,
        department,
        updatedAt: serverTimestamp(),
        platform: 'web',
    });
};

/**
 * Remove token from Firestore
 */
export const removeTokenForUser = async (userId: string): Promise<void> => {
    // Token will be automatically invalidated
    // Could also delete from Firestore if needed
};

// ============================================================
// MESSAGE HANDLING
// ============================================================

/**
 * Set foreground message handler
 */
export const setMessageHandler = (callback: (payload: MessagePayload) => void): void => {
    onMessageCallback = callback;

    if (messaging) {
        onMessage(messaging, (payload) => {
            logger.info('📩 Message received:', payload, 'pushNotificationService');

            // Show browser notification if app is in foreground
            if (payload.notification) {
                showBrowserNotification({
                    title: payload.notification.title || 'Adora',
                    body: payload.notification.body || '',
                    icon: payload.notification.icon,
                });
            }

            // Call custom handler
            onMessageCallback?.(payload);
        });
    }
};

// ============================================================
// BROWSER NOTIFICATIONS
// ============================================================

/**
 * Show browser notification
 */
export const showBrowserNotification = (data: NotificationData): void => {
    if (Notification.permission !== 'granted') return;

    const notification = new Notification(data.title, {
        body: data.body,
        icon: data.icon || '/icon-192x192.png',
        badge: '/icon-72x72.png',
        tag: 'adora-notification',
    });

    notification.onclick = () => {
        window.focus();
        if (data.click_action) {
            window.location.href = data.click_action;
        }
        notification.close();
    };
};

// ============================================================
// LOCAL NOTIFICATIONS (Fallback)
// ============================================================

/**
 * Show local notification (for in-app use)
 */
export const showLocalNotification = (data: NotificationData): void => {
    // Dispatch custom event for in-app notification component
    window.dispatchEvent(new CustomEvent('adora:notification', {
        detail: data,
    }));
};

// ============================================================
// PERMISSION
// ============================================================

/**
 * Check notification permission status
 */
export const getNotificationPermission = (): NotificationPermission => {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
};

/**
 * Request notification permission
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect, useCallback } from 'react';

export const usePushNotifications = () => {
    const [permission, setPermission] = useState<NotificationPermission>(
        getNotificationPermission()
    );
    const [token, setToken] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<MessagePayload[]>([]);

    useEffect(() => {
        const init = async () => {
            const success = await initPushNotifications();
            if (success) {
                setToken(getFCMToken());
                setPermission('granted');
            }
        };

        init();
    }, []);

    useEffect(() => {
        setMessageHandler((payload) => {
            setNotifications(prev => [payload, ...prev].slice(0, 50));
        });
    }, []);

    const requestPermission = useCallback(async () => {
        const granted = await requestNotificationPermission();
        if (granted) {
            setPermission('granted');
            const success = await initPushNotifications();
            if (success) {
                setToken(getFCMToken());
            }
        }
        return granted;
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    return {
        permission,
        token,
        notifications,
        requestPermission,
        clearNotifications,
        showNotification: showLocalNotification,
    };
};

// ============================================================
// SEND PUSH NOTIFICATION
// ============================================================

/**
 * Send push notification to a specific FCM token
 * Used for sending notifications to users (e.g., support ticket responses)
 */
export const sendPushNotification = async (
    fcmToken: string,
    data: NotificationData
): Promise<void> => {
    try {
        if (!db) {
            logger.warn('Firebase not initialized, cannot send push notification', undefined, 'pushNotificationService');
            return;
        }

        // Store notification in Firestore for delivery via Cloud Functions
        // Cloud Function will handle actual FCM sending
        await addDoc(collection(db, 'notification_queue'), {
            token: fcmToken,
            title: data.title,
            body: data.body,
            icon: data.icon || '/icon-192x192.png',
            click_action: data.click_action,
            data: data.data || {},
            createdAt: serverTimestamp(),
            status: 'pending'
        });

        // Also show local notification immediately (for same-device notifications)
        showLocalNotification(data);
    } catch (error) {
        logger.error('Error sending push notification:', error, 'pushNotificationService');
        // Fallback: show local notification even if Firestore fails
        showLocalNotification(data);
    }
};

export default {
    initPushNotifications,
    getFCMToken,
    saveTokenForUser,
    setMessageHandler,
    showBrowserNotification,
    showLocalNotification,
    getNotificationPermission,
    requestNotificationPermission,
    usePushNotifications,
    sendPushNotification,
};
