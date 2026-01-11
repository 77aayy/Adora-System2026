/**
 * Procurement Cart System
 * Shopping cart for procurement requests with quick items
 * Adora Hotel Management System V2
 */

import { useState, useCallback, useEffect } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

// ============================================================
// TYPES
// ============================================================

export type CartPriority = 'normal' | 'urgent' | 'scheduled';
export type Department = 'reception' | 'housekeeping' | 'maintenance' | 'bellman' | 'dashboard';

export interface CartItem {
    id: number;
    itemName: string;
    quantity: number;
    photoUrl?: string;
    notes?: string;
    source?: Department;
    priority: CartPriority;
    scheduledDate?: string;
    addedAt: Date;
}

export interface QuickItem {
    name: string;
    icon: string;
    defaultQty: number;
}

// ============================================================
// QUICK ITEMS DATABASE
// ============================================================

export const QUICK_ITEMS: Record<string, QuickItem[]> = {
    common: [
        { name: 'مياه معدنية', icon: '💧', defaultQty: 24 },
        { name: 'مناديل ورقية', icon: '🧻', defaultQty: 10 },
        { name: 'صابون سائل', icon: '🧴', defaultQty: 5 },
        { name: 'معطر جو', icon: '🌸', defaultQty: 3 },
        { name: 'أكياس قمامة', icon: '🗑️', defaultQty: 50 },
    ],
    housekeeping: [
        { name: 'منظف زجاج', icon: '🪟', defaultQty: 5 },
        { name: 'منظف أرضيات', icon: '🧹', defaultQty: 5 },
        { name: 'فوط تنظيف', icon: '🧽', defaultQty: 20 },
        { name: 'مطهر', icon: '🧪', defaultQty: 5 },
        { name: 'ملمع أثاث', icon: '✨', defaultQty: 3 },
        { name: 'شراشف سرير', icon: '🛏️', defaultQty: 10 },
        { name: 'فوط حمام', icon: '🛁', defaultQty: 20 },
    ],
    maintenance: [
        { name: 'لمبات LED', icon: '💡', defaultQty: 10 },
        { name: 'بطاريات AA', icon: '🔋', defaultQty: 20 },
        { name: 'شريط لاصق', icon: '📦', defaultQty: 5 },
        { name: 'مسامير متنوعة', icon: '🔩', defaultQty: 1 },
        { name: 'فلتر تكييف', icon: '❄️', defaultQty: 5 },
        { name: 'سيليكون', icon: '🧴', defaultQty: 3 },
    ],
    bellman: [
        { name: 'ملصقات حقائب', icon: '🏷️', defaultQty: 100 },
        { name: 'كروت غرف', icon: '🗝️', defaultQty: 50 },
        { name: 'أظرف', icon: '✉️', defaultQty: 100 },
        { name: 'أقلام', icon: '🖊️', defaultQty: 24 },
    ],
    reception: [
        { name: 'ورق طباعة A4', icon: '📄', defaultQty: 5 },
        { name: 'حبر طابعة', icon: '🖨️', defaultQty: 2 },
        { name: 'دباسة', icon: '📎', defaultQty: 2 },
        { name: 'كروت ترحيب', icon: '💌', defaultQty: 100 },
    ],
    dashboard: [
        { name: 'قهوة', icon: '☕', defaultQty: 5 },
        { name: 'شاي', icon: '🍵', defaultQty: 5 },
        { name: 'سكر', icon: '🧂', defaultQty: 5 },
        { name: 'حليب بودرة', icon: '🥛', defaultQty: 3 },
    ],
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get quick items for department
 */
export const getQuickItemsForDepartment = (department: Department): QuickItem[] => {
    const common = QUICK_ITEMS.common || [];
    const deptItems = QUICK_ITEMS[department] || [];
    return [...deptItems, ...common];
};

/**
 * Detect current department from URL
 */
export const detectCurrentDepartment = (): Department => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('housekeeping')) return 'housekeeping';
    if (path.includes('maintenance')) return 'maintenance';
    if (path.includes('bellman')) return 'bellman';
    if (path.includes('reception')) return 'reception';
    if (path.includes('dashboard') || path.includes('admin')) return 'dashboard';
    return 'reception';
};

/**
 * Get department name in Arabic
 */
