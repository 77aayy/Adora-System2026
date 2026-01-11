/**
 * Dashboard Advanced Features
 * Migrated from legacy dashboard.js (2273 lines)
 * Adora Hotel Management System V2
 */

import { db } from '../../services/firebase';
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, writeBatch,
    query, where, orderBy, limit, onSnapshot,
    serverTimestamp, Timestamp
} from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

interface Employee {
    id: string;
    name: string;
    code: string;
    department: string;
    active: boolean;
    kpi_points?: number;
    points?: number;
    createdAt?: any;
    updatedAt?: any;
}

interface Request {
    id: string;
    roomNumber: string;
    branch: string;
    serviceType: string;
    status: string;
    department?: string;
    createdAt?: any;
    updatedAt?: any;
    completedAt?: any;
    startedAt?: any;
    confirmedBy?: string;
    completedBy?: string;
    isDelayed?: boolean;
}

interface BranchSettings {
    name: string;
    executionTimes?: {
        cleaning: number;
        maintenance: number;
        bellman: number;
        inspection: number;
    };
    procurementTimes?: {
        urgent: number;
        normal: number;
    };
    bellmanPoints?: PointsConfig;
    housekeepingPoints?: HousekeepingPointsConfig;
    maintenancePoints?: MaintenancePointsConfig;
    procurementPoints?: ProcurementPointsConfig;
    receptionPoints?: PointsConfig;
}

interface PointsConfig {
    [key: string]: number;
}

interface HousekeepingPointsConfig {
    start: number;
    completeOccupied: number;
    completeCheckout: number;
    inspection: number;
    fast: number;
    normal: number;
    delay: number;
    quality: number;
}

interface MaintenancePointsConfig {
    electrical: number;
    plumbing: number;
    ac: number;
    furniture: number;
    other: number;
    fast: number;
    normal: number;
    delay: number;
}

interface ProcurementPointsConfig {
    purchase: number;
    request: number;
    fast: number;
    delay: number;
}

interface DashboardStats {
    newCount: number;
    progressCount: number;
    completedCount: number;
    delayedCount: number;
}

interface ChartData {
    deptCounts: Record<string, number>;
    typeCounts: Record<string, number>;
}

// ============================================================
// SERVICE NAMES
// ============================================================

const SERVICE_NAMES: Record<string, string> = {
    'cleaning': 'تنظيف',
    'maintenance': 'صيانة',
    'bellman': 'بيلمان',
    'room_service': 'خدمة غرف',
    'coffee_shop': 'كوفي شوب',
    'inspection': 'فحص',
    'procurement': 'مشتريات'
};

const DEPARTMENT_NAMES: Record<string, string> = {
    'reception': 'استقبال',
    'bellman': 'بيلمان',
    'housekeeping': 'هاوس كيبنج',
    'maintenance': 'صيانة',
    'procurement': 'مشتريات',
    'manager': 'مدير'
};

const STATUS_NAMES: Record<string, string> = {
    'PENDING': 'جديد',
    'CONFIRMED': 'مؤكد',
    'IN_PROGRESS': 'قيد التنفيذ',
    'COMPLETED': 'مكتمل',
    'PENDING_APPROVAL': 'بانتظار الموافقة'
};

export const getServiceName = (type: string): string => SERVICE_NAMES[type] || type;
export const getDepartmentName = (dept: string): string => DEPARTMENT_NAMES[dept] || dept;
export const getStatusName = (status: string): string => STATUS_NAMES[status] || status;

// ============================================================
// SETTINGS MANAGEMENT
// ============================================================

/**
 * Load branch settings
 */
export const loadBranchSettings = async (
    hotelId: string,
    branchId: string
): Promise<BranchSettings | null> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const branchRef = doc(db, `tenants/${hotelId}/branches/${branchId}`);
        const branchDoc = await getDoc(branchRef);

        if (branchDoc.exists()) {
            return branchDoc.data() as BranchSettings;
        }
        return null;
    } catch (error) {
        console.error('Error loading branch settings:', error);
        return null;
    }
};

/**
 * Save branch settings
 */
