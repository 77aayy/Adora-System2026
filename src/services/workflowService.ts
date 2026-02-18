/**
 * 🔄 Smart Department Workflow Service
 * نظام تتبع المهام الذكي بين الأقسام
 * 
 * Features:
 * - Real-time card tracking between departments
 * - Action locking (only current holder can act)
 * - Unified status flow: NEW → IN_PROGRESS → COMPLETED
 * - Department journey history
 */

import { 
    collection, doc, updateDoc, onSnapshot, query, where, 
    Timestamp, orderBy, getDoc, writeBatch, getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { RequestStatus } from '../types/request';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type WorkflowStatus = 'NEW' | 'IN_PROGRESS' | 'COMPLETED';

export interface WorkflowCard {
    id: string;
    originDept: string;          // القسم الراسل
    targetDept: string;          // القسم المستلم
    currentHolder: string;       // القسم الذي يملك التحكم حالياً
    workflowStatus: WorkflowStatus;
    
    // Timestamps
    createdAt: Timestamp;
    sentAt?: Timestamp;          // وقت الإرسال للقسم المستهدف
    startedAt?: Timestamp;       // وقت بدء العمل من المستلم
    completedAt?: Timestamp;     // وقت الإكمال
    returnedAt?: Timestamp;      // وقت العودة للراسل
    
    // Journey
    journey: WorkflowJourneyEntry[];
    
    // Lock status
    isLocked: boolean;
    lockedBy?: string;
}

export interface WorkflowJourneyEntry {
    department: string;
    action: 'created' | 'sent' | 'received' | 'started' | 'completed' | 'returned';
    timestamp: Timestamp;
    userId?: string;
    userName?: string;
    notes?: string;
}

// Department IDs (mapped to route names)
export const DEPARTMENTS = {
    RECEPTION: 'reception',
    HOUSEKEEPING: 'housekeeping',
    MAINTENANCE: 'maintenance',
    BELLMAN: 'bellman',
    COFFEE_SHOP: 'coffee_shop',
    PROCUREMENT: 'procurement'
} as const;

export type DepartmentId = typeof DEPARTMENTS[keyof typeof DEPARTMENTS];

// Map RequestType to target department
export const REQUEST_TYPE_TO_DEPARTMENT: Record<string, DepartmentId> = {
    'cleaning': DEPARTMENTS.HOUSEKEEPING,
    'maintenance': DEPARTMENTS.MAINTENANCE,
    'bellman': DEPARTMENTS.BELLMAN,
    'coffee': DEPARTMENTS.COFFEE_SHOP,
    'minibar': DEPARTMENTS.COFFEE_SHOP,
    'procurement': DEPARTMENTS.PROCUREMENT,
    'laundry': DEPARTMENTS.HOUSEKEEPING,
    'inspection': DEPARTMENTS.HOUSEKEEPING,
};

// ============================================================
// WORKFLOW ACTIONS
// ============================================================

/**
 * إرسال كرت من قسم لآخر
 * Send card from origin to target department
 * ✅ FIX: Added tenantId parameter for tenant-scoped collection
 */
export async function sendToTargetDepartment(
    tenantId: string,
    requestId: string,
    originDept: DepartmentId,
    targetDept: DepartmentId,
    userId: string,
    userName: string,
    notes?: string
): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    if (!tenantId) {
        throw new Error('tenantId is required');
    }
    
    const requestRef = doc(db, `tenants/${tenantId}/requests`, requestId);
    const now = Timestamp.now();
    
    // Get current request data
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) throw new Error('Request not found');
    
    const currentData = requestSnap.data();
    const currentJourney = currentData.workflow?.journey || [];
    
    await updateDoc(requestRef, {
        // Workflow fields
        'workflow.originDept': originDept,
        'workflow.targetDept': targetDept,
        'workflow.currentHolder': targetDept,
        'workflow.workflowStatus': 'NEW',
        'workflow.sentAt': now,
        'workflow.isLocked': true,
        'workflow.lockedBy': targetDept,
        'workflow.journey': [
            ...currentJourney,
            {
                department: originDept,
                action: 'sent',
                timestamp: now,
                userId,
                userName,
                notes: notes || `تم الإرسال إلى ${getDepartmentName(targetDept)}`
            }
        ],
        
        // Legacy fields for compatibility
        'currentDepartment': targetDept,
        'originDepartment': originDept,
        'status': mapWorkflowStatusToRequestStatus('NEW', targetDept),
        'deliveredAt': now
    });
    
    logger.info(`✅ Card ${requestId} sent from ${originDept} to ${targetDept}`, undefined, 'workflowService');
}

