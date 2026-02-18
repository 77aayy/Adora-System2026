/**
 * Coffee Shop Service
 * Manage coffee shop products and orders
 * Adora Hotel Management System V2
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp,
    Unsubscribe,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { transferRequestToDepartment } from './requestService';

// ============================================================
// TYPES
// ============================================================

export interface CoffeeShopProduct {
    id: string;
    name: string;
    nameEn?: string;
    description?: string;
    price: number;
    imageUrl?: string;
    category: 'beverages' | 'snacks' | 'desserts' | 'meals' | 'other';
    isActive: boolean;
    branch: string;
    tenantId: string;
    createdAt: any;
    updatedAt: any;
}

export interface CoffeeShopOrderItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

export interface CoffeeShopOrder {
    id: string;
    requestId: string; // Link to main request
    items: CoffeeShopOrderItem[];
    totalAmount: number;
    roomNumber: string;
    guestName?: string;
    guestIdentity?: string;
    source: 'reception' | 'qr'; // Reception direct or QR code
    status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
    confirmedAt?: any;
    confirmedBy?: { id: string; name: string };
    completedAt?: any;
    completedBy?: { id: string; name: string };
    branch: string;
    tenantId: string;
    createdAt: any;
    notes?: string;
}

// ============================================================
// PRODUCTS MANAGEMENT
// ============================================================

/**
 * Subscribe to coffee shop products
 */
export const subscribeToProducts = (
    branchId: string,
    tenantId: string,
    callback: (products: CoffeeShopProduct[]) => void
): Unsubscribe => {
    const q = query(
        collection(db, 'coffeeShopProducts'),
        where('branch', '==', branchId),
        where('tenantId', '==', tenantId),
        where('isActive', '==', true),
        orderBy('category'),
        orderBy('name')
    );

    return onSnapshot(q, (snapshot) => {
        const products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as CoffeeShopProduct[];
        callback(products);
    });
};

/**
 * Get single product
 */
export const getProduct = async (productId: string): Promise<CoffeeShopProduct | null> => {
    const docRef = doc(db, 'coffeeShopProducts', productId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as CoffeeShopProduct;
    }
    return null;
};

/**
 * Add product
 */
