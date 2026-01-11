/**
 * Minibar Restocking Service
 * Automatic restocking after checkout
 * Adora Hotel Management System V2
 */

import { doc, updateDoc, addDoc, collection, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { quickAudit } from './auditService';

// ============================================================
// TYPES
// ============================================================

export interface RestockItem {
    productId: string;
    productName: string;
    consumed: number;
    restocked: number;
}

export interface RestockRecord {
    id?: string;
    roomNumber: string;
    items: RestockItem[];
    totalValue: number;
    performedBy: string;
    performedByName: string;
    timestamp: Date;
}

// ============================================================
// FUNCTIONS
// ============================================================

/**
 * Create a restock record and charge to guest's bill
 */
export const createRestockRecord = async (
    roomNumber: string,
    items: RestockItem[],
    performedBy: string,
    performedByName: string
): Promise<string> => {
    const totalValue = items.reduce((sum, item) => {
        // Get price from products collection would be better
        return sum + (item.consumed * 5); // Placeholder price
    }, 0);

    const recordRef = await addDoc(collection(db, 'restockRecords'), {
        roomNumber,
        items,
        totalValue,
        performedBy,
        performedByName,
        timestamp: Timestamp.now(),
    });

    quickAudit('REQUEST_COMPLETE', 'restock', recordRef.id, { roomNumber, totalValue });

    return recordRef.id;
};

/**
 * Get restocking suggestions based on consumption
 */
export const getRestockSuggestions = async (
    roomNumber: string,
    consumedItems: Array<{ productId: string; productName: string; quantity: number }>
): Promise<RestockItem[]> => {
    return consumedItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        consumed: item.quantity,
        restocked: item.quantity, // Suggest full restock
    }));
};

/**
 * Update product stock after restocking
 */
export const updateProductStock = async (
    productId: string,
    quantityUsed: number
): Promise<void> => {
    const productRef = doc(db, 'products', productId);
    const productDoc = await getDoc(productRef);

    if (productDoc.exists()) {
        const currentStock = productDoc.data().stock || 0;
        await updateDoc(productRef, {
            stock: Math.max(0, currentStock - quantityUsed),
        });
    }
};

/**
 * Calculate total restocking cost
 */
export const calculateRestockCost = (items: RestockItem[], prices: Record<string, number>): number => {
    return items.reduce((sum, item) => {
        const price = prices[item.productId] || 0;
        return sum + (item.restocked * price);
    }, 0);
};
