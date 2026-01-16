/**
 * Reception Advanced Features
 * Migrated from legacy reception.js (5174 lines)
 * Adora Hotel Management System V2
 */

import { db } from '../../services/firebase';
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc,
    query, where, orderBy, limit, onSnapshot, arrayUnion,
    serverTimestamp, Timestamp
} from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

interface ShiftNote {
    id: string;
    branchId: string;
    department: string;
    content: string;
    createdBy: string;
    createdByName: string;
    createdAt: any;
    readBy: string[];
}

interface PointsHistoryItem {
    id: string;
    action: string;
    points: number;
    reason: string;
    timestamp: any;
    details?: any;
}

interface HistoryFilter {
    action: 'all' | 'cleaning' | 'maintenance' | 'procurement' | 'inspection' | 'bellman';
    period: 'today' | 'week' | 'month' | 'custom';
    customFrom?: Date | null;
    customTo?: Date | null;
}

interface Employee {
    id: string;
    name: string;
    code: string;
    department: string;
    kpiPoints?: number;
    active: boolean;
}

// ============================================================
// SHIFT NOTES MANAGEMENT
// ============================================================

/**
 * Check for unread shift notes
 */
export const checkShiftNotes = async (
    branchId: string,
    employeeId: string
): Promise<number> => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const notesQuery = query(
            collection(db, 'shift_notes'),
            where('branchId', '==', branchId),
            where('department', '==', 'reception'),
            where('createdAt', '>=', Timestamp.fromDate(today))
        );

        const snapshot = await getDocs(notesQuery);
        let unreadCount = 0;

        snapshot.forEach(doc => {
            const readBy = doc.data().readBy || [];
            if (!readBy.includes(employeeId)) {
                unreadCount++;
            }
        });

        return unreadCount;
    } catch (error) {
        console.error('Error checking shift notes:', error);
        return 0;
    }
};

/**
 * Load shift notes
 */
export const loadShiftNotes = async (
    branchId: string,
    limitCount = 10
): Promise<ShiftNote[]> => {
    try {
        const notesQuery = query(
            collection(db, 'shift_notes'),
            where('branchId', '==', branchId),
            where('department', '==', 'reception'),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(notesQuery);
        const notes: ShiftNote[] = [];

        snapshot.forEach(doc => {
            notes.push({
                id: doc.id,
                ...doc.data()
            } as ShiftNote);
        });

        return notes;
    } catch (error) {
        console.error('Error loading shift notes:', error);
        return [];
    }
};

/**
 * Add new shift note
 */
export const addShiftNote = async (
    branchId: string,
    employeeId: string,
    employeeName: string,
    content: string
): Promise<string | null> => {
    try {
        const docRef = await addDoc(collection(db, 'shift_notes'), {
            branchId,
            department: 'reception',
            content,
            createdBy: employeeId,
            createdByName: employeeName,
            createdAt: serverTimestamp(),
            readBy: [employeeId]
        });

        return docRef.id;
    } catch (error) {
        console.error('Error adding shift note:', error);
        return null;
    }
};

/**
 * Mark shift note as read
 */
export const markShiftNoteAsRead = async (
    noteId: string,
    employeeId: string
): Promise<boolean> => {
    try {
        const noteRef = doc(db, 'shift_notes', noteId);
        await updateDoc(noteRef, {
            readBy: arrayUnion(employeeId)
        });
        return true;
    } catch (error) {
        console.error('Error marking note as read:', error);
        return false;
    }
};

// ============================================================
// POINTS SYSTEM
// ============================================================

/**
 * Get employee points
 */
export const getEmployeePoints = async (
    hotelId: string,
    branchId: string,
    employeeId: string
): Promise<number> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const empRef = doc(db, `tenants/${hotelId}/branches/${branchId}/employees`, employeeId);
        const empDoc = await getDoc(empRef);

        if (empDoc.exists()) {
            return empDoc.data().kpi_points || 0;
        }
        return 0;
    } catch (error) {
        console.error('Error getting employee points:', error);
        return 0;
    }
};

/**
 * Get points history
 */
