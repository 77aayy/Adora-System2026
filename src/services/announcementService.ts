/**
 * Announcements Service
 * Manages guest announcements and notifications
 * Adora Hotel Management System V2
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, Timestamp, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { autoTranslateNewText } from './dynamicTranslationService'; // ✅ Auto-translation

// ============================================================
// TYPES
// ============================================================

export interface Announcement {
    id: string;
    title: string;
    titleAr: string;
    content: string;
    contentAr: string;
    icon?: string; // Emoji or icon
    priority: 'high' | 'medium' | 'low';
    
    // Display Settings
    showType: 'once' | 'always' | 'times'; // once = مرة واحدة، always = كل مرة، times = عدد مرات محدد
    showCount?: number; // عدد المرات إذا كان showType = 'times'
    
    // Status
    isActive: boolean;
    order: number; // Display order
    
    // Target
    branchId: string;
    tenantId: string;
    
    // Metadata
    createdAt: any;
    updatedAt: any;
    createdBy?: { id: string; name: string };
}

export interface AnnouncementRead {
    id: string;
    announcementId: string;
    roomNumber: string;
    guestName?: string;
    readAt: any;
    readCount: number; // عدد مرات القراءة
    branchId: string;
    tenantId: string;
}

// ============================================================
// ANNOUNCEMENTS MANAGEMENT
// ============================================================

/**
 * Get all active announcements for a branch
 */
export const getAnnouncements = async (branchId: string, tenantId: string): Promise<Announcement[]> => {
    try {
        const q = query(
            collection(db, 'announcements'),
            where('branchId', '==', branchId),
            where('tenantId', '==', tenantId),
            where('isActive', '==', true)
        );

        const snapshot = await getDocs(q);
        const announcements: Announcement[] = [];

        snapshot.forEach(doc => {
            announcements.push({
                id: doc.id,
                ...doc.data()
            } as Announcement);
        });

        return announcements.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
        console.error('Error getting announcements:', error);
        return [];
    }
};

/**
 * Subscribe to announcements with real-time updates
 */
export const subscribeToAnnouncements = (
    branchId: string,
    tenantId: string,
    callback: (announcements: Announcement[]) => void
): (() => void) => {
    const q = query(
        collection(db, 'announcements'),
        where('branchId', '==', branchId),
        where('tenantId', '==', tenantId),
        where('isActive', '==', true)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const announcements: Announcement[] = [];
            snapshot.forEach(doc => {
                announcements.push({
                    id: doc.id,
                    ...doc.data()
                } as Announcement);
            });
            callback(announcements.sort((a, b) => (a.order || 0) - (b.order || 0)));
        },
        (error) => {
            console.error('Error subscribing to announcements:', error);
            callback([]);
        }
    );
};

/**
 * Create announcement
 */
export const createAnnouncement = async (
    announcement: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string,
    userName: string
): Promise<string> => {
    try {
        const announcementData: Omit<Announcement, 'id'> = {
            ...announcement,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            createdBy: { id: userId, name: userName }
        };

        const docRef = doc(collection(db, 'announcements'));
        await setDoc(docRef, announcementData);

        // ✅ AUTO-TRANSLATE: Translate Arabic text to all languages automatically
        const tenantId = (announcement as any).tenantId;
        if (tenantId && (announcement.titleAr || announcement.contentAr)) {
            try {
                // Translate title
                if (announcement.titleAr) {
                    await autoTranslateNewText(
                        tenantId,
                        `announcement_${docRef.id}_title`,
                        announcement.titleAr
                    );
                }
                // Translate content
                if (announcement.contentAr) {
                    await autoTranslateNewText(
                        tenantId,
                        `announcement_${docRef.id}_content`,
                        announcement.contentAr
                    );
                }
            } catch (translationError) {
                // Don't fail the announcement creation if translation fails
                console.warn('Auto-translation failed for announcement:', translationError);
            }
        }

        return docRef.id;
    } catch (error) {
        console.error('Error creating announcement:', error);
        throw error;
    }
};

