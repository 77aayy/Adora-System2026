/**
 * Procurement Cart Service
 * Migrated from procurement-cart.js with TypeScript and React integration
 * Adora Hotel Management System V2
 */

import { db } from './firebase';
import {
    collection, doc, addDoc, getDocs, updateDoc, writeBatch,
    query, where, orderBy, limit, serverTimestamp
} from 'firebase/firestore';
import { uploadFileToImgBB } from './imageUploadService';

// ============================================================
// TYPES
// ============================================================

export interface CartItem {
    id: string;
    itemName: string;
    quantity: number;
    photoUrl: string | null;
    notes: string | null;
    source: Department;
    priority: Priority;
    scheduledDate: string | null;
    addedAt: Date;
}

export interface QuickItem {
    name: string;
    icon: string;
    defaultQty: number;
}

export type Department = 'reception' | 'housekeeping' | 'maintenance' | 'bellman' | 'dashboard' | 'manager';
export type Priority = 'normal' | 'urgent' | 'scheduled';

export interface EmployeeData {
    employeeId: string;
    employeeName: string;
    branchId: string;
    hotelId?: string; // 🔐 DEPRECATED: Use tenantId instead
    tenantId?: string; // 🔐 SaaS: Required for tenant isolation
    department?: string;
}

export interface ReceivingItem {
    id: string;
    items: { name: string; quantity: number; photoUrl?: string }[];
    purchasedBy?: { name: string; id: string };
    purchasedAt?: any;
    requestedBy?: { department: string };
    status: string;
}

// ============================================================
// QUICK ITEMS DATA
// ============================================================

export const QUICK_ITEMS: Record<string, QuickItem[]> = {
    common: [
        { name: 'مياه معدنية', icon: '💧', defaultQty: 24 },
        { name: 'مناديل ورقية', icon: '🧻', defaultQty: 10 },
        { name: 'صابون سائل', icon: '🧴', defaultQty: 5 },
        { name: 'معطر جو', icon: '🌸', defaultQty: 3 },
        { name: 'أكياس قمامة', icon: '🗑️', defaultQty: 50 }
    ],
    housekeeping: [
        { name: 'منظف زجاج', icon: '🪟', defaultQty: 5 },
        { name: 'منظف أرضيات', icon: '🧹', defaultQty: 5 },
        { name: 'فوط تنظيف', icon: '🧽', defaultQty: 20 },
        { name: 'مطهر', icon: '🧪', defaultQty: 5 },
        { name: 'ملمع أثاث', icon: '✨', defaultQty: 3 },
        { name: 'شراشف سرير', icon: '🛏️', defaultQty: 10 },
        { name: 'فوط حمام', icon: '🛁', defaultQty: 20 }
    ],
    maintenance: [
        { name: 'لمبات LED', icon: '💡', defaultQty: 10 },
        { name: 'بطاريات AA', icon: '🔋', defaultQty: 20 },
        { name: 'شريط لاصق', icon: '📦', defaultQty: 5 },
        { name: 'مسامير متنوعة', icon: '🔩', defaultQty: 1 },
        { name: 'فلتر تكييف', icon: '❄️', defaultQty: 5 },
        { name: 'سيليكون', icon: '🧴', defaultQty: 3 }
    ],
    bellman: [
        { name: 'ملصقات حقائب', icon: '🏷️', defaultQty: 100 },
        { name: 'كروت غرف', icon: '🗝️', defaultQty: 50 },
        { name: 'أظرف', icon: '✉️', defaultQty: 100 },
        { name: 'أقلام', icon: '🖊️', defaultQty: 24 }
    ],
    reception: [
        { name: 'ورق طباعة A4', icon: '📄', defaultQty: 5 },
        { name: 'حبر طابعة', icon: '🖨️', defaultQty: 2 },
        { name: 'دباسة', icon: '📎', defaultQty: 2 },
        { name: 'كروت ترحيب', icon: '💌', defaultQty: 100 }
    ],
    dashboard: [
        { name: 'قهوة', icon: '☕', defaultQty: 5 },
        { name: 'شاي', icon: '🍵', defaultQty: 5 },
        { name: 'سكر', icon: '🧂', defaultQty: 5 },
        { name: 'حليب بودرة', icon: '🥛', defaultQty: 3 }
    ]
};

