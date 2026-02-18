/**
 * Reception Reports Service
 * Daily summaries, shift handover, performance metrics, analytics
 */

import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// 1. DAILY SUMMARY GENERATION
// ============================================================

export interface DailySummary {
    date: string;
    totalRequests: number;
    completedRequests: number;
    pendingRequests: number;
    avgResponseTime: number;
    byDepartment: Record<string, number>;
    byStatus: Record<string, number>;
    checkIns: number;
    checkOuts: number;
}

export const generateDailySummary = async (tenantId: string, branch: string, date: Date): Promise<DailySummary> => {
    try {
        const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

        const snapshot = await getDocs(
            query(
                collection(db, `tenants/${tenantId}/requests`),
                where('branch', '==', branch),
                where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
                where('createdAt', '<=', Timestamp.fromDate(endOfDay))
            )
        );

        const byDepartment: Record<string, number> = {};
        const byStatus: Record<string, number> = {};
        let totalTime = 0;
        let completed = 0;

        snapshot.docs.forEach(d => {
            const data = d.data();
            byDepartment[data.type] = (byDepartment[data.type] || 0) + 1;
            byStatus[data.status] = (byStatus[data.status] || 0) + 1;
            if (data.status === 'COMPLETED') {
                completed++;
                const created = data.createdAt?.toDate?.() || new Date();
                const done = data.timeline?.completed?.toDate?.() || created;
                totalTime += (done.getTime() - created.getTime()) / 60000;
            }
        });

        return {
            date: date.toISOString().split('T')[0],
            totalRequests: snapshot.size,
            completedRequests: completed,
            pendingRequests: snapshot.size - completed,
            avgResponseTime: completed > 0 ? totalTime / completed : 0,
            byDepartment,
            byStatus,
            checkIns: 0,
            checkOuts: 0
        };
    } catch (error) {
        logger.error('Daily summary error:', error, 'receptionReportsService');
        return { date: '', totalRequests: 0, completedRequests: 0, pendingRequests: 0, avgResponseTime: 0, byDepartment: {}, byStatus: {}, checkIns: 0, checkOuts: 0 };
    }
};

// ============================================================
// 2. SHIFT HANDOVER REPORTS
// ============================================================

export interface ShiftHandoverReport {
    shiftStart: Date;
    shiftEnd: Date;
    employeeName: string;
    requestsHandled: number;
    pendingItems: any[];
    notes: string[];
    issuesFlagged: number;
}

export const generateShiftHandover = async (tenantId: string, branch: string, employeeId: string, shiftStart: Date, shiftEnd: Date): Promise<ShiftHandoverReport> => {
    try {
        const snapshot = await getDocs(
            query(
                collection(db, `tenants/${tenantId}/requests`),
                where('branch', '==', branch),
                where('confirmedBy.id', '==', employeeId),
                where('timeline.confirmed', '>=', Timestamp.fromDate(shiftStart)),
                where('timeline.confirmed', '<=', Timestamp.fromDate(shiftEnd))
            )
        );

        const pending = snapshot.docs.filter(d => d.data().status !== 'COMPLETED').map(d => ({ id: d.id, ...d.data() }));
        const issues = snapshot.docs.filter(d => d.data().isEscalated || d.data().isEmergency).length;

        return {
            shiftStart,
            shiftEnd,
            employeeName: '',
            requestsHandled: snapshot.size,
            pendingItems: pending,
            notes: [],
            issuesFlagged: issues
        };
    } catch (error) {
        logger.error('Shift handover error:', error, 'receptionReportsService');
        return { shiftStart, shiftEnd, employeeName: '', requestsHandled: 0, pendingItems: [], notes: [], issuesFlagged: 0 };
    }
};

// ============================================================
// 3. PERFORMANCE METRICS
// ============================================================

export interface PerformanceMetrics {
    employeeId: string;
    employeeName: string;
    requestsCompleted: number;
    avgResponseTime: number;
    rating: number;
    points: number;
}

export const getPerformanceMetrics = async (tenantId: string, branch: string, employeeId: string, startDate: Date, endDate: Date): Promise<PerformanceMetrics> => {
    try {
        const snapshot = await getDocs(
            query(
                collection(db, `tenants/${tenantId}/requests`),
                where('branch', '==', branch),
                where('completedBy.id', '==', employeeId),
                where('timeline.completed', '>=', Timestamp.fromDate(startDate)),
                where('timeline.completed', '<=', Timestamp.fromDate(endDate))
            )
        );

        let totalTime = 0;
        snapshot.docs.forEach(d => {
            const data = d.data();
            const created = data.createdAt?.toDate?.() || new Date();
            const completed = data.timeline?.completed?.toDate?.() || created;
            totalTime += (completed.getTime() - created.getTime()) / 60000;
        });

        return {
            employeeId,
            employeeName: '',
            requestsCompleted: snapshot.size,
            avgResponseTime: snapshot.size > 0 ? totalTime / snapshot.size : 0,
            rating: 4.5,
            points: 0
        };
    } catch (error) {
        return { employeeId, employeeName: '', requestsCompleted: 0, avgResponseTime: 0, rating: 0, points: 0 };
    }
};

// ============================================================
// 4. OCCUPANCY ANALYTICS
// ============================================================

export const getOccupancyAnalytics = async (tenantId: string, branch: string, startDate: Date, endDate: Date): Promise<{ daily: Record<string, number>; average: number }> => {
    try {
        const snapshot = await getDocs(
            query(
                collection(db, `tenants/${tenantId}/roomCards`),
                where('branch', '==', branch),
                where('checkinAt', '>=', Timestamp.fromDate(startDate)),
                where('checkinAt', '<=', Timestamp.fromDate(endDate))
            )
        );

        const daily: Record<string, number> = {};
        snapshot.docs.forEach(d => {
            const date = d.data().checkinAt?.toDate?.()?.toISOString().split('T')[0] || '';
            daily[date] = (daily[date] || 0) + 1;
        });

        const values = Object.values(daily);
        const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

        return { daily, average };
    } catch (error) {
        return { daily: {}, average: 0 };
    }
};

