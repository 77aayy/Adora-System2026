/**
 * Reception Core Services - Advanced Logic
 * VIP handling, Auto-assignment, Priority management
 */

import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// 1. ADVANCED ROOM ASSIGNMENT LOGIC
// ============================================================

interface RoomAssignmentCriteria {
    floor?: number;
    roomType?: string;
    proximity?: string; // 'elevator', 'stairs', 'emergency_exit'
    vipPreference?: boolean;
    accessibility?: boolean;
    quietZone?: boolean;
}

export const smartRoomAssignment = async (
    tenantId: string,
    branch: string,
    criteria: RoomAssignmentCriteria
): Promise<string | null> => {
    try {
        let q = query(
            collection(db, `tenants/${tenantId}/rooms`),
            where('branch', '==', branch),
            where('isOccupied', '==', false)
        );

        if (criteria.floor) {
            q = query(q, where('floor', '==', criteria.floor));
        }

        const snapshot = await getDocs(q);
        const availableRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (availableRooms.length === 0) return null;

        // Score and rank rooms
        const scored = availableRooms.map((room: any) => ({
            ...room,
            score: calculateRoomScore(room, criteria)
        }));

        scored.sort((a, b) => b.score - a.score);
        return scored[0].roomNumber;
    } catch (error) {
        logger.error('Smart assignment error:', error, 'receptionAdvancedService');
        return null;
    }
};

function calculateRoomScore(room: any, criteria: RoomAssignmentCriteria): number {
    let score = 100;

    if (criteria.roomType && room.type === criteria.roomType) score += 50;
    if (criteria.vipPreference && room.isVIP) score += 100;
    if (criteria.accessibility && room.hasAccessibility) score += 80;
    if (criteria.quietZone && room.isQuietZone) score += 60;

    return score;
}

// ============================================================
// 2. VIP GUEST HANDLING
// ============================================================

interface VIPService {
    roomUpgrade?: boolean;
    welcomeAmenities?: boolean;
    personalConcierge?: boolean;
    priorityService?: boolean;
}

export const handleVIPGuest = async (
    tenantId: string,
    requestId: string,
    vipLevel: 'gold' | 'platinum' | 'diamond',
    services: VIPService
): Promise<void> => {
    try {
        const requestRef = doc(db, `tenants/${tenantId}/requests`, requestId);

        await updateDoc(requestRef, {
            isVIP: true,
            vipLevel,
            vipServices: services,
            priority: 'urgent',
            'timeline.vipFlagged': Timestamp.now()
        });

        // Log VIP handling
        logger.info(`VIP ${vipLevel} guest handled: ${requestId}`, undefined, 'receptionAdvancedService');
    } catch (error) {
        logger.error('VIP handling error:', error, 'receptionAdvancedService');
        throw error;
    }
};

//============================================================
// 3. SPECIAL REQUEST CATEGORIZATION
// ============================================================

export type RequestCategory =
    | 'urgent_medical'
    | 'security_concern'
    | 'vip_service'
    | 'maintenance_emergency'
    | 'guest_complaint'
    | 'special_occasion'
    | 'standard';

export const categorizeRequest = (request: any): RequestCategory => {
    const { type, description, priority, isVIP } = request;

    // Medical keywords
    if (description?.toLowerCase().includes('medical') ||
        description?.toLowerCase().includes('doctor') ||
        description?.toLowerCase().includes('ambulance')) {
        return 'urgent_medical';
    }

    // Security
    if (description?.toLowerCase().includes('security') ||
        description?.toLowerCase().includes('theft') ||
        description?.toLowerCase().includes('danger')) {
        return 'security_concern';
    }

    // VIP
    if (isVIP || request.vipLevel) {
        return 'vip_service';
    }

    // Emergency maintenance
    if (type === 'maintenance' && priority === 'urgent') {
        return 'maintenance_emergency';
    }

    // Complaints
    if (description?.toLowerCase().includes('complaint') ||
        description?.toLowerCase().includes('unhappy') ||
        description?.toLowerCase().includes('disappointed')) {
        return 'guest_complaint';
    }

    // Special occasions
    if (description?.toLowerCase().includes('birthday') ||
        description?.toLowerCase().includes('anniversary') ||
        description?.toLowerCase().includes('celebration')) {
        return 'special_occasion';
    }

    return 'standard';
};

// ============================================================
// 4. AUTO-ASSIGNMENT ALGORITHMS
// ============================================================

interface EmployeeWorkload {
    employeeId: string;
    employeeName: string;
    currentTasks: number;
    avgResponseTime: number;
    rating: number;
    isAvailable: boolean;
}