/**
 * Get quick items for department
 */
export const getQuickItemsForDepartment = (department: Department): QuickItem[] => {
    const common = QUICK_ITEMS.common || [];
    const deptItems = QUICK_ITEMS[department] || [];
    return [...deptItems, ...common];
};

// ============================================================
// CART STATE MANAGEMENT
// ============================================================

const STORAGE_KEY = 'adora_cart';
let cartItems: CartItem[] = [];

/**
 * Load cart from localStorage
 */
export const loadCartFromStorage = (): CartItem[] => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            cartItems = JSON.parse(saved);
            return cartItems;
        }
    } catch (e) {
        console.warn('Error loading cart:', e);
    }
    return [];
};

/**
 * Save cart to localStorage
 */
export const saveCartToStorage = (): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    } catch (e) {
        console.warn('Error saving cart:', e);
    }
};

/**
 * Get current cart items
 */
export const getCartItems = (): CartItem[] => {
    if (cartItems.length === 0) {
        loadCartFromStorage();
    }
    return [...cartItems];
};

/**
 * Get cart count
 */
export const getCartCount = (): number => {
    if (cartItems.length === 0) {
        loadCartFromStorage();
    }
    return cartItems.length;
};

// ============================================================
// CART OPERATIONS
// ============================================================

/**
 * Generate unique ID
 */
const generateId = (): string => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Add item to cart
 */
export const addToCart = (
    itemName: string,
    quantity: number,
    options: {
        photoUrl?: string | null;
        notes?: string | null;
        source?: Department;
        priority?: Priority;
        scheduledDate?: string | null;
    } = {}
): CartItem | null => {
    if (!itemName?.trim() || !quantity || quantity < 1) {
        return null;
    }

    const newItem: CartItem = {
        id: generateId(),
        itemName: itemName.trim(),
        quantity: Math.max(1, Math.floor(quantity)),
        photoUrl: options.photoUrl || null,
        notes: options.notes || null,
        source: options.source || 'reception',
        priority: options.priority || 'normal',
        scheduledDate: options.scheduledDate || null,
        addedAt: new Date()
    };

    cartItems.push(newItem);
    saveCartToStorage();
    return newItem;
};

/**
 * Remove item from cart
 */
export const removeFromCart = (itemId: string): boolean => {
    const initialLength = cartItems.length;
    cartItems = cartItems.filter(item => item.id !== itemId);

    if (cartItems.length !== initialLength) {
        saveCartToStorage();
        return true;
    }
    return false;
};

/**
 * Update item quantity
 */
export const updateItemQuantity = (itemId: string, quantity: number): boolean => {
    const item = cartItems.find(i => i.id === itemId);
    if (item && quantity > 0) {
        item.quantity = Math.floor(quantity);
        saveCartToStorage();
        return true;
    }
    return false;
};

/**
 * Update item priority
 */
export const updateItemPriority = (
    itemId: string,
    priority: Priority,
    scheduledDate?: string | null
): boolean => {
    const item = cartItems.find(i => i.id === itemId);
    if (item) {
        item.priority = priority;
        item.scheduledDate = priority === 'scheduled' ? (scheduledDate || null) : null;
        saveCartToStorage();
        return true;
    }
    return false;
};

/**
 * Update item scheduled date
 */
export const updateItemDate = (itemId: string, date: string): boolean => {
    const item = cartItems.find(i => i.id === itemId);
    if (item && item.priority === 'scheduled') {
        item.scheduledDate = date;
        saveCartToStorage();
        return true;
    }
    return false;
};

