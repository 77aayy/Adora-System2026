/**
 * Laundry Inventory Service
 * Manages laundry items delivery and receipt tracking
 * Adora Hotel Management System V2
 * Updated: Tenant Isolation & Dynamic Settings
 */

import {
    collection, doc, addDoc, updateDoc, getDocs, getDoc, setDoc,
    query, where, orderBy, onSnapshot, Timestamp, writeBatch, limit, runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';
import { formatDateGregorianEn } from '../utils/dateUtils';

// ============================================================
// TYPES
// ============================================================

export interface LaundryItem {
    id: string; // "1", "2"... from settings
    name: string;
    priceWithTax: number; // ✅ Price for guest (washing service price)
    unitCost?: number; // 🔐 REQUIRED: Actual purchase/replacement cost for accounting
    active: boolean;
    order: number;
    // Stock Distribution (3 Locations)
    stockWarehouse: number; // 🔐 IMMUTABLE: Base stock in warehouse (only updated manually by admin)
    stockRooms: number; // 🔐 IMMUTABLE: Stock in rooms (only changes via delivery/receipt transactions)
    inLaundry: number; // ✅ DYNAMIC: Items currently at laundry (changes with delivery/receipt)
    inTreatment?: number; // 🔐 NEW: Items under treatment (not counted as deficit until settled)
    showInCards: boolean; // Default true
    createdAt?: any;
    updatedAt?: any;
    createdBy?: { id: string; name: string };
}
// ... (skip down to updateLaundryItem)

export interface LaundryRecord {
    id: string;
    date: string; // YYYY-MM-DD
    branch: string;
    status: 'delivered' | 'received' | 'completed';

    // Delivery (8 PM)
    deliveredAt?: any;
    deliveredBy?: { id: string; name: string };
    delivered: Record<string, number>;
    deliverySignature?: string;

    // Receipt (8 AM next day)
    receivedAt?: any;
    receivedBy?: { id: string; name: string };
    received?: Record<string, number>;
    receiptSignature?: string;

    // Calculated
    deficit?: Record<string, number>; // Daily deficit (delivered - received)
    dailyVariance?: Record<string, number>; // 🔐 NEW: Daily variance tracking
    treatmentItems?: Record<string, number>; // 🔐 NEW: Items moved to treatment (not counted as deficit yet)

    damagePhotos?: {
        itemId: string;
        photoUrl: string;
        reason: 'damaged' | 'lost' | 'counting_error' | 'other';
        notes?: string;
        createdAt: any;
    }[];
}

export interface AccountingReport {
    items: {
        itemId: string;
        itemName: string;
        totalDelivered: number;
        totalReceived: number;
        deficit: number;
        surplus: number;
        pricePerUnit: number; // ✅ Washing price (priceWithTax)
        unitCost: number; // 🔐 Purchase/replacement cost (unitCost)
        totalCost: number; // ✅ Total washing cost (delivered * priceWithTax)
        deficitCost: number; // 🔐 Cost of lost items (deficit * unitCost)
        surplusCost: number; // ✅ Value of surplus items (surplus * priceWithTax)
    }[];
    grandTotal: number; // Total washing cost
    totalDeficitValue: number; // Total replacement cost of lost items
    totalSurplusValue: number; // Total value of surplus items
}

// ============================================================
// ITEM & SETTINGS MANAGEMENT
// ============================================================

const DEFAULT_LAUNDRY_ITEMS = [
    { name: 'شرشف كبير', price: 1.5, total: 1.725 },
    { name: 'شرشف صغير', price: 1.3, total: 1.495 },
    { name: 'غضاء لحاف صغير', price: 2.2, total: 2.53 },
    { name: 'غضاء لحاف كبير', price: 2.2, total: 2.53 },
    { name: 'منشفة للجسم', price: 0.95, total: 1.0925 },
    { name: 'كيس مخدة', price: 0.3, total: 0.345 },
    { name: 'بطانية كبيرة', price: 2.5, total: 2.875 },
    { name: 'لحاف كبير', price: 3.4, total: 3.91 },
];

/**
 * Initialize default items if they don't exist (Migrated to use Settings Path)
 */
export const initializeLaundryItems = async (
    tenantId: string,
    branchId: string,
    userId: string,
    userName: string
): Promise<void> => {
    if (!tenantId || !branchId) return;

    const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_prices');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) return; // Already exists

    // Create defaults
    const items = DEFAULT_LAUNDRY_ITEMS.map((item, index) => ({
        id: (index + 1).toString(),
        name: item.name,
        price: item.price,
        tax: Number((item.total - item.price).toFixed(4)),
        total: item.total
    }));

    await setDoc(docRef, {
        items,
        updatedAt: Timestamp.now(),
        updatedBy: { id: userId, name: userName }
    });
};

/**
 * Subscribe to laundry items (Reads from Settings)
 */
export const subscribeToLaundryItems = (
    tenantId: string,
    branchId: string,
    callback: (items: LaundryItem[]) => void
): (() => void) => {
    if (!tenantId || !branchId) {
        callback([]);
        return () => { };
    }

    const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_prices');

    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const rawItems: any[] = data.items || [];

            // Map settings to app interface WITH ACTUAL STOCK VALUES
            const items: LaundryItem[] = rawItems.map((item, index) => ({
                id: item.id || (index + 1).toString(),
                name: item.name,
                priceWithTax: Number(item.total || 0),
                unitCost: Number(item.unitCost || item.total || 0), // 🔐 Default to priceWithTax if not set
                active: true,
                order: index + 1,
                // ✅ FIXED: Read actual stock values from document
                stockWarehouse: item.stockWarehouse || 0,
                stockRooms: item.stockRooms || 0,
                inLaundry: item.inLaundry || 0,
                inTreatment: item.inTreatment || 0, // 🔐 NEW: Items under treatment
                showInCards: item.showInCards !== false // Default true
            }));

            callback(items);
        } else {
            callback([]);
        }
    });
};

