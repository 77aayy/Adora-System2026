/**
 * 🔄 Overflow Service
 * ==================
 * نظام توزيع الأحمال الذكي
 * يراقب عدد المهام لكل موظف ويُنبه عند تجاوز الحد
 * 
 * @features
 * - حد المهام لكل قسم (قابل للتعديل من الإعدادات)
 * - تنبيهات للاستقبال عند تجاوز الحد
 * - إعادة توجيه تلقائية للقسم المساعد
 */

import { db } from './firebase';
import {
    collection, query, where, getDocs, doc, getDoc, onSnapshot, Unsubscribe, Timestamp
} from 'firebase/firestore';
import { logger } from './loggerService';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TaskLimits {
    bellman: number;      // الحد الأقصى للبيلمان
    housekeeping: number; // الحد الأقصى للنظافة
    maintenance: number;  // الحد الأقصى للصيانة
}

export interface OverflowStatus {
    department: 'bellman' | 'housekeeping' | 'maintenance';
    currentTasks: number;
    maxTasks: number;
    isOverloaded: boolean;
    overloadPercentage: number;
    suggestedAlternative?: string;
}

export interface OverflowAlert {
    id: string;
    department: string;
    branchId: string;
    tenantId: string;
    currentTasks: number;
    maxTasks: number;
    message: string;
    createdAt: Date;
    acknowledged: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEFAULT LIMITS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const DEFAULT_TASK_LIMITS: TaskLimits = {
    bellman: 3,      // البيلمان الواحد يقدر يخدم 3 طلبات
    housekeeping: 5, // عامل النظافة يقدر ينظف 5 غرف
    maintenance: 4   // فني الصيانة يقدر يعالج 4 طلبات
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER: Department to Alternative mapping
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const DEPARTMENT_ALTERNATIVES: Record<string, string> = {
    bellman: 'housekeeping',     // لو البيلمان مشغول، النظافة تساعد
    housekeeping: 'bellman',     // لو النظافة مشغولة، البيلمان يساعد
    maintenance: 'reception'     // لو الصيانة مشغولة، الاستقبال يأجل
};

export const DEPARTMENT_NAMES: Record<string, string> = {
    bellman: 'البيلمان',
    housekeeping: 'النظافة',
    maintenance: 'الصيانة',
    reception: 'الاستقبال'
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET TASK LIMITS FROM SETTINGS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * جلب حدود المهام من إعدادات الفرع
 */
export async function getTaskLimits(tenantId: string, branchId: string): Promise<TaskLimits> {
    if (!db) return DEFAULT_TASK_LIMITS;

    try {
        // Try to get from branch settings first
        const branchRef = doc(db, `tenants/${tenantId}/branches`, branchId);
        const branchDoc = await getDoc(branchRef);

        if (branchDoc.exists()) {
            const data = branchDoc.data();
            const limits = data.settings?.taskLimits || data.taskLimits;
            
            if (limits) {
                return {
                    bellman: limits.bellman ?? DEFAULT_TASK_LIMITS.bellman,
                    housekeeping: limits.housekeeping ?? DEFAULT_TASK_LIMITS.housekeeping,
                    maintenance: limits.maintenance ?? DEFAULT_TASK_LIMITS.maintenance
                };
            }
        }

        return DEFAULT_TASK_LIMITS;
    } catch (error) {
        logger.warn('Failed to get task limits, using defaults', error, 'overflowService');
        return DEFAULT_TASK_LIMITS;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COUNT ACTIVE TASKS PER DEPARTMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * عد المهام النشطة لقسم معين
 */
export async function countActiveTasks(
    tenantId: string, 
    branchId: string, 
    department: 'bellman' | 'housekeeping' | 'maintenance'
): Promise<number> {
    if (!db) return 0;

    try {
        // Map department to request types
        const typeMap: Record<string, string[]> = {
            bellman: ['bellman'],
            housekeeping: ['cleaning', 'inspection'],
            maintenance: ['maintenance']
        };

        const types = typeMap[department] || [];
        if (types.length === 0) return 0;

        // Count active requests (pending, confirmed, in_progress)
        const activeStatuses = ['PENDING_RECEPTION', 'CONFIRMED', 'IN_PROGRESS', 'PENDING_HOUSEKEEPING', 'PENDING_MAINTENANCE'];

        const requestsRef = collection(db, `tenants/${tenantId}/requests`);
        const q = query(
            requestsRef,
            where('branch', '==', branchId),
            where('type', 'in', types),
            where('status', 'in', activeStatuses)
        );

        const snapshot = await getDocs(q);
        return snapshot.size;

    } catch (error) {
        logger.error('Failed to count active tasks', error, 'overflowService');
        return 0;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHECK OVERFLOW STATUS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * فحص حالة الـ Overflow لقسم معين
 */
export async function checkOverflowStatus(
    tenantId: string,
    branchId: string,
    department: 'bellman' | 'housekeeping' | 'maintenance'
): Promise<OverflowStatus> {
    const [limits, currentTasks] = await Promise.all([
        getTaskLimits(tenantId, branchId),
        countActiveTasks(tenantId, branchId, department)
    ]);

    const maxTasks = limits[department];
    const isOverloaded = currentTasks >= maxTasks;
    const overloadPercentage = Math.round((currentTasks / maxTasks) * 100);

    return {
        department,
        currentTasks,
        maxTasks,
        isOverloaded,
        overloadPercentage,
        suggestedAlternative: isOverloaded ? DEPARTMENT_ALTERNATIVES[department] : undefined
    };
}

/**
 * فحص حالة جميع الأقسام
 */
export async function checkAllDepartmentsOverflow(
    tenantId: string,
    branchId: string
): Promise<OverflowStatus[]> {
    const departments: Array<'bellman' | 'housekeeping' | 'maintenance'> = [
        'bellman', 'housekeeping', 'maintenance'
    ];

    const results = await Promise.all(
        departments.map(dept => checkOverflowStatus(tenantId, branchId, dept))
    );

    return results;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GENERATE OVERFLOW ALERT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * إنشاء رسالة تنبيه Overflow
 */
export function generateOverflowAlert(status: OverflowStatus): OverflowAlert | null {
    if (!status.isOverloaded) return null;

    const departmentName = DEPARTMENT_NAMES[status.department];
    const alternativeName = status.suggestedAlternative 
        ? DEPARTMENT_NAMES[status.suggestedAlternative] 
        : null;

    let message = `⚠️ قسم ${departmentName} مشغول جداً (${status.currentTasks}/${status.maxTasks} مهام)`;
    
    if (alternativeName) {
        message += `\n💡 اقتراح: تحويل الطلب لقسم ${alternativeName}`;
    }

    return {
        id: `overflow_${status.department}_${Date.now()}`,
        department: status.department,
        branchId: '', // سيُملأ من المُستدعي
        tenantId: '', // سيُملأ من المُستدعي
        currentTasks: status.currentTasks,
        maxTasks: status.maxTasks,
        message,
        createdAt: new Date(),
        acknowledged: false
    };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHOULD REROUTE REQUEST?
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * يُقرر هل الطلب يحتاج تحويل لقسم بديل؟
 * @returns القسم البديل أو null لو مفيش حاجة
 */
export async function shouldRerouteRequest(
    tenantId: string,
    branchId: string,
    targetDepartment: 'bellman' | 'housekeeping' | 'maintenance'
): Promise<{
    shouldReroute: boolean;
    alternativeDepartment?: string;
    status: OverflowStatus;
}> {
    const status = await checkOverflowStatus(tenantId, branchId, targetDepartment);

    if (!status.isOverloaded) {
        return { shouldReroute: false, status };
    }

    // Check if alternative is also overloaded
    const alternative = DEPARTMENT_ALTERNATIVES[targetDepartment];
    if (alternative && alternative !== 'reception') {
        const altDept = alternative as 'bellman' | 'housekeeping' | 'maintenance';
        const altStatus = await checkOverflowStatus(tenantId, branchId, altDept);
        
        if (!altStatus.isOverloaded) {
            return {
                shouldReroute: true,
                alternativeDepartment: alternative,
                status
            };
        }
    }

    // Both departments are overloaded - just alert reception
    return {
        shouldReroute: false,
        status
    };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUBSCRIBE TO OVERFLOW CHANGES (REAL-TIME)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * اشتراك في تغييرات الـ Overflow (للاستقبال)
 */
export function subscribeToOverflowAlerts(
    tenantId: string,
    branchId: string,
    callback: (statuses: OverflowStatus[]) => void
): Unsubscribe {
    if (!db) {
        callback([]);
        return () => {};
    }

    const requestsRef = collection(db, `tenants/${tenantId}/requests`);
    const q = query(
        requestsRef,
        where('branch', '==', branchId),
        where('status', 'in', ['PENDING_RECEPTION', 'CONFIRMED', 'IN_PROGRESS', 'PENDING_HOUSEKEEPING', 'PENDING_MAINTENANCE'])
    );

    return onSnapshot(q, async () => {
        // Recalculate overflow status when requests change
        const statuses = await checkAllDepartmentsOverflow(tenantId, branchId);
        callback(statuses);
    }, (error) => {
        logger.error('Error subscribing to overflow alerts', error, 'overflowService');
        callback([]);
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAINTENANCE OVERFLOW LOGIC (Special Case)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * منطق خاص للصيانة: منع الطلبات الدورية عند وجود طوارئ
 */
export async function canAcceptMaintenanceRequest(
    tenantId: string,
    branchId: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' | 'emergency'
): Promise<{
    canAccept: boolean;
    reason?: string;
}> {
    if (!db) return { canAccept: true };

    try {
        // If it's an emergency request, always accept
        if (priority === 'emergency' || priority === 'urgent') {
            return { canAccept: true };
        }

        const requestsRef = collection(db, `tenants/${tenantId}/requests`);
        const emergencyQuery = query(
            requestsRef,
            where('branch', '==', branchId),
            where('type', '==', 'maintenance'),
            where('priority', 'in', ['emergency', 'urgent']),
            where('status', 'in', ['PENDING_RECEPTION', 'CONFIRMED', 'IN_PROGRESS', 'PENDING_MAINTENANCE'])
        );

        const emergencySnapshot = await getDocs(emergencyQuery);

        if (emergencySnapshot.size > 0) {
            return {
                canAccept: false,
                reason: `⚠️ يوجد ${emergencySnapshot.size} طلب صيانة طوارئ. يُنصح بتأجيل الصيانة الدورية.`
            };
        }

        return { canAccept: true };

    } catch (error) {
        logger.error('Error checking maintenance capacity', error, 'overflowService');
        return { canAccept: true };
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORT ALL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
    getTaskLimits,
    countActiveTasks,
    checkOverflowStatus,
    checkAllDepartmentsOverflow,
    generateOverflowAlert,
    shouldRerouteRequest,
    subscribeToOverflowAlerts,
    canAcceptMaintenanceRequest,
    DEFAULT_TASK_LIMITS,
    DEPARTMENT_ALTERNATIVES,
    DEPARTMENT_NAMES
};
