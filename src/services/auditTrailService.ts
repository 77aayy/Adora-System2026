/**
 * Audit Trail Service
 * Migrated from audit-trail.js with TypeScript
 * Adora Hotel Management System V2
 * 
 * Provides immutable logging for:
 * - Financial transactions
 * - Settlements (no deletions allowed)
 * - Modifications (before/after values)
 * - Access attempts
 */

import { db } from './firebase';
import {
    collection, addDoc, getDocs, updateDoc, doc,
    query, where, orderBy, limit, serverTimestamp, Timestamp
} from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

export type AuditLogType =
    | 'financial_transaction'
    | 'settlement'
    | 'modification'
    | 'access'
    | 'action'
    | 'error'
    | 'security';

export interface AuditLogEntry {
    id?: string;
    type: AuditLogType;
    action: string;
    timestamp?: any;
    staffId: string;
    staffName: string;
    role: string;
    branch?: string;
    immutable: boolean;
    metadata?: Record<string, any>;
}

export interface TransactionLog extends AuditLogEntry {
    type: 'financial_transaction';
    amount: number;
    chargeId?: string;
    room?: string;
    description?: string;
}

export interface SettlementLog extends AuditLogEntry {
    type: 'settlement';
    originalChargeId: string;
    originalAmount: number;
    settledAmount: number;
    difference: number;
    reason: string;
    room?: string;
}

export interface ModificationLog extends AuditLogEntry {
    type: 'modification';
    collection: string;
    documentId: string;
    field: string;
    valueBefore: any;
    valueAfter: any;
    reason?: string;
}

export interface AuditFilters {
    branch?: string;
    staffId?: string;
    type?: AuditLogType;
    dateFrom?: Date;
    dateTo?: Date;
    action?: string;
}

export interface SessionData {
    employeeId?: string;
    employeeName?: string;
    employeeCode?: string;
    department?: string;
    branchId?: string;
    branchCode?: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get current session data
 */
const getSession = (): SessionData => {
    try {
        const session = localStorage.getItem('adora_session') ||
            sessionStorage.getItem('adora_session') || '{}';
        return JSON.parse(session);
    } catch {
        return {};
    }
};

/**
 * Format timestamp
 */
export const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// ============================================================
// AUDIT TRAIL CLASS
// ============================================================

class AuditTrailManager {
    private logBuffer: AuditLogEntry[] = [];
    private batchSize = 10;
    private batchTimeout: NodeJS.Timeout | null = null;

    /**
     * Log a financial transaction (immutable)
     */
    async logTransaction(transaction: Partial<TransactionLog>): Promise<void> {
        try {
            const session = getSession();

            const log: TransactionLog = {
                type: 'financial_transaction',
                action: transaction.action || 'transaction',
                amount: transaction.amount || 0,
                chargeId: transaction.chargeId,
                room: transaction.room,
                description: transaction.description,
                timestamp: serverTimestamp(),
                staffId: session.employeeCode || session.employeeId || 'unknown',
                staffName: session.employeeName || 'Unknown',
                role: session.department || 'staff',
                branch: session.branchCode || session.branchId,
                immutable: true,
                metadata: transaction.metadata
            };

            await addDoc(collection(db, 'audit_logs'), log);
            console.log('✅ Transaction logged:', transaction.action);
        } catch (error) {
            console.error('Log transaction error:', error);
        }
    }

    /**
     * Log a settlement (instead of deletion)
     */
    async logSettlement(settlementData: {
        originalChargeId: string;
        originalAmount: number;
        settledAmount: number;
        reason: string;
        room?: string;
    }): Promise<SettlementLog> {
        const session = getSession();

        const log: SettlementLog = {
            type: 'settlement',
            action: 'settlement',
            originalChargeId: settlementData.originalChargeId,
            originalAmount: settlementData.originalAmount,
            settledAmount: settlementData.settledAmount,
            difference: settlementData.originalAmount - settlementData.settledAmount,
            reason: settlementData.reason,
            room: settlementData.room,
            timestamp: serverTimestamp(),
            staffId: session.employeeCode || session.employeeId || 'unknown',
            staffName: session.employeeName || 'Unknown',
            role: session.department || 'reception',
            branch: session.branchCode || session.branchId,
            immutable: true
        };

        // Save to audit logs
        await addDoc(collection(db, 'audit_logs'), log);

        // Update original charge (not delete)
        if (settlementData.originalChargeId) {
            await updateDoc(doc(db, 'financial_charges', settlementData.originalChargeId), {
                settled: true,
                settledAmount: settlementData.settledAmount,
                settledAt: serverTimestamp(),
                settledBy: session.employeeCode || session.employeeId,
                settlementReason: settlementData.reason
            });
        }

        console.log('✅ Settlement logged');
        return log;
    }

    /**
     * Log a modification (with before/after values)
     */
    async logModification(modificationData: {
        collection: string;
        documentId: string;
        field: string;
        valueBefore: any;
        valueAfter: any;
        reason?: string;
    }): Promise<void> {
        try {
            const session = getSession();

            const log: ModificationLog = {
                type: 'modification',
                action: 'modification',
                collection: modificationData.collection,
                documentId: modificationData.documentId,
                field: modificationData.field,
                valueBefore: modificationData.valueBefore,
                valueAfter: modificationData.valueAfter,
                reason: modificationData.reason,
                timestamp: serverTimestamp(),
                staffId: session.employeeCode || session.employeeId || 'unknown',
                staffName: session.employeeName || 'Unknown',
                role: session.department || 'staff',
                branch: session.branchCode || session.branchId,
                immutable: true
            };

            await addDoc(collection(db, 'audit_logs'), log);
            console.log('✅ Modification logged');
        } catch (error) {
            console.error('Log modification error:', error);
        }
    }

