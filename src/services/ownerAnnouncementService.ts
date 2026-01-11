/**
 * Owner Announcement Service
 * Allows owner to send urgent announcements to managers
 * Appears as news ticker/banner at the top of admin dashboards
 * Adora Hotel Management System V2
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, Timestamp, addDoc, orderBy } from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export interface OwnerAnnouncement {
    id: string;
    
    // Content
    title: string;
    titleAr: string;
    message: string;
    messageAr: string;
    
    // Type
    type: 'subscription_warning' | 'update_notification' | 'feature_announcement' | 'maintenance' | 'urgent' | 'general';
    priority: 'low' | 'medium' | 'high' | 'critical';
    
    // Targeting
    targetAudience: 'all_managers' | 'specific_branches' | 'specific_tenants';
    targetBranches?: string[]; // Branch IDs
    targetTenants?: string[]; // Tenant IDs (for multi-tenant SaaS)
    
    // Display Settings
    showAsBanner: boolean; // Show as scrolling ticker
    showAsModal: boolean; // Show as popup modal
    autoShow: boolean; // Auto-show on page load
    dismissible: boolean; // Can be dismissed
    showCount: number; // How many times to show (0 = unlimited)
    
    // Timing
    startDate?: any; // When to start showing
    endDate?: any; // When to stop showing
    expiresAt?: any; // Auto-expire date
    
    // Status
    isActive: boolean;
    createdAt: any;
    createdBy: { id: string; name: string };
    
    // Tracking
    views?: Record<string, number>; // tenantId -> view count
    dismissals?: Record<string, number>; // tenantId -> dismissal count
}

export interface OwnerAnnouncementView {
    id: string;
    announcementId: string;
    tenantId: string;
    branchId?: string;
    managerId: string;
    managerName: string;
    viewedAt: any;
    dismissedAt?: any;
    viewCount: number;
}

// ============================================================
// COLLECTION HELPERS
// ============================================================

const getAnnouncementsCollectionRef = () => collection(db, 'owner_announcements');
const getAnnouncementDocRef = (announcementId: string) => doc(db, 'owner_announcements', announcementId);
const getViewsCollectionRef = () => collection(db, 'owner_announcement_views');

// ============================================================
// ANNOUNCEMENT MANAGEMENT
// ============================================================

/**
 * Create owner announcement
 */
export const createOwnerAnnouncement = async (
    announcement: Omit<OwnerAnnouncement, 'id' | 'createdAt' | 'views' | 'dismissals'>,
    ownerId: string,
    ownerName: string
): Promise<string> => {
    try {
        const announcementData: Omit<OwnerAnnouncement, 'id'> = {
            ...announcement,
            views: {},
            dismissals: {},
            createdAt: Timestamp.now(),
            createdBy: { id: ownerId, name: ownerName }
        };

        const docRef = doc(getAnnouncementsCollectionRef());
        await setDoc(docRef, announcementData);

        return docRef.id;
    } catch (error) {
        console.error('Error creating owner announcement:', error);
        throw error;
    }
};

/**
 * Update owner announcement
 */
export const updateOwnerAnnouncement = async (
    announcementId: string,
    updates: Partial<OwnerAnnouncement>,
    ownerId: string,
    ownerName: string
): Promise<void> => {
    try {
        await updateDoc(getAnnouncementDocRef(announcementId), {
            ...updates,
            updatedAt: Timestamp.now(),
            updatedBy: { id: ownerId, name: ownerName }
        });
    } catch (error) {
        console.error('Error updating owner announcement:', error);
        throw error;
    }
};

/**
 * Delete/Deactivate owner announcement
 */