/**
 * Clear cart
 */
export const clearCart = (): void => {
    cartItems = [];
    saveCartToStorage();
};

// ============================================================
// CART SUBMISSION
// ============================================================

/**
 * Submit cart to Firestore as Procurement Request
 * ✅ FIX: Now uses procurementService.createProcurementRequest instead of saving to requests collection
 * 🔐 SECURITY: tenantId is required for SaaS tenant isolation
 */
export const submitCart = async (
    source: Department,
    employeeData: EmployeeData
): Promise<{ success: boolean; count: number; error?: string }> => {
    const items = getCartItems();

    // 🔐 Security: Validate tenantId
    const tenantId = employeeData.tenantId || employeeData.hotelId;
    if (!tenantId) {
        console.error('🚨 Security Error: tenantId is required for procurement request');
        return { success: false, count: 0, error: 'خطأ: معرف المستأجر مطلوب' };
    }

    if (items.length === 0) {
        return { success: false, count: 0, error: 'العربة فارغة' };
    }

    try {
        // ✅ FIX: Use procurementService.createProcurementRequest instead of direct Firestore write
        const { createProcurementRequest } = await import('./procurementService');
        
        // Map cart items to procurement items format
        const procurementItems = items.map(item => ({
            itemName: item.itemName,
            quantity: item.quantity,
            notes: item.notes || undefined,
            priority: item.priority === 'urgent' ? 'urgent' as const : item.priority === 'scheduled' ? 'normal' as const : 'normal' as const,
            photoUrl: item.photoUrl || undefined,
            scheduledDate: item.priority === 'scheduled' && item.scheduledDate ? item.scheduledDate : undefined,
            category: undefined, // Can be auto-detected from itemName if needed
            unit: undefined // Can be auto-detected if needed
        }));

        // Determine department from source
        const department = employeeData.department || source || 'reception';

        // Manager/dashboard sends directly as APPROVED, others need approval
        const bypassApproval = (source === 'dashboard' || source === 'manager');

        // ✅ Create procurement request using procurementService
        await createProcurementRequest(
            procurementItems,
            department,
            {
                id: employeeData.employeeId,
                name: employeeData.employeeName
            },
            employeeData.branchId,
            tenantId,
            {
                bypassApproval
            }
        );

        const count = items.length;
        clearCart();

        return { success: true, count };
    } catch (error: any) {
        console.error('Error submitting cart:', error);
        return { success: false, count: 0, error: error.message || 'حدث خطأ أثناء الإرسال' };
    }
};

// ============================================================
// RECEIVING MANAGEMENT
// ============================================================

/**
 * Load pending receiving items
 */
export const loadPendingReceiving = async (branchId: string): Promise<ReceivingItem[]> => {
    try {
        const receivingQuery = query(
            collection(db, 'procurement_requests'),
            where('branch', '==', branchId),
            where('status', 'in', ['PURCHASED', 'DELIVERED']),
            orderBy('purchasedAt', 'desc'),
            limit(20)
        );

        const snapshot = await getDocs(receivingQuery);
        const items: ReceivingItem[] = [];

        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() } as ReceivingItem);
        });

        return items;
    } catch (error) {
        console.error('Error loading pending receiving:', error);
        return [];
    }
};

/**
 * Confirm receiving
 */
export const confirmReceiving = async (
    requestId: string,
    employeeData: EmployeeData
): Promise<boolean> => {
    try {
        await updateDoc(doc(db, 'procurement_requests', requestId), {
            status: 'RECEIVED',
            receivedAt: serverTimestamp(),
            receivedBy: {
                id: employeeData.employeeId,
                name: employeeData.employeeName,
                department: employeeData.department || null
            },
            'timeline.received': serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error confirming receiving:', error);
        return false;
    }
};

// ============================================================
// PHOTO CAPTURE
// ============================================================

/**
 * Capture and upload photo
 */
export const captureAndUploadPhoto = async (
    onProgress?: (message: string) => void
): Promise<string | null> => {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';

        input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];

            if (file) {
                onProgress?.('جاري رفع الصورة...');
                const result = await uploadFileToImgBB(file);

                if (result.success && result.url) {
                    onProgress?.('تم رفع الصورة بنجاح');
                    resolve(result.url);
                } else {
                    onProgress?.('فشل رفع الصورة');
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        };

        input.click();
    });
};

