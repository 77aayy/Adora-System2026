/**
 * Auto Reports Service
 * Scheduled report generation
 * Adora Hotel Management System V2
 */

import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, orderBy } from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

interface ReportData {
    date: string;
    branch: string;
    type: 'daily' | 'shift' | 'weekly' | 'monthly';
    stats: {
        totalRequests: number;
        completedRequests: number;
        avgResponseTime: number;
        requestsByType: Record<string, number>;
        requestsByStatus: Record<string, number>;
    };
    employees: {
        id: string;
        name: string;
        department: string;
        tasksCompleted: number;
        points: number;
    }[];
    rooms: {
        totalCheckIns: number;
        totalCheckOuts: number;
        avgOccupancy: number;
    };
    generatedAt: Timestamp;
}

interface ScheduleConfig {
    enabled: boolean;
    dailyTime: string; // HH:MM
    shiftTimes: string[]; // HH:MM
    weeklyDay: number; // 0-6
    monthlyDay: number; // 1-31
    recipients: string[];
}

// ============================================================
// STATE
// ============================================================

let scheduleConfig: ScheduleConfig = {
    enabled: false,
    dailyTime: '00:00',
    shiftTimes: ['07:00', '15:00', '23:00'],
    weeklyDay: 0,
    monthlyDay: 1,
    recipients: []
};

let scheduledTimers: number[] = [];

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize auto reports (tenant-scoped)
 */
export const initAutoReports = async (tenantId: string, branch: string): Promise<void> => {
    try {
        const configRef = collection(db, `tenants/${tenantId}/branches/${branch}/settings`);
        const q = query(configRef, where('type', '==', 'auto_reports'));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            scheduleConfig = { ...scheduleConfig, ...snapshot.docs[0].data() };
        }

        if (scheduleConfig.enabled && tenantId) {
            setupSchedules(tenantId, branch);
        }

        logger.info('✅ Auto reports initialized', undefined, 'autoReportsService');
    } catch (error) {
        logger.error('Failed to init auto reports:', error, 'autoReportsService');
    }
};

/**
 * Setup scheduled tasks
 */
const setupSchedules = (tenantId: string, branch: string): void => {
    scheduledTimers.forEach(t => clearTimeout(t));
    scheduledTimers = [];

    scheduleDailyReport(tenantId, branch);
    scheduleConfig.shiftTimes.forEach(time => {
        scheduleShiftReport(tenantId, branch, time);
    });
};

/**
 * Schedule daily report at configured time
 */
const scheduleDailyReport = (tenantId: string, branch: string): void => {
    const [hours, minutes] = scheduleConfig.dailyTime.split(':').map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);

    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }

    const delay = next.getTime() - now.getTime();
    const timer = window.setTimeout(async () => {
        await generateDailyReport(tenantId, branch);
        scheduleDailyReport(tenantId, branch);
    }, delay);

    scheduledTimers.push(timer);
};

/**
 * Schedule shift report at specific time
 */
const scheduleShiftReport = (tenantId: string, branch: string, time: string): void => {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);

    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }

    const delay = next.getTime() - now.getTime();
    const timer = window.setTimeout(async () => {
        await generateShiftReport(tenantId, branch);
        scheduleShiftReport(tenantId, branch, time);
    }, delay);

    scheduledTimers.push(timer);
};

// ============================================================
// REPORT GENERATION
// ============================================================

/**
 * Generate daily report (tenant-scoped)
 */
export const generateDailyReport = async (tenantId: string, branch: string): Promise<ReportData> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!tenantId) throw new Error('tenantId required for generateDailyReport');

    const requestsRef = collection(db, `tenants/${tenantId}/requests`);
    const q = query(
        requestsRef,
        where('branch', '==', branch),
        where('createdAt', '>=', Timestamp.fromDate(today))
    );
    const snapshot = await getDocs(q);

    const requests = snapshot.docs.map(d => d.data());

    // Calculate stats
    const stats = calculateStats(requests);

    const employees = await getEmployeePerformance(tenantId, branch, today);
    const rooms = await getRoomStats(tenantId, branch, today);

    const report: ReportData = {
        date: today.toISOString().split('T')[0],
        branch,
        type: 'daily',
        stats,
        employees,
        rooms,
        generatedAt: Timestamp.now()
    };

    // Save report
    await addDoc(collection(db, 'reports'), report);

    // Send to recipients
    if (scheduleConfig.recipients.length > 0) {
        await sendReportEmail(report);
    }

    return report;
};

/**
 * Generate shift report (tenant-scoped)
 */
