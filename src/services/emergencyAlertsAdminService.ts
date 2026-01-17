/**
 * Emergency Alerts Admin Service
 * Handles admin operations for emergency alerts management
 * ✅ Architecture: All Firebase operations isolated in services
 * ✅ SaaS: Tenant-scoped emergency alerts
 */

import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';
import { EmergencyAlert } from './emergencyAlertService';

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Get all emergency alerts for a branch (for admin management)
 * ✅ Null Safety: Checks db before operations
 */
export const getAllEmergencyAlertsForBranch = async (
    branchId: string,
    tenantId: string
): Promise<EmergencyAlert[]> => {
    // ✅ Null Safety: Check db
    if (!db) {
        logger.error('Cannot get emergency alerts', new Error('Database not initialized'), 'emergencyAlertsAdminService');
        return [];
    }

    // ✅ SaaS: Validate tenantId and branchId
    if (!tenantId || !branchId) {
        logger.warn('Cannot get emergency alerts: Missing tenantId or branchId', null, 'emergencyAlertsAdminService');
        return [];
    }

    try {
        // ✅ SaaS: Tenant-scoped query
        const q = query(
            collection(db, 'emergency_alerts'),
            where('branchId', '==', branchId),
            where('tenantId', '==', tenantId)
        );

        const snapshot = await getDocs(q);
        const alerts: EmergencyAlert[] = [];

        snapshot.forEach(doc => {
            alerts.push({
                id: doc.id,
                ...doc.data()
            } as EmergencyAlert);
        });

        // Sort by creation time (newest first)
        alerts.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return bTime.getTime() - aTime.getTime();
        });

        logger.info(`Loaded ${alerts.length} emergency alerts for branch ${branchId}`, { branchId, tenantId, count: alerts.length }, 'emergencyAlertsAdminService');
        return alerts;
    } catch (error: any) {
        logger.error('Error loading emergency alerts', error, 'emergencyAlertsAdminService');
        // ✅ Only log permission errors, don't show to user
        if (error.code !== 'permission-denied') {
            throw error;
        } else {
            logger.warn('Permission denied - check Firestore rules for emergency_alerts', null, 'emergencyAlertsAdminService');
            return [];
        }
    }
};
