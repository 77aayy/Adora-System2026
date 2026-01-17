/**
 * Emergency Alert Service
 * Manages urgent/emergency notifications for guests
 * Works even when page is in background
 * Adora Hotel Management System V2
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, Timestamp, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface EmergencyAlert {
    id: string;
    title: string;
    titleAr: string;
    message: string;
    messageAr: string;
    
    // Alert Type
    type: 'fire' | 'evacuation' | 'checkout_change' | 'maintenance' | 'weather' | 'security' | 'general';
    severity: 'critical' | 'high' | 'medium'; // critical = حريق/إخلاء، high = مهم جداً، medium = تنبيه
    
    // Display Settings
    showSound: boolean; // تشغيل صوت التنبيه
    soundType?: 'alert' | 'siren' | 'bell' | 'chime'; // نوع الصوت
    showNotification: boolean; // إظهار إشعار المتصفح
    autoShow: boolean; // إظهار تلقائي عند فتح الصفحة
    dismissible: boolean; // يمكن إغلاقه
    expiresAt?: any; // تاريخ انتهاء (اختياري)
    
    // Target
    targetRooms?: string[]; // غرف محددة (فارغ = جميع الغرف)
    branchId: string;
    tenantId: string;
    
    // Status
    isActive: boolean;
    createdAt: any;
    createdBy?: { id: string; name: string };
}

export interface EmergencyAlertRead {
    id: string;
    alertId: string;
    roomNumber: string;
    guestName?: string;
    readAt: any;
    dismissedAt?: any;
    branchId: string;
    tenantId: string;
}

// ============================================================
// ALERT MANAGEMENT
// ============================================================

/**
 * Get active emergency alerts for a room/branch
 */
export const getEmergencyAlerts = async (
    roomNumber: string,
    branchId: string,
    tenantId: string
): Promise<EmergencyAlert[]> => {
    try {
        const now = Timestamp.now();
        const q = query(
            collection(db, 'emergency_alerts'),
            where('branchId', '==', branchId),
            where('tenantId', '==', tenantId),
            where('isActive', '==', true)
        );

        const snapshot = await getDocs(q);
        const alerts: EmergencyAlert[] = [];

        snapshot.forEach(doc => {
            const data = doc.data() as EmergencyAlert;
            
            // Check if expired
            if (data.expiresAt) {
                const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                if (expiresAt < new Date()) {
                    return; // Skip expired alerts
                }
            }
            
            // Check if targeted to this room
            if (data.targetRooms && data.targetRooms.length > 0) {
                if (!data.targetRooms.includes(roomNumber)) {
                    return; // Skip if room not in target list
                }
            }
            
            alerts.push({
                id: doc.id,
                ...data
            });
        });

        // Sort by severity and creation time
        return alerts.sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2 };
            const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
            if (severityDiff !== 0) return severityDiff;
            
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return bTime.getTime() - aTime.getTime(); // Newest first
        });
    } catch (error) {
        logger.error('Error getting emergency alerts', error, 'emergencyAlertService');
        return [];
    }
};

/**
 * Subscribe to emergency alerts with real-time updates
 */
export const subscribeToEmergencyAlerts = (
    roomNumber: string,
    branchId: string,
    tenantId: string,
    callback: (alerts: EmergencyAlert[]) => void
): (() => void) => {
    const q = query(
        collection(db, 'emergency_alerts'),
        where('branchId', '==', branchId),
        where('tenantId', '==', tenantId),
        where('isActive', '==', true)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const alerts: EmergencyAlert[] = [];
            const now = new Date();

            snapshot.forEach(doc => {
                const data = doc.data() as EmergencyAlert;
                
                // Check if expired
                if (data.expiresAt) {
                    const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                    if (expiresAt < now) {
                        return; // Skip expired alerts
                    }
                }
                
                // Check if targeted to this room
                if (data.targetRooms && data.targetRooms.length > 0) {
                    if (!data.targetRooms.includes(roomNumber)) {
                        return; // Skip if room not in target list
                    }
                }
                
                alerts.push({
                    id: doc.id,
                    ...data
                });
            });

            // Sort by severity and creation time
            const sorted = alerts.sort((a, b) => {
                const severityOrder = { critical: 0, high: 1, medium: 2 };
                const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
                if (severityDiff !== 0) return severityDiff;
                
                const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return bTime.getTime() - aTime.getTime();
            });

            callback(sorted);
        },
        (error) => {
            logger.error('Error subscribing to emergency alerts', error, 'emergencyAlertService');
            callback([]);
        }
    );
};

/**
 * Create emergency alert
 */
export const createEmergencyAlert = async (
    alert: Omit<EmergencyAlert, 'id' | 'createdAt'>,
    userId: string,
    userName: string
): Promise<string> => {
    try {
        const alertData: Omit<EmergencyAlert, 'id'> = {
            ...alert,
            createdAt: Timestamp.now(),
            createdBy: { id: userId, name: userName }
        };

        const docRef = doc(collection(db, 'emergency_alerts'));
        await setDoc(docRef, alertData);

        return docRef.id;
    } catch (error) {
        logger.error('Error creating emergency alert', error, 'emergencyAlertService');
        throw error;
    }
};

/**
 * Update emergency alert
 */