// ============================================================
// 5. REVENUE PER ROOM TRACKING
// ============================================================

export const getRevenuePerRoom = async (_tenantId: string, branch: string): Promise<Record<string, number>> => {
    // Placeholder - would integrate with billing system
    return {};
};

// ============================================================
// 6. SERVICE QUALITY METRICS
// ============================================================

export interface ServiceQualityMetrics {
    avgRating: number;
    ratingCount: number;
    complaintsCount: number;
    repeatRequestsCount: number;
}

export const getServiceQualityMetrics = async (tenantId: string, branch: string, startDate: Date, endDate: Date): Promise<ServiceQualityMetrics> => {
    try {
        const snapshot = await getDocs(
            query(
                collection(db, `tenants/${tenantId}/requests`),
                where('branch', '==', branch),
                where('createdAt', '>=', Timestamp.fromDate(startDate)),
                where('createdAt', '<=', Timestamp.fromDate(endDate))
            )
        );

        let totalRating = 0;
        let ratingCount = 0;
        let complaints = 0;

        snapshot.docs.forEach(d => {
            const data = d.data();
            if (data.rating) { totalRating += data.rating; ratingCount++; }
            if (data.isComplaint) complaints++;
        });

        return {
            avgRating: ratingCount > 0 ? totalRating / ratingCount : 0,
            ratingCount,
            complaintsCount: complaints,
            repeatRequestsCount: 0
        };
    } catch (error) {
        return { avgRating: 0, ratingCount: 0, complaintsCount: 0, repeatRequestsCount: 0 };
    }
};

// ============================================================
// 7. RESPONSE TIME ANALYTICS
// ============================================================

export const getResponseTimeAnalytics = async (tenantId: string, branch: string, startDate: Date, endDate: Date): Promise<{ byDepartment: Record<string, number>; byHour: Record<number, number> }> => {
    try {
        const snapshot = await getDocs(
            query(
                collection(db, `tenants/${tenantId}/requests`),
                where('branch', '==', branch),
                where('status', '==', 'COMPLETED'),
                where('createdAt', '>=', Timestamp.fromDate(startDate)),
                where('createdAt', '<=', Timestamp.fromDate(endDate))
            )
        );

        const byDepartment: Record<string, { total: number; count: number }> = {};
        const byHour: Record<number, { total: number; count: number }> = {};

        snapshot.docs.forEach(d => {
            const data = d.data();
            const created = data.createdAt?.toDate?.() || new Date();
            const confirmed = data.timeline?.confirmed?.toDate?.() || created;
            const responseTime = (confirmed.getTime() - created.getTime()) / 60000;
            const hour = created.getHours();
            const dept = data.type || 'other';

            if (!byDepartment[dept]) byDepartment[dept] = { total: 0, count: 0 };
            byDepartment[dept].total += responseTime;
            byDepartment[dept].count++;

            if (!byHour[hour]) byHour[hour] = { total: 0, count: 0 };
            byHour[hour].total += responseTime;
            byHour[hour].count++;
        });

        const avgByDept: Record<string, number> = {};
        const avgByHour: Record<number, number> = {};

        Object.entries(byDepartment).forEach(([k, v]) => { avgByDept[k] = v.count > 0 ? v.total / v.count : 0; });
        Object.entries(byHour).forEach(([k, v]) => { avgByHour[parseInt(k)] = v.count > 0 ? v.total / v.count : 0; });

        return { byDepartment: avgByDept, byHour: avgByHour };
    } catch (error) {
        return { byDepartment: {}, byHour: {} };
    }
};

// ============================================================
// 8. DEPARTMENT EFFICIENCY STATS
// ============================================================

export interface DepartmentEfficiency {
    department: string;
    requestsHandled: number;
    avgCompletionTime: number;
    slaCompliance: number;
    employeeCount: number;
}

export const getDepartmentEfficiency = async (tenantId: string, branch: string, startDate: Date, endDate: Date): Promise<DepartmentEfficiency[]> => {
    try {
        const snapshot = await getDocs(
            query(
                collection(db, `tenants/${tenantId}/requests`),
                where('branch', '==', branch),
                where('createdAt', '>=', Timestamp.fromDate(startDate)),
                where('createdAt', '<=', Timestamp.fromDate(endDate))
            )
        );

        const depts: Record<string, { count: number; totalTime: number; withinSLA: number }> = {};
        const SLA = 30;

        snapshot.docs.forEach(d => {
            const data = d.data();
            const dept = data.type || 'other';
            if (!depts[dept]) depts[dept] = { count: 0, totalTime: 0, withinSLA: 0 };
            depts[dept].count++;

            if (data.status === 'COMPLETED') {
                const created = data.createdAt?.toDate?.() || new Date();
                const completed = data.timeline?.completed?.toDate?.() || created;
                const time = (completed.getTime() - created.getTime()) / 60000;
                depts[dept].totalTime += time;
                if (time <= SLA) depts[dept].withinSLA++;
            }
        });

        return Object.entries(depts).map(([dept, stats]) => ({
            department: dept,
            requestsHandled: stats.count,
            avgCompletionTime: stats.count > 0 ? stats.totalTime / stats.count : 0,
            slaCompliance: stats.count > 0 ? (stats.withinSLA / stats.count) * 100 : 0,
            employeeCount: 0
        }));
    } catch (error) {
        return [];
    }
};
