/**
 * Inventory Service V2
 * Smart Inventory Management with Dynamic Categories & Auto-sync from Procurement
 * Adora Hotel Management System V2
 *
 * Features:
 * - Three inventory dimensions: Warehouse + Rooms + Purchased (with history)
 * - Dynamic categories from procurement requests
 * - Auto-registration from procurement receipts
 * - Manual entry and editing from admin dashboard
 *
 * SaaS/tenant: Uses root collections `inventory` and `inventory_transactions`. For multi-tenant
 * isolation, consider migrating to tenants/${tenantId}/inventory (and transactions) and passing tenantId.
 */

import { db } from './firebase';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp,
    onSnapshot,
    increment,
    writeBatch,
    serverTimestamp,
} from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface PurchaseRecord {
    id?: string;
    quantity: number;
    purchaseDate: Timestamp | Date;
    procurementRequestId?: string;
    unitPrice?: number;
    notes?: string;
    receivedBy?: { id: string; name: string };
}

export interface InventoryItem {
    id: string;
    name: string;
    nameEn?: string;
    category: string; // ✅ Dynamic category (can be created on-the-fly)
    unit: string; // قطعة, كيلو, لتر, علبة
    
    // ✅ THREE DIMENSIONS OF INVENTORY
    warehouseQuantity: number; // المستودع
    roomsQuantity: number; // الغرف
    purchases: PurchaseRecord[]; // المشترى (مع تاريخ)
    
    // Calculated total (for display)
    totalQuantity: number; // warehouseQuantity + roomsQuantity + sum(purchases.quantity)
    
    minQuantity: number; // Minimum stock level for alerts
    maxQuantity?: number;
    unitPrice: number;
    totalValue: number;
    location?: string; // Storage location
    supplier?: string;
    barcode?: string;
    notes?: string;
    lastRestocked?: any;
    lastUsed?: any;
    createdAt: any;
    updatedAt: any;
    createdBy?: { id: string; name: string };
    branch: string;
    tenantId?: string;
    isActive: boolean;
    
    // Auto-created flag
    autoCreated?: boolean; // ✅ True if created from procurement
    sourceProcurementId?: string; // ✅ Link to first procurement that created this item
}

export type InventoryCategory = string; // ✅ Dynamic - no fixed list

export interface InventoryTransaction {
    id: string;
    itemId: string;
    itemName: string;
    type: 'in' | 'out' | 'adjustment' | 'warehouse_to_rooms' | 'rooms_to_warehouse';
    quantity: number;
    dimension: 'warehouse' | 'rooms' | 'purchase'; // ✅ Which dimension changed
    previousQuantity: number;
    newQuantity: number;
    reason: string;
    procurementId?: string; // Link to procurement order
    performedBy: { id: string; name: string };
    createdAt: any;
    branch: string;
    tenantId?: string;
    notes?: string;
}

export interface LowStockAlert {
    itemId: string;
    itemName: string;
    category: string;
    currentQuantity: number;
    minQuantity: number;
    severity: 'critical' | 'warning';
}

// Legacy category names (for backward compatibility and suggestions)
export const LEGACY_CATEGORY_NAMES: Record<string, string> = {
    cleaning: 'مواد تنظيف',
    amenities: 'لوازم الغرف',
    linens: 'مفروشات',
    maintenance: 'قطع غيار',
    food: 'مواد غذائية',
    beverages: 'مشروبات',
    office: 'مكتبية',
    other: 'أخرى',
};

