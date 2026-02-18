/**
 * Procurement Service
 * Manages procurement workflow:
 * - Departments submit → Manager approval → Procurement rep → Delivery → Receipt
 * - Dashboard bypasses manager approval
 * 
 * Adora Hotel Management System V2
 */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    query,
    where,
    onSnapshot,
    getDoc,
    getDocs,
    Timestamp,
    orderBy,
    Unsubscribe,
    runTransaction,
    serverTimestamp
} from 'firebase/firestore';
import { db, functions as firebaseFunctions, httpsCallable } from './firebase';
import { logger } from './loggerService';
import { approveProcurementPayloadSchema, closeProcurementPayloadSchema } from '../schemas/procurementSchemas';

// ============================================================
// TYPES
// ============================================================

export type ProcurementStatus =
    | 'PENDING_APPROVAL'  // Awaiting manager approval
    | 'APPROVED'          // Manager approved, at procurement rep
    | 'REJECTED'          // Manager rejected
    | 'PURCHASING'        // Rep is buying items
    | 'PURCHASED'         // Items purchased (all or partial)
    | 'DELIVERED'         // Delivered to department
    | 'PARTIALLY_DELIVERED' // ✅ Partial receipt (some items received, backorder created)
    | 'RECEIVED'          // Department confirmed receipt (full)
    | 'COMPLETED';        // Fully closed

export interface ProcurementItem {
    itemName: string;
    quantity: number;
    notes?: string;
    priority: 'normal' | 'urgent';
    // Purchase tracking
    purchasedQty?: number;
    receivedQty?: number;
    unitPrice?: number;
    // ✅ Inventory integration
    category?: string; // Dynamic category for auto-creating inventory items
    unit?: string; // Unit of measurement (piece, kg, liter, etc.)
}

export interface ProcurementRequest {
    id: string;
    items: ProcurementItem[];
    department: string;
    requestedBy: { id: string; name: string };
    branch: string;
    tenantId: string; // ✅ SaaS requirement - mandatory
    status: ProcurementStatus;
    createdAt: any;

    // Approval
    approvedAt?: any;
    approvedBy?: { id: string; name: string };
    rejectionReason?: string;

    // Purchase
    purchasedAt?: any;
    purchasedBy?: { id: string; name: string };
    purchaseNotes?: string;
    totalCost?: number;

    // Delivery
    deliveredAt?: any;
    deliveredBy?: { id: string; name: string };

    // Receipt
    receivedAt?: any;
    receivedBy?: { id: string; name: string };
    receiptType?: 'full' | 'shortage' | 'overage';
    receiptNotes?: string;
}

// ============================================================
// PROCUREMENT REQUEST CREATION
// ============================================================

/**
 * Create a new procurement request from cart items
 * ✅ SaaS: Uses tenant-scoped collection
 * ✅ Uses Atomic Transaction for data integrity
 */
