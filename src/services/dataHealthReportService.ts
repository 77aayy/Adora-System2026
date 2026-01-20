/**
 * Data Health Report Service 🏥
 * Comprehensive System Health Report for Developers
 * 
 * Features:
 * - Aggregates anomalies from the week
 * - Calculates trends and statistics
 * - Creates notifications for owners
 * - Comprehensive error analysis
 * - Performance monitoring
 * - Security audit
 * - Data quality checks
 * - User experience metrics
 * 
 * Adora Hotel Management System V3
 */

import {
    collection, query, where, getDocs, addDoc, updateDoc, doc,
    Timestamp, serverTimestamp, orderBy, limit
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export interface DataHealthMetric {
    category: 'cleaning' | 'maintenance' | 'performance' | 'security' | 'quality' | 'connectivity' | 'authentication' | 'network' | 'api' | 'database' | 'memory' | 'ux';
    label: string;
    value: number;
    previousValue?: number;
    unit: string;
    trend: 'up' | 'down' | 'stable';
    trendPercent?: number;
    status: 'good' | 'warning' | 'critical';
    details?: string;
    code?: string; // Error code or identifier
    stackTrace?: string; // For critical errors
}

export interface ConsoleError {
    level: 'error' | 'warn' | 'info' | 'log' | 'debug';
    message: string;
    timestamp: Date;
    stack?: string;
    source?: string;
    args?: any[];
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
        code?: string;
        stackTrace?: string;
        context?: Record<string, any>;
    }[];
    
    // Error Analysis
    errorAnalysis: {
        totalErrors: number;
        errorsByType: Record<string, number>;
        errorsByService: Record<string, number>;
        topErrors: Array<{
            message: string;
            count: number;
            lastOccurrence: Date;
            stackTrace?: string;
        }>;
        unresolvedErrors: number;
    };
    
    // ✅ Console Errors (Full copy of console output)
    consoleErrors: {
        total: number;
        errors: ConsoleError[];
        errorsByLevel: Record<string, number>;
        lastError?: Date;
        fullConsoleOutput?: string; // Full text copy of console
    };
    
    // ✅ System Environment Information
    systemInfo?: {
        browser: string;
        browserVersion: string;
        os: string;
        screenSize: string;
        viewportSize: string;
        userAgent: string;
        language: string;
        timezone: string;
        online: boolean;
        cookieEnabled: boolean;
        localStorageEnabled: boolean;
        indexedDBEnabled: boolean;
        serviceWorkerEnabled: boolean;
        pwaInstalled: boolean;
        memoryInfo?: {
            usedJSHeapSize?: number;
            totalJSHeapSize?: number;
            jsHeapSizeLimit?: number;
        };
        connectionInfo?: {
            effectiveType?: string;
            downlink?: number;
            rtt?: number;
            saveData?: boolean;
        };
    };
    
    // ✅ Firebase Connection Status
    firebaseStatus?: {
        connected: boolean;
        lastConnected?: Date;
        connectionErrors: number;
        readErrors: number;
        writeErrors: number;
        cacheEnabled: boolean;
        missingIndexes: Array<{
            collection: string;
            query: string;
            error: string;
            timestamp: Date;
        }>;
        indexWarnings: number;
    };
    
    // Performance Analysis
    performanceAnalysis: {
        averageResponseTime: number;
        slowQueries: number;
        failedQueries: number;
        apiCallsCount: number;
        averageApiResponseTime: number;
        slowestEndpoints: Array<{
            endpoint: string;
            avgTime: number;
            count: number;
        }>;
    };
    
    // System Activity Timeline
    activityTimeline: Array<{
        timestamp: Date;
        event: string;
        type: 'error' | 'warning' | 'info' | 'success';
        details?: string;
    }>;
    
    // User Activity Statistics
    userActivity: {
        totalUsers: number;
        activeUsers: number;
        newUsers: number;
        totalSessions: number;
        averageSessionDuration: number; // minutes
        requestsPerUser: number;
        mostActiveUsers: Array<{
            userId: string;
            userName: string;
            requestCount: number;
        }>;
    };
    
    // Request Statistics
    requestStatistics: {
        totalRequests: number;
        requestsByType: Record<string, number>;
        requestsByStatus: Record<string, number>;
        averageCompletionTime: number; // minutes
        fastestRequest: number; // minutes
        slowestRequest: number; // minutes
        requestsByDepartment: Record<string, number>;
        peakHours: Array<{
            hour: number;
            count: number;
        }>;
    };
    
    // Database Statistics
    databaseStatistics: {
        totalDocuments: number;
        collections: Record<string, {
            count: number;
            growth: number; // % change from previous week
        }>;
        totalReads: number;
        totalWrites: number;
        averageDocumentSize: number; // bytes (estimated)
    };
    
    // Feature Usage
    featureUsage: Record<string, {
        usageCount: number;
        uniqueUsers: number;
        trend: 'up' | 'down' | 'stable';
    }>;
    
    // System Resources (estimated)
    systemResources: {
        estimatedStorage: number; // MB
        estimatedReads: number;
        estimatedWrites: number;
        cacheHitRate: number; // percentage
    };
    
    // Week Comparison
    weekComparison: {
        issuesChange: number; // % change
        errorsChange: number; // % change
        performanceChange: number; // % change (response time)
        requestsChange: number; // % change
        usersChange: number; // % change
    };
    
    // Recommendations
    recommendations: string[];
    
    // Status
    viewed: boolean;
    viewedAt?: Date;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Safe query execution with fallback
 * ✅ FIX: Added optional collectionName and queryDescription for missing index tracking
 * ✅ FIX: Now accepts missingIndexes array as parameter to track missing indexes
 */
const safeQuery = async (
    queryFn: () => Promise<any>, 
    fallback: any = [],
    collectionName?: string,
    queryDescription?: string,
    missingIndexes?: Array<{
        collection: string;
        query: string;
        error: string;
        timestamp: Date;
    }>
): Promise<any> => {
    try {
        return await queryFn();
    } catch (error: any) {
        // ✅ Track missing indexes for report
        if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
            console.warn('⚠️ Firestore index missing. Using fallback...');
            
            // ✅ Add to missing indexes array if collectionName provided and array exists
            if (collectionName && queryDescription && missingIndexes) {
                missingIndexes.push({
                    collection: collectionName,
                    query: queryDescription,
                    error: error?.message || 'Missing index',
                    timestamp: new Date()
                });
            }
            
            return fallback;
        }
        console.warn('⚠️ Query failed:', error);
        return fallback;
    }
};

/**
 * Extract error patterns from messages
 */
const extractErrorPattern = (message: string): string => {
    // Common patterns
    if (message.includes('permission-denied')) return 'PERMISSION_DENIED';
    if (message.includes('not-found')) return 'NOT_FOUND';
    if (message.includes('already-exists')) return 'ALREADY_EXISTS';
    if (message.includes('unauthenticated')) return 'UNAUTHENTICATED';
    if (message.includes('network')) return 'NETWORK_ERROR';
    if (message.includes('timeout')) return 'TIMEOUT';
    if (message.includes('quota')) return 'QUOTA_EXCEEDED';
    if (message.includes('index')) return 'MISSING_INDEX';
    if (message.includes('null') || message.includes('undefined')) return 'NULL_REFERENCE';
    if (message.includes('Firebase')) return 'FIREBASE_ERROR';
    return 'UNKNOWN_ERROR';
};

/**
 * Extract service name from stack trace or context
 */
const extractServiceName = (stack?: string, context?: Record<string, any>): string => {
    if (context?.context) return context.context;
    if (stack) {
        const match = stack.match(/(\w+Service)\.(ts|js)/);
        if (match) return match[1];
    }
    return 'unknown';
};

// ============================================================
// REPORT GENERATION
// ============================================================

/**
 * Generate comprehensive weekly health report for a tenant
 */
