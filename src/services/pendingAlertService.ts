/**
 * Pending Alert Service
 * Sound and haptic alerts for pending/new requests
 * Adora Hotel Management System V2
 */

import {
    collection,
    query,
    where,
    onSnapshot,
    Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { playSound, hapticFeedback } from './soundService';

// ============================================================
// TYPES
// ============================================================

export interface PendingAlertConfig {
    enabled: boolean;
    soundEnabled: boolean;
    notificationsEnabled: boolean; // Browser notifications
    vibrationEnabled: boolean;
    repeatIntervalMs: number;  // Repeat alert every X ms for pending items
    soundName: string;
}

export interface PendingRequest {
    id: string;
    roomNumber: string;
    serviceType: string;
    createdAt: Date;
    priority: 'normal' | 'urgent';
}

type PendingCallback = (requests: PendingRequest[]) => void;

// ============================================================
// STATE
// ============================================================

const DEFAULT_CONFIG: PendingAlertConfig = {
    enabled: true,
    soundEnabled: true,
    notificationsEnabled: true,
    vibrationEnabled: true,
    repeatIntervalMs: 30000, // 30 seconds
    soundName: 'notification',
};

let unsubscribe: Unsubscribe | null = null;
let repeatInterval: ReturnType<typeof setInterval> | null = null;
let pendingRequests: PendingRequest[] = [];
let callbacks: PendingCallback[] = [];
let currentConfig = DEFAULT_CONFIG;
let lastAlertedIds: Set<string> = new Set();

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Start monitoring for pending requests
 * ✅ SaaS: Added tenantId parameter for data isolation
 */
export function startPendingAlerts(
    branchId: string,
    tenantId: string,
    department: string,
    config: Partial<PendingAlertConfig> = {}
): void {
    currentConfig = { ...DEFAULT_CONFIG, ...config };

    // Stop existing monitoring
    stopPendingAlerts();

    if (!currentConfig.enabled) return;

    // Build query based on department
    const requestsRef = collection(db, 'requests');
    let q;

    if (department === 'reception') {
        q = query(
            requestsRef,
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('currentDepartment', '==', 'reception'),
            where('status', 'in', ['PENDING', 'PENDING_RECEPTION'])
        );
    } else {
        q = query(
            requestsRef,
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('currentDepartment', '==', department),
            where('status', '==', 'CONFIRMED')
        );
    }

    unsubscribe = onSnapshot(q, (snapshot) => {
        const newRequests: PendingRequest[] = [];
        const newIds: Set<string> = new Set();

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            newIds.add(doc.id);
            newRequests.push({
                id: doc.id,
                roomNumber: data.roomNumber,
                serviceType: data.serviceType || data.type,
                createdAt: data.createdAt?.toDate() || new Date(),
                priority: data.priority || 'normal',
            });
        });

        // Check for new requests
        const trulyNew = newRequests.filter(r => !lastAlertedIds.has(r.id));

        if (trulyNew.length > 0) {
            // Alert for new requests
            alertNewRequests(trulyNew);
            trulyNew.forEach(r => lastAlertedIds.add(r.id));
        }

        // Clean up removed IDs from lastAlertedIds
        lastAlertedIds.forEach(id => {
            if (!newIds.has(id)) {
                lastAlertedIds.delete(id);
            }
        });

        pendingRequests = newRequests;
        callbacks.forEach(cb => cb(pendingRequests));
    });

    // Start repeat alerts for pending items
    if (currentConfig.repeatIntervalMs > 0) {
        repeatInterval = setInterval(() => {
            if (pendingRequests.length > 0) {
                repeatAlert();
            }
        }, currentConfig.repeatIntervalMs);
    }

    console.log(`🔔 Pending alerts started for ${department}`);
}

/**
 * Stop monitoring
 */
export function stopPendingAlerts(): void {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    if (repeatInterval) {
        clearInterval(repeatInterval);
        repeatInterval = null;
    }
    pendingRequests = [];
    lastAlertedIds.clear();
}

// ============================================================
// ALERT LOGIC
// ============================================================

