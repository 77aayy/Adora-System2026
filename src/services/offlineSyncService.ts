/**
 * Offline Sync Service
 * Handles offline operations and sync when back online
 * Adora Hotel Management System V2
 */

import { db } from './firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

export type OfflineAction = 'create' | 'update' | 'delete';

export interface OfflineOperation {
    id: string;
    collection: string;
    docId?: string;
    action: OfflineAction;
    data: Record<string, any>;
    timestamp: number;
    retries: number;
}

// ============================================================
// STATE
// ============================================================

const STORAGE_KEY = 'adora_offline_queue';
let isOnline = navigator.onLine;
let syncInProgress = false;
let onlineCallbacks: (() => void)[] = [];
let offlineCallbacks: (() => void)[] = [];

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize offline sync service
 */
export function initOfflineSync(): void {
    // Listen to online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    isOnline = navigator.onLine;

    // Try to sync on init if online
    if (isOnline) {
        syncOfflineQueue();
    }

    console.log(`📶 Offline sync initialized. Status: ${isOnline ? 'Online' : 'Offline'}`);
}

/**
 * Cleanup listeners
 */
export function cleanupOfflineSync(): void {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
}

// ============================================================
// EVENT HANDLERS
// ============================================================

function handleOnline(): void {
    console.log('🌐 Back online!');
    isOnline = true;

    // Notify callbacks
    onlineCallbacks.forEach(cb => cb());

    // Sync queued operations
    syncOfflineQueue();

    // Show notification
    showConnectionNotification(true);
}

function handleOffline(): void {
    console.log('📴 Gone offline!');
    isOnline = false;

    // Notify callbacks
    offlineCallbacks.forEach(cb => cb());

    // Show notification
    showConnectionNotification(false);
}

// ============================================================
// QUEUE MANAGEMENT
// ============================================================

/**
 * Get pending operations from storage
 */
function getQueue(): OfflineOperation[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

/**
 * Save queue to storage
 */
function saveQueue(queue: OfflineOperation[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

/**
 * Add operation to offline queue
 */
export function queueOperation(
    collectionName: string,
    action: OfflineAction,
    data: Record<string, any>,
    docId?: string
): string {
    const operation: OfflineOperation = {
        id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        collection: collectionName,
        docId,
        action,
        data,
        timestamp: Date.now(),
        retries: 0,
    };

    const queue = getQueue();
    queue.push(operation);
    saveQueue(queue);

    console.log(`📦 Queued offline operation: ${action} on ${collectionName}`);

    // Try to sync immediately if online
    if (isOnline) {
        syncOfflineQueue();
    }

    return operation.id;
}

/**
 * Remove operation from queue
 */
function removeFromQueue(operationId: string): void {
    const queue = getQueue().filter(op => op.id !== operationId);
    saveQueue(queue);
}

// ============================================================
// SYNC LOGIC
// ============================================================

/**
 * Sync all queued operations
 */
export async function syncOfflineQueue(): Promise<void> {
    if (!isOnline || syncInProgress) return;

    const queue = getQueue();
    if (queue.length === 0) return;

    syncInProgress = true;
    console.log(`🔄 Syncing ${queue.length} offline operations...`);

    for (const operation of queue) {
        try {
            await executeOperation(operation);
            removeFromQueue(operation.id);
            console.log(`✅ Synced: ${operation.action} on ${operation.collection}`);
        } catch (error) {
            console.error(`❌ Failed to sync operation:`, error);

            // Update retry count
            operation.retries++;
            if (operation.retries >= 3) {
                removeFromQueue(operation.id);
                console.warn(`🗑️ Removed after 3 retries: ${operation.id}`);
            }
        }
    }

    syncInProgress = false;

    const remaining = getQueue().length;
    if (remaining > 0) {
        console.log(`📦 ${remaining} operations still pending`);
    } else {
        console.log(`✅ All operations synced!`);
    }
}

/**
 * Execute a single operation
 */
async function executeOperation(operation: OfflineOperation): Promise<void> {
    const { collection: collectionName, action, data, docId } = operation;

    switch (action) {
        case 'create':
            await addDoc(collection(db, collectionName), {
                ...data,
                createdAt: serverTimestamp(),
                _syncedAt: serverTimestamp(),
            });
            break;

        case 'update':
            if (!docId) throw new Error('docId required for update');
            await updateDoc(doc(db, collectionName, docId), {
                ...data,
                updatedAt: serverTimestamp(),
                _syncedAt: serverTimestamp(),
            });
            break;

        case 'delete':
            if (!docId) throw new Error('docId required for delete');
            await updateDoc(doc(db, collectionName, docId), {
                _deleted: true,
                _deletedAt: serverTimestamp(),
            });
            break;
    }
}

// ============================================================
// SMART SAVE (Auto-queue if offline)
// ============================================================

/**
 * Smart save - works online and offline
 */
export async function smartSave(
    collectionName: string,
    data: Record<string, any>,
    docId?: string
): Promise<string | null> {
    const action: OfflineAction = docId ? 'update' : 'create';

    if (isOnline) {
        try {
            if (action === 'create') {
                const docRef = await addDoc(collection(db, collectionName), {
                    ...data,
                    createdAt: serverTimestamp(),
                });
                return docRef.id;
            } else {
                await updateDoc(doc(db, collectionName, docId!), {
                    ...data,
                    updatedAt: serverTimestamp(),
                });
                return docId!;
            }
        } catch (error) {
            console.warn('Online save failed, queuing...', error);
            queueOperation(collectionName, action, data, docId);
            return null;
        }
    } else {
        queueOperation(collectionName, action, data, docId);
        return null;
    }
}

// ============================================================
// UI NOTIFICATIONS
// ============================================================

function showConnectionNotification(online: boolean): void {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'connection-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 500;
        z-index: 9999;
        animation: slideDown 0.3s ease;
        ${online
            ? 'background: linear-gradient(135deg, #22C55E, #16A34A); color: white;'
            : 'background: linear-gradient(135deg, #EF4444, #DC2626); color: white;'
        }
    `;
    notification.innerHTML = online
        ? '🌐 عاد الاتصال - جاري المزامنة...'
        : '📴 لا يوجد اتصال - سيتم الحفظ محلياً';

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================================
// CALLBACKS
// ============================================================

export function onOnline(callback: () => void): void {
    onlineCallbacks.push(callback);
}

export function onOffline(callback: () => void): void {
    offlineCallbacks.push(callback);
}

// ============================================================
// STATUS
// ============================================================

export function getOnlineStatus(): boolean {
    return isOnline;
}

export function getPendingCount(): number {
    return getQueue().length;
}

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect } from 'react';

export function useOfflineSync() {
    const [online, setOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        const handleOnlineChange = () => setOnline(navigator.onLine);

        window.addEventListener('online', handleOnlineChange);
        window.addEventListener('offline', handleOnlineChange);

        // Check pending count periodically
        const interval = setInterval(() => {
            setPendingCount(getPendingCount());
        }, 5000);

        return () => {
            window.removeEventListener('online', handleOnlineChange);
            window.removeEventListener('offline', handleOnlineChange);
            clearInterval(interval);
        };
    }, []);

    return { online, pendingCount, syncNow: syncOfflineQueue };
}

export default {
    initOfflineSync,
    cleanupOfflineSync,
    queueOperation,
    syncOfflineQueue,
    smartSave,
    onOnline,
    onOffline,
    getOnlineStatus,
    getPendingCount,
    useOfflineSync,
};
