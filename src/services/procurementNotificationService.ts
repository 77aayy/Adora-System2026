/**
 * Procurement Notification Service
 * Comprehensive notification system for all procurement stages
 * Features: Stage-based notifications, department logs, receipt tracking
 * Adora Hotel Management System V3 - SaaS
 */

import {
    collection, addDoc, updateDoc, doc, query, where, getDocs, 
    orderBy, Timestamp, serverTimestamp, onSnapshot, Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type ProcurementStage = 
    | 'SUBMITTED'           // تم رفع الطلب
    | 'PENDING_APPROVAL'    // بانتظار موافقة المدير
    | 'APPROVED'            // تمت الموافقة
    | 'REJECTED'            // تم الرفض
    | 'PURCHASING'          // جاري الشراء
    | 'PARTIAL_PURCHASE'    // شراء جزئي
    | 'PURCHASED'           // تم الشراء
    | 'DELIVERED'           // تم التوصيل
    | 'PARTIAL_RECEIPT'     // استلام جزئي
    | 'FULL_RECEIPT'        // استلام كامل
    | 'SHORTAGE'            // عجز في الاستلام
    | 'OVERAGE'             // زيادة في الاستلام
    | 'BACKORDER_CREATED'   // تم إنشاء طلب متبقي
    | 'COMPLETED';          // مكتمل

export interface ProcurementNotification {
    id?: string;
    type: 'procurement';
    stage: ProcurementStage;
    
    // Request Info
    requestId: string;
    orderId?: string; // Parent order if backorder
    
    // Targeting
    tenantId: string;
    branchId: string;
    department: string;         // القسم الطالب
    targetRoles: string[];      // الأدوار المستهدفة (manager, procurement_rep, department_head)
    
    // Content
    title: string;
    message: string;
    icon: string;
    color: string;
    
    // Actor
    actorId: string;
    actorName: string;
    actorRole: string;
    
    // Details
    items?: { name: string; quantity: number; received?: number; shortage?: number }[];
    totalItems: number;
    totalCost?: number;
    
    // Timestamps
    createdAt: any;
    readAt?: any;
    readBy?: { id: string; name: string }[];
    
    // Status
    read: boolean;
    dismissed: boolean;
    actionRequired: boolean;
    actionUrl?: string;
}

export interface ProcurementLogEntry {
    id?: string;
    
    // Request Info
    requestId: string;
    orderId?: string;
    
    // Context
    tenantId: string;
    branchId: string;
    department: string;
    
    // Stage Info
    stage: ProcurementStage;
    previousStage?: ProcurementStage;
    
    // Description
    title: string;
    description: string;
    
    // Actor
    actorId: string;
    actorName: string;
    actorRole: string;
    
    // Items affected
    items?: {
        name: string;
        requestedQty: number;
        purchasedQty?: number;
        receivedQty?: number;
        shortage?: number;
        overage?: number;
        unitPrice?: number;
    }[];
    
    // Financial
    totalCost?: number;
    
    // Timestamps
    timestamp: any;
    duration?: number; // Time since previous stage in seconds
    
    // Metadata
    notes?: string;
    attachments?: string[];
    metadata?: Record<string, any>;
}

export interface ReceiptRecord {
    id?: string;
    requestId: string;
    
    tenantId: string;
    branchId: string;
    department: string;
    
    // Receipt Details
    type: 'full' | 'partial' | 'shortage' | 'overage';
    items: {
        name: string;
        expected: number;
        received: number;
        difference: number; // positive = overage, negative = shortage
        notes?: string;
    }[];
    
    // Summary
    totalExpected: number;
    totalReceived: number;
    totalDifference: number;
    
    // Actor
    receivedBy: { id: string; name: string };
    receivedAt: any;
    
    // Backorder
    backorderCreated: boolean;
    backorderId?: string;
    
    // Signatures
    notes?: string;
    signature?: string; // Base64 image or confirmation code
}

// ============================================================
// STAGE CONFIGURATION
// ============================================================

export const STAGE_CONFIG: Record<ProcurementStage, {
    title: string;
    icon: string;
    color: string;
    targetRoles: string[];
    actionRequired: boolean;
}> = {
    SUBMITTED: {
        title: 'تم رفع طلب مشتريات',
        icon: '📤',
        color: 'blue',
        targetRoles: ['manager', 'admin'],
        actionRequired: true,
    },
    PENDING_APPROVAL: {
        title: 'طلب بانتظار الموافقة',
        icon: '⏳',
        color: 'yellow',
        targetRoles: ['manager', 'admin'],
        actionRequired: true,
    },
    APPROVED: {
        title: 'تمت الموافقة على الطلب',
        icon: '✅',
        color: 'green',
        targetRoles: ['procurement_rep', 'requester'],
        actionRequired: true,
    },
    REJECTED: {
        title: 'تم رفض الطلب',
        icon: '❌',
        color: 'red',
        targetRoles: ['requester'],
        actionRequired: false,
    },
    PURCHASING: {
        title: 'جاري شراء المنتجات',
        icon: '🛒',
        color: 'purple',
        targetRoles: ['requester'],
        actionRequired: false,
    },
    PARTIAL_PURCHASE: {
        title: 'شراء جزئي - بعض المنتجات غير متوفرة',
        icon: '⚠️',
        color: 'orange',
        targetRoles: ['requester', 'manager'],
        actionRequired: false,
    },
    PURCHASED: {
        title: 'تم الشراء - جاهز للتوصيل',
        icon: '🛍️',
        color: 'green',
        targetRoles: ['requester'],
        actionRequired: false,
    },
    DELIVERED: {
        title: 'تم التوصيل - يرجى الاستلام',
        icon: '📦',
        color: 'emerald',
        targetRoles: ['requester'],
        actionRequired: true,
    },
    PARTIAL_RECEIPT: {
        title: 'استلام جزئي',
        icon: '📋',
        color: 'orange',
        targetRoles: ['procurement_rep', 'manager'],
        actionRequired: false,
    },
    FULL_RECEIPT: {
        title: 'تم الاستلام الكامل',
        icon: '✔️',
        color: 'green',
        targetRoles: ['procurement_rep'],
        actionRequired: false,
    },
    SHORTAGE: {
        title: 'عجز في الاستلام',
        icon: '📉',
        color: 'red',
        targetRoles: ['procurement_rep', 'manager'],
        actionRequired: true,
    },
    OVERAGE: {
        title: 'زيادة في الاستلام',
        icon: '📈',
        color: 'yellow',
        targetRoles: ['procurement_rep', 'manager'],
        actionRequired: false,
    },
    BACKORDER_CREATED: {
        title: 'تم إنشاء طلب للكمية المتبقية',
        icon: '🔄',
        color: 'blue',
        targetRoles: ['manager', 'requester', 'procurement_rep'],
        actionRequired: true,
    },
    COMPLETED: {
        title: 'الطلب مكتمل',
        icon: '🎉',
        color: 'gray',
        targetRoles: ['requester'],
        actionRequired: false,
    },
};

// ============================================================
// NOTIFICATION FUNCTIONS
// ============================================================

/**
 * Send procurement notification
 */
export const sendProcurementNotification = async (
    stage: ProcurementStage,
    requestId: string,
    context: {
        tenantId: string;
        branchId: string;
        department: string;
    },
    actor: {
        id: string;
        name: string;
        role: string;
    },
    details?: {
        items?: { name: string; quantity: number; received?: number; shortage?: number }[];
        totalCost?: number;
        notes?: string;
        orderId?: string;
    }
): Promise<string | null> => {
    try {
        const config = STAGE_CONFIG[stage];
        
        const notification: Omit<ProcurementNotification, 'id'> = {
            type: 'procurement',
            stage,
            requestId,
            orderId: details?.orderId,
            
            tenantId: context.tenantId,
            branchId: context.branchId,
            department: context.department,
            targetRoles: config.targetRoles,
            
            title: config.title,
            message: generateMessage(stage, actor.name, details),
            icon: config.icon,
            color: config.color,
            
            actorId: actor.id,
            actorName: actor.name,
            actorRole: actor.role,
            
            items: details?.items,
            totalItems: details?.items?.length || 0,
            totalCost: details?.totalCost,
            
            createdAt: serverTimestamp(),
            read: false,
            dismissed: false,
            actionRequired: config.actionRequired,
            actionUrl: `/procurement?requestId=${requestId}`,
        };
        
        const docRef = await addDoc(collection(db, 'procurementNotifications'), notification);
        
        logger.info(`📢 Procurement notification: ${stage}`, { requestId, department: context.department }, 'procurementNotificationService');
        
        return docRef.id;
    } catch (error) {
        logger.error('Error sending procurement notification:', error, 'procurementNotificationService');
        return null;
    }
};

/**
 * Generate notification message based on stage
 */
function generateMessage(
    stage: ProcurementStage,
    actorName: string,
    details?: { items?: any[]; totalCost?: number; notes?: string }
): string {
    const itemsCount = details?.items?.length || 0;
    
    switch (stage) {
        case 'SUBMITTED':
            return `قام ${actorName} برفع طلب مشتريات يحتوي على ${itemsCount} عنصر`;
        case 'PENDING_APPROVAL':
            return `طلب مشتريات جديد بانتظار موافقتك (${itemsCount} عنصر)`;
        case 'APPROVED':
            return `تمت الموافقة على طلب المشتريات من قبل ${actorName}`;
        case 'REJECTED':
            return `تم رفض طلب المشتريات. السبب: ${details?.notes || 'غير محدد'}`;
        case 'PURCHASING':
            return `${actorName} بدأ في شراء المنتجات المطلوبة`;
        case 'PARTIAL_PURCHASE':
            return `تم شراء بعض المنتجات فقط. سيتم إنشاء طلب للمتبقي.`;
        case 'PURCHASED':
            return `تم شراء جميع المنتجات بتكلفة ${details?.totalCost || 0} ريال`;
        case 'DELIVERED':
            return `تم توصيل المشتريات إلى قسمكم. يرجى الاستلام والتأكيد.`;
        case 'PARTIAL_RECEIPT':
            return `تم استلام جزء من الكمية. سيتم إنشاء طلب للمتبقي.`;
        case 'FULL_RECEIPT':
            return `تم استلام جميع المنتجات بنجاح`;
        case 'SHORTAGE':
            const shortageItems = details?.items?.filter(i => (i.shortage || 0) > 0) || [];
            return `عجز في ${shortageItems.length} منتج. تم إنشاء طلب للكمية الناقصة.`;
        case 'OVERAGE':
            return `تم استلام كمية أكثر من المطلوب`;
        case 'BACKORDER_CREATED':
            return `تم إنشاء طلب جديد للكمية المتبقية تلقائياً`;
        case 'COMPLETED':
            return `تم إغلاق طلب المشتريات بنجاح`;
        default:
            return 'تحديث على طلب المشتريات';
    }
}

// ============================================================
// LOGGING FUNCTIONS
// ============================================================

/**
 * Log procurement stage change
 */
export const logProcurementStage = async (
    stage: ProcurementStage,
    requestId: string,
    context: {
        tenantId: string;
        branchId: string;
        department: string;
    },
    actor: {
        id: string;
        name: string;
        role: string;
    },
    details?: {
        previousStage?: ProcurementStage;
        items?: any[];
        totalCost?: number;
        notes?: string;
        duration?: number;
        metadata?: Record<string, any>;
    }
): Promise<string | null> => {
    try {
        const config = STAGE_CONFIG[stage];
        
        const logEntry: Omit<ProcurementLogEntry, 'id'> = {
            requestId,
            tenantId: context.tenantId,
            branchId: context.branchId,
            department: context.department,
            
            stage,
            previousStage: details?.previousStage,
            
            title: config.title,
            description: generateLogDescription(stage, actor.name, details),
            
            actorId: actor.id,
            actorName: actor.name,
            actorRole: actor.role,
            
            items: details?.items,
            totalCost: details?.totalCost,
            
            timestamp: serverTimestamp(),
            duration: details?.duration,
            
            notes: details?.notes,
            metadata: details?.metadata,
        };
        
        const docRef = await addDoc(collection(db, 'procurementLogs'), logEntry);
        
        return docRef.id;
    } catch (error) {
        logger.error('Error logging procurement stage:', error, 'procurementNotificationService');
        return null;
    }
};

/**
 * Generate log description
 */
function generateLogDescription(
    stage: ProcurementStage,
    actorName: string,
    details?: any
): string {
    const config = STAGE_CONFIG[stage];
    let desc = `${config.icon} ${config.title} - بواسطة ${actorName}`;
    
    if (details?.notes) {
        desc += ` | ملاحظات: ${details.notes}`;
    }
    
    if (details?.totalCost) {
        desc += ` | التكلفة: ${details.totalCost} ريال`;
    }
    
    return desc;
}

/**
 * Create receipt record
 */
export const createReceiptRecord = async (
    requestId: string,
    context: {
        tenantId: string;
        branchId: string;
        department: string;
    },
    receiver: {
        id: string;
        name: string;
    },
    items: {
        name: string;
        expected: number;
        received: number;
    }[],
    options?: {
        notes?: string;
        backorderId?: string;
    }
): Promise<string | null> => {
    try {
        // Calculate receipt type and totals
        const processedItems = items.map(item => ({
            name: item.name,
            expected: item.expected,
            received: item.received,
            difference: item.received - item.expected,
        }));
        
        const totalExpected = items.reduce((sum, i) => sum + i.expected, 0);
        const totalReceived = items.reduce((sum, i) => sum + i.received, 0);
        const totalDifference = totalReceived - totalExpected;
        
        let type: 'full' | 'partial' | 'shortage' | 'overage' = 'full';
        if (totalDifference < 0) {
            type = items.some(i => i.received === 0) ? 'partial' : 'shortage';
        } else if (totalDifference > 0) {
            type = 'overage';
        }
        
        const receiptRecord: Omit<ReceiptRecord, 'id'> = {
            requestId,
            tenantId: context.tenantId,
            branchId: context.branchId,
            department: context.department,
            
            type,
            items: processedItems,
            
            totalExpected,
            totalReceived,
            totalDifference,
            
            receivedBy: receiver,
            receivedAt: serverTimestamp(),
            
            backorderCreated: !!options?.backorderId,
            backorderId: options?.backorderId,
            
            notes: options?.notes,
        };
        
        const docRef = await addDoc(collection(db, 'procurementReceipts'), receiptRecord);
        
        // Log this receipt
        await logProcurementStage(
            type === 'full' ? 'FULL_RECEIPT' : type === 'shortage' ? 'SHORTAGE' : type === 'overage' ? 'OVERAGE' : 'PARTIAL_RECEIPT',
            requestId,
            context,
            { id: receiver.id, name: receiver.name, role: 'department_staff' },
            {
                items: processedItems,
                notes: options?.notes,
                metadata: {
                    receiptId: docRef.id,
                    totalExpected,
                    totalReceived,
                    totalDifference,
                }
            }
        );
        
        // Send notification
        await sendProcurementNotification(
            type === 'full' ? 'FULL_RECEIPT' : type === 'shortage' ? 'SHORTAGE' : type === 'overage' ? 'OVERAGE' : 'PARTIAL_RECEIPT',
            requestId,
            context,
            { id: receiver.id, name: receiver.name, role: 'department_staff' },
            {
                items: processedItems.map(i => ({
                    name: i.name,
                    quantity: i.expected,
                    received: i.received,
                    shortage: i.difference < 0 ? Math.abs(i.difference) : 0,
                })),
            }
        );
        
        return docRef.id;
    } catch (error) {
        logger.error('Error creating receipt record:', error, 'procurementNotificationService');
        return null;
    }
};

// ============================================================
// FETCHING FUNCTIONS
// ============================================================

/**
 * Get procurement logs for a request
 */
export const getProcurementLogs = async (
    requestId: string,
    tenantId: string
): Promise<ProcurementLogEntry[]> => {
    try {
        const q = query(
            collection(db, 'procurementLogs'),
            where('requestId', '==', requestId),
            where('tenantId', '==', tenantId),
            orderBy('timestamp', 'desc')
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as ProcurementLogEntry[];
    } catch (error) {
        logger.error('Error fetching procurement logs:', error, 'procurementNotificationService');
        return [];
    }
};

/**
 * Get procurement logs for a department
 */
export const getDepartmentProcurementLogs = async (
    tenantId: string,
    branchId: string,
    department: string,
    limitCount: number = 50
): Promise<ProcurementLogEntry[]> => {
    try {
        const q = query(
            collection(db, 'procurementLogs'),
            where('tenantId', '==', tenantId),
            where('branchId', '==', branchId),
            where('department', '==', department),
            orderBy('timestamp', 'desc')
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs
            .slice(0, limitCount)
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date(),
            })) as ProcurementLogEntry[];
    } catch (error) {
        logger.error('Error fetching department procurement logs:', error, 'procurementNotificationService');
        return [];
    }
};

