/**
 * Data Health Report Service 🏥
 * Generates weekly reports from data_doctor_logs for owners
 * 
 * Features:
 * - Aggregates anomalies from the week
 * - Calculates trends and statistics
 * - Creates notifications for owners
 * - Supports email integration (when configured)
 * 
 * Adora Hotel Management System V3
 */

import {
    collection, query, where, getDocs, addDoc,
    Timestamp, serverTimestamp, orderBy, limit
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export interface DataHealthMetric {
    category: 'cleaning' | 'maintenance' | 'performance' | 'security' | 'quality';
    label: string;
    value: number;
    previousValue?: number;
    unit: string;
    trend: 'up' | 'down' | 'stable';
    trendPercent?: number;
    status: 'good' | 'warning' | 'critical';
    details?: string;
}

export interface DataHealthReport {
    id?: string;
    tenantId: string;
    branchId?: string;
    reportPeriod: {
        start: Date;
        end: Date;
    };
    generatedAt: Date | any;
    
    // Summary
    overallHealth: number; // 0-100 score
    totalIssues: number;
    resolvedIssues: number;
    criticalIssues: number;
    
    // Metrics
    metrics: DataHealthMetric[];
    
    // Anomalies
    anomalies: {
        type: string;
        severity: 'low' | 'medium' | 'high';
        message: string;
        count: number;
        timestamp?: Date;
    }[];
    
    // Recommendations
    recommendations: string[];
    
    // Status
    viewed: boolean;
    viewedAt?: Date;
}

// ============================================================
// REPORT GENERATION
// ============================================================

/**
 * Generate weekly health report for a tenant
 */
export const generateWeeklyHealthReport = async (
    tenantId: string,
    branchId?: string
): Promise<DataHealthReport> => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch data_doctor_logs from the past week
    let logsQuery = query(
        collection(db, 'data_doctor_logs'),
        where('tenantId', '==', tenantId),
        where('timestamp', '>=', Timestamp.fromDate(weekAgo)),
        orderBy('timestamp', 'desc')
    );

    if (branchId) {
        logsQuery = query(
            collection(db, 'data_doctor_logs'),
            where('tenantId', '==', tenantId),
            where('branchId', '==', branchId),
            where('timestamp', '>=', Timestamp.fromDate(weekAgo)),
            orderBy('timestamp', 'desc')
        );
    }

    const logsSnapshot = await getDocs(logsQuery);
    const logs = logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    // Aggregate by type
    const anomalyMap: Map<string, { count: number; severity: string; messages: string[] }> = new Map();
    let totalIssues = 0;
    let resolvedIssues = 0;
    let criticalIssues = 0;

    logs.forEach((log: any) => {
        totalIssues++;
        if (log.resolved) resolvedIssues++;
        if (log.severity === 'high') criticalIssues++;

        const key = log.type || 'other';
        const existing = anomalyMap.get(key);
        if (existing) {
            existing.count++;
            if (log.severity === 'high') existing.severity = 'high';
            else if (log.severity === 'medium' && existing.severity !== 'high') existing.severity = 'medium';
            if (!existing.messages.includes(log.message)) {
                existing.messages.push(log.message);
            }
        } else {
            anomalyMap.set(key, {
                count: 1,
                severity: log.severity || 'low',
                messages: [log.message || '']
            });
        }
    });

    // Convert to anomalies array
    const anomalies = Array.from(anomalyMap.entries()).map(([type, data]) => ({
        type,
        severity: data.severity as 'low' | 'medium' | 'high',
        message: data.messages[0] || `${data.count} حالة من نوع ${type}`,
        count: data.count
    }));

    // Fetch previous week's data for comparison
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    let prevLogsQuery = query(
        collection(db, 'data_doctor_logs'),
        where('tenantId', '==', tenantId),
        where('timestamp', '>=', Timestamp.fromDate(twoWeeksAgo)),
        where('timestamp', '<', Timestamp.fromDate(weekAgo)),
        orderBy('timestamp', 'desc')
    );

    const prevLogsSnapshot = await getDocs(prevLogsQuery);
    const prevTotalIssues = prevLogsSnapshot.size;

    // Calculate metrics
    const metrics: DataHealthMetric[] = [];

    // Cleaning Quality Metric
    const cleaningLogs = logs.filter((l: any) => l.type === 'quality');
    const prevCleaningLogs = prevLogsSnapshot.docs.filter(d => d.data().type === 'quality').length;
    const cleaningTrendPercent = prevCleaningLogs > 0
        ? Math.round(((cleaningLogs.length - prevCleaningLogs) / prevCleaningLogs) * 100)
        : 0;

    metrics.push({
        category: 'cleaning',
        label: 'حالات تنظيف مشبوهة',
        value: cleaningLogs.length,
        previousValue: prevCleaningLogs,
        unit: 'حالة',
        trend: cleaningTrendPercent > 0 ? 'up' : cleaningTrendPercent < 0 ? 'down' : 'stable',
        trendPercent: Math.abs(cleaningTrendPercent),
        status: cleaningLogs.length > 10 ? 'critical' : cleaningLogs.length > 5 ? 'warning' : 'good',
        details: cleaningLogs.length > 0 ? 'تم رصد حالات تنظيف أقل من 10 دقائق' : 'لا توجد حالات مشبوهة'
    });

    // Maintenance Performance Metric
    const maintenanceLogs = logs.filter((l: any) => l.type === 'healing' || l.type === 'alert');
    const prevMaintenanceLogs = prevLogsSnapshot.docs.filter(d => {
        const t = d.data().type;
        return t === 'healing' || t === 'alert';
    }).length;
    const maintenanceTrendPercent = prevMaintenanceLogs > 0
        ? Math.round(((maintenanceLogs.length - prevMaintenanceLogs) / prevMaintenanceLogs) * 100)
        : 0;

    metrics.push({
        category: 'maintenance',
        label: 'إصلاحات تلقائية',
        value: maintenanceLogs.length,
        previousValue: prevMaintenanceLogs,
        unit: 'حالة',
        trend: maintenanceTrendPercent > 0 ? 'up' : maintenanceTrendPercent < 0 ? 'down' : 'stable',
        trendPercent: Math.abs(maintenanceTrendPercent),
        status: maintenanceLogs.length > 20 ? 'warning' : 'good',
        details: 'حالات تم إصلاحها تلقائياً بواسطة النظام'
    });

    // Security Metric
    const securityLogs = logs.filter((l: any) => l.type === 'security');
    metrics.push({
        category: 'security',
        label: 'تنبيهات أمنية',
        value: securityLogs.length,
        unit: 'تنبيه',
        trend: 'stable',
        status: securityLogs.length > 0 ? 'critical' : 'good',
        details: securityLogs.length > 0 ? 'يوجد تنبيهات أمنية تحتاج مراجعة' : 'لا توجد تنبيهات'
    });

    // Calculate overall health score
    let healthScore = 100;
    healthScore -= criticalIssues * 10;
    healthScore -= (totalIssues - resolvedIssues) * 2;
    healthScore = Math.max(0, Math.min(100, healthScore));

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (cleaningLogs.length > 5) {
        recommendations.push('مراجعة أداء فريق التنظيف - يوجد عدد كبير من حالات التنظيف المشبوهة');
    }
    if (criticalIssues > 0) {
        recommendations.push('يوجد حالات حرجة تحتاج تدخل فوري');
    }
    if (totalIssues > prevTotalIssues * 1.2) {
        recommendations.push('ملاحظة: زيادة في عدد المشاكل مقارنة بالأسبوع الماضي بنسبة ' +
            Math.round(((totalIssues - prevTotalIssues) / (prevTotalIssues || 1)) * 100) + '%');
    }
    if (recommendations.length === 0) {
        recommendations.push('أداء النظام ممتاز هذا الأسبوع! استمر على هذا المستوى 👍');
    }

    const report: DataHealthReport = {
        tenantId,
        branchId,
        reportPeriod: {
            start: weekAgo,
            end: now
        },
        generatedAt: new Date(),
        overallHealth: healthScore,
        totalIssues,
        resolvedIssues,
        criticalIssues,
        metrics,
        anomalies,
        recommendations,
        viewed: false
    };

    return report;
};

