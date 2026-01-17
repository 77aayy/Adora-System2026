/**
 * Clean Slate Service 🧹
 * Complete database wipe for UAT preparation
 * 
 * ⚠️ CRITICAL: This service PERMANENTLY DELETES all business data
 * ✅ PROTECTED: Owner-only access with exclusions
 * ✅ SAFE: Preserves system configurations and specified tenant
 * 
 * Adora Hotel Management System V3
 */

import { db } from './firebase';
import {
    collection,
    query,
    getDocs,
    deleteDoc,
    doc,
    writeBatch,
    limit,
    getDoc
} from 'firebase/firestore';
import { validateRoleAccess } from './tenantSecurityService';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface CleanSlateReport {
    preservedTenantId: string;
    dryRun: boolean;
    tenantsDeleted: string[];
    collectionsCleaned: {
        tenantId: string;
        collection: string;
        path: string;
        count: number;
    }[];
    subCollectionsCleaned: {
        tenantPath: string;
        subCollection: string;
        count: number;
    }[];
    totalRecordsDeleted: number;
    errors: string[];
    timestamp: Date;
}

export interface CleanSlateOptions {
    preservedTenantId: string; // Tenant ID to preserve (your tenant)
    dryRun?: boolean; // If true, only simulate - don't delete
}

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Collections to clean for each tenant
 */
const BUSINESS_DATA_COLLECTIONS = [
    'branches',
    'rooms',
    'roomCards',
    'employees',
    'requests',
    'procurementRequests',
    'procurement_orders',
    'procurement_requests',
    'lost_found',
    'activityLogs',
    'adminActivityLogs',
    'data_doctor_logs',
    'notifications',
    'procurementNotifications',
    'procurementLogs',
    'procurementReceipts',
    'secureAccessTokens',
    'minibar_consumption',
    'coffee_orders',
    'financial_transactions',
    'chat_rooms',
    'wallet_transactions',
    'pointsHistory',
    'gamification_logs',
    'loyalty_program_logs',
];

/**
 * Sub-collections to clean recursively
 */
const SUB_COLLECTIONS_TO_CLEAN = [
    { parentCollection: 'branches', subCollections: ['coffee_orders', 'financial_transactions', 'chat_rooms'] },
    { parentCollection: 'employees', subCollections: ['wallet_transactions', 'pointsHistory'] },
    { parentCollection: 'roomCards', subCollections: ['transactions', 'services'] },
];

/**
 * Root collections to PRESERVE (never delete)
 */
const PRESERVED_ROOT_COLLECTIONS = [
    'systemConfigs',
    'globalCodes',
    'users', // User authentication accounts
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Recursively delete all documents in a collection (with batching)
 */
const deleteCollectionBatch = async (collectionPath: string, batchSize: number = 500): Promise<number> => {
    if (!db) throw new Error('Firebase not initialized');

    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
        const collectionRef = collection(db, collectionPath);
        const q = query(collectionRef, limit(batchSize));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            hasMore = false;
            break;
        }

        const batch = writeBatch(db);
        snapshot.docs.forEach((docSnapshot) => {
            batch.delete(docSnapshot.ref);
        });

        await batch.commit();
        totalDeleted += snapshot.size;

        // If we got fewer than batchSize, we're done
        if (snapshot.size < batchSize) {
            hasMore = false;
        }
    }

    return totalDeleted;
};

/**
 * Recursively delete all sub-collections of a document
 */
const deleteSubCollections = async (parentPath: string, subCollectionNames: string[]): Promise<number> => {
    if (!db) throw new Error('Firebase not initialized');

    let totalDeleted = 0;

    for (const subCollectionName of subCollectionNames) {
        try {
            const subCollectionPath = `${parentPath}/${subCollectionName}`;
            const deleted = await deleteCollectionBatch(subCollectionPath);
            totalDeleted += deleted;
            logger.info(`Deleted ${deleted} documents from ${subCollectionPath}`);
        } catch (error: any) {
            logger.error(`Failed to delete sub-collection ${subCollectionName} in ${parentPath}: ${error.message}`);
            // Continue with other sub-collections
        }
    }

    return totalDeleted;
};

/**
 * Clean all business data for a specific tenant
 */
