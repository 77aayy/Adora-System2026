/**
 * 🎯 Unified State Transition Service
 * محرك تنقل الحالات الموحد لأدورا
 * 
 * This is the "Single Source of Truth" for all request state transitions.
 * Instead of scattered status updates across multiple services, this service
 * handles ALL state transitions in a unified, atomic way.
 * 
 * Architecture:
 * - Single State Machine: NEW → IN_PROGRESS → COMPLETED
 * - Single Current Holder: currentDepartment determines who "owns" the card
 * - Department Involvement: involvedDepartments tracks all departments that touched the card
 * - Reception Alert: isActionRequiredByReception flags when reception needs to act
 * 
 * @module stateTransitionService
 * @version 1.0.0 - Phase 1: Unified State Machine
 */

import { 
    doc, updateDoc, getDoc, writeBatch, Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { RequestStatus } from '../types/request';
import { DepartmentId, DEPARTMENTS, REQUEST_TYPE_TO_DEPARTMENT } from './workflowService';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type UnifiedStatus = 'NEW' | 'IN_PROGRESS' | 'COMPLETED';

export interface StateTransition {
    fromStatus: UnifiedStatus;
    toStatus: UnifiedStatus;
    fromDepartment: DepartmentId;
    toDepartment: DepartmentId;
    userId: string;
    userName: string;
    timestamp: Timestamp;
    notes?: string;
}

export interface RequestStateData {
    // Core state
    status: UnifiedStatus;
    currentDepartment: DepartmentId;
    
    // Department tracking
    involvedDepartments: DepartmentId[];
    originDepartment: DepartmentId;
    
    // Reception alert
    isActionRequiredByReception: boolean;
    
    // History (for audit trail)
    stateHistory: StateTransition[];
    
    // Legacy compatibility (will be phased out)
    workflow?: {
        workflowStatus: UnifiedStatus;
        currentHolder: DepartmentId;
        originDept: DepartmentId;
        journey?: any[];
    };
}

// ============================================================
// STATE TRANSITION ENGINE
// ============================================================

/**
 * Move request to new state and/or department
 * This is the ONLY function allowed to change request state
 * 
 * @param tenantId - Tenant ID for data isolation
 * @param requestId - Request ID
 * @param newStatus - Target status (NEW, IN_PROGRESS, COMPLETED)
 * @param targetDepartment - Target department (if different from current)
 * @param userId - User performing the action
 * @param userName - User name
 * @param notes - Optional notes
 * @param additionalData - Any additional fields to update
 */
export async function moveRequest(
    tenantId: string,
    requestId: string,
    newStatus: UnifiedStatus,
    targetDepartment: DepartmentId,
    userId: string,
    userName: string,
    notes?: string,
    additionalData?: Record<string, any>
): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    if (!tenantId) throw new Error('tenantId is required');
    
    const requestRef = doc(db, `tenants/${tenantId}/requests`, requestId);
    const now = Timestamp.now();
    
    // Get current request data
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) {
        throw new Error('Request not found');
    }
    
    const currentData = requestSnap.data();
    
    // ✅ Lazy Migration: Auto-migrate legacy requests to Unified State Machine
    // If request doesn't have unified state fields, initialize them
    if (!currentData.involvedDepartments || !currentData.stateHistory) {
        try {
            const originDept = currentData.originDepartment || 
                              currentData.workflow?.originDept || 
                              DEPARTMENTS.RECEPTION;
            const currentDept = currentData.currentDepartment || 
                               currentData.workflow?.currentHolder || 
                               originDept;
            
            // Initialize missing unified fields
            const migrationUpdate: any = {
                involvedDepartments: currentData.involvedDepartments || [originDept, currentDept],
                isActionRequiredByReception: currentData.isActionRequiredByReception ?? false,
                stateHistory: currentData.stateHistory || []
            };
            
            // If stateHistory is empty, create initial transition
            if (!currentData.stateHistory || currentData.stateHistory.length === 0) {
                const currentStatus = extractUnifiedStatus(currentData);
                migrationUpdate.stateHistory = [{
                    fromStatus: 'NEW',
                    toStatus: currentStatus,
                    fromDepartment: originDept,
                    toDepartment: currentDept,
                    userId: currentData.createdBy?.id || userId,
                    userName: currentData.createdBy?.name || userName,
                    timestamp: currentData.createdAt || now,
                    notes: 'تم الترحيل التلقائي من النظام القديم'
                }];
            }
            
            // Apply migration update
            await updateDoc(requestRef, migrationUpdate);
            logger.info(`✅ Auto-migrated legacy request ${requestId} to Unified State Machine`, undefined, 'stateTransitionService');
            
            // Refresh currentData with migrated fields
            const refreshedSnap = await getDoc(requestRef);
            if (refreshedSnap.exists()) {
                Object.assign(currentData, refreshedSnap.data());
            }
        } catch (migrationError: any) {
            // Non-critical: Log but continue with normal flow
            logger.warn(`⚠️ Failed to auto-migrate request ${requestId} (non-critical): ${migrationError.message}`, migrationError, 'stateTransitionService');
        }
    }
    
    // Extract current state
    const currentStatus = extractUnifiedStatus(currentData);
    const rawStatus = (currentData.status || '').toString().toUpperCase();

    // Block COMPLETED from CANCELLED or from NEW (work not started)
    if (newStatus === 'COMPLETED') {
        if (rawStatus === 'CANCELLED') {
            throw new Error('Cannot complete a cancelled request');
        }
        if (currentStatus === 'NEW') {
            throw new Error('Cannot complete a request that has not been started (use start first)');
        }
    }

    const currentDepartment = currentData.currentDepartment || 
                              currentData.workflow?.currentHolder || 
                              currentData.originDepartment || 
                              DEPARTMENTS.RECEPTION;
    
    // Extract involved departments
    const involvedDepartments = new Set<DepartmentId>(
        currentData.involvedDepartments || 
        [currentData.originDepartment, currentData.currentDepartment].filter(Boolean) ||
        [currentData.workflow?.originDept, currentData.workflow?.currentHolder].filter(Boolean)
    );
    
    // Add target department to involved list
    involvedDepartments.add(targetDepartment);
    
    // Calculate if reception action is required
    // Reception needs to act if: status is COMPLETED OR status is NEW and currentDepartment is RECEPTION
    const isActionRequiredByReception = (
        newStatus === 'COMPLETED' || 
        (newStatus === 'NEW' && targetDepartment === DEPARTMENTS.RECEPTION)
    );
    
    // Create transition record
    const transition: StateTransition = {
        fromStatus: currentStatus,
        toStatus: newStatus,
        fromDepartment: currentDepartment as DepartmentId,
        toDepartment: targetDepartment,
        userId,
        userName,
        timestamp: now,
        notes
    };
    
    // Get existing history
    const stateHistory = currentData.stateHistory || [];
    
    // Prepare update
    const updateData: any = {
        // Core unified fields
        status: mapUnifiedToLegacyStatus(newStatus, targetDepartment), // Legacy compatibility
        currentDepartment: targetDepartment,
        originDepartment: currentData.originDepartment || targetDepartment,
        involvedDepartments: Array.from(involvedDepartments),
        isActionRequiredByReception,
        stateHistory: [...stateHistory, transition],
        
        // Timestamps
        modifiedAt: now,
        modifiedBy: {
            id: userId,
            name: userName,
            department: currentDepartment
        },
        
        // Status-specific timestamps
        ...(newStatus === 'IN_PROGRESS' && !currentData.startedAt && { startedAt: now }),
        ...(newStatus === 'COMPLETED' && { completedAt: now }),
        
        // Legacy workflow compatibility (will be phased out gradually)
        workflow: {
            ...currentData.workflow,
            workflowStatus: newStatus,
            currentHolder: targetDepartment,
            originDept: currentData.originDepartment || currentData.workflow?.originDept || DEPARTMENTS.RECEPTION,
            journey: [
                ...(currentData.workflow?.journey || []),
                {
                    department: targetDepartment,
                    action: getActionFromStatus(newStatus),
                    timestamp: now,
                    userId,
                    userName,
                    notes
                }
            ]
        },
        
        // Additional data (inspection reports, maintenance details, etc.)
        ...additionalData
    };
    
    // Execute update atomically
    await updateDoc(requestRef, updateData);
    
    logger.info(`✅ State transition: ${requestId} [${currentStatus} → ${newStatus}] [${currentDepartment} → ${targetDepartment}]`, undefined, 'stateTransitionService');
}