export const deactivateOwnerAnnouncement = async (announcementId: string): Promise<void> => {
    try {
        await updateDoc(getAnnouncementDocRef(announcementId), {
            isActive: false,
            deactivatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error deactivating owner announcement:', error);
        throw error;
    }
};

/**
 * Get active announcements for a manager
 */
export const getActiveAnnouncementsForManager = async (
    tenantId: string,
    branchId?: string,
    managerId?: string
): Promise<OwnerAnnouncement[]> => {
    try {
        const now = Timestamp.now();
        const q = query(
            getAnnouncementsCollectionRef(),
            where('isActive', '==', true)
        );

        const snapshot = await getDocs(q);
        const announcements: OwnerAnnouncement[] = [];

        snapshot.forEach(doc => {
            const data = doc.data() as OwnerAnnouncement;
            
            // Check if expired
            if (data.expiresAt) {
                const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                if (expiresAt < new Date()) {
                    return; // Skip expired
                }
            }

            // Check start/end date
            if (data.startDate) {
                const startDate = data.startDate.toDate ? data.startDate.toDate() : new Date(data.startDate);
                if (startDate > new Date()) {
                    return; // Not started yet
                }
            }
            if (data.endDate) {
                const endDate = data.endDate.toDate ? data.endDate.toDate() : new Date(data.endDate);
                if (endDate < new Date()) {
                    return; // Already ended
                }
            }

            // Check targeting
            if (data.targetAudience === 'all_managers') {
                // Show to all managers
            } else if (data.targetAudience === 'specific_branches' && data.targetBranches) {
                if (!branchId || !data.targetBranches.includes(branchId)) {
                    return; // Not targeted to this branch
                }
            } else if (data.targetAudience === 'specific_tenants' && data.targetTenants) {
                if (!data.targetTenants.includes(tenantId)) {
                    return; // Not targeted to this tenant
                }
            }

            announcements.push({
                id: doc.id,
                ...data
            });
        });

        // Sort by priority and creation time
        return announcements.sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return bTime.getTime() - aTime.getTime(); // Newest first
        });
    } catch (error) {
        console.error('Error getting active announcements:', error);
        return [];
    }
};

/**
 * Subscribe to active announcements for a manager (real-time)
 */
export const subscribeToOwnerAnnouncements = (
    tenantId: string,
    branchId: string | undefined,
    callback: (announcements: OwnerAnnouncement[]) => void
): (() => void) => {
    const q = query(
        getAnnouncementsCollectionRef(),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const now = new Date();
            const announcements: OwnerAnnouncement[] = [];

            snapshot.forEach(doc => {
                const data = doc.data() as OwnerAnnouncement;
                
                // Check if expired
                if (data.expiresAt) {
                    const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                    if (expiresAt < now) {
                        return; // Skip expired
                    }
                }

                // Check start/end date
                if (data.startDate) {
                    const startDate = data.startDate.toDate ? data.startDate.toDate() : new Date(data.startDate);
                    if (startDate > now) {
                        return; // Not started yet
                    }
                }
                if (data.endDate) {
                    const endDate = data.endDate.toDate ? data.endDate.toDate() : new Date(data.endDate);
                    if (endDate < now) {
                        return; // Already ended
                    }
                }

                // Check targeting
                if (data.targetAudience === 'all_managers') {
                    // Show to all managers
                } else if (data.targetAudience === 'specific_branches' && data.targetBranches) {
                    if (!branchId || !data.targetBranches.includes(branchId)) {
                        return; // Not targeted to this branch
                    }
                } else if (data.targetAudience === 'specific_tenants' && data.targetTenants) {
                    if (!data.targetTenants.includes(tenantId)) {
                        return; // Not targeted to this tenant
                    }
                }

                announcements.push({
                    id: doc.id,
                    ...data
                });
            });

            // Sort by priority and creation time
            const sorted = announcements.sort((a, b) => {
                const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) return priorityDiff;
                
                const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return bTime.getTime() - aTime.getTime();
            });

            callback(sorted);
        },
        (error) => {
            console.error('Error subscribing to owner announcements:', error);
            callback([]);
        }
    );
};

/**
 * Mark announcement as viewed
 */
