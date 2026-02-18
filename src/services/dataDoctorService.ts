/**
 * Data Doctor Service 🏥
 * Intelligent self-healing and quality audit system
 * 
 * Enhanced Features (V3):
 * - Collection integrity checks
 * - Auto-seeding for missing collections
 * - Database health monitoring
 * - Weekly report aggregation
 * 
 * Adora Hotel Management System V3
 */

import { db, isFirebaseConfigured, getSafeFirestore } from './firebase';
import type { Firestore } from 'firebase/firestore';
import {
    collection,
    query,
    where,
    getDocs,
    updateDoc,
    doc,
    Timestamp,
    addDoc,
    serverTimestamp,
    getDoc,
    setDoc,
    orderBy,
    limit
} from 'firebase/firestore';
import { Room } from '../types';
import { 
    checkMissingCollections, 
    seedTenantDatabase, 
    SeedingResult 
} from './tenantSeedingService';
import { logger } from './loggerService';

// ============================================================
// CONFIGURATION
// ============================================================

const MIN_CLEANING_TIME_MS = 10 * 60 * 1000; // 10 minutes minimum for "quality" cleaning
const AUDIT_LOG_COLLECTION = 'audit_logs'; // ✅ Use audit_logs (has rules) instead of data_doctor_logs

export interface AuditLog {
    id?: string;
    type: 'healing' | 'security' | 'quality' | 'alert' | 'system';
    message: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: any;
    resolved: boolean;
    metadata?: any;
}

export interface DatabaseHealthReport {
    timestamp: Date;
    overallHealth: 'healthy' | 'warning' | 'critical';
    missingCollections: string[];
    healedRecords: number;
    suspiciousCleanings: number;
    securityAlerts: number;
    totalLogs: number;
    avgMaintenanceTime?: number;
    recommendations: string[];
}

export interface WeeklyReportData {
    weekStart: Date;
    weekEnd: Date;
    suspiciousCleanings: number;
    avgMaintenanceTimeMinutes: number;
    maintenanceTimeTrend: number; // percentage change from previous week
    totalHealed: number;
    securityIncidents: number;
    topIssues: { issue: string; count: number }[];
}

// ============================================================
// CORE DIAGNOSTICS
// ============================================================

/**
 * Diagnose and heal Room data
 * Target: Missing tenantId, inconsistent status
 */
export const diagnoseRooms = async (tenantId: string, branchId: string, dbInstance?: Firestore | null): Promise<number> => {
    if (!tenantId || !branchId) return 0;
    const firestore = dbInstance ?? db;
    if (!firestore) return 0;

    logger.info(`🏥 [Data Doctor] Scanning rooms for branch: ${branchId}...`, undefined, 'dataDoctorService');
    let healedCount = 0;

    const roomsRef = collection(firestore, 'tenants', tenantId, 'rooms');
    const q = query(roomsRef, where('branchId', '==', branchId));
    const snapshot = await getDocs(q);

    for (const roomDoc of snapshot.docs) {
        const data = roomDoc.data();
        const updates: any = {};

        // 1. Repair missing tenantId (SaaS Protection)
        if (!data.tenantId) {
            updates.tenantId = tenantId;
            logger.warn(`🚀 [Data Doctor] Healing tenantId for room ${data.number}`, undefined, 'dataDoctorService');
        }

        // 2. Repair missing floor (Visual Protection)
        if (data.floor === undefined || data.floor === null) {
            const roomNum = parseInt(data.number);
            if (!isNaN(roomNum)) {
                updates.floor = Math.floor(roomNum / 100);
                logger.warn(`🚀 [Data Doctor] Healing floor for room ${data.number}`, undefined, 'dataDoctorService');
            }
        }

        if (Object.keys(updates).length > 0) {
            await updateDoc(roomDoc.ref, updates);
            healedCount++;
        }
    }

    if (healedCount > 0) {
        await logAction({
            type: 'healing',
            message: `تم إصلاح ${healedCount} غرف بنجاح`,
            description: `قام الطبيب التقني بتحديث بيانات المستأجر والتوزيع المكاني للغرف المفقودة.`,
            severity: 'low',
            resolved: true
        }, tenantId, branchId, firestore);
    }

    return healedCount;
};

/**
 * Audit Cleaning Quality (Ghost Cleaning Detection)
 * Detects rooms cleaned too fast
 */