/**
 * Save and notify owner about the report
 */
export const saveAndNotifyReport = async (
    report: DataHealthReport,
    ownerId: string
): Promise<string> => {
    // Save report
    const reportRef = await addDoc(collection(db, 'health_reports'), {
        ...report,
        reportPeriod: {
            start: Timestamp.fromDate(report.reportPeriod.start),
            end: Timestamp.fromDate(report.reportPeriod.end)
        },
        generatedAt: serverTimestamp()
    });

    // Create notification for owner
    await addDoc(collection(db, 'ownerNotifications'), {
        ownerId,
        tenantId: report.tenantId,
        type: 'health_report',
        title: '📊 تقرير صحة البيانات الأسبوعي',
        message: `الحالة العامة: ${report.overallHealth}% - ${report.totalIssues} حالة هذا الأسبوع`,
        reportId: reportRef.id,
        read: false,
        createdAt: serverTimestamp()
    });

    console.log(`📊 Health report generated and saved: ${reportRef.id}`);
    return reportRef.id;
};

/**
 * Get recent health reports for a tenant
 */
export const getRecentHealthReports = async (
    tenantId: string,
    limitCount: number = 10
): Promise<DataHealthReport[]> => {
    const q = query(
        collection(db, 'health_reports'),
        where('tenantId', '==', tenantId),
        orderBy('generatedAt', 'desc'),
        limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            reportPeriod: {
                start: data.reportPeriod.start?.toDate() || new Date(),
                end: data.reportPeriod.end?.toDate() || new Date()
            },
            generatedAt: data.generatedAt?.toDate() || new Date()
        } as DataHealthReport;
    });
};

/**
 * Mark report as viewed
 */
export const markReportAsViewed = async (reportId: string): Promise<void> => {
    const { updateDoc, doc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'health_reports', reportId), {
        viewed: true,
        viewedAt: serverTimestamp()
    });
};

/**
 * Schedule weekly reports (to be called by a cron/cloud function)
 * For client-side, this can be triggered manually or on app load
 */
export const checkAndGenerateWeeklyReport = async (
    tenantId: string,
    ownerId: string
): Promise<boolean> => {
    // Check if a report was generated in the last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const q = query(
        collection(db, 'health_reports'),
        where('tenantId', '==', tenantId),
        where('generatedAt', '>=', Timestamp.fromDate(weekAgo)),
        limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        // No report this week, generate one
        const report = await generateWeeklyHealthReport(tenantId);
        await saveAndNotifyReport(report, ownerId);
        return true;
    }

    return false;
};

export default {
    generateWeeklyHealthReport,
    saveAndNotifyReport,
    getRecentHealthReports,
    markReportAsViewed,
    checkAndGenerateWeeklyReport
};
