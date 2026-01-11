/**
 * Exception Dashboard Service
 * Detects and tracks system exceptions and alerts
 * Adora Hotel Management System V2
 */

import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export type AlertSeverity = 'high' | 'medium' | 'low';
export type AlertType = 'dna_pattern' | 'watchdog_timeout' | 'performance_issue';

export interface ExceptionAlert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    actionSuggestion: string;
    data: Record<string, any>;
    timestamp: Date;
}

export interface ExceptionThresholds {
    recurringIssues: number; // Same room, same problem count
    delayWarningMinutes: number;
    performanceThreshold: number; // Ratio below average
}

interface RequestData {
    id: string;
    roomNumber: string;
    serviceType: string;
    status: string;
    createdAt: Date;
    completedAt?: Date;
    assignedTo?: string;
    maintenanceType?: string;
}

// ============================================================
// DEFAULT THRESHOLDS
// ============================================================

const DEFAULT_THRESHOLDS: ExceptionThresholds = {
    recurringIssues: 3,
    delayWarningMinutes: 45,
    performanceThreshold: 0.7, // 70% of average
};

// ============================================================
// DETECTION FUNCTIONS
// ============================================================

/**
 * Detect DNA Patterns - Recurring issues in same room
 */
export async function detectDNAPatterns(
    branchId: string,
    days: number = 30
): Promise<ExceptionAlert[]> {
    const alerts: ExceptionAlert[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
        const requestsRef = collection(db, 'requests');
        const q = query(
            requestsRef,
            where('branch', '==', branchId),
            where('serviceType', '==', 'maintenance'),
            where('createdAt', '>=', Timestamp.fromDate(startDate))
        );

        const snapshot = await getDocs(q);

        // Group by room + maintenance type
        const patterns: Map<string, RequestData[]> = new Map();

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const key = `${data.roomNumber}_${data.maintenanceType || 'general'}`;

            if (!patterns.has(key)) {
                patterns.set(key, []);
            }
            patterns.get(key)!.push({
                id: doc.id,
                roomNumber: data.roomNumber,
                serviceType: data.serviceType,
                status: data.status,
                createdAt: data.createdAt?.toDate() || new Date(),
                maintenanceType: data.maintenanceType,
            });
        });

        // Find recurring patterns
        patterns.forEach((issues, key) => {
            if (issues.length >= DEFAULT_THRESHOLDS.recurringIssues) {
                const [roomNumber, issueType] = key.split('_');
                alerts.push({
                    id: `dna_${key}_${Date.now()}`,
                    type: 'dna_pattern',
                    severity: issues.length >= 5 ? 'high' : 'medium',
                    title: `مشكلة متكررة في غرفة ${roomNumber}`,
                    message: `${issues.length} مشاكل ${getIssueTypeName(issueType)} في آخر ${days} يوم`,
                    actionSuggestion: 'فحص شامل للغرفة وصيانة وقائية',
                    data: { roomNumber, issueType, count: issues.length, issues },
                    timestamp: new Date(),
                });
            }
        });
    } catch (error) {
        console.error('Error detecting DNA patterns:', error);
    }

    return alerts;
}

/**
 * Detect Watchdog Timeouts - Delayed tasks
 */
export async function detectWatchdogTimeouts(
    branchId: string
): Promise<ExceptionAlert[]> {
    const alerts: ExceptionAlert[] = [];

    try {
        const requestsRef = collection(db, 'requests');
        const q = query(
            requestsRef,
            where('branch', '==', branchId),
            where('status', 'in', ['CONFIRMED', 'IN_PROGRESS'])
        );

        const snapshot = await getDocs(q);
        const now = new Date();

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const createdAt = data.createdAt?.toDate() || now;
            const elapsedMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

            // Get expected time based on service type
            const expectedTime = getExpectedTime(data.serviceType);

            if (elapsedMinutes > expectedTime + DEFAULT_THRESHOLDS.delayWarningMinutes) {
                const severity: AlertSeverity =
                    elapsedMinutes > expectedTime * 2 ? 'high' :
                        elapsedMinutes > expectedTime * 1.5 ? 'medium' : 'low';

                alerts.push({
                    id: `watchdog_${doc.id}`,
                    type: 'watchdog_timeout',
                    severity,
                    title: `طلب متأخر - غرفة ${data.roomNumber}`,
                    message: `${data.serviceType} متأخر ${Math.round(elapsedMinutes - expectedTime)} دقيقة`,
                    actionSuggestion: 'متابعة الموظف المسؤول',
                    data: {
                        requestId: doc.id,
                        roomNumber: data.roomNumber,
                        serviceType: data.serviceType,
                        elapsedMinutes: Math.round(elapsedMinutes),
                        expectedTime,
                        assignedTo: data.assignedTo,
                    },
                    timestamp: new Date(),
                });
            }
        });
    } catch (error) {
        console.error('Error detecting watchdog timeouts:', error);
    }

    return alerts;
}