export const updateEmergencyAlert = async (
    alertId: string,
    updates: Partial<EmergencyAlert>,
    userId: string,
    userName: string
): Promise<void> => {
    try {
        const alertRef = doc(db, 'emergency_alerts', alertId);
        await updateDoc(alertRef, {
            ...updates,
            updatedAt: Timestamp.now(),
            updatedBy: { id: userId, name: userName }
        });
    } catch (error) {
        logger.error('Error updating emergency alert', error, 'emergencyAlertService');
        throw error;
    }
};

/**
 * Delete/Deactivate emergency alert
 */
export const deactivateEmergencyAlert = async (alertId: string): Promise<void> => {
    try {
        await updateDoc(doc(db, 'emergency_alerts', alertId), {
            isActive: false,
            deactivatedAt: Timestamp.now()
        });
    } catch (error) {
        logger.error('Error deactivating emergency alert', error, 'emergencyAlertService');
        throw error;
    }
};

/**
 * Mark alert as read
 */
export const markAlertAsRead = async (
    alertId: string,
    roomNumber: string,
    branchId: string,
    tenantId: string,
    guestName?: string
): Promise<void> => {
    try {
        // Check if already read
        const q = query(
            collection(db, 'emergency_alert_reads'),
            where('alertId', '==', alertId),
            where('roomNumber', '==', roomNumber),
            where('branchId', '==', branchId),
            where('tenantId', '==', tenantId)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Update existing read
            await updateDoc(doc(db, 'emergency_alert_reads', snapshot.docs[0].id), {
                readAt: Timestamp.now()
            });
        } else {
            // Create new read
            const readData: Omit<EmergencyAlertRead, 'id'> = {
                alertId,
                roomNumber,
                guestName,
                readAt: Timestamp.now(),
                branchId,
                tenantId
            };
            await addDoc(collection(db, 'emergency_alert_reads'), readData);
        }
    } catch (error) {
        logger.error('Error marking alert as read', error, 'emergencyAlertService');
    }
};

/**
 * Dismiss alert
 */
export const dismissAlert = async (
    alertId: string,
    roomNumber: string,
    branchId: string,
    tenantId: string
): Promise<void> => {
    try {
        const q = query(
            collection(db, 'emergency_alert_reads'),
            where('alertId', '==', alertId),
            where('roomNumber', '==', roomNumber),
            where('branchId', '==', branchId),
            where('tenantId', '==', tenantId)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            await updateDoc(doc(db, 'emergency_alert_reads', snapshot.docs[0].id), {
                dismissedAt: Timestamp.now()
            });
        } else {
            // Create new dismiss record
            const readData: Omit<EmergencyAlertRead, 'id'> = {
                alertId,
                roomNumber,
                readAt: Timestamp.now(),
                dismissedAt: Timestamp.now(),
                branchId,
                tenantId
            };
            await addDoc(collection(db, 'emergency_alert_reads'), readData);
        }
    } catch (error) {
        logger.error('Error dismissing alert', error, 'emergencyAlertService');
    }
};

/**
 * Get read status for alerts
 */
export const getAlertReadStatus = async (
    roomNumber: string,
    branchId: string,
    tenantId: string
): Promise<Record<string, EmergencyAlertRead>> => {
    try {
        const q = query(
            collection(db, 'emergency_alert_reads'),
            where('roomNumber', '==', roomNumber),
            where('branchId', '==', branchId),
            where('tenantId', '==', tenantId)
        );

        const snapshot = await getDocs(q);
        const reads: Record<string, EmergencyAlertRead> = {};

        snapshot.forEach(doc => {
            const data = doc.data() as EmergencyAlertRead;
            reads[data.alertId] = {
                id: doc.id,
                ...data
            };
        });

        return reads;
    } catch (error) {
        logger.error('Error getting alert read status', error, 'emergencyAlertService');
        return {};
    }
};

// ============================================================
// NOTIFICATION HELPERS
// ============================================================

/**
 * Request notification permission
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
        logger.warn('This browser does not support notifications', null, 'emergencyAlertService');
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
 * Show browser notification
 */
export const showBrowserNotification = (
    title: string,
    options: NotificationOptions = {}
): Notification | null => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return null;
    }

    const notification = new Notification(title, {
        icon: '/adora-logo.png',
        badge: '/adora-logo.png',
        requireInteraction: true, // Stay until user interacts
        ...options
    });

    notification.onclick = () => {
        window.focus();
        notification.close();
    };

    return notification;
};

/**
 * Play alert sound
 */
export const playAlertSound = (soundType: 'alert' | 'siren' | 'bell' | 'chime' = 'alert'): void => {
    try {
        // Create audio context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        let frequency = 800;
        let duration = 0.3;
        
        switch (soundType) {
            case 'siren':
                // Siren sound (alternating frequencies)
                let sirenCount = 0;
                const sirenInterval = setInterval(() => {
                    const osc = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    osc.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    osc.frequency.value = sirenCount % 2 === 0 ? 600 : 1000;
                    osc.type = 'sine';
                    
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                    
                    osc.start(audioContext.currentTime);
                    osc.stop(audioContext.currentTime + 0.3);
                    
                    sirenCount++;
                    if (sirenCount >= 6) {
                        clearInterval(sirenInterval);
                    }
                }, 300);
                return;
            case 'bell':
                frequency = 1000;
                duration = 0.5;
                break;
            case 'chime':
                frequency = 600;
                duration = 0.2;
                break;
            default:
                frequency = 800;
                duration = 0.3;
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        logger.error('Error playing alert sound', error, 'emergencyAlertService');
    }
};
