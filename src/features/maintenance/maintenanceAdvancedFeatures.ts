/**
 * Maintenance Advanced Features
 * Migrated from legacy maintenance.js (1199 lines)
 * Adora Hotel Management System V2
 */

import { db } from '../../services/firebase';
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc, writeBatch,
    query, where, orderBy, limit, onSnapshot,
    serverTimestamp, Timestamp
} from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

interface MaintenanceRequest {
    id: string;
    roomNumber: string;
    branch: string;
    serviceType: 'maintenance';
    maintenanceType: 'electrical' | 'plumbing' | 'ac' | 'furniture' | 'other';
    status: string;
    description?: string;
    photo?: string;
    beforePhoto?: string;
    afterPhoto?: string;
    guestStatus?: 'in' | 'out';
    source?: string;
    timing?: 'immediate' | 'scheduled';
    scheduledDate?: any;
    requiresReinspection?: boolean;
    roomCardId?: string;
    parentRequestId?: string;
    inspectionReport?: any;
    guestCount?: { adults: number; children: number };
    guestLocation?: string;
    createdAt: any;
    timeline?: any;
    startedBy?: any;
    completedBy?: any;
    notes?: string;
}

// ============================================================
// MAINTENANCE TYPE NAMES
// ============================================================

const MAINTENANCE_TYPES: Record<string, string> = {
    'electrical': 'كهرباء',
    'plumbing': 'سباكة',
    'ac': 'تكييف',
    'furniture': 'أثاث',
    'other': 'أخرى'
};

const SOURCE_LABELS: Record<string, string> = {
    'HOUSEKEEPING': '🧹 هاوس كيبنج',
    'QR': '📱 النزيل'
};

export const getMaintenanceTypeName = (type: string): string => {
    return MAINTENANCE_TYPES[type] || type;
};

export const getSourceLabel = (source: string): string => {
    return SOURCE_LABELS[source] || 'طلب يدوي';
};

// ============================================================
// MAINTENANCE REQUESTS
// ============================================================

/**
 * Subscribe to maintenance requests
 */