export const saveBranchSettings = async (
    hotelId: string,
    branchId: string,
    settings: Partial<BranchSettings>
): Promise<boolean> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const branchRef = doc(db, `tenants/${hotelId}/branches/${branchId}`);
        await updateDoc(branchRef, {
            ...settings,
            updatedAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error saving branch settings:', error);
        return false;
    }
};

// ============================================================
// EMPLOYEES MANAGEMENT
// ============================================================

/**
 * Load all employees
 */
export const loadEmployees = async (
    hotelId: string,
    branchId: string
): Promise<Employee[]> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const employeesRef = collection(db, `tenants/${hotelId}/branches/${branchId}/employees`);
        const snapshot = await getDocs(employeesRef);

        const employees: Employee[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            employees.push({
                id: doc.id,
                ...data,
                points: data.kpi_points || 0
            } as Employee);
        });

        return employees;
    } catch (error) {
        console.error('Error loading employees:', error);
        return [];
    }
};

/**
 * Subscribe to employees
 */
export const subscribeToEmployees = (
    hotelId: string,
    branchId: string,
    callback: (employees: Employee[]) => void
): (() => void) => {
    // ✅ SaaS FIX: Use 'tenants' collection
    const employeesRef = collection(db, `tenants/${hotelId}/branches/${branchId}/employees`);

    return onSnapshot(employeesRef, snapshot => {
        const employees: Employee[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            employees.push({
                id: doc.id,
                ...data,
                points: data.kpi_points || 0
            } as Employee);
        });
        callback(employees);
    });
};

/**
 * Add new employee
 */
export const addEmployee = async (
    hotelId: string,
    branchId: string,
    employee: Omit<Employee, 'id'>
): Promise<string | null> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const employeesRef = collection(db, `tenants/${hotelId}/branches/${branchId}/employees`);
        const docRef = await addDoc(employeesRef, {
            ...employee,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding employee:', error);
        return null;
    }
};

/**
 * Update employee
 */
export const updateEmployee = async (
    hotelId: string,
    branchId: string,
    employeeId: string,
    data: Partial<Employee>
): Promise<boolean> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const employeeRef = doc(db, `tenants/${hotelId}/branches/${branchId}/employees/${employeeId}`);
        await updateDoc(employeeRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error updating employee:', error);
        return false;
    }
};

/**
 * Delete employee
 */
export const deleteEmployee = async (
    hotelId: string,
    branchId: string,
    employeeId: string
): Promise<boolean> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const employeeRef = doc(db, `tenants/${hotelId}/branches/${branchId}/employees/${employeeId}`);
        await deleteDoc(employeeRef);
        return true;
    } catch (error) {
        console.error('Error deleting employee:', error);
        return false;
    }
};

/**
 * Toggle employee status
 */
export const toggleEmployeeStatus = async (
    hotelId: string,
    branchId: string,
    employeeId: string,
    newStatus: boolean
): Promise<boolean> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const employeeRef = doc(db, `tenants/${hotelId}/branches/${branchId}/employees/${employeeId}`);
        await updateDoc(employeeRef, {
            active: newStatus,
            updatedAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error toggling employee status:', error);
        return false;
    }
};

/**
 * Check if employee code is unique
 */
export const isCodeUnique = (
    employees: Employee[],
    code: string,
    excludeId?: string
): boolean => {
    return !employees.some(emp => emp.code === code && emp.id !== excludeId);
};

/**
 * Generate random employee code
 */
export const generateEmployeeCode = (): string => {
    return String(Math.floor(1000 + Math.random() * 9000));
};

// ============================================================
// REQUESTS & STATISTICS
// ============================================================

/**
 * Subscribe to today's requests
 */
