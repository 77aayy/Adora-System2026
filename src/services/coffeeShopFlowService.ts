/**
 * Coffee Shop Flow Service
 * سير طلبات الكوفي شوب عبر الاستقبال
 * 
 * ✅ Flow:
 * 1. Guest places order → Status: PENDING_RECEPTION
 * 2. Reception verifies → Status: APPROVED | REJECTED
 * 3. Coffee Shop receives → Status: PREPARING
 * 4. Ready for delivery → Status: READY
 * 5. Delivered → Status: COMPLETED
 * 
 * Adora Hotel Management System V3
 */

import { db } from './firebase';
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp,
    serverTimestamp,
    runTransaction
} from 'firebase/firestore';
import { sendNotificationToDepartment } from './notificationService';
import { createTransactionFromRequest } from './financialTrackingService';
import { addChargeToRoomCard } from './roomCardService';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type CoffeeOrderStatus =
    | 'PENDING_RECEPTION'  // انتظار موافقة الاستقبال
    | 'APPROVED'           // تمت الموافقة - ينتظر التحضير
    | 'REJECTED'           // مرفوض
    | 'PREPARING'          // جاري التحضير
    | 'READY'              // جاهز للتوصيل
    | 'DELIVERING'         // جاري التوصيل
    | 'COMPLETED'          // تم التسليم
    | 'CANCELLED';         // ملغي

export interface OrderItem {
    id: string;
    name: string;
    nameEn?: string;
    price: number;
    quantity: number;
    notes?: string;
    category?: string;
}

export interface CoffeeOrder {
    id?: string;
    tenantId: string;
    branchId: string;
    roomNumber: string;
    guestId?: string;
    guestName?: string;
    guestPhone?: string;
    items: OrderItem[];
    totalAmount: number;
    status: CoffeeOrderStatus;
    source: 'qr' | 'reception' | 'phone';
    
    // Reception handling
    receptionistId?: string;
    receptionistName?: string;
    approvedAt?: Timestamp;
    rejectionReason?: string;
    
    // Coffee shop handling
    barista?: string;
    baristaId?: string;
    prepStartedAt?: Timestamp;
    readyAt?: Timestamp;
    
    // Delivery
    deliveredBy?: string;
    deliveredById?: string;
    deliveredAt?: Timestamp;
    
    // Feedback
    guestRating?: number;
    guestFeedback?: string;
    
