/**
 * Guest Products Service
 * Coffee shop, minibar, and room service menus
 * Adora Hotel Management System V2
 */

import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp, onSnapshot, orderBy } from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

interface Product {
    id: string;
    name: string;
    nameEn?: string;
    description?: string;
    descriptionEn?: string;
    price: number;
    category: string;
    subcategory?: string;
    imageUrl?: string;
    available: boolean;
    featured?: boolean;
    preparationTime?: number; // minutes
    calories?: number;
    branch: string;
    sortOrder: number;
}

interface Category {
    id: string;
    name: string;
    nameEn?: string;
    icon: string;
    type: 'coffee' | 'food' | 'minibar' | 'service';
    sortOrder: number;
    branch: string;
}

interface CartItem {
    product: Product;
    quantity: number;
    notes?: string;
    customizations?: string[];
}

interface Order {
    id?: string;
    roomNumber: string;
    guestName?: string;
    guestPhone?: string;
    items: {
        productId: string;
        productName: string;
        quantity: number;
        price: number;
        notes?: string;
    }[];
    subtotal: number;
    tax: number;
    total: number;
    status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
    orderType: 'coffee' | 'food' | 'minibar';
    specialInstructions?: string;
    createdAt: Timestamp;
    confirmedAt?: Timestamp;
    deliveredAt?: Timestamp;
    branch: string;
}

// ============================================================
// PRODUCTS
// ============================================================

/**
 * Get products by type
 * @param tenantId - The tenant ID for SaaS isolation
 * @param branch - The branch ID
 * @param type - Product type filter
 */