/**
 * Initialize new request with unified state
 * Call this when creating a NEW request (from QR, Reception, etc.)
 */
export async function initializeRequest(
    tenantId: string,
    requestId: string,
    type: string,
    originDepartment: DepartmentId,
    targetDepartment: DepartmentId,
    userId: string,
    userName: string,
    notes?: string
): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    if (!tenantId) throw new Error('tenantId is required');
    
    const requestRef = doc(db, `tenants/${tenantId}/requests`, requestId);
    const now = Timestamp.now();
    
    // Get current request data
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) {
        throw new Error('Request not found');
    }
    
    const currentData = requestSnap.data();
    
    // Initialize state
    const initialTransition: StateTransition = {
        fromStatus: 'NEW',
        toStatus: 'NEW',
        fromDepartment: originDepartment,
        toDepartment: targetDepartment,
        userId,
        userName,
        timestamp: now,
        notes: notes || 'تم إنشاء الطلب'
    };
    
    const updateData: any = {
        // Core unified fields
        status: mapUnifiedToLegacyStatus('NEW', targetDepartment), // Legacy compatibility
        currentDepartment: targetDepartment,
        originDepartment,
        involvedDepartments: [originDepartment, targetDepartment],
        isActionRequiredByReception: false,
        stateHistory: [initialTransition],
        
        // Legacy workflow compatibility
        workflow: {
            ...currentData.workflow,
            workflowStatus: 'NEW',
            currentHolder: targetDepartment,
            originDept: originDepartment,
            journey: [
                ...(currentData.workflow?.journey || []),
                {
                    department: originDepartment,
                    action: 'created',
                    timestamp: now,
                    userId,
                    userName,
                    notes: notes || 'تم إنشاء الطلب'
                }
            ]
        }
    };
    
    await updateDoc(requestRef, updateData);
    logger.info(`✅ Request initialized: ${requestId} → ${targetDepartment}`, undefined, 'stateTransitionService');
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Extract unified status from request data (handles both old and new formats)
 */