/**
 * بدء العمل على الكرت (من القسم المستلم)
 * Start working on card (by target department)
 */
/**
 * Start work on request
 * ✅ FIX: Added tenantId parameter for tenant-scoped collection
 */
export async function startWork(
    tenantId: string,
    requestId: string,
    department: DepartmentId,
    userId: string,
    userName: string,
    notes?: string
): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    if (!tenantId) {
        throw new Error('tenantId is required');
    }
    
    const requestRef = doc(db, `tenants/${tenantId}/requests`, requestId);
    const now = Timestamp.now();
    
    // Verify this department is the current holder
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) throw new Error('Request not found');
    
    const data = requestSnap.data();
    const workflow = data.workflow || {};
    
    if (workflow.currentHolder !== department) {
        throw new Error(`❌ Cannot start: Card is held by ${workflow.currentHolder}, not ${department}`);
    }
    
    if (workflow.workflowStatus !== 'NEW') {
        throw new Error(`❌ Cannot start: Card is already ${workflow.workflowStatus}`);
    }
    
    const currentJourney = workflow.journey || [];
    
    await updateDoc(requestRef, {
        'workflow.workflowStatus': 'IN_PROGRESS',
        'workflow.startedAt': now,
        'workflow.journey': [
            ...currentJourney,
            {
                department,
                action: 'started',
                timestamp: now,
                userId,
                userName,
                notes: notes || 'بدأ العمل على الطلب'
            }
        ],
        
        // Legacy fields
        'status': RequestStatus.IN_PROGRESS,
        'startedAt': now,
        'assignedTo': { id: userId, name: userName, department }
    });
    
    logger.info(`✅ Work started on card ${requestId} by ${department}`, undefined, 'workflowService');
}

/**
 * إكمال العمل وإرجاع الكرت للراسل
 * Complete work and return card to origin
 */
/**
 * Complete work and return card to origin
 * ✅ FIX: Added tenantId parameter for tenant-scoped collection
 */
export async function completeAndReturn(
    tenantId: string,
    requestId: string,
    department: DepartmentId,
    userId: string,
    userName: string,
    notes?: string,
    additionalData?: Record<string, any>
): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    if (!tenantId) {
        throw new Error('tenantId is required');
    }
    
    const requestRef = doc(db, `tenants/${tenantId}/requests`, requestId);
    const now = Timestamp.now();
    
    // Verify this department is the current holder
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) throw new Error('Request not found');
    
    const data = requestSnap.data();
    const workflow = data.workflow || {};
    
    if (workflow.currentHolder !== department) {
        throw new Error(`❌ Cannot complete: Card is held by ${workflow.currentHolder}, not ${department}`);
    }
    
    const currentJourney = workflow.journey || [];
    const originDept = workflow.originDept || data.originDepartment || DEPARTMENTS.RECEPTION;
    
    await updateDoc(requestRef, {
        'workflow.workflowStatus': 'COMPLETED',
        'workflow.completedAt': now,
        'workflow.returnedAt': now,
        'workflow.currentHolder': originDept, // Return to origin
        'workflow.isLocked': false, // Unlock for origin
        'workflow.lockedBy': null,
        'workflow.journey': [
            ...currentJourney,
            {
                department,
                action: 'completed',
                timestamp: now,
                userId,
                userName,
                notes: notes || 'تم إكمال العمل'
            },
            {
                department,
                action: 'returned',
                timestamp: now,
                userId,
                userName,
                notes: `تم الإرجاع إلى ${getDepartmentName(originDept)}`
            }
        ],
        
        // Legacy fields
        'status': RequestStatus.COMPLETED,
        'completedAt': now,
        'completedBy': { id: userId, name: userName, department },
        'currentDepartment': originDept,
        
        // Any additional data (inspection report, maintenance details, etc.)
        ...additionalData
    });
    
    logger.info(`✅ Card ${requestId} completed by ${department} and returned to ${originDept}`, undefined, 'workflowService');
}

