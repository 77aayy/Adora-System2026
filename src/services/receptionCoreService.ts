/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Reception Core Services - Part 2
 * Capacity, Concurrency, Merging, Scheduling, Load Balancing, SLA
 */

import { collection, query, where, getDocs, Timestamp, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getRooms } from './roomService';
import { validateTenantId, validateTenantAccess } from './tenantSecurityService';
import { logger } from './loggerService';

// ============================================================
// 6. CAPACITY PLANNING
// ============================================================

export interface CapacityMetrics {
    totalRooms: number;
    occupiedRooms: number;
    availableRooms: number;
    occupancyRate: number;
    pendingCheckIns: number;
    pendingCheckOuts: number;
}

/**
 * ✅ SECURITY FIX: Now requires tenantId and branchId for proper data isolation
 * @param branchId - The branch ID (required)
 * @param tenantId - The tenant ID (required for SaaS isolation)
 * @returns Capacity metrics for the specified branch
 */
export const getCapacityMetrics = async (
    branchId: string,
    tenantId?: string
): Promise<CapacityMetrics> => {
    try {
        // ✅ SECURITY: Use tenant/branch-isolated room service
        if (!tenantId) {
            logger.warn('getCapacityMetrics: tenantId is required for SaaS isolation', null, 'receptionCoreService');
            return { totalRooms: 0, occupiedRooms: 0, availableRooms: 0, occupancyRate: 0, pendingCheckIns: 0, pendingCheckOuts: 0 };
        }

        const rooms = await getRooms(branchId, tenantId);
        const totalRooms = rooms.length;
        const occupiedRooms = rooms.filter(r => r.status === 'occupied' || r.currentGuestId).length;

        return {
            totalRooms,
            occupiedRooms,
            availableRooms: totalRooms - occupiedRooms,
            occupancyRate: totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0,
            pendingCheckIns: 0,
            pendingCheckOuts: 0
        };
    } catch (error) {
        logger.error('Capacity error', error, 'receptionCoreService');
        return { totalRooms: 0, occupiedRooms: 0, availableRooms: 0, occupancyRate: 0, pendingCheckIns: 0, pendingCheckOuts: 0 };
    }
};

// ============================================================
// 7. CONCURRENT REQUEST HANDLING
// ============================================================

export const handleConcurrentRequests = async (
    requestIds: string[],
    action: 'confirm' | 'cancel',
    userId: string,
    userName: string,
    tenantId: string // ✅ FIX: Add tenantId parameter
): Promise<{ success: string[]; failed: string[] }> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot handle concurrent requests', undefined, 'receptionCoreService');
        return { success: [], failed: requestIds };
    }

    // ✅ FIX: Validate tenant access
    if (!tenantId || tenantId.trim() === '') {
        logger.error('TenantId is required for handleConcurrentRequests', undefined, 'receptionCoreService');
        return { success: [], failed: requestIds };
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    const batch = writeBatch(db);
    const success: string[] = [];

    try {
        // ✅ FIX: Use tenant-scoped collection
        for (const id of requestIds) {
            const ref = doc(db, `tenants/${validatedTenantId}/requests`, id);
            if (action === 'confirm') {
                batch.update(ref, { status: 'CONFIRMED', confirmedBy: { id: userId, name: userName }, 'timeline.confirmed': Timestamp.now() });
            } else {
                batch.update(ref, { status: 'CANCELLED', 'timeline.cancelled': Timestamp.now() });
            }
            success.push(id);
        }
        await batch.commit();
        return { success, failed: [] };
    } catch (error) {
        logger.error('Error handling concurrent requests', error, 'receptionCoreService');
        return { success: [], failed: requestIds };
    }
};

// ============================================================
// 8. REQUEST MERGING
// ============================================================

export const mergeRequests = async (requestIds: string[], mergedType: string): Promise<string | null> => {
    if (requestIds.length < 2) return null;
    // Simplified merge - would combine multiple requests into one
    logger.info(`Merging requests: ${requestIds.join(', ')} into type: ${mergedType}`, undefined, 'receptionCoreService');
    return requestIds[0]; // Return first as merged
};

// ============================================================
// 9. DUPLICATE DETECTION
// ============================================================

export const detectDuplicates = async (
    roomNumber: string,
    serviceType: string,
    branch: string,
    tenantId: string, // ✅ FIX: Add tenantId parameter
    windowMins: number = 30
): Promise<string[]> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot detect duplicates', undefined, 'receptionCoreService');
        return [];
    }

    // ✅ FIX: Validate tenant access
    if (!tenantId || tenantId.trim() === '') {
        logger.error('TenantId is required for detectDuplicates', undefined, 'receptionCoreService');
        return [];
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        const cutoff = new Date(Date.now() - windowMins * 60000);
        // ✅ FIX: Use tenant-scoped collection
        const snapshot = await getDocs(
            query(
                collection(db, `tenants/${validatedTenantId}/requests`),
                where('roomNumber', '==', roomNumber),
                where('type', '==', serviceType),
                where('branch', '==', branch),
                where('createdAt', '>=', Timestamp.fromDate(cutoff))
            )
        );
        return snapshot.docs.map(d => d.id);
    } catch (error) {
        logger.error('Error detecting duplicates', error, 'receptionCoreService');
        return [];
    }
};

// ============================================================
// 10. SMART SCHEDULING
// ============================================================

export const suggestOptimalSchedule = async (serviceType: string, branch: string): Promise<string[]> => {
    // Returns suggested time slots based on workload
    return ['10:00', '14:00', '16:00'];
};