export const UNIT_OPTIONS = [
    { value: 'piece', label: 'قطعة' },
    { value: 'box', label: 'علبة' },
    { value: 'pack', label: 'عبوة' },
    { value: 'bottle', label: 'زجاجة' },
    { value: 'kg', label: 'كيلو' },
    { value: 'liter', label: 'لتر' },
    { value: 'meter', label: 'متر' },
    { value: 'set', label: 'طقم' },
    { value: 'roll', label: 'رول' },
    { value: 'gallon', label: 'جالون' },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Calculate total quantity from three dimensions
 */
const calculateTotalQuantity = (item: Partial<InventoryItem>): number => {
    const warehouse = item.warehouseQuantity || 0;
    const rooms = item.roomsQuantity || 0;
    const purchased = (item.purchases || []).reduce((sum, p) => sum + (p.quantity || 0), 0);
    return warehouse + rooms + purchased;
};

// ============================================================
// INVENTORY CRUD OPERATIONS
// ============================================================

/**
 * Subscribe to inventory items
 */
export const subscribeToInventory = (
    branchId: string,
    callback: (items: InventoryItem[]) => void,
    category?: string,
    tenantId?: string
) => {
    let constraints: any[] = [
        where('branch', '==', branchId),
        where('isActive', '==', true)
    ];
    if (tenantId) constraints.push(where('tenantId', '==', tenantId));
    if (category) constraints.push(where('category', '==', category));

    const q = query(
        collection(db, 'inventory'),
        ...constraints
    );

    return onSnapshot(q, (snapshot) => {
        const items: InventoryItem[] = [];
        snapshot.forEach((doc) => {
            const data = { id: doc.id, ...doc.data() } as InventoryItem;
            // ✅ Recalculate totalQuantity on load
            data.totalQuantity = calculateTotalQuantity(data);
            items.push(data);
        });

        // Sort by name client-side
        items.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        callback(items);
    });
};

/**
 * Get all unique categories (dynamic)
 */
export const getCategories = async (branchId: string, tenantId?: string): Promise<string[]> => {
    const constraints: any[] = [
        where('branch', '==', branchId),
        where('isActive', '==', true)
    ];
    if (tenantId) constraints.push(where('tenantId', '==', tenantId));

    const q = query(collection(db, 'inventory'), ...constraints);
    const snapshot = await getDocs(q);
    
    const categories = new Set<string>();
    snapshot.forEach((doc) => {
        const category = doc.data().category;
        if (category) categories.add(category);
    });

    return Array.from(categories).sort();
};

/**
 * Get single inventory item
 */
export const getInventoryItem = async (itemId: string): Promise<InventoryItem | null> => {
    const docRef = doc(db, 'inventory', itemId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as InventoryItem;
        data.totalQuantity = calculateTotalQuantity(data);
        return data;
    }
    return null;
};

/**
 * Find inventory item by name (for procurement integration)
 */
export const findInventoryItemByName = async (
    itemName: string,
    branchId: string,
    tenantId?: string
): Promise<InventoryItem | null> => {
    try {
        const constraints = [
            where('branch', '==', branchId),
            where('name', '==', itemName),
            where('isActive', '==', true)
        ];
        if (tenantId) constraints.push(where('tenantId', '==', tenantId));

        const q = query(collection(db, 'inventory'), ...constraints);
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = { id: doc.id, ...doc.data() } as InventoryItem;
            data.totalQuantity = calculateTotalQuantity(data);
            return data;
        }
        return null;
    } catch (error) {
        logger.error('Error finding inventory item by name:', error, 'inventoryService');
        return null;
    }
};

/**
 * ✅ AUTO-CREATE inventory item from procurement
 * Called when procurement receipt is confirmed and item doesn't exist
 */
export const autoCreateInventoryItem = async (
    itemName: string,
    category: string,
    quantity: number,
    unit: string,
    unitPrice: number,
    procurementRequestId: string,
    branchId: string,
    tenantId: string,
    receivedBy: { id: string; name: string }
): Promise<string> => {
    const purchaseRecord: PurchaseRecord = {
        quantity,
        purchaseDate: Timestamp.now(),
        procurementRequestId,
        unitPrice,
        receivedBy,
        notes: `تلقائي من المشتريات - طلب #${procurementRequestId.slice(0, 8)}`
    };

    const totalQty = calculateTotalQuantity({
        warehouseQuantity: 0,
        roomsQuantity: 0,
        purchases: [purchaseRecord]
    });

    const docRef = await addDoc(collection(db, 'inventory'), {
        name: itemName,
        category, // ✅ Dynamic category
        unit,
        warehouseQuantity: 0,
        roomsQuantity: 0,
        purchases: [purchaseRecord],
        totalQuantity: totalQty,
        minQuantity: 5,
        unitPrice,
        totalValue: totalQty * unitPrice,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: receivedBy,
        branch: branchId,
        tenantId,
        isActive: true,
        autoCreated: true,
        sourceProcurementId: procurementRequestId
    });

    // ✅ Log transaction
    await addDoc(collection(db, 'inventory_transactions'), {
        itemId: docRef.id,
        itemName,
        type: 'in',
        quantity,
        dimension: 'purchase',
        previousQuantity: 0,
        newQuantity: totalQty,
        reason: `إنشاء تلقائي من المشتريات - ${itemName}`,
        procurementId: procurementRequestId,
        performedBy: receivedBy,
        createdAt: Timestamp.now(),
        branch: branchId,
        tenantId,
        notes: `تم إنشاء العنصر تلقائياً من طلب المشتريات`
    });

    return docRef.id;
};