// ============================================================
// QUERY FUNCTIONS (for displaying in tabs)
// ============================================================

/**
 * الحصول على الكروت حسب القسم والحالة
 * Get cards by department and workflow status
 */
export function subscribeToWorkflowCards(
    tenantId: string,
    branchId: string,
    department: DepartmentId,
    callback: (cards: { new: any[], inProgress: any[], completed: any[] }) => void
): () => void {
    if (!db) {
        logger.error('Database not initialized', undefined, 'workflowService');
        callback({ new: [], inProgress: [], completed: [] });
        return () => {};
    }
    
    // ✅ FIX: Use tenant-scoped collection
    if (!tenantId) {
        throw new Error('tenantId is required');
    }
    const requestsRef = collection(db, `tenants/${tenantId}/requests`);
    
    // ✅ FIX: No need for tenantId where clause - already tenant-scoped
    // Query for cards where this department is involved
    const q = query(
        requestsRef,
        where('branch', '==', branchId),
        orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
        const allCards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter by department involvement
        const departmentCards = allCards.filter(card => {
            const workflow = (card as any).workflow || {};
            const isOrigin = workflow.originDept === department || (card as any).originDepartment === department;
            const isTarget = workflow.targetDept === department || (card as any).currentDepartment === department;
            const isHolder = workflow.currentHolder === department;
            
            // Include if this department is origin, target, or current holder
            return isOrigin || isTarget || isHolder;
        });
        
        // Categorize by workflow status relative to this department
        const result = {
            new: [] as any[],
            inProgress: [] as any[],
            completed: [] as any[]
        };
        
        departmentCards.forEach(card => {
            const workflow = (card as any).workflow || {};
            const status = workflow.workflowStatus || mapLegacyStatus((card as any).status);
            const currentHolder = workflow.currentHolder || (card as any).currentDepartment;
            const isOrigin = workflow.originDept === department || (card as any).originDepartment === department;
            
            // For origin department
            if (isOrigin) {
                if (status === 'COMPLETED') {
                    result.completed.push({ ...card, canAct: true });
                } else if (status === 'IN_PROGRESS' && currentHolder !== department) {
                    result.inProgress.push({ ...card, canAct: false });
                } else if (status === 'NEW' && currentHolder !== department) {
                    // Sent but not yet started by target
                    result.inProgress.push({ ...card, canAct: false });
                }
            }
            
            // For target department (current holder)
            if (currentHolder === department && status !== 'COMPLETED') {
                if (status === 'NEW') {
                    result.new.push({ ...card, canAct: true });
                } else if (status === 'IN_PROGRESS') {
                    result.inProgress.push({ ...card, canAct: true });
                }
            }
        });
        
        callback(result);
    }, (error) => {
        logger.error('Workflow subscription error:', error, 'workflowService');
        callback({ new: [], inProgress: [], completed: [] });
    });
}

/**
 * التحقق من إمكانية اتخاذ إجراء
 * Check if department can take action on card
 */
export function canTakeAction(card: any, department: DepartmentId): boolean {
    const workflow = card.workflow || {};
    const currentHolder = workflow.currentHolder || card.currentDepartment;
    const status = workflow.workflowStatus || mapLegacyStatus(card.status);
    
    // Only current holder can act, and only if not completed
    return currentHolder === department && status !== 'COMPLETED';
}

/**
 * الحصول على الإجراءات المتاحة للقسم
 * Get available actions for department on card
 */