export const auditCleaningQuality = async (tenantId: string, branchId: string, dbInstance?: Firestore | null): Promise<void> => {
    const firestore = dbInstance ?? db;
    if (!firestore) return;
    // This would typically involve checking 'requests' or 'cleaning_logs'
    // For now, we simulate by checking recent room status changes if tracked
    // Implementation: Query requests of type 'room_service' where status is 'completed'
    // and compare createdAt vs completedAt

    // ✅ FIX: Use tenant-scoped collection path
    const requestsRef = collection(firestore, 'tenants', tenantId, 'requests');
    const q = query(
        requestsRef,
        where('branch', '==', branchId),
        where('type', '==', 'room_service'),
        where('status', '==', 'completed')
    );

    const snapshot = await getDocs(q);
    const suspiciousRequests = snapshot.docs.filter(doc => {
        const data = doc.data();
        if (data.createdAt && data.completedAt) {
            const start = data.createdAt.toDate();
            const end = data.completedAt.toDate();
            const duration = end.getTime() - start.getTime();
            return duration > 0 && duration < MIN_CLEANING_TIME_MS;
        }
        return false;
    });

    if (suspiciousRequests.length > 0) {
        for (const req of suspiciousRequests) {
            const data = req.data();
            await logAction({
                type: 'quality',
                message: `تنظيف مشبوه في غرفة ${data.roomNumber}`,
                description: `تم إنهاء تنظيف الغرفة خلال وقت قياسي (أقل من ${MIN_CLEANING_TIME_MS / 60000} دقائق). يُقترح التفتيش العيني.`,
                severity: 'medium',
                resolved: false,
                metadata: { requestId: req.id, roomNumber: data.roomNumber }
            }, tenantId, branchId, firestore);
        }
    }
};

/**
 * Log Data Doctor Actions
 */
const logAction = async (log: Partial<AuditLog>, tenantId: string, branchId: string, dbInstance?: Firestore | null) => {
    const firestore = dbInstance ?? db;
    if (!firestore) return;
    try {
        await addDoc(collection(firestore, AUDIT_LOG_COLLECTION), {
            ...log,
            tenantId,
            branchId,
            timestamp: serverTimestamp()
        });
    } catch (err) {
        logger.error('Data Doctor failed to log:', err, 'dataDoctorService');
    }
};

/**
 * Main Diagnostic Trigger
 */
export const runDataDoctor = async (tenantId: string, branchId: string) => {
    if (!tenantId || !branchId) return;

    try {
        const safeDb = await getSafeFirestore();
        if (!safeDb) {
            return { success: true, healedRooms: 0 };
        }
        const healed = await diagnoseRooms(tenantId, branchId, safeDb);
        await auditCleaningQuality(tenantId, branchId, safeDb);
        return { success: true, healedRooms: healed };
    } catch (err) {
        logger.error('Data Doctor Crash:', err, 'dataDoctorService');
        return { success: false, error: err };
    }
};

// ============================================================
// COLLECTION INTEGRITY (V3)
// ============================================================

/**
 * Check database integrity and auto-seed missing collections
 * This is the first thing that runs when a new tenant logs in
 */
/**
 * Get tenantId from localStorage (SaaS isolation)
 */
const getTenantId = (): string | null => {
    try {
        const storedUser = localStorage.getItem('adora_user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            return user.tenantId || localStorage.getItem('adora_tenant_id');
        }
        return localStorage.getItem('adora_tenant_id');
    } catch {
        return null;
    }
};