export const addProduct = async (
    product: Omit<CoffeeShopProduct, 'id' | 'createdAt' | 'updatedAt'>,
    tenantId: string
): Promise<string> => {
    const docRef = await addDoc(collection(db, 'coffeeShopProducts'), {
        ...product,
        tenantId,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
};

/**
 * Update product
 */
export const updateProduct = async (
    productId: string,
    updates: Partial<CoffeeShopProduct>
): Promise<void> => {
    const docRef = doc(db, 'coffeeShopProducts', productId);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

/**
 * Delete product (soft delete)
 */
export const deleteProduct = async (productId: string): Promise<void> => {
    await updateDoc(doc(db, 'coffeeShopProducts', productId), {
        isActive: false,
        updatedAt: serverTimestamp()
    });
};

// ============================================================
// ORDERS MANAGEMENT
// ============================================================

/**
 * Map request status to coffee shop order status
 */
const mapRequestStatusToCoffeeStatus = (status: string): CoffeeShopOrder['status'] => {
    switch (status) {
        case 'PENDING_RECEPTION':
        case 'pending':
            return 'pending';
        case 'CONFIRMED':
            return 'confirmed';
        case 'IN_PROGRESS':
            return 'preparing';
        case 'WAITING_INSPECTION':
            return 'ready';
        case 'COMPLETED':
            return 'delivered';
        case 'CANCELLED':
            return 'cancelled';
        default:
            return 'pending';
    }
};

/**
 * Subscribe to coffee shop orders from unified requests collection
 * ✅ Now reads from 'requests' collection for unified data flow
 */
export const subscribeToOrders = (
    branchId: string,
    tenantId: string,
    status?: string,
    callback?: (orders: CoffeeShopOrder[]) => void
): Unsubscribe => {
    // ✅ FIX: Use tenant-scoped collection for SaaS isolation
    if (!tenantId) {
        throw new Error('tenantId is required for SaaS isolation');
    }
    
    // Query the tenant-scoped requests collection for coffee-related requests
    const q = query(
        collection(db, `tenants/${tenantId}/requests`),
        where('branch', '==', branchId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        // Filter and map requests to CoffeeShopOrder format
        const orders = snapshot.docs
            .map(doc => {
                const data = doc.data();
                return { id: doc.id, ...data };
            })
            // Filter for coffee-related requests that are in coffee_shop department
            .filter(req => {
                const isCoffeeType = req.type === 'coffee' || req.type === 'room_service';
                const isInCoffeeShop = req.currentDepartment === 'coffee_shop' || 
                                       (isCoffeeType && req.status !== 'PENDING_RECEPTION');
                return isCoffeeType && (isInCoffeeShop || req.status === 'PENDING_RECEPTION');
            })
            // Map to CoffeeShopOrder structure
            .map(req => ({
                id: req.id,
                requestId: req.id,
                items: req.details?.items || [],
                totalAmount: req.details?.totalAmount || 0,
                roomNumber: req.roomNumber || '',
                guestName: req.guestName || '',
                guestIdentity: req.guestIdentity || '',
                source: req.source === 'guest' || req.source === 'QR' ? 'qr' : 'reception',
                status: mapRequestStatusToCoffeeStatus(req.status),
                confirmedAt: req.timeline?.confirmed,
                confirmedBy: req.confirmedBy,
                completedAt: req.timeline?.completed,
                completedBy: req.completedBy,
                branch: req.branch,
                tenantId: req.tenantId,
                createdAt: req.createdAt,
                notes: req.notes || ''
            })) as CoffeeShopOrder[];

        // Filter by status if provided
        const filteredOrders = status 
            ? orders.filter(o => o.status === status)
            : orders;

        if (callback) callback(filteredOrders);
    });
};

/**
 * Legacy: Subscribe to old coffeeShopOrders collection
 * @deprecated Use subscribeToOrders which reads from unified requests
 */
export const subscribeToLegacyOrders = (
    branchId: string,
    tenantId: string,
    status?: string,
    callback?: (orders: CoffeeShopOrder[]) => void
): Unsubscribe => {
    let constraints: any[] = [
        where('branch', '==', branchId),
        where('tenantId', '==', tenantId)
    ];

    if (status) {
        constraints.push(where('status', '==', status));
    }

    const q = query(
        collection(db, 'coffeeShopOrders'),
        ...constraints,
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as CoffeeShopOrder[];
        if (callback) callback(orders);
    });
};

/**
 * Create coffee shop order
 */
export const createOrder = async (
    order: Omit<CoffeeShopOrder, 'id' | 'createdAt'>,
    tenantId: string
): Promise<string> => {
    const docRef = await addDoc(collection(db, 'coffeeShopOrders'), {
        ...order,
        tenantId,
        createdAt: serverTimestamp()
    });
    return docRef.id;
};

/**
 * Confirm order (from reception) - transfers to coffee_shop department
 * ✅ Now updates requests collection directly
 */
export const confirmOrder = async (
    orderId: string,
    userId: string,
    userName: string
): Promise<void> => {
    // Transfer request to coffee_shop department
    await transferRequestToDepartment(
        orderId,
        'coffee_shop',
        'CONFIRMED',
        userId,
        userName
    );
};

/**
 * Complete order (from coffee shop)
 * ✅ FIX: Added tenantId parameter for tenant-scoped collection
 * ⚠️ NOTE: This service is deprecated - use coffeeShopFlowService.completeDelivery instead
 */
export const completeOrder = async (
    tenantId: string,
    orderId: string,
    userId: string,
    userName: string
): Promise<void> => {
    if (!tenantId) {
        throw new Error('tenantId is required');
    }
    const requestRef = doc(db, `tenants/${tenantId}/requests`, orderId);
    await updateDoc(requestRef, {
        status: 'COMPLETED',
        currentDepartment: 'reception', // Return to reception for notification
        completedAt: serverTimestamp(),
        completedBy: { id: userId, name: userName },
        'timeline.completed': serverTimestamp()
    });
};

/**
 * Update order status
 * ✅ FIX: Added tenantId parameter for tenant-scoped collection
 * ⚠️ NOTE: This service is deprecated - use coffeeShopFlowService instead
 */
export const updateOrderStatus = async (
    tenantId: string,
    orderId: string,
    status: CoffeeShopOrder['status'],
    userId?: string,
    userName?: string
): Promise<void> => {
    if (!tenantId) {
        throw new Error('tenantId is required');
    }
    // Map coffee status to request status
    const requestStatus = status === 'preparing' ? 'IN_PROGRESS' :
                         status === 'ready' ? 'WAITING_INSPECTION' :
                         status === 'delivered' ? 'COMPLETED' :
                         status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED';
    
    const requestRef = doc(db, `tenants/${tenantId}/requests`, orderId);
    const updateData: any = {
        status: requestStatus,
        updatedAt: serverTimestamp()
    };

    if (status === 'preparing') {
        updateData['timeline.started'] = serverTimestamp();
    } else if (status === 'delivered' && userId && userName) {
        updateData['timeline.completed'] = serverTimestamp();
        updateData.completedBy = { id: userId, name: userName };
        updateData.currentDepartment = 'reception'; // Return to reception for notification
    }

    await updateDoc(requestRef, updateData);
};
