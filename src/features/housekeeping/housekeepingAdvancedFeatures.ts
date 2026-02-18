/**
 * Housekeeping Advanced Features
 * Migrated from legacy housekeeping.js (2134 lines)
 * Adora Hotel Management System V2
 */

import { db } from '../../services/firebase';
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc, writeBatch,
    query, where, orderBy, limit, onSnapshot,
    serverTimestamp, Timestamp
} from 'firebase/firestore';
import { logger } from '../../services/loggerService';
import { formatDateGregorianEn, formatDateTimeGregorianEn } from '../../utils/dateUtils';

// ============================================================
// TYPES
// ============================================================

interface CleaningRequest {
    id: string;
    roomNumber: string;
    branch: string;
    serviceType: 'cleaning';
    cleaningType: 'occupied' | 'checkout';
    status: string;
    guestStatus?: 'in' | 'out';
    guestCount?: { adults: number; children: number };
    roomCardId?: string;
    timing?: 'immediate' | 'scheduled';
    scheduledDate?: any;
    hasMaintenance?: boolean;
    createdAt: any;
    timeline?: any;
    startedBy?: any;
    completedBy?: any;
    notes?: string;
    roomAssignments?: Record<string, { id: string; name: string }>;
}

interface InspectionRequest {
    id: string;
    roomNumber: string;
    branch: string;
    serviceType: 'inspection';
    status: string;
    source?: string;
    guestCount?: { adults: number; children: number };
    guestLocation?: string;
    roomCardId?: string;
    inspectionReport?: InspectionReport;
    createdAt: any;
    timeline?: any;
    createdBy?: any;
    inspectedBy?: any;
    receptionistName?: string;
    checkinBy?: any;
    checkinAt?: any;
    checkinNotes?: string;
    checkoutBy?: any;
    checkoutAt?: any;
    checkoutNotes?: string;
    checkoutReceptionistName?: string;
}

interface InspectionReport {
    minibar: Record<string, number>;
    damages?: string;
    damagePhoto?: string;
    lostItems?: string;
    roomStatus: 'clean' | 'needs_cleaning' | 'needs_maintenance';
    notes?: string;
}

interface MinibarItem {
    id: string;
    name: string;
    icon: string;
    price: number;
}

interface RoomAssignment {
    roomId: string;
    employeeId: string;
    employeeName: string;
}

interface Employee {
    id: string;
    name: string;
    code?: string;
    department: string;
    active: boolean;
}

// ============================================================
// DEFAULT MINIBAR ITEMS
// ============================================================

const defaultMinibarItems: MinibarItem[] = [
    { id: 'water', name: 'ماء', icon: '💧', price: 3 },
    { id: 'cola', name: 'كولا', icon: '🥤', price: 5 },
    { id: 'juice', name: 'عصير', icon: '🧃', price: 6 },
    { id: 'snack', name: 'سناك', icon: '🍫', price: 8 },
    { id: 'chips', name: 'شيبس', icon: '🥔', price: 5 },
    { id: 'nuts', name: 'مكسرات', icon: '🥜', price: 10 }
];

// ============================================================
// MINIBAR MANAGEMENT
// ============================================================

/**
 * Load minibar items from database
 */
export const loadMinibarItems = async (
    hotelId: string,
    branchId: string
): Promise<MinibarItem[]> => {
    try {
        const minibarQuery = query(
            // ✅ SaaS FIX: Use 'tenants' collection
            collection(db, `tenants/${hotelId}/branches/${branchId}/minibar`),
            orderBy('name')
        );

        const snapshot = await getDocs(minibarQuery);
        const items: MinibarItem[] = [];

        snapshot.forEach(doc => {
            items.push({
                id: doc.id,
                ...doc.data()
            } as MinibarItem);
        });

        // Fallback to defaults if empty
        if (items.length === 0) {
            return defaultMinibarItems;
        }

        return items;
    } catch (error) {
        logger.error('Error loading minibar items:', error, 'housekeepingAdvancedFeatures');
        return defaultMinibarItems;
    }
};

/**
 * Get default minibar items
 */
export const getDefaultMinibarItems = (): MinibarItem[] => {
    return [...defaultMinibarItems];
};

// ============================================================
// CLEANING REQUESTS
// ============================================================

/**
 * Subscribe to cleaning requests
 * ✅ FIX: Added tenantId parameter for tenant-scoped collection
 */
