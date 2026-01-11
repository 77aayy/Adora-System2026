/**
 * Connectivity Monitor
 * Real-time network status monitoring with offline queue
 * Adora Hotel Management System V2
 */

import { useState, useEffect } from 'react';

// ============================================================
// TYPES
// ============================================================

export interface NetworkStatus {
    isOnline: boolean;
    connectionType: string | null;
    effectiveType: string | null; // 4g, 3g, 2g, slow-2g
}

export interface QueuedAction {
    id: string;
    type: string;
    data: any;
    action: () => Promise<void>;
    timestamp: Date;
    retries: number;
}

// ============================================================
// OFFLINE QUEUE
// ============================================================

const offlineQueue: QueuedAction[] = [];
const MAX_RETRIES = 3;

/**
 * Check if currently online
 */
export const isOnline = (): boolean => navigator.onLine;

/**
 * Add action to offline queue
 */
export const queueOfflineAction = (
    action: () => Promise<void>,
    type = 'unknown',
    data: any = {}
): string => {
    const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    offlineQueue.push({
        id,
        type,
        data,
        action,
        timestamp: new Date(),
        retries: 0,
    });

    // Save to localStorage for persistence
    saveQueueToStorage();

    return id;
};

/**
 * Get all queued actions
 */
export const getQueuedActions = (): QueuedAction[] => {
    return [...offlineQueue];
};

/**
 * Process offline queue when back online
 */
export const processOfflineQueue = async (): Promise<void> => {
    console.log(`Processing ${offlineQueue.length} queued actions...`);

    const actionsToProcess = [...offlineQueue];

    for (const item of actionsToProcess) {
        try {
            await item.action();
            // Remove from queue on success
            const index = offlineQueue.findIndex(q => q.id === item.id);
            if (index > -1) {
                offlineQueue.splice(index, 1);
            }
        } catch (error) {
            console.error(`Failed to process queued action ${item.id}:`, error);
            item.retries++;

            if (item.retries >= MAX_RETRIES) {
                // Remove failed action after max retries
                const index = offlineQueue.findIndex(q => q.id === item.id);
                if (index > -1) {
                    offlineQueue.splice(index, 1);
                }
            }
        }
    }

    saveQueueToStorage();
};

// Alias for component compatibility
export const processQueue = processOfflineQueue;

/**
 * Clear all queued actions
 */
export const clearQueue = (): void => {
    offlineQueue.length = 0;
    saveQueueToStorage();
};

/**
 * Get queue count
 */
export const getQueueCount = (): number => offlineQueue.length;

/**
 * Save queue to localStorage
 */
const saveQueueToStorage = (): void => {
    // Note: We can't serialize functions, so we just save the count
    localStorage.setItem('adora_offline_queue_count', String(offlineQueue.length));
};

// ============================================================
// NETWORK MONITOR
// ============================================================

/**
 * Get current network status
 */
export const getNetworkStatus = (): NetworkStatus => {
    const connection = (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection;

    return {
        isOnline: navigator.onLine,
        connectionType: connection?.type || null,
        effectiveType: connection?.effectiveType || null,
    };
};

/**
 * React hook for network status
 */
export const useNetworkStatus = (): NetworkStatus => {
    const [status, setStatus] = useState<NetworkStatus>(getNetworkStatus());

    useEffect(() => {
        const handleOnline = () => {
            setStatus(getNetworkStatus());
            // Process queue when back online
            processOfflineQueue();
        };

        const handleOffline = () => {
            setStatus(getNetworkStatus());
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return status;
};

/**
 * Check if connection is slow
 */
export const isSlowConnection = (): boolean => {
    const status = getNetworkStatus();
    return status.effectiveType === '2g' || status.effectiveType === 'slow-2g';
};