// ============================================================
// ITEM CRUD OPERATIONS
// ============================================================

export interface LaundrySettings {
    deficitAlertThreshold: number;
    enablePurchaseAlerts: boolean;
}

export interface AdvancedAnalytics {
    totalDelivered: number;
    totalReceived: number;
    deficitRate: number;
}

/**
 * Add a new laundry item
 */
export const addLaundryItem = async (
    tenantId: string,
    branchId: string,
    item: Partial<LaundryItem>
): Promise<void> => {
    if (!tenantId || !branchId) throw new Error("Tenant/Branch ID required");

    const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_prices');
    const docSnap = await getDoc(docRef);

    let items: any[] = [];
    if (docSnap.exists()) {
        items = docSnap.data().items || [];
    }

    const newId = (items.length + 1).toString();
    items.push({
        id: newId,
        name: item.name || 'بند جديد',
        price: item.priceWithTax ? item.priceWithTax / 1.15 : 1,
        tax: item.priceWithTax ? item.priceWithTax - (item.priceWithTax / 1.15) : 0.15,
        total: item.priceWithTax || 1.15,
        unitCost: item.unitCost || item.priceWithTax || 1.15 // 🔐 Default unitCost to priceWithTax if not provided
    });

    await setDoc(docRef, { items, updatedAt: Timestamp.now() }, { merge: true });
};

/**
 * Update an existing laundry item (UNIFIED: Includes Stock Fields)
 */
export const updateLaundryItem = async (
    tenantId: string,
    branchId: string,
    itemId: string,
    updates: Partial<LaundryItem>
): Promise<void> => {
    if (!tenantId || !branchId) throw new Error("Tenant/Branch ID required");

    const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_prices');
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return;

    const items = (docSnap.data().items || []).map((item: any) => {
        if (item.id === itemId) {
            return {
                ...item,
                name: updates.name ?? item.name,
                total: updates.priceWithTax ?? item.total,
                price: updates.priceWithTax ? updates.priceWithTax / 1.15 : item.price,
                unitCost: (updates as any).unitCost ?? item.unitCost ?? item.total, // 🔐 Include unitCost in updates
                // ✅ FIXED: Include stock fields in updates
                stockWarehouse: updates.stockWarehouse ?? item.stockWarehouse ?? 0,
                stockRooms: updates.stockRooms ?? item.stockRooms ?? 0,
                inLaundry: updates.inLaundry ?? item.inLaundry ?? 0,
                inTreatment: (updates as any).inTreatment ?? item.inTreatment ?? 0, // 🔐 Include inTreatment
                // ✅ FIX: Include showInCards in updates
                showInCards: (updates as any).showInCards !== undefined ? (updates as any).showInCards : item.showInCards !== false
            };
        }
        return item;
    });

    await setDoc(docRef, { items, updatedAt: Timestamp.now() }, { merge: true });
};

/**
 * Delete a laundry item
 */
export const deleteLaundryItem = async (
    tenantId: string,
    branchId: string,
    itemId: string
): Promise<void> => {
    if (!tenantId || !branchId) throw new Error("Tenant/Branch ID required");

    const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_prices');
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return;

    const items = (docSnap.data().items || []).filter((item: any) => item.id !== itemId);

    await setDoc(docRef, { items, updatedAt: Timestamp.now() }, { merge: true });
};