/**
 * Get receipt records for a department
 */
export const getDepartmentReceipts = async (
    tenantId: string,
    branchId: string,
    department: string,
    limitCount: number = 50
): Promise<ReceiptRecord[]> => {
    try {
        const q = query(
            collection(db, 'procurementReceipts'),
            where('tenantId', '==', tenantId),
            where('branchId', '==', branchId),
            where('department', '==', department),
            orderBy('receivedAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs
            .slice(0, limitCount)
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                receivedAt: doc.data().receivedAt?.toDate() || new Date(),
            })) as ReceiptRecord[];
    } catch (error) {
        logger.error('Error fetching department receipts:', error, 'procurementNotificationService');
        return [];
    }
};

/**
 * Get unread notifications for user
 */
export const getUnreadProcurementNotifications = async (
    tenantId: string,
    branchId: string,
    userRole: string,
    department?: string
): Promise<ProcurementNotification[]> => {
    try {
        const notificationsRef = collection(db, 'procurementNotifications');
        
        // Build query
        const constraints = [
            where('tenantId', '==', tenantId),
            where('branchId', '==', branchId),
            where('read', '==', false),
            where('targetRoles', 'array-contains', userRole),
        ];
        
        const q = query(notificationsRef, ...constraints, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        let notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as ProcurementNotification[];
        
        // Filter by department if user is a requester
        if (department && userRole === 'requester') {
            notifications = notifications.filter(n => n.department === department);
        }
        
        return notifications;
    } catch (error) {
        logger.error('Error fetching unread notifications:', error, 'procurementNotificationService');
        return [];
    }
};

/**
 * Subscribe to procurement notifications
 */
export const subscribeToProcurementNotifications = (
    tenantId: string,
    branchId: string,
    userRole: string,
    department: string | undefined,
    callback: (notifications: ProcurementNotification[]) => void
): Unsubscribe => {
    if (!tenantId) {
        callback([]);
        return () => {};
    }
    
    const notificationsRef = collection(db, 'procurementNotifications');
    
    const q = query(
        notificationsRef,
        where('tenantId', '==', tenantId),
        where('branchId', '==', branchId),
        where('read', '==', false),
        where('targetRoles', 'array-contains', userRole)
    );
    
    return onSnapshot(q, (snapshot) => {
        let notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as ProcurementNotification[];
        
        // Filter by department if needed
        if (department && userRole === 'requester') {
            notifications = notifications.filter(n => n.department === department);
        }
        
        // Sort by date
        notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        callback(notifications);
    });
};

/**
 * Mark notification as read
 */
export const markNotificationRead = async (
    notificationId: string,
    userId: string,
    userName: string
): Promise<void> => {
    try {
        const notificationRef = doc(db, 'procurementNotifications', notificationId);
        await updateDoc(notificationRef, {
            read: true,
            readAt: serverTimestamp(),
            readBy: [{ id: userId, name: userName }],
        });
    } catch (error) {
        logger.error('Error marking notification read:', error, 'procurementNotificationService');
    }
};

// ============================================================
// SUMMARY FUNCTIONS
// ============================================================

/**
 * Get procurement summary for dashboard
 */
export const getProcurementSummary = async (
    tenantId: string,
    branchId: string,
    department?: string
): Promise<{
    pendingApproval: number;
    inProgress: number;
    awaitingReceipt: number;
    completedToday: number;
    totalShortages: number;
}> => {
    try {
        const requestsRef = collection(db, 'procurementRequests');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Base constraints
        const baseConstraints = [
            where('tenantId', '==', tenantId),
            where('branchId', '==', branchId),
        ];
        
        if (department) {
            baseConstraints.push(where('department', '==', department));
        }
        
        // Pending approval
        const pendingQ = query(requestsRef, ...baseConstraints, where('status', '==', 'PENDING_APPROVAL'));
        const pendingSnap = await getDocs(pendingQ);
        
        // In progress (purchasing)
        const progressQ = query(requestsRef, ...baseConstraints, where('status', 'in', ['APPROVED', 'PURCHASING']));
        const progressSnap = await getDocs(progressQ);
        
        // Awaiting receipt
        const receiptQ = query(requestsRef, ...baseConstraints, where('status', 'in', ['PURCHASED', 'DELIVERED']));
        const receiptSnap = await getDocs(receiptQ);
        
        // Get receipts for shortage count
        const receiptsRef = collection(db, 'procurementReceipts');
        const shortageQ = query(
            receiptsRef,
            where('tenantId', '==', tenantId),
            where('branchId', '==', branchId),
            where('type', '==', 'shortage')
        );
        const shortageSnap = await getDocs(shortageQ);
        
        return {
            pendingApproval: pendingSnap.size,
            inProgress: progressSnap.size,
            awaitingReceipt: receiptSnap.size,
            completedToday: 0, // Would need date filtering
            totalShortages: shortageSnap.size,
        };
    } catch (error) {
        logger.error('Error getting procurement summary:', error, 'procurementNotificationService');
        return {
            pendingApproval: 0,
            inProgress: 0,
            awaitingReceipt: 0,
            completedToday: 0,
            totalShortages: 0,
        };
    }
};

export default {
    sendProcurementNotification,
    logProcurementStage,
    createReceiptRecord,
    getProcurementLogs,
    getDepartmentProcurementLogs,
    getDepartmentReceipts,
    getUnreadProcurementNotifications,
    subscribeToProcurementNotifications,
    markNotificationRead,
    getProcurementSummary,
    STAGE_CONFIG,
};