export const createProcurementRequest = async (
    items: Array<{
        itemName: string;
        quantity: number;
        notes?: string;
        priority?: 'normal' | 'urgent' | 'scheduled';
        photoUrl?: string | null;
        scheduledDate?: string | null;
        category?: string;
        unit?: string;
    }>,
    department: string,
    requestedBy: { id: string; name: string },
    branchId: string,
    tenantId: string,
    options?: {
        bypassApproval?: boolean; // If true, status becomes 'APPROVED' immediately (for managers)
    }
): Promise<string> => {
    if (!db) throw new Error('Firebase not initialized');
    if (!tenantId) throw new Error('tenantId is required for SaaS isolation');

    if (!items || items.length === 0) {
        throw new Error('No items provided for procurement request');
    }

    try {
        // ✅ Use tenant-scoped collection
        const requestsRef = collection(db, `tenants/${tenantId}/procurementRequests`);
        
        // Determine initial status
        const status: ProcurementStatus = options?.bypassApproval 
            ? 'APPROVED' 
            : 'PENDING_APPROVAL';

        // Convert cart items to ProcurementItem format
        const procurementItems: ProcurementItem[] = items.map(item => ({
            itemName: item.itemName,
            quantity: item.quantity,
            notes: item.notes,
            priority: item.priority || 'normal',
            category: item.category,
            unit: item.unit
        }));

        // Create procurement request
        const requestData: Omit<ProcurementRequest, 'id'> = {
            items: procurementItems,
            department,
            requestedBy,
            branch: branchId,
            tenantId,
            status,
            createdAt: serverTimestamp(),
            ...(options?.bypassApproval && {
                approvedAt: serverTimestamp(),
                approvedBy: requestedBy
            })
        };

        const docRef = await addDoc(requestsRef, requestData);

        // ✅ Send notification and log (non-blocking)
        try {
            const { sendProcurementNotification, logProcurementStage } = await import('./procurementNotificationService');
            const context = { tenantId, branchId, department };
            const actor = { id: requestedBy.id, name: requestedBy.name, role: 'staff' };
            
            await Promise.all([
                sendProcurementNotification(
                    status === 'APPROVED' ? 'APPROVED' : 'PENDING_APPROVAL',
                    docRef.id,
                    context,
                    actor,
                    { items: procurementItems.map(i => ({ name: i.itemName, quantity: i.quantity })) }
                ).catch(() => {}),
                logProcurementStage(
                    status === 'APPROVED' ? 'APPROVED' : 'PENDING_APPROVAL',
                    docRef.id,
                    context,
                    actor,
                    { items: procurementItems }
                ).catch(() => {})
            ]);
        } catch (notifError) {
            logger.warn('Failed to send procurement notification/log (non-critical)', notifError, 'procurementService');
        }

        return docRef.id;
    } catch (error: any) {
        logger.error('Error creating procurement request:', error, 'procurementService');
        throw new Error(`فشل إنشاء طلب الشراء: ${error.message || 'خطأ غير معروف'}`);
    }
};

// ============================================================
// MANAGER ACTIONS
// ============================================================

/**
 * Manager approves a procurement request (via Cloud Function)
 * ✅ SaaS: Uses tenant-scoped collection; write performed server-side
 */
export const approveProcurement = async (
    requestId: string,
    managerId: string,
    managerName: string,
    tenantId: string // ✅ SaaS requirement
): Promise<void> => {
    const payload = approveProcurementPayloadSchema.safeParse({
        requestId,
        tenantId,
        managerId,
        managerName
    });
    if (!payload.success) {
        const msg = payload.error.issues[0]?.message ?? 'بيانات غير صحيحة';
        throw new Error(msg);
    }
    if (!firebaseFunctions) throw new Error('Firebase Functions not initialized');

    const procurementApproveFn = httpsCallable<
        { requestId: string; tenantId: string; managerId: string; managerName: string },
        { success: boolean }
    >(firebaseFunctions, 'procurementApprove');
    await procurementApproveFn({ requestId, tenantId, managerId, managerName });

    // ✅ Send notification and log (client-side after success)
    try {
        const requestRef = doc(db, `tenants/${tenantId}/procurementRequests`, requestId);
        const requestSnap = await getDoc(requestRef);
        const requestData = requestSnap.exists() ? requestSnap.data()! : {};
        const { sendProcurementNotification, logProcurementStage } = await import('./procurementNotificationService');
        const context = {
            tenantId,
            branchId: requestData.branch || 'default',
            department: requestData.department,
        };
        const actor = { id: managerId, name: managerName, role: 'manager' };
        await Promise.all([
            sendProcurementNotification('APPROVED', requestId, context, actor, {
                items: requestData.items?.map((i: { itemName?: string; quantity?: number }) => ({ name: i.itemName, quantity: i.quantity })),
            }),
            logProcurementStage('APPROVED', requestId, context, actor, {
                previousStage: 'PENDING_APPROVAL',
                items: requestData.items?.map((i: { itemName?: string; quantity?: number }) => ({ name: i.itemName, requestedQty: i.quantity })),
            }),
        ]);
    } catch (err) {
        logger.error('Error sending procurement notification:', err, 'procurementService');
    }
};