export const generateShiftReport = async (tenantId: string, branch: string): Promise<ReportData> => {
    const now = new Date();
    const shiftStart = new Date(now);
    shiftStart.setHours(shiftStart.getHours() - 8);
    if (!tenantId) throw new Error('tenantId required for generateShiftReport');

    const requestsRef = collection(db, `tenants/${tenantId}/requests`);
    const q = query(
        requestsRef,
        where('branch', '==', branch),
        where('createdAt', '>=', Timestamp.fromDate(shiftStart)),
        where('createdAt', '<=', Timestamp.fromDate(now))
    );
    const snapshot = await getDocs(q);

    const requests = snapshot.docs.map(d => d.data());
    const stats = calculateStats(requests);
    const employees = await getEmployeePerformance(tenantId, branch, shiftStart);
    const rooms = await getRoomStats(tenantId, branch, shiftStart);

    const report: ReportData = {
        date: now.toISOString(),
        branch,
        type: 'shift',
        stats,
        employees,
        rooms,
        generatedAt: Timestamp.now()
    };

    await addDoc(collection(db, 'reports'), report);

    return report;
};

/**
 * Calculate stats from requests
 */
const calculateStats = (requests: any[]): ReportData['stats'] => {
    const completed = requests.filter(r => r.status === 'COMPLETED');
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    requests.forEach(r => {
        byType[r.serviceType] = (byType[r.serviceType] || 0) + 1;
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });

    // Calculate avg response time
    let totalResponseTime = 0;
    let countWithResponse = 0;

    completed.forEach(r => {
        if (r.confirmedAt && r.createdAt) {
            const created = r.createdAt.toDate?.() || new Date(r.createdAt);
            const confirmed = r.confirmedAt.toDate?.() || new Date(r.confirmedAt);
            totalResponseTime += (confirmed.getTime() - created.getTime()) / 60000;
            countWithResponse++;
        }
    });

    return {
        totalRequests: requests.length,
        completedRequests: completed.length,
        avgResponseTime: countWithResponse > 0 ? Math.round(totalResponseTime / countWithResponse) : 0,
        requestsByType: byType,
        requestsByStatus: byStatus
    };
};

/**
 * Get employee performance (tenant-scoped)
 */
const getEmployeePerformance = async (
    tenantId: string,
    branch: string,
    since: Date
): Promise<ReportData['employees']> => {
    if (!tenantId) return [];
    const employeesRef = collection(db, `tenants/${tenantId}/employees`);
    const q = query(employeesRef, where('branch', '==', branch));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            name: data.name || '',
            department: data.department || '',
            tasksCompleted: (data as { tasksCompletedToday?: number }).tasksCompletedToday || 0,
            points: (data as { points?: number }).points || 0
        };
    });
};

/**
 * Get room stats (tenant-scoped)
 */
const getRoomStats = async (
    tenantId: string,
    branch: string,
    since: Date
): Promise<ReportData['rooms']> => {
    if (!tenantId) return { totalCheckIns: 0, totalCheckOuts: 0, avgOccupancy: 0 };
    const cardsRef = collection(db, `tenants/${tenantId}/roomCards`);
    const q = query(
        cardsRef,
        where('branch', '==', branch),
        where('checkInTime', '>=', Timestamp.fromDate(since))
    );
    const snapshot = await getDocs(q);

    const checkIns = snapshot.docs.filter(d => d.data().checkInTime).length;
    const checkOuts = snapshot.docs.filter(d => d.data().checkOutTime).length;

    return {
        totalCheckIns: checkIns,
        totalCheckOuts: checkOuts,
        avgOccupancy: 0
    };
};

/**
 * Send report email (placeholder)
 */
const sendReportEmail = async (report: ReportData): Promise<void> => {
    // In production, integrate with email service
    logger.info(`📧 Sending report to: ${scheduleConfig.recipients.join(', ')}`, undefined, 'autoReportsService');
};

// ============================================================
// QUERY FUNCTIONS
// ============================================================

/**
 * Get recent reports
 */
export const getRecentReports = async (
    branch: string,
    type?: 'daily' | 'shift' | 'weekly' | 'monthly',
    limitCount = 10
): Promise<ReportData[]> => {
    let q = query(
        collection(db, 'reports'),
        where('branch', '==', branch),
        orderBy('generatedAt', 'desc')
    );

    if (type) {
        q = query(q, where('type', '==', type));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limitCount).map(d => d.data() as ReportData);
};

/**
 * Get report by date
 */
export const getReportByDate = async (
    branch: string,
    date: string,
    type: 'daily' | 'shift' = 'daily'
): Promise<ReportData | null> => {
    const q = query(
        collection(db, 'reports'),
        where('branch', '==', branch),
        where('date', '==', date),
        where('type', '==', type)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    return snapshot.docs[0].data() as ReportData;
};

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Update schedule config
 */
export const updateScheduleConfig = async (
    branch: string,
    config: Partial<ScheduleConfig>
): Promise<void> => {
    scheduleConfig = { ...scheduleConfig, ...config };

    // Save to Firebase
    await addDoc(collection(db, `branches/${branch}/settings`), {
        type: 'auto_reports',
        ...scheduleConfig
    });

    // Restart schedules
    if (scheduleConfig.enabled) {
        setupSchedules(branch);
    }
};

/**
 * Get current config
 */
export const getScheduleConfig = (): ScheduleConfig => {
    return { ...scheduleConfig };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    initAutoReports,
    generateDailyReport,
    generateShiftReport,
    getRecentReports,
    getReportByDate,
    updateScheduleConfig,
    getScheduleConfig
};
