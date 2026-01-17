/**
 * Manager Announcement Service
 * Allows manager to send urgent announcements to all departments
 * Appears as news ticker/banner at the top of all department dashboards
 * Adora Hotel Management System V2
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, Timestamp, addDoc, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { autoTranslateNewText } from './dynamicTranslationService'; // ✅ Auto-translation

// ============================================================
// TYPES
// ============================================================

export type DepartmentType = 'reception' | 'housekeeping' | 'maintenance' | 'bellman' | 'coffee_shop' | 'procurement' | 'all';

export interface ManagerAnnouncement {
    id: string;
    
    // Content
    title: string;
    titleAr: string;
    message: string;
    messageAr: string;
    
    // Type
    type: 'power_outage' | 'water_outage' | 'maintenance_alert' | 'urgent' | 'general' | 'system_update';
    priority: 'low' | 'medium' | 'high' | 'critical';
    
    // Targeting
    targetDepartments: DepartmentType[]; // Which departments to show this to ('all' means all departments)
    targetBranches?: string[]; // Branch IDs (optional - if empty, applies to all branches)
    
    // Display Settings
    showAsBanner: boolean; // Show as scrolling ticker
    showAsModal: boolean; // Show as popup modal
    autoShow: boolean; // Auto-show on page load
    dismissible: boolean; // Can be dismissed
    
    // Timing
    startDate?: any; // When to start showing
    endDate?: any; // When to stop showing
    expiresAt?: any; // Auto-expire date
    scheduledTime?: string; // e.g., "5:00 PM" for "Power outage at 5:00 PM"
    
    // Status
    isActive: boolean;
    createdAt: any;
    createdBy: { id: string; name: string };
    
    // Tenant/Branch
    tenantId: string;
    branchId?: string; // If empty, applies to all branches in tenant
    
    // Tracking
    views?: Record<string, number>; // employeeId -> view count
    dismissals?: Record<string, number>; // employeeId -> dismissal count
}

export interface ManagerAnnouncementView {
    id: string;
    announcementId: string;
    employeeId: string;
    employeeName: string;
    department: string;
    branchId?: string;
    viewedAt: any;
    dismissedAt?: any;
    viewCount: number;
}

export interface AnnouncementAuditLog {
    announcementId: string;
    views: ManagerAnnouncementView[];
    totalViews: number;
    totalDismissals: number;
    viewedBy: string[]; // employee IDs
    dismissedBy: string[]; // employee IDs
}

// ============================================================
// COLLECTION HELPERS
// ============================================================

const getAnnouncementsCollectionRef = (tenantId: string) => {
    if (!db) {
        console.error('[managerAnnouncementService] Firestore not initialized');
        throw new Error('Firestore not initialized');
    }
    return collection(db, 'tenants', tenantId, 'manager_announcements');
};
const getAnnouncementDocRef = (tenantId: string, announcementId: string) => 
    doc(db, 'tenants', tenantId, 'manager_announcements', announcementId);
const getViewsCollectionRef = (tenantId: string) => 
    collection(db, 'tenants', tenantId, 'manager_announcement_views');

// ============================================================
// ANNOUNCEMENT MANAGEMENT
// ============================================================

/**
 * Create manager announcement
 */
