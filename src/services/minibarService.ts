/**
 * Minibar Service
 * Manages minibar products and consumption
 * SaaS Multi-Tenant Support: Each manager has isolated minibar products
 */

import { collection, doc, getDocs, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { MinibarProduct, MinibarSettings } from '../types/minibar';

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
