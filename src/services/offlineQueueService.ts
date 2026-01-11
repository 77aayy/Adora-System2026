/**
 * Offline Queue Service 📴
 * Handles operations when offline with smart sync
 * Adora Hotel Management System V3 - SaaS
 */

import { db } from './firebase';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface QueuedOperation {
    id: string;
    type: 'create' | 'update' | 'delete';
    collection: string;
    documentId?: string;
    data: any;
    timestamp: number;
    retryCount: number;
    status: 'pending' | 'processing' | 'failed' | 'completed';
    error?: string;
}

export interface SyncStatus {
    isOnline: boolean;
    queuedCount: number;
    lastSync: Date | null;
    isSyncing: boolean;
}

// ============================================================
// STORAGE
// ============================================================

const QUEUE_KEY = 'adora_offline_queue';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Get queued operations from localStorage
 */
function getQueue(): QueuedOperation[] {
    try {
        const data = localStorage.getItem(QUEUE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

/**
 * Save queue to localStorage
 */
function saveQueue(queue: QueuedOperation[]): void {
    try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
        logger.error('Error saving queue:', error, 'offlineQueueService');
    }
}

// ============================================================
// QUEUE MANAGEMENT
// ============================================================

/**
 * Add operation to queue
 */
export function queueOperation(
    type: 'create' | 'update' | 'delete',
    collectionPath: string,
    data: any,
    documentId?: string
): string {
    const queue = getQueue();
    
    const operation: QueuedOperation = {
        id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        collection: collectionPath,
        documentId,
        data: {
            ...data,
            _queuedAt: new Date().toISOString(),
        },
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending',
    };
    
    queue.push(operation);
    saveQueue(queue);
    
    logger.info(`Operation queued: ${type} on ${collectionPath}`, { opId: operation.id }, 'offlineQueueService');
    
    // Try to sync immediately if online
    if (navigator.onLine) {
        setTimeout(() => syncQueue(), 100);
    }
    
    return operation.id;
}

/**
 * Remove operation from queue
 */
function removeFromQueue(operationId: string): void {
    const queue = getQueue();
    const filtered = queue.filter(op => op.id !== operationId);
    saveQueue(filtered);
}

/**
 * Update operation status
 */
function updateOperationStatus(
    operationId: string,
    status: QueuedOperation['status'],
    error?: string
): void {
    const queue = getQueue();
    const index = queue.findIndex(op => op.id === operationId);
    
    if (index !== -1) {
        queue[index].status = status;
        if (error) queue[index].error = error;
        if (status === 'failed') queue[index].retryCount++;
        saveQueue(queue);
    }
}

// ============================================================
// SYNC
// ============================================================

let isSyncing = false;
let syncListeners: ((status: SyncStatus) => void)[] = [];

/**
 * Sync all queued operations
 */
export async function syncQueue(): Promise<{ success: number; failed: number }> {
    if (isSyncing || !navigator.onLine) {
        return { success: 0, failed: 0 };
    }
    
    isSyncing = true;
    notifyListeners();
    
    const queue = getQueue();
    const pendingOps = queue.filter(op => op.status === 'pending' || op.status === 'failed');
    
    let success = 0;
    let failed = 0;
    
    for (const op of pendingOps) {
        if (op.retryCount >= MAX_RETRIES) {
            updateOperationStatus(op.id, 'failed', 'Max retries exceeded');
            failed++;
            continue;
        }
        
        try {
            updateOperationStatus(op.id, 'processing');
            
            switch (op.type) {
                case 'create':
                    await addDoc(collection(db, op.collection), {
                        ...op.data,
                        createdAt: Timestamp.now(),
                        _syncedAt: new Date().toISOString(),
                    });
                    break;
                    
                case 'update':
                    if (op.documentId) {
                        await updateDoc(doc(db, op.collection, op.documentId), {
                            ...op.data,
                            updatedAt: Timestamp.now(),
                            _syncedAt: new Date().toISOString(),
                        });
                    }
                    break;
                    
                case 'delete':
                    // Soft delete - mark as deleted instead of actually deleting
                    if (op.documentId) {
                        await updateDoc(doc(db, op.collection, op.documentId), {
                            isDeleted: true,
                            deletedAt: Timestamp.now(),
                            _syncedAt: new Date().toISOString(),
                        });
                    }
                    break;
            }
            
            removeFromQueue(op.id);
            success++;
            
            logger.info(`Operation synced: ${op.id}`, null, 'offlineQueueService');
        } catch (error: any) {
            updateOperationStatus(op.id, 'failed', error.message);
            failed++;
            
            logger.error(`Operation failed: ${op.id}`, error, 'offlineQueueService');
            
            // Wait before next operation
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
    
    isSyncing = false;
    
    // Save last sync time
    localStorage.setItem('adora_last_sync', new Date().toISOString());
    
    notifyListeners();
    
    return { success, failed };
}

// ============================================================
// STATUS & LISTENERS
// ============================================================

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
    const queue = getQueue();
    const lastSyncStr = localStorage.getItem('adora_last_sync');
    
    return {
        isOnline: navigator.onLine,
        queuedCount: queue.filter(op => op.status === 'pending' || op.status === 'failed').length,
        lastSync: lastSyncStr ? new Date(lastSyncStr) : null,
        isSyncing,
    };
}

/**
 * Subscribe to sync status changes
 */
export function subscribeSyncStatus(callback: (status: SyncStatus) => void): () => void {
    syncListeners.push(callback);
    
    // Immediately notify with current status
    callback(getSyncStatus());
    
    return () => {
        syncListeners = syncListeners.filter(l => l !== callback);
    };
}

function notifyListeners(): void {
    const status = getSyncStatus();
    syncListeners.forEach(listener => listener(status));
}

// ============================================================
// ONLINE/OFFLINE DETECTION
// ============================================================

/**
 * Initialize offline detection
 */
export function initOfflineDetection(): void {
    window.addEventListener('online', () => {
        logger.info('Back online - starting sync', null, 'offlineQueueService');
        notifyListeners();
        syncQueue();
    });
    
    window.addEventListener('offline', () => {
        logger.warn('Gone offline - queuing operations', null, 'offlineQueueService');
        notifyListeners();
    });
}

// ============================================================
// SMART OPERATION WRAPPERS
// ============================================================

/**
 * Smart create - works offline
 */
export async function smartCreate<T extends Record<string, any>>(
    collectionPath: string,
    data: T,
    tenantId?: string
): Promise<string> {
    const enrichedData = {
        ...data,
        tenantId,
        createdAt: new Date().toISOString(),
    };
    
    if (!navigator.onLine) {
        return queueOperation('create', collectionPath, enrichedData);
    }
    
    try {
        const docRef = await addDoc(collection(db, collectionPath), {
            ...enrichedData,
            createdAt: Timestamp.now(),
        });
        return docRef.id;
    } catch (error) {
        // Queue on failure
        logger.warn('Create failed, queuing...', null, 'offlineQueueService');
        return queueOperation('create', collectionPath, enrichedData);
    }
}

/**
 * Smart update - works offline
 */
export async function smartUpdate<T extends Record<string, any>>(
    collectionPath: string,
    documentId: string,
    data: T
): Promise<void> {
    const enrichedData = {
        ...data,
        updatedAt: new Date().toISOString(),
    };
    
    if (!navigator.onLine) {
        queueOperation('update', collectionPath, enrichedData, documentId);
        return;
    }
    
    try {
        await updateDoc(doc(db, collectionPath, documentId), {
            ...enrichedData,
            updatedAt: Timestamp.now(),
        });
    } catch (error) {
        logger.warn('Update failed, queuing...', null, 'offlineQueueService');
        queueOperation('update', collectionPath, enrichedData, documentId);
    }
}

/**
 * Get pending operations count
 */
export function getPendingCount(): number {
    return getQueue().filter(op => op.status === 'pending' || op.status === 'failed').length;
}

/**
 * Get failed operations
 */
export function getFailedOperations(): QueuedOperation[] {
    return getQueue().filter(op => op.status === 'failed' && op.retryCount >= MAX_RETRIES);
}

/**
 * Retry failed operations
 */
export async function retryFailedOperations(): Promise<void> {
    const queue = getQueue();
    queue.forEach(op => {
        if (op.status === 'failed') {
            op.retryCount = 0;
            op.status = 'pending';
        }
    });
    saveQueue(queue);
    await syncQueue();
}

/**
 * Clear all failed operations
 */
export function clearFailedOperations(): void {
    const queue = getQueue();
    const filtered = queue.filter(op => op.status !== 'failed');
    saveQueue(filtered);
    notifyListeners();
}

// Initialize on load
if (typeof window !== 'undefined') {
    initOfflineDetection();
}

export default {
    queueOperation,
    syncQueue,
    getSyncStatus,
    subscribeSyncStatus,
    smartCreate,
    smartUpdate,
    getPendingCount,
    getFailedOperations,
    retryFailedOperations,
    clearFailedOperations,
};
