/**
 * Backup Service
 * Automatic backup system for tenants
 * Adora Hotel Management System V3
 *
 * SaaS/tenant: Backups are tenant-scoped (TenantBackup.tenantId). Paths used for backup
 * data should align with tenant-scoped collections when migrating to full SaaS isolation.
 */

import { collection, query, where, getDocs, Timestamp, addDoc, getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface TenantBackup {
    id: string;
    tenantId: string;
    backupType: 'daily' | 'before_delete' | 'manual';
    backupDate: Date;
    data: {
        tenant?: any;
        manager?: any;
        branches?: any[];
        users?: any[];
        rooms?: any[];
        settings?: any;
        metadata?: any;
    };
    size?: number; // Backup size in bytes
    status: 'completed' | 'failed' | 'in_progress';
    restoredAt?: Date;
    expiresAt?: Date; // Auto-delete after 90 days for daily backups
}

export interface BackupMetadata {
    totalCollections: number;
    totalDocuments: number;
    backupDuration: number; // in milliseconds
    collections: string[];
}

// ============================================================
// BACKUP CREATION
// ============================================================

/**
 * Create backup for a tenant
 * @security يتطلب Firebase Config مُحمّل
 */
export async function createTenantBackup(
    tenantId: string,
    backupType: 'daily' | 'before_delete' | 'manual' = 'daily'
): Promise<string> {
    // ⚠️ تأمين: انتظار Firebase Config
    if (!db) {
        logger.warn('Backup skipped: Firebase not configured', undefined, 'backupService');
        return 'SKIPPED_NO_DB';
    }

    const startTime = Date.now();
    const backupRef = collection(db, 'tenantBackups');
    let backupId: string | null = null;

    try {
        // Create backup document
        const backupDocRef = await addDoc(backupRef, {
            tenantId,
            backupType,
            backupDate: Timestamp.now(),
            status: 'in_progress',
            expiresAt: backupType === 'daily' 
                ? Timestamp.fromDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)) // 90 days
                : null,
        });

        backupId = backupDocRef.id;

        // Collect tenant data
        const backupData: TenantBackup['data'] = {};

        // 1. Tenant info
        try {
            const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
            if (tenantDoc.exists()) {
                backupData.tenant = tenantDoc.data();
            }
        } catch (error) {
            logger.warn('Failed to backup tenant info', error, 'backupService');
        }

        // 2. Manager info
        try {
            const managersSnapshot = await getDocs(
                query(
                    collection(db, 'users'),
                    where('tenantId', '==', tenantId),
                    where('role', '==', 'manager')
                )
            );
            backupData.manager = managersSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }))[0]; // Usually one manager per tenant
        } catch (error) {
            logger.warn('Failed to backup manager info', error, 'backupService');
        }

        // 3. Branches
        try {
            const branchesSnapshot = await getDocs(
                query(
                    collection(db, 'branches'),
                    where('tenantId', '==', tenantId)
                )
            );
            backupData.branches = branchesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
        } catch (error) {
            logger.warn('Failed to backup branches', error, 'backupService');
        }

        // 4. Users (employees)
        try {
            const usersSnapshot = await getDocs(
                query(
                    collection(db, 'users'),
                    where('tenantId', '==', tenantId),
                    where('role', '==', 'employee')
                )
            );
            backupData.users = usersSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
        } catch (error) {
            logger.warn('Failed to backup users', error, 'backupService');
        }

        // 5. Rooms — tenant-scoped path
        try {
            const roomsRef = collection(db, `tenants/${tenantId}/rooms`);
            const roomsSnapshot = await getDocs(roomsRef);
            if (!roomsSnapshot.empty) {
                backupData.rooms = roomsSnapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                }));
            }
        } catch (error) {
            logger.warn('Failed to backup rooms', error, 'backupService');
        }

        // 6. Settings (system settings for tenant)
        try {
            const settingsSnapshot = await getDocs(
                query(
                    collection(db, 'systemSettings'),
                    where('tenantId', '==', tenantId)
                )
            );
            if (!settingsSnapshot.empty) {
                backupData.settings = settingsSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
            }
        } catch (error) {
            logger.warn('Failed to backup settings', error, 'backupService');
        }

        // 7. Metadata
        const backupDuration = Date.now() - startTime;
        const collections = Object.keys(backupData).filter((key) => backupData[key as keyof typeof backupData]);
        const totalDocuments = Object.values(backupData).reduce(
            (sum, data) => sum + (Array.isArray(data) ? data.length : data ? 1 : 0),
            0
        );

        backupData.metadata = {
            totalCollections: collections.length,
            totalDocuments,
            backupDuration,
            collections,
        };

        // Calculate backup size (approximate)
        const backupSize = JSON.stringify(backupData).length;

        // Update backup document with data
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'tenantBackups', backupId), {
            data: backupData,
            size: backupSize,
            status: 'completed',
            metadata: backupData.metadata,
        });

        logger.info(`Backup created for tenant ${tenantId}`, { backupId, backupType, duration: backupDuration }, 'backupService');

        return backupId;
    } catch (error: any) {
        // ✅ Handle Firestore internal errors gracefully
        if (error?.message?.includes('INTERNAL ASSERTION FAILED') || error?.message?.includes('Unexpected state')) {
            logger.warn('Firestore internal error in createTenantBackup (likely cache issue)', error, 'backupService');
            // Don't throw for internal errors - just return a failure indicator
            if (backupId) {
                try {
                    const { updateDoc } = await import('firebase/firestore');
                    await updateDoc(doc(db, 'tenantBackups', backupId), { status: 'failed' });
                } catch (updateError: any) {
                    // Silently fail - already logged above
                }
            }
            return 'FAILED_INTERNAL_ERROR';
        } else {
            // ✅ Handle permission errors gracefully (expected for non-owners)
            const isPermissionError = error?.code === 'permission-denied' || 
                                      error?.message?.includes('permission') ||
                                      error?.message?.includes('Missing or insufficient');
            
            if (isPermissionError) {
                logger.debug('Permission denied for creating backup (expected for non-owners)', undefined, 'backupService');
                // Don't throw for permission errors - just return a failure indicator
                if (backupId) {
                    try {
                        const { updateDoc } = await import('firebase/firestore');
                        await updateDoc(doc(db, 'tenantBackups', backupId), { status: 'failed' });
                    } catch (updateError: any) {
                        // Silently fail - already logged above
                    }
                }
                return 'FAILED_PERMISSION_DENIED';
            } else {
                logger.error('Failed to create backup', error, 'backupService');
            }
        }
        
        // Update backup status to failed
        if (backupId) {
            try {
                const { updateDoc } = await import('firebase/firestore');
                await updateDoc(doc(db, 'tenantBackups', backupId), { status: 'failed' });
            } catch (updateError: any) {
                // ✅ Handle Firestore internal errors gracefully
                if (updateError?.message?.includes('INTERNAL ASSERTION FAILED') || updateError?.message?.includes('Unexpected state')) {
                    logger.warn('Firestore internal error updating backup status (likely cache issue)', updateError, 'backupService');
                } else {
                    logger.error('Failed to update backup status', updateError, 'backupService');
                }
            }
        }

        throw error;
    }
}