export function getAvailableActions(card: any, department: DepartmentId): string[] {
    if (!canTakeAction(card, department)) return [];
    
    const workflow = card.workflow || {};
    const status = workflow.workflowStatus || mapLegacyStatus(card.status);
    const isOrigin = workflow.originDept === department || card.originDepartment === department;
    
    const actions: string[] = [];
    
    if (isOrigin && status === 'COMPLETED') {
        actions.push('archive', 'reopen');
    } else if (!isOrigin) {
        if (status === 'NEW') {
            actions.push('start');
        } else if (status === 'IN_PROGRESS') {
            actions.push('complete', 'pause', 'transfer');
        }
    }
    
    return actions;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getDepartmentName(dept: DepartmentId): string {
    const names: Record<DepartmentId, string> = {
        [DEPARTMENTS.RECEPTION]: 'الاستقبال',
        [DEPARTMENTS.HOUSEKEEPING]: 'التدبير المنزلي',
        [DEPARTMENTS.MAINTENANCE]: 'الصيانة',
        [DEPARTMENTS.BELLMAN]: 'البيلمان',
        [DEPARTMENTS.COFFEE_SHOP]: 'الكافي شوب',
        [DEPARTMENTS.PROCUREMENT]: 'المشتريات'
    };
    return names[dept] || dept;
}

function mapWorkflowStatusToRequestStatus(workflowStatus: WorkflowStatus, targetDept: DepartmentId): RequestStatus {
    switch (workflowStatus) {
        case 'NEW':
            switch (targetDept) {
                case DEPARTMENTS.HOUSEKEEPING: return RequestStatus.PENDING_HOUSEKEEPING;
                case DEPARTMENTS.MAINTENANCE: return RequestStatus.PENDING_MAINTENANCE;
                default: return RequestStatus.CONFIRMED;
            }
        case 'IN_PROGRESS':
            return RequestStatus.IN_PROGRESS;
        case 'COMPLETED':
            return RequestStatus.COMPLETED;
        default:
            return RequestStatus.CONFIRMED;
    }
}

function mapLegacyStatus(status: string): WorkflowStatus {
    if (!status) return 'NEW';
    
    const upper = status.toUpperCase();
    
    if (upper.includes('COMPLETED') || upper.includes('DONE')) {
        return 'COMPLETED';
    }
    if (upper.includes('PROGRESS') || upper.includes('STARTED')) {
        return 'IN_PROGRESS';
    }
    return 'NEW';
}

// ============================================================
// MIGRATION: Update existing requests with workflow fields
// ============================================================

/**
 * Migrate request to workflow format
 * ✅ FIX: Added tenantId parameter for tenant-scoped collection
 */
export async function migrateRequestToWorkflow(tenantId: string, requestId: string): Promise<void> {
    if (!db) return;
    if (!tenantId) {
        throw new Error('tenantId is required');
    }
    
    const requestRef = doc(db, `tenants/${tenantId}/requests`, requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) return;
    
    const data = requestSnap.data();
    
    // Skip if already has workflow data
    if (data.workflow?.originDept) return;
    
    const workflow: Partial<WorkflowCard> = {
        originDept: data.originDepartment || DEPARTMENTS.RECEPTION,
        targetDept: data.currentDepartment || REQUEST_TYPE_TO_DEPARTMENT[data.type] || DEPARTMENTS.RECEPTION,
        currentHolder: data.currentDepartment || REQUEST_TYPE_TO_DEPARTMENT[data.type] || DEPARTMENTS.RECEPTION,
        workflowStatus: mapLegacyStatus(data.status),
        createdAt: data.createdAt,
        isLocked: data.status !== 'COMPLETED',
        journey: [{
            department: data.originDepartment || DEPARTMENTS.RECEPTION,
            action: 'created',
            timestamp: data.createdAt,
            notes: 'تم إنشاء الطلب'
        }]
    };
    
    await updateDoc(requestRef, { workflow });
    logger.info(`✅ Migrated request ${requestId} to workflow format`, undefined, 'workflowService');
}

export default {
    sendToTargetDepartment,
    startWork,
    completeAndReturn,
    subscribeToWorkflowCards,
    canTakeAction,
    getAvailableActions,
    DEPARTMENTS,
    REQUEST_TYPE_TO_DEPARTMENT
};
