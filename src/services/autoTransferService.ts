/**
 * Auto Transfer Service
 * Automatically transfer overdue requests to backup departments
 * Adora Hotel Management System V2
 */

import {
    collection,
    query,
    where,
    onSnapshot,
    updateDoc,
    doc,
    Timestamp,
    getDocs,
    Unsubscribe,
    writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { transferRequestToDepartment, getRequest } from './requestService';

// ============================================================
// TYPES
// ============================================================

export interface AutoTransferRule {
    fromDepartment: string;
    toDepartment: string; // Backup department
    timeoutMinutes: number; // Minutes before auto-transfer
    enabled: boolean;
    requestTypes?: string[]; // Optional: specific request types only
    sources?: string[]; // Optional: specific sources only (e.g., 'qr', 'reception')
}

export interface AutoTransferConfig {
    enabled: boolean;
    checkIntervalMs: number; // How often to check (default: 60000 = 1 minute)
    rules: AutoTransferRule[];
    branch: string;
    tenantId: string;
}

// ============================================================
// STATE
// ============================================================

let checkInterval: ReturnType<typeof setInterval> | null = null;
let unsubscribe: Unsubscribe | null = null;
let currentConfig: AutoTransferConfig | null = null;
let monitoredRequests: Map<string, any> = new Map(); // requestId -> request data

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Start auto-transfer monitoring
 */
export const startAutoTransfer = async (
    branchId: string,
    tenantId: string
): Promise<void> => {
    try {
        // Load configuration
        const config = await loadAutoTransferConfig(branchId, tenantId);
        
        if (!config || !config.enabled) {
            console.log('🔄 Auto-transfer is disabled');
            stopAutoTransfer();
            return;
        }

        currentConfig = config;

        // Stop existing monitoring
        stopAutoTransfer();

        // Listen to active requests
        const requestsRef = collection(db, 'requests');
        const q = query(
            requestsRef,
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('status', 'in', ['PENDING_RECEPTION', 'CONFIRMED', 'IN_PROGRESS'])
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
            monitoredRequests.clear();
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                monitoredRequests.set(docSnap.id, {
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    departmentEnteredAt: getDepartmentEntryTime(data),
                });
            });

            // Check immediately on update
            checkAndTransfer();
        });

        // Start periodic checks
        checkInterval = setInterval(() => {
            checkAndTransfer();
        }, config.checkIntervalMs || 60000);

        console.log('🔄 Auto-transfer monitoring started');
    } catch (error) {
        console.error('Error starting auto-transfer:', error);
    }
};

/**
 * Stop auto-transfer monitoring
 */
export const stopAutoTransfer = (): void => {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }

    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }

    monitoredRequests.clear();
    currentConfig = null;
};

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Load auto-transfer configuration
 */
export const loadAutoTransferConfig = async (
    branchId: string,
    tenantId: string
): Promise<AutoTransferConfig | null> => {
    try {
        const { getDoc } = await import('firebase/firestore');
        const configRef = doc(db, 'settings', `autoTransfer_${branchId}`);
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            const data = configSnap.data();
            return {
                enabled: data.enabled ?? true,
                checkIntervalMs: data.checkIntervalMs || 60000,
                rules: data.rules || [],
                branch: branchId,
                tenantId,
            };
        }

        // Return default config if not exists
        return {
            enabled: false,
            checkIntervalMs: 60000,
            rules: [],
            branch: branchId,
            tenantId,
        };
    } catch (error) {
        console.error('Error loading auto-transfer config:', error);
        return null;
    }
};

/**
 * Save auto-transfer configuration
 */
export const saveAutoTransferConfig = async (
    config: AutoTransferConfig
): Promise<void> => {
    try {
        const { setDoc } = await import('firebase/firestore');
        const configRef = doc(db, 'settings', `autoTransfer_${config.branch}`);
        await setDoc(configRef, {
            enabled: config.enabled,
            checkIntervalMs: config.checkIntervalMs,
            rules: config.rules,
            tenantId: config.tenantId,
            updatedAt: Timestamp.now(),
        }, { merge: true });

        // Reload if currently monitoring
        if (currentConfig && currentConfig.branch === config.branch) {
            await startAutoTransfer(config.branch, config.tenantId);
        }
    } catch (error) {
        console.error('Error saving auto-transfer config:', error);
        throw error;
    }
};