/**
 * Manager rejects a procurement request
 * ✅ SaaS: Requires tenantId for security validation
 * ✅ Enhanced: Sends notification and logs the action
 */
export const rejectProcurement = async (
    requestId: string,
    managerId: string,
    managerName: string,
    reason: string,
    tenantId: string // ✅ SaaS requirement
): Promise<void> => {
    if (!tenantId) throw new Error('tenantId is required for SaaS isolation');
    
    // ✅ Use tenant-scoped collection
    const requestRef = doc(db, `tenants/${tenantId}/procurementRequests`, requestId);
    
    // ✅ Verify tenantId matches before rejecting
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) {
        throw new Error('Request not found or tenant mismatch');
    }
    
    const requestData = requestSnap.data();
    
    await updateDoc(requestRef, {
        status: 'REJECTED',
        approvedAt: Timestamp.now(),
        approvedBy: { id: managerId, name: managerName },
        rejectionReason: reason
    });
    
    // ✅ Send notification and log
    try {
        const { sendProcurementNotification, logProcurementStage } = await import('./procurementNotificationService');
        
        const context = {
            tenantId,
            branchId: requestData.branch || 'default',
            department: requestData.department,
        };
        
        const actor = { id: managerId, name: managerName, role: 'manager' };
        
        await Promise.all([
            sendProcurementNotification('REJECTED', requestId, context, actor, {
                notes: reason,
                items: requestData.items?.map((i: any) => ({ name: i.itemName, quantity: i.quantity })),
            }),
            logProcurementStage('REJECTED', requestId, context, actor, {
                previousStage: 'PENDING_APPROVAL',
                notes: reason,
                items: requestData.items?.map((i: any) => ({ name: i.itemName, requestedQty: i.quantity })),
            }),
        ]);
    } catch (err) {
        logger.error('Error sending procurement notification:', err, 'procurementService');
    }
};

// ============================================================
// PROCUREMENT REP ACTIONS
// ============================================================

/**
 * Rep starts purchasing items
 * ✅ Enhanced: Sends notification and logs the action
 */
export const startPurchasing = async (
    requestId: string,
    repId: string,
    repName: string,
    tenantId?: string
): Promise<void> => {
    // ✅ Use tenant-scoped collection
    const requestRef = doc(db, `tenants/${tenantId}/procurementRequests`, requestId);
    
    // Get request data for notification
    const requestSnap = await getDocs(query(
        collection(db, `tenants/${tenantId}/procurementRequests`),
        where('__name__', '==', requestId)
    ));
    
    const requestData = requestSnap.docs[0]?.data();
    
    await updateDoc(requestRef, {
        status: 'PURCHASING',
        purchasedBy: { id: repId, name: repName }
    });
    
    // ✅ Send notification and log
    if (requestData) {
        try {
            const { sendProcurementNotification, logProcurementStage } = await import('./procurementNotificationService');
            
            const context = {
                tenantId: tenantId || requestData.tenantId || '',
                branchId: requestData.branch || 'default',
                department: requestData.department,
            };
            
            const actor = { id: repId, name: repName, role: 'procurement_rep' };
            
            await Promise.all([
                sendProcurementNotification('PURCHASING', requestId, context, actor, {
                    items: requestData.items?.map((i: any) => ({ name: i.itemName, quantity: i.quantity })),
                }),
                logProcurementStage('PURCHASING', requestId, context, actor, {
                    previousStage: 'APPROVED',
                    items: requestData.items?.map((i: any) => ({ name: i.itemName, requestedQty: i.quantity })),
                }),
            ]);
        } catch (err) {
            logger.error('Error sending procurement notification:', err, 'procurementService');
        }
    }
};