// ============================================================
// BACKUP RETRIEVAL
// ============================================================

/**
 * Get backups for a tenant
 * @security يتطلب Firebase Config مُحمّل
 */
export async function getTenantBackups(tenantId: string): Promise<TenantBackup[]> {
    if (!db) {
        logger.warn('getTenantBackups skipped: Firebase not configured', undefined, 'backupService');
        return [];
    }
    try {
        const backupsRef = collection(db, 'tenantBackups');
        const snapshot = await getDocs(
            query(backupsRef, where('tenantId', '==', tenantId), where('status', '==', 'completed'))
        );

        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            backupDate: doc.data().backupDate?.toDate() || new Date(),
            expiresAt: doc.data().expiresAt?.toDate(),
            restoredAt: doc.data().restoredAt?.toDate(),
        })) as TenantBackup[];
    } catch (error: any) {
        // ✅ Handle Firestore internal errors gracefully
        if (error?.message?.includes('INTERNAL ASSERTION FAILED') || error?.message?.includes('Unexpected state')) {
            logger.warn('Firestore internal error in getTenantBackups (likely cache issue)', error, 'backupService');
        } else {
            // ✅ Handle permission errors gracefully (expected for non-owners)
            const isPermissionError = error?.code === 'permission-denied' || 
                                      error?.message?.includes('permission') ||
                                      error?.message?.includes('Missing or insufficient');
            
            if (isPermissionError) {
                logger.debug('Permission denied for tenant backups (expected for non-owners)', undefined, 'backupService');
            } else {
                logger.error('Failed to get tenant backups', error, 'backupService');
            }
        }
        return [];
    }
}

/**
 * Get latest backup for a tenant
 */
export async function getLatestBackup(tenantId: string): Promise<TenantBackup | null> {
    const backups = await getTenantBackups(tenantId);
    if (backups.length === 0) return null;

    return backups.sort((a, b) => b.backupDate.getTime() - a.backupDate.getTime())[0];
}

/**
 * Get backup by ID
 * @security يتطلب Firebase Config مُحمّل
 */
