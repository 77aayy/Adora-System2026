/**
 * Notification Badge Service
 * Manage notification counts and badges
 * Adora Hotel Management System V2
 */

import { db } from './firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

interface NotificationCount {
    total: number;
    pending: number;
    urgent: number;
    unread: number;
}

interface BadgeConfig {
    showZero?: boolean;
    maxCount?: number;
    pulse?: boolean;
    color?: 'red' | 'orange' | 'green' | 'blue';
}

// ============================================================
// STATE
// ============================================================

let counts: NotificationCount = {
    total: 0,
    pending: 0,
    urgent: 0,
    unread: 0
};

let listeners: ((counts: NotificationCount) => void)[] = [];
let unsubscribers: (() => void)[] = [];

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize badge service
 */
export const initBadgeService = (
    userId: string,
    branch: string,
    department: string
): void => {
    // Subscribe to pending requests
    const requestsQuery = query(
        collection(db, 'requests'),
        where('branch', '==', branch),
        where('status', 'in', ['PENDING', 'CONFIRMED']),
        orderBy('createdAt', 'desc')
    );

    const unsubRequests = onSnapshot(requestsQuery, snapshot => {
        const docs = snapshot.docs.map(d => d.data());

        // Filter by department if not reception
        const filtered = department === 'reception'
            ? docs
            : docs.filter(d => d.department === department || d.assignedTo?.id === userId);

        counts.pending = filtered.filter(d => d.status === 'PENDING').length;
        counts.urgent = filtered.filter(d => d.priority === 'urgent' || d.priority === 'high').length;
        counts.total = filtered.length;

        notifyListeners();
        updateDocumentBadge();
    });

    unsubscribers.push(unsubRequests);

    // Subscribe to unread notifications
    const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
    );

    const unsubNotifications = onSnapshot(notificationsQuery, snapshot => {
        counts.unread = snapshot.size;
        notifyListeners();
        updateDocumentBadge();
    });

    unsubscribers.push(unsubNotifications);

    console.log('✅ Badge service initialized');
};

/**
 * Cleanup
 */
export const destroyBadgeService = (): void => {
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
    listeners = [];
};

// ============================================================
// DOCUMENT BADGE
// ============================================================

/**
 * Update document title badge
 */
const updateDocumentBadge = (): void => {
    const total = counts.pending + counts.unread;
    const baseTitle = 'أدورا - نظام إدارة الفندق';

    if (total > 0) {
        document.title = `(${total > 99 ? '99+' : total}) ${baseTitle}`;
    } else {
        document.title = baseTitle;
    }

    // Update PWA badge if supported
    updatePWABadge(total);
};

/**
 * Update PWA app badge
 */
const updatePWABadge = async (count: number): Promise<void> => {
    if ('setAppBadge' in navigator) {
        try {
            if (count > 0) {
                await (navigator as any).setAppBadge(count);
            } else {
                await (navigator as any).clearAppBadge();
            }
        } catch {
            // Badge API not supported or failed
        }
    }
};

// ============================================================
// LISTENERS
// ============================================================

/**
 * Subscribe to count changes
 */
export const subscribeToCounts = (callback: (counts: NotificationCount) => void): (() => void) => {
    listeners.push(callback);
    callback(counts);

    return () => {
        listeners = listeners.filter(l => l !== callback);
    };
};

/**
 * Notify all listeners
 */
const notifyListeners = (): void => {
    listeners.forEach(l => l(counts));
};

// ============================================================
// GETTERS
// ============================================================

/**
 * Get current counts
 */
export const getCounts = (): NotificationCount => {
    return { ...counts };
};

/**
 * Get pending count
 */
export const getPendingCount = (): number => {
    return counts.pending;
};

/**
 * Get urgent count
 */
export const getUrgentCount = (): number => {
    return counts.urgent;
};

/**
 * Get unread count
 */
export const getUnreadCount = (): number => {
    return counts.unread;
};

// ============================================================
// BADGE RENDERING
// ============================================================

/**
 * Create badge element
 */
export const createBadge = (count: number, config: BadgeConfig = {}): HTMLElement => {
    const badge = document.createElement('span');

    const displayCount = config.maxCount && count > config.maxCount
        ? `${config.maxCount}+`
        : String(count);

    const colorClass = {
        red: 'bg-red-500',
        orange: 'bg-orange-500',
        green: 'bg-green-500',
        blue: 'bg-primary-500'
    }[config.color || 'red'];

    badge.className = `
        inline-flex items-center justify-center
        min-w-[20px] h-5 px-1.5
        text-xs font-bold text-white
        ${colorClass}
        rounded-full
        ${config.pulse ? 'animate-pulse' : ''}
        ${count === 0 && !config.showZero ? 'hidden' : ''}
    `;

    badge.textContent = displayCount;

    return badge;
};

/**
 * Update existing badge
 */
export const updateBadge = (element: HTMLElement, count: number, config: BadgeConfig = {}): void => {
    const displayCount = config.maxCount && count > config.maxCount
        ? `${config.maxCount}+`
        : String(count);

    element.textContent = displayCount;

    if (count === 0 && !config.showZero) {
        element.classList.add('hidden');
    } else {
        element.classList.remove('hidden');
    }

    if (config.pulse && count > 0) {
        element.classList.add('animate-pulse');
    } else {
        element.classList.remove('animate-pulse');
    }
};

// ============================================================
// NAVIGATION BADGES
// ============================================================

/**
 * Update navigation item badge
 */
export const updateNavBadge = (navItemId: string, count: number): void => {
    const navItem = document.getElementById(navItemId);
    if (!navItem) return;

    let badge = navItem.querySelector('.nav-badge') as HTMLElement;

    if (!badge && count > 0) {
        badge = createBadge(count, { maxCount: 99, color: 'red' });
        badge.className += ' nav-badge absolute -top-1 -right-1';
        navItem.style.position = 'relative';
        navItem.appendChild(badge);
    } else if (badge) {
        updateBadge(badge, count, { maxCount: 99 });
    }
};

// ============================================================
// SOUND NOTIFICATION
// ============================================================

/**
 * Play notification sound when count increases
 */
let lastTotal = 0;

const checkForNewNotifications = (): void => {
    const newTotal = counts.total + counts.unread;

    if (newTotal > lastTotal && lastTotal > 0) {
        playNotificationSound();
    }

    lastTotal = newTotal;
};

const playNotificationSound = (): void => {
    try {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch {
        // Audio not supported
    }
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect } from 'react';

export const useNotificationBadge = (userId: string, branch: string, department: string) => {
    const [notificationCounts, setNotificationCounts] = useState<NotificationCount>(counts);

    useEffect(() => {
        initBadgeService(userId, branch, department);
        const unsubscribe = subscribeToCounts(setNotificationCounts);

        return () => {
            unsubscribe();
            destroyBadgeService();
        };
    }, [userId, branch, department]);

    return {
        ...notificationCounts,
        hasPending: notificationCounts.pending > 0,
        hasUrgent: notificationCounts.urgent > 0,
        hasUnread: notificationCounts.unread > 0
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    initBadgeService,
    destroyBadgeService,
    subscribeToCounts,
    getCounts,
    getPendingCount,
    getUrgentCount,
    getUnreadCount,
    createBadge,
    updateBadge,
    updateNavBadge,
    useNotificationBadge
};
