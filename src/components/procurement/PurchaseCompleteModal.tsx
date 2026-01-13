/**
 * Purchase Complete Modal
 * نافذة تسجيل الشراء - تسمح للمندوب بتحديد الكمية المشتراة لكل بند
 * 
 * الدائرة:
 * 1. مندوب يحدد الكمية المشتراة لكل بند
 * 2. إذا اشترى الكمية كاملة = البند يُعلّم كمكتمل
 * 3. إذا اشترى جزء = يُنشأ طلب جديد بالكمية المتبقية
 * 4. الطلب ينتقل للقسم الطالب لتأكيد الاستلام
 */

import React, { useState, useMemo } from 'react';
import { X, Package, Check, AlertCircle, Minus, Plus, ShoppingCart, ArrowLeft, Truck } from 'lucide-react';
import { ProcurementRequest, ProcurementItem } from '../../services/procurementService';
import { AdoraLoaderInline } from '../common/AdoraLoader';

interface PurchaseCompleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: ProcurementRequest;
    onComplete: (
        items: { itemName: string; purchasedQty: number; unitPrice?: number }[],
        totalCost: number,
        notes?: string
    ) => Promise<void>;
}

interface ItemPurchaseState {
    itemName: string;
    requestedQty: number;
    purchasedQty: number;
    unitPrice: number;
    notes: string;
}