const cleanTenantBusinessData = async (tenantId: string, dryRun: boolean): Promise<{
    collectionsCleaned: CleanSlateReport['collectionsCleaned'];
    subCollectionsCleaned: CleanSlateReport['subCollectionsCleaned'];
    totalDeleted: number;
    errors: string[];
}> => {
    if (!db) throw new Error('Firebase not initialized');

    const collectionsCleaned: CleanSlateReport['collectionsCleaned'] = [];
    const subCollectionsCleaned: CleanSlateReport['subCollectionsCleaned'] = [];
    const errors: string[] = [];
    let totalDeleted = 0;

    // Clean main collections
    for (const collectionName of BUSINESS_DATA_COLLECTIONS) {
        try {
            const collectionPath = `tenants/${tenantId}/${collectionName}`;
            const collectionRef = collection(db, collectionPath);
            const snapshot = await getDocs(collectionRef);
            const count = snapshot.size;

            if (count > 0) {
                if (!dryRun) {
                    const deleted = await deleteCollectionBatch(collectionPath);
                    totalDeleted += deleted;
                    logger.info(`Deleted ${deleted} documents from ${collectionPath}`);
                } else {
                    totalDeleted += count;
                }

                collectionsCleaned.push({
                    tenantId,
                    collection: collectionName,
                    path: collectionPath,
                    count
                });
            }

            // Clean sub-collections if applicable
            for (const subConfig of SUB_COLLECTIONS_TO_CLEAN) {
                if (collectionName === subConfig.parentCollection) {
                    for (const docSnapshot of snapshot.docs) {
                        const docId = docSnapshot.id;
                        const parentPath = `${collectionPath}/${docId}`;
                        
                        if (!dryRun) {
                            const deleted = await deleteSubCollections(parentPath, subConfig.subCollections);
                            totalDeleted += deleted;
                        }

                        // Count sub-collections for report
                        for (const subCollection of subConfig.subCollections) {
                            try {
                                const subPath = `${parentPath}/${subCollection}`;
                                const subSnapshot = await getDocs(collection(db, subPath));
                                if (subSnapshot.size > 0) {
                                    subCollectionsCleaned.push({
                                        tenantPath: parentPath,
                                        subCollection,
                                        count: subSnapshot.size
                                    });
                                    if (dryRun) {
                                        totalDeleted += subSnapshot.size;
                                    }
                                }
                            } catch (e) {
                                // Ignore - sub-collection may not exist
                            }
                        }
                    }
                }
            }
        } catch (error: any) {
            const errorMsg = `Failed to clean ${collectionName} for tenant ${tenantId}: ${error.message}`;
            errors.push(errorMsg);
            logger.error(errorMsg);
        }
    }

    // Clean branches sub-collections (coffee_orders, financial_transactions, etc.)
    try {
        const branchesRef = collection(db, `tenants/${tenantId}/branches`);
        const branchesSnapshot = await getDocs(branchesRef);

        for (const branchDoc of branchesSnapshot.docs) {
            const branchId = branchDoc.id;
            const branchPath = `tenants/${tenantId}/branches/${branchId}`;

            const branchSubCollections = ['coffee_orders', 'financial_transactions', 'chat_rooms'];
            if (!dryRun) {
                const deleted = await deleteSubCollections(branchPath, branchSubCollections);
                totalDeleted += deleted;
            }

            // Count for report
            for (const subCollection of branchSubCollections) {
                try {
                    const subPath = `${branchPath}/${subCollection}`;
                    const subSnapshot = await getDocs(collection(db, subPath));
                    if (subSnapshot.size > 0) {
                        subCollectionsCleaned.push({
                            tenantPath: branchPath,
                            subCollection,
                            count: subSnapshot.size
                        });
                        if (dryRun) {
                            totalDeleted += subSnapshot.size;
                        }
                    }
                } catch (e) {
                    // Ignore - sub-collection may not exist
                }
            }
        }
    } catch (error: any) {
        const errorMsg = `Failed to clean branch sub-collections for tenant ${tenantId}: ${error.message}`;
        errors.push(errorMsg);
        logger.error(errorMsg);
    }

    // Clean employee sub-collections (wallet_transactions, pointsHistory)
    try {
        const employeesRef = collection(db, `tenants/${tenantId}/employees`);
        const employeesSnapshot = await getDocs(employeesRef);

        for (const empDoc of employeesSnapshot.docs) {
            const employeeId = empDoc.id;
            const empPath = `tenants/${tenantId}/employees/${employeeId}`;

            const empSubCollections = ['wallet_transactions', 'pointsHistory'];
            if (!dryRun) {
                const deleted = await deleteSubCollections(empPath, empSubCollections);
                totalDeleted += deleted;
            }

            // Count for report
            for (const subCollection of empSubCollections) {
                try {
                    const subPath = `${empPath}/${subCollection}`;
                    const subSnapshot = await getDocs(collection(db, subPath));
                    if (subSnapshot.size > 0) {
                        subCollectionsCleaned.push({
                            tenantPath: empPath,
                            subCollection,
                            count: subSnapshot.size
                        });
                        if (dryRun) {
                            totalDeleted += subSnapshot.size;
                        }
                    }
                } catch (e) {
                    // Ignore - sub-collection may not exist
                }
            }

            // Reset employee points (if not dry run)
            if (!dryRun) {
                try {
                    const empRef = doc(db, `tenants/${tenantId}/employees/${employeeId}`);
                    const empData = empDoc.data();
                    if (empData.points || empData.currentPoints || empData.personalPoints) {
                        const batch = writeBatch(db);
                        batch.update(empRef, {
                            points: 0,
                            currentPoints: 0,
                            personalPoints: 0,
                        });
                        await batch.commit();
                        logger.info(`Reset points for employee ${employeeId}`);
                    }
                } catch (e: any) {
                    logger.error(`Failed to reset points for employee ${employeeId}: ${e.message}`);
                }
            }
        }
    } catch (error: any) {
        const errorMsg = `Failed to clean employee sub-collections for tenant ${tenantId}: ${error.message}`;
        errors.push(errorMsg);
        logger.error(errorMsg);
    }

    return { collectionsCleaned, subCollectionsCleaned, totalDeleted, errors };
};

