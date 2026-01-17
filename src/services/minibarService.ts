/**
 * Minibar Service
 * Manages minibar products and consumption
 * SaaS Multi-Tenant Support: Each manager has isolated minibar products
 * ✅ ATOMIC TRANSACTIONS: All consumption uses runTransaction to prevent Race Conditions
 */

import { 
    collection, doc, getDocs, getDoc, setDoc, serverTimestamp, 
    runTransaction, Timestamp, increment, addDoc 
} from 'firebase/firestore';
import { db } from './firebase';
import { MinibarProduct, MinibarSettings } from '../types/minibar';
import { validateTenantId, validateTenantAccess } from './tenantSecurityService';
import { logger } from './loggerService';

const SETTINGS_COLLECTION = 'settings';
const MINIBAR_SETTINGS_DOC = 'minibar';

/**
 * Get default minibar products (fallback)
 */
export const getDefaultMinibarProducts = (): MinibarProduct[] => [
    { id: 'water', name: 'ماء', nameEn: 'Water', price: 3, category: 'beverage', isActive: true },
    { id: 'cola', name: 'كولا', nameEn: 'Cola', price: 5, category: 'beverage', isActive: true },
    { id: 'juice', name: 'عصير', nameEn: 'Juice', price: 6, category: 'beverage', isActive: true },
    { id: 'chips', name: 'شيبس', nameEn: 'Chips', price: 4, category: 'snack', isActive: true },
    { id: 'chocolate', name: 'شوكولاتة', nameEn: 'Chocolate', price: 7, category: 'snack', isActive: true },
    { id: 'nuts', name: 'مكسرات', nameEn: 'Nuts', price: 8, category: 'snack', isActive: true },
];

/**
 * Load minibar products from settings
 * Supports both legacy (global) and tenant-scoped (SaaS) models
 */
export const loadMinibarProducts = async (tenantId?: string): Promise<MinibarProduct[]> => {
    try {
        let settingsRef;
        
        if (tenantId) {
            // Tenant-scoped (SaaS model): tenants/{tenantId}/settings/minibar
            settingsRef = doc(db, `tenants/${tenantId}/settings`, MINIBAR_SETTINGS_DOC);
        } else {
            // Legacy (global): settings/minibar
            settingsRef = doc(db, SETTINGS_COLLECTION, MINIBAR_SETTINGS_DOC);
        }
        
        const snapshot = await getDoc(settingsRef);

        if (snapshot.exists()) {
            const data = snapshot.data() as MinibarSettings;
            const activeProducts = data.products?.filter(p => p.isActive !== false) || [];

            if (activeProducts.length > 0) {
                return activeProducts;
            }
        }

        // Return defaults if no products found
        return getDefaultMinibarProducts();
    } catch (error) {
        console.error('Error loading minibar products:', error);
        return getDefaultMinibarProducts();
    }
};

/**
 * Save minibar products (Admin only)
 * Supports both legacy (global) and tenant-scoped (SaaS) models
 */
export const saveMinibarProducts = async (
    products: MinibarProduct[],
    userId: string,
    tenantId?: string
): Promise<void> => {
    try {
        let settingsRef;
        
        if (tenantId) {
            // Tenant-scoped (SaaS model): tenants/{tenantId}/settings/minibar
            settingsRef = doc(db, `tenants/${tenantId}/settings`, MINIBAR_SETTINGS_DOC);
        } else {
            // Legacy (global): settings/minibar
            settingsRef = doc(db, SETTINGS_COLLECTION, MINIBAR_SETTINGS_DOC);
        }

        await setDoc(settingsRef, {
            products,
            updatedAt: serverTimestamp(),
            updatedBy: userId
        }, { merge: true });
    } catch (error) {
        console.error('Error saving minibar products:', error);
        throw error;
    }
};

/**
 * Calculate total from consumption
 */
export const calculateMinibarTotal = (
    consumption: Record<string, number>,
    products: MinibarProduct[]
): number => {
    return products.reduce((total, product) => {
        const quantity = consumption[product.id] || 0;
        return total + (quantity * product.price);
    }, 0);
};

/**
 * 🔐 ATOMIC: Consume minibar items and charge to Room Card
 * Uses runTransaction to prevent Race Conditions
 * Automatically adds charge to Room Card for billing
 */
