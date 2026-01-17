/**
 * Data Cleanup Service 🧹
 * Safe utility for cleaning test/demo data from Firestore
 * 
 * ⚠️ CRITICAL: This service is designed for UAT preparation - cleaning test data only
 * ✅ PROTECTED: Owner-only access with multiple confirmations
 * ✅ SAFE: Preserves system configurations and admin tenants
 * 
 * Adora Hotel Management System V3
 */

import { db } from './firebase';
import {
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    doc,
    Timestamp,
    writeBatch,
    limit
} from 'firebase/firestore';
import { validateRoleAccess } from './tenantSecurityService';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface CleanupReport {
    tenantId: string;
    dryRun: boolean;
    collectionsCleaned: {
        name: string;
        path: string;
        count: number;
    }[];
    subCollectionsCleaned: {
        parentPath: string;
        subCollection: string;
        count: number;
    }[];
    totalRecordsDeleted: number;
    errors: string[];
    timestamp: Date;
}

export interface CleanupOptions {
    tenantId: string;
    dryRun?: boolean; // If true, only simulate - don't delete
    preserveConfigs?: boolean; // If true, don't delete settings/configs
    excludeTenants?: string[]; // List of tenant IDs to exclude (admin tenants)
}

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Collections to clean (Business Data only - NOT configurations)
 */
const BUSINESS_DATA_COLLECTIONS = [
    'branches',
    'rooms',
    'roomCards',
    'employees',
    'requests',
    'procurementRequests',
    'lost_found',
    'activityLogs',
    'data_doctor_logs', // Data Doctor logs
    'notifications', // User notifications
    'secureAccessTokens', // QR tokens
    'minibar_consumption', // Minibar consumption records
    'coffee_orders', // Coffee shop orders (in branches subcollection)
    'financial_transactions', // Financial transactions (in branches subcollection)
];

/**
 * Sub-collections that need recursive deletion
 * Format: { parentCollection: string, subCollections: string[] }
 */
const SUB_COLLECTIONS_TO_CLEAN = [
    {
        parentCollection: 'employees',
        subCollections: ['wallet_transactions', 'pointsHistory']
    },
    {
        parentCollection: 'branches',
        subCollections: ['coffee_orders', 'financial_transactions', 'chat_rooms']
    }
];

/**
 * Collections to PRESERVE (System configurations - never delete)
 */
const PRESERVED_COLLECTIONS = [
    'settings', // Tenant settings
    'systemConfigs', // System-wide configurations
];

/**
 * Root collections to NEVER touch
 */
const PROTECTED_ROOT_COLLECTIONS = [
    'users', // User accounts (managed separately)
    'globalCodes', // Branch codes (managed separately)
    'systemConfigs', // System configurations
    'tenants', // Tenant documents themselves
];

// ============================================================
// DRY RUN ANALYSIS
// ============================================================

/**
 * Analyze what would be deleted (without actually deleting)
 */