export const generateWeeklyHealthReport = async (
    tenantId: string,
    branchId?: string
): Promise<DataHealthReport> => {
    // ✅ CRITICAL: Null safety check
    if (!db) {
        throw new Error('Firebase Firestore is not initialized');
    }

    if (!tenantId) {
        throw new Error('tenantId is required');
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // ✅ FIX: Define missing indexes tracker for this report
    const missingIndexes: Array<{
        collection: string;
        query: string;
        error: string;
        timestamp: Date;
    }> = [];

    console.log('🏥 [Health Report] Starting comprehensive analysis...', { tenantId, branchId });

    // Initialize default report structure
    const defaultReport: Partial<DataHealthReport> = {
        tenantId,
        branchId,
        reportPeriod: { start: weekAgo, end: now },
        generatedAt: new Date(),
        overallHealth: 100,
        totalIssues: 0,
        resolvedIssues: 0,
        criticalIssues: 0,
        metrics: [],
        anomalies: [],
        errorAnalysis: {
            totalErrors: 0,
            errorsByType: {},
            errorsByService: {},
            topErrors: [],
            unresolvedErrors: 0
        },
        performanceAnalysis: {
            averageResponseTime: 0,
            slowQueries: 0,
            failedQueries: 0,
            apiCallsCount: 0,
            averageApiResponseTime: 0,
            slowestEndpoints: []
        },
        activityTimeline: [],
        userActivity: {
            totalUsers: 0,
            activeUsers: 0,
            newUsers: 0,
            totalSessions: 0,
            averageSessionDuration: 0,
            requestsPerUser: 0,
            mostActiveUsers: []
        },
        requestStatistics: {
            totalRequests: 0,
            requestsByType: {},
            requestsByStatus: {},
            averageCompletionTime: 0,
            fastestRequest: 0,
            slowestRequest: 0,
            requestsByDepartment: {},
            peakHours: []
        },
        databaseStatistics: {
            totalDocuments: 0,
            collections: {},
            totalReads: 0,
            totalWrites: 0,
            averageDocumentSize: 2048
        },
        featureUsage: {},
        systemResources: {
            estimatedStorage: 0,
            estimatedReads: 0,
            estimatedWrites: 0,
            cacheHitRate: 0
        },
        weekComparison: {
            issuesChange: 0,
            errorsChange: 0,
            performanceChange: 0,
            requestsChange: 0,
            usersChange: 0
        },
        recommendations: [],
        consoleErrors: {
            total: 0,
            errors: [],
            errorsByLevel: {},
            lastError: undefined,
            fullConsoleOutput: undefined
        },
        systemInfo: undefined,
        firebaseStatus: undefined,
        viewed: false
    };

    try {
    // ============================================================
    // 1. DATA DOCTOR LOGS
    // ============================================================
    let dataDoctorLogs: any[] = [];
    try {
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

        dataDoctorLogs = await safeQuery(async () => {
            const snapshot = await getDocs(logsQuery);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }, [], 'data_doctor_logs', branchId ? 'data_doctor_logs with tenantId and branchId filter' : 'data_doctor_logs with tenantId filter', missingIndexes);
    } catch (error) {
        console.warn('⚠️ Error fetching data_doctor_logs:', error);
    }

    // ============================================================
    // 2. ERROR LOGS - Comprehensive Error Analysis
    // ============================================================
    let errorLogs: any[] = [];
    try {
        const errorQuery = query(
            collection(db, 'errorLogs'),
            where('timestamp', '>=', Timestamp.fromDate(weekAgo)),
            orderBy('timestamp', 'desc'),
            limit(1000) // Limit to prevent excessive reads
        );
        errorLogs = await safeQuery(async () => {
            const snapshot = await getDocs(errorQuery);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }, [], 'errorLogs', 'errorLogs with timestamp filter', missingIndexes);
        
        // Filter by tenantId if available in error logs
        if (errorLogs.length > 0 && errorLogs[0].tenantId) {
            errorLogs = errorLogs.filter((log: any) => log.tenantId === tenantId);
        }
    } catch (error) {
        console.warn('⚠️ Error fetching errorLogs:', error);
    }

    // ============================================================
    // 3. PERFORMANCE METRICS
    // ============================================================
    let performanceMetrics: any[] = [];
    try {
        const perfQuery = query(
            collection(db, 'performanceMetrics'),
            where('timestamp', '>=', Timestamp.fromDate(weekAgo)),
            orderBy('timestamp', 'desc'),
            limit(500)
        );
        performanceMetrics = await safeQuery(async () => {
            const snapshot = await getDocs(perfQuery);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }, [], 'performanceMetrics', 'performanceMetrics with timestamp filter', missingIndexes);
    } catch (error) {
        console.warn('⚠️ Error fetching performanceMetrics:', error);
    }

    // ============================================================
    // 4. REQUESTS - Service Performance
    // ============================================================
    let requests: any[] = [];
    try {
        // ✅ Try different request collection paths
        const possiblePaths = branchId 
            ? [
                `tenants/${tenantId}/branches/${branchId}/requests`,
                `tenants/${tenantId}/requests`
            ]
            : [`tenants/${tenantId}/requests`];
        
        for (const requestsPath of possiblePaths) {
            try {
                const requestsQuery = query(
                    collection(db, requestsPath),
                    where('createdAt', '>=', Timestamp.fromDate(weekAgo)),
                    orderBy('createdAt', 'desc'),
                    limit(500)
                );
                requests = await safeQuery(async () => {
                    const snapshot = await getDocs(requestsQuery);
                    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }, [], requestsPath, `requests query for ${requestsPath}`, missingIndexes);
                
                // If we got results, break
                if (requests.length > 0) break;
            } catch (pathError: any) {
                // Try next path if this one fails
                console.warn(`⚠️ Error with path ${requestsPath}:`, pathError);
                continue;
            }
        }
    } catch (error) {
        console.warn('⚠️ Error fetching requests:', error);
    }

    // ============================================================
    // 5. AUDIT LOGS - System Activity
    // ============================================================
    let auditLogs: any[] = [];
    try {
        const auditQuery = query(
            collection(db, 'audit_logs'),
            where('tenantId', '==', tenantId),
            where('timestamp', '>=', Timestamp.fromDate(weekAgo)),
            orderBy('timestamp', 'desc'),
            limit(1000)
        );
        auditLogs = await safeQuery(async () => {
            const snapshot = await getDocs(auditQuery);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }, [], 'audit_logs', 'audit_logs with timestamp filter', missingIndexes);
    } catch (error) {
        console.warn('⚠️ Error fetching audit_logs:', error);
    }

    // ============================================================
    // 6. PREVIOUS WEEK DATA (for comparison)
    // ============================================================
    let prevDataDoctorLogs: any[] = [];
    let prevErrorLogs: any[] = [];
    try {
        const prevLogsQuery = query(
            collection(db, 'data_doctor_logs'),
            where('tenantId', '==', tenantId),
            where('timestamp', '>=', Timestamp.fromDate(twoWeeksAgo)),
            where('timestamp', '<', Timestamp.fromDate(weekAgo))
        );
        prevDataDoctorLogs = await safeQuery(async () => {
            const snapshot = await getDocs(prevLogsQuery);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }, [], 'data_doctor_logs', 'previous week data_doctor_logs with tenantId and timestamp filters', missingIndexes);

        const prevErrorQuery = query(
            collection(db, 'errorLogs'),
            where('timestamp', '>=', Timestamp.fromDate(twoWeeksAgo)),
            where('timestamp', '<', Timestamp.fromDate(weekAgo)),
            limit(500)
        );
        prevErrorLogs = await safeQuery(async () => {
            const snapshot = await getDocs(prevErrorQuery);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }, [], 'errorLogs', 'previous week errorLogs with timestamp filter', missingIndexes);
    } catch (error) {
        console.warn('⚠️ Error fetching previous week data:', error);
    }

    // ============================================================
    // 7. ERROR ANALYSIS
    // ============================================================
    const errorAnalysis = {
        totalErrors: errorLogs.length,
        errorsByType: {} as Record<string, number>,
        errorsByService: {} as Record<string, number>,
        topErrors: [] as Array<{
            message: string;
            count: number;
            lastOccurrence: Date;
            stackTrace?: string;
        }>,
        unresolvedErrors: 0
    };

    const errorMap = new Map<string, { count: number; lastOccurrence: Date; stackTrace?: string }>();
    
    errorLogs.forEach((log: any) => {
        try {
            const message = log.message || log.error?.message || 'Unknown error';
            const errorType = extractErrorPattern(message);
            const serviceName = extractServiceName(log.stack, log.context);
            
            // Count by type
            errorAnalysis.errorsByType[errorType] = (errorAnalysis.errorsByType[errorType] || 0) + 1;
            
            // Count by service
            errorAnalysis.errorsByService[serviceName] = (errorAnalysis.errorsByService[serviceName] || 0) + 1;
            
            // Track unresolved
            if (!log.resolved) {
                errorAnalysis.unresolvedErrors++;
            }
            
            // Group similar errors
            const key = `${errorType}:${message.substring(0, 100)}`;
            const existing = errorMap.get(key);
            
            // ✅ Safe date conversion
            let logTime: Date;
            try {
                logTime = log.timestamp?.toDate?.() || 
                         (log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000) : 
                         (log.timestamp ? new Date(log.timestamp) : new Date()));
            } catch {
                logTime = new Date();
            }
            
            if (existing) {
                existing.count++;
                if (logTime > existing.lastOccurrence) {
                    existing.lastOccurrence = logTime;
                }
            } else {
                errorMap.set(key, {
                    count: 1,
                    lastOccurrence: logTime,
                    stackTrace: log.stack || log.error?.stack
                });
            }
        } catch (err) {
            console.warn('⚠️ Error processing error log:', err);
        }
    });

    // Get top 10 errors
    errorAnalysis.topErrors = Array.from(errorMap.entries())
        .map(([key, data]) => ({
            message: key.split(':').slice(1).join(':'),
            count: data.count,
            lastOccurrence: data.lastOccurrence,
            stackTrace: data.stackTrace
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    // ============================================================
    // 8. PERFORMANCE ANALYSIS
    // ============================================================
    const performanceAnalysis = {
        averageResponseTime: 0,
        slowQueries: 0,
        failedQueries: 0,
        apiCallsCount: 0,
        averageApiResponseTime: 0,
        slowestEndpoints: [] as Array<{
            endpoint: string;
            avgTime: number;
            count: number;
        }>
    };

    // Analyze performance metrics
    const apiCalls = performanceMetrics.filter((m: any) => m.type === 'apiCall');
    performanceAnalysis.apiCallsCount = apiCalls.length;
    
    if (apiCalls.length > 0) {
        const totalTime = apiCalls.reduce((sum: number, m: any) => sum + (m.responseTime || 0), 0);
        performanceAnalysis.averageApiResponseTime = Math.round(totalTime / apiCalls.length);
        
        // Group by endpoint
        const endpointMap = new Map<string, { totalTime: number; count: number }>();
        apiCalls.forEach((m: any) => {
            const endpoint = m.endpoint || 'unknown';
            const existing = endpointMap.get(endpoint);
            if (existing) {
                existing.totalTime += m.responseTime || 0;
                existing.count++;
            } else {
                endpointMap.set(endpoint, {
                    totalTime: m.responseTime || 0,
                    count: 1
                });
            }
        });
        
        performanceAnalysis.slowestEndpoints = Array.from(endpointMap.entries())
            .map(([endpoint, data]) => ({
                endpoint,
                avgTime: Math.round(data.totalTime / data.count),
                count: data.count
            }))
            .sort((a, b) => b.avgTime - a.avgTime)
            .slice(0, 10);
    }

    // Analyze request performance
    const completedRequests = requests.filter((r: any) => {
        if (r.status !== 'completed') return false;
        if (!r.createdAt || !r.completedAt) return false;
        
        // ✅ Safe date conversion
        try {
            const start = r.createdAt?.toDate?.() || (r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : new Date(r.createdAt));
            const end = r.completedAt?.toDate?.() || (r.completedAt?.seconds ? new Date(r.completedAt.seconds * 1000) : new Date(r.completedAt));
            return start && end && !isNaN(start.getTime()) && !isNaN(end.getTime());
        } catch {
            return false;
        }
    });
    
    if (completedRequests.length > 0) {
        const durations = completedRequests
            .map((r: any) => {
                try {
                    const start = r.createdAt?.toDate?.() || (r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : new Date(r.createdAt));
                    const end = r.completedAt?.toDate?.() || (r.completedAt?.seconds ? new Date(r.completedAt.seconds * 1000) : new Date(r.completedAt));
                    const duration = (end.getTime() - start.getTime()) / 1000; // seconds
                    return duration > 0 && duration < 86400 ? duration : null; // Valid duration (0-24 hours)
                } catch {
                    return null;
                }
            })
            .filter((d: number | null): d is number => d !== null);
        
        if (durations.length > 0) {
            performanceAnalysis.averageResponseTime = Math.round(
                durations.reduce((a, b) => a + b, 0) / durations.length
            );
            performanceAnalysis.slowQueries = durations.filter((d: number) => d > 300).length; // > 5 minutes
        }
    }

    // ============================================================
    // 9. AGGREGATE ANOMALIES
    // ============================================================
    const anomalyMap: Map<string, { count: number; severity: string; messages: string[]; codes: string[]; stackTraces: string[] }> = new Map();
    let totalIssues = 0;
    let resolvedIssues = 0;
    let criticalIssues = 0;

    // From data_doctor_logs
    dataDoctorLogs.forEach((log: any) => {
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
                messages: [log.message || ''],
                codes: [],
                stackTraces: []
            });
        }
    });

    // From error logs
    errorLogs.forEach((log: any) => {
        if (log.level === 'error') {
            totalIssues++;
            if (!log.resolved) {
                criticalIssues++;
            }
            
            const errorType = extractErrorPattern(log.message || '');
            const existing = anomalyMap.get(`error:${errorType}`);
            if (existing) {
                existing.count++;
                if (!existing.messages.includes(log.message)) {
                    existing.messages.push(log.message);
                }
                if (log.stack && !existing.stackTraces.includes(log.stack)) {
                    existing.stackTraces.push(log.stack);
                }
            } else {
                anomalyMap.set(`error:${errorType}`, {
                    count: 1,
                    severity: 'high',
                    messages: [log.message || ''],
                    codes: [errorType],
                    stackTraces: log.stack ? [log.stack] : []
                });
            }
        }
    });

    // Convert to anomalies array
    const anomalies = Array.from(anomalyMap.entries()).map(([type, data]) => ({
        type,
        severity: data.severity as 'low' | 'medium' | 'high',
        message: data.messages[0] || `${data.count} حالة من نوع ${type}`,
        count: data.count,
        code: data.codes[0],
        stackTrace: data.stackTraces[0],
        context: {
            allMessages: data.messages,
            totalOccurrences: data.count
        }
    }));

    // ============================================================
    // 10. ACTIVITY TIMELINE
    // ============================================================
    const activityTimeline: Array<{
        timestamp: Date;
        event: string;
        type: 'error' | 'warning' | 'info' | 'success';
        details?: string;
    }> = [];

    // Add critical errors to timeline
    errorLogs
        .filter((log: any) => log.level === 'error')
        .slice(0, 50)
        .forEach((log: any) => {
            try {
                let timestamp: Date;
                try {
                    timestamp = log.timestamp?.toDate?.() || 
                               (log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000) : 
                               (log.timestamp ? new Date(log.timestamp) : new Date()));
                } catch {
                    timestamp = new Date();
                }
                
                activityTimeline.push({
                    timestamp,
                    event: log.message || 'Error occurred',
                    type: 'error',
                    details: log.stack
                });
            } catch (err) {
                console.warn('⚠️ Error adding error to timeline:', err);
            }
        });

    // Add data doctor alerts
    dataDoctorLogs
        .filter((log: any) => log.severity === 'high')
        .slice(0, 30)
        .forEach((log: any) => {
            try {
                let timestamp: Date;
                try {
                    timestamp = log.timestamp?.toDate?.() || 
                               (log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000) : 
                               (log.timestamp ? new Date(log.timestamp) : new Date()));
                } catch {
                    timestamp = new Date();
                }
                
                activityTimeline.push({
                    timestamp,
                    event: log.message || 'Data anomaly detected',
                    type: log.severity === 'high' ? 'error' : 'warning',
                    details: log.type
                });
            } catch (err) {
                console.warn('⚠️ Error adding data doctor log to timeline:', err);
            }
        });

    // Sort by timestamp
    activityTimeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // ============================================================
    // 11. CALCULATE METRICS
    // ============================================================
    const metrics: DataHealthMetric[] = [];

    // Data Doctor Metrics
    const cleaningLogs = dataDoctorLogs.filter((l: any) => l.type === 'quality');
    const prevCleaningLogs = prevDataDoctorLogs.filter((l: any) => l.type === 'quality').length;
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

    // Error Rate Metric
    const prevErrorCount = prevErrorLogs.length;
    const errorTrendPercent = prevErrorCount > 0
        ? Math.round(((errorLogs.length - prevErrorCount) / prevErrorCount) * 100)
        : 0;

    metrics.push({
        category: 'quality',
        label: 'إجمالي الأخطاء',
        value: errorLogs.length,
        previousValue: prevErrorCount,
        unit: 'خطأ',
        trend: errorTrendPercent > 0 ? 'up' : errorTrendPercent < 0 ? 'down' : 'stable',
        trendPercent: Math.abs(errorTrendPercent),
        status: errorLogs.length > 50 ? 'critical' : errorLogs.length > 20 ? 'warning' : 'good',
        details: `أخطاء غير محلولة: ${errorAnalysis.unresolvedErrors}`
    });

    // Performance Metric
    metrics.push({
        category: 'performance',
        label: 'متوسط وقت الاستجابة',
        value: performanceAnalysis.averageResponseTime,
        unit: 'ثانية',
        trend: performanceAnalysis.averageResponseTime > 60 ? 'up' : 'stable',
        status: performanceAnalysis.averageResponseTime > 300 ? 'critical' : performanceAnalysis.averageResponseTime > 120 ? 'warning' : 'good',
        details: `استعلامات بطيئة: ${performanceAnalysis.slowQueries}`
    });

    // API Performance
    if (performanceAnalysis.apiCallsCount > 0) {
        metrics.push({
            category: 'api',
            label: 'مكالمات API',
            value: performanceAnalysis.apiCallsCount,
            unit: 'مكالمة',
            trend: 'stable',
            status: performanceAnalysis.averageApiResponseTime > 2000 ? 'warning' : 'good',
            details: `متوسط وقت الاستجابة: ${performanceAnalysis.averageApiResponseTime}ms`
        });
    }

    // Security Metric
    const securityLogs = dataDoctorLogs.filter((l: any) => l.type === 'security');
    metrics.push({
        category: 'security',
        label: 'تنبيهات أمنية',
        value: securityLogs.length,
        unit: 'تنبيه',
        trend: 'stable',
        status: securityLogs.length > 0 ? 'critical' : 'good',
        details: securityLogs.length > 0 ? 'يوجد تنبيهات أمنية تحتاج مراجعة' : 'لا توجد تنبيهات'
    });

    // Connectivity Metric (from error logs)
    const connectivityErrors = errorLogs.filter((log: any) => 
        extractErrorPattern(log.message || '') === 'NETWORK_ERROR' ||
        log.message?.includes('network') ||
        log.message?.includes('connection')
    ).length;

    metrics.push({
        category: 'connectivity',
        label: 'مشاكل الاتصال',
        value: connectivityErrors,
        unit: 'خطأ',
        trend: 'stable',
        status: connectivityErrors > 10 ? 'critical' : connectivityErrors > 5 ? 'warning' : 'good',
        details: connectivityErrors > 0 ? 'تم رصد مشاكل في الاتصال بالشبكة' : 'الاتصال مستقر'
    });

    // Authentication Issues
    const authErrors = errorLogs.filter((log: any) => 
        extractErrorPattern(log.message || '') === 'UNAUTHENTICATED' ||
        log.message?.includes('auth') ||
        log.message?.includes('permission')
    ).length;

    metrics.push({
        category: 'authentication',
        label: 'مشاكل المصادقة',
        value: authErrors,
        unit: 'خطأ',
        trend: 'stable',
        status: authErrors > 20 ? 'critical' : authErrors > 10 ? 'warning' : 'good',
        details: authErrors > 0 ? 'تم رصد مشاكل في المصادقة' : 'المصادقة تعمل بشكل طبيعي'
    });

    // Database Performance
    const dbErrors = errorLogs.filter((log: any) => 
        extractErrorPattern(log.message || '') === 'MISSING_INDEX' ||
        log.message?.includes('index') ||
        log.message?.includes('query')
    ).length;

    metrics.push({
        category: 'database',
        label: 'مشاكل قاعدة البيانات',
        value: dbErrors,
        unit: 'خطأ',
        trend: 'stable',
        status: dbErrors > 5 ? 'warning' : 'good',
        details: dbErrors > 0 ? 'قد تحتاج إلى إنشاء indexes في Firestore' : 'قاعدة البيانات تعمل بشكل طبيعي'
    });

    // ============================================================
    // 12. CALCULATE OVERALL HEALTH SCORE
    // ============================================================
    let healthScore = 100;
    
    // Deduct for critical issues
    healthScore -= criticalIssues * 10;
    healthScore -= (totalIssues - resolvedIssues) * 2;
    
    // Deduct for errors
    if (errorLogs.length > 50) healthScore -= 20;
    else if (errorLogs.length > 20) healthScore -= 10;
    
    // Deduct for performance
    if (performanceAnalysis.averageResponseTime > 300) healthScore -= 15;
    else if (performanceAnalysis.averageResponseTime > 120) healthScore -= 5;
    
    // Deduct for unresolved errors
    if (errorAnalysis.unresolvedErrors > 10) healthScore -= 10;
    
    healthScore = Math.max(0, Math.min(100, healthScore));

    // ============================================================
    // 13. USER ACTIVITY STATISTICS
    // ============================================================
    const userActivity = {
        totalUsers: 0,
        activeUsers: 0,
        newUsers: 0,
        totalSessions: 0,
        averageSessionDuration: 0,
        requestsPerUser: 0,
        mostActiveUsers: [] as Array<{
            userId: string;
            userName: string;
            requestCount: number;
        }>
    };

    try {
        // Get users for this tenant
        const usersQuery = query(
            collection(db, 'users'),
            where('tenantId', '==', tenantId)
        );
        const usersSnapshot = await safeQuery(async () => await getDocs(usersQuery), { docs: [] }, 'users', 'users query for tenant', missingIndexes);
        userActivity.totalUsers = usersSnapshot.docs?.length || 0;

        // Get active users (users who created requests this week)
        const activeUserIds = new Set(requests.map((r: any) => r.createdBy?.id || r.userId).filter(Boolean));
        userActivity.activeUsers = activeUserIds.size;
        userActivity.requestsPerUser = activeUserIds.size > 0 ? Math.round(requests.length / activeUserIds.size) : 0;

        // Get most active users
        const userRequestCounts = new Map<string, { name: string; count: number }>();
        requests.forEach((r: any) => {
            const userId = r.createdBy?.id || r.userId;
            const userName = r.createdBy?.name || r.userName || 'غير معروف';
            if (userId) {
                const existing = userRequestCounts.get(userId);
                if (existing) {
                    existing.count++;
                } else {
                    userRequestCounts.set(userId, { name: userName, count: 1 });
                }
            }
        });
        userActivity.mostActiveUsers = Array.from(userRequestCounts.entries())
            .map(([userId, data]) => ({
                userId,
                userName: data.name,
                requestCount: data.count
            }))
            .sort((a, b) => b.requestCount - a.requestCount)
            .slice(0, 10);
    } catch (error) {
        console.warn('⚠️ Error calculating user activity:', error);
    }

    // ============================================================
    // 14. REQUEST STATISTICS
    // ============================================================
    const requestStatistics = {
        totalRequests: requests.length,
        requestsByType: {} as Record<string, number>,
        requestsByStatus: {} as Record<string, number>,
        averageCompletionTime: 0,
        fastestRequest: 0,
        slowestRequest: 0,
        requestsByDepartment: {} as Record<string, number>,
        peakHours: [] as Array<{ hour: number; count: number }>
    };

    // Analyze requests
    const completionTimes: number[] = [];
    const hourCounts = new Map<number, number>();

    requests.forEach((r: any) => {
        // By type
        const type = r.type || r.serviceType || 'unknown';
        requestStatistics.requestsByType[type] = (requestStatistics.requestsByType[type] || 0) + 1;

        // By status
        const status = r.status || 'unknown';
        requestStatistics.requestsByStatus[status] = (requestStatistics.requestsByStatus[status] || 0) + 1;

        // By department
        const dept = r.department || r.serviceType || 'unknown';
        requestStatistics.requestsByDepartment[dept] = (requestStatistics.requestsByDepartment[dept] || 0) + 1;

        // Completion time
        if (r.status === 'completed' && r.createdAt && r.completedAt) {
            try {
                const start = r.createdAt?.toDate?.() || (r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : new Date(r.createdAt));
                const end = r.completedAt?.toDate?.() || (r.completedAt?.seconds ? new Date(r.completedAt.seconds * 1000) : new Date(r.completedAt));
                const duration = (end.getTime() - start.getTime()) / 60000; // minutes
                if (duration > 0 && duration < 1440) {
                    completionTimes.push(duration);
                }
            } catch (e) {
                // Skip invalid dates
            }
        }

        // Peak hours
        if (r.createdAt) {
            try {
                const createdAt = r.createdAt?.toDate?.() || (r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : new Date(r.createdAt));
                const hour = createdAt.getHours();
                hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
            } catch (e) {
                // Skip invalid dates
            }
        }
    });

    if (completionTimes.length > 0) {
        requestStatistics.averageCompletionTime = Math.round(
            completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        );
        requestStatistics.fastestRequest = Math.round(Math.min(...completionTimes));
        requestStatistics.slowestRequest = Math.round(Math.max(...completionTimes));
    }

    requestStatistics.peakHours = Array.from(hourCounts.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // ============================================================
    // 15. DATABASE STATISTICS
    // ============================================================
    const databaseStatistics = {
        totalDocuments: 0,
        collections: {} as Record<string, { count: number; growth: number }>,
        totalReads: 0,
        totalWrites: 0,
        averageDocumentSize: 2048 // Estimated 2KB per document
    };

    try {
        // Count documents in main collections
        const collectionsToCheck = [
            { name: 'requests', path: `tenants/${tenantId}/requests` },
            { name: 'rooms', path: `tenants/${tenantId}/rooms` },
            { name: 'employees', path: `tenants/${tenantId}/employees` },
            { name: 'data_doctor_logs', path: 'data_doctor_logs' },
            { name: 'errorLogs', path: 'errorLogs' }
        ];

        for (const coll of collectionsToCheck) {
            try {
                const collQuery = query(collection(db, coll.path));
                const snapshot = await safeQuery(async () => await getDocs(collQuery), { docs: [] }, coll.name, `count query for ${coll.name}`, missingIndexes);
                const count = snapshot.docs?.length || 0;
                databaseStatistics.collections[coll.name] = {
                    count,
                    growth: 0 // Would need previous week data to calculate
                };
                databaseStatistics.totalDocuments += count;
            } catch (err) {
                console.warn(`⚠️ Error counting ${coll.name}:`, err);
            }
        }
    } catch (error) {
        console.warn('⚠️ Error calculating database statistics:', error);
    }

    // ============================================================
    // 16. FEATURE USAGE
    // ============================================================
    const featureUsage: Record<string, { usageCount: number; uniqueUsers: number; trend: 'up' | 'down' | 'stable' }> = {};

    // Analyze feature usage from requests
    const featureMap = new Map<string, Set<string>>(); // feature -> user IDs
    requests.forEach((r: any) => {
        const feature = r.type || r.serviceType || 'unknown';
        const userId = r.createdBy?.id || r.userId;
        if (userId) {
            if (!featureMap.has(feature)) {
                featureMap.set(feature, new Set());
            }
            featureMap.get(feature)!.add(userId);
        }
    });

    featureMap.forEach((users, feature) => {
        featureUsage[feature] = {
            usageCount: requests.filter((r: any) => (r.type || r.serviceType) === feature).length,
            uniqueUsers: users.size,
            trend: 'stable' // Would need previous week data
        };
    });

    // ============================================================
    // 17. SYSTEM RESOURCES (Estimated)
    // ============================================================
    const systemResources = {
        estimatedStorage: Math.round(databaseStatistics.totalDocuments * databaseStatistics.averageDocumentSize / 1024 / 1024), // MB
        estimatedReads: requests.length * 3 + errorLogs.length + dataDoctorLogs.length, // Rough estimate
        estimatedWrites: requests.length + errorLogs.length,
        cacheHitRate: 0 // Would need cache statistics
    };

    // ============================================================
    // 18. WEEK COMPARISON
    // ============================================================
    // Calculate previous week total issues
    const prevTotalIssues = prevDataDoctorLogs.length + prevErrorLogs.length;
    const prevTotalRequests = 0; // Would need to fetch previous week requests
    const prevTotalUsers = 0; // Would need to fetch previous week users
    
    const weekComparison = {
        issuesChange: prevTotalIssues > 0
            ? Math.round(((totalIssues - prevTotalIssues) / prevTotalIssues) * 100)
            : totalIssues > 0 ? 100 : 0,
        errorsChange: prevErrorLogs.length > 0
            ? Math.round(((errorLogs.length - prevErrorLogs.length) / prevErrorLogs.length) * 100)
            : errorLogs.length > 0 ? 100 : 0,
        performanceChange: 0, // Would need previous week performance data
        requestsChange: prevTotalRequests > 0
            ? Math.round(((requests.length - prevTotalRequests) / prevTotalRequests) * 100)
            : requests.length > 0 ? 100 : 0,
        usersChange: prevTotalUsers > 0
            ? Math.round(((userActivity.totalUsers - prevTotalUsers) / prevTotalUsers) * 100)
            : userActivity.totalUsers > 0 ? 100 : 0
    };

    // ============================================================
    // 19. GENERATE RECOMMENDATIONS
    // ============================================================
    const recommendations: string[] = [];
    
    if (cleaningLogs.length > 5) {
        recommendations.push('⚠️ مراجعة أداء فريق التنظيف - يوجد عدد كبير من حالات التنظيف المشبوهة');
    }
    
    if (criticalIssues > 0) {
        recommendations.push(`🚨 يوجد ${criticalIssues} حالات حرجة تحتاج تدخل فوري`);
    }
    
    if (errorAnalysis.unresolvedErrors > 10) {
        recommendations.push(`🔴 يوجد ${errorAnalysis.unresolvedErrors} خطأ غير محلول - يرجى المراجعة`);
    }
    
    if (errorAnalysis.topErrors.length > 0) {
        const topError = errorAnalysis.topErrors[0];
        recommendations.push(`📋 الخطأ الأكثر تكراراً: "${topError.message.substring(0, 50)}..." (${topError.count} مرة)`);
    }
    
    if (performanceAnalysis.averageResponseTime > 300) {
        recommendations.push('⏱️ وقت الاستجابة بطيء جداً - يرجى مراجعة استعلامات قاعدة البيانات');
    }
    
    if (performanceAnalysis.slowestEndpoints.length > 0) {
        const slowest = performanceAnalysis.slowestEndpoints[0];
        recommendations.push(`🐌 أبطأ endpoint: ${slowest.endpoint} (${slowest.avgTime}ms متوسط)`);
    }
    
    if (connectivityErrors > 10) {
        recommendations.push('🌐 مشاكل متكررة في الاتصال - يرجى التحقق من استقرار الشبكة');
    }
    
    if (authErrors > 20) {
        recommendations.push('🔐 مشاكل متكررة في المصادقة - يرجى مراجعة إعدادات الأمان');
    }
    
    if (dbErrors > 5) {
        recommendations.push('🗄️ قد تحتاج إلى إنشاء indexes في Firestore لتحسين الأداء');
    }
    
    if (errorAnalysis.errorsByService['requestService'] > 10) {
        recommendations.push('📝 مشاكل متكررة في خدمة الطلبات - يرجى المراجعة');
    }
    
    // User Activity Recommendations
    if (userActivity.requestsPerUser > 50) {
        recommendations.push(`👥 نشاط عالي: متوسط ${userActivity.requestsPerUser} طلب لكل مستخدم - النظام مستخدم بكثافة`);
    }
    
    if (userActivity.activeUsers === 0 && requests.length > 0) {
        recommendations.push('⚠️ لا يوجد مستخدمين نشطين رغم وجود طلبات - قد تكون هناك مشكلة في تتبع المستخدمين');
    }
    
    // Request Statistics Recommendations
    if (requestStatistics.averageCompletionTime > 60) {
        recommendations.push(`⏱️ متوسط وقت إتمام الطلبات: ${requestStatistics.averageCompletionTime} دقيقة - قد يحتاج تحسين`);
    }
    
    if (requestStatistics.peakHours.length > 0) {
        const peakHour = requestStatistics.peakHours[0];
        recommendations.push(`📊 ساعة الذروة: ${peakHour.hour}:00 (${peakHour.count} طلب) - يُنصح بزيادة الموارد في هذا الوقت`);
    }
    
    // Database Recommendations
    if (databaseStatistics.totalDocuments > 10000) {
        recommendations.push(`🗄️ قاعدة البيانات كبيرة: ${databaseStatistics.totalDocuments} مستند - يُنصح بمراجعة استراتيجية الأرشيف`);
    }
    
    if (systemResources.estimatedStorage > 100) {
        recommendations.push(`💾 التخزين المقدر: ${systemResources.estimatedStorage} MB - راقب استخدام Firebase Storage`);
    }
    
    // Week Comparison Recommendations
    if (weekComparison.errorsChange > 50) {
        recommendations.push(`📈 زيادة في الأخطاء: +${weekComparison.errorsChange}% مقارنة بالأسبوع الماضي - يحتاج مراجعة`);
    }
    
    if (weekComparison.issuesChange > 30) {
        recommendations.push(`📈 زيادة في المشاكل: +${weekComparison.issuesChange}% مقارنة بالأسبوع الماضي`);
    }
    
    // Feature Usage Recommendations
    const unusedFeatures = Object.entries(featureUsage).filter(([, data]) => data.usageCount === 0);
    if (unusedFeatures.length > 0) {
        recommendations.push(`🔍 ميزات غير مستخدمة: ${unusedFeatures.length} ميزة - يُنصح بمراجعة الفائدة منها`);
    }
    
    if (recommendations.length === 0) {
        recommendations.push('✅ أداء النظام ممتاز هذا الأسبوع! استمر على هذا المستوى 👍');
    }

    // ============================================================
    // 19. COLLECT CONSOLE ERRORS (Full copy of console output)
    // ============================================================
    const consoleErrors: ConsoleError[] = [];
    const errorsByLevel: Record<string, number> = {
        error: 0,
        warn: 0,
        info: 0,
        log: 0,
        debug: 0
    };
    
    try {
        // Get errors from localStorage (stored by errorHandlerService)
        const storedErrors = (typeof window !== 'undefined' && window.localStorage) ? localStorage.getItem('adora_errors') : null;
        if (storedErrors) {
            try {
                const errors = JSON.parse(storedErrors);
                if (Array.isArray(errors)) {
                    errors.forEach((err: any) => {
                        try {
                            const errorDate = err.timestamp ? new Date(err.timestamp) : new Date();
                            // Only include errors from the report period
                            if (errorDate >= weekAgo && errorDate <= now) {
                                const level = err.type === 'error' ? 'error' : 
                                            err.type === 'warning' ? 'warn' : 
                                            err.type === 'info' ? 'info' : 'log';
                                consoleErrors.push({
                                    level,
                                    message: err.message || 'Unknown error',
                                    timestamp: errorDate,
                                    stack: err.stack,
                                    source: err.filename ? `${err.filename}:${err.lineno}` : undefined,
                                    args: err.extra ? [err.extra] : undefined
                                });
                                errorsByLevel[level] = (errorsByLevel[level] || 0) + 1;
                            }
                        } catch (parseErr) {
                            // Skip invalid error entries
                        }
                    });
                }
            } catch (parseErr) {
                console.warn('⚠️ Failed to parse stored errors:', parseErr);
            }
        }
        
        // Also try to capture current console state (if available)
        // Note: This won't capture historical console output, only what's in storage
        try {
            // Check if there's a console log capture mechanism
            const consoleLogs = (typeof window !== 'undefined' && (window as any).__consoleLogs__) ? (window as any).__consoleLogs__ : [];
            if (Array.isArray(consoleLogs)) {
                consoleLogs.forEach((log: any) => {
                    try {
                        const logDate = log.timestamp ? new Date(log.timestamp) : new Date();
                        if (logDate >= weekAgo && logDate <= now) {
                            consoleErrors.push({
                                level: log.level || 'log',
                                message: log.message || '',
                                timestamp: logDate,
                                source: log.source,
                                args: log.args
                            });
                            errorsByLevel[log.level || 'log'] = (errorsByLevel[log.level || 'log'] || 0) + 1;
                        }
                    } catch (logErr) {
                        // Skip invalid log entries
                    }
                });
            }
        } catch (consoleCaptureErr) {
            // Console capture not available, ignore
        }
        
        // Sort by timestamp (newest first)
        consoleErrors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        // Create full console output text
        const fullConsoleOutput = consoleErrors.length > 0 ? consoleErrors.map(err => {
            const timeStr = err.timestamp.toISOString();
            const levelStr = err.level.toUpperCase().padEnd(5);
            const sourceStr = err.source ? ` [${err.source}]` : '';
            const messageStr = typeof err.message === 'string' ? err.message : JSON.stringify(err.message);
            const stackStr = err.stack ? `\n${err.stack}` : '';
            const argsStr = err.args && err.args.length > 0 ? `\nArgs: ${JSON.stringify(err.args, null, 2)}` : '';
            return `${timeStr} ${levelStr}${sourceStr} ${messageStr}${stackStr}${argsStr}`;
        }).join('\n\n') : 'لا توجد أخطاء في الكونسول في هذه الفترة';
        
    } catch (consoleErr) {
        console.warn('⚠️ Error collecting console errors:', consoleErr);
    }

    // ============================================================
    // 20. COLLECT SYSTEM INFORMATION
    // ============================================================
    const systemInfo: DataHealthReport['systemInfo'] = {
        browser: 'Unknown',
        browserVersion: 'Unknown',
        os: 'Unknown',
        screenSize: (typeof window !== 'undefined') ? `${window.screen.width}x${window.screen.height}` : 'Unknown',
        viewportSize: (typeof window !== 'undefined') ? `${window.innerWidth}x${window.innerHeight}` : 'Unknown',
        userAgent: (typeof navigator !== 'undefined') ? navigator.userAgent : 'Unknown',
        language: (typeof navigator !== 'undefined') ? navigator.language : 'Unknown',
        timezone: (typeof Intl !== 'undefined') ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Unknown',
        online: (typeof navigator !== 'undefined') ? navigator.onLine : false,
        cookieEnabled: (typeof navigator !== 'undefined') ? navigator.cookieEnabled : false,
        localStorageEnabled: (() => {
            if (typeof window === 'undefined' || !window.localStorage) return false;
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
                return true;
            } catch {
                return false;
            }
        })(),
        indexedDBEnabled: (typeof window !== 'undefined') ? 'indexedDB' in window : false,
        serviceWorkerEnabled: (typeof navigator !== 'undefined') ? 'serviceWorker' in navigator : false,
        pwaInstalled: (typeof window !== 'undefined') ? (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) : false
    };
    
    // Detect browser
    const ua = (typeof navigator !== 'undefined') ? navigator.userAgent : '';
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
        systemInfo.browser = 'Chrome';
        const match = ua.match(/Chrome\/(\d+)/);
        systemInfo.browserVersion = match ? match[1] : 'Unknown';
    } else if (ua.includes('Firefox')) {
        systemInfo.browser = 'Firefox';
        const match = ua.match(/Firefox\/(\d+)/);
        systemInfo.browserVersion = match ? match[1] : 'Unknown';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        systemInfo.browser = 'Safari';
        const match = ua.match(/Version\/(\d+)/);
        systemInfo.browserVersion = match ? match[1] : 'Unknown';
    } else if (ua.includes('Edg')) {
        systemInfo.browser = 'Edge';
        const match = ua.match(/Edg\/(\d+)/);
        systemInfo.browserVersion = match ? match[1] : 'Unknown';
    }
    
    // Detect OS
    if (ua.includes('Windows')) systemInfo.os = 'Windows';
    else if (ua.includes('Mac')) systemInfo.os = 'macOS';
    else if (ua.includes('Linux')) systemInfo.os = 'Linux';
    else if (ua.includes('Android')) systemInfo.os = 'Android';
    else if (ua.includes('iOS')) systemInfo.os = 'iOS';
    
    // Memory info (if available)
    if ((performance as any).memory) {
        systemInfo.memoryInfo = {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        };
    }
    
    // Connection info (if available)
    if ((navigator as any).connection) {
        const conn = (navigator as any).connection;
        systemInfo.connectionInfo = {
            effectiveType: conn.effectiveType,
            downlink: conn.downlink,
            rtt: conn.rtt,
            saveData: conn.saveData
        };
    }
    
    // ============================================================
    // 21. FIREBASE CONNECTION STATUS
    // ============================================================
    const firebaseStatus: DataHealthReport['firebaseStatus'] = {
        connected: !!db,
        connectionErrors: 0,
        readErrors: performanceAnalysis.failedQueries,
        writeErrors: 0, // Would need to track write errors separately
        cacheEnabled: true, // Firestore has cache enabled by default
        missingIndexes: missingIndexes, // ✅ FIX: Include tracked missing indexes
        indexWarnings: missingIndexes.length
    };
    
    // Try to get last connection time from Firestore
    try {
        if (db) {
            // Check if we can read from Firestore
            const testQuery = query(collection(db, 'system_configs'), limit(1));
            await getDocs(testQuery);
            firebaseStatus.connected = true;
        }
    } catch (err) {
        firebaseStatus.connected = false;
        firebaseStatus.connectionErrors++;
    }

    // ============================================================
    // 22. BUILD FINAL REPORT
    // ============================================================
    const report: DataHealthReport = {
        tenantId,
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
        errorAnalysis,
        performanceAnalysis,
        activityTimeline: activityTimeline.slice(0, 100), // Limit to 100 most recent
        userActivity,
        requestStatistics,
        databaseStatistics,
        featureUsage,
        systemResources,
        weekComparison,
        recommendations,
        consoleErrors: {
            total: consoleErrors.length,
            errors: consoleErrors.slice(0, 500), // Limit to 500 most recent
            errorsByLevel,
            lastError: consoleErrors.length > 0 ? consoleErrors[0].timestamp : undefined,
            fullConsoleOutput: consoleErrors.length > 0 ? consoleErrors.map(err => {
                const timeStr = err.timestamp.toISOString();
                const levelStr = err.level.toUpperCase().padEnd(5);
                const sourceStr = err.source ? ` [${err.source}]` : '';
                const messageStr = typeof err.message === 'string' ? err.message : JSON.stringify(err.message);
                const stackStr = err.stack ? `\n${err.stack}` : '';
                const argsStr = err.args && err.args.length > 0 ? `\nArgs: ${JSON.stringify(err.args, null, 2)}` : '';
                return `${timeStr} ${levelStr}${sourceStr} ${messageStr}${stackStr}${argsStr}`;
            }).join('\n\n') : 'لا توجد أخطاء في الكونسول في هذه الفترة'
        },
        systemInfo,
        firebaseStatus,
        viewed: false
    };
    
    // Only include branchId if it's defined
    if (branchId) {
        report.branchId = branchId;
    }

    console.log('✅ [Health Report] Comprehensive analysis completed', {
        totalIssues: report.totalIssues,
        totalErrors: report.errorAnalysis.totalErrors,
        healthScore: report.overallHealth
    });
    
    return report;
    } catch (error: any) {
        console.error('❌ [Health Report] Critical error during generation:', error);
        
        // Return a minimal report with error information
        const errorReport: DataHealthReport = {
            ...defaultReport as DataHealthReport,
            overallHealth: 0,
            recommendations: [
                `❌ فشل في إنشاء التقرير: ${error.message || 'خطأ غير معروف'}`,
                'يرجى التحقق من:',
                '1. اتصال Firebase',
                '2. صلاحيات الوصول',
                '3. وجود البيانات المطلوبة'
            ],
            errorAnalysis: {
                totalErrors: 1,
                errorsByType: { 'REPORT_GENERATION_ERROR': 1 },
                errorsByService: { 'dataHealthReportService': 1 },
                topErrors: [{
                    message: error.message || 'Unknown error during report generation',
                    count: 1,
                    lastOccurrence: new Date(),
                    stackTrace: error.stack
                }],
                unresolvedErrors: 1
            },
            userActivity: {
                totalUsers: 0,
                activeUsers: 0,
                newUsers: 0,
                totalSessions: 0,
                averageSessionDuration: 0,
                requestsPerUser: 0,
                mostActiveUsers: []
            },
            requestStatistics: {
                totalRequests: 0,
                requestsByType: {},
                requestsByStatus: {},
                averageCompletionTime: 0,
                fastestRequest: 0,
                slowestRequest: 0,
                requestsByDepartment: {},
                peakHours: []
            },
            databaseStatistics: {
                totalDocuments: 0,
                collections: {},
                totalReads: 0,
                totalWrites: 0,
                averageDocumentSize: 2048
            },
            featureUsage: {},
            systemResources: {
                estimatedStorage: 0,
                estimatedReads: 0,
                estimatedWrites: 0,
                cacheHitRate: 0
            },
            weekComparison: {
                issuesChange: 0,
                errorsChange: 0,
                performanceChange: 0,
                requestsChange: 0,
                usersChange: 0
            }
        };
        
        return errorReport;
    }
};

