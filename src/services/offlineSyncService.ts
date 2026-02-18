/**
 * Offline Sync Service
 * Handles offline operations and sync when back online
 * Adora Hotel Management System V2
 */

import { db, getSafeFirestore } from './firebase';
import type { Firestore } from 'firebase/firestore';
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type OfflineAction = 'create' | 'update' | 'delete';

export interface OfflineOperation {
    id: string;
    collection: string;
    docId?: string;
    /** When set, operation runs on tenants/{tenantId}/{collection} (tenant-scoped) */
    tenantId?: string;
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
    logger.info('🌐 Back online!', undefined, 'offlineSyncService');
    isOnline = true;

    // Notify callbacks
    onlineCallbacks.forEach(cb => cb());

    // Sync queued operations
    syncOfflineQueue();

    // Show notification
    showConnectionNotification(true);
}

function handleOffline(): void {
    logger.info('📴 Gone offline!', undefined, 'offlineSyncService');
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

/** Collections that must never be replayed from queue (source of truth = server/callables) */
const NO_OFFLINE_REPLAY_COLLECTIONS = ['requests', 'rooms'];

/**
 * Add operation to offline queue.
 * @param tenantId - If set, replay writes to tenants/{tenantId}/{collectionName}
 */
export function queueOperation(
    collectionName: string,
    action: OfflineAction,
    data: Record<string, any>,
    docId?: string,
    tenantId?: string
): string {
    if (NO_OFFLINE_REPLAY_COLLECTIONS.includes(collectionName)) {
        throw new Error(`Offline queue not allowed for "${collectionName}". Use online flow (callables).`);
    }
    const operation: OfflineOperation = {
        id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        collection: collectionName,
        docId,
        tenantId,
        action,
        data,
        timestamp: Date.now(),
        retries: 0,
    };

    const queue = getQueue();
    queue.push(operation);
    saveQueue(queue);

    logger.info(`📦 Queued offline operation: ${action} on ${collectionName}`, undefined, 'offlineSyncService');

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

    const safeDb = await getSafeFirestore();
    if (!safeDb) return;

    syncInProgress = true;
    logger.info(`🔄 Syncing ${queue.length} offline operations...`, undefined, 'offlineSyncService');

    for (const operation of queue) {
        try {
            await executeOperation(operation, safeDb);
            removeFromQueue(operation.id);
            logger.info(`✅ Synced: ${operation.action} on ${operation.collection}`, undefined, 'offlineSyncService');
        } catch (error) {
            logger.error(`❌ Failed to sync operation:`, error, 'offlineSyncService');

            // Update retry count
            operation.retries++;
            if (operation.retries >= 3) {
                removeFromQueue(operation.id);
                logger.warn(`🗑️ Removed after 3 retries: ${operation.id}`, undefined, 'offlineSyncService');
            }
        }
    }

    syncInProgress = false;

    const remaining = getQueue().length;
    if (remaining > 0) {
        logger.info(`📦 ${remaining} operations still pending`, undefined, 'offlineSyncService');
    } else {
        logger.info(`✅ All operations synced!`, undefined, 'offlineSyncService');
    }
}

/**
 * Execute a single operation (supports tenant-scoped path when operation.tenantId is set)
 */
async function executeOperation(operation: OfflineOperation, dbInstance?: Firestore | null): Promise<void> {
    const firestore = dbInstance ?? db;
    if (!firestore) return;

    const { collection: collectionName, action, data, docId, tenantId } = operation;

    const collectionRef = tenantId
        ? collection(firestore, 'tenants', tenantId, collectionName)
        : collection(firestore, collectionName);
    const docRefForId = (id: string) =>
        tenantId ? doc(firestore, 'tenants', tenantId, collectionName, id) : doc(firestore, collectionName, id);

    // F1: For requests update, read-before-write to avoid overwriting terminal state with stale data
    if (collectionName === 'requests' && action === 'update' && docId) {
        const ref = docRefForId(docId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const serverStatus = (snap.data()?.status ?? '').toString().toUpperCase();
            if (serverStatus === 'COMPLETED' || serverStatus === 'CANCELLED') {
                logger.info(`F1: Skipping offline update for request ${docId} (server status: ${serverStatus})`, undefined, 'offlineSyncService');
                return;
            }
        }
    } else if (NO_OFFLINE_REPLAY_COLLECTIONS.includes(collectionName)) {
        throw new Error(`Replay blocked for "${collectionName}" to prevent stale overwrite.`);
    }

    switch (action) {
        case 'create':
            await addDoc(collectionRef, {
                ...data,
                createdAt: serverTimestamp(),
                _syncedAt: serverTimestamp(),
            });
            break;

        case 'update':
            if (!docId) throw new Error('docId required for update');
            await updateDoc(docRefForId(docId), {
                ...data,
                updatedAt: serverTimestamp(),
                _syncedAt: serverTimestamp(),
            });
            break;

        case 'delete':
            if (!docId) throw new Error('docId required for delete');
            await updateDoc(docRefForId(docId), {
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
 * Smart save - works online and offline.
 * @param tenantId - If set, writes to tenants/{tenantId}/{collectionName} (and queue replays there)
 */
export async function smartSave(
    collectionName: string,
    data: Record<string, any>,
    docId?: string,
    tenantId?: string
): Promise<string | null> {
    const action: OfflineAction = docId ? 'update' : 'create';

    if (isOnline) {
        const safeDb = await getSafeFirestore();
        if (!safeDb) {
            queueOperation(collectionName, action, data, docId, tenantId);
            return null;
        }
        const collRef = tenantId ? collection(safeDb, 'tenants', tenantId, collectionName) : collection(safeDb, collectionName);
        const docRef = (id: string) => tenantId ? doc(safeDb, 'tenants', tenantId, collectionName, id) : doc(safeDb, collectionName, id);
        try {
            if (action === 'create') {
                const docRefCreated = await addDoc(collRef, {
                    ...data,
                    createdAt: serverTimestamp(),
                });
                return docRefCreated.id;
            } else {
                await updateDoc(docRef(docId!), {
                    ...data,
                    updatedAt: serverTimestamp(),
                });
                return docId!;
            }
        } catch (error) {
            logger.warn('Online save failed, queuing...', error, 'offlineSyncService');
            queueOperation(collectionName, action, data, docId, tenantId);
            return null;
        }
    }

    queueOperation(collectionName, action, data, docId, tenantId);
    return null;
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
