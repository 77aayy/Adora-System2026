/**
 * Exception Service
 * Migrated from exception-dashboard.js with TypeScript
 * Adora Hotel Management System V2
 * 
 * Detects and manages exceptions:
 * - DNA Patterns: Recurring issues in same room
 * - Watchdog Timeouts: Tasks exceeding normal completion time
 * - Performance Issues: Staff below average performance
 * - SLA Breaches: Tasks violating service level agreements
 */

import { db } from './firebase';
import {
    collection, getDocs, query, where, orderBy, limit, Timestamp
} from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface ExceptionAlert {
    id: string;
    type: ExceptionType;
    severity: Severity;
    message: string;
    action: string;
    room?: string | number;
    staffId?: string;
    staffName?: string;
    taskType?: string;
    occurrences?: number;
    delay?: number;
    performance?: number;
    detectedAt: Date;
    metadata?: Record<string, any>;
}

export type ExceptionType =
    | 'DNA_PATTERN'           // Recurring issues
    | 'WATCHDOG_TIMEOUT'      // Task timeout
    | 'PERFORMANCE_ISSUE'     // Staff underperformance
    | 'SLA_BREACH'            // SLA violation
    | 'OVERDUE_REQUEST'       // Pending too long
    | 'ESCALATION_NEEDED';    // Needs manager attention

export interface ThresholdConfig {
    recurringIssues: number;      // Same room, same issue
    delayWarningMinutes: number;  // Minutes after average
    performanceDropPercent: number; // Below average %
    pendingMaxMinutes: number;    // Max pending time
    slaCleaningMinutes: number;   // SLA for cleaning
    slaMaintenanceMinutes: number; // SLA for maintenance
    slaBellmanMinutes: number;    // SLA for bellman
}

export interface ExceptionSummary {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
}

// ============================================================
// DEFAULT CONFIGURATION
// ============================================================

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
    recurringIssues: 3,
    delayWarningMinutes: 45,
    performanceDropPercent: 50,
    pendingMaxMinutes: 60,
    slaCleaningMinutes: 30,
    slaMaintenanceMinutes: 60,
    slaBellmanMinutes: 15
};

// ============================================================
// SEVERITY CONFIGURATION
// ============================================================

export const SEVERITY_CONFIG = {
    critical: {
        color: '#DC2626',
        bgColor: 'rgba(220, 38, 38, 0.1)',
        icon: 'alert-octagon',
        label: 'حرج'
    },
    high: {
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.1)',
        icon: 'alert-triangle',
        label: 'عاجل'
    },
    medium: {
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.1)',
        icon: 'clock',
        label: 'متوسط'
    },
    low: {
        color: '#3B82F6',
        bgColor: 'rgba(59, 130, 246, 0.1)',
        icon: 'info',
        label: 'منخفض'
    }
};

// ============================================================
// EXCEPTION DETECTION CLASS
// ============================================================

class ExceptionDetector {
    private alerts: ExceptionAlert[] = [];
    private thresholds: ThresholdConfig;
    private branchId: string = '';
    private tenantId: string = '';