export const getPointsHistory = async (
    hotelId: string,
    branchId: string,
    employeeId: string,
    limitCount = 50
): Promise<PointsHistoryItem[]> => {
    try {
        const historyQuery = query(
            // ✅ SaaS FIX: Use 'tenants' collection
            collection(db, `tenants/${hotelId}/branches/${branchId}/employees/${employeeId}/points_history`),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(historyQuery);
        const history: PointsHistoryItem[] = [];

        snapshot.forEach(doc => {
            history.push({
                id: doc.id,
                ...doc.data()
            } as PointsHistoryItem);
        });

        return history;
    } catch (error) {
        console.error('Error getting points history:', error);
        return [];
    }
};

/**
 * Add points to employee
 */
export const addPointsToEmployee = async (
    hotelId: string,
    branchId: string,
    employeeId: string,
    action: string,
    points: number,
    reason: string,
    details: any = {}
): Promise<boolean> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const empRef = doc(db, `tenants/${hotelId}/branches/${branchId}/employees`, employeeId);
        const empDoc = await getDoc(empRef);

        if (!empDoc.exists()) return false;

        const currentPoints = empDoc.data().kpi_points || 0;
        const newPoints = currentPoints + points;

        // Update employee points
        await updateDoc(empRef, {
            kpi_points: newPoints
        });

        // ✅ SaaS FIX: Use 'tenants' collection
        await addDoc(collection(db, `tenants/${hotelId}/branches/${branchId}/employees/${employeeId}/points_history`), {
            action,
            points,
            reason,
            details,
            timestamp: serverTimestamp(),
            previousPoints: currentPoints,
            newPoints
        });

        return true;
    } catch (error) {
        console.error('Error adding points:', error);
        return false;
    }
};

/**
 * Get department points settings
 */
export const getDepartmentPointsSettings = async (
    hotelId: string,
    branchId: string,
    department: string
): Promise<any> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const settingsRef = doc(db, `tenants/${hotelId}/branches/${branchId}/settings`, 'points');
        const settingsDoc = await getDoc(settingsRef);

        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            return data[department] || getDefaultPointsSettings(department);
        }
        return getDefaultPointsSettings(department);
    } catch (error) {
        console.error('Error getting points settings:', error);
        return getDefaultPointsSettings(department);
    }
};

const getDefaultPointsSettings = (department: string): any => {
    const defaults: Record<string, any> = {
        reception: {
            create: 1,
            confirmNormal: 1,
            confirmUrgent: 2,
            complete: 2,
            fast: 1,
            delay: -1
        },
        housekeeping: {
            start: 1,
            complete: 3,
            inspection: 2,
            fast: 2,
            delay: -1
        },
        maintenance: {
            start: 1,
            complete: 4,
            fast: 2,
            delay: -1
        },
        bellman: {
            checkin: 2,
            checkout: 2,
            deliver: 1
        }
    };
    return defaults[department] || { default: 1 };
};

// ============================================================
// TEAM MANAGEMENT
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
            employees.push({
                id: doc.id,
                ...doc.data()
            } as Employee);
        });

        return employees;
    } catch (error) {
        console.error('Error loading reception employees:', error);
        return [];
    }
};

/**
 * Subscribe to reception employees (real-time)
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
            employees.push({
                id: doc.id,
                ...doc.data()
            } as Employee);
        });
        callback(employees);
    });
};

// ============================================================
// HISTORY MANAGEMENT
// ============================================================

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
 * Check if date is in range
 */
const isDateInRange = (date: Date, from: Date, to: Date): boolean => {
    return date >= from && date <= to;
};

/**
 * Load history data with filters
 */
export const loadHistoryData = async (
    branchId: string,
    employeeId: string,
    filter: HistoryFilter
): Promise<any[]> => {
    try {
        const requestsQuery = query(
            collection(db, 'requests'),
            where('branch', '==', branchId)
        );

        const snapshot = await getDocs(requestsQuery);
        const dateRange = getDateRange(filter.period, filter.customFrom, filter.customTo);
        const results: any[] = [];

        snapshot.forEach(doc => {
            const req = doc.data();

            // Filter by service type
            if (filter.action !== 'all' && req.serviceType !== filter.action) {
                return;
            }

            // Get appropriate date
            let requestDate: Date | null = null;
            if (req.timeline?.completed) {
                requestDate = req.timeline.completed.toDate ? req.timeline.completed.toDate() : new Date(req.timeline.completed);
            } else if (req.timeline?.confirmed) {
                requestDate = req.timeline.confirmed.toDate ? req.timeline.confirmed.toDate() : new Date(req.timeline.confirmed);
            } else if (req.timeline?.created) {
                requestDate = req.timeline.created.toDate ? req.timeline.created.toDate() : new Date(req.timeline.created);
            }

            if (!requestDate || !isDateInRange(requestDate, dateRange.from, dateRange.to)) {
                return;
            }

            // Check if related to employee
            const isReceptionRelated =
                (req.confirmedBy?.id === employeeId) ||
                (req.createdBy?.id === employeeId);

            if (!isReceptionRelated) {
                return;
            }

            results.push({
                id: doc.id,
                ...req,
                requestDate
            });
        });

        // Sort by date descending
        results.sort((a, b) => b.requestDate.getTime() - a.requestDate.getTime());

        return results;
    } catch (error) {
        console.error('Error loading history:', error);
        return [];
    }
};

// ============================================================
// PROCUREMENT REQUESTS
// ============================================================

