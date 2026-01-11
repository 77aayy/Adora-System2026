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
    serverTimestamp
} from 'firebase/firestore';
import { sendNotification } from './notificationService';
import { createTransactionFromRequest } from './financialTrackingService';

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
    await sendNotification(order.tenantId, order.branchId, 'reception', {
        type: 'coffee_order',
        title: '☕ طلب كوفي شوب جديد',
        body: `غرفة ${order.roomNumber} - ${order.items.length} أصناف - ${order.totalAmount} ر.س`,
        data: { orderId: docRef.id, roomNumber: order.roomNumber }
    });

    console.log(`☕ Coffee order created: ${docRef.id} - awaiting reception approval`);
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
    await sendNotification(tenantId, branchId, 'coffee_shop', {
        type: 'order_approved',
        title: '✅ طلب جديد للتحضير',
        body: `غرفة ${order.roomNumber} - ${order.items.length} أصناف`,
        data: { orderId, roomNumber: order.roomNumber },
        sound: 'order_new.mp3'
    });

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

    console.log(`✅ Order ${orderId} approved by ${receptionistName}`);
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
        console.log(`📱 Would notify guest about rejection: ${order.guestPhone}`);
    }

    console.log(`❌ Order ${orderId} rejected: ${reason}`);
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

    console.log(`🍳 Order ${orderId} - preparation started by ${baristaName}`);
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
    await sendNotification(tenantId, branchId, 'bellman', {
        type: 'delivery_ready',
        title: '📦 طلب جاهز للتوصيل',
        body: `غرفة ${order.roomNumber} - كوفي شوب`,
        data: { orderId, roomNumber: order.roomNumber }
    });

    console.log(`✅ Order ${orderId} ready for delivery`);
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

    console.log(`🚶 Order ${orderId} - delivering by ${deliveryPersonName}`);
}

/**
 * Complete delivery
 */
export async function completeDelivery(
    tenantId: string,
    branchId: string,
    orderId: string
): Promise<void> {
    const orderRef = doc(db, `tenants/${tenantId}/branches/${branchId}/coffee_orders/${orderId}`);

    await updateDoc(orderRef, {
        status: 'COMPLETED',
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // Get order for notification
    const orderSnap = await getDoc(orderRef);
    const order = orderSnap.data() as CoffeeOrder;

    // Notify reception for closing the loop
    await sendNotification(tenantId, branchId, 'reception', {
        type: 'order_completed',
        title: '✅ تم توصيل الطلب',
        body: `غرفة ${order.roomNumber} - في انتظار تأكيد الرضا`,
        data: { orderId, roomNumber: order.roomNumber }
    });

    console.log(`✅ Order ${orderId} delivered`);
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