export const getDeptNameAr = (dept: Department): string => {
    const names: Record<Department, string> = {
        reception: 'الاستقبال',
        housekeeping: 'التدبير المنزلي',
        maintenance: 'الصيانة',
        bellman: 'البيلمان',
        dashboard: 'الإدارة',
    };
    return names[dept] || dept;
};

// ============================================================
// LOCAL STORAGE
// ============================================================

const CART_STORAGE_KEY = 'adora_cart';

const loadCartFromStorage = (): CartItem[] => {
    try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        if (saved) {
            const items = JSON.parse(saved);
            return items.map((item: any) => ({
                ...item,
                addedAt: new Date(item.addedAt),
            }));
        }
    } catch (e) {
        console.warn('Error loading cart from localStorage:', e);
    }
    return [];
};

const saveCartToStorage = (items: CartItem[]): void => {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
        console.warn('Error saving cart to localStorage:', e);
    }
};

// ============================================================
// REACT HOOK
// ============================================================

export const useProcurementCart = () => {
    const [cartItems, setCartItems] = useState<CartItem[]>(loadCartFromStorage);

    // Sync with localStorage
    useEffect(() => {
        saveCartToStorage(cartItems);
    }, [cartItems]);

    const addToCart = useCallback((
        itemName: string,
        quantity: number,
        options?: {
            photoUrl?: string;
            notes?: string;
            source?: Department;
            priority?: CartPriority;
            scheduledDate?: string;
        }
    ) => {
        if (!itemName || quantity < 1) return;

        const newItem: CartItem = {
            id: Date.now() + Math.random(),
            itemName: itemName.trim(),
            quantity,
            photoUrl: options?.photoUrl,
            notes: options?.notes,
            source: options?.source || detectCurrentDepartment(),
            priority: options?.priority || 'normal',
            scheduledDate: options?.scheduledDate,
            addedAt: new Date(),
        };

        setCartItems(prev => [...prev, newItem]);
    }, []);

    const removeFromCart = useCallback((itemId: number) => {
        setCartItems(prev => prev.filter(item => item.id !== itemId));
    }, []);

    const updateItemPriority = useCallback((itemId: number, priority: CartPriority) => {
        setCartItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, priority, scheduledDate: priority !== 'scheduled' ? undefined : item.scheduledDate } : item
        ));
    }, []);

    const updateItemDate = useCallback((itemId: number, date: string) => {
        setCartItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, scheduledDate: date } : item
        ));
    }, []);

    const clearCart = useCallback(() => {
        setCartItems([]);
    }, []);

    const submitCart = useCallback(async (
        employeeId: string,
        employeeName: string,
        tenantId: string, // 🔐 NEW: Required for SaaS isolation
        branchId: string, // 🔐 NEW: Required for multi-branch support
        source: Department = detectCurrentDepartment()
    ): Promise<boolean> => {
        // 🔐 Security: Validate required parameters
        if (!tenantId) {
            console.error('🚨 Security Error: tenantId is required for procurement request');
            return false;
        }
        if (cartItems.length === 0) return false;

        try {
            const isManager = source === 'dashboard';
            const status = isManager ? 'CONFIRMED' : 'PENDING_APPROVAL';

            const promises = cartItems.map(item => {
                const requestData: any = {
                    type: 'procurement',
                    source,
                    itemName: item.itemName,
                    quantity: item.quantity,
                    description: item.notes || null,
                    photoUrl: item.photoUrl || null,
                    priority: item.priority,
                    isUrgent: item.priority === 'urgent',
                    scheduledDate: item.priority === 'scheduled' ? item.scheduledDate : null,
                    status,
                    tenantId, // 🔐 SaaS: Critical for tenant isolation
                    branch: branchId, // 🔐 Multi-branch support
                    createdBy: { id: employeeId, name: employeeName },
                    createdAt: Timestamp.now(),
                    timeline: { created: Timestamp.now() },
                };

                if (isManager) {
                    requestData.approvedBy = { id: employeeId, name: employeeName };
                    requestData.timeline.approved = Timestamp.now();
                }

                return addDoc(collection(db, 'requests'), requestData);
            });

            await Promise.all(promises);
            clearCart();
            return true;
        } catch (error) {
            console.error('Error submitting cart:', error);
            return false;
        }
    }, [cartItems, clearCart]);

    return {
        cartItems,
        cartCount: cartItems.length,
        addToCart,
        removeFromCart,
        updateItemPriority,
        updateItemDate,
        clearCart,
        submitCart,
    };
};

export default useProcurementCart;