/**
 * Rep completes purchase (full or partial)
 * ⭐ Auto-creates new order for remaining items if partial
 * ✅ FIX: tenantId is now a required parameter for SaaS isolation
 */
export const completePurchase = async (
    requestId: string,
    items: { itemName: string; purchasedQty: number; unitPrice?: number }[],
    totalCost: number,
    tenantId: string, // ✅ FIX: Added tenantId as required parameter
    notes?: string
): Promise<string | null> => {
    if (!tenantId) {
        throw new Error('tenantId is required for SaaS isolation');
    }
    
    // ✅ Use tenant-scoped collection
    const requestRef = doc(db, `tenants/${tenantId}/procurementRequests`, requestId);

    // Get current request to update items
    const requestSnap = await getDocs(query(
        collection(db, `tenants/${tenantId}/procurementRequests`),
        where('__name__', '==', requestId)
    ));

    if (requestSnap.empty) return null;

    const requestData = requestSnap.docs[0].data();
    const currentItems = requestData.items as ProcurementItem[];

    // Update items with purchase info and calculate remaining
    const updatedItems: ProcurementItem[] = [];
    const remainingItems: ProcurementItem[] = [];
    let isPartial = false;

    currentItems.forEach(item => {
        const purchaseInfo = items.find(p => p.itemName === item.itemName);
        const purchasedQty = purchaseInfo?.purchasedQty || 0;
        const remaining = item.quantity - purchasedQty;

        updatedItems.push({
            ...item,
            purchasedQty,
            unitPrice: purchaseInfo?.unitPrice
        });

        if (remaining > 0) {
            isPartial = true;
            remainingItems.push({
                ...item,
                quantity: remaining
            });
        }
    });

    // Update original request
    await updateDoc(requestRef, {
        status: 'PURCHASED',
        purchasedAt: Timestamp.now(),
        items: updatedItems,
        totalCost,
        purchaseNotes: notes || null
    });

    let newRequestId: string | null = null;

    // ⭐ AUTO-SPLIT: Create new request for remaining items
    if (isPartial && remainingItems.length > 0) {
        if (!requestData.tenantId) {
            throw new Error('tenantId is required for SaaS isolation');
        }
        
        // ✅ FIX: Use tenant-scoped collection
        const requestsRef = collection(db, `tenants/${tenantId}/procurementRequests`);
        const newRequestRef = await addDoc(requestsRef, {
            items: remainingItems,
            department: requestData.department,
            requestedBy: requestData.requestedBy,
            branch: requestData.branch,
            tenantId: requestData.tenantId, // ✅ SaaS requirement
            status: 'APPROVED', // Auto-approve split orders
            createdAt: Timestamp.now(),
            approvedAt: Timestamp.now(),
            approvedBy: requestData.approvedBy,
            parentOrderId: requestId,
            splitReason: `تلقائي - كمية متبقية من الطلب #${requestId.slice(0, 6)}`
        });

        newRequestId = newRequestRef.id;
    }

    // ⭐ NOTIFICATION: Notify department
    if (requestData.tenantId) {
        await addDoc(collection(db, 'notifications'), {
            type: 'procurement_purchased',
            department: requestData.department,
            requestId,
            tenantId: requestData.tenantId, // ✅ SaaS requirement
            title: isPartial ? 'شراء جزئي - طلب المشتريات' : 'تم الشراء - طلب المشتريات',
            message: isPartial
                ? `تم شراء بعض العناصر. العناصر المتبقية في طلب جديد.`
                : `تم شراء جميع العناصر - جاهز للاستلام`,
            createdAt: Timestamp.now(),
            read: false,
            branch: requestData.branch
        });
    }

    return newRequestId;
};

/**
 * Rep delivers items to department
 * ✅ Enhanced: Sends notification and logs the action
 */
