/**
 * Bellman Advanced Features
 * Migrated from legacy bellman.js (2543 lines)
 * Adora Hotel Management System V2
 */

import { db } from '../../services/firebase';
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc, writeBatch,
    query, where, orderBy, limit, onSnapshot,
    serverTimestamp, Timestamp
} from 'firebase/firestore';
import { awardPerformancePoints, awardPoints } from '../../services/pointsService';

// ============================================================
// TYPES
// ============================================================

interface RoomCard {
    id: string;
    roomNumber: string;
    branch: string;
    hotel: string;
    status: 'active' | 'checkout_pending' | 'completed';
    adults: number;
    children: number;
    guestName?: string;
    receptionistId?: string;
    receptionistName?: string;
    checkinBy: { id: string; name: string };
    checkinAt: any;
    notes?: string;
    qrActive: boolean;
    checkoutBy?: { id: string; name: string };
    checkoutAt?: any;
    checkoutNotes?: string;
    checkoutReceptionistId?: string;
    checkoutReceptionistName?: string;
}

interface BellmanRequest {
    id: string;
    roomNumber: string;
    branch: string;
    serviceType: 'bellman';
    status: string;
    needsCart?: boolean;
    guestStatus?: 'in' | 'out';
    description?: string;
    timing?: 'immediate' | 'scheduled';
    scheduledDate?: any;
    createdAt: any;
    timeline?: any;
    startedBy?: any;
    completedBy?: any;
    responseTimeMinutes?: number;
}

interface Room {
    id: string;
    roomNumber: string;
    floor: number;
    type?: string;
}

interface Employee {
    id: string;
    name: string;
    code?: string;
    department: string;
    active: boolean;
}

// ============================================================
// ROOM CARDS MANAGEMENT
// ============================================================

/**
 * Subscribe to active room cards
 */
export const subscribeToRoomCards = (
    branchId: string,
    callback: (cards: RoomCard[]) => void
): (() => void) => {
    const cardsQuery = query(
        collection(db, 'roomCards'),
        where('branch', '==', branchId),
        where('status', '==', 'active')
    );

    return onSnapshot(cardsQuery, snapshot => {
        const cards: RoomCard[] = [];
        snapshot.forEach(doc => {
            cards.push({ id: doc.id, ...doc.data() } as RoomCard);
        });

        // Sort by checkinAt descending
        cards.sort((a, b) => {
            const dateA = a.checkinAt?.toDate ? a.checkinAt.toDate() : new Date(a.checkinAt || 0);
            const dateB = b.checkinAt?.toDate ? b.checkinAt.toDate() : new Date(b.checkinAt || 0);
            return dateB.getTime() - dateA.getTime();
        });

        callback(cards);
    });
};

/**
 * Get available rooms (not currently active)
 */
export const getAvailableRooms = async (
    hotelId: string,
    branchId: string
): Promise<Room[]> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const roomsSnapshot = await getDocs(
            collection(db, `tenants/${hotelId}/branches/${branchId}/rooms`)
        );

        // Get active room cards
        const activeQuery = query(
            collection(db, 'roomCards'),
            where('branch', '==', branchId),
            where('status', '==', 'active')
        );
        const activeSnapshot = await getDocs(activeQuery);

        const activeRoomNumbers = new Set<string>();
        activeSnapshot.forEach(doc => {
            activeRoomNumbers.add(doc.data().roomNumber);
        });

        // Filter available rooms
        const availableRooms: Room[] = [];
        roomsSnapshot.forEach(doc => {
            const room = doc.data();
            if (!activeRoomNumbers.has(room.roomNumber)) {
                availableRooms.push({ id: doc.id, ...room } as Room);
            }
        });

        return availableRooms;
    } catch (error) {
        console.error('Error loading available rooms:', error);
        return [];
    }
};

/**
 * Group rooms by floor
 */