/**
 * Save and notify owner about the report
 */
export const saveAndNotifyReport = async (
    report: DataHealthReport,
    ownerId: string
): Promise<string> => {
    // ✅ CRITICAL: Null safety check
    if (!db) {
        throw new Error('Firebase Firestore is not initialized');
    }

    // ✅ Remove undefined fields before saving (Firestore doesn't accept undefined)
    const reportData: any = {
        tenantId: report.tenantId,
        reportPeriod: {
            start: Timestamp.fromDate(report.reportPeriod.start),
            end: Timestamp.fromDate(report.reportPeriod.end)
        },
        generatedAt: serverTimestamp(),
        overallHealth: report.overallHealth,
        totalIssues: report.totalIssues,
        resolvedIssues: report.resolvedIssues,
        criticalIssues: report.criticalIssues,
        metrics: report.metrics,
        anomalies: report.anomalies,
        errorAnalysis: report.errorAnalysis,
        performanceAnalysis: report.performanceAnalysis,
        activityTimeline: report.activityTimeline,
        recommendations: report.recommendations,
        viewed: report.viewed
    };
    
    // Only include branchId if it's defined
    if (report.branchId) {
        reportData.branchId = report.branchId;
    }
    
    try {
        // Save report
        const reportRef = await addDoc(collection(db, 'health_reports'), reportData);

        // Create notification for owner
        await addDoc(collection(db, 'ownerNotifications'), {
            ownerId,
            tenantId: report.tenantId,
            type: 'health_report',
            title: '📊 تقرير صحة البيانات الأسبوعي',
            message: `الحالة العامة: ${report.overallHealth}% - ${report.totalIssues} حالة - ${report.errorAnalysis.totalErrors} خطأ`,
            reportId: reportRef.id,
            read: false,
            createdAt: serverTimestamp()
        });

        console.log(`📊 Health report generated and saved: ${reportRef.id}`);
        return reportRef.id;
    } catch (saveError: any) {
        console.error('❌ [dataHealthReportService] Failed to save health report:', saveError);
        console.error('❌ Error details:', {
            code: saveError?.code,
            message: saveError?.message,
            stack: saveError?.stack
        });
        
        // ✅ Check if it's a permission error
        if (saveError?.code === 'permission-denied' || saveError?.message?.includes('permission')) {
            console.error('❌ Permission denied when saving health report. Check:');
            console.error('   1. Firestore Rules allow write for authenticated users');
            console.error('   2. Anonymous auth is enabled and user is signed in');
            console.error('   3. request.auth != null in Firestore Rules');
        }
        
        throw saveError;
    }
};

