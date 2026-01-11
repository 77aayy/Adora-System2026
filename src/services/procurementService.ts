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
    getDocs,
    Timestamp,
    orderBy,
    Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';

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
    | 'RECEIVED'          // Department confirmed receipt
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
// MANAGER ACTIONS
// ============================================================

/**
 * Manager approves a procurement request
 * ✅ SaaS: Requires tenantId for security validation
 * ✅ Enhanced: Sends notification and logs the action
 */
export const approveProcurement = async (
    requestId: string,
    managerId: string,
    managerName: string,
    tenantId: string // ✅ SaaS requirement
): Promise<void> => {
    if (!tenantId) throw new Error('tenantId is required for SaaS isolation');
    
    const requestRef = doc(db, 'procurementRequests', requestId);
    
    // ✅ Verify tenantId matches before approving
    const requestSnap = await getDocs(query(
        collection(db, 'procurementRequests'),
        where('__name__', '==', requestId),
        where('tenantId', '==', tenantId)
    ));
    
    if (requestSnap.empty) {
        throw new Error('Request not found or tenant mismatch');
    }
    
    const requestData = requestSnap.docs[0].data();
    
    await updateDoc(requestRef, {
        status: 'APPROVED',
        approvedAt: Timestamp.now(),
        approvedBy: { id: managerId, name: managerName }
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
            sendProcurementNotification('APPROVED', requestId, context, actor, {
                items: requestData.items?.map((i: any) => ({ name: i.itemName, quantity: i.quantity })),
            }),
            logProcurementStage('APPROVED', requestId, context, actor, {
                previousStage: 'PENDING_APPROVAL',
                items: requestData.items?.map((i: any) => ({ name: i.itemName, requestedQty: i.quantity })),
            }),
        ]);
    } catch (err) {
        console.error('Error sending procurement notification:', err);
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
    
    const requestRef = doc(db, 'procurementRequests', requestId);
    
    // ✅ Verify tenantId matches before rejecting
    const requestSnap = await getDocs(query(
        collection(db, 'procurementRequests'),
        where('__name__', '==', requestId),
        where('tenantId', '==', tenantId)
    ));
    
    if (requestSnap.empty) {
        throw new Error('Request not found or tenant mismatch');
    }
    
    const requestData = requestSnap.docs[0].data();
    
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
        console.error('Error sending procurement notification:', err);
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
    const requestRef = doc(db, 'procurementRequests', requestId);
    
    // Get request data for notification
    const requestSnap = await getDocs(query(
        collection(db, 'procurementRequests'),
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
            console.error('Error sending procurement notification:', err);
        }
    }
};

/**
 * Rep completes purchase (full or partial)
 * ⭐ Auto-creates new order for remaining items if partial
 */
export const completePurchase = async (
    requestId: string,
    items: { itemName: string; purchasedQty: number; unitPrice?: number }[],
    totalCost: number,
    notes?: string
): Promise<string | null> => {
    const requestRef = doc(db, 'procurementRequests', requestId);

    // Get current request to update items
    const requestSnap = await getDocs(query(
        collection(db, 'procurementRequests'),
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
        
        const newRequestRef = await addDoc(collection(db, 'procurementRequests'), {
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
    const requestRef = doc(db, 'procurementRequests', requestId);
    
    // Get request data for notification
    const requestSnap = await getDocs(query(
        collection(db, 'procurementRequests'),
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
            console.error('Error sending procurement notification:', err);
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

    const requestRef = doc(db, 'procurementRequests', requestId);

    // ✅ Verify tenant match
    const requestSnap = await getDocs(query(
        collection(db, 'procurementRequests'),
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
                
                console.log(`✅ Auto-created inventory item: ${it.itemName} under category "${category}"`);
            }
        } catch (e) {
            console.error(`Error updating inventory for ${it.itemName}:`, e);
        }
    }

    // Update procurement request status
    await updateDoc(requestRef, {
        status: 'RECEIVED',
        receivedAt: Timestamp.now(),
        receivedBy: { id: employeeId, name: employeeName },
        receiptType,
        receiptNotes: notes || null,
        items: updatedItems
    });
    
    // ✅ Create receipt record and send notification
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
        console.error('Error creating receipt record:', err);
    }

    // ✅ Auto-backorder on shortage (remaining quantities)
    if (receiptType === 'shortage') {
        const remainingItems: ProcurementItem[] = [];
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

        if (remainingItems.length > 0) {
            const newRef = await addDoc(collection(db, 'procurementRequests'), {
                items: remainingItems.map(i => ({
                    itemName: i.itemName,
                    quantity: i.quantity,
                    notes: i.notes || `متبقي من طلب سابق (عجز في الاستلام)`,
                    priority: (i.priority as any) || 'urgent'
                })),
                department: requestData.department,
                requestedBy: requestData.requestedBy,
                branch: branchId,
                tenantId,
                status: 'PENDING_APPROVAL',
                createdAt: Timestamp.now(),
                isBackorder: true,
                originalRequestId: requestId,
                notes: 'تم إنشاؤه تلقائياً للكمية المتبقية بعد العجز في الاستلام'
            });
            return newRef.id;
        }
    }

    return null;
};

/**
 * Close the procurement request
 */
export const closeProcurement = async (requestId: string): Promise<void> => {
    const requestRef = doc(db, 'procurementRequests', requestId);
    await updateDoc(requestRef, {
        status: 'COMPLETED'
    });
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
        console.error('subscribeToPendingApprovals: tenantId is required');
        callback([]);
        return () => {}; // Return empty unsubscribe function
    }
    
    const requestsRef = collection(db, 'procurementRequests');
    const constraints: any[] = [
        where('tenantId', '==', tenantId), // ✅ SaaS requirement - mandatory filter
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
        console.error('subscribeToApprovedRequests: tenantId is required');
        callback([]);
        return () => {}; // Return empty unsubscribe function
    }
    
    const requestsRef = collection(db, 'procurementRequests');
    const q = query(
        requestsRef,
        where('tenantId', '==', tenantId), // ✅ SaaS requirement - mandatory filter
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
        console.error('subscribeToDepartmentRequests: tenantId is required');
        callback([]);
        return () => {}; // Return empty unsubscribe function
    }
    
    const requestsRef = collection(db, 'procurementRequests');
    const q = query(
        requestsRef,
        where('tenantId', '==', tenantId), // ✅ SaaS requirement - mandatory filter
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
    subscribeToDepartmentRequests
};