export const createManagerAnnouncement = async (
    tenantId: string,
    announcement: Omit<ManagerAnnouncement, 'id' | 'createdAt' | 'views' | 'dismissals' | 'tenantId'>,
    managerId: string,
    managerName: string
): Promise<string> => {
    try {
        const announcementData: Omit<ManagerAnnouncement, 'id'> = {
            ...announcement,
            tenantId,
            views: {},
            dismissals: {},
            createdAt: Timestamp.now(),
            createdBy: { id: managerId, name: managerName }
        };

        const docRef = doc(getAnnouncementsCollectionRef(tenantId));
        await setDoc(docRef, announcementData);

        // ✅ AUTO-TRANSLATE: Translate Arabic text to all languages automatically
        if (announcement.titleAr || announcement.messageAr) {
            try {
                // Translate title
                if (announcement.titleAr) {
                    await autoTranslateNewText(
                        tenantId,
                        `announcement_${docRef.id}_title`,
                        announcement.titleAr
                    );
                }
                // Translate message
                if (announcement.messageAr) {
                    await autoTranslateNewText(
                        tenantId,
                        `announcement_${docRef.id}_message`,
                        announcement.messageAr
                    );
                }
            } catch (translationError) {
                // Don't fail the announcement creation if translation fails
                console.warn('Auto-translation failed for announcement:', translationError);
            }
        }

        return docRef.id;
    } catch (error) {
        console.error('Error creating manager announcement:', error);
        throw error;
    }
};

/**
 * Update manager announcement
 */
export const updateManagerAnnouncement = async (
    tenantId: string,
    announcementId: string,
    updates: Partial<ManagerAnnouncement>,
    managerId: string,
    managerName: string
): Promise<void> => {
    try {
        await updateDoc(getAnnouncementDocRef(tenantId, announcementId), {
            ...updates,
            updatedAt: Timestamp.now(),
            updatedBy: { id: managerId, name: managerName }
        });
    } catch (error) {
        console.error('Error updating manager announcement:', error);
        throw error;
    }
};

/**
 * Delete/Deactivate manager announcement
 */