export const markAnnouncementAsViewed = async (
    announcementId: string,
    tenantId: string,
    branchId: string | undefined,
    managerId: string,
    managerName: string
): Promise<void> => {
    try {
        // Check if already viewed
        const q = query(
            getViewsCollectionRef(),
            where('announcementId', '==', announcementId),
            where('tenantId', '==', tenantId),
            where('managerId', '==', managerId)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Update existing view
            const viewDoc = snapshot.docs[0];
            await updateDoc(doc(getViewsCollectionRef(), viewDoc.id), {
                viewCount: (viewDoc.data().viewCount || 0) + 1,
                viewedAt: Timestamp.now()
            });
        } else {
            // Create new view
            await addDoc(getViewsCollectionRef(), {
                announcementId,
                tenantId,
                branchId,
                managerId,
                managerName,
                viewedAt: Timestamp.now(),
                viewCount: 1
            });
        }

        // Update announcement view count
        const announcementRef = getAnnouncementDocRef(announcementId);
        const announcementSnap = await getDoc(announcementRef);
        if (announcementSnap.exists()) {
            const currentViews = announcementSnap.data().views || {};
            currentViews[tenantId] = (currentViews[tenantId] || 0) + 1;
            await updateDoc(announcementRef, {
                views: currentViews
            });
        }
    } catch (error) {
        console.error('Error marking announcement as viewed:', error);
    }
};

/**
 * Dismiss announcement
 */
export const dismissAnnouncement = async (
    announcementId: string,
    tenantId: string,
    branchId: string | undefined,
    managerId: string,
    managerName: string
): Promise<void> => {
    try {
        // Check if already dismissed
        const q = query(
            getViewsCollectionRef(),
            where('announcementId', '==', announcementId),
            where('tenantId', '==', tenantId),
            where('managerId', '==', managerId)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Update existing view with dismissal
            await updateDoc(doc(getViewsCollectionRef(), snapshot.docs[0].id), {
                dismissedAt: Timestamp.now()
            });
        } else {
            // Create new dismissal record
            await addDoc(getViewsCollectionRef(), {
                announcementId,
                tenantId,
                branchId,
                managerId,
                managerName,
                viewedAt: Timestamp.now(),
                dismissedAt: Timestamp.now(),
                viewCount: 1
            });
        }

        // Update announcement dismissal count
        const announcementRef = getAnnouncementDocRef(announcementId);
        const announcementSnap = await getDoc(announcementRef);
        if (announcementSnap.exists()) {
            const currentDismissals = announcementSnap.data().dismissals || {};
            currentDismissals[tenantId] = (currentDismissals[tenantId] || 0) + 1;
            await updateDoc(announcementRef, {
                dismissals: currentDismissals
            });
        }
    } catch (error) {
        console.error('Error dismissing announcement:', error);
    }
};

/**
 * Get all announcements (for owner management)
 */
export const getAllOwnerAnnouncements = async (): Promise<OwnerAnnouncement[]> => {
    try {
        const q = query(
            getAnnouncementsCollectionRef(),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as OwnerAnnouncement));
    } catch (error) {
        console.error('Error getting all announcements:', error);
        return [];
    }
};

/**
 * Subscribe to all announcements (for owner management)
 */
export const subscribeToAllOwnerAnnouncements = (
    callback: (announcements: OwnerAnnouncement[]) => void
): (() => void) => {
    const q = query(
        getAnnouncementsCollectionRef(),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const announcements = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as OwnerAnnouncement));
            callback(announcements);
        },
        (error) => {
            console.error('Error subscribing to all announcements:', error);
            callback([]);
        }
    );
};

/**
 * Get announcement statistics
 */
export const getAnnouncementStats = async (announcementId: string): Promise<{
    totalViews: number;
    totalDismissals: number;
    viewsByTenant: Record<string, number>;
    dismissalsByTenant: Record<string, number>;
}> => {
    try {
        const announcementSnap = await getDoc(getAnnouncementDocRef(announcementId));
        if (!announcementSnap.exists()) {
            return {
                totalViews: 0,
                totalDismissals: 0,
                viewsByTenant: {},
                dismissalsByTenant: {}
            };
        }

        const data = announcementSnap.data() as OwnerAnnouncement;
        const views = data.views || {};
        const dismissals = data.dismissals || {};

        return {
            totalViews: Object.values(views).reduce((sum, count) => sum + count, 0),
            totalDismissals: Object.values(dismissals).reduce((sum, count) => sum + count, 0),
            viewsByTenant: views,
            dismissalsByTenant: dismissals
        };
    } catch (error) {
        console.error('Error getting announcement stats:', error);
        return {
            totalViews: 0,
            totalDismissals: 0,
            viewsByTenant: {},
            dismissalsByTenant: {}
        };
    }
};