export const getProductsByType = async (
    tenantId: string,
    branch: string,
    type: 'coffee' | 'food' | 'minibar' | 'service'
): Promise<Product[]> => {
    try {
        const categories = await getCategories(tenantId, branch, type);
        const categoryIds = categories.map(c => c.id);

        if (categoryIds.length === 0) return [];

        // ✅ SaaS: Use tenant-scoped collection path
        const q = query(
            collection(db, `tenants/${tenantId}/branches/${branch}/products`),
            where('available', '==', true),
            where('category', 'in', categoryIds),
            orderBy('sortOrder')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
    } catch (error) {
        console.error('Failed to get products:', error);
        return [];
    }
};

/**
 * Get featured products
 */
export const getFeaturedProducts = async (tenantId: string, branch: string): Promise<Product[]> => {
    try {
        // ✅ SaaS: Use tenant-scoped collection path
        const q = query(
            collection(db, `tenants/${tenantId}/branches/${branch}/products`),
            where('available', '==', true),
            where('featured', '==', true)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
    } catch {
        return [];
    }
};

/**
 * Subscribe to products
 */
export const subscribeToProducts = (
    tenantId: string,
    branch: string,
    callback: (products: Product[]) => void
): (() => void) => {
    // ✅ SaaS: Use tenant-scoped collection path
    const q = query(
        collection(db, `tenants/${tenantId}/branches/${branch}/products`),
        where('available', '==', true),
        orderBy('sortOrder')
    );

    return onSnapshot(q, snapshot => {
        const products = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
        callback(products);
    });
};

/**
 * Search products
 */
export const searchProducts = async (
    tenantId: string,
    branch: string,
    searchQuery: string
): Promise<Product[]> => {
    const products = await getProductsByType(tenantId, branch, 'coffee');
    const foodProducts = await getProductsByType(tenantId, branch, 'food');
    const allProducts = [...products, ...foodProducts];

    const queryStr = searchQuery.toLowerCase();
    return allProducts.filter(p =>
        p.name.toLowerCase().includes(queryStr) ||
        (p.nameEn?.toLowerCase().includes(queryStr)) ||
        (p.description?.toLowerCase().includes(queryStr))
    );
};

// ============================================================
// CATEGORIES
// ============================================================

/**
 * Get categories
 */
export const getCategories = async (
    tenantId: string,
    branch: string,
    type?: Category['type']
): Promise<Category[]> => {
    try {
        // ✅ SaaS: Use tenant-scoped collection path
        let q = query(
            collection(db, `tenants/${tenantId}/branches/${branch}/productCategories`),
            orderBy('sortOrder')
        );

        if (type) {
            q = query(q, where('type', '==', type));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Category[];
    } catch {
        return [];
    }
};

// ============================================================
// CART
// ============================================================

const CART_KEY = 'adora_cart';

/**
 * Get cart from localStorage
 */
export const getCart = (): CartItem[] => {
    try {
        const stored = localStorage.getItem(CART_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

/**
 * Save cart to localStorage
 */
const saveCart = (cart: CartItem[]): void => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
};

/**
 * Add item to cart
 */
export const addToCart = (product: Product, quantity = 1, notes?: string): CartItem[] => {
    const cart = getCart();
    const existing = cart.find(item => item.product.id === product.id);

    if (existing) {
        existing.quantity += quantity;
        if (notes) existing.notes = notes;
    } else {
        cart.push({ product, quantity, notes });
    }

    saveCart(cart);
    return cart;
};

/**
 * Update cart item quantity
 */
export const updateCartQuantity = (productId: string, quantity: number): CartItem[] => {
    const cart = getCart();
    const item = cart.find(i => i.product.id === productId);

    if (item) {
        if (quantity <= 0) {
            return removeFromCart(productId);
        }
        item.quantity = quantity;
    }

    saveCart(cart);
    return cart;
};

/**
 * Remove item from cart
 */
export const removeFromCart = (productId: string): CartItem[] => {
    const cart = getCart().filter(item => item.product.id !== productId);
    saveCart(cart);
    return cart;
};

/**
 * Clear cart
 */
export const clearCart = (): void => {
    localStorage.removeItem(CART_KEY);
};

/**
 * Get cart totals
 */
export const getCartTotals = (): { subtotal: number; tax: number; total: number; itemCount: number } => {
    const cart = getCart();
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const tax = subtotal * 0.15; // 15% VAT
    const total = subtotal + tax;
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    return { subtotal, tax, total, itemCount };
};

// ============================================================
// ORDERS
// ============================================================

/**
 * Place order
 */
export const placeOrder = async (
    roomNumber: string,
    branch: string,
    orderType: Order['orderType'],
    guestName?: string,
    guestPhone?: string,
    specialInstructions?: string
): Promise<string | null> => {
    try {
        const cart = getCart();
        if (cart.length === 0) return null;

        const { subtotal, tax, total } = getCartTotals();

        const order: Omit<Order, 'id'> = {
            roomNumber,
            guestName,
            guestPhone,
            items: cart.map(item => ({
                productId: item.product.id,
                productName: item.product.name,
                quantity: item.quantity,
                price: item.product.price,
                notes: item.notes
            })),
            subtotal,
            tax,
            total,
            status: 'pending',
            orderType,
            specialInstructions,
            createdAt: Timestamp.now(),
            branch
        };

        const docRef = await addDoc(collection(db, 'orders'), order);
        clearCart();

        return docRef.id;
    } catch (error) {
        console.error('Failed to place order:', error);
        return null;
    }
};

/**
 * Get room orders
 */
export const getRoomOrders = async (
    roomNumber: string,
    branch: string
): Promise<Order[]> => {
    try {
        const q = query(
            collection(db, 'orders'),
            where('roomNumber', '==', roomNumber),
            where('branch', '==', branch),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Order[];
    } catch {
        return [];
    }
};

/**
 * Track order
 */
export const subscribeToOrder = (
    orderId: string,
    callback: (order: Order | null) => void
): (() => void) => {
    return onSnapshot(doc(db, 'orders', orderId), snapshot => {
        if (snapshot.exists()) {
            callback({ id: snapshot.id, ...snapshot.data() } as Order);
        } else {
            callback(null);
        }
    });
};

/**
 * Update order status (for staff)
 */
export const updateOrderStatus = async (
    orderId: string,
    status: Order['status']
): Promise<void> => {
    const updates: any = { status };

    if (status === 'confirmed') {
        updates.confirmedAt = Timestamp.now();
    } else if (status === 'delivered') {
        updates.deliveredAt = Timestamp.now();
    }

    await updateDoc(doc(db, 'orders', orderId), updates);
};

// ============================================================
// RECOMMENDATIONS
// ============================================================

/**
 * Get product recommendations
 */
export const getRecommendations = async (
    tenantId: string,
    branch: string,
    currentTime = new Date()
): Promise<Product[]> => {
    const hour = currentTime.getHours();

    // Morning: coffee and breakfast
    // Afternoon: lunch items
    // Evening: dinner and drinks

    let type: 'coffee' | 'food' = 'coffee';
    let suggestions: string[] = [];

    if (hour >= 6 && hour < 11) {
        type = 'coffee';
        suggestions = ['قهوة', 'إفطار', 'عصير'];
    } else if (hour >= 11 && hour < 15) {
        type = 'food';
        suggestions = ['غداء', 'سلطة', 'ساندويتش'];
    } else if (hour >= 15 && hour < 18) {
        type = 'coffee';
        suggestions = ['قهوة', 'حلويات', 'شاي'];
    } else {
        type = 'food';
        suggestions = ['عشاء', 'مشروبات', 'حلويات'];
    }

    const products = await getProductsByType(tenantId, branch, type);

    // Filter by time-appropriate suggestions
    return products
        .filter(p => suggestions.some(s =>
            p.name.includes(s) ||
            p.category.includes(s) ||
            p.featured
        ))
        .slice(0, 6);
};

// ============================================================
// REACT HOOKS
// ============================================================

import { useState, useEffect, useCallback } from 'react';

export const useProducts = (tenantId: string, branch: string, type?: 'coffee' | 'food' | 'minibar' | 'service') => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [prods, cats] = await Promise.all([
                type ? getProductsByType(tenantId, branch, type) : [],
                getCategories(tenantId, branch, type)
            ]);
            setProducts(prods);
            setCategories(cats);
            setLoading(false);
        };

        if (tenantId && branch) {
            load();
        }
    }, [tenantId, branch, type]);

    return { products, categories, loading };
};

export const useCart = () => {
    const [cart, setCart] = useState<CartItem[]>(getCart());
    const [totals, setTotals] = useState(getCartTotals());

    const refresh = useCallback(() => {
        setCart(getCart());
        setTotals(getCartTotals());
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const add = useCallback((product: Product, quantity = 1, notes?: string) => {
        addToCart(product, quantity, notes);
        refresh();
    }, [refresh]);

    const update = useCallback((productId: string, quantity: number) => {
        updateCartQuantity(productId, quantity);
        refresh();
    }, [refresh]);

    const remove = useCallback((productId: string) => {
        removeFromCart(productId);
        refresh();
    }, [refresh]);

    const clear = useCallback(() => {
        clearCart();
        refresh();
    }, [refresh]);

    return {
        cart,
        ...totals,
        add,
        update,
        remove,
        clear,
        refresh
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    getProductsByType,
    getFeaturedProducts,
    subscribeToProducts,
    searchProducts,
    getCategories,
    getCart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    getCartTotals,
    placeOrder,
    getRoomOrders,
    subscribeToOrder,
    updateOrderStatus,
    getRecommendations,
    useProducts,
    useCart
};