export const groupRoomsByFloor = (rooms: Room[]): Record<number, Room[]> => {
    const grouped: Record<number, Room[]> = {};

    rooms.forEach(room => {
        const floor = room.floor || 0;
        if (!grouped[floor]) {
            grouped[floor] = [];
        }
        grouped[floor].push(room);
    });

    // Sort rooms within each floor
    Object.keys(grouped).forEach(floorKey => {
        const floor = parseInt(floorKey);
        grouped[floor].sort((a, b) => {
            const numA = parseInt(a.roomNumber) || 0;
            const numB = parseInt(b.roomNumber) || 0;
            return numA - numB;
        });
    });

    return grouped;
};

// ============================================================
// CHECK-IN / CHECK-OUT
// ============================================================

/**
 * Submit check-in
 */
export const submitCheckin = async (
    roomNumber: string,
    adults: number,
    children: number,
    receptionistId: string,
    receptionistName: string,
    notes: string,
    employeeId: string,
    employeeName: string,
    branchId: string,
    hotelId: string
): Promise<boolean> => {
    try {
        // Check if room is already active
        const existingQuery = query(
            collection(db, 'roomCards'),
            where('branch', '==', branchId),
            where('roomNumber', '==', roomNumber),
            where('status', '==', 'active'),
            limit(1)
        );
        const existingSnapshot = await getDocs(existingQuery);

        if (!existingSnapshot.empty) {
            throw new Error(`الغرفة ${roomNumber} نشطة بالفعل`);
        }

        // Create room card
        await addDoc(collection(db, 'roomCards'), {
            roomNumber,
            branch: branchId,
            hotel: hotelId,
            status: 'active',
            adults,
            children,
            receptionistId: receptionistId || null,
            receptionistName: receptionistName || null,
            checkinBy: { id: employeeId, name: employeeName },
            checkinAt: serverTimestamp(),
            notes: notes || null,
            qrActive: true
        });

        return true;
    } catch (error) {
        console.error('Error during checkin:', error);
        throw error;
    }
};

/**
 * Submit check-out
 */
export const submitCheckout = async (
    cardId: string,
    card: RoomCard,
    guestLocation: 'inside' | 'outside',
    receptionistId: string,
    receptionistName: string,
    notes: string,
    employeeId: string,
    employeeName: string,
    branchId: string,
    hotelId: string
): Promise<boolean> => {
    try {
        // Check for existing inspection request
        const existingQuery = query(
            collection(db, 'requests'),
            where('branch', '==', branchId),
            where('roomNumber', '==', card.roomNumber),
            where('serviceType', '==', 'inspection'),
            where('status', 'in', ['PENDING_RECEPTION', 'CONFIRMED', 'IN_PROGRESS']),
            limit(1)
        );
        const existingSnapshot = await getDocs(existingQuery);

        if (!existingSnapshot.empty) {
            throw new Error('يوجد بالفعل طلب فحص نشط للغرفة');
        }

        const batch = writeBatch(db);

        // 1. Update room card
        const cardRef = doc(db, 'roomCards', cardId);
        batch.update(cardRef, {
            status: 'checkout_pending',
            checkoutBy: { id: employeeId, name: employeeName },
            checkoutAt: serverTimestamp(),
            checkoutNotes: notes || null,
            checkoutReceptionistId: receptionistId,
            checkoutReceptionistName: receptionistName,
            qrActive: false
        });

        // 2. Create inspection request
        const inspectionRef = doc(collection(db, 'requests'));
        batch.set(inspectionRef, {
            roomNumber: card.roomNumber,
            branch: branchId,
            hotel: hotelId,
            serviceType: 'inspection',
            requestType: 'inspection',
            source: 'bellman_checkout',
            status: 'PENDING_RECEPTION',
            roomCardId: cardId,
            guestLocation,
            guestsInRoom: guestLocation === 'inside',
            guestCount: {
                adults: card.adults || 1,
                children: card.children || 0
            },
            receptionistId: card.receptionistId || null,
            receptionistName: card.receptionistName || null,
            checkinBy: card.checkinBy || null,
            checkinAt: card.checkinAt || null,
            checkinNotes: card.notes || null,
            checkoutBy: { id: employeeId, name: employeeName },
            checkoutAt: serverTimestamp(),
            checkoutReceptionistId: receptionistId,
            checkoutReceptionistName: receptionistName,
            checkoutNotes: notes || null,
            assignedReceptionist: { id: receptionistId, name: receptionistName },
            createdBy: { id: employeeId, name: employeeName },
            createdAt: serverTimestamp(),
            timeline: { created: serverTimestamp() }
        });

        await batch.commit();
        return true;
    } catch (error) {
        console.error('Error during checkout:', error);
        throw error;
    }
};