// ============================================================
// TRANSFER LOGIC
// ============================================================

/**
 * Get the time when request entered current department
 */
const getDepartmentEntryTime = (request: any): Date => {
    if (request.departmentHistory && request.departmentHistory.length > 0) {
        const lastEntry = request.departmentHistory[request.departmentHistory.length - 1];
        if (lastEntry.enteredAt) {
            return lastEntry.enteredAt.toDate ? lastEntry.enteredAt.toDate() : new Date(lastEntry.enteredAt);
        }
    }
    // Fallback to creation time
    return request.createdAt?.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
};

/**
 * Check if request matches rule
 */
const matchesRule = (request: any, rule: AutoTransferRule): boolean => {
    // Check department
    if (request.currentDepartment !== rule.fromDepartment) {
        return false;
    }

    // Check request type if specified
    if (rule.requestTypes && rule.requestTypes.length > 0) {
        if (!rule.requestTypes.includes(request.type)) {
            return false;
        }
    }

    // Check source if specified
    if (rule.sources && rule.sources.length > 0) {
        const requestSource = request.source?.toLowerCase() || '';
        if (!rule.sources.some(s => requestSource.includes(s.toLowerCase()))) {
            return false;
        }
    }

    return true;
};

/**
 * Check requests and perform auto-transfers
 */
const checkAndTransfer = async (): Promise<void> => {
    if (!currentConfig || !currentConfig.enabled) return;

    const now = new Date();
    const transfers: Array<{ requestId: string; rule: AutoTransferRule; request: any }> = [];

    // Find requests that need transfer
    monitoredRequests.forEach((request) => {
        const departmentEntryTime = request.departmentEnteredAt || request.createdAt;
        const elapsedMinutes = Math.floor((now.getTime() - departmentEntryTime.getTime()) / (1000 * 60));

        // Check each rule
        for (const rule of currentConfig!.rules) {
            if (!rule.enabled) continue;
            if (!matchesRule(request, rule)) continue;
            if (elapsedMinutes >= rule.timeoutMinutes) {
                transfers.push({ requestId: request.id, rule, request });
                break; // Only transfer once per request
            }
        }
    });

    // Perform transfers
    if (transfers.length > 0) {
        console.log(`🔄 Auto-transferring ${transfers.length} request(s)`);
        
        const batch = writeBatch(db);

        for (const { requestId, rule, request } of transfers) {
            try {
                // Transfer to backup department
                await transferRequestToDepartment(
                    requestId,
                    rule.fromDepartment,
                    rule.toDepartment,
                    'AUTO_TRANSFER_SYSTEM',
                    'نظام التحويل التلقائي',
                    undefined,
                    `تحويل تلقائي: تأخر الطلب في ${rule.fromDepartment} لمدة ${rule.timeoutMinutes} دقيقة`
                );

                // Log to request notes
                const requestRef = doc(db, 'requests', requestId);
                const currentNotes = request.notes || '';
                batch.update(requestRef, {
                    notes: currentNotes + `\n[نظام التحويل التلقائي] تم التحويل من ${rule.fromDepartment} إلى ${rule.toDepartment} بعد ${rule.timeoutMinutes} دقيقة`,
                    autoTransferred: true,
                    autoTransferredAt: Timestamp.now(),
                    autoTransferredFrom: rule.fromDepartment,
                    autoTransferredTo: rule.toDepartment,
                });

                console.log(`✅ Auto-transferred request ${requestId} from ${rule.fromDepartment} to ${rule.toDepartment}`);
            } catch (error) {
                console.error(`❌ Error auto-transferring request ${requestId}:`, error);
            }
        }

        await batch.commit();
    }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get default rules template
 */
export const getDefaultRules = (): AutoTransferRule[] => {
    return [
        {
            fromDepartment: 'housekeeping',
            toDepartment: 'bellman',
            timeoutMinutes: 30,
            enabled: false,
        },
        {
            fromDepartment: 'reception',
            toDepartment: 'housekeeping',
            timeoutMinutes: 10,
            enabled: false,
            sources: ['qr'], // Only for QR requests
        },
    ];
};
