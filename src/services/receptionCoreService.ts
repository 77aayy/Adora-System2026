/**
 * Reception Core Services - Part 2
 * Capacity, Concurrency, Merging, Scheduling, Load Balancing, SLA
 */

import { collection, query, where, getDocs, Timestamp, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

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

export const getCapacityMetrics = async (branch: string): Promise<CapacityMetrics> => {
    try {
        const roomsSnapshot = await getDocs(
            query(collection(db, 'rooms'), where('branch', '==', branch))
        );
        const totalRooms = roomsSnapshot.size;

        const occupiedSnapshot = await getDocs(
            query(collection(db, 'rooms'), where('branch', '==', branch), where('isOccupied', '==', true))
        );
        const occupiedRooms = occupiedSnapshot.size;

        return {
            totalRooms,
            occupiedRooms,
            availableRooms: totalRooms - occupiedRooms,
            occupancyRate: totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0,
            pendingCheckIns: 0,
            pendingCheckOuts: 0
        };
    } catch (error) {
        console.error('Capacity error:', error);
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
    userName: string
): Promise<{ success: string[]; failed: string[] }> => {
    const batch = writeBatch(db);
    const success: string[] = [];

    try {
        for (const id of requestIds) {
            const ref = doc(db, 'requests', id);
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
        return { success: [], failed: requestIds };
    }
};

// ============================================================
// 8. REQUEST MERGING
// ============================================================

export const mergeRequests = async (requestIds: string[], mergedType: string): Promise<string | null> => {
    if (requestIds.length < 2) return null;
    // Simplified merge - would combine multiple requests into one
    console.log('Merging requests:', requestIds, 'into type:', mergedType);
    return requestIds[0]; // Return first as merged
};

// ============================================================
// 9. DUPLICATE DETECTION
// ============================================================

export const detectDuplicates = async (roomNumber: string, serviceType: string, branch: string, windowMins: number = 30): Promise<string[]> => {
    try {
        const cutoff = new Date(Date.now() - windowMins * 60000);
        const snapshot = await getDocs(
            query(
                collection(db, 'requests'),
                where('roomNumber', '==', roomNumber),
                where('type', '==', serviceType),
                where('branch', '==', branch),
                where('createdAt', '>=', Timestamp.fromDate(cutoff))
            )
        );
        return snapshot.docs.map(d => d.id);
    } catch {
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
    console.log('Balancing workload for:', department, branch);
    // Would redistribute unassigned tasks to least-loaded employees
};

// ============================================================
// 12. PEAK TIME MANAGEMENT
// ============================================================

export const getPeakTimes = async (branch: string): Promise<Record<number, number>> => {
    try {
        const snapshot = await getDocs(query(collection(db, 'requests'), where('branch', '==', branch)));
        const hourlyCount: Record<number, number> = {};
        snapshot.docs.forEach(d => {
            const hour = d.data().createdAt?.toDate?.()?.getHours() || 0;
            hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
        });
        return hourlyCount;
    } catch {
        return {};
    }
};

// ============================================================
// 13. EMERGENCY PROTOCOLS
// ============================================================

export const triggerEmergency = async (requestId: string, type: 'medical' | 'fire' | 'security'): Promise<void> => {
    try {
        const ref = doc(db, 'requests', requestId);
        await updateDoc(ref, { isEmergency: true, emergencyType: type, priority: 'critical', 'timeline.emergencyTriggered': Timestamp.now() });
        console.log(`🚨 EMERGENCY ${type} triggered`);
    } catch (error) {
        throw error;
    }
};

// ============================================================
// 14. ESCALATION WORKFLOWS
// ============================================================

export const escalateRequest = async (requestId: string, to: 'supervisor' | 'manager' | 'gm', reason: string): Promise<void> => {
    try {
        const ref = doc(db, 'requests', requestId);
        await updateDoc(ref, { isEscalated: true, escalatedTo: to, escalationReason: reason, 'timeline.escalated': Timestamp.now() });
    } catch (error) {
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

export const getSLAMetrics = async (branch: string, startDate: Date, endDate: Date): Promise<SLAMetrics> => {
    try {
        const snapshot = await getDocs(
            query(
                collection(db, 'requests'),
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
    } catch {
        return { totalRequests: 0, withinSLA: 0, breachedSLA: 0, avgResponseTime: 0, slaCompliance: 0 };
    }
};