/**
 * Detect Performance Issues - Employees below average
 */
export async function detectPerformanceIssues(
    branchId: string,
    days: number = 7
): Promise<ExceptionAlert[]> {
    const alerts: ExceptionAlert[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
        const requestsRef = collection(db, 'requests');
        const q = query(
            requestsRef,
            where('branch', '==', branchId),
            where('status', '==', 'COMPLETED'),
            where('completedAt', '>=', Timestamp.fromDate(startDate))
        );

        const snapshot = await getDocs(q);

        // Group by employee
        const employeeStats: Map<string, { count: number; totalTime: number; name: string }> = new Map();

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (!data.completedBy?.id) return;

            const employeeId = data.completedBy.id;
            const employeeName = data.completedBy.name || 'غير معروف';

            const createdAt = data.createdAt?.toDate() || new Date();
            const completedAt = data.completedAt?.toDate() || new Date();
            const duration = (completedAt.getTime() - createdAt.getTime()) / (1000 * 60);

            const stats = employeeStats.get(employeeId) || { count: 0, totalTime: 0, name: employeeName };
            stats.count++;
            stats.totalTime += duration;
            employeeStats.set(employeeId, stats);
        });

        // Calculate averages
        let totalAvgTime = 0;
        let employeeCount = 0;
        employeeStats.forEach(stats => {
            if (stats.count > 0) {
                totalAvgTime += stats.totalTime / stats.count;
                employeeCount++;
            }
        });
        const globalAvgTime = employeeCount > 0 ? totalAvgTime / employeeCount : 0;

        // Find underperformers
        employeeStats.forEach((stats, employeeId) => {
            const avgTime = stats.totalTime / stats.count;
            const ratio = globalAvgTime > 0 ? avgTime / globalAvgTime : 1;

            if (ratio > 1 / DEFAULT_THRESHOLDS.performanceThreshold && stats.count >= 3) {
                alerts.push({
                    id: `perf_${employeeId}_${Date.now()}`,
                    type: 'performance_issue',
                    severity: ratio > 2 ? 'high' : ratio > 1.5 ? 'medium' : 'low',
                    title: `أداء منخفض: ${stats.name}`,
                    message: `متوسط الوقت ${Math.round(avgTime)} دقيقة (${Math.round(ratio * 100)}% من المعدل)`,
                    actionSuggestion: 'مراجعة وتدريب إضافي',
                    data: {
                        employeeId,
                        employeeName: stats.name,
                        avgTime: Math.round(avgTime),
                        globalAvgTime: Math.round(globalAvgTime),
                        ratio: Math.round(ratio * 100),
                        taskCount: stats.count,
                    },
                    timestamp: new Date(),
                });
            }
        });
    } catch (error) {
        console.error('Error detecting performance issues:', error);
    }

    return alerts;
}

// ============================================================
// MAIN FUNCTION
// ============================================================

/**
 * Get all exceptions for a branch
 */
export async function getAllExceptions(branchId: string): Promise<{
    alerts: ExceptionAlert[];
    summary: { high: number; medium: number; low: number; total: number };
}> {
    const [dnaAlerts, watchdogAlerts, performanceAlerts] = await Promise.all([
        detectDNAPatterns(branchId),
        detectWatchdogTimeouts(branchId),
        detectPerformanceIssues(branchId),
    ]);

    const alerts = [...dnaAlerts, ...watchdogAlerts, ...performanceAlerts]
        .sort((a, b) => {
            const severityOrder = { high: 0, medium: 1, low: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });

    const summary = {
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length,
        total: alerts.length,
    };

    return { alerts, summary };
}

// ============================================================
// HELPERS
// ============================================================

function getIssueTypeName(type: string): string {
    const names: Record<string, string> = {
        electrical: 'كهربائية',
        plumbing: 'سباكة',
        ac: 'تكييف',
        furniture: 'أثاث',
        general: 'عامة',
    };
    return names[type] || type;
}

function getExpectedTime(serviceType: string): number {
    const times: Record<string, number> = {
        cleaning: 30,
        maintenance: 45,
        bellman: 10,
        inspection: 15,
    };
    return times[serviceType] || 30;
}

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect, useCallback } from 'react';

export function useExceptionDashboard(branchId: string) {
    const [alerts, setAlerts] = useState<ExceptionAlert[]>([]);
    const [summary, setSummary] = useState({ high: 0, medium: 0, low: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!branchId) return;

        setLoading(true);
        setError(null);

        try {
            const result = await getAllExceptions(branchId);
            setAlerts(result.alerts);
            setSummary(result.summary);
        } catch (err) {
            setError('فشل تحميل الاستثناءات');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        refresh();

        // Auto-refresh every 5 minutes
        const interval = setInterval(refresh, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [refresh]);

    return { alerts, summary, loading, error, refresh };
}

export default {
    detectDNAPatterns,
    detectWatchdogTimeouts,
    detectPerformanceIssues,
    getAllExceptions,
    useExceptionDashboard,
};