export function extractUnifiedStatus(data: any): UnifiedStatus {
    // Try new unified status first
    if (data.status && ['NEW', 'IN_PROGRESS', 'COMPLETED'].includes(data.status)) {
        return data.status as UnifiedStatus;
    }
    
    // Try workflow status
    if (data.workflow?.workflowStatus) {
        return data.workflow.workflowStatus as UnifiedStatus;
    }
    
    // Map legacy status
    return mapLegacyToUnifiedStatus(data.status || 'PENDING_RECEPTION');
}

/**
 * Map legacy status to unified status
 */
function mapLegacyToUnifiedStatus(legacyStatus: string): UnifiedStatus {
    const upper = legacyStatus.toUpperCase();
    
    if (upper.includes('COMPLETED') || upper.includes('DONE')) {
        return 'COMPLETED';
    }
    
    if (upper.includes('PROGRESS') || upper.includes('STARTED') || 
        upper.includes('CLEANING_IN_PROGRESS') || upper.includes('MAINTENANCE_IN_PROGRESS')) {
        return 'IN_PROGRESS';
    }
    
    return 'NEW';
}

/**
 * Map unified status to legacy status (for backward compatibility)
 */
function mapUnifiedToLegacyStatus(unifiedStatus: UnifiedStatus, targetDepartment: DepartmentId): RequestStatus {
    switch (unifiedStatus) {
        case 'NEW':
            switch (targetDepartment) {
                case DEPARTMENTS.HOUSEKEEPING:
                    return RequestStatus.PENDING_HOUSEKEEPING;
                case DEPARTMENTS.MAINTENANCE:
                    return RequestStatus.PENDING_MAINTENANCE;
                case DEPARTMENTS.BELLMAN:
                    return RequestStatus.CONFIRMED;
                default:
                    return RequestStatus.PENDING_RECEPTION;
            }
        case 'IN_PROGRESS':
            return RequestStatus.IN_PROGRESS;
        case 'COMPLETED':
            return RequestStatus.COMPLETED;
        default:
            return RequestStatus.CONFIRMED;
    }
}

/**
 * Get action type from status
 */
function getActionFromStatus(status: UnifiedStatus): 'created' | 'sent' | 'received' | 'started' | 'completed' | 'returned' {
    switch (status) {
        case 'NEW':
            return 'received';
        case 'IN_PROGRESS':
            return 'started';
        case 'COMPLETED':
            return 'completed';
        default:
            return 'sent';
    }
}

// ============================================================
// EXPORTS
// ============================================================

// extractUnifiedStatus already exported at definition (line ~339)
export { mapLegacyToUnifiedStatus };

export default {
    moveRequest,
    initializeRequest,
    extractUnifiedStatus,
    mapLegacyToUnifiedStatus
};