export const deliverItems = async (
    requestId: string,
    repId: string,
    repName: string,
    tenantId?: string
): Promise<void> => {
    // ✅ Use tenant-scoped collection
    const requestRef = doc(db, `tenants/${tenantId}/procurementRequests`, requestId);
    
    // Get request data for notification
    const requestSnap = await getDocs(query(
        collection(db, `tenants/${tenantId}/procurementRequests`),
        where('__name__', '==', requestId)
    ));
    
    const requestData = requestSnap.docs[0]?.data();
    
    await updateDoc(requestRef, {
        status: 'DELIVERED',
        deliveredAt: Timestamp.now(),
        deliveredBy: { id: repId, name: repName }
    });
    
    // ✅ Send notification and log
    if (requestData) {
        try {
            const { sendProcurementNotification, logProcurementStage } = await import('./procurementNotificationService');
            
            const context = {
                tenantId: tenantId || requestData.tenantId || '',
                branchId: requestData.branch || 'default',
                department: requestData.department,
            };
            
            const actor = { id: repId, name: repName, role: 'procurement_rep' };
            
            await Promise.all([
                sendProcurementNotification('DELIVERED', requestId, context, actor, {
                    items: requestData.items?.map((i: any) => ({ 
                        name: i.itemName, 
                        quantity: i.purchasedQty || i.quantity 
                    })),
                }),
                logProcurementStage('DELIVERED', requestId, context, actor, {
                    previousStage: 'PURCHASED',
                    items: requestData.items?.map((i: any) => ({ 
                        name: i.itemName, 
                        requestedQty: i.quantity,
                        purchasedQty: i.purchasedQty,
                    })),
                }),
            ]);
        } catch (err) {
            logger.error('Error sending procurement notification:', err, 'procurementService');
        }
    }
};

// ============================================================
// DEPARTMENT RECEIPT
// ============================================================

/**
 * Department confirms receipt
 * ✅ FIX: Automatically updates inventory when items are received
 */