/**
 * Update announcement
 */
export const updateAnnouncement = async (
    announcementId: string,
    updates: Partial<Announcement>,
    userId: string,
    userName: string
): Promise<void> => {
    try {
        const announcementRef = doc(db, 'announcements', announcementId);
        await updateDoc(announcementRef, {
            ...updates,
            updatedAt: Timestamp.now(),
            updatedBy: { id: userId, name: userName }
        });
    } catch (error) {
        console.error('Error updating announcement:', error);
        throw error;
    }
};

/**
 * Delete announcement
 */
export const deleteAnnouncement = async (announcementId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'announcements', announcementId));
    } catch (error) {
        console.error('Error deleting announcement:', error);
        throw error;
    }
};

// ============================================================
// READ TRACKING
// ============================================================

/**
 * Get read status for announcements
 */
export const getAnnouncementReadStatus = async (
    roomNumber: string,
    branchId: string,
    tenantId: string
): Promise<Record<string, AnnouncementRead>> => {
    try {
        const q = query(
            collection(db, 'announcement_reads'),
            where('roomNumber', '==', roomNumber),
            where('branchId', '==', branchId),
            where('tenantId', '==', tenantId)
        );

        const snapshot = await getDocs(q);
        const reads: Record<string, AnnouncementRead> = {};

        snapshot.forEach(doc => {
            const data = doc.data() as AnnouncementRead;
            reads[data.announcementId] = {
                id: doc.id,
                ...data
            };
        });

        return reads;
    } catch (error) {
        console.error('Error getting announcement read status:', error);
        return {};
    }
};

/**
 * Mark announcement as read
 */
export const markAnnouncementAsRead = async (
    announcementId: string,
    roomNumber: string,
    branchId: string,
    tenantId: string,
    guestName?: string
): Promise<void> => {
    try {
        // Check if already read
        const q = query(
            collection(db, 'announcement_reads'),
            where('announcementId', '==', announcementId),
            where('roomNumber', '==', roomNumber),
            where('branchId', '==', branchId),
            where('tenantId', '==', tenantId)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Update existing read
            const readDoc = snapshot.docs[0];
            const currentData = readDoc.data() as AnnouncementRead;
            await updateDoc(doc(db, 'announcement_reads', readDoc.id), {
                readAt: Timestamp.now(),
                readCount: (currentData.readCount || 0) + 1
            });
        } else {
            // Create new read
            const readData: Omit<AnnouncementRead, 'id'> = {
                announcementId,
                roomNumber,
                guestName,
                readAt: Timestamp.now(),
                readCount: 1,
                branchId,
                tenantId
            };
            await addDoc(collection(db, 'announcement_reads'), readData);
        }
    } catch (error) {
        console.error('Error marking announcement as read:', error);
    }
};

/**
 * Check if announcement should be shown to guest
 */
export const shouldShowAnnouncement = (
    announcement: Announcement,
    readStatus?: AnnouncementRead
): boolean => {
    if (!announcement.isActive) return false;

    // If no read status, always show
    if (!readStatus) return true;

    switch (announcement.showType) {
        case 'always':
            return true; // Always show
        case 'once':
            return readStatus.readCount === 0; // Show only once
        case 'times':
            const maxCount = announcement.showCount || 1;
            return (readStatus.readCount || 0) < maxCount; // Show until max count
        default:
            return true;
    }
};

/**
 * Get unread announcements count
 */
export const getUnreadAnnouncementsCount = (
    announcements: Announcement[],
    readStatuses: Record<string, AnnouncementRead>
): number => {
    return announcements.filter(announcement => 
        shouldShowAnnouncement(announcement, readStatuses[announcement.id])
    ).length;
};

/**
 * Get visible announcements (filtered by read status)
 */
export const getVisibleAnnouncements = (
    announcements: Announcement[],
    readStatuses: Record<string, AnnouncementRead>
): Announcement[] => {
    return announcements.filter(announcement =>
        shouldShowAnnouncement(announcement, readStatuses[announcement.id])
    );
};