// ============================================================
// BELLMAN REQUESTS
// ============================================================

/**
 * Subscribe to bellman requests
 */
export const subscribeToBellmanRequests = (
    branchId: string,
    callback: (requests: BellmanRequest[]) => void
): (() => void) => {
    const requestsQuery = query(
        collection(db, 'requests'),
        where('branch', '==', branchId),
        where('serviceType', '==', 'bellman'),
        where('status', 'in', ['CONFIRMED', 'IN_PROGRESS'])
    );

    return onSnapshot(requestsQuery, snapshot => {
        const requests: BellmanRequest[] = [];
        snapshot.forEach(doc => {
            requests.push({ id: doc.id, ...doc.data() } as BellmanRequest);
        });

        // Sort by createdAt descending
        requests.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
        });

        callback(requests);
    });
};

/**
 * Start bellman request
 */
export const startBellmanRequest = async (
    requestId: string,
    employeeId: string,
    employeeName: string
): Promise<boolean> => {
    try {
        const requestRef = doc(db, 'requests', requestId);
        const requestDoc = await getDoc(requestRef);
        const request = requestDoc.data();

        // Calculate response time
        let responseTimeMinutes: number | null = null;
        if (request?.createdAt && request?.source === 'QR') {
            const createdAt = request.createdAt.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
            const now = new Date();
            responseTimeMinutes = Math.floor((now.getTime() - createdAt.getTime()) / 60000);
        }

        await updateDoc(requestRef, {
            status: 'IN_PROGRESS',
            startedBy: { id: employeeId, name: employeeName },
            'timeline.started': serverTimestamp(),
            responseTimeMinutes
        });

        return true;
    } catch (error) {
        console.error('Error starting request:', error);
        return false;
    }
};

/**
 * Complete bellman request
 */
export const completeBellmanRequest = async (
    requestId: string,
    employeeId: string,
    employeeName: string
): Promise<{ success: boolean; request?: any }> => {
    try {
        const requestRef = doc(db, 'requests', requestId);
        const requestDoc = await getDoc(requestRef);
        const request = requestDoc.data();

        if (!request) {
            console.error('Request not found');
            return { success: false };
        }

        await updateDoc(requestRef, {
            status: 'COMPLETED',
            completedBy: { id: employeeId, name: employeeName },
            'timeline.completed': serverTimestamp()
        });

        // ⭐ AWARD POINTS: Fix for Orphan Feature
        // Calculate total duration from started -> completed
        try {
            let durationMinutes = 0;
            if (request?.timeline?.started) {
                const startTime = request.timeline.started.toDate ? request.timeline.started.toDate() : new Date(request.timeline.started);
                durationMinutes = Math.floor((Date.now() - startTime.getTime()) / (1000 * 60));
            } else if (request?.createdAt) {
                // Fallback if no start time (e.g. immediate completion)
                const startTime = request.createdAt.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
                durationMinutes = Math.floor((Date.now() - startTime.getTime()) / (1000 * 60));
            }

            // Award points using centralized service
            if (request.branch) { // Ensure we have branch/tenant context if possible, usually passed or derived
                // Assuming 'hotel' field exists on request or we use 'default'. 
                // The function signature for awardPerformancePoints needs tenantId. 
                // Request interface has 'hotel' string.
                const hotelId = request.hotel || 'default';

                await awardPerformancePoints(
                    hotelId,
                    employeeId,
                    'bellman',
                    'complete', // Base action
                    durationMinutes
                );
            }
        } catch (pointError) {
            console.error('Failed to award bellman points:', pointError);
        }

        return { success: true, request };
    } catch (error) {
        console.error('Error completing request:', error);
        return { success: false };
    }
};