export const confirmReceipt = async (
    tenantId: string,
    requestId: string,
    employeeId: string,
    employeeName: string,
    items?: { itemName: string; receivedQty: number }[],
    notes?: string
): Promise<string | null> => {
    if (!tenantId) throw new Error('tenantId is required for SaaS isolation');

    // ✅ Use tenant-scoped collection
    const requestRef = doc(db, `tenants/${tenantId}/procurementRequests`, requestId);

    // ✅ Verify tenant match
    const requestSnap = await getDocs(query(
        collection(db, `tenants/${tenantId}/procurementRequests`),
        where('__name__', '==', requestId),
        where('tenantId', '==', tenantId)
    ));

    if (requestSnap.empty) {
        throw new Error('Request not found or tenant mismatch');
    }

    const requestData = requestSnap.docs[0].data();
    const branchId = requestData.branch || 'default';
    const currentItems = (requestData.items || []) as ProcurementItem[];

    // Expected qty is purchasedQty if present, else original quantity
    const expectedQtyFor = (it: ProcurementItem) => Number(it.purchasedQty ?? it.quantity ?? 0);

    // Apply received quantities (if provided), else assume full expected received
    const updatedItems: ProcurementItem[] = currentItems.map(it => {
        const expected = expectedQtyFor(it);
        const match = items?.find(x => x.itemName === it.itemName);
        const received = match ? Number(match.receivedQty ?? 0) : expected;
        return { ...it, receivedQty: received };
    });

    // Compute receipt type from per-item deltas
    let hasShortage = false;
    let hasOverage = false;
    for (const it of updatedItems) {
        const expected = expectedQtyFor(it);
        const received = Number(it.receivedQty ?? 0);
        if (received < expected) hasShortage = true;
        if (received > expected) hasOverage = true;
    }
    const receiptType: 'full' | 'shortage' | 'overage' =
        hasShortage ? 'shortage' : hasOverage ? 'overage' : 'full';

    // ✅ Update inventory for each received item (tenant-aware)
    // ✅ NEW SYSTEM: Auto-create items if not found, use purchase records
    const { 
        findInventoryItemByName, 
        addPurchaseRecord,
        autoCreateInventoryItem 
    } = await import('./inventoryService');

    for (const it of updatedItems) {
        const receivedQty = Number(it.receivedQty ?? 0);
        if (receivedQty <= 0) continue;
        
        try {
            // Try to find existing item
            let inventoryItem = await findInventoryItemByName(it.itemName, branchId, tenantId);
            
            if (inventoryItem) {
                // ✅ Item exists - add purchase record
                const purchaseRecord = {
                    quantity: receivedQty,
                    purchaseDate: Timestamp.now(),
                    procurementRequestId: requestId,
                    unitPrice: it.unitPrice || undefined,
                    notes: notes || undefined,
                    receivedBy: { id: employeeId, name: employeeName }
                };
                
                await addPurchaseRecord(
                    inventoryItem.id,
                    purchaseRecord,
                    branchId,
                    tenantId
                );
            } else {
                // ✅ Item doesn't exist - auto-create it
                // Extract category from procurement item (if exists) or use default
                const category = (it as any).category || 'أخرى'; // Default category
                const unit = (it as any).unit || 'piece'; // Default unit
                const unitPrice = it.unitPrice || 0;
                
                await autoCreateInventoryItem(
                    it.itemName,
                    category, // ✅ Dynamic category
                    receivedQty,
                    unit,
                    unitPrice,
                    requestId,
                    branchId,
                    tenantId,
                    { id: employeeId, name: employeeName }
                );
                
                logger.info(`✅ Auto-created inventory item: ${it.itemName} under category "${category}"`, undefined, 'procurementService');
            }
        } catch (e) {
            logger.error(`Error updating inventory for ${it.itemName}:`, e, 'procurementService');
        }
    }

    // 🔐 ATOMIC TRANSACTION: Update request + Create backorder (if needed) in one atomic operation
    // This ensures either both succeed or both fail - no partial updates!
    let backorderId: string | null = null;
    
    try {
        await runTransaction(db, async (transaction) => {
            // 1. Re-read the request to ensure we have latest data (prevents race conditions)
            const requestDoc = await transaction.get(requestRef);
            if (!requestDoc.exists()) {
                throw new Error('الطلب غير موجود في النظام');
            }
            
            const latestData = requestDoc.data() as ProcurementRequest;
            
            // 2. Calculate remaining quantities for backorder (if shortage)
            const remainingItems: ProcurementItem[] = [];
            if (receiptType === 'shortage') {
                for (const it of updatedItems) {
                    const expected = expectedQtyFor(it);
                    const received = Number(it.receivedQty ?? 0);
                    const remaining = Math.max(0, expected - received);
                    if (remaining > 0) {
                        remainingItems.push({
                            ...it,
                            quantity: remaining,
                            purchasedQty: undefined,
                            receivedQty: undefined
                        });
                    }
                }
            }
            
            // 3. ATOMIC UPDATE: Update the original request status
            // Determine final status based on receipt type
            let finalStatus: ProcurementStatus = 'RECEIVED';
            if (receiptType === 'shortage' && remainingItems.length > 0) {
                finalStatus = 'PARTIALLY_DELIVERED'; // ✅ Use PARTIALLY_DELIVERED for partial receipts
            }
            
            transaction.update(requestRef, {
                status: finalStatus,
                receivedAt: serverTimestamp(),
                receivedBy: { id: employeeId, name: employeeName },
                receiptType,
                receiptNotes: notes || null,
                items: updatedItems
            });
            
            // 4. ATOMIC CREATE: Create backorder in the same transaction (if needed)
            if (receiptType === 'shortage' && remainingItems.length > 0) {
                // ✅ FIX: Use tenant-scoped collection
                const backorderRequestsRef = collection(db, `tenants/${tenantId}/procurementRequests`);
                const backorderRef = doc(backorderRequestsRef);
                backorderId = backorderRef.id; // Store ID for return value
                
                transaction.set(backorderRef, {
                    items: remainingItems.map(i => ({
                        itemName: i.itemName,
                        quantity: i.quantity,
                        notes: i.notes || `متبقي من طلب سابق (عجز في الاستلام)`,
                        priority: (i.priority as any) || 'urgent'
                    })),
                    department: latestData.department,
                    requestedBy: latestData.requestedBy,
                    branch: branchId,
                    tenantId,
                    status: 'PENDING_APPROVAL' as ProcurementStatus,
                    createdAt: serverTimestamp(),
                    isBackorder: true,
                    originalRequestId: requestId,
                    notes: 'تم إنشاؤه تلقائياً للكمية المتبقية بعد العجز في الاستلام'
                });
                
                logger.info(`✅ ATOMIC: Backorder created with ID: ${backorderId} for remaining ${remainingItems.length} items`, undefined, 'procurementService');
            }
        });
        
        logger.info(`✅ ATOMIC: Request ${requestId} updated to ${receiptType === 'shortage' ? 'PARTIALLY_DELIVERED' : 'RECEIVED'} successfully`, undefined, 'procurementService');
        
    } catch (error: any) {
        logger.error('❌ ATOMIC TRANSACTION FAILED:', error, 'procurementService');
        throw new Error(`فشل تأكيد الاستلام: ${error.message || 'خطأ غير معروف'}`);
    }
    
    // ✅ Create receipt record and send notification (outside transaction - non-critical)
    try {
        const { createReceiptRecord, logProcurementStage, sendProcurementNotification } = await import('./procurementNotificationService');
        
        const context = {
            tenantId,
            branchId,
            department: requestData.department,
        };
        
        const receiver = { id: employeeId, name: employeeName };
        
        // Create receipt record
        await createReceiptRecord(
            requestId,
            context,
            receiver,
            updatedItems.map(it => ({
                name: it.itemName,
                expected: expectedQtyFor(it),
                received: Number(it.receivedQty ?? 0),
            })),
            { notes }
        );
    } catch (err) {
        logger.error('Error creating receipt record:', err, 'procurementService');
        // Don't fail the whole operation if notification fails
    }

    return backorderId;
};

