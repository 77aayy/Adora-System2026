/**
 * Cleanup Service
 * Automatic cleanup of old data to save Firestore space
 * Adora Hotel Management System V2
 * 
 * Rules:
 * - Requests/Orders: Delete after 120 days (archive first)
 * - Guest Activity/Logs: Delete after 60 days
 * - Notifications: Delete after 30 days
 */

import {
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    doc,
    addDoc,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// CONFIGURATION
// ============================================================

const RETENTION_DAYS = {
    standard: 120,    // Standard retention for business records
    logs: 60,         // Logs and schedules
    short: 30,        // Notifications and transient data
};

interface CleanupConfig {
    collectionName: string;
    dateField: string;
    retentionDays: number;
    archive?: boolean;     // Whether to archive before deleting
    archiveCollection?: string;
}

// Collections to clean up
const COLLECTIONS_TO_CLEAN: CleanupConfig[] = [
    // --- Business Records (120 days) ---
    { collectionName: 'requests', dateField: 'createdAt', retentionDays: RETENTION_DAYS.standard, archive: true, archiveCollection: 'request_history' },
    { collectionName: 'procurement_requests', dateField: 'createdAt', retentionDays: RETENTION_DAYS.standard },
    { collectionName: 'workOrders', dateField: 'createdAt', retentionDays: RETENTION_DAYS.standard },
    { collectionName: 'conciergeRequests', dateField: 'createdAt', retentionDays: RETENTION_DAYS.standard },
    { collectionName: 'reservations', dateField: 'createdAt', retentionDays: RETENTION_DAYS.standard },
    { collectionName: 'lostAndFound', dateField: 'createdAt', retentionDays: RETENTION_DAYS.standard },
    { collectionName: 'complaints', dateField: 'createdAt', retentionDays: RETENTION_DAYS.standard },

    // --- Operational/Logs (60 days) ---
    { collectionName: 'cleaningSchedule', dateField: 'scheduledTime', retentionDays: RETENTION_DAYS.logs },
    { collectionName: 'roomAssignments', dateField: 'createdAt', retentionDays: RETENTION_DAYS.logs },
    { collectionName: 'luggage', dateField: 'receivedAt', retentionDays: RETENTION_DAYS.logs },
    { collectionName: 'amenityRestock', dateField: 'createdAt', retentionDays: RETENTION_DAYS.logs },
    { collectionName: 'transportation', dateField: 'createdAt', retentionDays: RETENTION_DAYS.logs },
    { collectionName: 'guest_activity', dateField: 'createdAt', retentionDays: RETENTION_DAYS.logs },
    { collectionName: 'audit_logs', dateField: 'timestamp', retentionDays: RETENTION_DAYS.logs },

    // --- Transient (30 days) ---
    { collectionName: 'notifications', dateField: 'createdAt', retentionDays: RETENTION_DAYS.short },
];

// ============================================================
// HELPERS
// ============================================================

/**
 * Get date X days ago
 */
const getDaysAgo = (days: number): Date => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
};

/**
 * Archive a document to permanent history before deletion
 */
const archiveDocument = async (docData: any, collectionName: string): Promise<void> => {
    try {
        await addDoc(collection(db, collectionName), {
            ...docData,
            _archivedAt: Timestamp.now(),
            _originalId: docData.id,
        });
    } catch (error) {
        logger.error(`Error archiving document to ${collectionName}:`, error, 'cleanupService');
    }
};

// ============================================================
// CLEANUP LOGIC
// ============================================================

/**
 * Clean up a single collection based on configuration
 */
const cleanupCollection = async (config: CleanupConfig): Promise<number> => {
    const cutoffDate = getDaysAgo(config.retentionDays);
    let cleanedCount = 0;

    logger.info(`Starting cleanup for ${config.collectionName} (older than ${cutoffDate.toISOString().split('T')[0]})...`, undefined, 'cleanupService');

    try {
        const colRef = collection(db, config.collectionName);
        const q = query(
            colRef,
            where(config.dateField, '<', Timestamp.fromDate(cutoffDate))
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return 0;
        }

        const batch = writeBatch(db);
        const archivePromises: Promise<void>[] = [];
        let batchCount = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();

            // Skip if not completed/closed (optional safety check for certain collections)
            // For now, we assume retention period is safe enough

            // Archive if configured
            if (config.archive && config.archiveCollection) {
                archivePromises.push(archiveDocument({ id: docSnap.id, ...data }, config.archiveCollection));
            }

            batch.delete(doc(db, config.collectionName, docSnap.id));
            cleanedCount++;
            batchCount++;

            // Commit batches of 500
            if (batchCount >= 400) { // Safety margin below 500
                await Promise.all(archivePromises);
                await batch.commit();
                archivePromises.length = 0;
                batchCount = 0;
            }
        }

        // Commit remaining
        if (batchCount > 0) {
            await Promise.all(archivePromises);
            await batch.commit();
        }

        logger.info(`✅ Cleaned ${cleanedCount} items from ${config.collectionName}`, undefined, 'cleanupService');
        return cleanedCount;

    } catch (error) {
        logger.error(`❌ Error cleaning ${config.collectionName}:`, error, 'cleanupService');
        return 0;
    }
};

// ============================================================
// MAIN RUNNER
// ============================================================

/**
 * Run all cleanup tasks
 */
export const runCleanup = async (): Promise<{
    details: Record<string, number>;
    totalItems: number;
    totalSaved: string;
}> => {
    logger.info('🧹 Starting System Cleanup...', undefined, 'cleanupService');
    const details: Record<string, number> = {};
    let totalItems = 0;

    for (const config of COLLECTIONS_TO_CLEAN) {
        const count = await cleanupCollection(config);
        details[config.collectionName] = count;
        totalItems += count;
    }

    // Estimate saved space (average ~2KB per document)
    const savedBytes = totalItems * 2048;
    const savedKB = (savedBytes / 1024).toFixed(2);

    logger.info(`✨ Cleanup Complete! Removed ${totalItems} items. Saved ~${savedKB} KB.`, undefined, 'cleanupService');

    return {
        details,
        totalItems,
        totalSaved: `${savedKB} KB`
    };
};

/**
 * Check if cleanup should run today
 */
export const shouldRunCleanup = (): boolean => {
    const lastCleanup = localStorage.getItem('lastCleanupDate');
    const today = new Date().toDateString();
    return lastCleanup !== today;
};

/**
 * Mark cleanup as done for today
 */
export const markCleanupDone = (): void => {
    localStorage.setItem('lastCleanupDate', new Date().toDateString());
};

/**
 * Auto-run cleanup on admin dashboard load
 */
export const autoCleanupOnAdminLoad = async (): Promise<void> => {
    if (shouldRunCleanup()) {
        const results = await runCleanup();
        markCleanupDone();

        if (results.totalItems > 0) {
            logger.info('Daily Cleanup Report:', results, 'cleanupService');
        }
    }
};

/**
 * Force run cleanup immediately (Debug/Manual)
 */
export const forceRunCleanup = async (): Promise<void> => {
    logger.info('⚠️ Force running cleanup...', undefined, 'cleanupService');
    const results = await runCleanup();
    alert(`Cleanup Complete!\nRemoved: ${results.totalItems} items\nSpace Saved: ${results.totalSaved}`);
};

// Expose to window for manual triggering via console
(window as any).forceRunCleanup = forceRunCleanup;


