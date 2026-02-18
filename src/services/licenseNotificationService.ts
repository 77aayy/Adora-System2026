/**
 * License Notification Service
 * Automatic notifications before license expiry
 * Adora Hotel Management System V3
 */

import { collection, query, where, getDocs, Timestamp, addDoc, getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { getRemainingLicenseDays } from './ownerService';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface LicenseNotification {
    tenantId: string;
    managerId: string;
    managerName: string;
    daysUntilExpiry: number;
    notificationType: '30days' | '7days' | 'expired' | 'day';
    message: string;
    notifiedAt: Date;
    notified: boolean;
}

export interface LicenseNotificationConfig {
    notifyAt30Days: boolean;
    notifyAt7Days: boolean;
    notifyAt1Day: boolean;
    notifyOnExpiry: boolean;
}

// ============================================================
// NOTIFICATION CHECK
// ============================================================

/**
 * Check if license needs notification
 */
export function shouldNotifyLicenseExpiry(
    daysUntilExpiry: number,
    lastNotifiedDays?: number | null
): {
    shouldNotify: boolean;
    notificationType: '30days' | '7days' | 'day' | 'expired';
    message: string;
} | null {
    // Already expired
    if (daysUntilExpiry <= 0) {
        // Only notify once per day for expired licenses
        if (lastNotifiedDays === null || lastNotifiedDays !== daysUntilExpiry) {
            return {
                shouldNotify: true,
                notificationType: 'expired',
                message: '⚠️ انتهت صلاحية الترخيص! يرجى التجديد فوراً لاستمرار الخدمة.',
            };
        }
        return null;
    }

    // Exactly 1 day left
    if (daysUntilExpiry === 1 && lastNotifiedDays !== 1) {
        return {
            shouldNotify: true,
            notificationType: 'day',
            message: '🔴 ينتهي الترخيص غداً! يرجى التجديد فوراً.',
        };
    }

    // Exactly 7 days left
    if (daysUntilExpiry === 7 && lastNotifiedDays !== 7) {
        return {
            shouldNotify: true,
            notificationType: '7days',
            message: `⚠️ سينتهي الترخيص خلال 7 أيام. يرجى التجديد قريباً.`,
        };
    }

    // Exactly 30 days left
    if (daysUntilExpiry === 30 && lastNotifiedDays !== 30) {
        return {
            shouldNotify: true,
            notificationType: '30days',
            message: `ℹ️ سينتهي الترخيص خلال 30 يوم. يرجى التخطيط للتجديد.`,
        };
    }

    return null;
}

// ============================================================
// NOTIFICATION RECORDING
// ============================================================

/**
 * Record that notification was sent
 * @security يتطلب Firebase Config مُحمّل
 */
export async function recordLicenseNotification(
    tenantId: string,
    managerId: string,
    notificationType: '30days' | '7days' | 'day' | 'expired',
    daysUntilExpiry: number
): Promise<void> {
    if (!db) {
        logger.warn('recordLicenseNotification skipped: Firebase not configured', undefined, 'licenseNotificationService');
        return;
    }
    try {
        const notificationsRef = collection(db, 'licenseNotifications');
        const snapshot = await getDocs(
            query(
                notificationsRef,
                where('tenantId', '==', tenantId),
                where('managerId', '==', managerId),
                where('notificationType', '==', notificationType),
                where('daysUntilExpiry', '==', daysUntilExpiry)
            )
        );
        
        // Only record if not already notified for this exact day
        if (snapshot.empty) {
            // ✅ Try to get manager name for better display
            let managerName = 'غير معروف';
            try {
                const managerDoc = await getDoc(doc(db, 'users', managerId));
                if (managerDoc.exists()) {
                    managerName = managerDoc.data().name || 'غير معروف';
                }
            } catch (err) {
                // Ignore error - use default name
            }
            
            // Use addDoc instead of setDoc to allow multiple notifications
            await addDoc(notificationsRef, {
                tenantId,
                managerId,
                managerName, // ✅ Store manager name for faster retrieval
                notificationType,
                daysUntilExpiry,
                message: '', // Will be generated in widget if missing
                notifiedAt: Timestamp.now(),
                notified: true,
            });
        }
    } catch (error) {
        logger.error('Failed to record license notification', error, 'licenseNotificationService');
    }
}

/**
 * Get last notification for a manager
 * @security يتطلب Firebase Config مُحمّل
 */
export async function getLastNotification(
    tenantId: string,
    managerId: string
): Promise<{ daysUntilExpiry: number | null; notifiedAt: Date | null } | null> {
    if (!db) {
        logger.warn('getLastNotification skipped: Firebase not configured', undefined, 'licenseNotificationService');
        return null;
    }
    try {
        const notificationsRef = collection(db, 'licenseNotifications');
        const snapshot = await getDocs(
            query(
                notificationsRef,
                where('tenantId', '==', tenantId),
                where('managerId', '==', managerId)
            )
        );

        if (snapshot.empty) return { daysUntilExpiry: null, notifiedAt: null };

        // Get most recent notification
        const notifications = snapshot.docs.map((doc) => ({
            ...doc.data(),
            notifiedAt: doc.data().notifiedAt?.toDate() || new Date(),
        }));

        const mostRecent = notifications.sort(
            (a, b) => (b.notifiedAt as Date).getTime() - (a.notifiedAt as Date).getTime()
        )[0];

        return {
            daysUntilExpiry: mostRecent.daysUntilExpiry || null,
            notifiedAt: mostRecent.notifiedAt || null,
        };
    } catch (error: any) {
        // ✅ Handle permission errors gracefully (expected when not logged in as owner)
        const isPermissionError = error?.code === 'permission-denied' || 
                                  error?.message?.includes('permission') ||
                                  error?.message?.includes('Missing or insufficient');
        
        if (isPermissionError) {
            logger.debug('Permission denied for license notifications (expected for non-owners)', undefined, 'licenseNotificationService');
        } else {
            logger.error('Failed to get last notification', error, 'licenseNotificationService');
        }
        return null;
    }
}

// ============================================================
// AUTOMATIC CHECK FOR ALL MANAGERS
// ============================================================

/**
 * Check all managers for license expiry notifications
 */
export async function checkAllManagersLicenseExpiry(): Promise<LicenseNotification[]> {
    const notifications: LicenseNotification[] = [];

    // Guard: Skip if Firebase not initialized
    if (!db) {
        logger.debug('[LicenseNotificationScheduler] Skipped - Firebase not initialized', null, 'licenseNotificationService');
        return [];
    }

    try {
        // Get all active managers
        const managersRef = collection(db, 'users');
        const managersSnapshot = await getDocs(
            query(
                managersRef,
                where('role', '==', 'manager')
                // ✅ Remove licenseStatus filter to avoid query complexity - filter in code instead
            )
        );

        for (const managerDoc of managersSnapshot.docs) {
            const manager = managerDoc.data();
            const tenantId = manager.tenantId;
            const managerId = managerDoc.id;

            if (!tenantId || !manager.licenseExpiry) continue;

            const daysUntilExpiry = getRemainingLicenseDays(manager.licenseExpiry);
            if (daysUntilExpiry === null) continue;

            // Get last notification
            const lastNotification = await getLastNotification(tenantId, managerId);

            // Check if should notify
            const shouldNotify = shouldNotifyLicenseExpiry(
                daysUntilExpiry,
                lastNotification?.daysUntilExpiry || null
            );

            if (shouldNotify) {
                try {
                    // Record notification with manager name for faster retrieval
                    await recordLicenseNotification(
                        tenantId,
                        managerId,
                        shouldNotify.notificationType,
                        daysUntilExpiry
                    );
                    
                    // ✅ Also store full notification document with manager name
                    await addDoc(collection(db, 'licenseNotifications'), {
                        tenantId,
                        managerId,
                        managerName: manager.name || 'غير معروف',
                        daysUntilExpiry,
                        notificationType: shouldNotify.notificationType,
                        message: shouldNotify.message,
                        notifiedAt: Timestamp.now(),
                        notified: true,
                    });

                    notifications.push({
                        tenantId,
                        managerId,
                        managerName: manager.name || 'غير معروف',
                        daysUntilExpiry,
                        notificationType: shouldNotify.notificationType,
                        message: shouldNotify.message,
                        notifiedAt: new Date(),
                        notified: true,
                    });
                } catch (recordError) {
                    // ✅ Don't block if recording fails for one manager
                    logger.warn(`Failed to record notification for manager ${managerId}`, recordError, 'licenseNotificationService');
                }
            }
        }
    } catch (error) {
        logger.error('Failed to check all managers license expiry', error, 'licenseNotificationService');
    }

    return notifications;
}

// ============================================================
// SCHEDULED TASK INTEGRATION
// ============================================================

/**
 * Get notifications for owner dashboard
 */
export async function getLicenseNotificationsForOwner(): Promise<LicenseNotification[]> {
    return await checkAllManagersLicenseExpiry();
}

/**
 * Get notifications for manager (their own license)
 * @security يتطلب Firebase Config مُحمّل
 */
export async function getLicenseNotificationsForManager(tenantId: string, managerId: string): Promise<LicenseNotification[]> {
    const notifications: LicenseNotification[] = [];

    if (!db) {
        logger.warn('getLicenseNotificationsForManager skipped: Firebase not configured', undefined, 'licenseNotificationService');
        return notifications;
    }

    try {
        // Get manager document directly by ID
        const managerDocRef = doc(db, 'users', managerId);
        const managerDoc = await getDoc(managerDocRef);

        if (!managerDoc.exists()) return notifications;

        const manager = managerDoc.data();
        
        // Verify tenant ID matches
        if (manager.tenantId !== tenantId || manager.role !== 'manager') {
            return notifications;
        }
        
        if (!manager.licenseExpiry) return notifications;

        const daysUntilExpiry = getRemainingLicenseDays(manager.licenseExpiry);
        if (daysUntilExpiry === null) return notifications;

        // Get last notification
        const lastNotification = await getLastNotification(tenantId, managerId);

        // Check if should notify
        const shouldNotify = shouldNotifyLicenseExpiry(
            daysUntilExpiry,
            lastNotification?.daysUntilExpiry || null
        );

        if (shouldNotify) {
            notifications.push({
                tenantId,
                managerId,
                managerName: manager.name || 'غير معروف',
                daysUntilExpiry,
                notificationType: shouldNotify.notificationType,
                message: shouldNotify.message,
                notifiedAt: new Date(),
                notified: true,
            });
        }
    } catch (error) {
        logger.error('Failed to get license notifications for manager', error, 'licenseNotificationService');
    }

    return notifications;
}