export const performHealthCheck = async (): Promise<{
    healthy: boolean;
    missingCollections: string[];
    seeded: boolean;
    seedingResult?: SeedingResult;
}> => {
    if (!isFirebaseConfigured()) {
        return {
            healthy: false,
            missingCollections: ['ALL - Firebase not configured'],
            seeded: false
        };
    }
    const safeDb = await getSafeFirestore();
    if (!safeDb) {
        return {
            healthy: false,
            missingCollections: ['Firestore not ready'],
            seeded: false
        };
    }

    // ✅ SaaS: Get tenantId for data isolation
    const tenantId = getTenantId();
    if (!tenantId) {
        return {
            healthy: false,
            missingCollections: ['tenantId required'],
            seeded: false
        };
    }

    try {
        logger.debug(`🏥 [Data Doctor] Performing database health check for tenant: ${tenantId}...`, undefined, 'dataDoctorService');

        // Check for missing collections
        const missing = await checkMissingCollections(tenantId);

        if (missing.length === 0) {
            logger.debug('✅ [Data Doctor] Database is healthy!', undefined, 'dataDoctorService');
            return {
                healthy: true,
                missingCollections: [],
                seeded: false
            };
        }

        logger.debug(`⚠️ [Data Doctor] Found ${missing.length} missing collections:`, missing, 'dataDoctorService');

        // ✅ FIX: Only seed if user is owner (to avoid permission-denied errors)
        // Check user role from localStorage
        let isOwner = false;
        try {
            const userData = localStorage.getItem('adora_user');
            if (userData) {
                const user = JSON.parse(userData);
                isOwner = user?.role === 'owner';
            }
        } catch (e) {
            // If can't parse user, assume not owner
        }

        if (!isOwner && tenantId === 'system-owner') {
            // ✅ For system-owner, only seed if user is actually owner
            logger.warn('⚠️ [Data Doctor] Skipping seeding for system-owner (user is not owner)', undefined, 'dataDoctorService');
            return {
                healthy: false,
                missingCollections: missing,
                seeded: false
            };
        }

        // ✅ Only owner may run client-side seeding (Firestore rules allow tenant write only for owner or bound user;
        // on app load userBinding may not be ready yet for managers, so skip to avoid "Missing or insufficient permissions")
        if (!isOwner) {
            logger.debug('⚠️ [Data Doctor] Skipping auto-seed (non-owner); tenant data is seeded by Cloud Function or onboarding.', undefined, 'dataDoctorService');
            return {
                healthy: false,
                missingCollections: missing,
                seeded: false
            };
        }

        // Auto-seed missing collections (owner only)
        logger.debug('🌱 [Data Doctor] Auto-seeding missing collections...', undefined, 'dataDoctorService');
        const seedingResult = await seedTenantDatabase(tenantId, { includeDemoRoom: true });

        // Log the action (fire-and-forget: don't block on Write channel 404/400)
        addDoc(collection(safeDb, AUDIT_LOG_COLLECTION), {
            type: 'system',
            message: 'تم تأسيس قاعدة البيانات تلقائياً',
            description: `قام النظام بإنشاء ${seedingResult.collectionsCreated.length} جداول أساسية: ${seedingResult.collectionsCreated.join(', ')}`,
            severity: 'low',
            resolved: true,
            timestamp: serverTimestamp(),
            metadata: { seeding: seedingResult }
        }).catch((logErr: any) => {
            const isChannelError = logErr?.code === 400 || logErr?.code === 404 ||
                logErr?.message?.includes('400') || logErr?.message?.includes('404') || logErr?.message?.includes('Write/channel');
            if (isChannelError) {
                logger.debug('Seeding audit log skipped (Write channel error)', undefined, 'dataDoctorService');
            } else {
                logger.warn('Failed to log seeding action:', logErr, 'dataDoctorService');
            }
        });

        return {
            healthy: seedingResult.success,
            missingCollections: missing,
            seeded: true,
            seedingResult
        };

    } catch (error) {
        logger.error('❌ [Data Doctor] Health check failed:', error, 'dataDoctorService');
        return {
            healthy: false,
            missingCollections: ['Error checking'],
            seeded: false
        };
    }
};

// ============================================================
// WEEKLY REPORT (V3)
// ============================================================

/**
 * Generate weekly data health report for owner
 */
