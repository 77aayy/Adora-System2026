/**
 * 🔄 useWorkflow Hook
 * Hook موحد لإدارة دورة عمل الكروت بين الأقسام
 * 
 * Usage:
 * const { cards, sendCard, startWork, completeCard, canAct } = useWorkflow('housekeeping');
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
    collection, query, where, orderBy, onSnapshot, 
    doc, updateDoc, Timestamp, getDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
    DepartmentId, 
    DEPARTMENTS,
    REQUEST_TYPE_TO_DEPARTMENT,
    sendToTargetDepartment,
    startWork as startWorkService,
    completeAndReturn,
    canTakeAction,
    getAvailableActions
} from '../services/workflowService';
import { RequestStatus } from '../types/request';

// ============================================================
// TYPES
// ============================================================

export interface WorkflowCard {
    id: string;
    roomNumber: string;
    guestName?: string;
    type: string;
    status: string;
    priority?: string;
    notes?: string;
    createdAt: Timestamp;
    
    // Workflow specific
    workflow?: {
        originDept: string;
        targetDept: string;
        currentHolder: string;
        workflowStatus: 'NEW' | 'IN_PROGRESS' | 'COMPLETED';
        isLocked: boolean;
        lockedBy?: string;
        journey?: any[];
    };
    
    // UI helpers
    canAct: boolean;
    isFromOrigin: boolean;
    isCurrentHolder: boolean;
    availableActions: string[];
    
    // All other fields
    [key: string]: any;
}

export interface WorkflowCounts {
    new: number;
    inProgress: number;
    completed: number;
    total: number;
}

// ============================================================
// HOOK
// ============================================================

export function useWorkflow(department: DepartmentId) {
    const { user, tenantId, branchId } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Cards categorized by workflow status
    const [newCards, setNewCards] = useState<WorkflowCard[]>([]);
    const [inProgressCards, setInProgressCards] = useState<WorkflowCard[]>([]);
    const [completedCards, setCompletedCards] = useState<WorkflowCard[]>([]);
    
    // ============================================================
    // REAL-TIME SUBSCRIPTION
    // ============================================================
    
    useEffect(() => {
        if (!db || !tenantId || !branchId) {
            setLoading(false);
            return;
        }
        
        setLoading(true);
        setError(null);
        
        // ✅ FIX: Use tenant-scoped collection
        if (!tenantId) {
            console.error('useWorkflow: tenantId is required');
            setLoading(false);
            return () => {};
        }
        const requestsRef = collection(db, `tenants/${tenantId}/requests`);
        
        // Get request types that target this department
        const targetTypes = Object.entries(REQUEST_TYPE_TO_DEPARTMENT)
            .filter(([_, dept]) => dept === department)
            .map(([type]) => type);
        
        // ✅ FIX: No need for tenantId where clause - already tenant-scoped
        // Query for all requests in this branch
        const q = query(
            requestsRef,
            where('branch', '==', branchId),
            orderBy('createdAt', 'desc')
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allCards = snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                const workflow = data.workflow || {};
                
                // Determine if this card is relevant to this department
                const isOrigin = workflow.originDept === department || data.originDepartment === department;
                const isTarget = workflow.targetDept === department || 
                    data.currentDepartment === department ||
                    targetTypes.includes(data.type);
                const isHolder = workflow.currentHolder === department;
                
                // Calculate workflow status
                let workflowStatus: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' = 'NEW';
                if (data.status === RequestStatus.COMPLETED || data.status?.includes('COMPLETED')) {
                    workflowStatus = 'COMPLETED';
                } else if (data.status === RequestStatus.IN_PROGRESS || data.status?.includes('PROGRESS')) {
                    workflowStatus = 'IN_PROGRESS';
                }
                
                // Calculate canAct
                const canAct = isHolder && workflowStatus !== 'COMPLETED';
                
                return {
                    id: docSnap.id,
                    ...data,
                    canAct,
                    isFromOrigin: isOrigin,
                    isCurrentHolder: isHolder,
                    availableActions: canAct ? getAvailableActions({ ...data, id: docSnap.id }, department) : [],
                    _isRelevant: isOrigin || isTarget || isHolder,
                    _workflowStatus: workflowStatus,
                    _isOrigin: isOrigin
                } as WorkflowCard;
            });
            
            // Filter relevant cards
            const relevantCards = allCards.filter(card => card._isRelevant);
            
            // Categorize cards
            const newList: WorkflowCard[] = [];
            const inProgressList: WorkflowCard[] = [];
            const completedList: WorkflowCard[] = [];
            
            relevantCards.forEach(card => {
                const status = card._workflowStatus;
                const isOrigin = card._isOrigin;
                const isHolder = card.isCurrentHolder;
                
                // For origin department: show in "completed" when done
                if (isOrigin) {
                    if (status === 'COMPLETED') {
                        completedList.push(card);
                    } else if (!isHolder) {
                        // Card is at target department - show in "in progress" (read only)
                        inProgressList.push(card);
                    }
                }
                
                // For target department: show in appropriate tab
                if (isHolder && status !== 'COMPLETED') {
                    if (status === 'NEW') {
                        newList.push(card);
                    } else if (status === 'IN_PROGRESS') {
                        inProgressList.push(card);
                    }
                }
            });
            
            setNewCards(newList);
            setInProgressCards(inProgressList);
            setCompletedCards(completedList);
            setLoading(false);
            
        }, (err) => {
            console.error('Workflow subscription error:', err);
            setError(err.message);
            setLoading(false);
        });
        
        return () => unsubscribe();
        
    }, [tenantId, branchId, department]);
    
    // ============================================================
    // COUNTS
    // ============================================================
    
    const counts = useMemo<WorkflowCounts>(() => ({
        new: newCards.length,
        inProgress: inProgressCards.length,
        completed: completedCards.length,
        total: newCards.length + inProgressCards.length + completedCards.length
    }), [newCards, inProgressCards, completedCards]);
    
    // ============================================================
    // ACTIONS
    // ============================================================
    
    /**
     * إرسال كرت لقسم آخر
     */
    const sendCard = useCallback(async (
        cardId: string,
        targetDept: DepartmentId,
        notes?: string
    ) => {
        if (!user?.id || !user?.name) throw new Error('User not authenticated');
        
        if (!tenantId) {
            throw new Error('tenantId is required');
        }
        await sendToTargetDepartment(
            tenantId,
            cardId,
            department,
            targetDept,
            user.id,
            user.name,
            notes
        );
    }, [department, user]);
    
    /**
     * بدء العمل على كرت
     */
    const startCard = useCallback(async (cardId: string, notes?: string) => {
        if (!user?.id || !user?.name) throw new Error('User not authenticated');
        
        if (!tenantId) {
            throw new Error('tenantId is required');
        }
        await startWorkService(tenantId, cardId, department, user.id, user.name, notes);
    }, [department, user]);
    
    /**
     * إكمال العمل وإرجاع الكرت
     */
    const completeCard = useCallback(async (
        cardId: string,
        notes?: string,
        additionalData?: Record<string, any>
    ) => {
        if (!user?.id || !user?.name) throw new Error('User not authenticated');
        
        if (!tenantId) {
            throw new Error('tenantId is required');
        }
        await completeAndReturn(tenantId, cardId, department, user.id, user.name, notes, additionalData);
    }, [department, user]);
    
    /**
     * التحقق من إمكانية اتخاذ إجراء على كرت
     */
    const canActOnCard = useCallback((card: WorkflowCard): boolean => {
        return card.canAct || canTakeAction(card, department);
    }, [department]);
    
    /**
     * الحصول على الإجراءات المتاحة
     */
    const getActions = useCallback((card: WorkflowCard): string[] => {
        return card.availableActions || getAvailableActions(card, department);
    }, [department]);
    
    // ============================================================
    // RETURN
    // ============================================================
    
    return {
        // State
        loading,
        error,
        
        // Cards by status
        newCards,
        inProgressCards,
        completedCards,
        
        // Counts
        counts,
        
        // Actions
        sendCard,
        startCard,
        completeCard,
        
        // Utilities
        canActOnCard,
        getActions,
        
        // Department info
        department,
        departmentName: getDepartmentName(department)
    };
}

// Helper
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

export default useWorkflow;