/**
 * Add new inventory item (Admin manual entry)
 */
export const addInventoryItem = async (
    item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'totalQuantity' | 'totalValue'>,
    userId: string,
    userName: string,
    tenantId?: string
): Promise<string> => {
    const totalQty = calculateTotalQuantity(item);
    
    const docRef = await addDoc(collection(db, 'inventory'), {
        ...item,
        tenantId: tenantId || item.tenantId,
        totalQuantity: totalQty,
        totalValue: totalQty * item.unitPrice,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: { id: userId, name: userName },
        isActive: true,
        autoCreated: false
    });

    // ✅ Log initial transaction if there's inventory
    if (totalQty > 0) {
        await addDoc(collection(db, 'inventory_transactions'), {
            itemId: docRef.id,
            itemName: item.name,
            type: 'adjustment',
            quantity: totalQty,
            dimension: 'warehouse', // Default to warehouse for manual entry
            previousQuantity: 0,
            newQuantity: totalQty,
            reason: 'إضافة يدوية - إنشاء عنصر جديد',
            performedBy: { id: userId, name: userName },
            createdAt: Timestamp.now(),
            branch: item.branch,
            tenantId: tenantId || item.tenantId,
            notes: 'إدخال يدوي من لوحة المدير'
        });
    }

    return docRef.id;
};

/**
 * Update inventory item (Admin only)
 */
export const updateInventoryItem = async (
    itemId: string,
    updates: Partial<InventoryItem>,
    userId?: string,
    userName?: string
): Promise<void> => {
    const itemRef = doc(db, 'inventory', itemId);
    const currentItem = await getInventoryItem(itemId);
    if (!currentItem) throw new Error('Item not found');

    // ✅ Recalculate totalQuantity if quantities changed
    const finalData = {
        ...updates,
        totalQuantity: calculateTotalQuantity({ ...currentItem, ...updates }),
        updatedAt: Timestamp.now()
    };

    // ✅ Recalculate totalValue
    if (finalData.totalQuantity !== undefined || updates.unitPrice !== undefined) {
        const newQty = finalData.totalQuantity ?? currentItem.totalQuantity;
        const newPrice = updates.unitPrice ?? currentItem.unitPrice;
        finalData.totalValue = newQty * newPrice;
    }

    await updateDoc(itemRef, finalData);

    // ✅ Log transaction if quantities changed
    if (updates.warehouseQuantity !== undefined || updates.roomsQuantity !== undefined || updates.purchases) {
        const oldTotal = currentItem.totalQuantity;
        const newTotal = finalData.totalQuantity ?? oldTotal;
        if (oldTotal !== newTotal && userId && userName) {
            await addDoc(collection(db, 'inventory_transactions'), {
                itemId,
                itemName: currentItem.name,
                type: 'adjustment',
                quantity: Math.abs(newTotal - oldTotal),
                dimension: 'warehouse', // Default
                previousQuantity: oldTotal,
                newQuantity: newTotal,
                reason: 'تعديل يدوي - تحديث المخزون',
                performedBy: { id: userId, name: userName },
                createdAt: Timestamp.now(),
                branch: currentItem.branch,
                tenantId: currentItem.tenantId,
                notes: 'تعديل يدوي من لوحة المدير'
            });
        }
    }
};

/**
 * Delete inventory item (soft delete)
 */
export const deleteInventoryItem = async (itemId: string): Promise<void> => {
    await updateDoc(doc(db, 'inventory', itemId), {
        isActive: false,
        updatedAt: Timestamp.now(),
    });
};

// ============================================================
// QUANTITY MANAGEMENT
// ============================================================

/**
 * ✅ Add purchase record (from procurement receipt)
 */
