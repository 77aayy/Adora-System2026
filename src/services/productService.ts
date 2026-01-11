/**
 * Product Service
 * Manages minibar and amenity products
 * Adora Hotel Management System V2
 */

import {
    collection,
    doc,
    setDoc,
    onSnapshot,
    query,
    orderBy,
    Unsubscribe,
    getDocs,
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export interface Product {
    id: string;
    name: string;
    nameEn?: string;
    price: number;
    category: 'minibar' | 'amenity';
    stock?: number;
    image?: string;
}

export interface ConsumedItem {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
}

const PRODUCTS_COLLECTION = 'products';

// ============================================================
// HELPERS
// ============================================================

const mapDocToProduct = (doc: any): Product => {
    const data = doc.data();
    return {
        id: doc.id,
        name: data.name,
        nameEn: data.nameEn,
        price: data.price || 0,
        category: data.category || 'minibar',
        stock: data.stock,
        image: data.image,
    };
};

// ============================================================
// SUBSCRIPTIONS
// ============================================================

/**
 * Subscribe to products (real-time)
 */
export const subscribeToProducts = (
    callback: (products: Product[]) => void
): Unsubscribe => {
    const productsRef = collection(db, PRODUCTS_COLLECTION);
    const q = query(productsRef, orderBy('category'), orderBy('name'));

    return onSnapshot(q, (snapshot) => {
        const products = snapshot.docs.map(mapDocToProduct);
        callback(products);
    });
};

/**
 * Get all products once
 */
export const getProducts = async (): Promise<Product[]> => {
    const productsRef = collection(db, PRODUCTS_COLLECTION);
    const snapshot = await getDocs(productsRef);
    return snapshot.docs.map(mapDocToProduct);
};

/**
 * Get products by category
 */
export const getProductsByCategory = async (category: 'minibar' | 'amenity'): Promise<Product[]> => {
    const products = await getProducts();
    return products.filter(p => p.category === category);
};

// ============================================================
// SEED DATA
// ============================================================

/**
 * Seed initial products for testing
 */
export const seedInitialProducts = async (): Promise<void> => {
    const products: Product[] = [
        // Minibar
        { id: 'water-500', name: 'مياه معدنية 500مل', nameEn: 'Water 500ml', price: 5, category: 'minibar' },
        { id: 'water-1500', name: 'مياه معدنية 1.5 لتر', nameEn: 'Water 1.5L', price: 8, category: 'minibar' },
        { id: 'pepsi', name: 'بيبسي', nameEn: 'Pepsi', price: 7, category: 'minibar' },
        { id: 'cola', name: 'كوكاكولا', nameEn: 'Coca-Cola', price: 7, category: 'minibar' },
        { id: 'sprite', name: 'سبرايت', nameEn: 'Sprite', price: 7, category: 'minibar' },
        { id: 'juice-orange', name: 'عصير برتقال', nameEn: 'Orange Juice', price: 10, category: 'minibar' },
        { id: 'juice-apple', name: 'عصير تفاح', nameEn: 'Apple Juice', price: 10, category: 'minibar' },
        { id: 'chips', name: 'شيبس', nameEn: 'Chips', price: 8, category: 'minibar' },
        { id: 'chocolate', name: 'شوكولاتة', nameEn: 'Chocolate', price: 12, category: 'minibar' },
        { id: 'nuts', name: 'مكسرات', nameEn: 'Mixed Nuts', price: 15, category: 'minibar' },
        { id: 'energy-drink', name: 'ريد بول', nameEn: 'Red Bull', price: 18, category: 'minibar' },

        // Amenities
        { id: 'shampoo', name: 'شامبو', nameEn: 'Shampoo', price: 0, category: 'amenity' },
        { id: 'soap', name: 'صابون', nameEn: 'Soap', price: 0, category: 'amenity' },
        { id: 'toothbrush', name: 'فرشاة أسنان', nameEn: 'Toothbrush', price: 0, category: 'amenity' },
        { id: 'slippers', name: 'شباشب', nameEn: 'Slippers', price: 0, category: 'amenity' },
        { id: 'bathrobe', name: 'روب استحمام', nameEn: 'Bathrobe', price: 0, category: 'amenity' },
    ];

    for (const product of products) {
        await setDoc(doc(db, PRODUCTS_COLLECTION, product.id), product);
    }

    console.log('✅ تم إنشاء المنتجات التجريبية');
};