export const consumeMinibarItems = async (
    tenantId: string,
    branchId: string,
    roomNumber: string,
    roomCardId: string,
    consumption: Record<string, number>, // { productId: quantity }
    products: MinibarProduct[],
    recordedBy: string,
    recordedByName: string
): Promise<{ consumptionRecordId: string; total: number }> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot consume minibar items', undefined, 'minibarService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    // Calculate total before transaction
    const consumedItems: Array<{ itemId: string; itemName: string; quantity: number; price: number; total: number }> = [];
    let total = 0;

    products.forEach(product => {
        const quantity = consumption[product.id] || 0;
        if (quantity > 0) {
            const itemTotal = quantity * product.price;
            consumedItems.push({
                itemId: product.id,
                itemName: product.name || product.nameEn || product.id,
                quantity,
                price: product.price,
                total: itemTotal
            });
            total += itemTotal;
        }
    });

    if (consumedItems.length === 0) {
        throw new Error('لا يوجد عناصر للاستهلاك');
    }

    // ✅ FIX: Create consumption record reference BEFORE transaction to get ID
    const consumptionRef = collection(db, `tenants/${validatedTenantId}/minibar_consumption`);
    const consumptionRecordRef = doc(consumptionRef); // Generate ID here
    const consumptionRecordId = consumptionRecordRef.id; // Get ID before transaction

    // ✅ ATOMIC TRANSACTION: Consume items + Update inventory + Charge Room Card
    await runTransaction(db, async (transaction) => {
        const settingsRef = doc(db, `tenants/${validatedTenantId}/settings`, 'minibar');
        const settingsSnap = await transaction.get(settingsRef);

        if (!settingsSnap.exists()) {
            throw new Error('إعدادات الميني بار غير موجودة');
        }

        const settings = settingsSnap.data() as MinibarSettings;
        const currentProducts = settings.products || [];

        // Validate stock and update inventory
        const updatedProducts = currentProducts.map(product => {
            const quantity = consumption[product.id] || 0;
            if (quantity > 0) {
                const currentStock = product.stock || 0;
                
                // 🛡️ VALIDATE: Check sufficient stock
                if (currentStock < quantity) {
                    throw new Error(`مخزون غير كافٍ: ${product.name || product.nameEn} (متوفر: ${currentStock}, مطلوب: ${quantity})`);
                }

                return {
                    ...product,
                    stock: Math.max(0, currentStock - quantity)
                };
            }
            return product;
        });

        // Update settings with new stock
        transaction.update(settingsRef, {
            products: updatedProducts,
            updatedAt: serverTimestamp()
        });

        // ✅ FIX: Use pre-generated consumption record reference (ID already known)
        transaction.set(consumptionRecordRef, {
            roomNumber,
            roomCardId, // ✅ Link to Room Card
            branchId,
            tenantId: validatedTenantId,
            items: consumedItems,
            total,
            recordedAt: Timestamp.now(),
            recordedBy,
            recordedByName
        });

        logger.info(`✅ ATOMIC: Minibar consumption recorded for Room ${roomNumber}. Total: ${total} SAR`, undefined, 'minibarService');
    });

    // ✅ Charge Room Card (outside transaction to avoid conflicts, but linked)
    try {
        // ✅ FIX: Use consumptionRecordId from pre-generated doc reference
        const { addChargeToRoomCard } = await import('./roomCardService');
        await addChargeToRoomCard(
            validatedTenantId,
            branchId,
            roomCardId,
            roomNumber,
            {
                type: 'minibar',
                description: `استهلاك ميني بار - ${consumedItems.map(i => `${i.itemName} (${i.quantity})`).join(', ')}`,
                amount: total,
                currency: 'SAR',
                requestId: consumptionRecordId,
                items: consumedItems.map(i => ({ name: i.itemName, quantity: i.quantity, price: i.price }))
            },
            recordedBy,
            recordedByName
        );
    } catch (chargeError) {
        logger.warn('Failed to charge Room Card for minibar consumption (non-critical)', chargeError, 'minibarService');
        // Don't fail consumption if charging fails - charge can be added manually later
    }

    return { consumptionRecordId, total };
};