export const autoAssignRequest = async (
    tenantId: string,
    requestId: string,
    department: string,
    branch: string
): Promise<string | null> => {
    try {
        // Get available employees (tenant-scoped)
        const employeesRef = collection(db, `tenants/${tenantId}/employees`);
        const employeesSnapshot = await getDocs(
            query(
                employeesRef,
                where('branch', '==', branch),
                where('department', '==', department),
                where('isActive', '==', true)
            )
        );

        if (employeesSnapshot.empty) return null;

        const requestsRef = collection(db, `tenants/${tenantId}/requests`);
        const employees: EmployeeWorkload[] = await Promise.all(
            employeesSnapshot.docs.map(async (empDoc) => {
                const emp = empDoc.data();

                // Get current workload (assignedTo may be userId; match by assignedTo.id if stored as object)
                const workloadSnapshot = await getDocs(
                    query(
                        requestsRef,
                        where('assignedTo.id', '==', empDoc.id),
                        where('status', 'in', ['CONFIRMED', 'IN_PROGRESS'])
                    )
                );

                return {
                    employeeId: empDoc.id,
                    employeeName: emp.name,
                    currentTasks: workloadSnapshot.size,
                    avgResponseTime: emp.avgResponseTime || 30,
                    rating: emp.rating || 4.0,
                    isAvailable: emp.isAvailable !== false
                };
            })
        );

        // Filter available only
        const available = employees.filter(e => e.isAvailable);
        if (available.length === 0) return null;

        // Score and rank
        const scored = available.map(emp => ({
            ...emp,
            score: (10 - emp.currentTasks) * 10 + emp.rating * 5 - (emp.avgResponseTime / 10)
        }));

        scored.sort((a, b) => b.score - a.score);

        const selected = scored[0];

        // Assign (tenant-scoped)
        await updateDoc(doc(db, `tenants/${tenantId}/requests`, requestId), {
            assignedTo: selected.employeeId,
            assignedToName: selected.employeeName,
            'timeline.assigned': Timestamp.now()
        });

        return selected.employeeId;
    } catch (error) {
        logger.error('Auto-assignment error:', error, 'receptionAdvancedService');
        return null;
    }
};

// ============================================================
// 5. PRIORITY QUEUE MANAGEMENT
// ============================================================

export interface PriorityQueue {
    urgent: any[];
    high: any[];
    normal: any[];
    low: any[];
}

export const getPriorityQueue = async (tenantId: string, branch: string): Promise<PriorityQueue> => {
    try {
        const snapshot = await getDocs(
            query(
                collection(db, `tenants/${tenantId}/requests`),
                where('branch', '==', branch),
                where('status', '==', 'PENDING')
            )
        );

        const queue: PriorityQueue = {
            urgent: [],
            high: [],
            normal: [],
            low: []
        };

        snapshot.docs.forEach(doc => {
            const request = { id: doc.id, ...doc.data() };
            const category = categorizeRequest(request);
            const priority = calculatePriority(request, category);

            if (priority >= 90) queue.urgent.push(request);
            else if (priority >= 70) queue.high.push(request);
            else if (priority >= 40) queue.normal.push(request);
            else queue.low.push(request);
        });

        // Sort each queue by creation time
        Object.values(queue).forEach((arr: any[]) => {
            arr.sort((a: any, b: any) => {
                const timeA = a.createdAt?.toDate?.() || new Date(0);
                const timeB = b.createdAt?.toDate?.() || new Date(0);
                return timeA.getTime() - timeB.getTime();
            });
        });

        return queue;
    } catch (error) {
        logger.error('Priority queue error:', error, 'receptionAdvancedService');
        return { urgent: [], high: [], normal: [], low: [] };
    }
};

function calculatePriority(request: any, category: RequestCategory): number {
    let priority = 50; // base

    // Category weights
    if (category === 'urgent_medical') priority = 100;
    else if (category === 'security_concern') priority = 95;
    else if (category === 'vip_service') priority = 85;
    else if (category === 'maintenance_emergency') priority = 90;
    else if (category === 'guest_complaint') priority = 75;
    else if (category === 'special_occasion') priority = 65;

    // Time factor
    const age = Date.now() - (request.createdAt?.toDate?.()?.getTime() || Date.now());
    const ageMinutes = age / (1000 * 60);

    if (ageMinutes > 60) priority += 20;
    else if (ageMinutes > 30) priority += 10;

    return Math.min(100, priority);
}
