/**
 * Live Feed Service
 * Handles live feed entries for real-time activity tracking
 * ✅ Architecture: All Firebase operations isolated in services
 */

import { collection, addDoc, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface LiveFeedEntry {
    type: string;
    branchId: string;
    tenantId: string;
    roomNumber?: string;
    description: string;
    photoUrl?: string | null;
    returnedBy?: { id: string; name: string };
    createdAt: any; // Firestore Timestamp
    status?: string;
    itemId?: string;
    [key: string]: any; // Allow additional fields
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Create a live feed entry
 * ✅ Null Safety: Checks db before operations
 * ✅ Error Handling: Wrapped in try-catch with proper logging
 */
export const createLiveFeedEntry = async (
    entry: Omit<LiveFeedEntry, 'createdAt'>
): Promise<{ success: boolean; error?: string }> => {
    // Null safety check
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Live feed entry creation failed', new Error(error), 'liveFeedService');
        return { success: false, error };
    }

    try {
        await addDoc(collection(db, 'live_feed'), {
            ...entry,
            createdAt: Timestamp.now()
        });

        logger.info('Live feed entry created successfully', { type: entry.type, branchId: entry.branchId }, 'liveFeedService');

        return { success: true };
    } catch (error: any) {
        logger.error('Error creating live feed entry', error, 'liveFeedService');
        return { success: false, error: error.message || 'Failed to create live feed entry' };
    }
};

/**
 * Update existing live feed entry
 * ✅ Null Safety: Checks db before operations
 */
export const updateLiveFeedEntry = async (
    entryId: string,
    updates: Partial<LiveFeedEntry>
): Promise<{ success: boolean; error?: string }> => {
    // Null safety check
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Live feed entry update failed', new Error(error), 'liveFeedService');
        return { success: false, error };
    }

    try {
        const entryRef = doc(db, 'live_feed', entryId);
        await updateDoc(entryRef, updates);

        logger.info('Live feed entry updated successfully', { entryId, updates }, 'liveFeedService');

        return { success: true };
    } catch (error: any) {
        logger.error('Error updating live feed entry', error, 'liveFeedService');
        return { success: false, error: error.message || 'Failed to update live feed entry' };
    }
};

/**
 * Find existing live feed entry by criteria
 * ✅ Null Safety: Checks db before operations
 */
export const findLiveFeedEntry = async (
    criteria: { branchId: string; tenantId: string; type?: string; [key: string]: any }
): Promise<{ id: string; data: LiveFeedEntry } | null> => {
    // Null safety check
    if (!db) {
        logger.error('Live feed entry search failed', new Error('Database not initialized'), 'liveFeedService');
        return null;
    }

    try {
        const conditions: any[] = [
            where('branchId', '==', criteria.branchId),
            where('tenantId', '==', criteria.tenantId)
        ];

        if (criteria.type) {
            conditions.push(where('type', '==', criteria.type));
        }

        // Add any additional criteria
        Object.keys(criteria).forEach(key => {
            if (key !== 'branchId' && key !== 'tenantId' && key !== 'type') {
                conditions.push(where(key, '==', criteria[key]));
            }
        });

        const q = query(collection(db, 'live_feed'), ...conditions);
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                data: doc.data() as LiveFeedEntry
            };
        }

        return null;
    } catch (error: any) {
        logger.error('Error finding live feed entry', error, 'liveFeedService');
        return null;
    }
};