/**
 * Update item stock (stub - stock tracked separately in records)
 */
export const updateItemStock = async (
    tenantId: string,
    branchId: string,
    itemId: string,
    newStock: number
): Promise<void> => {
    logger.info(`Stock update requested for item ${itemId}: ${newStock}`, undefined, 'laundryInventoryService');
    // Stock is calculated from records, not stored directly
};

/**
 * Toggle item visibility in cards
 */
export const toggleItemInCards = async (
    tenantId: string,
    branchId: string,
    itemId: string
): Promise<void> => {
    logger.info(`Toggle card visibility for item ${itemId}`, undefined, 'laundryInventoryService');
    // Card visibility is a UI concern, not persisted in current schema
};

/**
 * Get laundry settings
 */
export const getLaundrySettings = async (
    tenantId: string,
    branchId: string
): Promise<LaundrySettings> => {
    if (!tenantId || !branchId) return { deficitAlertThreshold: 10, enablePurchaseAlerts: true };
    const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_config');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        const data = snap.data();
        return {
            deficitAlertThreshold: data.deficitAlertThreshold ?? 10,
            enablePurchaseAlerts: data.enablePurchaseAlerts ?? true
        };
    }
    return {
        deficitAlertThreshold: 10,
        enablePurchaseAlerts: true
    };
};

/**
 * Update laundry settings
 */
export const updateLaundrySettings = async (
    tenantId: string,
    branchId: string,
    settings: LaundrySettings
): Promise<void> => {
    if (!tenantId || !branchId) return;
    const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_config');
    await setDoc(docRef, {
        ...settings,
        updatedAt: Timestamp.now()
    }, { merge: true });
};

/**
 * Get advanced analytics (stub)
 */
export const getAdvancedAnalytics = async (
    tenantId: string,
    branchId: string
): Promise<AdvancedAnalytics> => {
    return {
        totalDelivered: 0,
        totalReceived: 0,
        deficitRate: 0
    };
};

// ============================================================
// RECORDS MANAGEMENT (Scoped)
// ============================================================

/**
 * Submit Delivery (8 PM) - MOVES STOCK TO LAUNDRY
 */
export const submitDelivery = async (
    tenantId: string,
    branchId: string,
    quantities: Record<string, number>,
    userId: string,
    userName: string,
    signature?: string
): Promise<void> => {
    if (!tenantId || !branchId) throw new Error("Tenant/Branch ID required");

    const today = new Date().toISOString().split('T')[0];
    const recordsRef = collection(db, `tenants/${tenantId}/branches/${branchId}/laundry_records`);

    // Check if record exists for today (outside transaction - read-only check)
    const q = query(recordsRef, where('date', '==', today));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) throw new Error("Delivery already submitted for today");

    // 🔒 USE TRANSACTION to prevent race conditions
    await runTransaction(db, async (transaction) => {
        const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_prices');

        // Read inside transaction for consistency
        const settingsSnap = await transaction.get(settingsRef);

    if (settingsSnap.exists()) {
        const items = settingsSnap.data().items as LaundryItem[] || [];
        const updatedItems = items.map(item => {
            const qtyToSend = quantities[item.id] || 0;
            if (qtyToSend > 0) {
                // 🛡️ VALIDATE: Check sufficient stock BEFORE processing
                // Only check stockRooms (warehouse is immutable, inLaundry is already out)
                const currentRooms = item.stockRooms || 0;
                if (currentRooms < qtyToSend) {
                    throw new Error(`مخزون غير كافٍ في الغرف: ${item.name} (متوفر: ${currentRooms}, مطلوب: ${qtyToSend})`);
                }

                const currentLaundry = item.inLaundry || 0;
                return {
                    ...item,
                    // 🔐 IMMUTABLE: stockWarehouse remains unchanged
                    stockRooms: currentRooms - qtyToSend, // ✅ Move from rooms to laundry
                    inLaundry: currentLaundry + qtyToSend // ✅ Add to laundry balance
                };
            }
            return item;
        });
        transaction.update(settingsRef, { items: updatedItems });
    }

        // 2. Create Record
        const data = {
            date: today,
            branch: branchId,
            status: 'delivered',
            deliveredAt: Timestamp.now(),
            deliveredBy: { id: userId, name: userName },
            delivered: quantities,
            deliverySignature: signature || null
        };
        const newRecordRef = doc(recordsRef);
        transaction.set(newRecordRef, data);
    });
};

/**
 * Submit Receipt (8 AM) - RETURNS STOCK & CALCULATES DEFICIT
 * 🔐 ENHANCED: Supports treatment items (items staying at laundry for processing)
 */