export const subscribeToTodayRequests = (
    branchId: string,
    callback: (requests: Request[]) => void
): (() => void) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const requestsQuery = query(
        collection(db, 'requests'),
        where('branch', '==', branchId),
        where('createdAt', '>=', Timestamp.fromDate(today))
    );

    return onSnapshot(requestsQuery, snapshot => {
        const requests: Request[] = [];
        snapshot.forEach(doc => {
            requests.push({ id: doc.id, ...doc.data() } as Request);
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
 * Calculate dashboard stats
 */
export const calculateStats = (requests: Request[]): DashboardStats => {
    return {
        newCount: requests.filter(r => r.status === 'PENDING').length,
        progressCount: requests.filter(r => ['CONFIRMED', 'IN_PROGRESS'].includes(r.status)).length,
        completedCount: requests.filter(r => r.status === 'COMPLETED').length,
        delayedCount: requests.filter(r => r.isDelayed).length
    };
};

/**
 * Calculate chart data
 */
export const calculateChartData = (requests: Request[]): ChartData => {
    const deptCounts: Record<string, number> = {
        reception: 0,
        bellman: 0,
        housekeeping: 0,
        maintenance: 0
    };

    const typeCounts: Record<string, number> = {
        cleaning: 0,
        maintenance: 0,
        bellman: 0,
        room_service: 0
    };

    requests.forEach(req => {
        // Department count (completed only)
        if (req.status === 'COMPLETED' && req.department) {
            if (deptCounts[req.department] !== undefined) {
                deptCounts[req.department]++;
            }
        }

        // Type count (all)
        if (typeCounts[req.serviceType] !== undefined) {
            typeCounts[req.serviceType]++;
        }
    });

    return { deptCounts, typeCounts };
};

// ============================================================
// LEADERBOARD
// ============================================================

/**
 * Get leaderboard (top 10 employees by points)
 */
export const getLeaderboard = (employees: Employee[], maxItems: number = 10): Employee[] => {
    return [...employees]
        .filter(e => e.active !== false)
        .map(emp => ({
            ...emp,
            points: emp.kpi_points || emp.points || 0
        }))
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, maxItems);
};

/**
 * Get medal for rank
 */
export const getMedal = (rank: number): string => {
    const medals = ['🥇', '🥈', '🥉'];
    return medals[rank] || String(rank + 1);
};

// ============================================================
// PROCUREMENT MANAGEMENT
// ============================================================

/**
 * Subscribe to pending procurement requests
 */
export const subscribeToPendingProcurement = (
    branchId: string,
    callback: (requests: Request[]) => void
): (() => void) => {
    const procurementQuery = query(
        collection(db, 'requests'),
        where('branch', '==', branchId),
        where('serviceType', '==', 'procurement'),
        where('status', '==', 'PENDING_APPROVAL')
    );

    return onSnapshot(procurementQuery, snapshot => {
        const requests: Request[] = [];
        snapshot.forEach(doc => {
            requests.push({ id: doc.id, ...doc.data() } as Request);
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
 * Approve procurement request
 */
export const approveProcurement = async (
    requestId: string,
    managerId: string,
    managerName: string
): Promise<boolean> => {
    try {
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, {
            status: 'PROCUREMENT_PENDING',
            approvedBy: { id: managerId, name: managerName },
            approvedAt: serverTimestamp(),
            'timeline.approved': serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error approving procurement:', error);
        return false;
    }
};

/**
 * Reject procurement request
 */
export const rejectProcurement = async (
    requestId: string,
    managerId: string,
    managerName: string,
    reason: string
): Promise<boolean> => {
    try {
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, {
            status: 'REJECTED',
            rejectedBy: { id: managerId, name: managerName },
            rejectedAt: serverTimestamp(),
            rejectionReason: reason,
            'timeline.rejected': serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error rejecting procurement:', error);
        return false;
    }
};

// ============================================================
// LOGS FILTERING
// ============================================================

interface LogFilter {
    period: 'today' | 'week' | 'month' | 'custom';
    department?: string;
    status?: string;
    room?: string;
    customFrom?: Date | null;
    customTo?: Date | null;
}

/**
 * Filter requests based on criteria
 */
export const filterRequests = (
    requests: Request[],
    filter: LogFilter
): Request[] => {
    let filtered = [...requests];
    const now = new Date();

    // Period filter
    if (filter.period === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filtered = filtered.filter(r => {
            const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0);
            return date >= today;
        });
    } else if (filter.period === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(r => {
            const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0);
            return date >= weekAgo;
        });
    } else if (filter.period === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        filtered = filtered.filter(r => {
            const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0);
            return date >= monthAgo;
        });
    } else if (filter.period === 'custom' && filter.customFrom && filter.customTo) {
        const from = new Date(filter.customFrom);
        const to = new Date(filter.customTo);
        to.setHours(23, 59, 59, 999);
        filtered = filtered.filter(r => {
            const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0);
            return date >= from && date <= to;
        });
    }

    // Department filter
    if (filter.department) {
        filtered = filtered.filter(r => r.department === filter.department);
    }

    // Status filter
    if (filter.status) {
        filtered = filtered.filter(r => r.status === filter.status);
    }

    // Room filter
    if (filter.room) {
        filtered = filtered.filter(r => String(r.roomNumber).includes(filter.room!));
    }

    return filtered;
};

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

/**
 * Export requests to CSV
 */
export const exportToCSV = (requests: Request[]): void => {
    const headers = ['الغرفة', 'النوع', 'الحالة', 'الموظف', 'الوقت'];
    const rows = requests.map(r => [
        r.roomNumber || '',
        getServiceName(r.serviceType),
        getStatusName(r.status),
        r.completedBy || r.confirmedBy || '',
        r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString('ar-SA') : ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_${new Date().toLocaleDateString('ar-SA')}.csv`;
    link.click();
};

/**
 * Print logs
 */
export const printLogs = (): void => {
    window.print();
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Format time
 */
export const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Calculate duration in minutes
 */
export const calculateDuration = (startTime: any, endTime: any): number | null => {
    if (!startTime || !endTime) return null;
    const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
    const end = endTime.toDate ? endTime.toDate() : new Date(endTime);
    return Math.round((end.getTime() - start.getTime()) / 60000);
};

// ============================================================
// THEME MANAGEMENT
// ============================================================

/**
 * Apply theme
 */
export const applyTheme = (theme?: 'light' | 'dark'): void => {
    const savedTheme = theme || localStorage.getItem('adora_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    localStorage.setItem('adora_theme', savedTheme);
};

/**
 * Toggle theme
 */
export const toggleTheme = (): string => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    return newTheme;
};

// ============================================================
// ACTIVITY FEED
// ============================================================

interface ActivityItem {
    id: string;
    icon: string;
    text: string;
    type: 'new' | 'complete' | 'delay';
    time: Date;
}

/**
 * Create activity item from request
 */
export const createActivityItem = (
    request: Request,
    changeType: 'added' | 'modified'
): ActivityItem | null => {
    const time = request.updatedAt?.toDate ? request.updatedAt.toDate() : new Date();
    const roomNum = request.roomNumber || '---';

    if (changeType === 'added' && request.status === 'PENDING') {
        return {
            id: request.id,
            icon: 'inbox',
            text: `طلب ${getServiceName(request.serviceType)} جديد - غرفة ${roomNum}`,
            type: 'new',
            time
        };
    } else if (request.status === 'COMPLETED') {
        return {
            id: request.id,
            icon: 'check-circle',
            text: `${request.completedBy || 'موظف'} أكمل ${getServiceName(request.serviceType)} - غرفة ${roomNum}`,
            type: 'complete',
            time
        };
    } else if (request.isDelayed) {
        return {
            id: request.id,
            icon: 'alert-triangle',
            text: `تأخير في ${getServiceName(request.serviceType)} - غرفة ${roomNum}`,
            type: 'delay',
            time
        };
    }

    return null;
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Settings
    loadBranchSettings,
    saveBranchSettings,

    // Employees
    loadEmployees,
    subscribeToEmployees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    toggleEmployeeStatus,
    isCodeUnique,
    generateEmployeeCode,

    // Requests & Stats
    subscribeToTodayRequests,
    calculateStats,
    calculateChartData,

    // Leaderboard
    getLeaderboard,
    getMedal,

    // Procurement
    subscribeToPendingProcurement,
    approveProcurement,
    rejectProcurement,

    // Logs
    filterRequests,
    exportToCSV,
    printLogs,

    // Activity
    createActivityItem,

    // Theme
    applyTheme,
    toggleTheme,

    // Utils
    formatTime,
    calculateDuration,
    getServiceName,
    getDepartmentName,
    getStatusName
};