    /**
     * Log an action
     */
    async logAction(action: string, details?: Record<string, any>): Promise<void> {
        try {
            const session = getSession();

            const log: AuditLogEntry = {
                type: 'action',
                action: action,
                timestamp: serverTimestamp(),
                staffId: session.employeeCode || session.employeeId || 'unknown',
                staffName: session.employeeName || 'Unknown',
                role: session.department || 'staff',
                branch: session.branchCode || session.branchId,
                immutable: true,
                metadata: details
            };

            await addDoc(collection(db, 'audit_logs'), log);
        } catch (error) {
            console.error('Log action error:', error);
        }
    }

    /**
     * Log attempted deletion (prevented)
     */
    async logAttemptedDeletion(chargeData: {
        id: string;
        amount: number;
        description?: string;
        room?: string;
    }): Promise<void> {
        await this.logTransaction({
            action: 'attempted_deletion',
            chargeId: chargeData.id,
            amount: chargeData.amount,
            description: chargeData.description,
            room: chargeData.room,
            metadata: { prevented: true }
        });
    }

    /**
     * Get audit logs with filters
     */
    async getLogs(filters: AuditFilters = {}): Promise<AuditLogEntry[]> {
        try {
            const constraints: any[] = [];

            if (filters.branch) {
                constraints.push(where('branch', '==', filters.branch));
            }

            if (filters.staffId) {
                constraints.push(where('staffId', '==', filters.staffId));
            }

            if (filters.type) {
                constraints.push(where('type', '==', filters.type));
            }

            if (filters.dateFrom) {
                constraints.push(where('timestamp', '>=', Timestamp.fromDate(filters.dateFrom)));
            }

            if (filters.dateTo) {
                constraints.push(where('timestamp', '<=', Timestamp.fromDate(filters.dateTo)));
            }

            constraints.push(orderBy('timestamp', 'desc'));
            constraints.push(limit(100));

            const logsQuery = query(collection(db, 'audit_logs'), ...constraints);
            const snapshot = await getDocs(logsQuery);

            const logs: AuditLogEntry[] = [];
            snapshot.forEach(doc => {
                logs.push({ id: doc.id, ...doc.data() } as AuditLogEntry);
            });

            return logs;
        } catch (error) {
            console.error('Get logs error:', error);
            return [];
        }
    }

    /**
     * Get logs for a specific document
     */
    async getDocumentHistory(collectionName: string, documentId: string): Promise<AuditLogEntry[]> {
        try {
            const logsQuery = query(
                collection(db, 'audit_logs'),
                where('documentId', '==', documentId),
                where('collection', '==', collectionName),
                orderBy('timestamp', 'desc')
            );

            const snapshot = await getDocs(logsQuery);
            const logs: AuditLogEntry[] = [];

            snapshot.forEach(doc => {
                logs.push({ id: doc.id, ...doc.data() } as AuditLogEntry);
            });

            return logs;
        } catch (error) {
            console.error('Get document history error:', error);
            return [];
        }
    }

    /**
     * Get settlement logs for a charge
     */
    async getSettlementsForCharge(chargeId: string): Promise<SettlementLog[]> {
        try {
            const logsQuery = query(
                collection(db, 'audit_logs'),
                where('originalChargeId', '==', chargeId),
                where('type', '==', 'settlement'),
                orderBy('timestamp', 'desc')
            );

            const snapshot = await getDocs(logsQuery);
            const logs: SettlementLog[] = [];

            snapshot.forEach(doc => {
                logs.push({ id: doc.id, ...doc.data() } as SettlementLog);
            });

            return logs;
        } catch (error) {
            console.error('Get settlements error:', error);
            return [];
        }
    }

    /**
     * Get logs summary for a period
     */
    async getLogsSummary(branchId: string, days: number = 7): Promise<{
        total: number;
        byType: Record<string, number>;
        byStaff: Record<string, number>;
    }> {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);

        const logs = await this.getLogs({
            branch: branchId,
            dateFrom: fromDate
        });

        const summary = {
            total: logs.length,
            byType: {} as Record<string, number>,
            byStaff: {} as Record<string, number>
        };

        logs.forEach(log => {
            // By type
            summary.byType[log.type] = (summary.byType[log.type] || 0) + 1;

            // By staff
            const staffKey = log.staffName || log.staffId;
            summary.byStaff[staffKey] = (summary.byStaff[staffKey] || 0) + 1;
        });

        return summary;
    }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const auditTrail = new AuditTrailManager();

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback, useEffect } from 'react';

interface UseAuditTrailReturn {
    logs: AuditLogEntry[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    logAction: (action: string, details?: Record<string, any>) => Promise<void>;
}

export const useAuditTrail = (
    filters: AuditFilters = {},
    autoLoad: boolean = true
): UseAuditTrailReturn => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await auditTrail.getLogs(filters);
            setLogs(data);
        } catch (err: any) {
            setError(err.message || 'حدث خطأ في تحميل السجلات');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        if (autoLoad) {
            refresh();
        }
    }, [autoLoad, refresh]);

    const logAction = useCallback(async (action: string, details?: Record<string, any>) => {
        await auditTrail.logAction(action, details);
        await refresh();
    }, [refresh]);

    return {
        logs,
        loading,
        error,
        refresh,
        logAction
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Instance
    auditTrail,

    // Helper
    formatTimestamp,

    // Hook
    useAuditTrail
};