// ============================================================
// MAIN CLEAN SLATE FUNCTION
// ============================================================

/**
 * Complete Clean Slate: Delete all business data from all tenants except preserved tenant
 * ⚠️ CRITICAL: This PERMANENTLY DELETES all business data!
 */
export const performCleanSlate = async (options: CleanSlateOptions): Promise<CleanSlateReport> => {
    // ✅ RBAC: Only Owner can perform clean slate
    validateRoleAccess('owner');

    const { preservedTenantId, dryRun = false } = options;

    if (!preservedTenantId) {
        throw new Error('Preserved Tenant ID is required');
    }

    if (!db) {
        throw new Error('Firebase not initialized');
    }

    const report: CleanSlateReport = {
        preservedTenantId,
        dryRun,
        tenantsDeleted: [],
        collectionsCleaned: [],
        subCollectionsCleaned: [],
        totalRecordsDeleted: 0,
        errors: [],
        timestamp: new Date()
    };

    try {
        // Get all tenants
        const tenantsRef = collection(db, 'tenants');
        const tenantsSnapshot = await getDocs(tenantsRef);

        logger.info(`Found ${tenantsSnapshot.size} tenants. Preserving tenant: ${preservedTenantId}`);

        // Clean each tenant (except preserved one)
        for (const tenantDoc of tenantsSnapshot.docs) {
            const tenantId = tenantDoc.id;

            // Skip preserved tenant
            if (tenantId === preservedTenantId) {
                logger.info(`Skipping preserved tenant: ${tenantId}`);
                continue;
            }

            try {
                logger.info(`Cleaning tenant: ${tenantId} (${dryRun ? 'DRY RUN' : 'ACTUAL DELETE'})`);

                const { collectionsCleaned, subCollectionsCleaned, totalDeleted, errors } = 
                    await cleanTenantBusinessData(tenantId, dryRun);

                report.collectionsCleaned.push(...collectionsCleaned);
                report.subCollectionsCleaned.push(...subCollectionsCleaned);
                report.totalRecordsDeleted += totalDeleted;
                report.errors.push(...errors);

                if (!dryRun) {
                    report.tenantsDeleted.push(tenantId);
                }

                logger.info(`Cleaned ${totalDeleted} records from tenant ${tenantId}`);
            } catch (error: any) {
                const errorMsg = `Failed to clean tenant ${tenantId}: ${error.message}`;
                report.errors.push(errorMsg);
                logger.error(errorMsg);
            }
        }

        // Also clean preserved tenant's business data (but keep tenant document)
        logger.info(`Cleaning business data for preserved tenant: ${preservedTenantId}`);
        const { collectionsCleaned, subCollectionsCleaned, totalDeleted, errors } = 
            await cleanTenantBusinessData(preservedTenantId, dryRun);

        report.collectionsCleaned.push(...collectionsCleaned);
        report.subCollectionsCleaned.push(...subCollectionsCleaned);
        report.totalRecordsDeleted += totalDeleted;
        report.errors.push(...errors);

        logger.info(`Clean Slate complete. Total records deleted: ${report.totalRecordsDeleted}`);

    } catch (error: any) {
        const errorMsg = `Clean Slate failed: ${error.message}`;
        report.errors.push(errorMsg);
        logger.error(errorMsg);
        throw error;
    }

    return report;
};

// ============================================================
// DRY RUN (ANALYSIS ONLY)
// ============================================================

/**
 * Analyze what would be deleted (without actually deleting)
 */
export const analyzeCleanSlate = async (preservedTenantId: string): Promise<CleanSlateReport> => {
    return performCleanSlate({
        preservedTenantId,
        dryRun: true
    });
};