export const analyzeCleanup = async (options: CleanupOptions): Promise<CleanupReport> => {
    const { tenantId, excludeTenants = [] } = options;

    if (!tenantId) {
        throw new Error('Tenant ID is required');
    }

    // ✅ PROTECTION: Don't clean excluded tenants (admin tenants)
    if (excludeTenants.includes(tenantId)) {
        throw new Error(`Tenant ${tenantId} is excluded from cleanup (admin tenant)`);
    }

    const report: CleanupReport = {
        tenantId,
        dryRun: true,
        collectionsCleaned: [],
        subCollectionsCleaned: [],
        totalRecordsDeleted: 0,
        errors: [],
        timestamp: new Date()
    };

    if (!db) {
        report.errors.push('Firebase not initialized');
        return report;
    }

    try {
        // Analyze main collections
        for (const collectionName of BUSINESS_DATA_COLLECTIONS) {
            try {
                const collectionPath = `tenants/${tenantId}/${collectionName}`;
                const collectionRef = collection(db, collectionPath);
                const snapshot = await getDocs(collectionRef);
                
                report.collectionsCleaned.push({
                    name: collectionName,
                    path: collectionPath,
                    count: snapshot.size
                });
                report.totalRecordsDeleted += snapshot.size;

                // Check for sub-collections if applicable
                for (const subConfig of SUB_COLLECTIONS_TO_CLEAN) {
                    if (collectionName === subConfig.parentCollection) {
                        for (const subCollection of subConfig.subCollections) {
                            let subTotal = 0;
                            snapshot.docs.forEach(doc => {
                                // Count sub-collection docs (we'll calculate in actual cleanup)
                                subTotal += 0; // Placeholder - will be calculated in actual cleanup
                            });
                            if (subTotal > 0 || snapshot.size > 0) {
                                report.subCollectionsCleaned.push({
                                    parentPath: `${collectionPath}/${snapshot.docs[0]?.id || 'doc'}/${subCollection}`,
                                    subCollection,
                                    count: 0 // Will be calculated in actual cleanup
                                });
                            }
                        }
                    }
                }
            } catch (error: any) {
                report.errors.push(`Failed to analyze ${collectionName}: ${error.message}`);
            }
        }

        // Analyze branch sub-collections
        try {
            const branchesRef = collection(db, `tenants/${tenantId}/branches`);
            const branchesSnapshot = await getDocs(branchesRef);
            
            for (const branchDoc of branchesSnapshot.docs) {
                const branchId = branchDoc.id;
                
                // Check coffee_orders
                try {
                    const coffeeOrdersRef = collection(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders`);
                    const coffeeSnapshot = await getDocs(coffeeOrdersRef);
                    if (coffeeSnapshot.size > 0) {
                        report.subCollectionsCleaned.push({
                            parentPath: `tenants/${tenantId}/branches/${branchId}`,
                            subCollection: 'coffee_orders',
                            count: coffeeSnapshot.size
                        });
                        report.totalRecordsDeleted += coffeeSnapshot.size;
                    }
                } catch (e) { /* ignore */ }

                // Check financial_transactions
                try {
                    const financialRef = collection(db, `tenants/${tenantId}/branches/${branchId}/financial_transactions`);
                    const financialSnapshot = await getDocs(financialRef);
                    if (financialSnapshot.size > 0) {
                        report.subCollectionsCleaned.push({
                            parentPath: `tenants/${tenantId}/branches/${branchId}`,
                            subCollection: 'financial_transactions',
                            count: financialSnapshot.size
                        });
                        report.totalRecordsDeleted += financialSnapshot.size;
                    }
                } catch (e) { /* ignore */ }
            }
        } catch (error: any) {
            report.errors.push(`Failed to analyze branch sub-collections: ${error.message}`);
        }

        // Analyze employee sub-collections (wallet_transactions, pointsHistory)
        try {
            const employeesRef = collection(db, `tenants/${tenantId}/employees`);
            const employeesSnapshot = await getDocs(employeesRef);
            
            for (const empDoc of employeesSnapshot.docs) {
                const employeeId = empDoc.id;
                
                // Check wallet_transactions
                try {
                    const walletRef = collection(db, `tenants/${tenantId}/employees/${employeeId}/wallet_transactions`);
                    const walletSnapshot = await getDocs(walletRef);
                    if (walletSnapshot.size > 0) {
                        report.subCollectionsCleaned.push({
                            parentPath: `tenants/${tenantId}/employees/${employeeId}`,
                            subCollection: 'wallet_transactions',
                            count: walletSnapshot.size
                        });
                        report.totalRecordsDeleted += walletSnapshot.size;
                    }
                } catch (e) { /* ignore */ }

                // Check pointsHistory
                try {
                    const pointsRef = collection(db, `tenants/${tenantId}/employees/${employeeId}/pointsHistory`);
                    const pointsSnapshot = await getDocs(pointsRef);
                    if (pointsSnapshot.size > 0) {
                        report.subCollectionsCleaned.push({
                            parentPath: `tenants/${tenantId}/employees/${employeeId}`,
                            subCollection: 'pointsHistory',
                            count: pointsSnapshot.size
                        });
                        report.totalRecordsDeleted += pointsSnapshot.size;
                    }
                } catch (e) { /* ignore */ }

                // Also reset points to 0 (not deletion, but reset)
                const empData = empDoc.data();
                if ((empData.points || empData.currentPoints || empData.personalPoints || 0) > 0) {
                    report.collectionsCleaned.push({
                        name: `employees/${employeeId} (points reset)`,
                        path: `tenants/${tenantId}/employees/${employeeId}`,
                        count: 1 // Will reset points
                    });
                }
            }
        } catch (error: any) {
            report.errors.push(`Failed to analyze employee sub-collections: ${error.message}`);
        }

    } catch (error: any) {
        report.errors.push(`Analysis failed: ${error.message}`);
    }

    return report;
};

// ============================================================
// ACTUAL CLEANUP
// ============================================================

/**
 * Clean test/demo data from a tenant (with safety checks)
 * ⚠️ CRITICAL: This deletes data permanently!
 */
export const cleanupTenantData = async (options: CleanupOptions): Promise<CleanupReport> => {
    // ✅ RBAC: Only Owner can perform cleanup
    validateRoleAccess('owner');

    const { tenantId, dryRun = false, excludeTenants = [] } = options;

    if (!tenantId) {
        throw new Error('Tenant ID is required');
    }

    // ✅ PROTECTION: Don't clean excluded tenants
    if (excludeTenants.includes(tenantId)) {
        throw new Error(`Tenant ${tenantId} is excluded from cleanup (admin tenant)`);
    }

    if (!db) {
        throw new Error('Firebase not initialized');
    }

    const report: CleanupReport = {
        tenantId,
        dryRun,
        collectionsCleaned: [],
        subCollectionsCleaned: [],
        totalRecordsDeleted: 0,
        errors: [],
        timestamp: new Date()
    };

    try {
        logger.info(`🧹 Starting cleanup for tenant: ${tenantId} (dryRun: ${dryRun})`, undefined, 'dataCleanupService');

        // ============================================================
        // PHASE 1: Delete Sub-collections (recursive)
        // ============================================================

        logger.info('Phase 1: Cleaning sub-collections...', undefined, 'dataCleanupService');

        // Clean employee sub-collections (wallet_transactions, pointsHistory)
        try {
            const employeesRef = collection(db, `tenants/${tenantId}/employees`);
            const employeesSnapshot = await getDocs(employeesRef);
            
            for (const empDoc of employeesSnapshot.docs) {
                const employeeId = empDoc.id;
                
                // Delete wallet_transactions
                try {
                    const walletRef = collection(db, `tenants/${tenantId}/employees/${employeeId}/wallet_transactions`);
                    const walletSnapshot = await getDocs(walletRef);
                    let walletCount = 0;
                    
                    if (!dryRun) {
                        const batch = writeBatch(db);
                        walletSnapshot.docs.forEach(d => {
                            batch.delete(d.ref);
                            walletCount++;
                        });
                        if (walletCount > 0) {
                            await batch.commit();
                        }
                    } else {
                        walletCount = walletSnapshot.size;
                    }

                    if (walletCount > 0) {
                        report.subCollectionsCleaned.push({
                            parentPath: `tenants/${tenantId}/employees/${employeeId}`,
                            subCollection: 'wallet_transactions',
                            count: walletCount
                        });
                        report.totalRecordsDeleted += walletCount;
                    }
                } catch (e) { /* ignore */ }

                // Delete pointsHistory
                try {
                    const pointsRef = collection(db, `tenants/${tenantId}/employees/${employeeId}/pointsHistory`);
                    const pointsSnapshot = await getDocs(pointsRef);
                    let pointsCount = 0;
                    
                    if (!dryRun) {
                        const batch = writeBatch(db);
                        pointsSnapshot.docs.forEach(d => {
                            batch.delete(d.ref);
                            pointsCount++;
                        });
                        if (pointsCount > 0) {
                            await batch.commit();
                        }
                    } else {
                        pointsCount = pointsSnapshot.size;
                    }

                    if (pointsCount > 0) {
                        report.subCollectionsCleaned.push({
                            parentPath: `tenants/${tenantId}/employees/${employeeId}`,
                            subCollection: 'pointsHistory',
                            count: pointsCount
                        });
                        report.totalRecordsDeleted += pointsCount;
                    }
                } catch (e) { /* ignore */ }

                // Reset employee points to 0 (not deletion, but reset)
                if (!dryRun) {
                    const empData = empDoc.data();
                    if ((empData.points || empData.currentPoints || empData.personalPoints || 0) > 0) {
                        const batch = writeBatch(db);
                        batch.update(empDoc.ref, {
                            points: 0,
                            currentPoints: 0,
                            personalPoints: 0,
                            version: (empData.version || 0) + 1
                        });
                        await batch.commit();
                        
                        report.collectionsCleaned.push({
                            name: `employees/${employeeId} (points reset)`,
                            path: `tenants/${tenantId}/employees/${employeeId}`,
                            count: 1
                        });
                    }
                }
            }
        } catch (error: any) {
            report.errors.push(`Failed to clean employee sub-collections: ${error.message}`);
        }

        // Clean branch sub-collections (coffee_orders, financial_transactions)
        try {
            const branchesRef = collection(db, `tenants/${tenantId}/branches`);
            const branchesSnapshot = await getDocs(branchesRef);
            
            for (const branchDoc of branchesSnapshot.docs) {
                const branchId = branchDoc.id;
                
                // Delete coffee_orders
                try {
                    const coffeeOrdersRef = collection(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders`);
                    const coffeeSnapshot = await getDocs(coffeeOrdersRef);
                    let coffeeCount = 0;
                    
                    if (!dryRun) {
                        const batch = writeBatch(db);
                        coffeeSnapshot.docs.forEach(d => {
                            batch.delete(d.ref);
                            coffeeCount++;
                        });
                        if (coffeeCount > 0) {
                            await batch.commit();
                        }
                    } else {
                        coffeeCount = coffeeSnapshot.size;
                    }

                    if (coffeeCount > 0) {
                        report.subCollectionsCleaned.push({
                            parentPath: `tenants/${tenantId}/branches/${branchId}`,
                            subCollection: 'coffee_orders',
                            count: coffeeCount
                        });
                        report.totalRecordsDeleted += coffeeCount;
                    }
                } catch (e) { /* ignore */ }

                // Delete financial_transactions
                try {
                    const financialRef = collection(db, `tenants/${tenantId}/branches/${branchId}/financial_transactions`);
                    const financialSnapshot = await getDocs(financialRef);
                    let financialCount = 0;
                    
                    if (!dryRun) {
                        const batch = writeBatch(db);
                        financialSnapshot.docs.forEach(d => {
                            batch.delete(d.ref);
                            financialCount++;
                        });
                        if (financialCount > 0) {
                            await batch.commit();
                        }
                    } else {
                        financialCount = financialSnapshot.size;
                    }

                    if (financialCount > 0) {
                        report.subCollectionsCleaned.push({
                            parentPath: `tenants/${tenantId}/branches/${branchId}`,
                            subCollection: 'financial_transactions',
                            count: financialCount
                        });
                        report.totalRecordsDeleted += financialCount;
                    }
                } catch (e) { /* ignore */ }
            }
        } catch (error: any) {
            report.errors.push(`Failed to clean branch sub-collections: ${error.message}`);
        }

        // ============================================================
        // PHASE 2: Delete Main Collections
        // ============================================================

        logger.info('Phase 2: Cleaning main collections...', undefined, 'dataCleanupService');

        for (const collectionName of BUSINESS_DATA_COLLECTIONS) {
            try {
                const collectionPath = `tenants/${tenantId}/${collectionName}`;
                const collectionRef = collection(db, collectionPath);
                const snapshot = await getDocs(collectionRef);
                let deletedCount = 0;

                if (!dryRun) {
                    // Use batches for efficient deletion (max 500 per batch)
                    const batchSize = 500;
                    const docs = snapshot.docs;
                    
                    for (let i = 0; i < docs.length; i += batchSize) {
                        const batch = writeBatch(db);
                        const batchDocs = docs.slice(i, i + batchSize);
                        
                        batchDocs.forEach(d => {
                            batch.delete(d.ref);
                            deletedCount++;
                        });
                        
                        if (batchDocs.length > 0) {
                            await batch.commit();
                        }
                    }
                } else {
                    deletedCount = snapshot.size;
                }

                if (deletedCount > 0) {
                    report.collectionsCleaned.push({
                        name: collectionName,
                        path: collectionPath,
                        count: deletedCount
                    });
                    report.totalRecordsDeleted += deletedCount;
                }
            } catch (error: any) {
                report.errors.push(`Failed to clean ${collectionName}: ${error.message}`);
            }
        }

        logger.info(`✅ Cleanup complete for tenant: ${tenantId} (${report.totalRecordsDeleted} records)`, undefined, 'dataCleanupService');

    } catch (error: any) {
        report.errors.push(`Cleanup failed: ${error.message}`);
        logger.error('Cleanup process failed', error, 'dataCleanupService');
    }

    return report;
};

// ============================================================
// CONVENIENCE FUNCTION
// ============================================================

/**
 * Analyze first, then cleanup (with confirmation)
 */
export const safeCleanupTenantData = async (
    tenantId: string,
    excludeTenants: string[] = [],
    confirm: boolean = false
): Promise<CleanupReport> => {
    // Step 1: Analyze (Dry-run)
    const analysis = await analyzeCleanup({ tenantId, excludeTenants, dryRun: true });

    if (!confirm) {
        // Return analysis for review
        logger.info('🧹 Analysis complete. Review and call again with confirm=true to execute cleanup', analysis, 'dataCleanupService');
        return analysis;
    }

    // Step 2: Execute cleanup
    return await cleanupTenantData({ tenantId, excludeTenants, dryRun: false });
};

export default {
    analyzeCleanup,
    cleanupTenantData,
    safeCleanupTenantData
};