// ============================================================
// EMPLOYEES
// ============================================================

/**
 * Load reception employees
 */
export const loadReceptionEmployees = async (
    hotelId: string,
    branchId: string
): Promise<Employee[]> => {
    try {
        const employeesQuery = query(
            // ✅ SaaS FIX: Use 'tenants' collection
            collection(db, `tenants/${hotelId}/branches/${branchId}/employees`),
            where('department', '==', 'reception'),
            where('active', '==', true)
        );

        const snapshot = await getDocs(employeesQuery);
        const employees: Employee[] = [];

        snapshot.forEach(doc => {
            employees.push({ id: doc.id, ...doc.data() } as Employee);
        });

        return employees;
    } catch (error) {
        console.error('Error loading reception employees:', error);
        return [];
    }
};

/**
 * Subscribe to reception employees
 */
export const subscribeToReceptionEmployees = (
    hotelId: string,
    branchId: string,
    callback: (employees: Employee[]) => void
): (() => void) => {
    const employeesQuery = query(
        // ✅ SaaS FIX: Use 'tenants' collection
        collection(db, `tenants/${hotelId}/branches/${branchId}/employees`),
        where('department', '==', 'reception'),
        where('active', '==', true)
    );

    return onSnapshot(employeesQuery, snapshot => {
        const employees: Employee[] = [];
        snapshot.forEach(doc => {
            employees.push({ id: doc.id, ...doc.data() } as Employee);
        });
        callback(employees);
    });
};

// ============================================================
// HISTORY
// ============================================================

interface HistoryFilter {
    action: 'all' | 'checkin' | 'checkout';
    period: 'today' | 'week' | 'month' | 'custom';
    customFrom?: Date | null;
    customTo?: Date | null;
}

interface HistoryItem {
    id: string;
    type: 'checkin' | 'checkout';
    roomNumber: string;
    timestamp: Date;
    data: any;
}

/**
 * Get date range based on period
 */
const getDateRange = (
    period: string,
    customFrom?: Date | null,
    customTo?: Date | null
): { from: Date; to: Date } => {
    const now = new Date();
    let from = new Date();
    let to = new Date();

    switch (period) {
        case 'today':
            from.setHours(0, 0, 0, 0);
            to.setHours(23, 59, 59, 999);
            break;
        case 'week':
            from.setDate(now.getDate() - 7);
            from.setHours(0, 0, 0, 0);
            to.setHours(23, 59, 59, 999);
            break;
        case 'month':
            from.setDate(now.getDate() - 30);
            from.setHours(0, 0, 0, 0);
            to.setHours(23, 59, 59, 999);
            break;
        case 'custom':
            if (customFrom && customTo) {
                from = new Date(customFrom);
                to = new Date(customTo);
                to.setHours(23, 59, 59, 999);
            }
            break;
    }

    return { from, to };
};

/**
 * Load bellman history with filters
 */
