/**
 * Laundry Inventory Component
 * Simple UI for housekeeping staff to track laundry
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Package, Truck, ClipboardList, X, Plus, Minus,
    Check, History, AlertCircle, TrendingDown, TrendingUp, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { useTranslation } from 'react-i18next';
import {
    LaundryItem, LaundryRecord,
    subscribeToLaundryItems,
    submitDelivery,
    submitReceipt,
    getPendingDelivery,
    getRecords,
    getCumulativeDeficit,
    initializeLaundryItems
} from '../../services/laundryInventoryService';

// ============================================================
// TYPES
// ============================================================

type ViewMode = 'main' | 'delivery' | 'receipt' | 'history';

interface LaundryInventoryProps {
    isOpen: boolean;
    onClose: () => void;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const LaundryInventory: React.FC<LaundryInventoryProps> = ({
    isOpen,
    onClose
}) => {
    const { user, tenantId, branchId } = useAuth(); // ✅ Get tenantId and branchId from AuthContext
      const { haptic, playSound, success, error, voiceEnabled, toggleVoice } = useUX();
      const { t } = useTranslation();
    
    // ✅ Feature Gate: Check if laundry management is enabled
    const { isEnabled: isLaundryEnabled } = useFeatureGate('laundryManagement');
    
    // Use AuthContext branchId (same as SettingsManager) with fallback
    const effectiveBranchId = branchId || (user as any)?.branch || 'default';

    // State - ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    const [viewMode, setViewMode] = useState<ViewMode>('main');
    const [items, setItems] = useState<LaundryItem[]>([]);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [pendingDelivery, setPendingDelivery] = useState<LaundryRecord | null>(null);
    const [cumulativeDeficit, setCumulativeDeficit] = useState<Record<string, number>>({});
    const [historyRecords, setHistoryRecords] = useState<LaundryRecord[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load data
    useEffect(() => {
        if (!isOpen || !tenantId || !isLaundryEnabled) return;

        setLoading(true);

        // Initialize items (Scoped)
        initializeLaundryItems(tenantId, effectiveBranchId, user?.id || '', user?.name || '');

        // Subscribe to items (Scoped)
        const unsubItems = subscribeToLaundryItems(tenantId, effectiveBranchId, (loadedItems) => {
            setItems(loadedItems);

            // Initialize quantities map if new items loaded
            setQuantities(prev => {
                const next = { ...prev };
                loadedItems.forEach(item => {
                    if (next[item.id] === undefined) next[item.id] = 0;
                });
                return next;
            });

            setLoading(false);
        });

        // Load pending delivery (Scoped)
        getPendingDelivery(tenantId, effectiveBranchId).then(setPendingDelivery);

        // Load cumulative deficit (Scoped)
        getCumulativeDeficit(tenantId, effectiveBranchId).then(setCumulativeDeficit);

        return () => unsubItems();
    }, [isOpen, tenantId, effectiveBranchId, user?.id, user?.name]);

    // Load history
    const loadHistory = useCallback(async () => {
        if (!tenantId) return;
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);

        const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const endStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const records = await getRecords(tenantId, effectiveBranchId, startStr, endStr);
        setHistoryRecords(records);
    }, [tenantId, effectiveBranchId]);

    // ✅ FEATURE GATE: Hide component if disabled or not open (AFTER all hooks)
    if (!isLaundryEnabled || !isOpen) {
        return null;
    }

    // Handle quantity change
    const handleQuantityChange = (itemId: string, delta: number) => {
        haptic('light');
        setQuantities(prev => ({
            ...prev,
            [itemId]: Math.max(0, (prev[itemId] || 0) + delta)
        }));
    };

    // Handle long press for +10/-10
    const handleLongPress = (itemId: string, delta: number) => {
        haptic('medium');
        setQuantities(prev => ({
            ...prev,
            [itemId]: Math.max(0, (prev[itemId] || 0) + (delta * 10))
        }));
    };

    // Submit delivery
    const handleSubmitDelivery = async () => {
        // Filter out zero quantities
        const filtered: Record<string, number> = {};
        Object.entries(quantities).forEach(([id, qty]) => {
            if (qty > 0) filtered[id] = qty;
        });

        if (Object.keys(filtered).length === 0) {
            error('الرجاء إدخال كمية واحدة على الأقل');
            return;
        }

        if (!tenantId) return;

        setIsSubmitting(true);
        try {
            await submitDelivery(tenantId, effectiveBranchId, filtered, user?.id || '', user?.name || '');
            haptic('success');
            playSound('success');
            success('تم تسجيل التسليم بنجاح');
            setViewMode('main');

            // Reset quantities
            const reset: Record<string, number> = {};
            items.forEach(item => reset[item.id] = 0);
            setQuantities(reset);

            // Refresh pending
            getPendingDelivery(tenantId, effectiveBranchId).then(setPendingDelivery);
        } catch (err) {
            console.error('Submit delivery error:', err);
            error('فشل تسجيل التسليم');
            haptic('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Submit receipt
    const handleSubmitReceipt = async () => {
        if (!pendingDelivery) {
            error('لا يوجد تسليم سابق للاستلام');
            return;
        }
        if (!tenantId) return;

        setIsSubmitting(true);
        try {
            await submitReceipt(
                tenantId,
                effectiveBranchId,
                pendingDelivery.id,
                quantities,
                user?.id || '',
                user?.name || ''
            );
            haptic('success');
            playSound('success');
            success('تم تسجيل الاستلام بنجاح');
            setViewMode('main');
            setPendingDelivery(null);
            // Refresh cumulative
            getCumulativeDeficit(tenantId, effectiveBranchId).then(setCumulativeDeficit);
        } catch (err) {
            console.error('Submit receipt error:', err);
            error('فشل تسجيل الاستلام');
            haptic('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Open receipt view
    const openReceiptView = () => {
        if (!pendingDelivery) {
            error('لا يوجد تسليم سابق للاستلام');
            return;
        }

        // Pre-fill with delivered quantities
        const prefill: Record<string, number> = {};
        items.forEach(item => {
            prefill[item.id] = pendingDelivery.delivered[item.id] || 0;
        });
        setQuantities(prefill);
        setViewMode('receipt');
    };

    // Calculate totals
    const totalQuantity = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
    const totalDeficit = Object.values(cumulativeDeficit).reduce((sum, qty) => sum + qty, 0);

    // ✅ isOpen check moved to feature gate above for proper hooks ordering

    return (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="glass-card w-full sm:max-w-lg max-h-screen sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Package className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">جرد المغسلة</h3>
                            <p className="text-sm text-white/60">
                                {viewMode === 'main' && 'اختر العملية'}
                                {viewMode === 'delivery' && 'تسليم للمغسلة'}
                                {viewMode === 'receipt' && 'استلام من المغسلة'}
                                {viewMode === 'history' && 'السجل'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* 🧠 Voice Toggle - Only in active modes */}
                        {(viewMode === 'delivery' || viewMode === 'receipt') && (
                            <button
                                onClick={() => toggleVoice(!voiceEnabled)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${voiceEnabled
                                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                                    : 'bg-white/10 text-white/40 hover:text-white'
                                    }`}
                            >
                                <Sparkles className={`w-5 h-5 transition-transform duration-500 ${voiceEnabled ? 'rotate-180' : ''}`} />
                            </button>
                        )}

                        <button
                            onClick={() => viewMode === 'main' ? onClose() : setViewMode('main')}
                            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : viewMode === 'main' ? (
                        // Main Menu
                        <div className="space-y-4">
                            {/* Delivery Button */}
                            <button
                                onClick={() => setViewMode('delivery')}
                                className="w-full p-6 rounded-2xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 hover:border-green-400/50 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-green-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Truck className="w-8 h-8 text-green-400" />
                                    </div>
                                    <div className="text-right flex-1">
                                        <h4 className="text-xl font-bold text-white">📤 تسليم للمغسلة</h4>
                                        <p className="text-green-400/80 mt-1">8:00 مساءً</p>
                                    </div>
                                </div>
                            </button>

                            {/* Receipt Button */}
                            <button
                                onClick={openReceiptView}
                                disabled={!pendingDelivery}
                                className={`w-full p-6 rounded-2xl transition-all group ${pendingDelivery
                                    ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 hover:border-blue-400/50'
                                    : 'bg-white/5 border border-white/10 opacity-50 cursor-not-allowed'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${pendingDelivery ? 'bg-blue-500/30' : 'bg-white/10'
                                        }`}>
                                        <Package className={`w-8 h-8 ${pendingDelivery ? 'text-blue-400' : 'text-white/40'}`} />
                                    </div>
                                    <div className="text-right flex-1">
                                        <h4 className={`text-xl font-bold ${pendingDelivery ? 'text-white' : 'text-white/40'}`}>
                                            📥 استلام من المغسلة
                                        </h4>
                                        <p className={`mt-1 ${pendingDelivery ? 'text-blue-400/80' : 'text-white/30'}`}>
                                            {pendingDelivery ? `يوجد تسليم بتاريخ ${pendingDelivery.date}` : 'لا يوجد تسليم سابق'}
                                        </p>
                                    </div>
                                </div>
                            </button>

                            {/* History Button */}
                            <button
                                onClick={() => { loadHistory(); setViewMode('history'); }}
                                className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                            >
                                <div className="flex items-center gap-3 justify-center">
                                    <History className="w-5 h-5 text-white/60" />
                                    <span className="text-white/80">📊 السجل</span>
                                </div>
                            </button>

                            {/* Cumulative Deficit Card */}
                            {totalDeficit !== 0 && (
                                <div className={`p-4 rounded-xl ${totalDeficit < 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-green-500/10 border border-green-500/20'}`}>
                                    <div className="flex items-center gap-3">
                                        {totalDeficit < 0 ? (
                                            <TrendingDown className="w-5 h-5 text-red-400" />
                                        ) : (
                                            <TrendingUp className="w-5 h-5 text-green-400" />
                                        )}
                                        <div>
                                            <p className="text-white/60 text-sm">العجز التراكمي</p>
                                            <p className={`text-lg font-bold ${totalDeficit < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                {totalDeficit} قطعة
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : viewMode === 'delivery' || viewMode === 'receipt' ? (
                        // Delivery or Receipt Form
                        <div className="space-y-3">
                            {items.map(item => {
                                const qty = quantities[item.id] || 0;
                                const deliveredQty = viewMode === 'receipt' ? (pendingDelivery?.delivered[item.id] || 0) : 0;
                                const deficit = viewMode === 'receipt' ? qty - deliveredQty : 0;

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-4 rounded-xl ${viewMode === 'delivery'
                                            ? 'bg-green-500/10 border border-green-500/20'
                                            : 'bg-blue-500/10 border border-blue-500/20'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-white font-medium">{item.name}</span>
                                            {viewMode === 'receipt' && (
                                                <span className={`text-sm px-2 py-0.5 rounded ${deficit < 0 ? 'bg-red-500/20 text-red-400' :
                                                    deficit > 0 ? 'bg-green-500/20 text-green-400' :
                                                        'bg-white/10 text-white/60'
                                                    }`}>
                                                    {deficit === 0 ? 'تمام' : deficit > 0 ? `+${deficit}` : deficit}
                                                </span>
                                            )}
                                        </div>

                                        {/* ✅ IMPROVED: Show current stock for delivery mode */}
                                        {viewMode === 'delivery' && (
                                            <div className="mb-3 flex items-center gap-2 text-xs text-white/50">
                                                <span>المخزون في الغرف: <span className="font-bold text-white/80">{item.stockRooms || 0}</span></span>
                                                {item.stockRooms < (qty || 0) && (
                                                    <span className="text-red-400">⚠️ غير كافٍ</span>
                                                )}
                                            </div>
                                        )}

                                        {viewMode === 'receipt' && (
                                            <div className="mb-3 flex items-center gap-2 text-xs text-white/50">
                                                <span>سُلم: <span className="font-bold text-white/80">{deliveredQty}</span></span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-center gap-2">
                                            {/* Minus 10 Button */}
                                            <button
                                                onClick={() => handleLongPress(item.id, -1)}
                                                className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold transition-all active:scale-95 ${viewMode === 'delivery'
                                                    ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                                    : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                                                    }`}
                                                title={t('laundry.decrease10') || 'نقص 10'}
                                            >
                                                -10
                                            </button>

                                            {/* Minus Button */}
                                            <button
                                                onClick={() => handleQuantityChange(item.id, -1)}
                                                className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold transition-all active:scale-95 ${viewMode === 'delivery'
                                                    ? 'bg-green-500/30 text-green-400 hover:bg-green-500/40'
                                                    : 'bg-blue-500/30 text-blue-400 hover:bg-blue-500/40'
                                                    }`}
                                            >
                                                <Minus className="w-6 h-6" />
                                            </button>

                                            {/* Quantity Input - Editable & Larger */}
                                            <input
                                                type="number"
                                                value={qty || ''}
                                                onChange={(e) => {
                                                    const newValue = parseInt(e.target.value) || 0;
                                                    setQuantities(prev => ({
                                                        ...prev,
                                                        [item.id]: Math.max(0, newValue)
                                                    }));
                                                }}
                                                onFocus={(e) => e.target.select()}
                                                className={`w-24 h-16 rounded-xl text-3xl font-bold text-white text-center outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${viewMode === 'delivery'
                                                    ? 'bg-green-500/20 focus:bg-green-500/30 focus:ring-2 focus:ring-green-400'
                                                    : 'bg-blue-500/20 focus:bg-blue-500/30 focus:ring-2 focus:ring-blue-400'
                                                    }`}
                                                style={{ MozAppearance: 'textfield' }}
                                                min="0"
                                                inputMode="numeric"
                                                placeholder="0"
                                            />

                                            {/* Plus Button */}
                                            <button
                                                onClick={() => handleQuantityChange(item.id, 1)}
                                                className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold transition-all active:scale-95 ${viewMode === 'delivery'
                                                    ? 'bg-green-500/30 text-green-400 hover:bg-green-500/40'
                                                    : 'bg-blue-500/30 text-blue-400 hover:bg-blue-500/40'
                                                    }`}
                                            >
                                                <Plus className="w-6 h-6" />
                                            </button>

                                            {/* Plus 10 Button */}
                                            <button
                                                onClick={() => handleLongPress(item.id, 1)}
                                                className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold transition-all active:scale-95 ${viewMode === 'delivery'
                                                    ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                                    : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                                                    }`}
                                                title={t('laundry.increase10') || 'زيادة 10'}
                                            >
                                                +10
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        // History View
                        <div className="space-y-3">
                            {historyRecords.length === 0 ? (
                                <div className="text-center py-12">
                                    <ClipboardList className="w-12 h-12 text-white/20 mx-auto mb-3" />
                                    <p className="text-white/40">لا يوجد سجلات</p>
                                </div>
                            ) : (
                                historyRecords.map(record => {
                                    const totalDel = Object.values(record.delivered || {}).reduce((s, q) => s + q, 0);
                                    const totalRec = Object.values(record.received || {}).reduce((s, q) => s + q, 0);
                                    const totalDef = totalRec - totalDel;

                                    return (
                                        <div
                                            key={record.id}
                                            className="p-4 rounded-xl bg-white/5 border border-white/10"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-white font-medium">{record.date}</span>
                                                <span className={`text-sm px-2 py-0.5 rounded ${record.status === 'delivered' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    record.status === 'received' ? 'bg-green-500/20 text-green-400' :
                                                        'bg-white/10 text-white/60'
                                                    }`}>
                                                    {record.status === 'delivered' ? (t('common.pending') || 'بانتظار الاستلام') : t('common.completed') || 'مكتمل'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-white/60">
                                                <span>سُلم: {totalDel}</span>
                                                <span>|</span>
                                                <span>استُلم: {totalRec}</span>
                                                <span>|</span>
                                                <span className={totalDef < 0 ? 'text-red-400' : totalDef > 0 ? 'text-green-400' : ''}>
                                                    العجز: {totalDef}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {(viewMode === 'delivery' || viewMode === 'receipt') && (
                    <div className="p-4 border-t border-white/10 flex-shrink-0 space-y-3">
                        {/* ✅ IMPROVED: Quick Actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    const reset: Record<string, number> = {};
                                    items.forEach(item => reset[item.id] = 0);
                                    setQuantities(reset);
                                    haptic('light');
                                }}
                                className="flex-1 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white text-sm font-medium transition-all"
                            >
                                تصفير الكل
                            </button>
                            {viewMode === 'delivery' && (
                                <button
                                    onClick={() => {
                                        const fillAll: Record<string, number> = {};
                                        items.forEach(item => {
                                            // Fill with available stock in rooms
                                            fillAll[item.id] = item.stockRooms || 0;
                                        });
                                        setQuantities(fillAll);
                                        haptic('light');
                                    }}
                                    className="flex-1 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white text-sm font-medium transition-all"
                                >
                                    ملء الكل
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-white/60">المجموع</span>
                            <span className="text-xl font-bold text-white">{totalQuantity} قطعة</span>
                        </div>
                        <button
                            onClick={viewMode === 'delivery' ? handleSubmitDelivery : handleSubmitReceipt}
                            disabled={isSubmitting || totalQuantity === 0}
                            className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${isSubmitting || totalQuantity === 0
                                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                                : viewMode === 'delivery'
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90'
                                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90'
                                }`}
                        >
                            {isSubmitting ? (
                                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Check className="w-6 h-6" />
                                    {viewMode === 'delivery' ? (t('procurement.markDelivered') || 'تأكيد التسليم') : (t('procurement.confirmReceipt') || 'تأكيد الاستلام')}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LaundryInventory;