export const generateWeeklyReport = async (
    tenantId: string,
    branchId?: string
): Promise<WeeklyReportData | null> => {
    const firestore = await getSafeFirestore();
    if (!firestore) return null;

    try {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);

        // Get logs from the past week
        const logsRef = collection(firestore, AUDIT_LOG_COLLECTION);
        let q = query(
            logsRef,
            where('tenantId', '==', tenantId),
            where('timestamp', '>=', Timestamp.fromDate(weekStart)),
            orderBy('timestamp', 'desc')
        );

        if (branchId) {
            q = query(
                logsRef,
                where('tenantId', '==', tenantId),
                where('branchId', '==', branchId),
                where('timestamp', '>=', Timestamp.fromDate(weekStart)),
                orderBy('timestamp', 'desc')
            );
        }

        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AuditLog[];

        // Categorize logs
        const suspiciousCleanings = logs.filter(l => l.type === 'quality').length;
        const securityIncidents = logs.filter(l => l.type === 'security').length;
        const healingLogs = logs.filter(l => l.type === 'healing');

        // Count total healed records
        let totalHealed = 0;
        healingLogs.forEach(log => {
            const match = log.message?.match(/(\d+)/);
            if (match) totalHealed += parseInt(match[1]);
        });

        // Calculate top issues
        const issueCount: Record<string, number> = {};
        logs.forEach(log => {
            const issue = log.type || 'other';
            issueCount[issue] = (issueCount[issue] || 0) + 1;
        });

        const topIssues = Object.entries(issueCount)
            .map(([issue, count]) => ({ issue, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Calculate average maintenance time (from requests) for current week
        let avgMaintenanceTimeMinutes = 0;
        let avgMaintenanceTimePrevWeek = 0;
        
        try {
            const requestsRef = collection(firestore, 'tenants', tenantId, 'requests');
            
            // ✅ Calculate current week average
            const maintenanceQuery = query(
                requestsRef,
                where('type', '==', 'maintenance'),
                where('status', '==', 'completed'),
                where('completedAt', '>=', Timestamp.fromDate(weekStart))
            );

            const maintenanceSnapshot = await getDocs(maintenanceQuery);
            const durations: number[] = [];

            maintenanceSnapshot.docs.forEach(d => {
                const data = d.data();
                if (data.createdAt && data.completedAt) {
                    const start = data.createdAt.toDate();
                    const end = data.completedAt.toDate();
                    const mins = (end.getTime() - start.getTime()) / 60000;
                    if (mins > 0 && mins < 1440) { // Less than 24 hours
                        durations.push(mins);
                    }
                }
            });

            if (durations.length > 0) {
                avgMaintenanceTimeMinutes = Math.round(
                    durations.reduce((a, b) => a + b, 0) / durations.length
                );
            }

            // ✅ Calculate previous week average (for trend comparison)
            const prevWeekStart = new Date(weekStart);
            prevWeekStart.setDate(prevWeekStart.getDate() - 7); // 7 days before current week start
            const prevWeekEnd = new Date(weekStart); // End of previous week = start of current week

            const prevMaintenanceQuery = query(
                requestsRef,
                where('type', '==', 'maintenance'),
                where('status', '==', 'completed'),
                where('completedAt', '>=', Timestamp.fromDate(prevWeekStart)),
                where('completedAt', '<', Timestamp.fromDate(prevWeekEnd))
            );

            const prevMaintenanceSnapshot = await getDocs(prevMaintenanceQuery);
            const prevDurations: number[] = [];

            prevMaintenanceSnapshot.docs.forEach(d => {
                const data = d.data();
                if (data.createdAt && data.completedAt) {
                    const start = data.createdAt.toDate();
                    const end = data.completedAt.toDate();
                    const mins = (end.getTime() - start.getTime()) / 60000;
                    if (mins > 0 && mins < 1440) { // Less than 24 hours
                        prevDurations.push(mins);
                    }
                }
            });

            if (prevDurations.length > 0) {
                avgMaintenanceTimePrevWeek = Math.round(
                    prevDurations.reduce((a, b) => a + b, 0) / prevDurations.length
                );
            }
        } catch (err) {
            logger.warn('Could not calculate maintenance time:', err, 'dataDoctorService');
        }

        // ✅ FIX: Calculate trend from previous week (percentage change)
        let maintenanceTimeTrend = 0;
        if (avgMaintenanceTimePrevWeek > 0) {
            // Calculate percentage change: ((current - previous) / previous) * 100
            maintenanceTimeTrend = Math.round(
                ((avgMaintenanceTimeMinutes - avgMaintenanceTimePrevWeek) / avgMaintenanceTimePrevWeek) * 100
            );
        } else if (avgMaintenanceTimeMinutes > 0 && avgMaintenanceTimePrevWeek === 0) {
            // If no previous data but current data exists, mark as new data
            maintenanceTimeTrend = 100; // Indicates new metric (no previous comparison)
        }

        return {
            weekStart,
            weekEnd: now,
            suspiciousCleanings,
            avgMaintenanceTimeMinutes,
            maintenanceTimeTrend,
            totalHealed,
            securityIncidents,
            topIssues
        };

    } catch (error) {
        logger.error('Failed to generate weekly report:', error, 'dataDoctorService');
        return null;
    }
};

/**
 * Get comprehensive database health report
 */
export const getDatabaseHealthReport = async (
    tenantId: string,
    branchId?: string
): Promise<DatabaseHealthReport> => {
    const report: DatabaseHealthReport = {
        timestamp: new Date(),
        overallHealth: 'healthy',
        missingCollections: [],
        healedRecords: 0,
        suspiciousCleanings: 0,
        securityAlerts: 0,
        totalLogs: 0,
        recommendations: []
    };

    const firestore = await getSafeFirestore();
    if (!firestore) {
        report.overallHealth = 'critical';
        report.recommendations.push('Firebase غير متصل');
        return report;
    }

    try {
        // ✅ SaaS: Get tenantId for data isolation
        const tenantId = getTenantId();
        
        // Check missing collections
        report.missingCollections = await checkMissingCollections(tenantId || undefined);

        if (report.missingCollections.length > 0) {
            report.overallHealth = 'warning';
            report.recommendations.push(`يوجد ${report.missingCollections.length} جداول مفقودة - سيتم إنشاؤها تلقائياً`);
        }

        // Get recent logs
        const logsRef = collection(firestore, AUDIT_LOG_COLLECTION);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let q = query(
            logsRef,
            where('tenantId', '==', tenantId),
            where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)),
            orderBy('timestamp', 'desc'),
            limit(100)
        );

        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(d => d.data()) as AuditLog[];

        report.totalLogs = logs.length;
        report.suspiciousCleanings = logs.filter(l => l.type === 'quality').length;
        report.securityAlerts = logs.filter(l => l.type === 'security').length;

        // Sum healed records
        logs.filter(l => l.type === 'healing').forEach(log => {
            const match = log.message?.match(/(\d+)/);
            if (match) report.healedRecords += parseInt(match[1]);
        });

        // Generate recommendations
        if (report.suspiciousCleanings > 5) {
            report.overallHealth = 'warning';
            report.recommendations.push(`${report.suspiciousCleanings} حالات تنظيف مشبوهة - يُنصح بالتفتيش العيني`);
        }

        if (report.securityAlerts > 0) {
            report.overallHealth = 'warning';
            report.recommendations.push(`${report.securityAlerts} تنبيهات أمنية تحتاج مراجعة`);
        }

        if (report.healedRecords > 10) {
            report.recommendations.push(`تم إصلاح ${report.healedRecords} سجل تلقائياً - تحقق من مصدر المشكلة`);
        }

        if (report.recommendations.length === 0) {
            report.recommendations.push('✅ النظام يعمل بشكل سليم');
        }

        return report;

    } catch (error) {
        logger.error('Health report generation failed:', error, 'dataDoctorService');
        report.overallHealth = 'critical';
        report.recommendations.push('فشل في قراءة سجلات النظام');
        return report;
    }
};