export const PurchaseCompleteModal: React.FC<PurchaseCompleteModalProps> = ({
    isOpen,
    onClose,
    request,
    onComplete
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [generalNotes, setGeneralNotes] = useState('');
    
    // Initialize items state from request
    const [itemsState, setItemsState] = useState<ItemPurchaseState[]>(() =>
        request.items.map(item => ({
            itemName: item.itemName,
            requestedQty: item.quantity,
            purchasedQty: item.quantity, // Default to full quantity
            unitPrice: item.unitPrice || 0,
            notes: item.notes || ''
        }))
    );

    // Calculate totals
    const totals = useMemo(() => {
        let totalCost = 0;
        let allComplete = true;
        let hasPartial = false;
        let itemsCompleted = 0;
        let itemsPartial = 0;

        itemsState.forEach(item => {
            totalCost += item.purchasedQty * item.unitPrice;
            if (item.purchasedQty < item.requestedQty) {
                allComplete = false;
                hasPartial = true;
                itemsPartial++;
            } else {
                itemsCompleted++;
            }
        });

        return { totalCost, allComplete, hasPartial, itemsCompleted, itemsPartial };
    }, [itemsState]);

    // Update item quantity
    const updateItemQty = (index: number, qty: number) => {
        const item = itemsState[index];
        const newQty = Math.max(0, Math.min(qty, item.requestedQty));
        
        setItemsState(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], purchasedQty: newQty };
            return updated;
        });
    };

    // Update item price
    const updateItemPrice = (index: number, price: number) => {
        setItemsState(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], unitPrice: Math.max(0, price) };
            return updated;
        });
    };

    // Handle submit
    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const items = itemsState.map(item => ({
                itemName: item.itemName,
                purchasedQty: item.purchasedQty,
                unitPrice: item.unitPrice > 0 ? item.unitPrice : undefined
            }));

            await onComplete(items, totals.totalCost, generalNotes || undefined);
            onClose();
        } catch (error) {
            console.error('Error completing purchase:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                style={{
                    background: 'var(--theme-bg-secondary)',
                    border: '1px solid var(--theme-border-primary)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div 
                    className="p-4 flex items-center justify-between"
                    style={{ 
                        background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                        borderBottom: '1px solid var(--theme-border-primary)'
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">تسجيل الشراء</h3>
                            <p className="text-xs text-white/70">حدد الكمية المشتراة لكل بند</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {/* Items List */}
                    <div className="space-y-3 mb-4">
                        {itemsState.map((item, index) => {
                            const isComplete = item.purchasedQty >= item.requestedQty;
                            const isPartial = item.purchasedQty > 0 && item.purchasedQty < item.requestedQty;
                            const remaining = item.requestedQty - item.purchasedQty;

                            return (
                                <div
                                    key={item.itemName}
                                    className="p-3 rounded-xl transition-all"
                                    style={{
                                        background: isComplete 
                                            ? 'rgba(16, 185, 129, 0.1)' 
                                            : isPartial 
                                                ? 'rgba(245, 158, 11, 0.1)' 
                                                : 'var(--theme-bg-tertiary)',
                                        border: `1px solid ${isComplete ? 'rgba(16, 185, 129, 0.3)' : isPartial ? 'rgba(245, 158, 11, 0.3)' : 'var(--theme-border-primary)'}`
                                    }}
                                >
                                    {/* Item Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Package className={`w-4 h-4 ${isComplete ? 'text-green-500' : isPartial ? 'text-yellow-500' : ''}`} style={!isComplete && !isPartial ? { color: 'var(--theme-text-secondary)' } : {}} />
                                            <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{item.itemName}</span>
                                        </div>
                                        <span className="text-sm px-2 py-0.5 rounded-lg" style={{ background: 'var(--theme-bg-secondary)', color: 'var(--theme-text-secondary)' }}>
                                            مطلوب: {item.requestedQty}
                                        </span>
                                    </div>

                                    {/* Quantity Control */}
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>الكمية المشتراة:</span>
                                        <div className="flex items-center gap-2 flex-1">
                                            <button
                                                onClick={() => updateItemQty(index, item.purchasedQty - 1)}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                                                style={{ background: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <input
                                                type="number"
                                                value={item.purchasedQty}
                                                onChange={(e) => updateItemQty(index, parseInt(e.target.value) || 0)}
                                                className="w-16 text-center py-1 rounded-lg text-lg font-bold"
                                                style={{ 
                                                    background: 'var(--theme-bg-secondary)', 
                                                    color: 'var(--theme-text-primary)',
                                                    border: '1px solid var(--theme-border-primary)'
                                                }}
                                                min={0}
                                                max={item.requestedQty}
                                            />
                                            <button
                                                onClick={() => updateItemQty(index, item.purchasedQty + 1)}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                                                style={{ background: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}
                                                disabled={item.purchasedQty >= item.requestedQty}
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Unit Price (Optional) */}
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>سعر الوحدة:</span>
                                        <div className="flex items-center gap-1 flex-1">
                                            <input
                                                type="number"
                                                value={item.unitPrice || ''}
                                                onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                                                placeholder="0.00"
                                                className="flex-1 py-1 px-2 rounded-lg text-sm"
                                                style={{ 
                                                    background: 'var(--theme-bg-secondary)', 
                                                    color: 'var(--theme-text-primary)',
                                                    border: '1px solid var(--theme-border-primary)'
                                                }}
                                                min={0}
                                                step={0.01}
                                            />
                                            <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>ر.س</span>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    {isPartial && remaining > 0 && (
                                        <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                                            <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                                سيُنشأ طلب جديد بـ {remaining} وحدة متبقية
                                            </span>
                                        </div>
                                    )}

                                    {isComplete && (
                                        <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                                            <Check className="w-4 h-4 text-green-500" />
                                            <span className="text-xs text-green-600 dark:text-green-400">
                                                تم شراء الكمية كاملة ✓
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* General Notes */}
                    <div className="mb-4">
                        <label className="block text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>ملاحظات عامة (اختياري)</label>
                        <textarea
                            value={generalNotes}
                            onChange={(e) => setGeneralNotes(e.target.value)}
                            placeholder="أي ملاحظات على عملية الشراء..."
                            rows={2}
                            className="w-full p-3 rounded-xl resize-none"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                color: 'var(--theme-text-primary)',
                                border: '1px solid var(--theme-border-primary)'
                            }}
                        />
                    </div>

                    {/* Summary */}
                    <div 
                        className="p-3 rounded-xl mb-4"
                        style={{ background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-primary)' }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span style={{ color: 'var(--theme-text-secondary)' }}>إجمالي التكلفة:</span>
                            <span className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                {totals.totalCost.toFixed(2)} ر.س
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                                <Check className="w-3 h-3 text-green-500" />
                                <span style={{ color: 'var(--theme-text-secondary)' }}>{totals.itemsCompleted} مكتمل</span>
                            </span>
                            {totals.itemsPartial > 0 && (
                                <span className="flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 text-yellow-500" />
                                    <span style={{ color: 'var(--theme-text-secondary)' }}>{totals.itemsPartial} جزئي</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Partial Purchase Warning */}
                    {totals.hasPartial && (
                        <div className="p-3 rounded-xl mb-4 bg-yellow-500/10 border border-yellow-500/20">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">شراء جزئي</p>
                                    <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80">
                                        العناصر غير المكتملة ستُنشأ في طلب جديد تلقائياً للمتابعة
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Next Step Info */}
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-start gap-2">
                            <Truck className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">الخطوة التالية</p>
                                <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                                    بعد التأكيد سيُرسل الطلب للقسم الطالب لتأكيد الاستلام
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div 
                    className="p-4 flex gap-3"
                    style={{ 
                        background: 'var(--theme-bg-tertiary)',
                        borderTop: '1px solid var(--theme-border-primary)'
                    }}
                >
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl font-medium transition-colors"
                        style={{ 
                            background: 'var(--theme-bg-secondary)', 
                            color: 'var(--theme-text-primary)',
                            border: '1px solid var(--theme-border-primary)'
                        }}
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || itemsState.every(i => i.purchasedQty === 0)}
                        className="flex-1 py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        style={{ 
                            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                        }}
                    >
                        {isSubmitting ? (
                            <AdoraLoaderInline size="sm" />
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                تأكيد الشراء
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PurchaseCompleteModal;