    constructor(thresholds: Partial<ThresholdConfig> = {}) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    }

    /**
     * Set tenant ID for tenant-scoped requests path (required for SaaS isolation)
     */
    setTenantId(tenantId: string): void {
        this.tenantId = tenantId;
    }

    /**
     * Set branch ID for queries
     */
    setBranch(branchId: string): void {
        this.branchId = branchId;
    }

    /**
     * Set custom thresholds
     */
    setThresholds(thresholds: Partial<ThresholdConfig>): void {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    /**
     * Detect all exceptions
     */
    async detectAll(): Promise<ExceptionAlert[]> {
        this.alerts = [];
        if (!this.tenantId) {
            logger.warn('ExceptionDetector.detectAll called without tenantId', undefined, 'exceptionService');
            return [];
        }

        await Promise.all([
            this.detectDNAPatterns(),
            this.detectWatchdogTimeouts(),
            this.detectPerformanceIssues(),
            this.detectSLABreaches(),
            this.detectOverdueRequests()
        ]);

        // Sort by severity
        this.alerts.sort((a, b) => {
            const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
            return order[a.severity] - order[b.severity];
        });

        logger.info(`🔍 Found ${this.alerts.length} exceptions`, undefined, 'exceptionService');
        return this.alerts;
    }

    /**
     * Detect DNA Patterns - Recurring issues in same room
     */
    async detectDNAPatterns(): Promise<void> {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const constraints: any[] = [
                where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo))
            ];

            if (this.branchId) {
                constraints.push(where('branch', '==', this.branchId));
            }

            const requestsRef = collection(db, `tenants/${this.tenantId}/requests`);
            const requestsQuery = query(requestsRef, ...constraints);

            const snapshot = await getDocs(requestsQuery);
            const patterns = new Map<string, Array<{ room: string; type: string; date: Date }>>();

            snapshot.forEach(doc => {
                const data = doc.data();
                if (!data.roomNumber || !data.serviceType) return;

                const key = `${data.roomNumber}_${data.serviceType}`;

                if (!patterns.has(key)) {
                    patterns.set(key, []);
                }

                patterns.get(key)!.push({
                    room: data.roomNumber,
                    type: data.serviceType,
                    date: data.createdAt?.toDate() || new Date()
                });
            });

            // Find recurring patterns
            patterns.forEach((occurrences, key) => {
                if (occurrences.length >= this.thresholds.recurringIssues) {
                    const [room, issueType] = key.split('_');

                    this.alerts.push({
                        id: `dna_${key}_${Date.now()}`,
                        type: 'DNA_PATTERN',
                        severity: occurrences.length >= 5 ? 'high' : 'medium',
                        room: room,
                        taskType: issueType,
                        occurrences: occurrences.length,
                        message: `غرفة ${room}: تكرار ${occurrences.length} مرات لمشكلة "${this.getServiceTypeName(issueType)}"`,
                        action: 'يُنصح بفحص شامل للغرفة وتحديد السبب الجذري',
                        detectedAt: new Date()
                    });
                }
            });
        } catch (error) {
            logger.error('DNA detection error:', error, 'exceptionService');
        }
    }

    /**
     * Detect Watchdog Timeouts - Tasks exceeding completion time
     */
    async detectWatchdogTimeouts(): Promise<void> {
        try {
            const avgTimes = await this.calculateAverageCompletionTimes();

            const constraints: any[] = [
                where('status', 'in', ['PENDING', 'CONFIRMED', 'IN_PROGRESS'])
            ];

            if (this.branchId) {
                constraints.push(where('branch', '==', this.branchId));
            }

            const requestsRef = collection(db, `tenants/${this.tenantId}/requests`);
            const pendingQuery = query(requestsRef, ...constraints);

            const snapshot = await getDocs(pendingQuery);
            const now = new Date();

            snapshot.forEach(doc => {
                const data = doc.data();
                const startTime = data.startedAt?.toDate() || data.createdAt?.toDate();

                if (!startTime) return;

                const elapsedMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
                const taskType = data.serviceType || 'general';
                const avgTime = avgTimes.get(taskType) || 30;

                if (elapsedMinutes > avgTime + this.thresholds.delayWarningMinutes) {
                    const delayMinutes = Math.round(elapsedMinutes - avgTime);

                    this.alerts.push({
                        id: `watchdog_${doc.id}`,
                        type: 'WATCHDOG_TIMEOUT',
                        severity: delayMinutes > 90 ? 'high' : 'medium',
                        room: data.roomNumber,
                        taskType: taskType,
                        delay: delayMinutes,
                        staffId: data.assignedTo?.id,
                        staffName: data.assignedTo?.name,
                        message: `غرفة ${data.roomNumber || 'غير محدد'}: تأخير ${delayMinutes} دقيقة عن المعدل`,
                        action: 'متابعة مع الموظف المسؤول أو إعادة التعيين',
                        detectedAt: new Date(),
                        metadata: { requestId: doc.id }
                    });
                }
            });
        } catch (error) {
            logger.error('Watchdog detection error:', error, 'exceptionService');
        }
    }

    /**
     * Detect Performance Issues - Staff below average
     */
    async detectPerformanceIssues(): Promise<void> {
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const constraints: any[] = [
                where('status', '==', 'COMPLETED'),
                where('completedAt', '>=', Timestamp.fromDate(sevenDaysAgo))
            ];

            if (this.branchId) {
                constraints.push(where('branch', '==', this.branchId));
            }

            const requestsRef = collection(db, `tenants/${this.tenantId}/requests`);
            const completedQuery = query(requestsRef, ...constraints);

            const snapshot = await getDocs(completedQuery);
            const staffPerformance = new Map<string, { durations: number[]; name: string }>();

            snapshot.forEach(doc => {
                const data = doc.data();
                const staffId = data.assignedTo?.id || data.completedBy?.id;
                const staffName = data.assignedTo?.name || data.completedBy?.name;

                if (!staffId) return;

                const startTime = data.startedAt?.toDate() || data.createdAt?.toDate();
                const endTime = data.completedAt?.toDate();

                if (!startTime || !endTime) return;

                const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

                if (!staffPerformance.has(staffId)) {
                    staffPerformance.set(staffId, { durations: [], name: staffName || staffId });
                }

                staffPerformance.get(staffId)!.durations.push(duration);
            });

            // Calculate averages
            let globalTotal = 0;
            let globalCount = 0;

            staffPerformance.forEach(({ durations }) => {
                globalTotal += durations.reduce((a, b) => a + b, 0);
                globalCount += durations.length;
            });

            if (globalCount === 0) return;

            const globalAverage = globalTotal / globalCount;
            const threshold = 1 + (this.thresholds.performanceDropPercent / 100);

            staffPerformance.forEach(({ durations, name }, staffId) => {
                const staffAvg = durations.reduce((a, b) => a + b, 0) / durations.length;
                const performance = staffAvg / globalAverage;

                if (performance > threshold) {
                    const slowness = Math.round((performance - 1) * 100);

                    this.alerts.push({
                        id: `perf_${staffId}_${Date.now()}`,
                        type: 'PERFORMANCE_ISSUE',
                        severity: 'low',
                        staffId: staffId,
                        staffName: name,
                        performance: performance,
                        message: `الموظف ${name}: أبطأ بنسبة ${slowness}% من المعدل`,
                        action: 'تدريب إضافي أو متابعة مع المشرف',
                        detectedAt: new Date()
                    });
                }
            });
        } catch (error) {
            logger.error('Performance detection error:', error, 'exceptionService');
        }
    }

    /**
     * Detect SLA Breaches
     */
    async detectSLABreaches(): Promise<void> {
        try {
            const constraints: any[] = [
                where('status', 'in', ['PENDING', 'CONFIRMED', 'IN_PROGRESS'])
            ];

            if (this.branchId) {
                constraints.push(where('branch', '==', this.branchId));
            }

            const requestsRef = collection(db, `tenants/${this.tenantId}/requests`);
            const pendingQuery = query(requestsRef, ...constraints);

            const snapshot = await getDocs(pendingQuery);
            const now = new Date();

            snapshot.forEach(doc => {
                const data = doc.data();
                const createdAt = data.createdAt?.toDate();

                if (!createdAt) return;

                const elapsedMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
                const serviceType = data.serviceType || 'general';

                let slaLimit = 60; // Default
                switch (serviceType) {
                    case 'cleaning':
                        slaLimit = this.thresholds.slaCleaningMinutes;
                        break;
                    case 'maintenance':
                        slaLimit = this.thresholds.slaMaintenanceMinutes;
                        break;
                    case 'bellman':
                        slaLimit = this.thresholds.slaBellmanMinutes;
                        break;
                }

                if (elapsedMinutes > slaLimit && data.status !== 'COMPLETED') {
                    const breachMinutes = Math.round(elapsedMinutes - slaLimit);

                    this.alerts.push({
                        id: `sla_${doc.id}`,
                        type: 'SLA_BREACH',
                        severity: breachMinutes > slaLimit ? 'critical' : 'high',
                        room: data.roomNumber,
                        taskType: serviceType,
                        delay: breachMinutes,
                        message: `انتهاك SLA: غرفة ${data.roomNumber || 'غير محدد'} - تجاوز ${breachMinutes} دقيقة`,
                        action: 'تصعيد فوري للمشرف',
                        detectedAt: new Date(),
                        metadata: { requestId: doc.id, slaLimit }
                    });
                }
            });
        } catch (error) {
            logger.error('SLA detection error:', error, 'exceptionService');
        }
    }

    /**
     * Detect Overdue Requests - Pending too long
     */
    async detectOverdueRequests(): Promise<void> {
        try {
            const constraints: any[] = [
                where('status', '==', 'PENDING')
            ];

            if (this.branchId) {
                constraints.push(where('branch', '==', this.branchId));
            }

            const requestsRef = collection(db, `tenants/${this.tenantId}/requests`);
            const pendingQuery = query(requestsRef, ...constraints, limit(50));

            const snapshot = await getDocs(pendingQuery);
            const now = new Date();

            snapshot.forEach(doc => {
                const data = doc.data();
                const createdAt = data.createdAt?.toDate();

                if (!createdAt) return;

                const elapsedMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

                if (elapsedMinutes > this.thresholds.pendingMaxMinutes) {
                    this.alerts.push({
                        id: `overdue_${doc.id}`,
                        type: 'OVERDUE_REQUEST',
                        severity: elapsedMinutes > 120 ? 'high' : 'medium',
                        room: data.roomNumber,
                        taskType: data.serviceType,
                        delay: Math.round(elapsedMinutes),
                        message: `طلب معلق: غرفة ${data.roomNumber || 'غير محدد'} - ${Math.round(elapsedMinutes)} دقيقة بدون تأكيد`,
                        action: 'تأكيد الطلب أو إلغاؤه',
                        detectedAt: new Date(),
                        metadata: { requestId: doc.id }
                    });
                }
            });
        } catch (error) {
            logger.error('Overdue detection error:', error, 'exceptionService');
        }
    }

    /**
     * Calculate average completion times by task type
     */
    private async calculateAverageCompletionTimes(): Promise<Map<string, number>> {
        const avgTimes = new Map<string, number>();

        try {
            const requestsRef = collection(db, `tenants/${this.tenantId}/requests`);
            const completedQuery = query(
                requestsRef,
                where('status', '==', 'COMPLETED'),
                limit(500)
            );

            const snapshot = await getDocs(completedQuery);
            const byType = new Map<string, number[]>();

            snapshot.forEach(doc => {
                const data = doc.data();
                const startTime = data.startedAt?.toDate() || data.createdAt?.toDate();
                const endTime = data.completedAt?.toDate();

                if (!startTime || !endTime) return;

                const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
                const taskType = data.serviceType || 'general';

                if (!byType.has(taskType)) {
                    byType.set(taskType, []);
                }

                byType.get(taskType)!.push(duration);
            });

            byType.forEach((durations, type) => {
                const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
                avgTimes.set(type, avg);
            });
        } catch (error) {
            logger.error('Calculate avg times error:', error, 'exceptionService');
        }

        return avgTimes;
    }

    /**
     * Get service type name
     */
    private getServiceTypeName(type: string): string {
        const names: Record<string, string> = {
            cleaning: 'تنظيف',
            maintenance: 'صيانة',
            bellman: 'بيلمان',
            coffee: 'كوفي شوب',
            room_service: 'خدمة غرف'
        };
        return names[type] || type;
    }

    /**
     * Get alerts
     */
    getAlerts(): ExceptionAlert[] {
        return [...this.alerts];
    }

    /**
     * Get summary
     */
    getSummary(): ExceptionSummary {
        return {
            total: this.alerts.length,
            critical: this.alerts.filter(a => a.severity === 'critical').length,
            high: this.alerts.filter(a => a.severity === 'high').length,
            medium: this.alerts.filter(a => a.severity === 'medium').length,
            low: this.alerts.filter(a => a.severity === 'low').length
        };
    }

    /**
     * Get alerts by type
     */
    getAlertsByType(type: ExceptionType): ExceptionAlert[] {
        return this.alerts.filter(a => a.type === type);
    }

    /**
     * Get alerts by severity
     */
    getAlertsBySeverity(severity: Severity): ExceptionAlert[] {
        return this.alerts.filter(a => a.severity === severity);
    }

    /**
     * Clear all alerts
     */
    clearAlerts(): void {
        this.alerts = [];
    }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const exceptionDetector = new ExceptionDetector();

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback, useEffect } from 'react';