interface ProcurementItem {
    name: string;
    quantity: number;
    notes?: string;
    photoUrl?: string;
    priority: 'normal' | 'urgent' | 'scheduled';
    scheduledDate?: Date | null;
}

/**
 * Add procurement to cart
 */
export const addProcurementToCart = (
    item: ProcurementItem,
    source: string
): any => {
    const cartItem = {
        id: `proc_${Date.now()}`,
        name: item.name,
        quantity: item.quantity,
        notes: item.notes || '',
        photoUrl: item.photoUrl || null,
        priority: item.priority,
        scheduledDate: item.scheduledDate || null,
        source,
        addedAt: new Date()
    };

    // Get existing cart from localStorage
    const existingCart = JSON.parse(localStorage.getItem('procurement_cart') || '[]');
    existingCart.push(cartItem);
    localStorage.setItem('procurement_cart', JSON.stringify(existingCart));

    return cartItem;
};

/**
 * Get procurement cart
 */
export const getProcurementCart = (): any[] => {
    return JSON.parse(localStorage.getItem('procurement_cart') || '[]');
};

/**
 * Clear procurement cart
 */
export const clearProcurementCart = (): void => {
    localStorage.removeItem('procurement_cart');
};

/**
 * Submit procurement order
 */
export const submitProcurementOrder = async (
    branchId: string,
    employeeId: string,
    employeeName: string,
    items: any[]
): Promise<string | null> => {
    try {
        const orderRef = await addDoc(collection(db, 'procurement_orders'), {
            branch: branchId,
            items,
            status: 'pending',
            createdBy: {
                id: employeeId,
                name: employeeName
            },
            createdAt: serverTimestamp(),
            totalItems: items.reduce((sum, item) => sum + item.quantity, 0)
        });

        // Clear cart after successful submission
        clearProcurementCart();

        return orderRef.id;
    } catch (error) {
        console.error('Error submitting procurement order:', error);
        return null;
    }
};

// ============================================================
// MINIBAR ITEMS
// ============================================================

interface MinibarItem {
    id: string;
    name: string;
    icon: string;
    price: number;
}

/**
 * Load minibar items
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

        // Store in window for global access
        (window as any).minibarItems = items;

        return items;
    } catch (error) {
        console.error('Error loading minibar items:', error);
        return [];
    }
};

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

interface KeyboardShortcut {
    key: string;
    description: string;
    action: () => void;
}

const defaultReceptionShortcuts: Omit<KeyboardShortcut, 'action'>[] = [
    // ✅ Removed hardcoded Arabic - should use t() in component
    // These will be translated in the component that uses them
];

export const getKeyboardShortcutsHelp = (): typeof defaultReceptionShortcuts => {
    return defaultReceptionShortcuts;
};

// ============================================================
// REQUEST FILTERING
// ============================================================

interface RequestFilter {
    serviceType?: string;
    roomNumber?: string;
    sortOrder: 'newest' | 'oldest' | 'room';
}

/**
 * Apply filters to requests
 */
export const applyRequestFilters = (
    requests: any[],
    filter: RequestFilter
): any[] => {
    let filtered = [...requests];

    // Filter by service type
    if (filter.serviceType) {
        filtered = filtered.filter(r => r.serviceType === filter.serviceType);
    }

    // Filter by room number
    if (filter.roomNumber) {
        filtered = filtered.filter(r =>
            r.roomNumber?.toString().includes(filter.roomNumber)
        );
    }

    // Apply sorting
    switch (filter.sortOrder) {
        case 'oldest':
            filtered.sort((a, b) => {
                const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt);
                const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt);
                return timeA.getTime() - timeB.getTime();
            });
            break;
        case 'room':
            filtered.sort((a, b) => {
                const roomA = parseInt(a.roomNumber) || 0;
                const roomB = parseInt(b.roomNumber) || 0;
                return roomA - roomB;
            });
            break;
        case 'newest':
        default:
            filtered.sort((a, b) => {
                const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt);
                const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt);
                return timeB.getTime() - timeA.getTime();
            });
            break;
    }

    return filtered;
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get reason text for points
 */
