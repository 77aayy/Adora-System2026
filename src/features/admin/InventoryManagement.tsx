/**
 * Inventory Management Component V2
 * Smart Inventory with Dynamic Categories & Auto-sync from Procurement
 * Adora Hotel Management System V2
 * 
 * Features:
 * - Three inventory dimensions: Warehouse + Rooms + Purchased (with history)
 * - Dynamic categories from procurement requests
 * - Auto-registration from procurement receipts
 * - Manual entry and editing from admin dashboard
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    Package,
    Plus,
    Minus,
    Edit2,
    Trash2,
    Search,
    Filter,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    X,
    Save,
    History,
    Download,
    Upload,
    BarChart3,
    Box,
    Warehouse,
    Home,
    ShoppingCart,
    ArrowRight,
    ArrowLeft,
    Calendar,
    Check,
    Eye,
    Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import {
    InventoryItem,
    InventoryTransaction,
    LowStockAlert,
    UNIT_OPTIONS,
    subscribeToInventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    updateWarehouseQuantity,
    updateRoomsQuantity,
    transferInventory,
    getItemTransactions,
    getLowStockAlerts,
    getInventoryStats,
    getCategories,
    PurchaseRecord,
} from '../../services/inventoryService';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const formatDate = (timestamp: any): string => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getTimeAgo = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 1) return 'الآن';
    if (diff < 60) return `منذ ${diff} دقيقة`;
    if (diff < 1440) return `منذ ${Math.floor(diff / 60)} ساعة`;
    return `منذ ${Math.floor(diff / 1440)} يوم`;
};

// ============================================================
// HELPER COMPONENTS
// ============================================================

const StatsCard: React.FC<{
    title: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
}> = ({ title, value, icon, color }) => (
    <div className="p-4 rounded-2xl transition-colors duration-300" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
        <div className="flex items-center justify-between">
            <div>
                <p className="text-white/60 text-sm">{title}</p>
                <p className="text-2xl font-bold text-white mt-1">{value}</p>
            </div>
            <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${color}20`, color }}
            >
                {icon}
            </div>
        </div>
    </div>
);

const LowStockBadge: React.FC<{ alert: LowStockAlert }> = ({ alert }) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${alert.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
        }`}>
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm font-medium">{alert.itemName}</span>
        <span className="text-xs opacity-70">({alert.currentQuantity}/{alert.minQuantity})</span>
    </div>
);

// ============================================================
// MODALS
// ============================================================

// Add/Edit Item Modal
interface ItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    item?: InventoryItem | null;
    availableCategories: string[];
    onSave: (data: Partial<InventoryItem>) => Promise<void>;
}

const ItemModal: React.FC<ItemModalProps> = ({ isOpen, onClose, item, availableCategories, onSave }) => {
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        unit: 'piece',
        warehouseQuantity: 0,
        roomsQuantity: 0,
        minQuantity: 5,
        unitPrice: 0,
        location: '',
        supplier: '',
        notes: '',
    });
    const [customCategory, setCustomCategory] = useState('');
    const [useCustomCategory, setUseCustomCategory] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (item) {
            setFormData({
                name: item.name,
                category: item.category || '',
                unit: item.unit,
                warehouseQuantity: item.warehouseQuantity || 0,
                roomsQuantity: item.roomsQuantity || 0,
                minQuantity: item.minQuantity,
                unitPrice: item.unitPrice,
                location: item.location || '',
                supplier: item.supplier || '',
                notes: item.notes || '',
            });
            setUseCustomCategory(false);
        } else {
            setFormData({
                name: '',
                category: availableCategories[0] || '',
                unit: 'piece',
                warehouseQuantity: 0,
                roomsQuantity: 0,
                minQuantity: 5,
                unitPrice: 0,
                location: '',
                supplier: '',
                notes: '',
            });
            setUseCustomCategory(false);
            setCustomCategory('');
        }
    }, [item, isOpen, availableCategories]);

    const handleSubmit = async () => {
        if (!formData.name.trim()) return;
        if (useCustomCategory && !customCategory.trim()) {
            alert('يرجى إدخال اسم التصنيف');
            return;
        }
        
        setSaving(true);
        try {
            const finalCategory = useCustomCategory ? customCategory : formData.category;
            const saveData = {
                ...formData,
                category: finalCategory,
                purchases: item?.purchases || [] // Preserve existing purchases
            };
            await onSave(saveData);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Solid Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            {/* Modal Content - Theme Aware */}
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl bg-white dark:bg-slate-800" style={{ border: '1px solid #e2e8f0' }}>
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                        {item ? 'تعديل عنصر' : 'إضافة عنصر جديد'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-white/60 dark:hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">اسم العنصر *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                            placeholder="مثال: صابون سائل"
                        />
                    </div>

                    {/* Category - Dynamic */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">التصنيف *</label>
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setUseCustomCategory(false)}
                                    className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${!useCustomCategory ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'}`}
                                >
                                    من التصنيفات الموجودة
                                </button>
                                <button
                                    onClick={() => setUseCustomCategory(true)}
                                    className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${useCustomCategory ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'}`}
                                >
                                    تصنيف جديد
                                </button>
                            </div>
                            {!useCustomCategory ? (
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                >
                                    {availableCategories.length === 0 ? (
                                        <option value="">لا توجد تصنيفات - سيتم إنشاء تصنيف جديد</option>
                                    ) : (
                                        availableCategories.map((cat) => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))
                                    )}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value)}
                                    placeholder="مثال: مفروشات الفندق"
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                />
                            )}
                        </div>
                    </div>

                    {/* Unit */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">الوحدة</label>
                        <select
                            value={formData.unit}
                            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                        >
                            {UNIT_OPTIONS.map((unit) => (
                                <option key={unit.value} value={unit.value}>{unit.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* ✅ THREE DIMENSIONS */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                <Warehouse className="w-4 h-4 text-blue-500" />
                                المستودع
                            </label>
                            <input
                                type="number"
                                value={formData.warehouseQuantity}
                                onChange={(e) => setFormData({ ...formData, warehouseQuantity: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                <Home className="w-4 h-4 text-purple-500" />
                                الغرف
                            </label>
                            <input
                                type="number"
                                value={formData.roomsQuantity}
                                onChange={(e) => setFormData({ ...formData, roomsQuantity: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                min="0"
                            />
                        </div>
                    </div>

                    {/* Min Quantity & Price */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">الحد الأدنى</label>
                            <input
                                type="number"
                                value={formData.minQuantity}
                                onChange={(e) => setFormData({ ...formData, minQuantity: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">سعر الوحدة (ر.س)</label>
                            <input
                                type="number"
                                value={formData.unitPrice}
                                onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                    {/* Location & Supplier */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">موقع التخزين</label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                placeholder="مثال: مستودع 1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">المورد</label>
                            <input
                                type="text"
                                value={formData.supplier}
                                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                placeholder="اسم المورد"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">ملاحظات</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors resize-none"
                            rows={2}
                        />
                    </div>
                </div>

                <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !formData.name.trim() || (!useCustomCategory && !formData.category)}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-teal-400 to-teal-500 text-white font-bold hover:from-teal-500 hover:to-teal-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-teal-400/30"
                    >
                        {saving ? <AdoraLoaderInline size={20} /> : <Save className="w-5 h-5" />}
                        حفظ
                    </button>
                </div>
            </div>
        </div>
    );
};

// ✅ Quantity Management Modal - Three Dimensions
interface QuantityModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem | null;
    onWarehouseUpdate: (quantity: number, reason: string) => Promise<void>;
    onRoomsUpdate: (quantity: number, reason: string) => Promise<void>;
    onTransfer: (from: 'warehouse' | 'rooms', to: 'warehouse' | 'rooms', quantity: number) => Promise<void>;
}

const QuantityModal: React.FC<QuantityModalProps> = ({ isOpen, onClose, item, onWarehouseUpdate, onRoomsUpdate, onTransfer }) => {
    const [mode, setMode] = useState<'warehouse' | 'rooms' | 'transfer'>('warehouse');
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState('');
    const [transferFrom, setTransferFrom] = useState<'warehouse' | 'rooms'>('warehouse');
    const [transferTo, setTransferTo] = useState<'warehouse' | 'rooms'>('rooms');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && item) {
            setMode('warehouse');
            setQuantity(1);
            setReason('');
            setTransferFrom('warehouse');
            setTransferTo('rooms');
        }
    }, [isOpen, item]);

    const handleSubmit = async () => {
        if (quantity <= 0 || !reason.trim()) return;
        if (mode === 'transfer' && transferFrom === transferTo) {
            alert('يجب اختيار وجهتين مختلفتين');
            return;
        }

        setSaving(true);
        try {
            if (mode === 'warehouse') {
                await onWarehouseUpdate(quantity, reason);
            } else if (mode === 'rooms') {
                await onRoomsUpdate(quantity, reason);
            } else if (mode === 'transfer') {
                await onTransfer(transferFrom, transferTo, quantity);
            }
            onClose();
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Solid Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            {/* Modal Content - Theme Aware */}
            <div className="relative w-full max-w-md rounded-2xl shadow-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">إدارة الكمية - {item.name}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-white/60 dark:hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Item Info */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-slate-600">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">المستودع</p>
                                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{item.warehouseQuantity || 0}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">الغرف</p>
                                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{item.roomsQuantity || 0}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">المشترى</p>
                                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                                    {(item.purchases || []).reduce((sum, p) => sum + (p.quantity || 0), 0)}
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 text-center">
                            <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">الإجمالي</p>
                            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{item.totalQuantity || 0}</p>
                        </div>
                    </div>

                    {/* Mode Selection */}
                    <div className="flex gap-2">
                        {[
                            { value: 'warehouse', label: 'المستودع', icon: <Warehouse className="w-4 h-4" />, color: 'bg-blue-500', shadow: 'shadow-blue-500/25' },
                            { value: 'rooms', label: 'الغرف', icon: <Home className="w-4 h-4" />, color: 'bg-purple-500', shadow: 'shadow-purple-500/25' },
                            { value: 'transfer', label: 'نقل', icon: <ArrowRight className="w-4 h-4" />, color: 'bg-orange-500', shadow: 'shadow-orange-500/25' },
                        ].map((m) => (
                            <button
                                key={m.value}
                                onClick={() => setMode(m.value as typeof mode)}
                                className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${mode === m.value ? `${m.color} text-white shadow-lg ${m.shadow}` : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'}`}
                            >
                                {m.icon}
                                {m.label}
                            </button>
                        ))}
                    </div>

                    {/* Transfer Direction (if mode is transfer) */}
                    {mode === 'transfer' && (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium mb-2">نقل من</p>
                            <div className="flex gap-2 mb-3">
                                <button
                                    onClick={() => setTransferFrom('warehouse')}
                                    className={`flex-1 py-2.5 rounded-xl transition-all ${transferFrom === 'warehouse' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-500'}`}
                                >
                                    <Warehouse className="w-4 h-4 mx-auto mb-1" />
                                    المستودع ({item.warehouseQuantity || 0})
                                </button>
                                <button
                                    onClick={() => setTransferFrom('rooms')}
                                    className={`flex-1 py-2.5 rounded-xl transition-all ${transferFrom === 'rooms' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25' : 'bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-500'}`}
                                >
                                    <Home className="w-4 h-4 mx-auto mb-1" />
                                    الغرف ({item.roomsQuantity || 0})
                                </button>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium mb-2">إلى</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setTransferTo('warehouse')}
                                    className={`flex-1 py-2.5 rounded-xl transition-all ${transferTo === 'warehouse' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-500'}`}
                                    disabled={transferFrom === 'warehouse'}
                                >
                                    <Warehouse className="w-4 h-4 mx-auto mb-1" />
                                    المستودع
                                </button>
                                <button
                                    onClick={() => setTransferTo('rooms')}
                                    className={`flex-1 py-2.5 rounded-xl transition-all ${transferTo === 'rooms' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25' : 'bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-500'}`}
                                    disabled={transferFrom === 'rooms'}
                                >
                                    <Home className="w-4 h-4 mx-auto mb-1" />
                                    الغرف
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Quantity Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {mode === 'transfer' ? 'الكمية للنقل' : `الكمية ${mode === 'warehouse' ? 'الجديدة في المستودع' : 'الجديدة في الغرف'}`}
                        </label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                            className="w-full px-4 py-4 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white text-center text-2xl font-bold focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                            min="0"
                            max={mode === 'transfer' ? (transferFrom === 'warehouse' ? item.warehouseQuantity : item.roomsQuantity) : undefined}
                        />
                        {mode === 'transfer' && (
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                                المتاح: {transferFrom === 'warehouse' ? item.warehouseQuantity : item.roomsQuantity}
                            </p>
                        )}
                    </div>

                    {/* Preview */}
                    {mode !== 'transfer' && (
                        <div className="flex items-center justify-center gap-4 py-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-slate-600">
                            <span className="text-slate-500 dark:text-slate-400 text-lg">
                                {mode === 'warehouse' ? item.warehouseQuantity : item.roomsQuantity}
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className="text-2xl font-bold text-teal-600 dark:text-teal-400">{quantity}</span>
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">السبب *</label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                            placeholder={mode === 'transfer' ? 'مثال: توزيع على الغرف' : 'مثال: تعديل يدوي'}
                        />
                    </div>
                </div>

                <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600"
                    >إلغاء</button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || quantity <= 0 || !reason.trim() || (mode === 'transfer' && transferFrom === transferTo)}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-teal-400 to-teal-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-teal-400/30 hover:from-teal-500 hover:to-teal-600 transition-all"
                    >
                        {saving ? <AdoraLoaderInline size={20} /> : <Check className="w-5 h-5" />}
                        تأكيد
                    </button>
                </div>
            </div>
        </div>
    );
};

// ✅ Item Details Modal - Show all three dimensions + purchase history
interface ItemDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: InventoryItem | null;
}

const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({ isOpen, onClose, item }) => {
    const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && item) {
            setLoading(true);
            getItemTransactions(item.id, 50).then((data) => {
                setTransactions(data);
                setLoading(false);
            });
        }
    }, [isOpen, item]);

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Solid Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            {/* Modal Content - Theme Aware */}
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">تفاصيل المخزون - {item.name}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-white/60 dark:hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* ✅ Three Dimensions Overview */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-4 rounded-xl text-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border border-blue-200 dark:border-blue-800">
                            <Warehouse className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                            <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">المستودع</p>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{item.warehouseQuantity || 0}</p>
                        </div>
                        <div className="p-4 rounded-xl text-center bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-200 dark:border-purple-800">
                            <Home className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                            <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">الغرف</p>
                            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{item.roomsQuantity || 0}</p>
                        </div>
                        <div className="p-4 rounded-xl text-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border border-green-200 dark:border-green-800">
                            <ShoppingCart className="w-8 h-8 text-green-400 mx-auto mb-2" />
                            <p className="text-white/60 text-sm mb-1">المشترى</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {(item.purchases || []).reduce((sum, p) => sum + (p.quantity || 0), 0)}
                            </p>
                        </div>
                    </div>

                    <div className="text-center py-3 bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900/30 dark:to-teal-800/30 rounded-xl border border-teal-200 dark:border-teal-800">
                        <p className="text-slate-600 dark:text-slate-400 text-sm">الإجمالي</p>
                        <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">{item.totalQuantity || 0}</p>
                    </div>

                    {/* ✅ Purchase History */}
                    {item.purchases && item.purchases.length > 0 && (
                        <div>
                            <h4 className="text-slate-800 dark:text-white font-bold mb-3 flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-green-500" />
                                سجل المشتريات
                            </h4>
                            <div className="space-y-2">
                                {item.purchases.map((purchase, idx) => (
                                    <div key={idx} className="p-3 rounded-xl flex items-center justify-between bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                                                <ShoppingCart className="w-5 h-5 text-green-600 dark:text-green-400" />
                                            </div>
                                            <div>
                                                <p className="text-slate-800 dark:text-white font-medium">{purchase.quantity} {item.unit}</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-xs">
                                                    {formatDate(purchase.purchaseDate)} • {getTimeAgo(purchase.purchaseDate)}
                                                </p>
                                                {purchase.receivedBy && (
                                                    <p className="text-slate-400 dark:text-slate-500 text-xs">بواسطة: {purchase.receivedBy.name}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {purchase.unitPrice && (
                                                <p className="text-green-600 dark:text-green-400 font-bold">{purchase.quantity * purchase.unitPrice} ر.س</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Transaction History */}
                    <div>
                        <h4 className="text-slate-800 dark:text-white font-bold mb-3 flex items-center gap-2">
                            <History className="w-5 h-5 text-blue-500" />
                            سجل الحركات
                        </h4>
                        {loading ? (
                            <div className="text-center py-4">
                                <AdoraLoader size="sm" message="جاري تحميل البيانات..." />
                            </div>
                        ) : transactions.length > 0 ? (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {transactions.map((trans) => (
                                    <div key={trans.id} className="p-3 rounded-xl flex items-center justify-between bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                                        <div>
                                            <p className="text-slate-800 dark:text-white text-sm">
                                                {trans.type === 'in' && '+'}{trans.type === 'out' && '-'}{trans.quantity} {item.unit}
                                                <span className="text-slate-500 dark:text-slate-400 mr-2">({trans.dimension === 'warehouse' ? 'مستودع' : trans.dimension === 'rooms' ? 'غرف' : 'مشترى'})</span>
                                            </p>
                                            <p className="text-slate-500 dark:text-slate-400 text-xs">{trans.reason}</p>
                                            <p className="text-slate-400 dark:text-slate-500 text-xs">
                                                {formatDate(trans.createdAt)} • {trans.performedBy.name}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-bold ${trans.type === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {trans.previousQuantity} → {trans.newQuantity}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-400 dark:text-slate-500 text-center py-4">لا توجد حركات مسجلة</p>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-400 to-teal-500 text-white font-bold hover:from-teal-500 hover:to-teal-600 transition-all shadow-lg shadow-teal-400/30"
                    >
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const InventoryManagement: React.FC = () => {
    const { user } = useAuth();
    const branchId = useMemo(() => (user as any)?.branch || (user as any)?.branchId || 'default', [user]);
    const tenantId = (user as any)?.tenantId;

    // State
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
    const [stats, setStats] = useState<any>(null);

    // Modals
    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [quantityItem, setQuantityItem] = useState<InventoryItem | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [detailsItem, setDetailsItem] = useState<InventoryItem | null>(null);

    // Load data
    useEffect(() => {
        if (!branchId) return;

        const unsubscribe = subscribeToInventory(
            branchId,
            (data) => {
                setItems(data);
                setLoading(false);
            },
            selectedCategory === 'all' ? undefined : selectedCategory,
            tenantId
        );

        // Load categories and stats
        const loadExtra = async () => {
            const cats = await getCategories(branchId, tenantId);
            setCategories(cats);

            const alerts = await getLowStockAlerts(branchId, tenantId);
            setLowStockAlerts(alerts);

            const statsData = await getInventoryStats(branchId, tenantId);
            setStats(statsData);
        };
        loadExtra();

        return unsubscribe;
    }, [branchId, selectedCategory, tenantId]);

    // Filtered items
    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [items, searchQuery, selectedCategory]);

    // Handlers
    const handleAddItem = () => {
        setEditingItem(null);
        setShowItemModal(true);
    };

    const handleEditItem = (item: InventoryItem) => {
        setEditingItem(item);
        setShowItemModal(true);
    };

    const handleSaveItem = async (data: Partial<InventoryItem>) => {
        if (editingItem) {
            await updateInventoryItem(
                editingItem.id,
                data,
                user?.id,
                user?.name
            );
        } else {
            await addInventoryItem(
                {
                    ...data,
                    branch: branchId,
                    tenantId,
                    purchases: [] // Empty purchases for manual entry
                } as any,
                user?.id || '',
                user?.name || '',
                tenantId
            );
        }
    };

    const handleDeleteItem = async (item: InventoryItem) => {
        if (confirm(`هل أنت متأكد من حذف "${item.name}"؟`)) {
            await deleteInventoryItem(item.id);
        }
    };

    const handleQuantityClick = (item: InventoryItem) => {
        setQuantityItem(item);
        setShowQuantityModal(true);
    };

    const handleWarehouseUpdate = async (quantity: number, reason: string) => {
        if (!quantityItem) return;
        await updateWarehouseQuantity(
            quantityItem.id,
            quantity,
            reason,
            user?.id || '',
            user?.name || '',
            branchId,
            tenantId
        );
    };

    const handleRoomsUpdate = async (quantity: number, reason: string) => {
        if (!quantityItem) return;
        await updateRoomsQuantity(
            quantityItem.id,
            quantity,
            reason,
            user?.id || '',
            user?.name || '',
            branchId,
            tenantId
        );
    };

    const handleTransfer = async (from: 'warehouse' | 'rooms', to: 'warehouse' | 'rooms', quantity: number) => {
        if (!quantityItem) return;
        await transferInventory(
            quantityItem.id,
            from,
            to,
            quantity,
            user?.id || '',
            user?.name || '',
            branchId,
            tenantId
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <AdoraLoader size="md" message="جاري تحميل البيانات..." />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shadow-lg shadow-teal-500/5">
                        <Package className="w-8 h-8 text-teal-400" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-extrabold text-white tracking-tight">إدارة المخزون الذكي</h2>
                        <p className="text-white/40 text-sm mt-0.5">المستودع + الغرف + المشترى (تسجيل تلقائي من المشتريات)</p>
                    </div>
                </div>

                <button
                    onClick={handleAddItem}
                    className="w-full md:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold shadow-xl shadow-teal-500/20 hover:shadow-teal-500/40 active:scale-95 transition-all flex items-center justify-center gap-2 border border-teal-400/20"
                >
                    <Plus className="w-5 h-5" />
                    إضافة عنصر يدوي
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatsCard
                        title="إجمالي العناصر"
                        value={stats.totalItems}
                        icon={<Package className="w-6 h-6" />}
                        color="#3B82F6"
                    />
                    <StatsCard
                        title="قيمة المخزون"
                        value={`${stats.totalValue.toLocaleString()} ر.س`}
                        icon={<BarChart3 className="w-6 h-6" />}
                        color="#14B8A6"
                    />
                    <StatsCard
                        title="مخزون منخفض"
                        value={stats.lowStockCount}
                        icon={<AlertTriangle className="w-6 h-6" />}
                        color="#F59E0B"
                    />
                    <StatsCard
                        title="التصنيفات"
                        value={categories.length}
                        icon={<Filter className="w-6 h-6" />}
                        color="#8B5CF6"
                    />
                </div>
            )}

            {/* Low Stock Alerts */}
            {lowStockAlerts.length > 0 && (
                <div className="p-4 rounded-2xl transition-colors duration-300" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        تنبيهات المخزون المنخفض
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {lowStockAlerts.slice(0, 8).map((alert) => (
                            <LowStockBadge key={alert.itemId} alert={alert} />
                        ))}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pr-12 pl-4 py-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                        style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}
                        placeholder="البحث في المخزون..."
                    />
                </div>

                {/* ✅ Dynamic Category Filter */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${selectedCategory === 'all' ? 'bg-teal-500 text-white' : 'text-white/60 hover:text-white'
                            }`}
                        style={selectedCategory !== 'all' ? { background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' } : {}}
                    >
                        الكل
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-2 ${selectedCategory === cat ? 'bg-teal-500 text-white' : 'text-white/60 hover:text-white'
                                }`}
                            style={selectedCategory !== cat ? { background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' } : {}}
                        >
                            <Package className="w-4 h-4" />
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* ✅ Items Grid - Three Dimensions Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                    <div
                        key={item.id}
                        className={`p-4 rounded-2xl hover:scale-[1.02] transition-all cursor-pointer transition-colors duration-300 ${item.totalQuantity === 0 ? 'ring-2 ring-red-500/50' :
                            item.totalQuantity <= item.minQuantity ? 'ring-2 ring-yellow-500/50' : ''
                            }`}
                        style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}
                        onClick={() => {
                            setDetailsItem(item);
                            setShowDetailsModal(true);
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center">
                                    <Package className="w-6 h-6 text-teal-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-semibold truncate">{item.name}</p>
                                    <p className="text-white/50 text-xs">{item.category || 'غير مصنف'}</p>
                                    {item.autoCreated && (
                                        <p className="text-green-400/60 text-[10px] mt-0.5">✨ تلقائي من المشتريات</p>
                                    )}
                                </div>
                            </div>
                            {/* Status Badge */}
                            {item.totalQuantity === 0 ? (
                                <span className="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold flex-shrink-0">نفذ</span>
                            ) : item.totalQuantity <= item.minQuantity ? (
                                <span className="px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-bold flex-shrink-0">منخفض</span>
                            ) : null}
                        </div>

                        {/* ✅ Three Dimensions Display */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-center border border-blue-500/20">
                                <Warehouse className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                                <p className="text-white/60 text-[10px] mb-0.5">المستودع</p>
                                <p className="text-lg font-bold text-white">{item.warehouseQuantity || 0}</p>
                            </div>
                            <div className="p-2 bg-purple-500/10 rounded-lg text-center border border-purple-500/20">
                                <Home className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                                <p className="text-white/60 text-[10px] mb-0.5">الغرف</p>
                                <p className="text-lg font-bold text-white">{item.roomsQuantity || 0}</p>
                            </div>
                            <div className="p-2 bg-green-500/10 rounded-lg text-center border border-green-500/20">
                                <ShoppingCart className="w-4 h-4 text-green-400 mx-auto mb-1" />
                                <p className="text-white/60 text-[10px] mb-0.5">المشترى</p>
                                <p className="text-lg font-bold text-green-400">
                                    {(item.purchases || []).reduce((sum, p) => sum + (p.quantity || 0), 0)}
                                </p>
                            </div>
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between py-2 border-y border-white/10 mb-3">
                            <span className="text-white/60 text-sm">الإجمالي</span>
                            <div className="flex items-center gap-2">
                                <p className="text-2xl font-bold text-teal-400">{item.totalQuantity || 0}</p>
                                <span className="text-white/40 text-xs">
                                    {UNIT_OPTIONS.find(u => u.value === item.unit)?.label || item.unit}
                                </span>
                            </div>
                        </div>

                        {/* Quick Info */}
                        <div className="space-y-1.5 mb-3 text-xs">
                            <div className="flex justify-between">
                                <span className="text-white/50">الحد الأدنى</span>
                                <span className="text-white">{item.minQuantity}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/50">سعر الوحدة</span>
                                <span className="text-white">{item.unitPrice} ر.س</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/50">القيمة الإجمالية</span>
                                <span className="text-teal-400 font-medium">{item.totalValue?.toLocaleString()} ر.س</span>
                            </div>
                        </div>

                        {/* ✅ Purchase Count */}
                        {item.purchases && item.purchases.length > 0 && (
                            <div className="mb-3 p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                                <p className="text-green-400 text-xs flex items-center gap-1">
                                    <ShoppingCart className="w-3 h-3" />
                                    {item.purchases.length} عملية شراء
                                </p>
                                <p className="text-green-400/60 text-[10px] mt-0.5">
                                    آخر شراء: {item.purchases[item.purchases.length - 1]?.purchaseDate ? getTimeAgo(item.purchases[item.purchases.length - 1].purchaseDate) : '-'}
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuantityClick(item);
                                }}
                                className="flex-1 py-2 rounded-xl bg-teal-500/20 text-teal-400 font-medium hover:bg-teal-500/30 transition-all flex items-center justify-center gap-1 text-sm"
                            >
                                <Edit2 className="w-4 h-4" />
                                تعديل
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditItem(item);
                                }}
                                className="w-10 h-10 rounded-xl text-white/60 hover:text-white flex items-center justify-center transition-colors"
                                style={{ background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-primary)' }}
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteItem(item);
                                }}
                                className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {filteredItems.length === 0 && (
                <div className="text-center py-12">
                    <Package className="w-16 h-16 text-white/20 mx-auto mb-4" />
                    <p className="text-white/40">لا توجد عناصر في المخزون</p>
                    <p className="text-white/30 text-sm mt-2">
                        {selectedCategory !== 'all' ? `لا توجد عناصر في تصنيف "${selectedCategory}"` : 'يمكنك إضافة عناصر يدوياً أو من خلال استلام المشتريات'}
                    </p>
                    <button
                        onClick={handleAddItem}
                        className="mt-4 px-6 py-3 rounded-xl bg-teal-500 text-white font-bold"
                    >
                        إضافة أول عنصر
                    </button>
                </div>
            )}

            {/* Modals */}
            <ItemModal
                isOpen={showItemModal}
                onClose={() => setShowItemModal(false)}
                item={editingItem}
                availableCategories={categories}
                onSave={handleSaveItem}
            />

            <QuantityModal
                isOpen={showQuantityModal}
                onClose={() => setShowQuantityModal(false)}
                item={quantityItem}
                onWarehouseUpdate={handleWarehouseUpdate}
                onRoomsUpdate={handleRoomsUpdate}
                onTransfer={handleTransfer}
            />

            <ItemDetailsModal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                item={detailsItem}
            />
        </div>
    );
};

export default InventoryManagement;