export const addPurchaseRecord = async (
    itemId: string,
    purchaseRecord: PurchaseRecord,
    branchId: string,
    tenantId?: string
): Promise<void> => {
    const item = await getInventoryItem(itemId);
    if (!item) throw new Error('Item not found');

    const itemRef = doc(db, 'inventory', itemId);
    const updatedPurchases = [...(item.purchases || []), purchaseRecord];
    const newTotalQty = calculateTotalQuantity({
        ...item,
        purchases: updatedPurchases
    });

    await updateDoc(itemRef, {
        purchases: updatedPurchases,
        totalQuantity: newTotalQty,
        totalValue: newTotalQty * item.unitPrice,
        lastRestocked: Timestamp.now(),
        updatedAt: Timestamp.now()
    });

    // ✅ Log transaction
    const previousTotal = item.totalQuantity;
    if (purchaseRecord.receivedBy) {
        await addDoc(collection(db, 'inventory_transactions'), {
            itemId,
            itemName: item.name,
            type: 'in',
            quantity: purchaseRecord.quantity,
            dimension: 'purchase',
            previousQuantity: previousTotal,
            newQuantity: newTotalQty,
            reason: `استلام من المشتريات${purchaseRecord.procurementRequestId ? ` - طلب #${purchaseRecord.procurementRequestId.slice(0, 8)}` : ''}`,
            procurementId: purchaseRecord.procurementRequestId,
            performedBy: purchaseRecord.receivedBy,
            createdAt: Timestamp.now(),
            branch: branchId,
            tenantId: tenantId || item.tenantId,
            notes: purchaseRecord.notes
        });
    }
};

/**
 * Update warehouse quantity
 */
export const updateWarehouseQuantity = async (
    itemId: string,
    newQuantity: number,
    reason: string,
    userId: string,
    userName: string,
    branchId: string,
    tenantId?: string
): Promise<void> => {
    const item = await getInventoryItem(itemId);
    if (!item) throw new Error('Item not found');

    const previousQty = item.warehouseQuantity;
    const itemRef = doc(db, 'inventory', itemId);
    
    const newTotalQty = calculateTotalQuantity({
        ...item,
        warehouseQuantity: newQuantity
    });

    await updateDoc(itemRef, {
        warehouseQuantity: newQuantity,
        totalQuantity: newTotalQty,
        totalValue: newTotalQty * item.unitPrice,
        updatedAt: Timestamp.now()
    });

    // Log transaction
    await addDoc(collection(db, 'inventory_transactions'), {
        itemId,
        itemName: item.name,
        type: previousQty < newQuantity ? 'in' : 'out',
        quantity: Math.abs(newQuantity - previousQty),
        dimension: 'warehouse',
        previousQuantity: item.totalQuantity,
        newQuantity: newTotalQty,
        reason,
        performedBy: { id: userId, name: userName },
        createdAt: Timestamp.now(),
        branch: branchId,
        tenantId: tenantId || item.tenantId
    });
};

/**
 * Update rooms quantity
 */
export const updateRoomsQuantity = async (
    itemId: string,
    newQuantity: number,
    reason: string,
    userId: string,
    userName: string,
    branchId: string,
    tenantId?: string
): Promise<void> => {
    const item = await getInventoryItem(itemId);
    if (!item) throw new Error('Item not found');

    const previousQty = item.roomsQuantity;
    const itemRef = doc(db, 'inventory', itemId);
    
    const newTotalQty = calculateTotalQuantity({
        ...item,
        roomsQuantity: newQuantity
    });

    await updateDoc(itemRef, {
        roomsQuantity: newQuantity,
        totalQuantity: newTotalQty,
        totalValue: newTotalQty * item.unitPrice,
        updatedAt: Timestamp.now()
    });

    // Log transaction
    await addDoc(collection(db, 'inventory_transactions'), {
        itemId,
        itemName: item.name,
        type: previousQty < newQuantity ? 'in' : 'out',
        quantity: Math.abs(newQuantity - previousQty),
        dimension: 'rooms',
        previousQuantity: item.totalQuantity,
        newQuantity: newTotalQty,
        reason,
        performedBy: { id: userId, name: userName },
        createdAt: Timestamp.now(),
        branch: branchId,
        tenantId: tenantId || item.tenantId
    });
};

/**
 * Transfer between warehouse and rooms
 */
