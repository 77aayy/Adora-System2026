/**
 * Procurement Advanced Features
 * Migrated from legacy procurement.js (1614 lines)
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

interface ProcurementRequest {
    id: string;
    branch: string;
    serviceType: 'procurement';
    source: string;
    itemName: string;
    quantity: number;
    description?: string;
    priority: 'urgent' | 'normal' | 'scheduled';
    status: string;
    isUrgent?: boolean;
    orderId?: string;
    scheduledDate?: any;
    createdAt: any;
    createdBy?: any;
    purchasedBy?: any;
    purchasedQuantity?: number;
    cost?: number;
    purchaseNotes?: string;
    receivedBy?: any;
    receivedQuantity?: number;
    receiveNotes?: string;
    timeline?: any;
    photo?: string;
}

interface BranchSettings {
    procurementTimes?: {
        urgent: number;
        normal: number;
    };
    procurementPoints?: {
        purchase: number;
        receive: number;
        early: number;
        ontime: number;
        delay: number;
    };
}

interface OrderGroup {
    orderId: string;
    items: ProcurementRequest[];
    createdAt: any;
    createdBy?: any;
    source: string;
    priority: string;
    branch: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const SOURCE_LABELS: Record<string, string> = {
    'reception': '📞 الاستقبال',
    'housekeeping': '🧹 هاوس كيبنج',
    'maintenance': '🔧 الصيانة',
    'manager': '👔 المدير',
    'shortage': '⚠️ عجز'
};

const PRIORITY_LABELS: Record<string, string> = {
    'urgent': '🔴 عاجل',
    'scheduled': '📅 مجدول',
    'normal': '🟢 عادي'
};

export const getSourceLabel = (source: string): string => SOURCE_LABELS[source] || '📋 طلب';
export const getPriorityLabel = (priority: string): string => PRIORITY_LABELS[priority] || PRIORITY_LABELS.normal;

// ============================================================
// PROCUREMENT REQUESTS
// ============================================================

/**
 * Subscribe to procurement requests
 */
export const subscribeToProcurementRequests = (
    branchId: string,
    callback: (pending: ProcurementRequest[], purchased: ProcurementRequest[], completed: ProcurementRequest[]) => void
): (() => void) => {
    const procurementQuery = query(
        collection(db, 'requests'),
        where('branch', '==', branchId),
        where('serviceType', '==', 'procurement')
    );

    return onSnapshot(procurementQuery, snapshot => {
        const pending: ProcurementRequest[] = [];
        const purchased: ProcurementRequest[] = [];
        const completed: ProcurementRequest[] = [];

        snapshot.forEach(doc => {
            const request = { id: doc.id, ...doc.data() } as ProcurementRequest;

            switch (request.status) {
                case 'CONFIRMED':
                    pending.push(request);
                    break;
                case 'PURCHASED':
                    purchased.push(request);
                    break;
                case 'COMPLETED':
                    completed.push(request);
                    break;
            }
        });

        // Sort by createdAt descending
        const sortByDate = (a: ProcurementRequest, b: ProcurementRequest) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
        };

        pending.sort(sortByDate);
        purchased.sort(sortByDate);
        completed.sort(sortByDate);

        callback(pending, purchased, completed);
    });
};

/**
 * Group requests by orderId
 */
export const groupByOrderId = (requests: ProcurementRequest[]): OrderGroup[] => {
    const groups: Record<string, OrderGroup> = {};

    requests.forEach(req => {
        const groupKey = req.orderId || `single_${req.id}`;

        if (!groups[groupKey]) {
            groups[groupKey] = {
                orderId: groupKey,
                items: [],
                createdAt: req.createdAt,
                createdBy: req.createdBy,
                source: req.source,
                priority: req.priority,
                branch: req.branch
            };
        }
        groups[groupKey].items.push(req);
    });

    // Sort by date
    return Object.values(groups).sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
    });
};

// ============================================================
// DELAY CHECKING
// ============================================================

/**
 * Check if request is delayed
 */