export async function getBackupById(backupId: string): Promise<TenantBackup | null> {
    if (!db) {
        logger.warn('getBackupById skipped: Firebase not configured', undefined, 'backupService');
        return null;
    }
    try {
        const backupDoc = await getDoc(doc(db, 'tenantBackups', backupId));
        if (!backupDoc.exists()) return null;

        const data = backupDoc.data();
        return {
            id: backupDoc.id,
            ...data,
            backupDate: data.backupDate?.toDate() || new Date(),
            expiresAt: data.expiresAt?.toDate(),
            restoredAt: data.restoredAt?.toDate(),
        } as TenantBackup;
    } catch (error) {
        logger.error('Failed to get backup by ID', error, 'backupService');
        return null;
    }
}

// ============================================================
// AUTOMATIC DAILY BACKUP
// ============================================================

/**
 * Create daily backups for all active tenants
 */
export async function createDailyBackupsForAllTenants(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // Guard: Skip if Firebase not initialized
    if (!db) {
        logger.debug('[BackupScheduler] Skipped - Firebase not initialized', null, 'backupService');
        return { success: 0, failed: 0 };
    }

    try {
        // Get all tenants (we'll filter active ones manually since structure varies)
        const tenantsRef = collection(db, 'tenants');
        let tenantsSnapshot;
        try {
            tenantsSnapshot = await getDocs(tenantsRef);
        } catch (error: any) {
            // ✅ Handle Firestore internal errors gracefully
            if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
                logger.warn('Firestore internal error in createDailyBackupsForAllTenants (likely cache issue)', error, 'backupService');
                return { success: 0, failed: 0 };
            }
            throw error;
        }
        
        // Filter to only active tenants (check multiple possible status locations)
        const activeTenants = tenantsSnapshot.docs.filter(doc => {
            const data = doc.data();
            // Check various possible status field locations
            const status = data.status || data.info?.status || data.licenseStatus || 'active';
            return status === 'active' && !data.deleted;
        });

        // Log how many tenants found
        logger.debug(`[BackupScheduler] Found ${activeTenants.length} active tenants for backup`, null, 'backupService');

        for (const tenantDoc of activeTenants) {
            const tenantId = tenantDoc.id;

            try {
                // Check if backup already exists for today
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const backups = await getTenantBackups(tenantId);
                const todayBackup = backups.find((backup) => {
                    const backupDate = new Date(backup.backupDate);
                    backupDate.setHours(0, 0, 0, 0);
                    return backupDate.getTime() === today.getTime() && backup.backupType === 'daily';
                });

                // Only create backup if one doesn't exist for today
                if (!todayBackup) {
                    await createTenantBackup(tenantId, 'daily');
                    success++;
                    logger.debug(`[BackupScheduler] Created backup for tenant ${tenantId}`, null, 'backupService');
                } else {
                    logger.debug(`[BackupScheduler] Skipped tenant ${tenantId} - backup already exists today`, null, 'backupService');
                }
            } catch (error: any) {
                // ✅ Handle Firestore internal errors gracefully
                if (error?.message?.includes('INTERNAL ASSERTION FAILED') || error?.message?.includes('Unexpected state')) {
                    logger.warn(`Firestore internal error creating backup for tenant ${tenantId} (likely cache issue)`, error, 'backupService');
                } else {
                    logger.error(`Failed to create daily backup for tenant ${tenantId}`, error, 'backupService');
                }
                failed++;
            }
        }
    } catch (error: any) {
        // ✅ Handle Firestore internal errors gracefully
        if (error?.message?.includes('INTERNAL ASSERTION FAILED') || error?.message?.includes('Unexpected state')) {
            logger.warn('Firestore internal error in createDailyBackupsForAllTenants (likely cache issue)', error, 'backupService');
        } else {
            logger.error('Failed to create daily backups', error, 'backupService');
        }
    }

    logger.debug(`[BackupScheduler] Completed: ${success} succeeded, ${failed} failed`, null, 'backupService');
    return { success, failed };
}

// ============================================================
// BACKUP RESTORATION
// ============================================================

/**
 * Mark backup as restored
 * @security يتطلب Firebase Config مُحمّل
 */
export async function markBackupAsRestored(backupId: string): Promise<void> {
    if (!db) {
        logger.warn('markBackupAsRestored skipped: Firebase not configured', undefined, 'backupService');
        return;
    }
    try {
        const { updateDoc } = await import('firebase/firestore');
        const backupRef = doc(db, 'tenantBackups', backupId);
        await updateDoc(backupRef, {
            restoredAt: Timestamp.now(),
        });
    } catch (error) {
        logger.error('Failed to mark backup as restored', error, 'backupService');
        throw error;
    }
}