export const submitReceipt = async (
    tenantId: string,
    branchId: string,
    recordId: string,
    quantities: Record<string, number>, // Received quantities
    userId: string,
    userName: string,
    treatmentItems?: Record<string, number> // 🔐 NEW: Items moved to treatment (not counted as deficit yet)
): Promise<void> => {
    if (!db) throw new Error('Firebase not initialized');
    
    const recordRef = doc(db, `tenants/${tenantId}/branches/${branchId}/laundry_records`, recordId);

    // 🔒 USE TRANSACTION to prevent race conditions
    await runTransaction(db, async (transaction) => {
        // 1. Read record
        const snap = await transaction.get(recordRef);

        if (!snap.exists()) throw new Error("Record not found");

        const record = snap.data() as LaundryRecord;
        const delivered = record.delivered || {};

        // 2. Calculate Daily Variance & Deficit
        // Deficit = Delivered - Received - Treatment (items under treatment are NOT counted as deficit)
        const deficit: Record<string, number> = {};
        const dailyVariance: Record<string, number> = {};
        const deficitLog: LaundryRecord['deficit'] = {};
        const varianceLog: LaundryRecord['dailyVariance'] = {};

        Object.keys(delivered).forEach(id => {
            const del = delivered[id] || 0;
            const rec = quantities[id] || 0;
            const treatment = treatmentItems?.[id] || 0; // Items under treatment
            
            // Daily Variance = Delivered - Received (includes treatment items)
            const variance = del - rec - treatment;
            varianceLog[id] = variance;
            
            // Deficit = Only items that are truly lost (not in treatment)
            // If variance > 0 and no treatment, it's a deficit
            const actualDeficit = variance > 0 ? variance : 0;
            if (actualDeficit > 0) {
                deficit[id] = actualDeficit;
                deficitLog[id] = actualDeficit;
            }
        });

        // 3. Update Record with variance and treatment tracking
        transaction.update(recordRef, {
            status: 'completed',
            received: quantities,
            receivedAt: serverTimestamp(),
            receivedBy: { id: userId, name: userName },
            deficit: deficitLog,
            dailyVariance: varianceLog, // 🔐 NEW: Track daily variance
            treatmentItems: treatmentItems || {} // 🔐 NEW: Track items in treatment
        });

        // 4. Update Stock & Handle Treatment Items
        const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_prices');
        const settingsSnap = await transaction.get(settingsRef);

        if (settingsSnap.exists()) {
            const items = settingsSnap.data().items as LaundryItem[] || [];
            const updatedItems = items.map(item => {
                const qtyReceived = quantities[item.id] || 0; // The 95
                const qtyDeficit = deficit[item.id] || 0;     // The 5 (actual lost)
                const qtyTreatment = treatmentItems?.[item.id] || 0; // Items under treatment
                const totalOut = qtyReceived + qtyDeficit + qtyTreatment; // 100 (The original batch)

                const currentLaundry = item.inLaundry || 0;
                const currentRooms = item.stockRooms || 0;
                const currentTreatment = item.inTreatment || 0;

                // Logic:
                // 1. Remove the WHOLE batch (100) from 'inLaundry'.
                // 2. Add ONLY the received (95) back to 'stockRooms'.
                // 3. Move treatment items to 'inTreatment' (not counted as deficit).
                // 4. The actual deficit (5) is evaporated (deducted from Total Asset).

                return {
                    ...item,
                    inLaundry: Math.max(0, currentLaundry - totalOut),
                    stockRooms: currentRooms + qtyReceived,
                    inTreatment: currentTreatment + qtyTreatment // 🔐 NEW: Track treatment items
                };
            });
            transaction.update(settingsRef, { items: updatedItems });
        }

        // 5. Update Cumulative Deficit Stats (only actual deficits, not treatment items)
        const statsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/laundry_stats`, 'cumulative_deficit');
        const statsSnap = await transaction.get(statsRef);
        let currentStats = statsSnap.exists() ? statsSnap.data().counts || {} : {};

        Object.entries(deficit).forEach(([id, qty]) => {
            currentStats[id] = (currentStats[id] || 0) + qty;
        });

        transaction.set(statsRef, { counts: currentStats, updatedAt: serverTimestamp() }, { merge: true });
        
        logger.info(`✅ ATOMIC: Receipt completed for record ${recordId}. Deficit: ${Object.keys(deficit).length} items, Treatment: ${Object.keys(treatmentItems || {}).length} items`, undefined, 'laundryInventoryService');
    });
};

/**
 * Get monthly accounting report
 */
export const getMonthlyAccountingReport = async (
    tenantId: string,
    branchId: string,
    year: number,
    month: number
): Promise<AccountingReport> => {
    if (!tenantId || !branchId) throw new Error("Tenant/Branch ID required");

    // 1. Get Date Range
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    // 2. Fetch Records
    const records = await getRecords(tenantId, branchId, startDate, endDate);

    // 3. Fetch Current Items & Prices (from Settings)
    const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_prices');
    const settingsSnap = await getDoc(settingsRef);
    const itemsMap: Record<string, any> = {};

    if (settingsSnap.exists()) {
        const items = settingsSnap.data().items || [];
        items.forEach((item: any) => {
            itemsMap[item.id] = {
                ...item,
                unitCost: item.unitCost || item.total || 0 // 🔐 Use unitCost if available, fallback to total
            };
        });
    }

    // 4. Aggregate Data
    const reportItems: Record<string, {
        itemId: string;
        itemName: string;
        totalDelivered: number;
        totalReceived: number;
        price: number;
    }> = {};

    records.forEach(record => {
        // Delivered
        Object.entries(record.delivered || {}).forEach(([itemId, qty]) => {
            if (!reportItems[itemId]) {
                const itemDef = itemsMap[itemId] || { name: 'Unknown', total: 0 };
                reportItems[itemId] = {
                    itemId,
                    itemName: itemDef.name,
                    totalDelivered: 0,
                    totalReceived: 0,
                    price: Number(itemDef.total || 0) // Use Price with Tax
                };
            }
            reportItems[itemId].totalDelivered += qty;
        });

        // Received
        Object.entries(record.received || {}).forEach(([itemId, qty]) => {
            if (!reportItems[itemId]) {
                const itemDef = itemsMap[itemId] || { name: 'Unknown', total: 0 };
                reportItems[itemId] = {
                    itemId,
                    itemName: itemDef.name,
                    totalDelivered: 0,
                    totalReceived: 0,
                    price: Number(itemDef.total || 0)
                };
            }
            reportItems[itemId].totalReceived += qty;
        });
    });

    // 5. Calculate Costs (🔐 ENHANCED: Use unitCost for deficit, priceWithTax for washing cost)
    const finalItems = Object.values(reportItems).map(item => {
        const itemDef = itemsMap[item.itemId] || {};
        const unitCost = Number(itemDef.unitCost || item.price || 0); // 🔐 Use unitCost (purchase cost)
        const washingPrice = Number(item.price || 0); // ✅ Use priceWithTax (washing service price)

        // Calculate net difference
        const net = item.totalReceived - item.totalDelivered;
        const isDeficit = net < 0;
        const isSurplus = net > 0;

        return {
            itemId: item.itemId,
            itemName: item.itemName,
            totalDelivered: item.totalDelivered,
            totalReceived: item.totalReceived,
            deficit: isDeficit ? Math.abs(net) : 0,
            surplus: isSurplus ? net : 0,
            pricePerUnit: washingPrice, // ✅ Washing service price
            unitCost: unitCost, // 🔐 Purchase/replacement cost
            totalCost: item.totalDelivered * washingPrice, // ✅ Total washing cost (delivered * washing price)
            deficitCost: (isDeficit ? Math.abs(net) : 0) * unitCost, // 🔐 Cost of lost items (deficit * unitCost)
            surplusCost: (isSurplus ? net : 0) * washingPrice // ✅ Value of surplus items (surplus * washing price)
        };
    });

    const grandTotal = finalItems.reduce((sum, item) => sum + item.totalCost, 0);
    const totalDeficitValue = finalItems.reduce((sum, item) => sum + item.deficitCost, 0);
    const totalSurplusValue = finalItems.reduce((sum, item) => sum + item.surplusCost, 0);

    return {
        items: finalItems,
        grandTotal,
        totalDeficitValue,
        totalSurplusValue
    };
};

export const updateCumulativeDeficit = async (
    tenantId: string,
    branchId: string,
    dailyDeficit: Record<string, number>
): Promise<void> => {
    if (!tenantId || !branchId || Object.keys(dailyDeficit).length === 0) return;

    const ref = doc(db, `tenants/${tenantId}/branches/${branchId}/laundry_stats`, 'cumulative_deficit');
    const snap = await getDoc(ref);
    let current = snap.exists() ? snap.data().counts || {} : {};

    Object.entries(dailyDeficit).forEach(([id, qty]) => {
        current[id] = (current[id] || 0) + qty;
    });

    await setDoc(ref, { counts: current, updatedAt: Timestamp.now() }, { merge: true });
};

/**
 * 🔐 ATOMIC: Report Lost by Laundry (Manual Deficit)
 * Reduces inLaundry count and increases Cumulative Deficit
 * Uses runTransaction for atomic operation
 */
export const reportLostByLaundry = async (
    tenantId: string,
    branchId: string,
    itemId: string,
    quantity: number,
    userId: string,
    userName: string
): Promise<void> => {
    if (!db) throw new Error('Firebase not initialized');
    if (!tenantId || !branchId || quantity <= 0) {
        throw new Error('Invalid parameters for reporting lost items');
    }

    const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_prices');
    const statsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/laundry_stats`, 'cumulative_deficit');

    await runTransaction(db, async (transaction) => {
        // 1. Read current stock
        const settingsSnap = await transaction.get(settingsRef);
        if (!settingsSnap.exists()) {
            throw new Error('Laundry settings not found');
        }

        const items = settingsSnap.data().items as LaundryItem[] || [];
        const item = items.find(i => i.id === itemId);
        
        if (!item) {
            throw new Error(`Item ${itemId} not found`);
        }

        // 🛡️ VALIDATE: Check sufficient stock in laundry
        const currentLaundry = item.inLaundry || 0;
        if (currentLaundry < quantity) {
            throw new Error(`مخزون غير كافٍ في المغسلة: ${item.name} (متوفر: ${currentLaundry}, مطلوب: ${quantity})`);
        }

        // 2. Reduce inLaundry count
        const updatedItems = items.map(i => {
            if (i.id === itemId) {
                return {
                    ...i,
                    inLaundry: Math.max(0, currentLaundry - quantity)
                };
            }
            return i;
        });
        transaction.update(settingsRef, { items: updatedItems });

        // 3. Increase Cumulative Deficit
        const statsSnap = await transaction.get(statsRef);
        const currentCounts = statsSnap.exists() ? statsSnap.data().counts || {} : {};
        currentCounts[itemId] = (currentCounts[itemId] || 0) + quantity;
        transaction.set(statsRef, { counts: currentCounts, updatedAt: serverTimestamp() }, { merge: true });

        logger.info(`✅ ATOMIC: Reported ${quantity} lost items for ${item.name}. New deficit: ${currentCounts[itemId]}`, undefined, 'laundryInventoryService');
    });
};

/**
 * 🔐 ATOMIC: Settle Deficit (Return Items from Treatment or External Source)
 * Reduces deficit count and restores stock to Rooms
 * Also supports settling treatment items (moving from inTreatment to stockRooms)
 */
export const settleDeficit = async (
    tenantId: string,
    branchId: string,
    itemId: string,
    quantity: number,
    userId: string,
    userName: string,
    fromTreatment: boolean = false // 🔐 NEW: If true, settle from treatment items instead of cumulative deficit
): Promise<void> => {
    if (!db) throw new Error('Firebase not initialized');
    if (!tenantId || !branchId || quantity <= 0) {
        throw new Error('Invalid parameters for settling deficit');
    }

    const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_prices');
    const statsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/laundry_stats`, 'cumulative_deficit');

    await runTransaction(db, async (transaction) => {
        // 1. Read current stock and deficit
        const settingsSnap = await transaction.get(settingsRef);
        if (!settingsSnap.exists()) {
            throw new Error('Laundry settings not found');
        }

        const items = settingsSnap.data().items as LaundryItem[] || [];
        const item = items.find(i => i.id === itemId);
        
        if (!item) {
            throw new Error(`Item ${itemId} not found`);
        }

        if (fromTreatment) {
            // 🔐 Settle from treatment items
            const currentTreatment = item.inTreatment || 0;
            if (currentTreatment < quantity) {
                throw new Error(`لا يمكن تسوية ${quantity} من المعالجة. المتوفر: ${currentTreatment}`);
            }

            // Move from treatment to rooms
            const updatedItems = items.map(i => {
                if (i.id === itemId) {
                    return {
                        ...i,
                        inTreatment: Math.max(0, currentTreatment - quantity),
                        stockRooms: (i.stockRooms || 0) + quantity
                    };
                }
                return i;
            });
            transaction.update(settingsRef, { items: updatedItems });
            
            logger.info(`✅ ATOMIC: Settled ${quantity} items from treatment for ${item.name}`, undefined, 'laundryInventoryService');
        } else {
            // Settle from cumulative deficit (external return)
            const statsSnap = await transaction.get(statsRef);
            if (!statsSnap.exists()) {
                throw new Error('Deficit stats not initialized');
            }

            const currentCounts = statsSnap.data().counts || {};
            const currentDeficit = currentCounts[itemId] || 0;

            if (currentDeficit < quantity) {
                throw new Error(`لا يمكن تسوية ${quantity}. الحد الأقصى للعجز: ${currentDeficit}`);
            }

            // 2. Reduce Cumulative Deficit
            currentCounts[itemId] = currentDeficit - quantity;
            transaction.update(statsRef, { counts: currentCounts, updatedAt: serverTimestamp() });

            // 3. Restore Stock to Rooms
            const updatedItems = items.map(i => {
                if (i.id === itemId) {
                    return {
                        ...i,
                        stockRooms: (i.stockRooms || 0) + quantity
                    };
                }
                return i;
            });
            transaction.update(settingsRef, { items: updatedItems });

            logger.info(`✅ ATOMIC: Settled ${quantity} items from deficit for ${item.name}. Remaining deficit: ${currentCounts[itemId]}`, undefined, 'laundryInventoryService');
        }
    });
};

export const getCumulativeDeficit = async (
    tenantId: string,
    branchId: string
): Promise<Record<string, number>> => {
    if (!tenantId || !branchId) return {};
    const ref = doc(db, `tenants/${tenantId}/branches/${branchId}/laundry_stats`, 'cumulative_deficit');
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data().counts || {} : {};
};

export const getRecords = async (
    tenantId: string,
    branchId: string,
    startDate: string,
    endDate: string
): Promise<LaundryRecord[]> => {
    if (!tenantId || !branchId) return [];

    // ⚡ PERFORMANCE: Add pagination (Issue #9)
    const q = query(
        collection(db, `tenants/${tenantId}/branches/${branchId}/laundry_records`),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc'),
        limit(100) // ✅ Increased limit for monthly reports
    );

    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LaundryRecord));
    return docs; // Already sorted by orderBy
};

/**
 * 🔐 Get Daily Variance Report
 * Calculates variance for a specific date (delivered - received - treatment)
 */
export const getDailyVariance = async (
    tenantId: string,
    branchId: string,
    date: string
): Promise<Record<string, number>> => {
    if (!tenantId || !branchId) return {};

    const recordsRef = collection(db, `tenants/${tenantId}/branches/${branchId}/laundry_records`);
    const q = query(recordsRef, where('date', '==', date), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return {};

    const record = snapshot.docs[0].data() as LaundryRecord;
    return record.dailyVariance || record.deficit || {};
};

/**
 * 🔐 Move Items to Treatment
 * Moves items from inLaundry to inTreatment (not counted as deficit)
 */
export const moveToTreatment = async (
    tenantId: string,
    branchId: string,
    itemId: string,
    quantity: number,
    userId: string,
    userName: string
): Promise<void> => {
    if (!db) throw new Error('Firebase not initialized');
    if (!tenantId || !branchId || quantity <= 0) {
        throw new Error('Invalid parameters for moving to treatment');
    }

    const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_prices');

    await runTransaction(db, async (transaction) => {
        const settingsSnap = await transaction.get(settingsRef);
        if (!settingsSnap.exists()) {
            throw new Error('Laundry settings not found');
        }

        const items = settingsSnap.data().items as LaundryItem[] || [];
        const item = items.find(i => i.id === itemId);
        
        if (!item) {
            throw new Error(`Item ${itemId} not found`);
        }

        // 🛡️ VALIDATE: Check sufficient stock in laundry
        const currentLaundry = item.inLaundry || 0;
        if (currentLaundry < quantity) {
            throw new Error(`مخزون غير كافٍ في المغسلة: ${item.name} (متوفر: ${currentLaundry}, مطلوب: ${quantity})`);
        }

        // Move from inLaundry to inTreatment
        const updatedItems = items.map(i => {
            if (i.id === itemId) {
                return {
                    ...i,
                    inLaundry: Math.max(0, currentLaundry - quantity),
                    inTreatment: (i.inTreatment || 0) + quantity
                };
            }
            return i;
        });
        transaction.update(settingsRef, { items: updatedItems });

        logger.info(`✅ ATOMIC: Moved ${quantity} items to treatment for ${item.name}`, undefined, 'laundryInventoryService');
    });
};

// ============================================================
// EXPORT & PRINT
// ============================================================

/**
 * Generate Printable Report (HTML)
 */
export const generatePrintableReport = async (
    tenantId: string,
    branchId: string,
    year: number,
    month: number
): Promise<string> => {
    const report = await getMonthlyAccountingReport(tenantId, branchId, year, month);
    const dateStr = formatDateGregorianEn(new Date());
    const monthName = new Date(year, month - 1).toLocaleDateString('ar-EG', { month: 'long', calendar: 'gregory', numberingSystem: 'latn' });

    return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>تقرير المغسلة - ${monthName} ${year}</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .header h1 { margin: 0; color: #2c3e50; }
            .header p { margin: 5px 0; color: #7f8c8d; }
            .summary { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8f9fa; p-15px; border-radius: 8px; }
            .card { text-align: center; padding: 15px; flex: 1; border-left: 1px solid #ddd; }
            .card:last-child { border-left: none; }
            .card-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
            .card-label { font-size: 14px; color: #7f8c8d; }
            .card-value.red { color: #e74c3c; }
            .card-value.green { color: #27ae60; }
            table { w-100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
            th { background: #34495e; color: white; padding: 12px; text-align: center; font-weight: normal; }
            td { padding: 10px; border-bottom: 1px solid #eee; text-align: center; }
            tr:nth-child(even) { background: #f9f9f9; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #95a5a6; border-top: 1px solid #eee; padding-top: 20px; }
            @media print {
                body { padding: 0; }
                .no-print { display: none; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>تقرير المغسلة الشهري</h1>
            <p>فرع: ${branchId} | الفترة: ${monthName} ${year}</p>
            <p>تاريخ الإصدار: ${dateStr}</p>
        </div>

        <div class="summary">
            <div class="card">
                <div class="card-value">${report.grandTotal.toFixed(2)}</div>
                <div class="card-label">إجمالي تكلفة الغسيل</div>
            </div>
            <div class="card">
                <div class="card-value red">${report.totalDeficitValue.toFixed(2)}</div>
                <div class="card-label">قيمة العجز</div>
            </div>
            <div class="card">
                <div class="card-value green">${report.totalSurplusValue.toFixed(2)}</div>
                <div class="card-label">قيمة الزيادة</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="text-align: right;">البند</th>
                    <th>العدد المُسلم</th>
                    <th>العدد المُستلم</th>
                    <th>العجز</th>
                    <th>الزيادة</th>
                    <th>سعر الغسيل</th>
                    <th>التكلفة</th>
                    <th>تكلفة العجز</th>
                </tr>
            </thead>
            <tbody>
                ${report.items.map(item => `
                <tr>
                    <td style="text-align: right; font-weight: bold;">${item.itemName}</td>
                    <td>${item.totalDelivered}</td>
                    <td>${item.totalReceived}</td>
                    <td style="color: ${item.deficit > 0 ? '#e74c3c' : '#ccc'}">${item.deficit > 0 ? -item.deficit : '-'}</td>
                    <td style="color: ${item.surplus > 0 ? '#27ae60' : '#ccc'}">${item.surplus > 0 ? '+' + item.surplus : '-'}</td>
                    <td>${item.pricePerUnit.toFixed(2)}</td>
                    <td>${item.totalCost.toFixed(2)}</td>
                    <td style="color: #e74c3c;">${item.deficitCost > 0 ? item.deficitCost.toFixed(2) : '-'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            <p>تم استخراج هذا التقرير من نظام أدورا لإدارة الفنادق</p>
        </div>
    </body>
    </html>
    `;
};

/**
 * Generate CSV Report
 */
export const generateCSVReport = async (
    tenantId: string,
    branchId: string,
    year: number,
    month: number
): Promise<string> => {
    const report = await getMonthlyAccountingReport(tenantId, branchId, year, month);

    // BOM for Excel/Arabic support
    let csv = '\ufeff';

    // Header
    csv += 'البند,العدد المسلم,العدد المستلم,العجز,الزيادة,سعر الغسيل,التكلفة الكلية,قيمة العجز\n';

    // Rows
    report.items.forEach(item => {
        csv += `"${item.itemName}",${item.totalDelivered},${item.totalReceived},${item.deficit},${item.surplus},${item.pricePerUnit},${item.totalCost},${item.deficitCost}\n`;
    });

    // Summary
    csv += `\n,,,الإجماليات,,,${report.grandTotal.toFixed(2)},${report.totalDeficitValue.toFixed(2)}`;

    return csv;
};

/**
 * Get pending delivery (delivered but not yet received)
 * ✅ FIX: Actually query for pending delivery records
 */
export const getPendingDelivery = async (
    tenantId: string,
    branchId: string
): Promise<LaundryRecord | null> => {
    if (!tenantId || !branchId) return null;

    const recordsRef = collection(db, `tenants/${tenantId}/branches/${branchId}/laundry_records`);
    
    // Find the most recent record with status 'delivered'
    const q = query(
        recordsRef,
        where('status', '==', 'delivered'),
        orderBy('date', 'desc'),
        limit(1)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as LaundryRecord;
};