export const isDelayed = (
    request: ProcurementRequest,
    settings: BranchSettings | null
): boolean => {
    if (!request.createdAt) return false;

    const createdAt = request.createdAt.toDate
        ? request.createdAt.toDate()
        : new Date(request.createdAt);
    const now = new Date();
    const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    // If scheduled, compare with scheduled date
    if (request.priority === 'scheduled' && request.scheduledDate) {
        const scheduled = new Date(request.scheduledDate);
        return now > scheduled;
    }

    const urgentHours = settings?.procurementTimes?.urgent || 4;
    const normalHours = settings?.procurementTimes?.normal || 24;

    if (request.priority === 'urgent' || request.isUrgent) {
        return hoursElapsed > urgentHours;
    }

    return hoursElapsed > normalHours;
};

/**
 * Get time remaining before delay
 */
export const getTimeRemaining = (
    request: ProcurementRequest,
    settings: BranchSettings | null
): number | null => {
    if (!request.createdAt) return null;

    const createdAt = request.createdAt.toDate
        ? request.createdAt.toDate()
        : new Date(request.createdAt);
    const now = new Date();
    const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    const urgentHours = settings?.procurementTimes?.urgent || 4;
    const normalHours = settings?.procurementTimes?.normal || 24;

    if (request.priority === 'scheduled' && request.scheduledDate) {
        const deadline = new Date(request.scheduledDate);
        return (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    }

    const deadline = (request.priority === 'urgent' || request.isUrgent)
        ? urgentHours
        : normalHours;

    return deadline - hoursElapsed;
};

// ============================================================
// PURCHASE OPERATIONS
// ============================================================

/**
 * Purchase single item
 */
export const purchaseItem = async (
    requestId: string,
    quantity: number,
    cost: number,
    notes: string,
    employeeId: string,
    employeeName: string
): Promise<boolean> => {
    try {
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, {
            status: 'PURCHASED',
            purchasedQuantity: quantity,
            cost,
            purchaseNotes: notes || null,
            purchasedBy: { id: employeeId, name: employeeName },
            'timeline.purchased': serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error purchasing item:', error);
        return false;
    }
};

/**
 * Purchase multiple items (batch)
 */
export const purchaseItems = async (
    items: { id: string; quantity: number }[],
    employeeId: string,
    employeeName: string
): Promise<boolean> => {
    try {
        const batch = writeBatch(db);

        items.forEach(item => {
            const ref = doc(db, 'requests', item.id);
            batch.update(ref, {
                status: 'PURCHASED',
                purchasedQuantity: item.quantity,
                purchasedBy: { id: employeeId, name: employeeName },
                'timeline.purchased': serverTimestamp()
            });
        });

        await batch.commit();
        return true;
    } catch (error) {
        console.error('Error purchasing items:', error);
        return false;
    }
};

// ============================================================
// RECEIVE OPERATIONS
// ============================================================

/**
 * Receive single item
 */
export const receiveItem = async (
    requestId: string,
    receivedQuantity: number,
    notes: string,
    employeeId: string,
    employeeName: string,
    branchId: string,
    originalRequest: ProcurementRequest
): Promise<{ success: boolean; shortageCreated: boolean }> => {
    try {
        const batch = writeBatch(db);
        const requestedQuantity = originalRequest.quantity || 1;

        // Update original request
        const requestRef = doc(db, 'requests', requestId);
        batch.update(requestRef, {
            status: 'COMPLETED',
            receivedQuantity,
            receiveNotes: notes || null,
            receivedBy: { id: employeeId, name: employeeName },
            'timeline.completed': serverTimestamp()
        });

        // Create shortage request if needed
        let shortageCreated = false;
        if (receivedQuantity < requestedQuantity) {
            const shortage = requestedQuantity - receivedQuantity;
            const shortageRef = doc(collection(db, 'requests'));
            batch.set(shortageRef, {
                branch: branchId,
                serviceType: 'procurement',
                source: 'shortage',
                itemName: originalRequest.itemName,
                quantity: shortage,
                description: `عجز من الطلب السابق - كان المطلوب ${requestedQuantity} والمستلم ${receivedQuantity}`,
                status: 'CONFIRMED',
                parentRequestId: requestId,
                createdBy: { id: employeeId, name: employeeName },
                createdAt: serverTimestamp(),
                timeline: { created: serverTimestamp() }
            });
            shortageCreated = true;
        }

        await batch.commit();
        return { success: true, shortageCreated };
    } catch (error) {
        console.error('Error receiving item:', error);
        return { success: false, shortageCreated: false };
    }
};

/**
 * Receive multiple items (batch)
 */
export const receiveItems = async (
    items: { id: string; receivedQty: number }[],
    employeeId: string,
    employeeName: string
): Promise<boolean> => {
    try {
        const batch = writeBatch(db);

        items.forEach(item => {
            const ref = doc(db, 'requests', item.id);
            batch.update(ref, {
                status: 'COMPLETED',
                receivedQuantity: item.receivedQty,
                receivedBy: { id: employeeId, name: employeeName },
                'timeline.completed': serverTimestamp()
            });
        });

        await batch.commit();
        return true;
    } catch (error) {
        console.error('Error receiving items:', error);
        return false;
    }
};

// ============================================================
// NOTIFICATIONS
// ============================================================

interface ProcurementNotification {
    type: 'purchase' | 'receive';
    requestId: string;
    itemName: string;
    quantity?: number;
    receivedQuantity?: number;
    requestedQuantity?: number;
    shortage?: number;
    source?: string;
    createdBy?: any;
}

/**
 * Create procurement notification
 */
export const createNotification = async (
    branchId: string,
    notification: ProcurementNotification
): Promise<boolean> => {
    try {
        await addDoc(collection(db, 'procurementNotifications'), {
            branch: branchId,
            ...notification,
            read: false,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error creating notification:', error);
        return false;
    }
};

/**
 * Subscribe to notifications
 */
export const subscribeToNotifications = (
    branchId: string,
    callback: (notifications: any[]) => void
): (() => void) => {
    const notificationsQuery = query(
        collection(db, 'procurementNotifications'),
        where('branch', '==', branchId),
        where('read', '==', false)
    );

    return onSnapshot(notificationsQuery, snapshot => {
        const notifications: any[] = [];
        snapshot.forEach(doc => {
            notifications.push({ id: doc.id, ...doc.data() });
        });
        callback(notifications);
    });
};

/**
 * Mark notification as read
 */
export const markNotificationRead = async (notificationId: string): Promise<boolean> => {
    try {
        await updateDoc(doc(db, 'procurementNotifications', notificationId), {
            read: true
        });
        return true;
    } catch (error) {
        console.error('Error marking notification read:', error);
        return false;
    }
};

// ============================================================
// HISTORY
// ============================================================

interface HistoryFilter {
    action: 'all' | 'purchased' | 'received';
    period: 'today' | 'week' | 'month' | 'custom';
    customFrom?: Date | null;
    customTo?: Date | null;
}

/**
 * Get date range
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
 * Load procurement history
 */
export const loadProcurementHistory = async (
    branchId: string,
    employeeId: string,
    filter: HistoryFilter
): Promise<any[]> => {
    try {
        const requestsQuery = query(
            collection(db, 'requests'),
            where('branch', '==', branchId),
            where('serviceType', '==', 'procurement')
        );

        const snapshot = await getDocs(requestsQuery);
        const dateRange = getDateRange(filter.period, filter.customFrom, filter.customTo);
        const results: any[] = [];

        snapshot.forEach(doc => {
            const req = doc.data();

            // Filter by action type
            if (filter.action === 'purchased') {
                if (req.purchasedBy?.id !== employeeId) return;
            } else if (filter.action === 'received') {
                if (req.receivedBy?.id !== employeeId) return;
            } else {
                // 'all' - must be purchased or received by this employee
                if (req.purchasedBy?.id !== employeeId && req.receivedBy?.id !== employeeId) return;
            }

            // Get work date
            const workDate = filter.action === 'received' && req.timeline?.completed
                ? (req.timeline.completed.toDate ? req.timeline.completed.toDate() : new Date(req.timeline.completed))
                : (req.timeline?.purchased?.toDate ? req.timeline.purchased.toDate() : new Date(req.timeline?.purchased || 0));

            if (workDate < dateRange.from || workDate > dateRange.to) return;

            results.push({
                id: doc.id,
                ...req,
                workDate
            });
        });

        results.sort((a, b) => b.workDate.getTime() - a.workDate.getTime());
        return results;
    } catch (error) {
        console.error('Error loading procurement history:', error);
        return [];
    }
};

// ============================================================
// POINTS CALCULATION
// ============================================================

interface PointsDetails {
    basePoints: number;
    timePoints: number;
    totalPoints: number;
    reason: string;
}

/**
 * Calculate procurement points
 */
export const calculateProcurementPoints = (
    action: 'purchase' | 'receive',
    details: {
        itemName?: string;
        scheduledDate?: any;
        count?: number;
    },
    settings: BranchSettings | null
): PointsDetails => {
    const procurementPoints = settings?.procurementPoints || {
        purchase: 2,
        receive: 3,
        early: 2,
        ontime: 1,
        delay: -2
    };

    let basePoints = 0;
    let timePoints = 0;

    if (action === 'purchase') {
        basePoints = procurementPoints.purchase || 2;
    } else if (action === 'receive') {
        basePoints = procurementPoints.receive || 3;
    } else {
        basePoints = 1;
    }

    // Time points for purchase
    if (action === 'purchase' && details.scheduledDate) {
        const scheduledDate = new Date(details.scheduledDate);
        const purchaseDate = new Date();
        const diffDays = Math.floor((purchaseDate.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            timePoints = procurementPoints.early || 2;
        } else if (diffDays === 0) {
            timePoints = procurementPoints.ontime || 1;
        } else {
            timePoints = procurementPoints.delay || -2;
        }
    }

    const totalPoints = basePoints + timePoints;

    let reason = '';
    if (action === 'purchase') {
        reason = `شراء ${details.itemName || 'منتج'}`;
        if (details.count && details.count > 1) {
            reason = `شراء ${details.count} منتجات`;
        }
    } else {
        reason = `استلام ${details.itemName || 'منتج'}`;
        if (details.count && details.count > 1) {
            reason = `استلام ${details.count} منتجات`;
        }
    }

    return {
        basePoints,
        timePoints,
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

// ============================================================
// PRINT HISTORY
// ============================================================

export const printProcurementHistory = (
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
            <title>سجل المشتريات - ${new Date().toLocaleDateString('ar-SA')}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; margin-bottom: 20px; color: #1a1a2e; }
                .info { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
                th { background: #8B5CF6; color: white; }
                tr:nth-child(even) { background: #f9f9f9; }
                .purchase { color: #3B82F6; }
                .receive { color: #10B981; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <h1>سجل المشتريات</h1>
            <div class="info">
                <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-SA')}</p>
                <p><strong>الموظف:</strong> ${employeeName || '--'}</p>
                <p><strong>الفرع:</strong> ${branchName || '--'}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>المنتج</th>
                        <th>الكمية</th>
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
        const status = item.status === 'COMPLETED' ? 'مستلم' : 'مشترى';
        const statusClass = item.status === 'COMPLETED' ? 'receive' : 'purchase';

        return `
                            <tr>
                                <td>${item.itemName || '--'}</td>
                                <td>${item.quantity || 1}</td>
                                <td class="${statusClass}">${status}</td>
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
    subscribeToProcurementRequests,
    groupByOrderId,

    // Delay
    isDelayed,
    getTimeRemaining,

    // Purchase
    purchaseItem,
    purchaseItems,

    // Receive
    receiveItem,
    receiveItems,

    // Notifications
    createNotification,
    subscribeToNotifications,
    markNotificationRead,

    // History
    loadProcurementHistory,
    printProcurementHistory,

    // Points
    calculateProcurementPoints,

    // Utils
    getTimeAgo,
    isToday,
    getSourceLabel,
    getPriorityLabel
};