export const loadBellmanHistory = async (
    branchId: string,
    employeeId: string,
    filter: HistoryFilter
): Promise<HistoryItem[]> => {
    const history: HistoryItem[] = [];
    const dateRange = getDateRange(filter.period, filter.customFrom, filter.customTo);

    try {
        // Get check-ins
        if (filter.action === 'all' || filter.action === 'checkin') {
            const checkinQuery = query(
                collection(db, 'roomCards'),
                where('branch', '==', branchId),
                where('checkinBy.id', '==', employeeId)
            );
            const checkinSnapshot = await getDocs(checkinQuery);

            checkinSnapshot.forEach(doc => {
                const data = doc.data();
                const checkinDate = data.checkinAt?.toDate
                    ? data.checkinAt.toDate()
                    : new Date(data.checkinAt || 0);

                if (checkinDate >= dateRange.from && checkinDate <= dateRange.to) {
                    history.push({
                        id: doc.id,
                        type: 'checkin',
                        roomNumber: data.roomNumber,
                        timestamp: checkinDate,
                        data
                    });
                }
            });
        }

        // Get check-outs
        if (filter.action === 'all' || filter.action === 'checkout') {
            const checkoutQuery = query(
                collection(db, 'roomCards'),
                where('branch', '==', branchId),
                where('checkoutBy.id', '==', employeeId)
            );
            const checkoutSnapshot = await getDocs(checkoutQuery);

            checkoutSnapshot.forEach(doc => {
                const data = doc.data();
                if (!data.checkoutAt) return;

                const checkoutDate = data.checkoutAt?.toDate
                    ? data.checkoutAt.toDate()
                    : new Date(data.checkoutAt);

                if (checkoutDate >= dateRange.from && checkoutDate <= dateRange.to) {
                    history.push({
                        id: doc.id,
                        type: 'checkout',
                        roomNumber: data.roomNumber,
                        timestamp: checkoutDate,
                        data
                    });
                }
            });
        }

        // Sort by timestamp descending
        history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        return history;
    } catch (error) {
        console.error('Error loading bellman history:', error);
        return [];
    }
};

// ============================================================
// POINTS CALCULATION
// ============================================================

interface PointsDetails {
    basePoints: number;
    speedPoints: number;
    totalPoints: number;
    reason: string;
}

/**
 * Calculate bellman points
 */