export const subscribeToMaintenanceRequests = (
    branchId: string,
    callback: (active: MaintenanceRequest[], completed: MaintenanceRequest[]) => void
): (() => void) => {
    const maintenanceQuery = query(
        collection(db, 'requests'),
        where('branch', '==', branchId),
        where('serviceType', '==', 'maintenance')
    );

    return onSnapshot(maintenanceQuery, snapshot => {
        const active: MaintenanceRequest[] = [];
        const completed: MaintenanceRequest[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        snapshot.forEach(doc => {
            const request = { id: doc.id, ...doc.data() } as MaintenanceRequest;

            if (request.status === 'COMPLETED') {
                const completedTime = request.timeline?.completed;
                if (completedTime) {
                    const completedDate = completedTime.toDate ? completedTime.toDate() : new Date(completedTime);
                    if (completedDate >= today) {
                        completed.push(request);
                    }
                }
            } else if ([
                'CONFIRMED',
                'IN_PROGRESS',
                'PENDING_MAINTENANCE',
                'MAINTENANCE_PENDING',
                'MAINTENANCE_IN_PROGRESS'
            ].includes(request.status)) {
                active.push(request);
            }
        });

        // Sort by createdAt descending
        const sortByDate = (a: MaintenanceRequest, b: MaintenanceRequest) => {
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
 * Start maintenance work
 */
export const startMaintenance = async (
    requestId: string,
    employeeId: string,
    employeeName: string,
    beforePhoto?: string
): Promise<boolean> => {
    try {
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, {
            status: 'MAINTENANCE_IN_PROGRESS',
            beforePhoto: beforePhoto || null,
            startedBy: { id: employeeId, name: employeeName },
            'timeline.started': serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error starting maintenance:', error);
        return false;
    }
};

/**
 * Complete maintenance (with optional re-inspection request)
 */
export const completeMaintenance = async (
    requestId: string,
    employeeId: string,
    employeeName: string,
    branchId: string,
    maintenanceData: {
        afterPhoto: string;
        notes?: string;
        requiresReinspection: boolean;
        roomNumber: string;
        maintenanceType: string;
        description?: string;
        beforePhoto?: string;
        roomCardId?: string;
        parentRequestId?: string;
        inspectionReport?: any;
        guestCount?: { adults: number; children: number };
        guestLocation?: string;
        receptionistId?: string;
        receptionistName?: string;
        checkinBy?: any;
        checkinAt?: any;
        checkoutBy?: any;
        checkoutAt?: any;
    }
): Promise<boolean> => {
    try {
        const batch = writeBatch(db);

        // 1. Update maintenance request as completed
        const requestRef = doc(db, 'requests', requestId);
        batch.update(requestRef, {
            status: 'COMPLETED',
            afterPhoto: maintenanceData.afterPhoto,
            notes: maintenanceData.notes || null,
            completedBy: { id: employeeId, name: employeeName },
            'timeline.completed': serverTimestamp()
        });

        // 2. Create re-inspection request if needed
        if (maintenanceData.requiresReinspection) {
            // Check for existing inspection request
            const existingQuery = query(
                collection(db, 'requests'),
                where('branch', '==', branchId),
                where('roomNumber', '==', maintenanceData.roomNumber),
                where('serviceType', '==', 'inspection'),
                where('status', '==', 'PENDING_HOUSEKEEPING'),
                limit(1)
            );
            const existingSnapshot = await getDocs(existingQuery);

            if (existingSnapshot.empty) {
                // Create new inspection request
                const reinspectionRef = doc(collection(db, 'requests'));
                batch.set(reinspectionRef, {
                    roomNumber: maintenanceData.roomNumber,
                    branch: branchId,
                    source: 'MAINTENANCE',
                    serviceType: 'inspection',
                    status: 'PENDING_HOUSEKEEPING',
                    roomCardId: maintenanceData.roomCardId || null,
                    parentRequestId: requestId,
                    originalInspectionId: maintenanceData.parentRequestId || null,
                    guestCount: maintenanceData.guestCount || null,
                    guestLocation: maintenanceData.guestLocation || null,
                    receptionistId: maintenanceData.receptionistId || null,
                    receptionistName: maintenanceData.receptionistName || null,
                    checkinBy: maintenanceData.checkinBy || null,
                    checkinAt: maintenanceData.checkinAt || null,
                    checkoutBy: maintenanceData.checkoutBy || null,
                    checkoutAt: maintenanceData.checkoutAt || null,
                    maintenanceReport: {
                        maintenanceType: maintenanceData.maintenanceType,
                        description: maintenanceData.description,
                        beforePhoto: maintenanceData.beforePhoto,
                        afterPhoto: maintenanceData.afterPhoto,
                        notes: maintenanceData.notes || null,
                        completedBy: { id: employeeId, name: employeeName }
                    },
                    previousInspectionReport: maintenanceData.inspectionReport || null,
                    createdBy: { id: employeeId, name: employeeName },
                    createdAt: serverTimestamp(),
                    timeline: { created: serverTimestamp() }
                });
            } else {
                // Update existing inspection request
                const existingRef = doc(db, 'requests', existingSnapshot.docs[0].id);
                batch.update(existingRef, {
                    parentRequestId: requestId,
                    maintenanceReport: {
                        maintenanceType: maintenanceData.maintenanceType,
                        description: maintenanceData.description,
                        beforePhoto: maintenanceData.beforePhoto,
                        afterPhoto: maintenanceData.afterPhoto,
                        notes: maintenanceData.notes || null,
                        completedBy: { id: employeeId, name: employeeName }
                    }
                });
            }
        }

        await batch.commit();
        return true;
    } catch (error) {
        console.error('Error completing maintenance:', error);
        return false;
    }
};

// ============================================================
// HISTORY
// ============================================================

interface HistoryFilter {
    action: 'all' | 'electrical' | 'plumbing' | 'ac' | 'furniture' | 'other';
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
 * Load maintenance history with filters
 */
export const loadMaintenanceHistory = async (
    branchId: string,
    filter: HistoryFilter
): Promise<any[]> => {
    try {
        const requestsQuery = query(
            collection(db, 'requests'),
            where('branch', '==', branchId),
            where('serviceType', '==', 'maintenance')
        );

        const snapshot = await getDocs(requestsQuery);
        const dateRange = getDateRange(filter.period, filter.customFrom, filter.customTo);
        const results: any[] = [];

        snapshot.forEach(doc => {
            const req = doc.data();

            // Get work date
            const workDate = req.timeline?.completed?.toDate
                ? req.timeline.completed.toDate()
                : (req.timeline?.started?.toDate
                    ? req.timeline.started.toDate()
                    : (req.createdAt?.toDate
                        ? req.createdAt.toDate()
                        : new Date(0)));

            // Date filter
            if (workDate < dateRange.from || workDate > dateRange.to) {
                return;
            }

            // Action filter
            if (filter.action !== 'all' && req.maintenanceType !== filter.action) {
                return;
            }

            results.push({
                id: doc.id,
                ...req,
                workDate
            });
        });

        // Sort by date descending
        results.sort((a, b) => b.workDate.getTime() - a.workDate.getTime());

        return results;
    } catch (error) {
        console.error('Error loading maintenance history:', error);
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
 * Calculate maintenance points
 */
export const calculateMaintenancePoints = (
    maintenanceType: string,
    durationMinutes: number | undefined,
    roomNumber: string,
    settings: any = {}
): PointsDetails => {
    const maintenancePoints = settings.maintenance || {
        electrical: 5,
        plumbing: 4,
        ac: 4,
        furniture: 3,
        other: 3,
        fast: 2,
        fastTime: 20,
        normal: 1,
        delay: -1,
        delayTime: 40
    };

    let basePoints = 0;
    let speedPoints = 0;

    // Base points by maintenance type
    switch (maintenanceType) {
        case 'electrical':
            basePoints = maintenancePoints.electrical || 5;
            break;
        case 'plumbing':
            basePoints = maintenancePoints.plumbing || 4;
            break;
        case 'ac':
            basePoints = maintenancePoints.ac || 4;
            break;
        case 'furniture':
            basePoints = maintenancePoints.furniture || 3;
            break;
        default:
            basePoints = maintenancePoints.other || 3;
    }

    // Speed points
    if (durationMinutes !== undefined) {
        const fastTime = maintenancePoints.fastTime || 20;
        const delayTime = maintenancePoints.delayTime || 40;

        if (durationMinutes < fastTime) {
            speedPoints = maintenancePoints.fast || 2;
        } else if (durationMinutes <= delayTime) {
            speedPoints = maintenancePoints.normal || 1;
        } else {
            speedPoints = maintenancePoints.delay || -1;
        }
    }

    const totalPoints = basePoints + speedPoints;
    const reason = `إتمام صيانة ${getMaintenanceTypeName(maintenanceType)} - غرفة ${roomNumber}`;

    return {
        basePoints,
        speedPoints,
        totalPoints,
        reason
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
 * Check if date is today
 */
export const isToday = (timestamp: any): boolean => {
    if (!timestamp) return false;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toDateString() === new Date().toDateString();
};

/**
 * Calculate work duration
 */
export const calculateDuration = (startTime: any): number => {
    if (!startTime) return 0;
    const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
    return Math.floor((new Date().getTime() - start.getTime()) / 60000);
};

/**
 * Get status badge info
 */
export const getStatusBadge = (status: string): { text: string; class: string } => {
    switch (status) {
        case 'COMPLETED':
            return { text: '✅ مكتمل', class: 'completed' };
        case 'IN_PROGRESS':
        case 'MAINTENANCE_IN_PROGRESS':
            return { text: '🔄 جاري', class: 'in-progress' };
        case 'CONFIRMED':
        case 'PENDING_MAINTENANCE':
        case 'MAINTENANCE_PENDING':
            return { text: '⏳ معلق', class: 'pending' };
        default:
            return { text: status, class: '' };
    }
};

// ============================================================
// PRINT HISTORY
// ============================================================

export const printMaintenanceHistory = (
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
            <title>سجل الصيانة - ${new Date().toLocaleDateString('ar-SA')}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; margin-bottom: 20px; color: #1a1a2e; }
                .info { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
                th { background: #F59E0B; color: white; }
                tr:nth-child(even) { background: #f9f9f9; }
                .completed { color: #10B981; }
                .in-progress { color: #3B82F6; }
                .pending { color: #F59E0B; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <h1>سجل الصيانة</h1>
            <div class="info">
                <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-SA')}</p>
                <p><strong>الموظف:</strong> ${employeeName || '--'}</p>
                <p><strong>الفرع:</strong> ${branchName || '--'}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>رقم الغرفة</th>
                        <th>نوع الصيانة</th>
                        <th>الحالة</th>
                        <th>التاريخ والوقت</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
        const date = item.workDate.toLocaleString('ar-SA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const type = getMaintenanceTypeName(item.maintenanceType);
        const statusBadge = getStatusBadge(item.status);

        return `
                            <tr>
                                <td>${item.roomNumber || '--'}</td>
                                <td>${type}</td>
                                <td class="${statusBadge.class}">${statusBadge.text}</td>
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
// EXPORTS
// ============================================================

export default {
    // Requests
    subscribeToMaintenanceRequests,
    startMaintenance,
    completeMaintenance,

    // History
    loadMaintenanceHistory,
    printMaintenanceHistory,

    // Points
    calculateMaintenancePoints,

    // Utils
    getMaintenanceTypeName,
    getSourceLabel,
    getTimeAgo,
    isToday,
    calculateDuration,
    getStatusBadge
};