export const transferInventory = async (
    itemId: string,
    from: 'warehouse' | 'rooms',
    to: 'warehouse' | 'rooms',
    quantity: number,
    userId: string,
    userName: string,
    branchId: string,
    tenantId?: string
): Promise<void> => {
    const item = await getInventoryItem(itemId);
    if (!item) throw new Error('Item not found');

    const fromQty = from === 'warehouse' ? item.warehouseQuantity : item.roomsQuantity;
    if (fromQty < quantity) throw new Error('Insufficient quantity');

    const itemRef = doc(db, 'inventory', itemId);
    const updates: any = {
        updatedAt: Timestamp.now()
    };

    if (from === 'warehouse' && to === 'rooms') {
        updates.warehouseQuantity = item.warehouseQuantity - quantity;
        updates.roomsQuantity = item.roomsQuantity + quantity;
    } else {
        updates.warehouseQuantity = item.warehouseQuantity + quantity;
        updates.roomsQuantity = item.roomsQuantity - quantity;
    }

    // Total quantity remains the same, but update timestamp
    await updateDoc(itemRef, updates);

    // Log transaction
    await addDoc(collection(db, 'inventory_transactions'), {
        itemId,
        itemName: item.name,
        type: from === 'warehouse' ? 'warehouse_to_rooms' : 'rooms_to_warehouse',
        quantity,
        dimension: from,
        previousQuantity: item.totalQuantity,
        newQuantity: item.totalQuantity, // Total doesn't change
        reason: `نقل من ${from === 'warehouse' ? 'المستودع' : 'الغرف'} إلى ${to === 'warehouse' ? 'المستودع' : 'الغرف'}`,
        performedBy: { id: userId, name: userName },
        createdAt: Timestamp.now(),
        branch: branchId,
        tenantId: tenantId || item.tenantId
    });
};

/**
 * Legacy function - Update item quantity (backward compatibility)
 * Maps to warehouse quantity
 */
export const updateItemQuantity = async (
    itemId: string,
    quantity: number,
    type: 'in' | 'out' | 'adjustment',
    reason: string,
    userId: string,
    userName: string,
    branchId: string,
    procurementId?: string,
    notes?: string,
    tenantId?: string
): Promise<void> => {
    const item = await getInventoryItem(itemId);
    if (!item) throw new Error('Item not found');

    const previousQty = item.warehouseQuantity;
    let newQty: number;

    switch (type) {
        case 'in':
            newQty = previousQty + quantity;
            break;
        case 'out':
            newQty = Math.max(0, previousQty - quantity);
            break;
        case 'adjustment':
            newQty = quantity;
            break;
        default:
            newQty = previousQty;
    }

    await updateWarehouseQuantity(
        itemId,
        newQty,
        reason,
        userId,
        userName,
        branchId,
        tenantId
    );
};

// ============================================================
// TRANSACTIONS HISTORY
// ============================================================

/**
 * Get transactions for an item
 */
export const getItemTransactions = async (
    itemId: string,
    limit = 50
): Promise<InventoryTransaction[]> => {
    const q = query(
        collection(db, 'inventory_transactions'),
        where('itemId', '==', itemId),
        orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map((doc) => ({
        id: doc.id,
        ...doc.data()
    })) as InventoryTransaction[];
};

// ============================================================
// STATISTICS & ALERTS
// ============================================================

/**
 * Get inventory statistics
 */
export const getInventoryStats = async (
    branchId: string,
    tenantId?: string
): Promise<{
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    byCategory: Record<string, number>;
}> => {
    const constraints: any[] = [
        where('branch', '==', branchId),
        where('isActive', '==', true)
    ];
    if (tenantId) constraints.push(where('tenantId', '==', tenantId));

    const q = query(collection(db, 'inventory'), ...constraints);
    const snapshot = await getDocs(q);

    let totalItems = 0;
    let totalValue = 0;
    let lowStockCount = 0;
    const byCategory: Record<string, number> = {};

    snapshot.forEach((doc) => {
        const item = doc.data() as InventoryItem;
        totalItems++;
        totalValue += item.totalValue || 0;
        
        if (item.totalQuantity < item.minQuantity) {
            lowStockCount++;
        }

        const cat = item.category || 'غير مصنف';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    return { totalItems, totalValue, lowStockCount, byCategory };
};

/**
 * Get low stock alerts
 */
export const getLowStockAlerts = async (
    branchId: string,
    tenantId?: string
): Promise<LowStockAlert[]> => {
    const constraints: any[] = [
        where('branch', '==', branchId),
        where('isActive', '==', true)
    ];
    if (tenantId) constraints.push(where('tenantId', '==', tenantId));

    const q = query(collection(db, 'inventory'), ...constraints);
    const snapshot = await getDocs(q);

    const alerts: LowStockAlert[] = [];

    snapshot.forEach((doc) => {
        const item = doc.data() as InventoryItem;
        const totalQty = calculateTotalQuantity(item);
        
        if (totalQty < item.minQuantity) {
            alerts.push({
                itemId: doc.id,
                itemName: item.name,
                category: item.category || 'غير مصنف',
                currentQuantity: totalQty,
                minQuantity: item.minQuantity,
                severity: totalQty === 0 ? 'critical' : 'warning'
            });
        }
    });

    return alerts.sort((a, b) => a.currentQuantity - b.currentQuantity);
};