export const subscribeToCleaningRequests = (
    tenantId: string,
    branchId: string,
    callback: (active: CleaningRequest[], completed: CleaningRequest[]) => void
): (() => void) => {
    if (!tenantId) {
        logger.error('subscribeToCleaningRequests: tenantId is required', undefined, 'housekeepingAdvancedFeatures');
        callback([], []);
        return () => {};
    }
    const cleaningQuery = query(
        collection(db, `tenants/${tenantId}/requests`),
        where('branch', '==', branchId),
        where('serviceType', '==', 'cleaning')
    );

    return onSnapshot(cleaningQuery, snapshot => {
        const active: CleaningRequest[] = [];
        const completed: CleaningRequest[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        snapshot.forEach(doc => {
            const request = { id: doc.id, ...doc.data() } as CleaningRequest;

            if (request.status === 'COMPLETED') {
                const completedTime = request.timeline?.completed;
                if (completedTime) {
                    const completedDate = completedTime.toDate ? completedTime.toDate() : new Date(completedTime);
                    if (completedDate >= today) {
                        completed.push(request);
                    }
                }
            } else if (['CONFIRMED', 'IN_PROGRESS'].includes(request.status)) {
                active.push(request);
            }
        });

        // Sort by createdAt descending
        const sortByDate = (a: CleaningRequest, b: CleaningRequest) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
        };

        active.sort(sortByDate);
        completed.sort(sortByDate);

        callback(active, completed);
    });
};

/**
 * Start cleaning
 * ✅ FIX: Added tenantId parameter for tenant-scoped collection
 */
export const startCleaning = async (
    tenantId: string,
    requestId: string,
    employeeId: string,
    employeeName: string,
    cleaningType: 'occupied' | 'checkout',
    guestStatus: 'in' | 'out',
    roomAssignments: Record<string, { id: string; name: string }> = {}
): Promise<boolean> => {
    if (!tenantId) {
        throw new Error('tenantId is required');
    }
    try {
        const requestRef = doc(db, `tenants/${tenantId}/requests`, requestId);
        await updateDoc(requestRef, {
            status: 'IN_PROGRESS',
            cleaningType,
            guestStatus,
            startedBy: { id: employeeId, name: employeeName },
            roomAssignments,
            'timeline.started': serverTimestamp()
        });
        return true;
    } catch (error) {
        logger.error('Error starting cleaning:', error, 'housekeepingAdvancedFeatures');
        return false;
    }
};

/**
 * Complete cleaning (with optional maintenance request)
 * ✅ FIX: Added tenantId parameter for tenant-scoped collection
 */
export const completeCleaning = async (
    tenantId: string,
    requestId: string,
    employeeId: string,
    employeeName: string,
    branchId: string,
    cleaningData: {
        notes?: string;
        hasMaintenance: boolean;
        maintenanceType?: string;
        maintenanceDesc?: string;
        maintenancePhoto?: string;
        roomNumber: string;
        cleaningType: 'occupied' | 'checkout';
        roomCardId?: string;
    }
): Promise<boolean> => {
    if (!tenantId) {
        throw new Error('tenantId is required');
    }
    try {
        const batch = writeBatch(db);

        // Update cleaning request
        const requestRef = doc(db, `tenants/${tenantId}/requests`, requestId);
        batch.update(requestRef, {
            status: 'COMPLETED',
            notes: cleaningData.notes || null,
            hasMaintenance: cleaningData.hasMaintenance,
            completedBy: { id: employeeId, name: employeeName },
            'timeline.completed': serverTimestamp()
        });

        // Create maintenance request if needed
        if (cleaningData.hasMaintenance) {
            const isCheckoutCleaning = cleaningData.cleaningType === 'checkout';
            const requestsRef = collection(db, `tenants/${tenantId}/requests`);
            const maintRef = doc(requestsRef);
            batch.set(maintRef, {
                roomNumber: cleaningData.roomNumber,
                branch: branchId,
                source: 'HOUSEKEEPING',
                serviceType: 'maintenance',
                maintenanceType: cleaningData.maintenanceType,
                description: cleaningData.maintenanceDesc,
                photo: cleaningData.maintenancePhoto || null,
                status: 'MAINTENANCE_PENDING',
                requiresReinspection: isCheckoutCleaning,
                parentRequestId: requestId,
                roomCardId: cleaningData.roomCardId || null,
                tenantId: tenantId, // ✅ Add tenantId
                createdBy: { id: employeeId, name: employeeName },
                createdAt: serverTimestamp(),
                timeline: { created: serverTimestamp() }
            });
        }

        await batch.commit();
        return true;
    } catch (error) {
        logger.error('Error completing cleaning:', error, 'housekeepingAdvancedFeatures');
        return false;
    }
};

