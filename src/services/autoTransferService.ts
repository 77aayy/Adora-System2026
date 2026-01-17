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

        // ✅ SECURITY FIX: Use tenant-scoped collection
        if (!db) {
            console.error('🔄 Auto-transfer: Firestore not initialized');
            return;
        }
        
        const requestsRef = collection(db, `tenants/${tenantId}/requests`);
        const q = query(
            requestsRef,
            where('branch', '==', branchId),
            where('status', 'in', ['PENDING_RECEPTION', 'CONFIRMED', 'IN_PROGRESS'])
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
            monitoredRequests.clear();
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                const entryTime = getDepartmentEntryTime(data);
                
                monitoredRequests.set(docSnap.id, {
                    id: docSnap.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt || Date.now())),
                    departmentEnteredAt: entryTime, // ✅ Already a Date object from getDepartmentEntryTime
                    currentDepartment: data.currentDepartment || data.originDepartment || (data.departmentHistory && data.departmentHistory.length > 0 ? data.departmentHistory[data.departmentHistory.length - 1].department : null),
                });
            });

            // Check immediately on update
            checkAndTransfer();
        }, (error) => {
            console.error('❌ Auto-transfer subscription error:', error);
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
    if (!db) {
        console.error('🔄 [Auto-Transfer] Firestore not initialized');
        return null;
    }
    
    try {
        const { getDoc } = await import('firebase/firestore');
        // ✅ SECURITY FIX: Use tenant-scoped collection for settings
        const configRef = doc(db, `tenants/${tenantId}/settings`, `autoTransfer_${branchId}`);
        const configSnap = await getDoc(configRef);
        
        console.log(`🔍 [Auto-Transfer] Loading config for branch ${branchId}, tenant ${tenantId}`);

        if (configSnap.exists()) {
            const data = configSnap.data();
            const config = {
                enabled: data.enabled ?? true,
                checkIntervalMs: data.checkIntervalMs || 60000,
                rules: data.rules || [],
                branch: branchId,
                tenantId,
            };
            console.log(`✅ [Auto-Transfer] Config loaded: ${config.enabled ? 'ENABLED' : 'DISABLED'}, ${config.rules.length} rule(s)`);
            return config;
        }

        // Return default config if not exists
        console.log(`ℹ️ [Auto-Transfer] No config found, using default (disabled)`);
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
    if (!db) {
        throw new Error('Firestore not initialized');
    }
    
    try {
        const { setDoc } = await import('firebase/firestore');
        // ✅ SECURITY FIX: Use tenant-scoped collection for settings
        const configRef = doc(db, `tenants/${config.tenantId}/settings`, `autoTransfer_${config.branch}`);
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
 * ✅ FIX: Properly handle Timestamp conversion and fallbacks
 */
const getDepartmentEntryTime = (request: any): Date => {
    // Try to get from departmentHistory (most accurate)
    if (request.departmentHistory && Array.isArray(request.departmentHistory) && request.departmentHistory.length > 0) {
        const lastEntry = request.departmentHistory[request.departmentHistory.length - 1];
        if (lastEntry && lastEntry.enteredAt) {
            // Handle Firestore Timestamp
            if (lastEntry.enteredAt.toDate) {
                return lastEntry.enteredAt.toDate();
            }
            // Handle Date object
            if (lastEntry.enteredAt instanceof Date) {
                return lastEntry.enteredAt;
            }
            // Handle string or number timestamp
            return new Date(lastEntry.enteredAt);
        }
    }
    
    // Fallback to creation time
    if (request.createdAt) {
        if (request.createdAt.toDate) {
            return request.createdAt.toDate();
        }
        if (request.createdAt instanceof Date) {
            return request.createdAt;
        }
        return new Date(request.createdAt);
    }
    
    // Last resort: current time (shouldn't happen)
    console.warn('⚠️ Could not determine department entry time for request, using current time');
    return new Date();
};

/**
 * Check if request matches rule
 */
const matchesRule = (request: any, rule: AutoTransferRule): boolean => {
    // ✅ FIX: Get current department from request (fallback to originDepartment or initial department)
    const currentDept = request.currentDepartment || request.originDepartment || (request.departmentHistory && request.departmentHistory.length > 0 ? request.departmentHistory[request.departmentHistory.length - 1].department : null);
    
    // Check department
    if (!currentDept || currentDept !== rule.fromDepartment) {
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
        // ✅ FIX: Ensure departmentEntryTime is a Date object
        const departmentEntryTime = request.departmentEnteredAt instanceof Date 
            ? request.departmentEnteredAt 
            : (request.createdAt instanceof Date ? request.createdAt : new Date(request.createdAt || Date.now()));
        
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
        console.log(`🔄 [Auto-Transfer] Found ${transfers.length} request(s) ready for transfer`);
        
        if (!db) {
            console.error('❌ [Auto-Transfer] Firestore not initialized - cannot perform transfers');
            return;
        }
        
        const batch = writeBatch(db);

        for (const { requestId, rule, request } of transfers) {
            try {
                // ✅ FIX: Pass tenantId as first parameter (required by transferRequestToDepartment)
                await transferRequestToDepartment(
                    requestId,
                    currentConfig.tenantId, // ✅ CRITICAL: Add tenantId
                    rule.fromDepartment,
                    rule.toDepartment,
                    'AUTO_TRANSFER_SYSTEM',
                    'نظام التحويل التلقائي',
                    undefined,
                    `تحويل تلقائي: تأخر الطلب في ${rule.fromDepartment} لمدة ${rule.timeoutMinutes} دقيقة`
                );

                // ✅ SECURITY FIX: Use tenant-scoped collection
                const requestRef = doc(db, `tenants/${currentConfig.tenantId}/requests`, requestId);
                const currentNotes = request.notes || '';
                batch.update(requestRef, {
                    notes: currentNotes + `\n[نظام التحويل التلقائي] تم التحويل من ${rule.fromDepartment} إلى ${rule.toDepartment} بعد ${rule.timeoutMinutes} دقيقة`,
                    autoTransferred: true,
                    autoTransferredAt: Timestamp.now(),
                    autoTransferredFrom: rule.fromDepartment,
                    autoTransferredTo: rule.toDepartment,
                });

                console.log(`✅ [Auto-Transfer] Successfully transferred request ${requestId} from ${rule.fromDepartment} to ${rule.toDepartment} after ${rule.timeoutMinutes} minutes`);
            } catch (error) {
                console.error(`❌ [Auto-Transfer] Failed to transfer request ${requestId} from ${rule.fromDepartment} to ${rule.toDepartment}:`, error);
                // Continue with other transfers even if one fails
            }
        }

        try {
            await batch.commit();
            console.log(`✅ [Auto-Transfer] Batch committed successfully for ${transfers.length} transfer(s)`);
        } catch (error) {
            console.error(`❌ [Auto-Transfer] Failed to commit batch:`, error);
        }
    } else {
        // Log when no transfers are needed (only in debug mode)
        if (monitoredRequests.size > 0) {
            console.debug(`🔍 [Auto-Transfer] Checked ${monitoredRequests.size} request(s), none ready for transfer`);
        }
    }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if department is enabled for tenant and transfer immediately if disabled
 * This is called when a request is created for a department that might be disabled
 * @param requestId - The newly created request ID
 * @param targetDepartment - The target department for the request
 * @param tenantId - Tenant ID
 * @param branchId - Branch ID
 * @returns Promise<boolean> - True if transfer was performed, false otherwise
 */
export const checkImmediateTransferForDisabledDepartment = async (
    requestId: string,
    targetDepartment: string,
    tenantId: string,
    branchId: string
): Promise<boolean> => {
    try {
        // Load auto-transfer config
        const config = await loadAutoTransferConfig(branchId, tenantId);
        if (!config || !config.enabled) {
            return false; // Auto-transfer is disabled
        }

        // Find rule that matches this department (fromDepartment = targetDepartment)
        const matchingRule = config.rules.find(
            rule => rule.enabled && rule.fromDepartment === targetDepartment
        );

        if (!matchingRule) {
            return false; // No rule found for this department
        }

        // Check if department is disabled
        const { isFeatureEnabledForTenant } = await import('./tenantCustomizationService');
        
        // Map department to feature name
        const departmentToFeatureMap: Record<string, string> = {
            'coffee_shop': 'coffeeshop',
            'coffeeshop': 'coffeeshop',
            'procurement': 'procurement',
            'maintenance': 'maintenance',
            'housekeeping': 'housekeeping',
            'bellman': 'bellman',
        };

        const featureName = departmentToFeatureMap[targetDepartment];
        if (!featureName) {
            return false; // Department not in mapping, assume enabled
        }

        const isEnabled = await isFeatureEnabledForTenant(tenantId, featureName);
        
        // If department is enabled, no need to transfer
        if (isEnabled) {
            return false;
        }

        // Department is disabled and we have a matching rule - transfer immediately
        console.log(`🔄 [Auto-Transfer] Department ${targetDepartment} is disabled, transferring request ${requestId} immediately to ${matchingRule.toDepartment}`);

        // Get the request to transfer
        const request = await getRequest(requestId, tenantId);
        if (!request) {
            console.error(`❌ [Auto-Transfer] Request ${requestId} not found`);
            return false;
        }

        // Perform immediate transfer
        await transferRequestToDepartment(
            requestId,
            tenantId,
            targetDepartment,
            matchingRule.toDepartment,
            'AUTO_TRANSFER_SYSTEM',
            'نظام التحويل التلقائي',
            undefined,
            `تحويل تلقائي فوري: القسم ${targetDepartment} غير مفعل، تم التحويل إلى ${matchingRule.toDepartment}`
        );

        // Update request notes
        if (!db) {
            console.error('❌ [Auto-Transfer] Firestore not initialized');
            return false;
        }

        const requestRef = doc(db, `tenants/${tenantId}/requests`, requestId);
        const currentNotes = request.notes || '';
        await updateDoc(requestRef, {
            notes: currentNotes + `\n[نظام التحويل التلقائي] تم التحويل الفوري من ${targetDepartment} إلى ${matchingRule.toDepartment} (القسم غير مفعل)`,
            autoTransferred: true,
            autoTransferredAt: Timestamp.now(),
            autoTransferredFrom: targetDepartment,
            autoTransferredTo: matchingRule.toDepartment,
            immediateTransfer: true, // Mark as immediate transfer (not time-based)
        });

        console.log(`✅ [Auto-Transfer] Successfully transferred request ${requestId} from disabled department ${targetDepartment} to ${matchingRule.toDepartment}`);
        return true;
    } catch (error) {
        console.error(`❌ [Auto-Transfer] Failed to check immediate transfer for request ${requestId}:`, error);
        return false; // Fail silently - don't block request creation
    }
};

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