/**
 * Get recent health reports for a tenant
 */
export const getRecentHealthReports = async (
    tenantId: string,
    limitCount: number = 10
): Promise<DataHealthReport[]> => {
    // ✅ CRITICAL: Null safety check
    if (!db) {
        console.warn('⚠️ Firebase Firestore is not initialized');
        return [];
    }

    // ✅ DEBUG: Log tenantId being used
    console.log(`🔍 [dataHealthReportService] getRecentHealthReports called with tenantId: "${tenantId}"`);

    let snapshot: any;
    try {
        const q = query(
            collection(db, 'health_reports'),
            where('tenantId', '==', tenantId),
            orderBy('generatedAt', 'desc'),
            limit(limitCount)
        );

        console.log(`🔍 [dataHealthReportService] Attempting query with tenantId: "${tenantId}"`);
        snapshot = await getDocs(q);
        console.log(`✅ [dataHealthReportService] Query succeeded! Found ${snapshot.docs.length} reports`);
    } catch (queryError: any) {
        // ✅ Handle Firestore internal errors first
        if (queryError?.message?.includes('INTERNAL ASSERTION FAILED') || queryError?.message?.includes('Unexpected state')) {
            console.warn('⚠️ Firestore internal error in getRecentHealthReports - trying alternative queries...', queryError);
            // Try alternative queries
            try {
                // First try: without orderBy
                const altQuery1 = query(
                    collection(db, 'health_reports'),
                    where('tenantId', '==', tenantId),
                    limit(limitCount)
                );
                snapshot = await getDocs(altQuery1);
                // Sort manually
                snapshot.docs.sort((a: any, b: any) => {
                    const aTime = a.data().generatedAt?.toDate?.()?.getTime() || 0;
                    const bTime = b.data().generatedAt?.toDate?.()?.getTime() || 0;
                    return bTime - aTime; // Descending
                });
                console.log(`✅ [dataHealthReportService] Loaded ${snapshot.docs.length} health reports (internal error workaround 1)`);
            } catch (altError1: any) {
                // Check if it's also INTERNAL ASSERTION FAILED
                if (altError1?.message?.includes('INTERNAL ASSERTION FAILED') || altError1?.message?.includes('Unexpected state')) {
                    console.warn('⚠️ AltQuery1 also failed with INTERNAL ASSERTION FAILED, trying simpler queries...');
                }
                
                // Second try: without tenantId filter
                try {
                    console.log(`🔍 [dataHealthReportService] Trying query without tenantId filter...`);
                    const altQuery2 = query(
                        collection(db, 'health_reports'),
                        orderBy('generatedAt', 'desc'),
                        limit(limitCount * 2)
                    );
                    snapshot = await getDocs(altQuery2);
                    console.log(`🔍 [dataHealthReportService] Query without tenantId succeeded! Found ${snapshot.docs.length} total reports`);
                    // Filter by tenantId manually
                    const beforeFilter = snapshot.docs.length;
                    snapshot.docs = snapshot.docs
                        .filter((doc: any) => {
                            const docTenantId = doc.data().tenantId;
                            const matches = docTenantId === tenantId;
                            if (!matches && beforeFilter <= 5) {
                                console.log(`🔍 [dataHealthReportService] Report ${doc.id} has tenantId: "${docTenantId}" (looking for: "${tenantId}")`);
                            }
                            return matches;
                        })
                        .slice(0, limitCount);
                    console.log(`🔍 [dataHealthReportService] After filtering by tenantId "${tenantId}": ${snapshot.docs.length} reports`);
                    console.log(`✅ [dataHealthReportService] Loaded ${snapshot.docs.length} health reports (internal error workaround 2)`);
                } catch (altError2: any) {
                    // Check if it's also INTERNAL ASSERTION FAILED
                    if (altError2?.message?.includes('INTERNAL ASSERTION FAILED') || altError2?.message?.includes('Unexpected state')) {
                        console.warn('⚠️ AltQuery2 also failed with INTERNAL ASSERTION FAILED, trying simplest query...');
                    }
                    
                    // Third try: simplest query (no orderBy, no filters)
                    try {
                        console.log(`🔍 [dataHealthReportService] Trying simplest query (no filters, no orderBy)...`);
                        const altQuery3 = query(
                            collection(db, 'health_reports'),
                            limit(limitCount * 3)
                        );
                        snapshot = await getDocs(altQuery3);
                        console.log(`🔍 [dataHealthReportService] Simplest query succeeded! Found ${snapshot.docs.length} total reports`);
                        // Filter and sort manually
                        const beforeFilter = snapshot.docs.length;
                        snapshot.docs = snapshot.docs
                            .filter((doc: any) => {
                                const docTenantId = doc.data().tenantId;
                                const matches = docTenantId === tenantId;
                                if (!matches && beforeFilter <= 5) {
                                    console.log(`🔍 [dataHealthReportService] Report ${doc.id} has tenantId: "${docTenantId}" (looking for: "${tenantId}")`);
                                }
                                return matches;
                            })
                            .sort((a: any, b: any) => {
                                const aTime = a.data().generatedAt?.toDate?.()?.getTime() || 0;
                                const bTime = b.data().generatedAt?.toDate?.()?.getTime() || 0;
                                return bTime - aTime;
                            })
                            .slice(0, limitCount);
                        console.log(`🔍 [dataHealthReportService] After filtering and sorting: ${snapshot.docs.length} reports`);
                        console.log(`✅ [dataHealthReportService] Loaded ${snapshot.docs.length} health reports (internal error workaround 3)`);
                    } catch (altError3: any) {
                        // Check if it's INTERNAL ASSERTION FAILED or permission-denied
                        const isInternalError = altError3?.message?.includes('INTERNAL ASSERTION FAILED') || altError3?.message?.includes('Unexpected state');
                        const isPermissionError = altError3?.code === 'permission-denied' || 
                                                  altError3?.message?.includes('permission') ||
                                                  altError3?.message?.includes('Missing or insufficient');
                        
                        if (isInternalError) {
                            console.error('❌ All queries failed with INTERNAL ASSERTION FAILED - this is a Firestore SDK cache issue. Try refreshing the page.');
                        } else if (isPermissionError) {
                            console.error('❌ All queries failed with permission-denied - check Firestore Rules and userBinding for owner role.');
                        } else {
                            console.error('❌ All alternative queries failed for health reports:', altError3);
                        }
                        return [];
                    }
                }
            }
        }
        // ✅ Handle missing index gracefully
        else if (queryError?.code === 'failed-precondition' || queryError?.message?.includes('index')) {
            console.warn('⚠️ Firestore index missing for health_reports. Using fallback query...');
            // Fallback: query without orderBy
            const fallbackQuery = query(
                collection(db, 'health_reports'),
                where('tenantId', '==', tenantId),
                limit(limitCount)
            );
            snapshot = await getDocs(fallbackQuery);
            // Sort manually
            snapshot.docs.sort((a: any, b: any) => {
                const aTime = a.data().generatedAt?.toDate?.()?.getTime() || 0;
                const bTime = b.data().generatedAt?.toDate?.()?.getTime() || 0;
                return bTime - aTime; // Descending
            });
        } else {
            // ✅ Handle permission errors gracefully
            const isPermissionError = queryError?.code === 'permission-denied' || 
                                      queryError?.message?.includes('permission') ||
                                      queryError?.message?.includes('Missing or insufficient');
            
            if (isPermissionError) {
                console.warn('⚠️ Permission denied for health reports - trying alternative query...', queryError);
                
                // ✅ Try alternative query: For owner, try without tenantId filter or without orderBy
                try {
                    // First try: without orderBy (might be index issue)
                    const altQuery1 = query(
                        collection(db, 'health_reports'),
                        where('tenantId', '==', tenantId),
                        limit(limitCount)
                    );
                    snapshot = await getDocs(altQuery1);
                    // Sort manually
                    snapshot.docs.sort((a: any, b: any) => {
                        const aTime = a.data().generatedAt?.toDate?.()?.getTime() || 0;
                        const bTime = b.data().generatedAt?.toDate?.()?.getTime() || 0;
                        return bTime - aTime; // Descending
                    });
                    console.log(`✅ [dataHealthReportService] Loaded ${snapshot.docs.length} health reports (alternative query 1)`);
                } catch (altError1: any) {
                    // Second try: without tenantId filter (for owner access to all reports)
                    try {
                        console.log(`🔍 [dataHealthReportService] Trying query without tenantId filter (permission workaround)...`);
                        const altQuery2 = query(
                            collection(db, 'health_reports'),
                            orderBy('generatedAt', 'desc'),
                            limit(limitCount * 2) // Get more to filter by tenantId in code
                        );
                        snapshot = await getDocs(altQuery2);
                        console.log(`🔍 [dataHealthReportService] Query without tenantId filter succeeded! Found ${snapshot.docs.length} total reports`);
                        // Filter by tenantId manually
                        const beforeFilter = snapshot.docs.length;
                        snapshot.docs = snapshot.docs
                            .filter((doc: any) => {
                                const docTenantId = doc.data().tenantId;
                                const matches = docTenantId === tenantId;
                                if (!matches && beforeFilter <= 5) {
                                    console.log(`🔍 [dataHealthReportService] Report ${doc.id} has tenantId: "${docTenantId}" (looking for: "${tenantId}")`);
                                }
                                return matches;
                            })
                            .slice(0, limitCount);
                        console.log(`🔍 [dataHealthReportService] After filtering by tenantId "${tenantId}": ${snapshot.docs.length} reports`);
                        // Sort manually
                        snapshot.docs.sort((a: any, b: any) => {
                            const aTime = a.data().generatedAt?.toDate?.()?.getTime() || 0;
                            const bTime = b.data().generatedAt?.toDate?.()?.getTime() || 0;
                            return bTime - aTime; // Descending
                        });
                        console.log(`✅ [dataHealthReportService] Loaded ${snapshot.docs.length} health reports (alternative query 2 - owner access)`);
                    } catch (altError2: any) {
                        // Third try: simplest query (no filters, no orderBy)
                        try {
                            const altQuery3 = query(
                                collection(db, 'health_reports'),
                                limit(limitCount * 3) // Get more to filter in code
                            );
                            snapshot = await getDocs(altQuery3);
                            // Filter by tenantId and sort manually
                            snapshot.docs = snapshot.docs
                                .filter((doc: any) => doc.data().tenantId === tenantId)
                                .sort((a: any, b: any) => {
                                    const aTime = a.data().generatedAt?.toDate?.()?.getTime() || 0;
                                    const bTime = b.data().generatedAt?.toDate?.()?.getTime() || 0;
                                    return bTime - aTime; // Descending
                                })
                                .slice(0, limitCount);
                            console.log(`✅ [dataHealthReportService] Loaded ${snapshot.docs.length} health reports (alternative query 3 - simplest)`);
                        } catch (altError3: any) {
                            console.error('❌ All alternative queries failed for health reports:', altError3);
                            return [];
                        }
                    }
                }
            } else {
                console.error('❌ Error fetching health reports:', queryError);
                return [];
            }
        }
    }

    return snapshot.docs.map((doc: any) => {
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
    // ✅ CRITICAL: Null safety check
    if (!db) {
        console.warn('⚠️ Firebase Firestore is not initialized');
        return;
    }

    try {
        await updateDoc(doc(db, 'health_reports', reportId), {
            viewed: true,
            viewedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('❌ Error marking report as viewed:', error);
        // Don't throw - this is not critical
    }
};

/**
 * Schedule weekly reports (to be called by a cron/cloud function)
 * For client-side, this can be triggered manually or on app load
 */
export const checkAndGenerateWeeklyReport = async (
    tenantId: string,
    ownerId: string
): Promise<boolean> => {
    // ✅ CRITICAL: Null safety check
    if (!db) {
        console.warn('⚠️ Firebase Firestore is not initialized');
        return false;
    }

    // Check if a report was generated in the last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    let snapshot: any;
    try {
        const q = query(
            collection(db, 'health_reports'),
            where('tenantId', '==', tenantId),
            where('generatedAt', '>=', Timestamp.fromDate(weekAgo)),
            limit(1)
        );

        snapshot = await getDocs(q);
    } catch (queryError: any) {
        // ✅ Handle missing index gracefully
        if (queryError?.code === 'failed-precondition' || queryError?.message?.includes('index')) {
            console.warn('⚠️ Firestore index missing. Checking reports without date filter...');
            // Fallback: check all reports for tenant and filter manually
            const fallbackQuery = query(
                collection(db, 'health_reports'),
                where('tenantId', '==', tenantId),
                limit(10)
            );
            snapshot = await getDocs(fallbackQuery);
            // Filter manually
            snapshot.docs = snapshot.docs.filter((doc: any) => {
                const generatedAt = doc.data().generatedAt?.toDate?.();
                return generatedAt && generatedAt >= weekAgo;
            });
        } else {
            // ✅ Handle permission errors - try alternative queries
            const isPermissionError = queryError?.code === 'permission-denied' || 
                                      queryError?.message?.includes('permission') ||
                                      queryError?.message?.includes('Missing or insufficient');
            
            if (isPermissionError) {
                console.warn('⚠️ Permission denied for checking health reports - trying alternative query...', queryError);
                try {
                    // Try without date filter
                    const altQuery = query(
                        collection(db, 'health_reports'),
                        where('tenantId', '==', tenantId),
                        limit(10)
                    );
                    snapshot = await getDocs(altQuery);
                    // Filter manually by date
                    snapshot.docs = snapshot.docs.filter((doc: any) => {
                        const generatedAt = doc.data().generatedAt?.toDate?.();
                        return generatedAt && generatedAt >= weekAgo;
                    });
                    console.log(`✅ [dataHealthReportService] Checked reports using alternative query`);
                } catch (altError: any) {
                    console.error('❌ Alternative query also failed for checking reports:', altError);
                    return false;
                }
            } else {
                console.error('❌ Error checking for existing reports:', queryError);
                return false;
            }
        }
    }

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