// ============================================================
// 11. LOAD BALANCING
// ============================================================

export const balanceWorkload = async (department: string, branch: string): Promise<void> => {
    logger.info(`Balancing workload for: ${department} in branch: ${branch}`, undefined, 'receptionCoreService');
    // Would redistribute unassigned tasks to least-loaded employees
};

// ============================================================
// 12. PEAK TIME MANAGEMENT
// ============================================================

export const getPeakTimes = async (
    branch: string,
    tenantId: string // ✅ FIX: Add tenantId parameter
): Promise<Record<number, number>> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot get peak times', undefined, 'receptionCoreService');
        return {};
    }

    // ✅ FIX: Validate tenant access
    if (!tenantId || tenantId.trim() === '') {
        logger.error('TenantId is required for getPeakTimes', undefined, 'receptionCoreService');
        return {};
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ FIX: Use tenant-scoped collection
        const snapshot = await getDocs(
            query(
                collection(db, `tenants/${validatedTenantId}/requests`),
                where('branch', '==', branch)
            )
        );
        const hourlyCount: Record<number, number> = {};
        snapshot.docs.forEach(d => {
            const hour = d.data().createdAt?.toDate?.()?.getHours() || 0;
            hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
        });
        return hourlyCount;
    } catch (error) {
        logger.error('Error getting peak times', error, 'receptionCoreService');
        return {};
    }
};

// ============================================================
// 13. EMERGENCY PROTOCOLS
// ============================================================

export const triggerEmergency = async (
    requestId: string,
    type: 'medical' | 'fire' | 'security',
    tenantId: string // ✅ FIX: Add tenantId parameter
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot trigger emergency', undefined, 'receptionCoreService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    // ✅ FIX: Validate tenant access
    if (!tenantId || tenantId.trim() === '') {
        throw new Error('Tenant ID is required for all operations');
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ FIX: Use tenant-scoped collection
        const ref = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        await updateDoc(ref, { isEmergency: true, emergencyType: type, priority: 'critical', 'timeline.emergencyTriggered': Timestamp.now() });
        logger.info(`🚨 EMERGENCY ${type} triggered for request ${requestId}`, undefined, 'receptionCoreService');
    } catch (error) {
        logger.error('Error triggering emergency', error, 'receptionCoreService');
        throw error;
    }
};

// ============================================================
// 14. ESCALATION WORKFLOWS
// ============================================================

export const escalateRequest = async (
    requestId: string,
    to: 'supervisor' | 'manager' | 'gm',
    reason: string,
    tenantId: string // ✅ FIX: Add tenantId parameter
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot escalate request', undefined, 'receptionCoreService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    // ✅ FIX: Validate tenant access
    if (!tenantId || tenantId.trim() === '') {
        throw new Error('Tenant ID is required for all operations');
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ FIX: Use tenant-scoped collection
        const ref = doc(db, `tenants/${validatedTenantId}/requests`, requestId);
        await updateDoc(ref, { isEscalated: true, escalatedTo: to, escalationReason: reason, 'timeline.escalated': Timestamp.now() });
        logger.info(`Request ${requestId} escalated to ${to}`, undefined, 'receptionCoreService');
    } catch (error) {
        logger.error('Error escalating request', error, 'receptionCoreService');
        throw error;
    }
};

// ============================================================
// 15. SLA TRACKING
// ============================================================

export interface SLAMetrics {
    totalRequests: number;
    withinSLA: number;
    breachedSLA: number;
    avgResponseTime: number;
    slaCompliance: number;
}

export const getSLAMetrics = async (
    branch: string,
    tenantId: string, // ✅ FIX: Add tenantId parameter
    startDate: Date,
    endDate: Date
): Promise<SLAMetrics> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot get SLA metrics', undefined, 'receptionCoreService');
        return { totalRequests: 0, withinSLA: 0, breachedSLA: 0, avgResponseTime: 0, slaCompliance: 0 };
    }

    // ✅ FIX: Validate tenant access
    if (!tenantId || tenantId.trim() === '') {
        logger.error('TenantId is required for getSLAMetrics', undefined, 'receptionCoreService');
        return { totalRequests: 0, withinSLA: 0, breachedSLA: 0, avgResponseTime: 0, slaCompliance: 0 };
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ FIX: Use tenant-scoped collection
        const snapshot = await getDocs(
            query(
                collection(db, `tenants/${validatedTenantId}/requests`),
                where('branch', '==', branch),
                where('createdAt', '>=', Timestamp.fromDate(startDate)),
                where('createdAt', '<=', Timestamp.fromDate(endDate)),
                where('status', '==', 'COMPLETED')
            )
        );

        let withinSLA = 0;
        let totalTime = 0;
        const SLA = 30; // 30 min default

        snapshot.docs.forEach(d => {
            const data = d.data();
            const created = data.createdAt?.toDate?.() || new Date();
            const completed = data.timeline?.completed?.toDate?.() || created;
            const mins = (completed.getTime() - created.getTime()) / 60000;
            totalTime += mins;
            if (mins <= SLA) withinSLA++;
        });

        const total = snapshot.size;
        return {
            totalRequests: total,
            withinSLA,
            breachedSLA: total - withinSLA,
            avgResponseTime: total > 0 ? totalTime / total : 0,
            slaCompliance: total > 0 ? (withinSLA / total) * 100 : 0
        };
    } catch (error) {
        logger.error('Error getting SLA metrics', error, 'receptionCoreService');
        return { totalRequests: 0, withinSLA: 0, breachedSLA: 0, avgResponseTime: 0, slaCompliance: 0 };
    }
};