// ============================================================
// DEPARTMENT NAMES
// ============================================================

const DEPARTMENT_NAMES: Record<string, string> = {
    'reception': 'الاستقبال',
    'housekeeping': 'التدبير المنزلي',
    'maintenance': 'الصيانة',
    'bellman': 'البيلمان',
    'coffee': 'الكوفي شوب',
    'dashboard': 'الإدارة',
    'manager': 'المدير'
};

export const getDepartmentName = (dept: string): string => {
    return DEPARTMENT_NAMES[dept] || dept || 'قسم';
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback, useEffect, useMemo } from 'react';

interface UseCartReturn {
    items: CartItem[];
    count: number;
    isEmpty: boolean;
    addItem: (name: string, qty: number, options?: Parameters<typeof addToCart>[2]) => CartItem | null;
    removeItem: (id: string) => boolean;
    updateQuantity: (id: string, qty: number) => boolean;
    updatePriority: (id: string, priority: Priority, date?: string | null) => boolean;
    clear: () => void;
    submit: (source: Department, employee: EmployeeData) => Promise<{ success: boolean; count: number; error?: string }>;
    refresh: () => void;
}

export const useCart = (): UseCartReturn => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        setItems(getCartItems());
    }, [refreshKey]);

    const refresh = useCallback(() => {
        setRefreshKey(k => k + 1);
    }, []);

    const addItem = useCallback((
        name: string,
        qty: number,
        options?: Parameters<typeof addToCart>[2]
    ) => {
        const result = addToCart(name, qty, options);
        refresh();
        return result;
    }, [refresh]);

    const removeItem = useCallback((id: string) => {
        const result = removeFromCart(id);
        refresh();
        return result;
    }, [refresh]);

    const updateQuantity = useCallback((id: string, qty: number) => {
        const result = updateItemQuantity(id, qty);
        refresh();
        return result;
    }, [refresh]);

    const updatePriority = useCallback((id: string, priority: Priority, date?: string | null) => {
        const result = updateItemPriority(id, priority, date);
        refresh();
        return result;
    }, [refresh]);

    const clear = useCallback(() => {
        clearCart();
        refresh();
    }, [refresh]);

    const submit = useCallback(async (source: Department, employee: EmployeeData) => {
        const result = await submitCart(source, employee);
        if (result.success) {
            refresh();
        }
        return result;
    }, [refresh]);

    const count = useMemo(() => items.length, [items]);
    const isEmpty = useMemo(() => items.length === 0, [items]);

    return {
        items,
        count,
        isEmpty,
        addItem,
        removeItem,
        updateQuantity,
        updatePriority,
        clear,
        submit,
        refresh
    };
};

// ============================================================
// QUICK ITEMS HOOK
// ============================================================

export const useQuickItems = (department: Department) => {
    return useMemo(() => getQuickItemsForDepartment(department), [department]);
};

// ============================================================
// INITIALIZATION
// ============================================================

// Load cart on module import
loadCartFromStorage();

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Quick items
    QUICK_ITEMS,
    getQuickItemsForDepartment,

    // Cart operations
    getCartItems,
    getCartCount,
    addToCart,
    removeFromCart,
    updateItemQuantity,
    updateItemPriority,
    updateItemDate,
    clearCart,

    // Submission
    submitCart,

    // Receiving
    loadPendingReceiving,
    confirmReceiving,

    // Photo
    captureAndUploadPhoto,

    // Utils
    getDepartmentName,

    // Hooks
    useCart,
    useQuickItems
};