// ============================================================
// INSPECTION REQUESTS
// ============================================================

/**
 * Subscribe to inspection requests
 * ✅ FIX: Added tenantId parameter for tenant-scoped collection
 */
export const subscribeToInspectionRequests = (
    tenantId: string,
    branchId: string,
    callback: (requests: InspectionRequest[]) => void
): (() => void) => {
    if (!tenantId) {
        logger.error('subscribeToInspectionRequests: tenantId is required', undefined, 'housekeepingAdvancedFeatures');
        callback([]);
        return () => {};
    }
    const inspectionQuery = query(
        collection(db, `tenants/${tenantId}/requests`),
        where('branch', '==', branchId),
        where('serviceType', '==', 'inspection')
    );

    return onSnapshot(inspectionQuery, snapshot => {
        const requests: InspectionRequest[] = [];

        snapshot.forEach(doc => {
            const req = { id: doc.id, ...doc.data() } as InspectionRequest;
            // Only show CONFIRMED or PENDING_HOUSEKEEPING
            if (req.status === 'CONFIRMED' || req.status === 'PENDING_HOUSEKEEPING') {
                requests.push(req);
            }
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
 * Submit inspection report
 * ✅ FIX: Added tenantId parameter for tenant-scoped collection
 */
export const submitInspection = async (
    tenantId: string,
    requestId: string,
    employeeId: string,
    employeeName: string,
    report: InspectionReport,
    roomCardId?: string
): Promise<boolean> => {
    if (!tenantId) {
        throw new Error('tenantId is required');
    }
    try {
        const batch = writeBatch(db);

        // Update inspection request - goes back to reception for review
        const requestRef = doc(db, `tenants/${tenantId}/requests`, requestId);
        batch.update(requestRef, {
            status: 'PENDING_RECEPTION',
            inspectionReport: report,
            inspectedBy: { id: employeeId, name: employeeName },
            'timeline.inspected': serverTimestamp()
        });

        // Update room card if exists
        if (roomCardId) {
            const cardRef = doc(db, 'roomCards', roomCardId);
            batch.update(cardRef, {
                status: 'pending_reception_review',
                inspectionCompletedAt: serverTimestamp()
            });
        }

        await batch.commit();
        return true;
    } catch (error) {
        logger.error('Error submitting inspection:', error, 'housekeepingAdvancedFeatures');
        return false;
    }
};

// ============================================================
// TEAM MANAGEMENT
// ============================================================

/**
 * Load housekeeping employees
 */
export const loadHousekeepingEmployees = async (
    hotelId: string,
    branchId: string
): Promise<Employee[]> => {
    try {
        const employeesQuery = query(
            // ✅ SaaS FIX: Use 'tenants' collection
            collection(db, `tenants/${hotelId}/branches/${branchId}/employees`),
            where('department', '==', 'housekeeping'),
            where('active', '==', true)
        );

        const snapshot = await getDocs(employeesQuery);
        const employees: Employee[] = [];

        snapshot.forEach(doc => {
            employees.push({
                id: doc.id,
                ...doc.data()
            } as Employee);
        });

        return employees;
    } catch (error) {
        logger.error('Error loading housekeeping employees:', error, 'housekeepingAdvancedFeatures');
        return [];
    }
};

/**
 * Subscribe to housekeeping employees
 */
export const subscribeToHousekeepingEmployees = (
    hotelId: string,
    branchId: string,
    callback: (employees: Employee[]) => void
): (() => void) => {
    const employeesQuery = query(
        // ✅ SaaS FIX: Use 'tenants' collection
        collection(db, `tenants/${hotelId}/branches/${branchId}/employees`),
        where('department', '==', 'housekeeping'),
        where('active', '==', true)
    );

    return onSnapshot(employeesQuery, snapshot => {
        const employees: Employee[] = [];
        snapshot.forEach(doc => {
            employees.push({
                id: doc.id,
                ...doc.data()
            } as Employee);
        });
        callback(employees);
    });
};

// ============================================================
// ROOM SECTIONS FOR TEAM ASSIGNMENT
// ============================================================

interface RoomSection {
    id: string;
    name: string;
    icon: string;
}

export const getRoomSections = (): RoomSection[] => {
    return [
        { id: 'bedroom1', name: 'غرفة النوم 1', icon: '🛏️' },
        { id: 'bedroom2', name: 'غرفة النوم 2', icon: '🛏️' },
        { id: 'living', name: 'غرفة المعيشة', icon: '🛋️' },
        { id: 'kitchen', name: 'المطبخ', icon: '🍳' },
        { id: 'bathroom', name: 'الحمام', icon: '🚿' }
    ];
};

// ============================================================
// HISTORY & FILTERING
// ============================================================

interface HistoryFilter {
    action: 'all' | 'occupied' | 'checkout';
    period: 'today' | 'week' | 'month' | 'custom';
    customFrom?: Date | null;
    customTo?: Date | null;
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
 * Load cleaning history with filters
 * ✅ FIX: Added tenantId parameter for tenant-scoped collection
 */
export const loadCleaningHistory = async (
    tenantId: string,
    branchId: string,
    employeeId: string,
    filter: HistoryFilter
): Promise<any[]> => {
    if (!tenantId) {
        logger.error('loadCleaningHistory: tenantId is required', undefined, 'housekeepingAdvancedFeatures');
        return [];
    }
    try {
        const requestsQuery = query(
            collection(db, `tenants/${tenantId}/requests`),
            where('branch', '==', branchId),
            where('serviceType', '==', 'cleaning'),
            where('status', '==', 'COMPLETED'),
            where('completedBy.id', '==', employeeId)
        );

        const snapshot = await getDocs(requestsQuery);
        const dateRange = getDateRange(filter.period, filter.customFrom, filter.customTo);
        const results: any[] = [];

        snapshot.forEach(doc => {
            const req = doc.data();
            const completedTime = req.timeline?.completed;

            if (!completedTime) return;

            const completedDate = completedTime.toDate
                ? completedTime.toDate()
                : new Date(completedTime);

            // Date filter
            if (completedDate < dateRange.from || completedDate > dateRange.to) {
                return;
            }

            // Action filter
            if (filter.action !== 'all') {
                if (filter.action === 'occupied' && req.cleaningType === 'checkout') return;
                if (filter.action === 'checkout' && req.cleaningType !== 'checkout') return;
            }

            results.push({
                id: doc.id,
                ...req,
                completedDate
            });
        });

        // Sort by date descending
        results.sort((a, b) => b.completedDate.getTime() - a.completedDate.getTime());

        return results;
    } catch (error) {
        logger.error('Error loading cleaning history:', error, 'housekeepingAdvancedFeatures');
        return [];
    }
};

// ============================================================
// POINTS CALCULATION
// ============================================================

interface PointsDetails {
    basePoints: number;
    speedPoints: number;
    qualityPoints: number;
    totalPoints: number;
    reason: string;
}

/**
 * Calculate cleaning points
 */
export const calculateCleaningPoints = (
    action: string,
    details: {
        cleaningType?: 'occupied' | 'checkout';
        durationMinutes?: number;
        hasMaintenance?: boolean;
        roomNumber?: string;
    },
    settings: any = {}
): PointsDetails => {
    const housekeepingPoints = settings.housekeeping || {
        start: 1,
        completeOccupied: 3,
        completeCheckout: 5,
        inspection: 2,
        fast: 2,
        fastTime: 30,
        normal: 1,
        delay: -1,
        delayTime: 45,
        quality: 1
    };

    let basePoints = 0;
    let speedPoints = 0;
    let qualityPoints = 0;

    switch (action) {
        case 'start_cleaning':
            basePoints = housekeepingPoints.start || 1;
            break;
        case 'complete_cleaning':
            if (details.cleaningType === 'checkout') {
                basePoints = housekeepingPoints.completeCheckout || 5;
            } else {
                basePoints = housekeepingPoints.completeOccupied || 3;
            }
            break;
        case 'complete_inspection':
            basePoints = housekeepingPoints.inspection || 2;
            break;
        default:
            basePoints = 1;
    }

    // Speed points
    if (details.durationMinutes !== undefined && action === 'complete_cleaning') {
        const duration = details.durationMinutes;
        const fastTime = housekeepingPoints.fastTime || 30;
        const delayTime = housekeepingPoints.delayTime || 45;

        if (duration < fastTime) {
            speedPoints = housekeepingPoints.fast || 2;
        } else if (duration <= delayTime) {
            speedPoints = housekeepingPoints.normal || 1;
        } else {
            speedPoints = housekeepingPoints.delay || -1;
        }
    }

    // Quality points (no maintenance issues)
    if (action === 'complete_cleaning' && !details.hasMaintenance) {
        qualityPoints = housekeepingPoints.quality || 1;
    }

    const totalPoints = basePoints + speedPoints + qualityPoints;

    const reasonMap: Record<string, string> = {
        'start_cleaning': `بدء تنظيف غرفة ${details.roomNumber || ''}`,
        'complete_cleaning': `إتمام تنظيف ${details.cleaningType === 'checkout' ? 'مغادرة' : 'ساكن'} - غرفة ${details.roomNumber || ''}`,
        'complete_inspection': `إتمام فحص غرفة ${details.roomNumber || ''}`
    };

    return {
        basePoints,
        speedPoints,
        qualityPoints,
        totalPoints,
        reason: reasonMap[action] || action
    };
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get time ago string
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

/**
 * Format time
 */
export const formatTime = (timestamp: any): string => {
    if (!timestamp) return '--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Check if date is today
 */
export const isToday = (timestamp: any): boolean => {
    if (!timestamp) return false;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toDateString() === new Date().toDateString();
};

/**
 * Calculate cleaning duration
 */
export const calculateDuration = (startTime: any): number => {
    if (!startTime) return 0;
    const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
    return Math.floor((new Date().getTime() - start.getTime()) / 60000);
};

// ============================================================
// SOURCE BADGE HELPER
// ============================================================

export const getSourceBadge = (source: string): { text: string; style: string } => {
    switch (source) {
        case 'CHECKOUT':
            return { text: '🚪 خروج', style: 'checkout' };
        case 'MAINTENANCE':
            return { text: '🔧 إعادة فحص بعد صيانة', style: 'maintenance' };
        default:
            return { text: '📋 طلب فحص', style: 'request' };
    }
};

// ============================================================
// PRINT HISTORY
// ============================================================

export const printCleaningHistory = (
    items: any[],
    employeeName: string,
    branchName: string
): void => {
    if (items.length === 0) return;

    const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>سجل التنظيف - ${formatDateGregorianEn(new Date())}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; margin-bottom: 20px; color: #1a1a2e; }
                .info { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
                th { background: #10B981; color: white; }
                tr:nth-child(even) { background: #f9f9f9; }
                .checkout { color: #F59E0B; }
                .occupied { color: #10B981; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <h1>سجل التنظيف</h1>
            <div class="info">
                <p><strong>التاريخ:</strong> ${formatDateGregorianEn(new Date())}</p>
                <p><strong>الموظف:</strong> ${employeeName || '--'}</p>
                <p><strong>الفرع:</strong> ${branchName || '--'}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>رقم الغرفة</th>
                        <th>نوع التنظيف</th>
                        <th>التاريخ والوقت</th>
                        <th>المدة</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
        const date = formatDateTimeGregorianEn(item.completedDate, { dateStyle: 'medium', showSeconds: false });
        const type = item.cleaningType === 'checkout' ? 'مغادرة' : 'ساكن';
        const typeClass = item.cleaningType === 'checkout' ? 'checkout' : 'occupied';

        let duration = '--';
        if (item.timeline?.started && item.timeline?.completed) {
            const start = item.timeline.started.toDate ? item.timeline.started.toDate() : new Date(item.timeline.started);
            const end = item.timeline.completed.toDate ? item.timeline.completed.toDate() : new Date(item.timeline.completed);
            const mins = Math.floor((end.getTime() - start.getTime()) / 60000);
            duration = `${mins} دقيقة`;
        }

        return `
                            <tr>
                                <td>${item.roomNumber || '--'}</td>
                                <td class="${typeClass}">${type}</td>
                                <td>${date}</td>
                                <td>${duration}</td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
            <div class="footer">
                تم الطباعة بواسطة نظام أدورا - ${formatDateTimeGregorianEn(new Date(), { showSeconds: false })}
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
// EXPORTS
// ============================================================

export default {
    // Minibar
    loadMinibarItems,
    getDefaultMinibarItems,

    // Cleaning
    subscribeToCleaningRequests,
    startCleaning,
    completeCleaning,

    // Inspection
    subscribeToInspectionRequests,
    submitInspection,

    // Team
    loadHousekeepingEmployees,
    subscribeToHousekeepingEmployees,
    getRoomSections,

    // History
    loadCleaningHistory,
    printCleaningHistory,

    // Points
    calculateCleaningPoints,

    // Utils
    getTimeAgo,
    formatTime,
    isToday,
    calculateDuration,
    getSourceBadge
};