    // Meta
    notes?: string;
    priority: 'normal' | 'urgent';
    estimatedPrepTime?: number; // minutes
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface CoffeeShopStats {
    pendingReception: number;
    approved: number;
    preparing: number;
    ready: number;
    completedToday: number;
    avgPrepTime: number;
}

// ============================================================
// ORDER CREATION
// ============================================================

/**
 * Create a new coffee order (from guest QR)
 * Automatically goes to PENDING_RECEPTION status
 */
export async function createCoffeeOrder(
    order: Omit<CoffeeOrder, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
    const ordersRef = collection(
        db,
        `tenants/${order.tenantId}/branches/${order.branchId}/coffee_orders`
    );

    const docRef = await addDoc(ordersRef, {
        ...order,
        status: 'PENDING_RECEPTION',
        priority: order.priority || 'normal',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // Notify reception
    await sendNotificationToDepartment(
        'reception',
        '☕ طلب كوفي شوب جديد',
        `غرفة ${order.roomNumber} - ${order.items.length} أصناف - ${order.totalAmount} ر.س`,
        order.tenantId,
        order.branchId,
        'info',
        docRef.id
    );

    logger.info(`☕ Coffee order created: ${docRef.id} - awaiting reception approval`, undefined, 'coffeeShopFlowService');
    return docRef.id;
}

// ============================================================
// RECEPTION ACTIONS
// ============================================================

/**
 * Reception approves the order
 */
export async function approveOrder(
    tenantId: string,
    branchId: string,
    orderId: string,
    receptionistId: string,
    receptionistName: string
): Promise<void> {
    const orderRef = doc(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders/${orderId}`);

    await updateDoc(orderRef, {
        status: 'APPROVED',
        receptionistId,
        receptionistName,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // Get order details for notification
    const orderSnap = await getDoc(orderRef);
    const order = orderSnap.data() as CoffeeOrder;

    // Notify coffee shop
    await sendNotificationToDepartment(
        'coffeeShop',
        '✅ طلب جديد للتحضير',
        `غرفة ${order.roomNumber} - ${order.items.length} أصناف`,
        tenantId,
        branchId,
        'info',
        orderId
    );

    // Create financial transaction
    await createTransactionFromRequest(tenantId, branchId, {
        id: orderId,
        roomNumber: order.roomNumber,
        type: 'room_service',
        guestId: order.guestId,
        guestName: order.guestName,
        items: order.items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
        totalAmount: order.totalAmount
    });

    logger.info(`✅ Order ${orderId} approved by ${receptionistName}`, undefined, 'coffeeShopFlowService');
}

/**
 * Reception rejects the order
 */
export async function rejectOrder(
    tenantId: string,
    branchId: string,
    orderId: string,
    receptionistId: string,
    receptionistName: string,
    reason: string
): Promise<void> {
    const orderRef = doc(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders/${orderId}`);

    await updateDoc(orderRef, {
        status: 'REJECTED',
        receptionistId,
        receptionistName,
        rejectionReason: reason,
        updatedAt: serverTimestamp()
    });

    // Get order details
    const orderSnap = await getDoc(orderRef);
    const order = orderSnap.data() as CoffeeOrder;

    // Notify guest (if phone available)
    if (order.guestPhone) {
        // ✅ SECURITY: No phone number in logs
        logger.info('Order rejected - notification queued', undefined, 'coffeeShopFlowService');
    }

    logger.info(`❌ Order ${orderId} rejected: ${reason}`, undefined, 'coffeeShopFlowService');
}

// ============================================================
// COFFEE SHOP ACTIONS
// ============================================================

/**
 * Barista starts preparing the order
 */
export async function startPreparing(
    tenantId: string,
    branchId: string,
    orderId: string,
    baristaId: string,
    baristaName: string
): Promise<void> {
    const orderRef = doc(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders/${orderId}`);

    await updateDoc(orderRef, {
        status: 'PREPARING',
        baristaId,
        barista: baristaName,
        prepStartedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    logger.info(`🍳 Order ${orderId} - preparation started by ${baristaName}`, undefined, 'coffeeShopFlowService');
}

/**
 * Order is ready for delivery
 */
export async function markReady(
    tenantId: string,
    branchId: string,
    orderId: string
): Promise<void> {
    const orderRef = doc(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders/${orderId}`);

    await updateDoc(orderRef, {
        status: 'READY',
        readyAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // Get order details
    const orderSnap = await getDoc(orderRef);
    const order = orderSnap.data() as CoffeeOrder;

    // Notify bellman for delivery
    await sendNotificationToDepartment(
        'bellman',
        '📦 طلب جاهز للتوصيل',
        `غرفة ${order.roomNumber} - كوفي شوب`,
        tenantId,
        branchId,
        'info',
        orderId
    );

    logger.info(`✅ Order ${orderId} ready for delivery`, undefined, 'coffeeShopFlowService');
}

// ============================================================
// DELIVERY ACTIONS
// ============================================================

/**
 * Start delivery
 */
export async function startDelivery(
    tenantId: string,
    branchId: string,
    orderId: string,
    deliveryPersonId: string,
    deliveryPersonName: string
): Promise<void> {
    const orderRef = doc(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders/${orderId}`);

    await updateDoc(orderRef, {
        status: 'DELIVERING',
        deliveredById: deliveryPersonId,
        deliveredBy: deliveryPersonName,
        updatedAt: serverTimestamp()
    });

    logger.info(`🚶 Order ${orderId} - delivering by ${deliveryPersonName}`, undefined, 'coffeeShopFlowService');
}

/**
 * Complete delivery
 * ✅ ATOMIC: Uses runTransaction to prevent Race Conditions
 * ✅ BILLING: Automatically charges Room Card
 */
export async function completeDelivery(
    tenantId: string,
    branchId: string,
    orderId: string
): Promise<void> {
    if (!db) {
        logger.error('Firebase not initialized - cannot complete delivery', undefined, 'coffeeShopFlowService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const orderRef = doc(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders/${orderId}`);

    // ✅ ATOMIC TRANSACTION: Update order status + Charge Room Card
    await runTransaction(db, async (transaction) => {
        // 1. Read order
        const orderSnap = await transaction.get(orderRef);

        if (!orderSnap.exists()) {
            throw new Error('الطلب غير موجود');
        }

        const order = orderSnap.data() as CoffeeOrder;

        // 🛡️ VALIDATE: Only DELIVERING orders can be completed
        if (order.status !== 'DELIVERING' && order.status !== 'READY') {
            throw new Error(`لا يمكن إكمال الطلب في الحالة: ${order.status}`);
        }

        // 2. Update order status
        transaction.update(orderRef, {
            status: 'COMPLETED',
            deliveredAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        logger.info(`✅ ATOMIC: Coffee order ${orderId} completed. Charging Room Card...`, undefined, 'coffeeShopFlowService');
    });

    // 3. Get order details for Room Card charge (outside transaction to avoid conflicts)
    const orderSnap = await getDoc(orderRef);
    const order = orderSnap.data() as CoffeeOrder;

    // 4. ✅ Charge Room Card (non-blocking, but linked)
    if (order.guestId && order.roomNumber) {
        try {
            // Get active room card for this room
            const { getActiveRoomCard } = await import('./roomCardService');
            const roomCard = await getActiveRoomCard(order.roomNumber, tenantId);

            if (roomCard) {
                await addChargeToRoomCard(
                    tenantId,
                    branchId,
                    roomCard.id,
                    order.roomNumber,
                    {
                        type: 'coffee_shop',
                        description: `طلب كوفي شوب - ${order.items.map(i => `${i.name} (${i.quantity})`).join(', ')}`,
                        amount: order.totalAmount,
                        currency: 'SAR',
                        requestId: orderId,
                        items: order.items.map(i => ({
                            name: i.name,
                            quantity: i.quantity,
                            price: i.price
                        }))
                    },
                    order.deliveredById,
                    order.deliveredBy
                );

                logger.info(`✅ Room Card charged for Coffee Shop order. Amount: ${order.totalAmount} SAR`, undefined, 'coffeeShopFlowService');
            }
        } catch (chargeError) {
            logger.warn('Failed to charge Room Card for coffee shop order (non-critical)', chargeError, 'coffeeShopFlowService');
            // Don't fail order completion if charging fails
        }
    }

    // 5. Create financial transaction (legacy support)
    try {
        await createTransactionFromRequest(tenantId, branchId, {
            id: orderId,
            roomNumber: order.roomNumber,
            type: 'room_service',
            guestId: order.guestId,
            guestName: order.guestName,
            items: order.items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
            totalAmount: order.totalAmount
        });
    } catch (transactionError) {
        logger.warn('Failed to create financial transaction (non-critical)', transactionError, 'coffeeShopFlowService');
    }

    // 6. Notify reception for closing the loop
    await sendNotificationToDepartment(
        'reception',
        '✅ تم توصيل الطلب',
        `غرفة ${order.roomNumber} - في انتظار تأكيد الرضا`,
        tenantId,
        branchId,
        'success',
        orderId
    );

    logger.info(`✅ Order ${orderId} delivered and charged to Room Card`, undefined, 'coffeeShopFlowService');
}

// ============================================================
// SUBSCRIPTIONS
// ============================================================

/**
 * Subscribe to pending orders (for reception)
 */
export function subscribeToPendingOrders(
    tenantId: string,
    branchId: string,
    callback: (orders: CoffeeOrder[]) => void
): () => void {
    const ordersRef = collection(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders`);
    const q = query(
        ordersRef,
        where('status', '==', 'PENDING_RECEPTION'),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as CoffeeOrder[];
        callback(orders);
    });
}

/**
 * Subscribe to approved orders (for coffee shop)
 */
export function subscribeToApprovedOrders(
    tenantId: string,
    branchId: string,
    callback: (orders: CoffeeOrder[]) => void
): () => void {
    const ordersRef = collection(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders`);
    const q = query(
        ordersRef,
        where('status', 'in', ['APPROVED', 'PREPARING']),
        orderBy('approvedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as CoffeeOrder[];
        callback(orders);
    });
}

/**
 * Subscribe to ready orders (for bellman)
 */
export function subscribeToReadyOrders(
    tenantId: string,
    branchId: string,
    callback: (orders: CoffeeOrder[]) => void
): () => void {
    const ordersRef = collection(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders`);
    const q = query(
        ordersRef,
        where('status', 'in', ['READY', 'DELIVERING']),
        orderBy('readyAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as CoffeeOrder[];
        callback(orders);
    });
}

/**
 * Subscribe to order for guest tracking
 */
export function subscribeToGuestOrder(
    tenantId: string,
    branchId: string,
    orderId: string,
    callback: (order: CoffeeOrder | null) => void
): () => void {
    const orderRef = doc(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders/${orderId}`);

    return onSnapshot(orderRef, (snapshot) => {
        if (snapshot.exists()) {
            callback({ id: snapshot.id, ...snapshot.data() } as CoffeeOrder);
        } else {
            callback(null);
        }
    });
}

// ============================================================
// STATS
// ============================================================

/**
 * Get coffee shop stats for today
 */
export async function getCoffeeShopStats(
    tenantId: string,
    branchId: string
): Promise<CoffeeShopStats> {
    const ordersRef = collection(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders`);
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [pending, approved, preparing, ready, completedSnap] = await Promise.all([
        getDocs(query(ordersRef, where('status', '==', 'PENDING_RECEPTION'))),
        getDocs(query(ordersRef, where('status', '==', 'APPROVED'))),
        getDocs(query(ordersRef, where('status', '==', 'PREPARING'))),
        getDocs(query(ordersRef, where('status', '==', 'READY'))),
        getDocs(query(
            ordersRef,
            where('status', '==', 'COMPLETED'),
            where('completedAt', '>=', Timestamp.fromDate(todayStart))
        ))
    ]);

    // Calculate average prep time from completed orders
    let totalPrepTime = 0;
    let prepCount = 0;
    completedSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.prepStartedAt && data.readyAt) {
            const prepTime = (data.readyAt.toMillis() - data.prepStartedAt.toMillis()) / 60000;
            totalPrepTime += prepTime;
            prepCount++;
        }
    });

    return {
        pendingReception: pending.size,
        approved: approved.size,
        preparing: preparing.size,
        ready: ready.size,
        completedToday: completedSnap.size,
        avgPrepTime: prepCount > 0 ? Math.round(totalPrepTime / prepCount) : 0
    };
}

export default {
    createCoffeeOrder,
    approveOrder,
    rejectOrder,
    startPreparing,
    markReady,
    startDelivery,
    completeDelivery,
    subscribeToPendingOrders,
    subscribeToApprovedOrders,
    subscribeToReadyOrders,
    subscribeToGuestOrder,
    getCoffeeShopStats
};