function alertNewRequests(requests: PendingRequest[]): void {
    if (!currentConfig.enabled) return;

    const hasUrgent = requests.some(r => r.priority === 'urgent');

    // Sound alert
    if (currentConfig.soundEnabled) {
        playSound?.(hasUrgent ? 'warning' : 'notification');
    }

    // Haptic feedback
    if (currentConfig.vibrationEnabled) {
        hapticFeedback?.(hasUrgent ? 'heavy' : 'medium');
    }

    // Show in-app notification
    showPendingNotification(requests.length, hasUrgent);

    // Browser notification (only if enabled in config)
    if (currentConfig.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(hasUrgent ? '🚨 طلب عاجل!' : '🔔 طلب جديد', {
            body: `${requests.length} طلب جديد بانتظار الإجراء`,
            icon: '/icon-192.png',
            tag: 'pending-request',
        });
    }
}

function repeatAlert(): void {
    if (!currentConfig.enabled || pendingRequests.length === 0) return;

    const urgentCount = pendingRequests.filter(r => r.priority === 'urgent').length;

    // Subtle sound for repeat
    if (currentConfig.soundEnabled && urgentCount > 0) {
        playSound?.('notification');
    }

    // Light vibration for repeat
    if (currentConfig.vibrationEnabled) {
        hapticFeedback?.('light');
    }
}

// ============================================================
// UI NOTIFICATIONS
// ============================================================

function showPendingNotification(count: number, urgent: boolean): void {
    const notification = document.createElement('div');
    notification.className = 'pending-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: 600;
        z-index: 9999;
        animation: bounceIn 0.5s ease;
        display: flex;
        align-items: center;
        gap: 12px;
        ${urgent
            ? 'background: linear-gradient(135deg, #EF4444, #DC2626); color: white;'
            : 'background: linear-gradient(135deg, #3B82F6, #2563EB); color: white;'
        }
    `;

    notification.innerHTML = `
        <span style="font-size: 1.5rem;">${urgent ? '🚨' : '🔔'}</span>
        <div>
            <div>${count} طلب جديد</div>
            ${urgent ? '<div style="font-size: 0.85rem; opacity: 0.9;">يتطلب اهتمام فوري</div>' : ''}
        </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// ============================================================
// CALLBACKS
// ============================================================

export function onPendingUpdate(callback: PendingCallback): () => void {
    callbacks.push(callback);
    return () => {
        callbacks = callbacks.filter(cb => cb !== callback);
    };
}

// ============================================================
// CONFIGURATION
// ============================================================

export function updateConfig(config: Partial<PendingAlertConfig>): void {
    currentConfig = { ...currentConfig, ...config };
}

export function toggleAlerts(enabled: boolean): void {
    currentConfig.enabled = enabled;
}

export function toggleSound(enabled: boolean): void {
    currentConfig.soundEnabled = enabled;
}

export function toggleNotifications(enabled: boolean): void {
    currentConfig.notificationsEnabled = enabled;
}

// ============================================================
// STATUS
// ============================================================

export function getPendingCount(): number {
    return pendingRequests.length;
}

export function getUrgentCount(): number {
    return pendingRequests.filter(r => r.priority === 'urgent').length;
}

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect } from 'react';

export function usePendingAlerts(
    branchId: string,
    department: string,
    config?: Partial<PendingAlertConfig> & { tenantId?: string }
) {
    const [pending, setPending] = useState<PendingRequest[]>([]);

    useEffect(() => {
        if (!branchId || !department || !config?.tenantId) return;

        startPendingAlerts(branchId, config.tenantId, department, config);

        const unsubscribe = onPendingUpdate(setPending);

        return () => {
            unsubscribe();
            stopPendingAlerts();
        };
    }, [branchId, department, config?.tenantId]);

    return {
        pendingRequests: pending,
        pendingCount: pending.length,
        urgentCount: pending.filter(r => r.priority === 'urgent').length,
        toggleAlerts,
        toggleSound,
    };
}

// ============================================================
// REQUEST NOTIFICATION PERMISSION
// ============================================================

export async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;

    if (Notification.permission === 'granted') return true;

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
}

export default {
    startPendingAlerts,
    stopPendingAlerts,
    onPendingUpdate,
    updateConfig,
    toggleAlerts,
    toggleSound,
    getPendingCount,
    getUrgentCount,
    usePendingAlerts,
    requestNotificationPermission,
};