interface UseExceptionsReturn {
    alerts: ExceptionAlert[];
    summary: ExceptionSummary;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    getByType: (type: ExceptionType) => ExceptionAlert[];
    getBySeverity: (severity: Severity) => ExceptionAlert[];
}

export const useExceptions = (
    tenantId: string,
    branchId: string,
    autoRefreshMs?: number
): UseExceptionsReturn => {
    const [alerts, setAlerts] = useState<ExceptionAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!tenantId || !branchId) return;

        setLoading(true);
        setError(null);

        try {
            exceptionDetector.setTenantId(tenantId);
            exceptionDetector.setBranch(branchId);
            const detected = await exceptionDetector.detectAll();
            setAlerts(detected);
        } catch (err: any) {
            setError(err.message || 'حدث خطأ في كشف الاستثناءات');
        } finally {
            setLoading(false);
        }
    }, [tenantId, branchId]);

    useEffect(() => {
        refresh();

        if (autoRefreshMs && autoRefreshMs > 0) {
            const interval = setInterval(refresh, autoRefreshMs);
            return () => clearInterval(interval);
        }
    }, [refresh, autoRefreshMs]);

    const summary = {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length
    };

    const getByType = useCallback((type: ExceptionType) =>
        alerts.filter(a => a.type === type), [alerts]);

    const getBySeverity = useCallback((severity: Severity) =>
        alerts.filter(a => a.severity === severity), [alerts]);

    return {
        alerts,
        summary,
        loading,
        error,
        refresh,
        getByType,
        getBySeverity
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Constants
    DEFAULT_THRESHOLDS,
    SEVERITY_CONFIG,

    // Classes
    ExceptionDetector,
    exceptionDetector,

    // Hook
    useExceptions
};