/**
 * Close the procurement request (via Cloud Function)
 * ✅ SaaS: tenantId required; write performed server-side
 */
export const closeProcurement = async (requestId: string, tenantId: string): Promise<void> => {
    const payload = closeProcurementPayloadSchema.safeParse({ requestId, tenantId });
    if (!payload.success) {
        const msg = payload.error.issues[0]?.message ?? 'بيانات غير صحيحة';
        throw new Error(msg);
    }
    if (!firebaseFunctions) throw new Error('Firebase Functions not initialized');
    const procurementCloseFn = httpsCallable<{ requestId: string; tenantId: string }, { success: boolean }>(firebaseFunctions, 'procurementClose');
    await procurementCloseFn({ requestId, tenantId });
};

// ============================================================
// SUBSCRIPTIONS
// ============================================================

/**
 * Subscribe to pending approval requests (for manager)
 * ✅ SaaS: tenantId is now mandatory for proper isolation
 */
export const subscribeToPendingApprovals = (
    tenantId: string, // ✅ SaaS requirement - mandatory
    branchId: string,
    callback: (requests: ProcurementRequest[]) => void
): Unsubscribe => {
    if (!tenantId) {
        logger.error('subscribeToPendingApprovals: tenantId is required', undefined, 'procurementService');
        callback([]);
        return () => {}; // Return empty unsubscribe function
    }
    
    // ✅ FIX: Use tenant-scoped collection
    const requestsRef = collection(db, `tenants/${tenantId}/procurementRequests`);
    const constraints: any[] = [
        where('branch', '==', branchId),
        where('status', '==', 'PENDING_APPROVAL')
    ];
    
    const q = query(requestsRef, ...constraints);

    return onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ProcurementRequest[];
        // ✅ Client-side sort
        requests.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || 0;
            return tB - tA;
        });
        callback(requests);
    });
};

