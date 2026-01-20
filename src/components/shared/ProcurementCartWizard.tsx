/**
 * Procurement Cart Wizard
 * Mobile-First Step-by-Step Procurement Flow
 * 
 * الخطوات:
 * 1️⃣ اختيار المنتجات (Quick Items + Search)
 * 2️⃣ مراجعة الكميات والأولويات
 * 3️⃣ إرسال الطلب
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Plus, Minus, ShoppingCart, Send, Check, 
    ChevronLeft, ChevronRight, Package, Search,
    AlertCircle, Trash2, Loader2, History
} from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, addDoc, Timestamp, query, where, orderBy, getDocs, limit as fbLimit } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useTranslation } from 'react-i18next';

// ============================================================
// TYPES
// ============================================================

interface CartItem {
    id: string;
    name: string;
    quantity: number;
    priority: 'normal' | 'urgent';
}

interface QuickItem {
    name: string;
    icon: string;
    defaultQty: number;
    frequency?: number; // How many times ordered
}

type Step = 'select' | 'review' | 'confirm';

// Default icon map for common items
const ITEM_ICONS: Record<string, string> = {
    'أوراق': '📄', 'ورق': '📄', 'A4': '📄',
    'أقلام': '🖊️', 'قلم': '🖊️',
    'دباسة': '📌', 'دبابيس': '📌',
    'مناديل': '🧻', 'منديل': '🧻',
    'أكواب': '☕', 'كوب': '☕',
    'مياه': '💧', 'ماء': '💧',
    'منظف': '🧹', 'منظفات': '🧹',
    'فوط': '🧽', 'فوطة': '🧽',
    'شامبو': '🧴', 'صابون': '🧼',
    'أكياس': '🗑️', 'كيس': '🗑️',
    'معطر': '🌸', 'عطر': '🌸',
    'لمبات': '💡', 'لمبة': '💡',
    'بطاريات': '🔋', 'بطارية': '🔋',
    'أدوات': '🔧', 'أداة': '🔧',
    'شريط': '📦', 'لاصق': '📦',
    'فلتر': '❄️', 'فلاتر': '❄️',
    'قهوة': '☕', 'شاي': '🍵',
    'سكر': '🧊', 'حليب': '🥛',
    'ملاعق': '🥄', 'ملعقة': '🥄',
};

// Get icon for item name
const getItemIcon = (name: string): string => {
    for (const [key, icon] of Object.entries(ITEM_ICONS)) {
        if (name.includes(key)) return icon;
    }
    return '📦'; // Default icon
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    department: string;
    tenantId?: string;
    autoApproved?: boolean; // ✅ For manager requests - skip approval step
}

export const ProcurementCartWizard: React.FC<Props> = ({
    isOpen,
    onClose,
    department,
    tenantId,
    autoApproved = false // ✅ Default: requires approval
}) => {
    const { user } = useAuth();
    const { success, error: showError, haptic } = useUX();
    // ✅ Removed isDark - using CSS theme variables exclusively
      const { t } = useTranslation();

    // State
    const [step, setStep] = useState<Step>('select');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dynamicQuickItems, setDynamicQuickItems] = useState<QuickItem[]>([]);
    const [loadingQuickItems, setLoadingQuickItems] = useState(true);

    // ✅ Fetch dynamic quick items from department's recent orders
    useEffect(() => {
        if (!tenantId || !department || !isOpen) return;
        
        const fetchRecentItems = async () => {
            setLoadingQuickItems(true);
            try {
                // Get recent procurement requests for this department
                const q = query(
                    collection(db, 'procurementRequests'),
                    where('tenantId', '==', tenantId),
                    where('department', '==', department),
                    orderBy('createdAt', 'desc'),
                    fbLimit(50) // Get last 50 orders to analyze
                );
                
                const snapshot = await getDocs(q);
                
                // Count item frequencies
                const itemFrequency: Record<string, { count: number; lastQty: number }> = {};
                
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const items = data.items || [];
                    items.forEach((item: any) => {
                        const name = item.itemName || item.name;
                        if (name) {
                            if (!itemFrequency[name]) {
                                itemFrequency[name] = { count: 0, lastQty: item.quantity || 1 };
                            }
                            itemFrequency[name].count++;
                            itemFrequency[name].lastQty = item.quantity || 1;
                        }
                    });
                });
                
                // Sort by frequency and take top 9
                const sortedItems = Object.entries(itemFrequency)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 9)
                    .map(([name, data]) => ({
                        name,
                        icon: getItemIcon(name),
                        defaultQty: data.lastQty,
                        frequency: data.count
                    }));
                
                setDynamicQuickItems(sortedItems);
            } catch (err) {
                console.error('Error fetching recent items:', err);
                // Fallback to empty - user can search
                setDynamicQuickItems([]);
            } finally {
                setLoadingQuickItems(false);
            }
        };
        
        fetchRecentItems();
    }, [tenantId, department, isOpen]);

    // Filtered quick items (from dynamic items)
    const filteredItems = useMemo(() => {
        if (!searchQuery) return dynamicQuickItems;
        return dynamicQuickItems.filter(item => 
            item.name.includes(searchQuery)
        );
    }, [dynamicQuickItems, searchQuery]);

    // Theme colors - using CSS variables
    const modalBg = 'var(--theme-bg-secondary)';
    const borderColor = 'var(--theme-border-primary)';
    const textPrimary = 'var(--theme-text-primary)';
    const textSecondary = 'var(--theme-text-secondary)';

    // Add item to cart
    const addToCart = (item: QuickItem) => {
        const existing = cart.find(c => c.name === item.name);
        if (existing) {
            setCart(cart.map(c => 
                c.name === item.name 
                    ? { ...c, quantity: c.quantity + item.defaultQty }
                    : c
            ));
        } else {
            setCart([...cart, {
                id: Date.now().toString(),
                name: item.name,
                quantity: item.defaultQty,
                priority: 'normal'
            }]);
        }
        haptic('light');
    };

    // Update quantity
    const updateQty = (id: string, delta: number) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    // Toggle priority
    const togglePriority = (id: string) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                return { 
                    ...item, 
                    priority: item.priority === 'normal' ? 'urgent' : 'normal' 
                };
            }
            return item;
        }));
    };

    // Remove item
    const removeItem = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    // Submit order
    const submitOrder = async () => {
        if (cart.length === 0 || !user) return;

        const effectiveTenantId = tenantId || (user as any)?.tenantId;
        if (!effectiveTenantId) return;

        setIsSubmitting(true);
        try {
            const branchId = (user as any)?.branch || 'default';
            
            // ✅ If autoApproved (manager request), set status to APPROVED directly
            const orderStatus = autoApproved ? 'APPROVED' : 'PENDING_APPROVAL';
            
            await addDoc(collection(db, 'procurementRequests'), {
                items: cart.map(item => ({
                    itemName: item.name,
                    quantity: item.quantity,
                    priority: item.priority,
                    notes: ''
                })),
                department,
                branch: branchId,
                tenantId: effectiveTenantId,
                status: orderStatus,
                createdAt: Timestamp.now(),
                requestedBy: {
                    id: user.id,
                    name: user.name || ''
                },
                // ✅ Auto-approved metadata
                ...(autoApproved && {
                    autoApproved: true,
                    approvedAt: Timestamp.now(),
                    approvedBy: {
                        id: user.id,
                        name: user.name || '',
                        role: 'manager'
                    },
                    approvalNote: 'معتمد تلقائياً - تم إرساله من الإدارة'
                })
            });

            success(autoApproved 
                ? '✅ تم إرسال طلب المشتريات (معتمد تلقائياً من الإدارة)'
                : 'تم إرسال طلب المشتريات بنجاح'
            );
            haptic('success');
            setCart([]);
            setStep('select');
            onClose();
        } catch (err) {
            console.error('Error submitting order:', err);
            showError('فشل إرسال الطلب');
            haptic('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setStep('select');
            setSearchQuery('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Step indicator
    const steps = [
        { key: 'select', label: 'اختيار', icon: '🛒' },
        { key: 'review', label: 'مراجعة', icon: '📋' },
        { key: 'confirm', label: t('common.submit') || 'إرسال', icon: '✅' }
    ];

    const currentStepIndex = steps.findIndex(s => s.key === step);

    return (
        <div 
            className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={onClose}
        >
            <div 
                className="w-full sm:max-w-sm max-h-[80vh] sm:max-h-[70vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
                style={{ 
                    background: modalBg,
                    border: `1px solid ${borderColor}`,
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header - Compact */}
                <div 
                    className="flex items-center justify-between p-3 border-b"
                    style={{ borderColor }}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
                            <ShoppingCart className="w-4 h-4 text-teal-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold" style={{ color: textPrimary }}>طلب مشتريات</h3>
                            <p className="text-[10px]" style={{ color: textSecondary }}>
                                {cart.length} عنصر
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500/10 transition-colors"
                    >
                        <X className="w-4 h-4" style={{ color: textSecondary }} />
                    </button>
                </div>

                {/* Step Indicator - Mini */}
                <div className="flex items-center justify-center gap-2 py-2 border-b" style={{ borderColor }}>
                    {steps.map((s, i) => (
                        <React.Fragment key={s.key}>
                            <div 
                                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                                    i === currentStepIndex 
                                        ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400' 
                                        : i < currentStepIndex
                                            ? 'bg-green-500/10 text-green-500'
                                            : ''
                                }`}
                                style={i > currentStepIndex ? { color: textSecondary } : {}}
                            >
                                <span>{s.icon}</span>
                                <span className="hidden sm:inline">{s.label}</span>
                            </div>
                            {i < steps.length - 1 && (
                                <div 
                                    className={`w-4 h-0.5 rounded ${i < currentStepIndex ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Content - Based on Step */}
                <div className="flex-1 overflow-y-auto p-3">
                    {/* Step 1: Select Items */}
                    {step === 'select' && (
                        <div className="space-y-3">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textSecondary }} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('common.search') || 'بحث...'}
                                    className="w-full py-2 px-8 text-sm rounded-lg"
                                    style={{ 
                                        background: isDark ? '#334155' : '#f1f5f9',
                                        color: textPrimary,
                                        border: `1px solid ${borderColor}`
                                    }}
                                />
                            </div>

                            {/* Quick Items - Dynamic from Recent Orders */}
                            {loadingQuickItems ? (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
                                    <span className="mr-2 text-sm" style={{ color: textSecondary }}>جاري تحميل الأصناف...</span>
                                </div>
                            ) : filteredItems.length > 0 ? (
                                <>
                                    <div className="flex items-center gap-1 mb-2">
                                        <History className="w-3 h-3" style={{ color: textSecondary }} />
                                        <span className="text-[10px]" style={{ color: textSecondary }}>الأكثر طلباً</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {filteredItems.map((item, idx) => {
                                            const inCart = cart.find(c => c.name === item.name);
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => addToCart(item)}
                                                    className={`p-2 rounded-lg text-center transition-all active:scale-95 relative ${
                                                        inCart ? 'ring-2 ring-teal-500' : ''
                                                    }`}
                                                    style={{ 
                                                        background: isDark ? '#334155' : '#f8fafc',
                                                        border: `1px solid ${borderColor}`
                                                    }}
                                                >
                                                    <div className="text-xl mb-1">{item.icon}</div>
                                                    <div className="text-[10px] font-medium truncate" style={{ color: textPrimary }}>
                                                        {item.name}
                                                    </div>
                                                    {inCart ? (
                                                        <div className="text-[9px] text-teal-500 font-bold">
                                                            ×{inCart.quantity}
                                                        </div>
                                                    ) : item.frequency && (
                                                        <div className="text-[8px]" style={{ color: textSecondary }}>
                                                            طُلب {item.frequency}×
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-4 rounded-lg" style={{ background: isDark ? '#334155' : '#f8fafc' }}>
                                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-xs" style={{ color: textSecondary }}>
                                        لا توجد طلبات سابقة
                                    </p>
                                    <p className="text-[10px] mt-1" style={{ color: textSecondary }}>
                                        ابحث واكتب اسم المنتج أدناه
                                    </p>
                                </div>
                            )}

                            {/* Custom Item - Always show if searching */}
                            {searchQuery && (
                                <button
                                    onClick={() => {
                                        addToCart({ name: searchQuery, icon: getItemIcon(searchQuery), defaultQty: 1 });
                                        setSearchQuery('');
                                    }}
                                    className="w-full p-2 rounded-lg text-sm flex items-center justify-center gap-2 bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20"
                                >
                                    <Plus className="w-4 h-4" />
                                    إضافة "{searchQuery}"
                                </button>
                            )}
                        </div>
                    )}

                    {/* Step 2: Review Cart */}
                    {step === 'review' && (
                        <div className="space-y-2">
                            {cart.length === 0 ? (
                                <div className="text-center py-8">
                                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm" style={{ color: textSecondary }}>العربة فارغة</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div 
                                        key={item.id}
                                        className="flex items-center gap-2 p-2 rounded-lg"
                                        style={{ 
                                            background: isDark ? '#334155' : '#f8fafc',
                                            border: `1px solid ${borderColor}`
                                        }}
                                    >
                                        {/* Name & Priority */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm font-medium truncate" style={{ color: textPrimary }}>
                                                    {item.name}
                                                </span>
                                                {item.priority === 'urgent' && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-500">عاجل</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => togglePriority(item.id)}
                                                className="text-[10px]"
                                                style={{ color: textSecondary }}
                                            >
                                                {item.priority === 'normal' ? '⚡ عاجل؟' : '✓ عادي'}
                                            </button>
                                        </div>

                                        {/* Quantity Controls */}
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => updateQty(item.id, -1)}
                                                className="w-6 h-6 rounded flex items-center justify-center bg-gray-200 dark:bg-gray-600"
                                            >
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="w-8 text-center text-sm font-bold" style={{ color: textPrimary }}>
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQty(item.id, 1)}
                                                className="w-6 h-6 rounded flex items-center justify-center bg-gray-200 dark:bg-gray-600"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>

                                        {/* Delete */}
                                        <button
                                            onClick={() => removeItem(item.id)}
                                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/20 transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3 text-red-400" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Step 3: Confirm */}
                    {step === 'confirm' && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-4">
                                <Send className="w-8 h-8 text-teal-500" />
                            </div>
                            <h4 className="text-lg font-bold mb-2" style={{ color: textPrimary }}>
                                تأكيد الطلب
                            </h4>
                            <p className="text-sm mb-4" style={{ color: textSecondary }}>
                                {cart.length} عنصر سيُرسل للمدير للموافقة
                            </p>
                            
                            {/* Summary */}
                            <div 
                                className="text-right p-3 rounded-lg mb-4"
                                style={{ 
                                    background: isDark ? '#334155' : '#f8fafc',
                                    border: `1px solid ${borderColor}`
                                }}
                            >
                                {cart.map(item => (
                                    <div key={item.id} className="flex justify-between text-sm py-1">
                                        <span style={{ color: textSecondary }}>×{item.quantity}</span>
                                        <span style={{ color: textPrimary }}>{item.name}</span>
                                    </div>
                                ))}
                            </div>

                            {cart.some(i => i.priority === 'urgent') && (
                                <div className="flex items-center justify-center gap-2 text-sm text-orange-500 mb-4">
                                    <AlertCircle className="w-4 h-4" />
                                    يحتوي على عناصر عاجلة
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer - Navigation */}
                <div 
                    className="flex items-center gap-2 p-3 border-t"
                    style={{ borderColor }}
                >
                    {/* Back Button */}
                    {step !== 'select' && (
                        <button
                            onClick={() => setStep(step === 'confirm' ? 'review' : 'select')}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm"
                            style={{ 
                                background: isDark ? '#334155' : '#f1f5f9',
                                color: textSecondary
                            }}
                        >
                            <ChevronRight className="w-4 h-4" />
                            رجوع
                        </button>
                    )}

                    {/* Next/Submit Button */}
                    <button
                        onClick={() => {
                            if (step === 'select') setStep('review');
                            else if (step === 'review') setStep('confirm');
                            else submitOrder();
                        }}
                        disabled={cart.length === 0 || isSubmitting}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-all"
                        style={{ 
                            background: cart.length === 0 
                                ? '#6b7280' 
                                : 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)'
                        }}
                    >
                        {isSubmitting ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : step === 'confirm' ? (
                            <>
                                <Send className="w-4 h-4" />
                                إرسال الطلب
                            </>
                        ) : (
                            <>
                                التالي
                                <ChevronLeft className="w-4 h-4" />
                            </>
                        )}
                        {step === 'select' && cart.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">
                                {cart.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProcurementCartWizard;