/**
 * Save weekly report notification for owner
 */
export const saveWeeklyReportNotification = async (
    tenantId: string,
    report: WeeklyReportData
): Promise<boolean> => {
    const firestore = await getSafeFirestore();
    if (!firestore) return false;

    try {
        await addDoc(collection(firestore, 'notifications'), {
            tenantId,
            type: 'weekly_health_report',
            title: '📊 تقرير صحة البيانات الأسبوعي',
            message: `
الأسبوع: ${report.weekStart.toLocaleDateString('ar')} - ${report.weekEnd.toLocaleDateString('ar')}
• حالات تنظيف مشبوهة: ${report.suspiciousCleanings}
• متوسط وقت الصيانة: ${report.avgMaintenanceTimeMinutes} دقيقة
• سجلات تم إصلاحها: ${report.totalHealed}
            `.trim(),
            data: report,
            read: false,
            createdAt: serverTimestamp()
        });

        return true;
    } catch (error) {
        logger.error('Failed to save weekly report notification:', error, 'dataDoctorService');
        return false;
    }
};

export default {
    runDataDoctor,
    diagnoseRooms,
    auditCleaningQuality,
    performHealthCheck,
    generateWeeklyReport,
    getDatabaseHealthReport,
    saveWeeklyReportNotification
};