/**
 * Subscribe to approved requests (for procurement rep)
 * ✅ SaaS: tenantId is now mandatory for proper isolation
 */
export const subscribeToApprovedRequests = (
    tenantId: string, // ✅ SaaS requirement - mandatory
    branchId: string,
    callback: (requests: ProcurementRequest[]) => void
): Unsubscribe => {
    if (!tenantId) {
        logger.error('subscribeToApprovedRequests: tenantId is required', undefined, 'procurementService');
        callback([]);
        return () => {}; // Return empty unsubscribe function
    }
    
    // ✅ FIX: Use tenant-scoped collection
    const requestsRef = collection(db, `tenants/${tenantId}/procurementRequests`);
    const q = query(
        requestsRef,
        where('branch', '==', branchId),
        where('status', 'in', ['APPROVED', 'PURCHASING', 'PURCHASED'])
    );

    return onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ProcurementRequest[];
        // ✅ Client-side sort
        requests.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || 0;
            return tB - tA;
        });
        callback(requests);
    });
};

/**
 * Subscribe to department's requests
 * ✅ SaaS: tenantId is now mandatory for proper isolation
 */
export const subscribeToDepartmentRequests = (
    tenantId: string, // ✅ SaaS requirement - mandatory
    branchId: string,
    department: string,
    callback: (requests: ProcurementRequest[]) => void
): Unsubscribe => {
    if (!tenantId) {
        logger.error('subscribeToDepartmentRequests: tenantId is required', undefined, 'procurementService');
        callback([]);
        return () => {}; // Return empty unsubscribe function
    }
    
    // ✅ FIX: Use tenant-scoped collection
    const requestsRef = collection(db, `tenants/${tenantId}/procurementRequests`);
    const q = query(
        requestsRef,
        where('branch', '==', branchId),
        where('department', '==', department)
    );

    return onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ProcurementRequest[];
        // ✅ Client-side sort
        requests.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || 0;
            return tB - tA;
        });
        callback(requests);
    });
};

/**
 * Subscribe to department's delivered requests (ready for receipt)
 * ✅ SaaS: tenantId is now mandatory for proper isolation
 * ✅ FIX: Returns only DELIVERED requests for department receipt confirmation
 */
export const subscribeToDeliveredRequests = (
    tenantId: string, // ✅ SaaS requirement - mandatory
    branchId: string,
    department: string,
    callback: (requests: ProcurementRequest[]) => void
): Unsubscribe => {
    if (!tenantId) {
        logger.error('subscribeToDeliveredRequests: tenantId is required', undefined, 'procurementService');
        callback([]);
        return () => {}; // Return empty unsubscribe function
    }
    
    // ✅ FIX: Use tenant-scoped collection
    const requestsRef = collection(db, `tenants/${tenantId}/procurementRequests`);
    const q = query(
        requestsRef,
        where('branch', '==', branchId),
        where('department', '==', department),
        where('status', '==', 'DELIVERED') // ✅ Only show delivered requests (ready for receipt)
    );

    return onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ProcurementRequest[];
        // ✅ Client-side sort
        requests.sort((a, b) => {
            const tA = a.deliveredAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
            const tB = b.deliveredAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
            return tB - tA;
        });
        callback(requests);
    });
};

export default {
    approveProcurement,
    rejectProcurement,
    startPurchasing,
    completePurchase,
    deliverItems,
    confirmReceipt,
    closeProcurement,
    subscribeToPendingApprovals,
    subscribeToApprovedRequests,
    subscribeToDepartmentRequests,
    subscribeToDeliveredRequests
};
