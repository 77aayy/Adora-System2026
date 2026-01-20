/**
 * Unified Procurement Cart System
 * Shared component for all departments
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Plus, Trash2, Camera, ShoppingCart, Send, AlertCircle, Upload, Loader2, Image as ImageIcon, History, Search, Package, ChevronDown } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, addDoc, Timestamp, query, where, orderBy, getDocs, limit, onSnapshot } from 'firebase/firestore';
import { haptic, playSound } from '../../utils/uxEffects';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { uploadFileToImgBB, validateImageFile } from '../../services/imageUploadService';
import { subscribeToInventory, InventoryItem } from '../../services/inventoryService';
import { confirmReceipt as confirmProcurementReceipt } from '../../services/procurementService';

// ============================================================
// TYPES
// ============================================================

type PriorityType = 'normal' | 'urgent' | 'scheduled';
type TabType = 'cart' | 'orders';

interface ProcurementOrder {
    id: string;
    items: { itemName: string; quantity: number; purchasedQty?: number; receivedQty?: number }[];
    status: 'PENDING_APPROVAL' | 'APPROVED' | 'PURCHASING' | 'PURCHASED' | 'DELIVERED' | 'RECEIVED' | 'COMPLETED';
    department: string;
    createdAt: any;
    purchasedAt?: any;
    deliveredAt?: any;
    tenantId?: string;
    branch?: string;
}

interface CartItem {
    id: string;
    itemName: string;
    quantity: number;
    photoUrl?: string;
    scheduledDate?: string;
    notes?: string;
    priority: PriorityType;
    addedAt: Date;
}

interface QuickItem {
    name: string;
    icon: string;
    defaultQty: number;
    isFromHistory?: boolean;
}

type DepartmentType = 'reception' | 'bellman' | 'housekeeping' | 'maintenance' | 'coffee_shop' | 'dashboard';

// ============================================================
// DEFAULT QUICK ITEMS BY DEPARTMENT (Used when no history)
// ============================================================

const DEFAULT_QUICK_ITEMS: Record<DepartmentType, QuickItem[]> = {
    housekeeping: [
        { name: 'منظف زجاج', icon: '🪟', defaultQty: 5 },
        { name: 'منظف أرضيات', icon: '🧹', defaultQty: 5 },
        { name: 'فوط تنظيف', icon: '🧽', defaultQty: 20 },
        { name: 'مطهر', icon: '🧪', defaultQty: 5 },
        { name: 'ملمع أثاث', icon: '✨', defaultQty: 3 },
        { name: 'شراشف سرير', icon: '🛏️', defaultQty: 10 },
        { name: 'فوط حمام', icon: '🛁', defaultQty: 20 },
        { name: 'أكياس قمامة', icon: '🗑️', defaultQty: 50 },
        { name: 'صابون سائل', icon: '🧴', defaultQty: 5 },
        { name: 'معطر جو', icon: '🌸', defaultQty: 3 },
        { name: 'مناديل ورقية', icon: '🧻', defaultQty: 10 },
        { name: 'مياه معدنية', icon: '💧', defaultQty: 24 }
    ],
    maintenance: [
        { name: 'لمبات LED', icon: '💡', defaultQty: 10 },
        { name: 'بطاريات AA', icon: '🔋', defaultQty: 20 },
        { name: 'شريط لاصق', icon: '📦', defaultQty: 5 },
        { name: 'مسامير متنوعة', icon: '🔩', defaultQty: 1 },
        { name: 'فلتر تكييف', icon: '❄️', defaultQty: 5 },
        { name: 'سيليكون', icon: '🧴', defaultQty: 3 },
        { name: 'أدوات كهربائية', icon: '🔌', defaultQty: 1 },
        { name: 'قفازات عمل', icon: '🧤', defaultQty: 5 },
        { name: 'شحم', icon: '🛢️', defaultQty: 2 },
        { name: 'براغي', icon: '🔧', defaultQty: 1 },
        { name: 'أنابيب', icon: '🚿', defaultQty: 3 },
        { name: 'دهان', icon: '🎨', defaultQty: 2 }
    ],
    bellman: [
        { name: 'ملصقات حقائب', icon: '🏷️', defaultQty: 100 },
        { name: 'كروت غرف', icon: '🗝️', defaultQty: 50 },
        { name: 'أظرف', icon: '✉️', defaultQty: 100 },
        { name: 'أقلام', icon: '🖊️', defaultQty: 24 },
        { name: 'حبل ربط', icon: '🧵', defaultQty: 5 },
        { name: 'شريط تغليف', icon: '📦', defaultQty: 10 },
        { name: 'أكياس بلاستيك', icon: '🛍️', defaultQty: 50 },
        { name: 'مناديل', icon: '🧻', defaultQty: 5 },
        { name: 'معطر', icon: '🌸', defaultQty: 3 },
        { name: 'قفازات', icon: '🧤', defaultQty: 10 },
        { name: 'مفكرة', icon: '📒', defaultQty: 5 },
        { name: 'علاقات ملابس', icon: '👔', defaultQty: 20 }
    ],
    coffee_shop: [
        { name: 'قهوة عربية', icon: '☕', defaultQty: 5 },
        { name: 'قهوة تركية', icon: '☕', defaultQty: 5 },
        { name: 'شاي أحمر', icon: '🫖', defaultQty: 5 },
        { name: 'شاي أخضر', icon: '🍵', defaultQty: 3 },
        { name: 'نسكافيه', icon: '☕', defaultQty: 10 },
        { name: 'سكر', icon: '🍬', defaultQty: 10 },
        { name: 'حليب', icon: '🥛', defaultQty: 12 },
        { name: 'مياه معدنية', icon: '💧', defaultQty: 24 },
        { name: 'مشروبات غازية', icon: '🥤', defaultQty: 24 },
        { name: 'عصائر', icon: '🧃', defaultQty: 12 },
        { name: 'كيك', icon: '🍰', defaultQty: 10 },
        { name: 'معجنات', icon: '🥐', defaultQty: 15 },
        { name: 'شيبس', icon: '🍟', defaultQty: 20 },
        { name: 'مكسرات', icon: '🥜', defaultQty: 10 },
        { name: 'مناديل ورقية', icon: '🧻', defaultQty: 20 },
        { name: 'أكواب بلاستيك', icon: '🥤', defaultQty: 100 },
        { name: 'ملاعق بلاستيك', icon: '🥄', defaultQty: 100 },
        { name: 'أكياس بلاستيك', icon: '🛍️', defaultQty: 100 },
        { name: 'مناديل مائدة', icon: '🧻', defaultQty: 50 },
        { name: 'مستلزمات تقديم', icon: '🍽️', defaultQty: 10 }
    ],
    reception: [
        { name: 'ورق طباعة A4', icon: '📄', defaultQty: 5 },
        { name: 'حبر طابعة', icon: '🖨️', defaultQty: 2 },
        { name: 'دباسة', icon: '📎', defaultQty: 2 },
        { name: 'كروت ترحيب', icon: '💌', defaultQty: 100 },
        { name: 'أقلام حبر', icon: '🖊️', defaultQty: 24 },
        { name: 'ملفات', icon: '📁', defaultQty: 10 },
        { name: 'دبابيس ورق', icon: '📌', defaultQty: 1 },
        { name: 'مسطرة', icon: '📏', defaultQty: 3 },
        { name: 'استكرات', icon: '📋', defaultQty: 5 },
        { name: 'أظرف رسمية', icon: '✉️', defaultQty: 50 },
        { name: 'كروت عمل', icon: '💳', defaultQty: 100 },
        { name: 'ختم الفندق', icon: '🔏', defaultQty: 1 }
    ],
    dashboard: [
        { name: 'قهوة', icon: '☕', defaultQty: 5 },
        { name: 'شاي', icon: '🍵', defaultQty: 5 },
        { name: 'سكر', icon: '🧂', defaultQty: 5 },
        { name: 'حليب بودرة', icon: '🥛', defaultQty: 3 },
        { name: 'بسكويت', icon: '🍪', defaultQty: 5 },
        { name: 'مياه معدنية', icon: '💧', defaultQty: 24 },
        { name: 'أكواب ورقية', icon: '🥤', defaultQty: 100 },
        { name: 'ملاعق بلاستيك', icon: '🥄', defaultQty: 50 },
        { name: 'مناديل', icon: '🧻', defaultQty: 10 },
        { name: 'عصير', icon: '🧃', defaultQty: 12 },
        { name: 'تمر', icon: '🌴', defaultQty: 3 },
        { name: 'شوكولاتة', icon: '🍫', defaultQty: 10 }
    ]
};

const MAX_QUICK_ITEMS = 12;

// ============================================================
// COMPONENT PROPS
// ============================================================

interface ProcurementCartProps {
    department: DepartmentType;
    isOpen: boolean;
    onClose: () => void;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ProcurementCart: React.FC<ProcurementCartProps> = ({
    department,
    isOpen,
    onClose
}) => {
    const { user, branchId, tenantId } = useAuth(); // ✅ Get branchId and tenantId
    const { success, error, haptic } = useUX();
    // ✅ Removed isDark - using CSS theme variables exclusively
    const { t } = useTranslation();
    
    // ✅ Feature Gate: Check if procurement system is enabled
    const { isEnabled: isProcurementEnabled } = useFeatureGate('procurementSystem');

    // State - ALL hooks must be called before any conditional returns
    const [activeTab, setActiveTab] = useState<TabType>('cart');
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [myOrders, setMyOrders] = useState<ProcurementOrder[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [itemName, setItemName] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');
    const [priority, setPriority] = useState<PriorityType>('normal');
    const [scheduledDate, setScheduledDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Image upload state
    const [photoUrl, setPhotoUrl] = useState<string | undefined>();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Partial receipt modal state
    const [partialReceiptOrder, setPartialReceiptOrder] = useState<ProcurementOrder | null>(null);
    const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

    // History-based quick items
    const [historyItems, setHistoryItems] = useState<QuickItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // ✅ NEW: Inventory items for dropdown
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [loadingInventory, setLoadingInventory] = useState(false);
    const [itemSearchQuery, setItemSearchQuery] = useState('');
    const [showItemDropdown, setShowItemDropdown] = useState(false);
    const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
    const [allowNewItem, setAllowNewItem] = useState(false);
    const itemDropdownRef = useRef<HTMLDivElement>(null);

    // ✅ NEW: Load inventory items
    useEffect(() => {
        if (!isOpen || !user) return;

        const branchId = (user as any)?.branch || 'default';
        setLoadingInventory(true);

        const unsubscribe = subscribeToInventory(
            branchId,
            (items: InventoryItem[]) => {
                // Items are already filtered by isActive in the service
                setInventoryItems(items);
                setLoadingInventory(false);
            }
            // No category filter - show all items
        );

        return () => unsubscribe();
    }, [isOpen, user]);

    // ✅ NEW: Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target as Node)) {
                setShowItemDropdown(false);
            }
        };

        if (showItemDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showItemDropdown]);

    // ✅ NEW: Filter inventory items by search query
    const filteredInventoryItems = useMemo(() => {
        if (!itemSearchQuery.trim()) {
            return inventoryItems.slice(0, 20); // Show first 20 if no search
        }

        const query = itemSearchQuery.toLowerCase();
        return inventoryItems
            .filter(item =>
                item.name.toLowerCase().includes(query) ||
                (item.nameEn && item.nameEn.toLowerCase().includes(query))
            )
            .slice(0, 20); // Limit to 20 results
    }, [inventoryItems, itemSearchQuery]);

    // ✅ NEW: Check if search query matches any inventory item
    const isExactMatch = useMemo(() => {
        if (!itemSearchQuery.trim()) return false;
        const query = itemSearchQuery.trim().toLowerCase();
        return inventoryItems.some(item =>
            item.name.toLowerCase() === query ||
            (item.nameEn && item.nameEn.toLowerCase() === query)
        );
    }, [inventoryItems, itemSearchQuery]);

    // ✅ NEW: Handle inventory item selection
    const handleSelectInventoryItem = (item: InventoryItem) => {
        setSelectedInventoryItem(item);
        setItemName(item.name); // Use EXACT name from database
        setItemSearchQuery(item.name);
        setShowItemDropdown(false);
        setAllowNewItem(false);
        haptic('light');
    };

    // ✅ NEW: Handle "Create New Item" option
    const handleCreateNewItem = () => {
        setAllowNewItem(true);
        setSelectedInventoryItem(null);
        setShowItemDropdown(false);
        haptic('light');
    };

    // Load user's procurement history
    useEffect(() => {
        if (!isOpen || !user) return;

        const loadHistory = async () => {
            setLoadingHistory(true);
            try {
                const branchId = (user as any)?.branch || 'default';
                const requestsRef = collection(db, 'procurementRequests');
                const q = query(
                    requestsRef,
                    where('department', '==', department),
                    where('branch', '==', branchId),
                    orderBy('createdAt', 'desc'),
                    limit(20)
                );

                const snapshot = await getDocs(q);
                const itemCounts: Record<string, { count: number; qty: number }> = {};

                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.items && Array.isArray(data.items)) {
                        data.items.forEach((item: any) => {
                            const name = item.itemName;
                            if (name) {
                                if (!itemCounts[name]) {
                                    itemCounts[name] = { count: 0, qty: item.quantity || 1 };
                                }
                                itemCounts[name].count++;
                                // Update with most recent quantity
                                itemCounts[name].qty = item.quantity || 1;
                            }
                        });
                    }
                });

                // Sort by frequency
                const sorted = Object.entries(itemCounts)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, MAX_QUICK_ITEMS)
                    .map(([name, data]) => ({
                        name,
                        icon: '📦',
                        defaultQty: data.qty,
                        isFromHistory: true
                    }));

                setHistoryItems(sorted);
            } catch (error) {
                console.error('Error loading history:', error);
            } finally {
                setLoadingHistory(false);
            }
        };

        loadHistory();
    }, [isOpen, user, department]);

    // Get quick items - history first, then defaults
    const quickItems = useMemo(() => {
        if (historyItems.length >= MAX_QUICK_ITEMS) {
            return historyItems.slice(0, MAX_QUICK_ITEMS);
        }

        // Merge history with defaults, avoiding duplicates
        const defaultItems = DEFAULT_QUICK_ITEMS[department] || [];
        const usedNames = new Set(historyItems.map(i => i.name));
        const fillerItems = defaultItems.filter(item => !usedNames.has(item.name));

        return [...historyItems, ...fillerItems].slice(0, MAX_QUICK_ITEMS);
    }, [historyItems, department]);

    // Load cart from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(`adora_cart_${department}`);
            if (saved) {
                setCartItems(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to load cart:', e);
        }
    }, [department]);

    // Load my orders when orders tab is active
    useEffect(() => {
        if (!isOpen || activeTab !== 'orders' || !user) return;

        setLoadingOrders(true);
        const branchId = (user as any)?.branch || 'default';
        const currentTenantId = tenantId || (user as any)?.tenantId;
        const requestsRef = collection(db, 'procurementRequests');

        // Load orders for this department that are purchased/delivered (ready to receive)
        // ✅ FIX: Added tenantId filter for SaaS isolation
        const q = query(
            requestsRef,
            where('tenantId', '==', currentTenantId),
            where('department', '==', department),
            where('branch', '==', branchId),
            limit(20)
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const orders: ProcurementOrder[] = [];
                snapshot.forEach(doc => {
                    orders.push({ id: doc.id, ...doc.data() } as ProcurementOrder);
                });

                // Client-side sort
                orders.sort((a, b) => {
                    const timeA = a.createdAt?.toMillis?.() || 0;
                    const timeB = b.createdAt?.toMillis?.() || 0;
                    return timeB - timeA;
                });

                setMyOrders(orders);
                setLoadingOrders(false);
            },
            (error) => {
                console.error('Error loading orders:', error);
                setLoadingOrders(false);
            }
        );

        return () => unsubscribe();
    }, [isOpen, activeTab, user, department]);

    // Save cart to localStorage
    const saveCart = useCallback((items: CartItem[]) => {
        try {
            localStorage.setItem(`adora_cart_${department}`, JSON.stringify(items));
        } catch (e) {
            console.error('Failed to save cart:', e);
        }
    }, [department]);

    // Handle photo upload
    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validation = validateImageFile(file);
        if (!validation.valid) {
            haptic('error');
            setUploadProgress(validation.error || t('common.error'));
            return;
        }

        setIsUploading(true);
        setUploadProgress('جاري ضغط ورفع الصورة...');
        haptic('light');

        try {
            const result = await uploadFileToImgBB(file, (progress) => {
                setUploadProgress(progress.message);
            });

            if (result.success && result.url) {
                setPhotoUrl(result.url);
                setUploadProgress('');
                haptic('success');
            } else {
                setUploadProgress(result.error || t('common.uploadError') || 'فشل الرفع');
                haptic('error');
            }
        } catch (error) {
            setUploadProgress(t('common.error') || 'حدث خطأ');
            haptic('error');
        } finally {
            setIsUploading(false);
        }
    };

    // Add item to cart
    const addToCart = () => {
        // ✅ Use exact name from inventory if selected, otherwise use typed name
        const finalItemName = selectedInventoryItem
            ? selectedInventoryItem.name
            : itemName.trim();

        if (!finalItemName || quantity < 1) {
            haptic('error');
            return;
        }

        // Validate scheduled date if priority is scheduled
        if (priority === 'scheduled' && !scheduledDate) {
            haptic('error');
            return;
        }

        const newItem: CartItem = {
            id: `${Date.now()}-${Math.random()}`,
            itemName: finalItemName, // ✅ EXACT name from inventory or typed new item
            quantity,
            photoUrl,
            scheduledDate: priority === 'scheduled' ? scheduledDate : undefined,
            notes: notes.trim() || undefined,
            priority,
            addedAt: new Date()
        };

        const updated = [...cartItems, newItem];
        setCartItems(updated);
        saveCart(updated);

        // Reset form
        setItemName('');
        setItemSearchQuery('');
        setSelectedInventoryItem(null);
        setAllowNewItem(false);
        setShowItemDropdown(false);
        setQuantity(1);
        setNotes('');
        setPhotoUrl(undefined);
        setPriority('normal');
        setScheduledDate('');

        haptic('success');
        playSound('notification');
    };

    // Remove item from cart
    const removeItem = (id: string) => {
        const updated = cartItems.filter(item => item.id !== id);
        setCartItems(updated);
        saveCart(updated);
        haptic('light');
    };

    // Fill quick item
    const fillQuickItem = (item: QuickItem) => {
        // ✅ Try to find matching inventory item first
        const matchingInventoryItem = inventoryItems.find(
            invItem => invItem.name.toLowerCase() === item.name.toLowerCase()
        );

        if (matchingInventoryItem) {
            // Use exact name from inventory
            setSelectedInventoryItem(matchingInventoryItem);
            setItemName(matchingInventoryItem.name);
            setItemSearchQuery(matchingInventoryItem.name);
        } else {
            // Use quick item name (will be new item)
            setItemName(item.name);
            setItemSearchQuery(item.name);
            setSelectedInventoryItem(null);
            setAllowNewItem(true);
        }
        setQuantity(item.defaultQty);
        haptic('light');
    };

    // Submit cart for approval
    const submitCart = async () => {
        if (cartItems.length === 0) {
            haptic('error');
            return;
        }

        setIsSubmitting(true);
        try {
            // All requests start as PENDING_APPROVAL regardless of department
            // This ensures a proper approval workflow and audit trail.
            const initialStatus = 'PENDING_APPROVAL';

            // ✅ SaaS: Validate tenantId and branchId
            const finalTenantId = tenantId || (user as any)?.tenantId;
            const finalBranchId = branchId || (user as any)?.branch || 'default';
            
            if (!finalTenantId) {
                throw new Error('tenantId is required for SaaS isolation');
            }

            await addDoc(collection(db, 'procurementRequests'), {
                items: cartItems.map(item => ({
                    itemName: item.itemName,
                    quantity: item.quantity,
                    notes: item.notes || '',
                    priority: item.priority || 'normal'
                })),
                department,
                requestedBy: {
                    id: user?.id,
                    name: user?.name
                },
                branch: finalBranchId, // ✅ Use branchId from AuthContext
                tenantId: finalTenantId, // ✅ SaaS requirement - mandatory
                status: initialStatus,
                approvedAt: null,
                approvedBy: null,
                createdAt: Timestamp.now()
            });

            // Clear cart
            setCartItems([]);
            saveCart([]);

            haptic('success');
            playSound('success');
            onClose();
        } catch (error) {
            console.error('Failed to submit cart:', error);
            haptic('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ✅ Unified receipt confirmation (Service computes shortage/overage, updates inventory, creates backorder when needed)
    const confirmReceipt = async (
        order: ProcurementOrder,
        receivedItems?: { itemName: string; receivedQty: number }[]
    ) => {
        const finalTenantId = (order as any)?.tenantId || tenantId || (user as any)?.tenantId;
        if (!finalTenantId) {
            error('tenantId غير متوفر. يرجى تسجيل الخروج والدخول مرة أخرى.');
            return;
        }
        if (!user?.id) return;

        try {
            const backorderId = await confirmProcurementReceipt(
                finalTenantId,
                order.id,
                user.id,
                user.name || '',
                receivedItems,
                undefined
            );
            haptic('success');
            playSound('success');
            success(backorderId ? 'تم الاستلام مع عجز — تم إنشاء طلب متبقي تلقائياً' : 'تم الاستلام بنجاح');
        } catch (e: any) {
            console.error('Error confirming receipt:', e);
            error(e?.message || 'فشل تأكيد الاستلام');
            haptic('error');
        }
    };

    // Open partial receipt modal
    const openPartialReceiptModal = (order: ProcurementOrder) => {
        setPartialReceiptOrder(order);
        // Initialize with full quantities
        const initialQty: Record<string, number> = {};
        order.items.forEach(item => {
            initialQty[item.itemName] = item.quantity;
        });
        setReceivedQuantities(initialQty);
    };

    // Confirm partial receipt with quantities
    const confirmPartialReceipt = async () => {
        if (!partialReceiptOrder) return;

        const receivedItems = partialReceiptOrder.items.map(item => ({
            itemName: item.itemName,
            receivedQty: receivedQuantities[item.itemName] || 0
        }));

        await confirmReceipt(partialReceiptOrder, receivedItems);
        setPartialReceiptOrder(null);
        setReceivedQuantities({});
    };

    // Get status label in Arabic
    const getStatusLabel = (status: string) => {
        const labels: Record<string, { text: string; color: string }> = {
            'PENDING_APPROVAL': { text: t('procurement.pendingApproval') || 'بانتظار الموافقة', color: 'bg-yellow-500/20 text-yellow-400' },
            'APPROVED': { text: t('procurement.approved') || 'تمت الموافقة', color: 'bg-blue-500/20 text-blue-400' },
            'PURCHASING': { text: t('procurement.purchasing') || 'جاري الشراء', color: 'bg-purple-500/20 text-purple-400' },
            'PURCHASED': { text: t('procurement.purchased') || 'تم الشراء', color: 'bg-green-500/20 text-green-400' },
            'DELIVERED': { text: t('procurement.delivered') || 'تم التسليم', color: 'bg-primary-500/20 text-emerald-400' },
            'RECEIVED': { text: t('procurement.received') || 'تم الاستلام', color: 'bg-gray-500/20 text-gray-400' },
            'COMPLETED': { text: t('common.completed') || 'مكتمل', color: 'bg-gray-500/20 text-gray-400' }
        };
        return labels[status] || { text: status, color: 'bg-gray-500/20 text-gray-400' };
    };

    // ✅ Hide component if feature is disabled or not open - AFTER all hooks
    if (!isProcurementEnabled || !isOpen) {
        return null;
    }

    // ✅ Theme-aware colors for modal - using CSS variables
    const modalBg = 'var(--theme-bg-secondary)';
    const borderColor = 'var(--theme-border-primary)';
    const tertiaryBg = 'var(--theme-bg-tertiary)';
    const textPrimary = 'var(--theme-text-primary)';
    const textSecondary = 'var(--theme-text-secondary)';
    const textTertiary = 'var(--theme-text-tertiary)';

    return (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ backdropFilter: 'none' }}>
            <div 
                className="w-full sm:max-w-2xl max-h-screen sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl"
                style={{ 
                    background: modalBg,
                    border: `1px solid ${borderColor}`,
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold" style={{ color: textPrimary }}>المشتريات</h3>
                            <p className="text-sm" style={{ color: textSecondary }}>
                                {activeTab === 'cart' ? `${cartItems.length} عنصر` : `${myOrders.length} طلب`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ color: textSecondary }} className="hover:opacity-80">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b px-4" style={{ borderColor }}>
                    <button
                        onClick={() => setActiveTab('cart')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'cart'
                            ? 'border-primary-500 text-primary-400'
                            : 'border-transparent'
                            }`}
                        style={activeTab !== 'cart' ? { color: 'var(--theme-text-secondary)' } : {}}
                    >
                        🛒 طلب جديد
                        {cartItems.length > 0 && (
                            <span className="mr-2 px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 text-xs">
                                {cartItems.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'orders'
                            ? 'border-primary-500 text-primary-400'
                            : 'border-transparent'
                            }`}
                        style={activeTab !== 'orders' ? { color: 'var(--theme-text-secondary)' } : {}}
                    >
                        📦 طلباتي
                        {myOrders.filter(o => o.status === 'DELIVERED' || o.status === 'PURCHASED').length > 0 && (
                            <span className="mr-2 px-2 py-0.5 rounded-full bg-primary-500/20 text-emerald-400 text-xs">
                                {myOrders.filter(o => o.status === 'DELIVERED' || o.status === 'PURCHASED').length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {activeTab === 'cart' ? (
                        <>
                            {/* Quick Items - Compact Grid */}
                            <div>
                                <h4 className="text-xs font-semibold mb-1.5" style={{ color: textSecondary }}>أصناف سريعة</h4>
                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                                    {quickItems.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => fillQuickItem(item)}
                                            className="p-1.5 rounded-lg transition-all text-center hover:scale-105 active:scale-95"
                                            style={{ 
                                                background: tertiaryBg, 
                                                border: `1px solid ${borderColor}`,
                                            }}
                                        >
                                            <div className="text-sm mb-0.5">{item.icon}</div>
                                            <div className="text-[9px] leading-tight line-clamp-1 font-medium" style={{ color: textPrimary }}>{item.name}</div>
                                            <div className="text-[8px]" style={{ color: textTertiary }}>×{item.defaultQty}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Add Item Form */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold" style={{ color: textSecondary }}>إضافة عنصر</h4>

                                {/* ✅ NEW: Searchable Inventory Dropdown */}
                                <div className="relative" ref={itemDropdownRef}>
                                    <div className="relative">
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
                                        <input
                                            type="text"
                                            value={itemSearchQuery}
                                            onChange={(e) => {
                                                setItemSearchQuery(e.target.value);
                                                setItemName(e.target.value);
                                                setShowItemDropdown(true);
                                                setSelectedInventoryItem(null);
                                                setAllowNewItem(false);
                                            }}
                                            onFocus={() => setShowItemDropdown(true)}
                                            placeholder={t('procurement.searchInventoryProduct') || 'ابحث عن منتج من المخزون...'}
                                            className="input w-full pr-10"
                                        />
                                        {selectedInventoryItem && (
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                                <Package className="w-4 h-4 text-green-400" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Dropdown Results */}
                                    {showItemDropdown && (
                                        <div 
                                            className="absolute z-50 w-full mt-2 rounded-2xl shadow-2xl max-h-64 overflow-y-auto"
                                            style={{ 
                                                background: modalBg, 
                                                border: `1px solid ${borderColor}`,
                                            }}
                                        >
                                            {loadingInventory ? (
                                                <div className="p-4 text-center text-white/60">
                                                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                                    <p className="text-sm">جاري تحميل المخزون...</p>
                                                </div>
                                            ) : filteredInventoryItems.length > 0 ? (
                                                <>
                                                    {filteredInventoryItems.map((item) => (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => handleSelectInventoryItem(item)}
                                                            className="w-full p-3 text-right transition-colors"
                                                            style={{ 
                                                                borderBottom: `1px solid ${borderColor}`,
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = tertiaryBg}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex-1">
                                                                    <p className="font-medium" style={{ color: textPrimary }}>{item.name}</p>
                                                                    {item.nameEn && (
                                                                        <p className="text-xs" style={{ color: textTertiary }}>{item.nameEn}</p>
                                                                    )}
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${(item.totalQuantity || 0) <= item.minQuantity
                                                                            ? 'bg-red-500/20 text-red-400'
                                                                            : 'bg-green-500/20 text-green-400'
                                                                            }`}>
                                                                            المخزون: {item.totalQuantity || 0} {item.unit}
                                                                        </span>
                                                                        {(item.totalQuantity || 0) <= item.minQuantity && (
                                                                            <span className="text-xs text-orange-400">⚠️ منخفض</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <ChevronDown className="w-4 h-4 text-white/70 rotate-[-90deg]" />
                                                            </div>
                                                        </button>
                                                    ))}

                                                    {/* "Create New Item" option if no exact match */}
                                                    {!isExactMatch && itemSearchQuery.trim() && (
                                                        <button
                                                            type="button"
                                                            onClick={handleCreateNewItem}
                                                            className="w-full p-3 text-right hover:bg-white/10 transition-colors border-t border-white/10 bg-blue-500/10"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Plus className="w-4 h-4 text-blue-400" />
                                                                <div className="flex-1 text-right">
                                                                    <p className="text-blue-400 font-medium">
                                                                        إضافة "{itemSearchQuery}" كعنصر جديد
                                                                    </p>
                                                                    <p className="text-xs text-blue-400/60">
                                                                        سيتم إضافته للمخزون عند الاستلام
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="p-4 text-center">
                                                    <p className="text-white/60 text-sm mb-2">لا توجد عناصر في المخزون</p>
                                                    {itemSearchQuery.trim() && (
                                                        <button
                                                            type="button"
                                                            onClick={handleCreateNewItem}
                                                            className="text-blue-400 text-sm hover:text-blue-300"
                                                        >
                                                            إضافة "{itemSearchQuery}" كعنصر جديد
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Selected Item Indicator */}
                                    {selectedInventoryItem && !showItemDropdown && (
                                        <div className="mt-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                                            <div className="flex items-center gap-2">
                                                <Package className="w-4 h-4 text-green-400" />
                                                <div className="flex-1 text-right">
                                                    <p className="text-xs text-green-400 font-medium">
                                                        {selectedInventoryItem.name} - المخزون الحالي: {selectedInventoryItem.totalQuantity || 0} {selectedInventoryItem.unit}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* New Item Indicator */}
                                    {allowNewItem && !selectedInventoryItem && (
                                        <div className="mt-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                                            <div className="flex items-center gap-2">
                                                <Plus className="w-4 h-4 text-blue-400" />
                                                <p className="text-xs text-blue-400 font-medium">
                                                    عنصر جديد: "{itemName}" - سيتم إضافته للمخزون عند الاستلام
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                        min="1"
                                        placeholder={t('procurement.quantity') || 'الكمية'}
                                        className="input"
                                    />
                                </div>

                                {/* Priority Selection - Styled Buttons */}
                                <div className="space-y-2">
                                    <label className="text-xs" style={{ color: textSecondary }}>الأولوية</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPriority('normal')}
                                            className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${priority === 'normal'
                                                ? 'bg-blue-500 text-white'
                                                : ''
                                                }`}
                                            style={priority !== 'normal' ? { 
                                                background: tertiaryBg, 
                                                color: textSecondary,
                                                border: `1px solid ${borderColor}`,
                                            } : {}}
                                        >
                                            عادي
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPriority('urgent')}
                                            className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${priority === 'urgent'
                                                ? 'bg-red-500 text-white'
                                                : ''
                                                }`}
                                            style={priority !== 'urgent' ? { 
                                                background: tertiaryBg, 
                                                color: textSecondary,
                                                border: `1px solid ${borderColor}`,
                                            } : {}}
                                        >
                                            🔥 عاجل
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPriority('scheduled')}
                                            className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${priority === 'scheduled'
                                                ? 'bg-purple-500 text-white'
                                                : ''
                                                }`}
                                            style={priority !== 'scheduled' ? { 
                                                background: tertiaryBg, 
                                                color: textSecondary,
                                                border: `1px solid ${borderColor}`,
                                            } : {}}
                                        >
                                            📅 مجدول
                                        </button>
                                    </div>

                                    {/* Date Picker for Scheduled */}
                                    {priority === 'scheduled' && (
                                        <input
                                            type="date"
                                            value={scheduledDate}
                                            onChange={(e) => setScheduledDate(e.target.value)}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                            style={{ 
                                                background: tertiaryBg, 
                                                border: `1px solid ${borderColor}`,
                                                color: textPrimary,
                                                colorScheme: isDark ? 'dark' : 'light',
                                            }}
                                        />
                                    )}
                                </div>

                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder={t('common.notesOptional') || 'ملاحظات (اختياري)'}
                                    className="input resize-none"
                                    rows={2}
                                />

                                {/* Photo Upload Section */}
                                <div className="space-y-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handlePhotoSelect}
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                    />

                                    {photoUrl ? (
                                        <div className="relative">
                                            <img
                                                src={photoUrl}
                                                alt="صورة المنتج"
                                                className="w-full h-32 object-cover rounded-xl"
                                            />
                                            <button
                                                onClick={() => setPhotoUrl(undefined)}
                                                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/90 flex items-center justify-center text-white"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="w-full py-3 rounded-xl border border-dashed flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                            style={{ 
                                                background: tertiaryBg, 
                                                borderColor: borderColor,
                                                color: textSecondary,
                                            }}
                                        >
                                            {isUploading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span>{uploadProgress}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Camera className="w-5 h-5" />
                                                    <span>إضافة صورة (اختياري)</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                <button onClick={addToCart} disabled={isUploading} className="btn-primary w-full disabled:opacity-50">
                                    <Plus className="w-5 h-5" />
                                    إضافة للعربة
                                </button>
                            </div>

                            {/* Cart Items */}
                            {cartItems.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold" style={{ color: textSecondary }}>العناصر في العربة</h4>
                                    {cartItems.map((item) => (
                                        <div 
                                            key={item.id} 
                                            className="rounded-xl p-3 flex items-center gap-3"
                                            style={{ 
                                                background: tertiaryBg, 
                                                border: `1px solid ${borderColor}`,
                                            }}
                                        >
                                            {item.photoUrl && (
                                                <img
                                                    src={item.photoUrl}
                                                    alt={item.itemName}
                                                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-white truncate">{item.itemName}</span>
                                                    {item.priority === 'urgent' && (
                                                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs flex-shrink-0">
                                                            عاجل
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm" style={{ color: textSecondary }}>الكمية: {item.quantity}</div>
                                                {item.notes && (
                                                    <div className="text-xs mt-1 truncate" style={{ color: textTertiary }}>{item.notes}</div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                className="text-red-400 hover:text-red-300 flex-shrink-0"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        /* My Orders Tab */
                        <div className="space-y-3">
                            {loadingOrders ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                                </div>
                            ) : myOrders.length === 0 ? (
                                <div className="text-center py-12 text-white/60">
                                    <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>لا توجد طلبات</p>
                                </div>
                            ) : (
                                myOrders.map((order) => {
                                    const status = getStatusLabel(order.status);
                                    const canReceive = order.status === 'PURCHASED' || order.status === 'DELIVERED';

                                    return (
                                        <div 
                                            key={order.id} 
                                            className="rounded-xl p-4 space-y-3"
                                            style={{ 
                                                background: tertiaryBg, 
                                                border: `1px solid ${borderColor}`,
                                            }}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                                    {status.text}
                                                </span>
                                                <span className="text-xs" style={{ color: textTertiary }}>
                                                    {order.createdAt?.toDate?.()?.toLocaleDateString('ar-SA')}
                                                </span>
                                            </div>

                                            <div className="space-y-1">
                                                {order.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between text-sm">
                                                        <span style={{ color: textPrimary }}>{item.itemName}</span>
                                                        <span style={{ color: textSecondary }}>×{item.quantity}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {canReceive && (
                                                <div className="flex gap-2 pt-2 border-t border-white/10">
                                                    <button
                                                        onClick={() => {
                                                            const receivedItems = order.items.map(it => ({
                                                                itemName: it.itemName,
                                                                receivedQty: Number((it as any).purchasedQty ?? it.quantity ?? 0)
                                                            }));
                                                            confirmReceipt(order, receivedItems);
                                                        }}
                                                        className="flex-1 py-2 rounded-lg bg-primary-500/20 text-emerald-400 text-sm font-medium hover:bg-primary-500/30 transition-colors"
                                                    >
                                                        ✓ استلام كامل
                                                    </button>
                                                    <button
                                                        onClick={() => openPartialReceiptModal(order)}
                                                        className="flex-1 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 text-sm font-medium hover:bg-yellow-500/30 transition-colors"
                                                    >
                                                        ⚠ استلام جزئي
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Footer - Only show for cart tab */}
                {activeTab === 'cart' && (
                    <div className="p-4 border-t border-white/10 flex-shrink-0">
                        <button
                            onClick={submitCart}
                            disabled={cartItems.length === 0 || isSubmitting}
                            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    إرسال للموافقة ({cartItems.length})
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Partial Receipt Modal */}
            {partialReceiptOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60" style={{ backdropFilter: 'none' }}
                        onClick={() => setPartialReceiptOrder(null)}
                    />
                    <div 
                        className="relative w-full max-w-md rounded-3xl p-6 animate-slide-up shadow-2xl"
                        style={{ 
                            background: 'var(--theme-bg-secondary)', 
                            border: '1px solid var(--theme-border-primary)',
                        }}
                    >
                        <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--theme-text-primary)' }}>استلام جزئي</h3>
                        <p className="text-sm mb-6" style={{ color: 'var(--theme-text-secondary)' }}>
                            حدد الكميات المستلمة فعلياً لكل صنف
                        </p>

                        <div className="space-y-3 max-h-96 overflow-y-auto mb-6">
                            {partialReceiptOrder.items.map((item, index) => (
                                <div 
                                    key={index} 
                                    className="p-4 rounded-xl"
                                    style={{ 
                                        background: 'var(--theme-bg-tertiary)', 
                                        border: '1px solid var(--theme-border-primary)',
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{item.itemName}</span>
                                        <span className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                            المطلوب: {item.quantity}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm whitespace-nowrap" style={{ color: 'var(--theme-text-secondary)' }}>
                                            الكمية المستلمة:
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            // Allow overage entry if supplier delivered extra
                                            max={999999}
                                            value={receivedQuantities[item.itemName] || 0}
                                            onChange={(e) => setReceivedQuantities({
                                                ...receivedQuantities,
                                                [item.itemName]: parseInt(e.target.value) || 0
                                            })}
                                            className="flex-1 px-3 py-2 rounded-lg text-center"
                                            style={{ 
                                                background: 'var(--theme-bg-primary)', 
                                                border: '1px solid var(--theme-border-primary)',
                                                color: 'var(--theme-text-primary)',
                                            }}
                                        />
                                    </div>
                                    {receivedQuantities[item.itemName] < item.quantity && (
                                        <div className="mt-2 text-xs text-yellow-500">
                                            ⚠ عجز: {item.quantity - receivedQuantities[item.itemName]}
                                        </div>
                                    )}
                                    {receivedQuantities[item.itemName] > item.quantity && (
                                        <div className="mt-2 text-xs text-primary-500">
                                            ✓ زيادة: {receivedQuantities[item.itemName] - item.quantity}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setPartialReceiptOrder(null)}
                                className="flex-1 py-3 rounded-xl font-medium"
                                style={{ 
                                    background: 'var(--theme-bg-tertiary)', 
                                    border: '1px solid var(--theme-border-primary)',
                                    color: 'var(--theme-text-secondary)',
                                }}
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={confirmPartialReceipt}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-teal-400 to-teal-500 text-white font-medium"
                            >
                                {t('procurement.confirmReceipt') || 'تأكيد الاستلام'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcurementCart;