export const getReasonText = (action: string, details: any, t: (key: string) => string): string => {
    const serviceNames: Record<string, string> = {
        cleaning: t('reception.serviceNames.cleaning') || 'Cleaning',
        maintenance: t('reception.serviceNames.maintenance') || 'Maintenance',
        bellman: t('reception.serviceNames.bellman') || 'Bellman',
        inspection: t('reception.serviceNames.inspection') || 'Inspection',
        coffee: t('reception.serviceNames.coffee') || 'Coffee'
    };

    const serviceName = serviceNames[details.serviceType] || details.serviceType || '';
    const roomNumber = details.roomNumber || '';

    switch (action) {
        case 'create_request':
            return t('reception.points.createRequest', { service: serviceName, room: roomNumber }) || `Create ${serviceName} request${roomNumber ? ` - Room ${roomNumber}` : ''}`;
        case 'confirm_request':
            return t('reception.points.confirmRequest', { service: serviceName, room: roomNumber }) || `Confirm ${serviceName} request${roomNumber ? ` - Room ${roomNumber}` : ''}`;
        case 'complete_request':
            return t('reception.points.completeRequest', { service: serviceName, room: roomNumber }) || `Complete ${serviceName} request${roomNumber ? ` - Room ${roomNumber}` : ''}`;
        case 'fast_confirm':
            return t('reception.points.fastConfirm') || 'Speed bonus';
        case 'delay_penalty':
            return t('reception.points.delayPenalty') || 'Delay penalty';
        default:
            return action;
    }
};

/**
 * Format date time for display
 */
export const formatDateTime = (timestamp: any): string => {
    if (!timestamp) return '--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short'
    });
};

/**
 * Check if request is delayed
 */
export const isRequestDelayed = (request: any, executionTimes?: Record<string, number>): boolean => {
    if (!request.createdAt) return false;

    const created = request.createdAt.toDate
        ? request.createdAt.toDate()
        : new Date(request.createdAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);

    // Use provided settings or defaults
    const times: Record<string, number> = executionTimes || {
        cleaning: 30,
        maintenance: 45,
        bellman: 15,
        coffee: 20,
        inspection: 20
    };

    const expected = times[request.serviceType] || times.default || 30;
    return diffMinutes > expected;
};

/**
 * Get time ago string
 */
export const getTimeAgo = (timestamp: any, t: (key: string) => string): string => {
    if (!timestamp) return '--';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return t('reception.timeAgo.now') || 'Now';
    if (diffMins < 60) return t('reception.timeAgo.minutes', { minutes: diffMins }) || `${diffMins} minutes`;
    if (diffMins < 1440) return t('reception.timeAgo.hours', { hours: Math.floor(diffMins / 60) }) || `${Math.floor(diffMins / 60)} hours`;
    return t('reception.timeAgo.days', { days: Math.floor(diffMins / 1440) }) || `${Math.floor(diffMins / 1440)} days`;
};

// ============================================================
// PRINT HISTORY
// ============================================================

/**
 * Print history report
 */
export const printHistoryReport = (
    items: any[],
    employeeName: string,
    branchName: string
): void => {
    if (items.length === 0) return;

    const serviceNames: Record<string, string> = {
        cleaning: 'تنظيف',
        maintenance: 'صيانة',
        procurement: 'مشتريات',
        inspection: 'فحص',
        bellman: 'بيلمان'
    };

    const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>سجل الاستقبال - ${new Date().toLocaleDateString('ar-SA')}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; margin-bottom: 20px; color: #1a1a2e; }
                .info { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
                th { background: #2CBCB6; color: white; }
                tr:nth-child(even) { background: #f9f9f9; }
                .completed { color: #10B981; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <h1>سجل الاستقبال</h1>
            <div class="info">
                <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-SA')}</p>
                <p><strong>الموظف:</strong> ${employeeName || '--'}</p>
                <p><strong>الفرع:</strong> ${branchName || '--'}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>نوع الخدمة</th>
                        <th>رقم الغرفة</th>
                        <th>التاريخ والوقت</th>
                        <th>الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
        const date = item.requestDate.toLocaleString('ar-SA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const status = item.status === 'COMPLETED' ? '✓ مكتمل' :
            item.status === 'CONFIRMED' ? '⏳ مؤكد' : '⏸ قيد الانتظار';
        return `
                            <tr>
                                <td>${serviceNames[item.serviceType] || item.serviceType}</td>
                                <td>${item.roomNumber || '--'}</td>
                                <td>${date}</td>
                                <td class="${item.status === 'COMPLETED' ? 'completed' : ''}">${status}</td>
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
    // Shift Notes
    checkShiftNotes,
    loadShiftNotes,
    addShiftNote,
    markShiftNoteAsRead,

    // Points
    getEmployeePoints,
    getPointsHistory,
    addPointsToEmployee,
    getDepartmentPointsSettings,

    // Team
    loadReceptionEmployees,
    subscribeToReceptionEmployees,

    // History
    loadHistoryData,
    printHistoryReport,

    // Procurement
    addProcurementToCart,
    getProcurementCart,
    clearProcurementCart,
    submitProcurementOrder,

    // Minibar
    loadMinibarItems,

    // Helpers
    getKeyboardShortcutsHelp,
    applyRequestFilters,
    getReasonText,
    formatDateTime,
    isRequestDelayed,
    getTimeAgo
};