export const calculateBellmanPoints = (
    action: string,
    details: {
        roomNumber?: string;
        responseTimeMinutes?: number;
    },
    settings: any = {}
): PointsDetails => {
    const bellmanPoints = settings.bellman || {
        checkin: 2,
        checkout: 2,
        complete: 3,
        fast: 2,
        normal: 1,
        delay: -1
    };

    let basePoints = 0;
    let speedPoints = 0;

    switch (action) {
        case 'checkin':
            basePoints = bellmanPoints.checkin || 2;
            break;
        case 'checkout':
            basePoints = bellmanPoints.checkout || 2;
            break;
        case 'complete_bellman':
            basePoints = bellmanPoints.complete || 3;
            break;
        default:
            basePoints = 1;
    }

    // Speed points for bellman completion
    if (details.responseTimeMinutes !== undefined && action === 'complete_bellman') {
        const responseTime = details.responseTimeMinutes;
        const fastTime = bellmanPoints.fastTime || 3; // Default 3 mins
        const delayTime = bellmanPoints.delayTime || 5; // Default 5 mins

        if (responseTime < fastTime) {
            speedPoints = bellmanPoints.fast || 2;
        } else if (responseTime <= delayTime) {
            speedPoints = bellmanPoints.normal || 1;
        } else {
            speedPoints = bellmanPoints.delay || -1;
        }
    }

    const totalPoints = basePoints + speedPoints;

    const reasonMap: Record<string, string> = {
        'checkin': `تسجيل دخول غرفة ${details.roomNumber || ''}`,
        'checkout': `تسجيل خروج غرفة ${details.roomNumber || ''}`,
        'complete_bellman': `إتمام طلب بيلمان - غرفة ${details.roomNumber || ''}`
    };

    return {
        basePoints,
        speedPoints,
        totalPoints,
        reason: reasonMap[action] || action
    };
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Format time
 */
export const formatTime = (timestamp: any): string => {
    if (!timestamp) return '--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Format full date time
 */
export const formatFullDateTime = (timestamp: any): string => {
    if (!timestamp) return '--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const dayName = date.toLocaleDateString('ar-SA', { weekday: 'long' });
    const dateStr = date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
    const timeStr = date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    return `${dayName} ${dateStr} - ${timeStr}`;
};

/**
 * Get duration
 */
export const getDuration = (timestamp: any): string => {
    if (!timestamp) return '--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours < 1) return `${diffMins} دقيقة`;
    if (diffHours < 24) return `${diffHours} ساعة`;
    return `${Math.floor(diffHours / 24)} يوم`;
};

/**
 * Get time ago
 */
export const getTimeAgo = (timestamp: any): string => {
    if (!timestamp) return '--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `${diffMins} د`;
    return `${Math.floor(diffMins / 60)} س`;
};

// ============================================================
// PRINT HISTORY
// ============================================================

export const printBellmanHistory = (
    items: HistoryItem[],
    employeeName: string,
    branchName: string
): void => {
    if (items.length === 0) return;

    const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>سجل البيلمان - ${new Date().toLocaleDateString('ar-SA')}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; margin-bottom: 20px; color: #1a1a2e; }
                .info { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
                th { background: #2CBCB6; color: white; }
                tr:nth-child(even) { background: #f9f9f9; }
                .checkin { color: #10B981; }
                .checkout { color: #F59E0B; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <h1>سجل البيلمان</h1>
            <div class="info">
                <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-SA')}</p>
                <p><strong>الموظف:</strong> ${employeeName || '--'}</p>
                <p><strong>الفرع:</strong> ${branchName || '--'}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>رقم الغرفة</th>
                        <th>النوع</th>
                        <th>التاريخ والوقت</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
        const date = item.timestamp.toLocaleString('ar-SA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const type = item.type === 'checkin' ? 'دخول' : 'خروج';
        const typeClass = item.type === 'checkin' ? 'checkin' : 'checkout';

        return `
                            <tr>
                                <td>${item.roomNumber || '--'}</td>
                                <td class="${typeClass}">${type}</td>
                                <td>${date}</td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
            <div class="footer">
                تم الطباعة بواسطة نظام أدورا - ${new Date().toLocaleString('ar-SA')}
            </div>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    }
};

// ============================================================
// OFFLINE DETECTION & SYNC
// ============================================================

/**
 * Check if online
 */
export const isOnline = (): boolean => {
    return navigator.onLine;
};

/**
 * Setup offline detection listener
 */
export const setupOfflineDetection = (
    onOnline: () => void,
    onOffline: () => void
): (() => void) => {
    const handleOnline = () => onOnline();
    const handleOffline = () => onOffline();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
};

// ============================================================
// OVERDUE CHECKS
// ============================================================

/**
 * Check for overdue room cards
 */
export const checkOverdueCards = (
    cards: RoomCard[],
    thresholdHours: number = 24
): RoomCard[] => {
    const now = new Date();
    const overdueCards: RoomCard[] = [];

    cards.forEach(card => {
        const checkinDate = card.checkinAt?.toDate
            ? card.checkinAt.toDate()
            : new Date(card.checkinAt || 0);
        const diffHours = (now.getTime() - checkinDate.getTime()) / (1000 * 60 * 60);

        if (diffHours > thresholdHours) {
            overdueCards.push(card);
        }
    });

    return overdueCards;
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Room Cards
    subscribeToRoomCards,
    getAvailableRooms,
    groupRoomsByFloor,

    // Check-in/out
    submitCheckin,
    submitCheckout,

    // Bellman Requests
    subscribeToBellmanRequests,
    startBellmanRequest,
    completeBellmanRequest,

    // Employees
    loadReceptionEmployees,
    subscribeToReceptionEmployees,

    // History
    loadBellmanHistory,
    printBellmanHistory,

    // Points
    calculateBellmanPoints,

    // Utils
    formatTime,
    formatFullDateTime,
    getDuration,
    getTimeAgo,
    isOnline,
    setupOfflineDetection,
    checkOverdueCards
};