export const deactivateManagerAnnouncement = async (tenantId: string, announcementId: string): Promise<void> => {
    try {
        await updateDoc(getAnnouncementDocRef(tenantId, announcementId), {
            isActive: false,
            deactivatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error deactivating manager announcement:', error);
        throw error;
    }
};

/**
 * Get active announcements for an employee/department
 */
export const getActiveAnnouncementsForDepartment = async (
    tenantId: string,
    department: string,
    branchId?: string
): Promise<ManagerAnnouncement[]> => {
    try {
        const now = Timestamp.now();
        const q = query(
            getAnnouncementsCollectionRef(tenantId),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const announcements: ManagerAnnouncement[] = [];

        snapshot.forEach(doc => {
            const data = doc.data() as ManagerAnnouncement;
            
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

            // Check branch targeting
            if (data.branchId && branchId && data.branchId !== branchId) {
                return; // Not for this branch
            }

            // Check department targeting
            if (!data.targetDepartments.includes('all') && !data.targetDepartments.includes(department as DepartmentType)) {
                return; // Not for this department
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
 * Subscribe to active announcements for a department (real-time)
 */
export const subscribeToManagerAnnouncements = (
    tenantId: string,
    department: string,
    branchId: string | undefined,
    callback: (announcements: ManagerAnnouncement[]) => void
): (() => void) => {
    if (!db) {
        console.error('[managerAnnouncementService] Firestore not initialized');
        callback([]);
        return () => {};
    }

    console.log('[managerAnnouncementService] Subscribing to announcements:', { tenantId, department, branchId });
    
    // ✅ FIX: Try with orderBy first, fallback to simple query if index missing
    let q = query(
        getAnnouncementsCollectionRef(tenantId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            console.log('[managerAnnouncementService] ✅ Snapshot received:', snapshot.size, 'documents');
            const now = new Date();
            const announcements: ManagerAnnouncement[] = [];

            snapshot.forEach(doc => {
                const data = doc.data() as ManagerAnnouncement;
                
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

                // Check branch targeting
                if (data.branchId && branchId && data.branchId !== branchId) {
                    return; // Not for this branch
                }

                // Check department targeting
                if (!data.targetDepartments.includes('all') && !data.targetDepartments.includes(department as DepartmentType)) {
                    return; // Not for this department
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
        (error: any) => {
            console.error('[managerAnnouncementService] ❌ Error subscribing:', error.code, error.message);
            
            // ✅ FIX: Fallback to simple query without orderBy if index missing
            if (error.code === 'failed-precondition') {
                const fallbackQ = query(
                    getAnnouncementsCollectionRef(tenantId),
                    where('isActive', '==', true)
                );
                
                return onSnapshot(
                    fallbackQ,
                    (snapshot) => {
                        const now = new Date();
                        const announcements: ManagerAnnouncement[] = [];

                        snapshot.forEach(doc => {
                            const data = doc.data() as ManagerAnnouncement;
                            
                            // Check if expired
                            if (data.expiresAt) {
                                const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                                if (expiresAt < now) return;
                            }

                            // Check start/end date
                            if (data.startDate) {
                                const startDate = data.startDate.toDate ? data.startDate.toDate() : new Date(data.startDate);
                                if (startDate > now) return;
                            }
                            if (data.endDate) {
                                const endDate = data.endDate.toDate ? data.endDate.toDate() : new Date(data.endDate);
                                if (endDate < now) return;
                            }

                            // Check branch targeting
                            if (data.branchId && branchId && data.branchId !== branchId) return;

                            // Check department targeting
                            if (!data.targetDepartments.includes('all') && !data.targetDepartments.includes(department as DepartmentType)) return;

                            announcements.push({
                                id: doc.id,
                                ...data
                            });
                        });

                        // Sort by priority and creation time (client-side)
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
                    (fallbackError) => {
                        console.error('[managerAnnouncementService] ❌ Fallback query also failed:', fallbackError);
                        callback([]);
                    }
                );
            } else {
                callback([]);
            }
        }
    );
};

/**
 * Mark announcement as viewed
 */
export const markManagerAnnouncementAsViewed = async (
    tenantId: string,
    announcementId: string,
    employeeId: string,
    employeeName: string,
    department: string,
    branchId: string | undefined
): Promise<void> => {
    try {
        // Check if already viewed
        const q = query(
            getViewsCollectionRef(tenantId),
            where('announcementId', '==', announcementId),
            where('employeeId', '==', employeeId)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Update existing view
            const viewDoc = snapshot.docs[0];
            await updateDoc(doc(getViewsCollectionRef(tenantId), viewDoc.id), {
                viewCount: (viewDoc.data().viewCount || 0) + 1,
                viewedAt: Timestamp.now()
            });
        } else {
            // Create new view
            await addDoc(getViewsCollectionRef(tenantId), {
                announcementId,
                employeeId,
                employeeName,
                department,
                branchId,
                viewedAt: Timestamp.now(),
                viewCount: 1
            });
        }

        // Update announcement view count
        const announcementRef = getAnnouncementDocRef(tenantId, announcementId);
        const announcementSnap = await getDoc(announcementRef);
        if (announcementSnap.exists()) {
            const currentViews = announcementSnap.data().views || {};
            currentViews[employeeId] = (currentViews[employeeId] || 0) + 1;
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
export const dismissManagerAnnouncement = async (
    tenantId: string,
    announcementId: string,
    employeeId: string,
    employeeName: string,
    department: string,
    branchId: string | undefined
): Promise<void> => {
    try {
        // Check if already dismissed
        const q = query(
            getViewsCollectionRef(tenantId),
            where('announcementId', '==', announcementId),
            where('employeeId', '==', employeeId)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Update existing view with dismissal
            await updateDoc(doc(getViewsCollectionRef(tenantId), snapshot.docs[0].id), {
                dismissedAt: Timestamp.now()
            });
        } else {
            // Create new dismissal record
            await addDoc(getViewsCollectionRef(tenantId), {
                announcementId,
                employeeId,
                employeeName,
                department,
                branchId,
                viewedAt: Timestamp.now(),
                dismissedAt: Timestamp.now(),
                viewCount: 1
            });
        }

        // Update announcement dismissal count
        const announcementRef = getAnnouncementDocRef(tenantId, announcementId);
        const announcementSnap = await getDoc(announcementRef);
        if (announcementSnap.exists()) {
            const currentDismissals = announcementSnap.data().dismissals || {};
            currentDismissals[employeeId] = (currentDismissals[employeeId] || 0) + 1;
            await updateDoc(announcementRef, {
                dismissals: currentDismissals
            });
        }
    } catch (error) {
        console.error('Error dismissing announcement:', error);
    }
};

/**
 * Get all announcements (for manager management)
 */
export const getAllManagerAnnouncements = async (tenantId: string): Promise<ManagerAnnouncement[]> => {
    try {
        const q = query(
            getAnnouncementsCollectionRef(tenantId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ManagerAnnouncement));
    } catch (error) {
        console.error('Error getting all announcements:', error);
        return [];
    }
};

/**
 * Subscribe to all announcements (for manager management)
 */
export const subscribeToAllManagerAnnouncements = (
    tenantId: string,
    callback: (announcements: ManagerAnnouncement[]) => void
): (() => void) => {
    const q = query(
        getAnnouncementsCollectionRef(tenantId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const announcements = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ManagerAnnouncement));
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
export const getManagerAnnouncementStats = async (
    tenantId: string,
    announcementId: string
): Promise<{
    totalViews: number;
    totalDismissals: number;
    viewsByDepartment: Record<string, number>;
    dismissalsByDepartment: Record<string, number>;
}> => {
    try {
        const announcementSnap = await getDoc(getAnnouncementDocRef(tenantId, announcementId));
        if (!announcementSnap.exists()) {
            return {
                totalViews: 0,
                totalDismissals: 0,
                viewsByDepartment: {},
                dismissalsByDepartment: {}
            };
        }

        // Get views from views collection
        const viewsQ = query(
            getViewsCollectionRef(tenantId),
            where('announcementId', '==', announcementId)
        );
        const viewsSnapshot = await getDocs(viewsQ);

        const viewsByDept: Record<string, number> = {};
        const dismissalsByDept: Record<string, number> = {};
        let totalViews = 0;
        let totalDismissals = 0;

        viewsSnapshot.forEach(viewDoc => {
            const viewData = viewDoc.data();
            const dept = viewData.department || 'unknown';
            const count = viewData.viewCount || 1;
            
            viewsByDept[dept] = (viewsByDept[dept] || 0) + count;
            totalViews += count;

            if (viewData.dismissedAt) {
                dismissalsByDept[dept] = (dismissalsByDept[dept] || 0) + 1;
                totalDismissals += 1;
            }
        });

        return {
            totalViews,
            totalDismissals,
            viewsByDepartment: viewsByDept,
            dismissalsByDepartment: dismissalsByDept
        };
    } catch (error) {
        console.error('Error getting announcement stats:', error);
        return {
            totalViews: 0,
            totalDismissals: 0,
            viewsByDepartment: {},
            dismissalsByDepartment: {}
        };
    }
};

/**
 * Get audit log for an announcement (views and dismissals)
 */
export const getAnnouncementAuditLog = async (
    tenantId: string,
    announcementId: string
): Promise<AnnouncementAuditLog> => {
    try {
        const viewsQuery = query(
            getViewsCollectionRef(tenantId),
            where('announcementId', '==', announcementId)
        );
        const viewsSnapshot = await getDocs(viewsQuery);
        
        const views = viewsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ManagerAnnouncementView));

        const totalViews = views.reduce((sum, v) => sum + (v.viewCount || 0), 0);
        const totalDismissals = views.filter(v => v.dismissedAt).length;
        const viewedBy = [...new Set(views.map(v => v.employeeId))];
        const dismissedBy = [...new Set(views.filter(v => v.dismissedAt).map(v => v.employeeId))];

        return {
            announcementId,
            views,
            totalViews,
            totalDismissals,
            viewedBy,
            dismissedBy
        };
    } catch (error) {
        console.error('Error getting announcement audit log:', error);
        return {
            announcementId,
            views: [],
            totalViews: 0,
            totalDismissals: 0,
            viewedBy: [],
            dismissedBy: []
        };
    }
};
