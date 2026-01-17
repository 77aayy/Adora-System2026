/**
 * Laundry Management Component (Admin Dashboard)
 * Full control for manager: items, stock, cards, settings, reports
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    Package, Settings, BarChart3, Plus, Edit2, Trash2, Eye, EyeOff,
    Save, X, Filter, Download, TrendingDown, TrendingUp,
    AlertTriangle, RefreshCw, Check, ShoppingCart
} from 'lucide-react';
import { Switch } from '../common/Switch';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import {
    LaundryItem, LaundrySettings, AccountingReport,
    subscribeToLaundryItems,
    addLaundryItem,
    updateLaundryItem,
    deleteLaundryItem,
    getLaundrySettings,
    updateLaundrySettings,
    getCumulativeDeficit,
    getMonthlyAccountingReport,
    initializeLaundryItems,
    generatePrintableReport,
    generateCSVReport
} from '../../services/laundryInventoryService';
import { useSmartAgent } from '../../hooks/useSmartAgent';

// ============================================================
// TYPES
// ============================================================

type TabType = 'items' | 'reports' | 'settings';
type ReportPeriod = 'day' | 'week' | 'month' | 'custom';

interface LaundryManagementProps {
    isOpen?: boolean;
    onClose?: () => void;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const LaundryManagement: React.FC<LaundryManagementProps> = ({
    isOpen = true,
    onClose
}) => {
    const { user } = useAuth();
    const { haptic, playSound, success, error } = useUX();
    const branchId = (user as any)?.branch || 'default';

    // 🛡️ REMOVED localStorage Fallback for Security
    const tenantId = (user as any)?.tenantId;

    // Guard: Redirect if tenantId missing (security hardening)
    if (!tenantId) {
        error('جلسة غير صالحة. يرجى تسجيل الدخول مرة أخرى.');
        return null;
    }

    // State
    const [activeTab, setActiveTab] = useState<TabType>('items');
    const [items, setItems] = useState<LaundryItem[]>([]);
    const [settings, setSettings] = useState<LaundrySettings>({ deficitAlertThreshold: 10, enablePurchaseAlerts: true });
    const [cumulativeDeficit, setCumulativeDeficit] = useState<Record<string, number>>({});
    const [accountingReport, setAccountingReport] = useState<AccountingReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Edit states
    const [editingItem, setEditingItem] = useState<LaundryItem | null>(null);
    const [newItemName, setNewItemName] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [newItemStock, setNewItemStock] = useState('');
    const [showAddItem, setShowAddItem] = useState(false);

    // Report filters
    const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('month');
    const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [selectedItemFilter, setSelectedItemFilter] = useState<string>('all');
    // Settle Modal State
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [settleItem, setSettleItem] = useState<{ id: string; name: string; max: number } | null>(null);
    const [settleQuantity, setSettleQuantity] = useState(1);

    // ✅ FIXED: Missing Delivery/Receipt Modal State
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [showDeliveryModal, _setShowDeliveryModal] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [showReceiptModal, _setShowReceiptModal] = useState(false);
    const [deliveryQuantities, setDeliveryQuantities] = useState<Record<string, number>>({});
    const [receiptQuantities, setReceiptQuantities] = useState<Record<string, number>>({});

    // Determine if running as Modal or Page
    const isModal = Boolean(onClose);

    // ... (useEffect hooks)

    // Handle Settle Click
    const handleSettleClick = (id: string, name: string, max: number) => {
        setSettleItem({ id, name, max });
        setSettleQuantity(1);
        setShowSettleModal(true);
    };

    // Submit Settlement
    const handleSettleSubmit = async () => {
        if (!settleItem || !tenantId) return;
        setSaving(true);
        try {
            await import('../../services/laundryInventoryService').then(mod =>
                mod.settleDeficit(tenantId, branchId, settleItem.id, settleQuantity, user?.id || '', user?.name || '')
            );

            // Optimistic Update
            setCumulativeDeficit(prev => ({
                ...prev,
                [settleItem.id]: (prev[settleItem.id] || 0) - settleQuantity
            }));

            haptic('success');
            success(`تم تسوية ${settleQuantity} من ${settleItem.name}`);
            setShowSettleModal(false);
            setSettleItem(null);
        } catch (err) {
            console.error(err);
            error('فشل التسوية');
        }
        setSaving(false);
    };

    // Load data
    useEffect(() => {
        if (!isOpen || !tenantId) return;

        setLoading(true);

        // Initialize items if needed
        initializeLaundryItems(tenantId, branchId, user?.id || '', user?.name || '').catch(console.error);

        // Subscribe to items
        const unsubItems = subscribeToLaundryItems(tenantId, branchId, (data) => {
            setItems(data);
            setLoading(false);
        });

        // Load settings
        getLaundrySettings(tenantId, branchId).then(s => {
            if (s) setSettings(s);
        });

        // Load cumulative deficit - ✅ FIXED: Added tenantId parameter
        getCumulativeDeficit(tenantId, branchId).then(setCumulativeDeficit);

        return () => unsubItems();
    }, [isOpen, branchId, tenantId, user?.id, user?.name]);

    // Load report when filters change
    useEffect(() => {
        if (activeTab !== 'reports' || !isOpen) return;

        loadReport();
    }, [activeTab, reportPeriod, reportMonth, reportYear, customStartDate, customEndDate, isOpen]);

    const loadReport = async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const report = await getMonthlyAccountingReport(tenantId, branchId, reportYear, reportMonth);
            setAccountingReport(report);
        } catch (err) {
            console.error('Error loading report:', err);
        }
        setLoading(false);
    };

    // Add new item
    const handleAddItem = async () => {
        if (!newItemName.trim() || !newItemPrice.trim()) {
            error('الرجاء إدخال اسم البند والسعر');
            return;
        }
        if (!tenantId) return;

        setSaving(true);
        try {
            await addLaundryItem(
                tenantId,
                branchId,
                {
                    name: newItemName.trim(),
                    priceWithTax: parseFloat(newItemPrice)
                }
            );

            // Update stock if provided - Skipping for now as stock isn't in settings

            setNewItemName('');
            setNewItemPrice('');
            setNewItemStock('');
            setShowAddItem(false);
            haptic('success');
            success('تم إضافة البند بنجاح');
        } catch (err) {
            console.error('Error adding item:', err);
            error('فشل إضافة البند');
        }
        setSaving(false);
    };

    // Update item
    const handleUpdateItem = async (itemId: string, updates: Partial<LaundryItem>) => {
        if (!tenantId) return;
        setSaving(true);
        try {
            await updateLaundryItem(tenantId, branchId, itemId, {
                name: updates.name,
                priceWithTax: updates.priceWithTax
            });
            haptic('success');
            success('تم تحديث البند');
            setEditingItem(null);
        } catch (err) {
            console.error('Error updating item:', err);
            error('فشل تحديث البند');
        }
        setSaving(false);
    };

    // Toggle card visibility
    const handleToggleCard = async (itemId: string, showInCards: boolean) => {
        if (!tenantId) return;
        setSaving(true);
        try {
            // ✅ FIX: Update showInCards field in laundry_prices settings
            await updateLaundryItem(tenantId, branchId, itemId, {
                showInCards: showInCards
            } as any);
            haptic('success');
            success(showInCards ? 'تم تفعيل العرض في الكروت' : 'تم إخفاء البند من الكروت');
        } catch (err) {
            console.error('Error toggling card visibility:', err);
            error('فشل تحديث حالة العرض');
        }
        setSaving(false);
    };

    // Delete item
    const handleDeleteItem = async (itemId: string) => {
        if (!confirm('هل تريد حذف هذا البند؟')) return;
        if (!tenantId) return;

        try {
            await deleteLaundryItem(tenantId, branchId, itemId);
            haptic('medium');
            success('تم حذف البند');
        } catch (err) {
            console.error('Error deleting item:', err);
            error('فشل حذف البند');
        }
    };

    // Save settings
    const handleSaveSettings = async () => {
        if (!tenantId) return;
        setSaving(true);
        try {
            await updateLaundrySettings(tenantId, branchId, settings);
            haptic('success');
            success('تم حفظ الإعدادات');
        } catch (err) {
            console.error('Error saving settings:', err);
            error('فشل حفظ الإعدادات');
        }
        setSaving(false);
    };

    // Filtered report items
    const filteredReportItems = useMemo(() => {
        if (!accountingReport) return [];
        if (selectedItemFilter === 'all') return accountingReport.items;
        return accountingReport.items.filter(i => i.itemId === selectedItemFilter);
    }, [accountingReport, selectedItemFilter]);

    // Total deficit value
    const totalDeficitValue = useMemo(() => {
        return Object.entries(cumulativeDeficit).reduce((sum, [itemId, qty]) => {
            const item = items.find(i => i.id === itemId);
            return sum + (Math.abs(qty) * (item?.priceWithTax || 0));
        }, 0);
    }, [cumulativeDeficit, items]);

    // 🚨 PROCUREMENT ALERTS: Identify low stock items
    const lowStockItems = useMemo(() => {
        if (!settings.enablePurchaseAlerts) return [];
        return items.filter(item => {
            const total = (item.stockRooms || 0) + (item.stockWarehouse || 0);
            return total <= settings.deficitAlertThreshold;
        });
    }, [items, settings.enablePurchaseAlerts, settings.deficitAlertThreshold]);

    // Voice Agent
    const handleVoiceAction = async (action: string, params: any) => {
        if (!tenantId) return;

        // 🛡️ RBAC GUARD: Expanded to ALL sensitive stock operations
        const userRole = (user as any)?.role || 'staff';
        const sensitiveActions = ['update_stock', 'settle_deficit', 'report_loss'];

        if (sensitiveActions.includes(action) && !['manager', 'owner', 'admin'].includes(userRole)) {
            error('❌ غير مسموح لك بهذا الإجراء. راجع المدير.');
            return;
        }

        const { itemId, quantity, operation } = params;
        const item = items.find(i => i.id === itemId);

        if (!item) {
            error('لم يتم العثور على البند');
            return;
        }

        // 🛡️ INPUT VALIDATION: Prevent overflow, injection, and invalid operations
        const MAX_QUANTITY = 100000;
        const qty = parseInt(quantity);

        if (isNaN(qty) || qty <= 0) {
            error('الكمية غير صحيحة');
            return;
        }

        if (qty > MAX_QUANTITY) {
            error(`الكمية كبيرة جداً (الحد الأقصى ${MAX_QUANTITY.toLocaleString('ar-EG')})`);
            return;
        }

        // Validate itemId format (alphanumeric, underscore, hyphen only)
        if (!/^[a-zA-Z0-9_-]+$/.test(itemId)) {
            error('معرف البند غير صالح');
            return;
        }

        // Validate operation enum (only for update_stock)
        if (operation && !['add', 'remove', 'set'].includes(operation)) {
            error('العملية غير صالحة');
            return;
        }

        try {
            if (action === 'update_stock') {
                // Update Warehouse Stock
                let change = qty;
                if (operation === 'remove') change = -qty;
                else if (operation === 'set') change = qty - (item.stockWarehouse || 0);

                await updateLaundryItem(tenantId, branchId, item.id, {
                    stockWarehouse: (item.stockWarehouse || 0) + change
                });
                success(`تم تحديث مخزون المستودع: ${item.name}`);
            }
            else if (action === 'settle_deficit') {
                // Settle Deficit (Fixing/Returning)
                await import('../../services/laundryInventoryService').then(mod =>
                    mod.settleDeficit(tenantId, branchId, item.id, qty, user?.id || '', user?.name || '')
                );
                success(`تم تسوية العجز: ${qty} من ${item.name}`);
            }
            else if (action === 'report_loss') {
                // Report Laundry Loss (Manual Deficit)
                await import('../../services/laundryInventoryService').then(mod =>
                    mod.reportLostByLaundry(tenantId, branchId, item.id, qty, user?.id || '', user?.name || '')
                );
                error(`تم تسجيل عجز جديد: ${qty} من ${item.name}`); // Red toast for loss
            }
        } catch (err) {
            console.error('Voice Action Error:', err);
            error('حدث خطأ أثناء تنفيذ الأمر الصوتي');
        }
    };

    // 🧠 Dynamic Schema & Batch Handling
    const activeContext = showDeliveryModal ? 'laundry_delivery' : showReceiptModal ? 'laundry_receipt' : 'laundry_inventory';

    const getAgentSchema = () => {
        if (showDeliveryModal || showReceiptModal) {
            return {
                action: "batch_fill_quantities",
                description: "Fill multiple item quantities for delivery or receipt note.",
                properties: {
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                itemId: { type: "string", description: "The EXACT 'id' of the laundry item found in availableItems" },
                                quantity: { type: "number", description: "The quantity to set" }
                            },
                            required: ["itemId", "quantity"]
                        }
                    }
                },
                required: ["items"]
            };
        }

        // Default Schema
        return {
            action: "manage_laundry",
            description: "Manage laundry stock, settle deficits, or report losses.",
            properties: {
                action: {
                    type: "string",
                    enum: ["update_stock", "settle_deficit", "report_loss"],
                    description: "update_stock: Modify warehouse count. settle_deficit: Fix/return items. report_loss: Laundry lost items."
                },
                itemId: { type: "string", description: "The EXACT 'id' of the item" },
                quantity: { type: "number", description: "The positive quantity involved" },
                operation: {
                    type: "string",
                    enum: ["add", "remove", "set"],
                    description: "Only used for update_stock. 'add' increases, 'remove' decreases."
                }
            },
            required: ["action", "itemId", "quantity"]
        };
    };

    const handleBatchFill = (params: any) => {
        const { items: batchItems } = params;
        if (!batchItems || !Array.isArray(batchItems)) return;

        // Clone active quantities ref
        const isDelivery = showDeliveryModal;
        const currentQuantities = isDelivery ? deliveryQuantities : receiptQuantities;
        const newQuantities = { ...currentQuantities };
        let updatedCount = 0;

        batchItems.forEach((item: any) => {
            if (item.itemId && item.quantity > 0) {
                newQuantities[item.itemId] = item.quantity;
                updatedCount++;
            }
        });

        if (isDelivery) setDeliveryQuantities(newQuantities);
        else setReceiptQuantities(newQuantities);

        playSound('success');
        success(`تم تعبئة ${updatedCount} بند تلقائياً ⚡`);
    };

    // Prepare simplified data for AI (Token efficiency 📉)
    const itemsContext = items.map(i => ({ id: i.id, name: i.name }));

    const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        activateAgent: _activateAgent,
        isActive,
        status,
        transcript,
        feedback,
        cancel,
        setLanguage // 🌍 Exposed
    } = useSmartAgent({
        context: activeContext,
        schema: getAgentSchema(),
        data: { availableItems: itemsContext },
        onSuccess: (action, params) => {
            if (action === 'batch_fill_quantities') {
                handleBatchFill(params);
            } else {
                handleVoiceAction(params.action || action, params);
            }
        }
    });

    // 🌍 Language Options
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _LANGUAGES = [
        { code: 'ar-SA', label: '🇸🇦 عربي' },
        { code: 'en-US', label: '🇺🇸 English' },
        { code: 'hi-IN', label: '🇮🇳 Hindi' }, // Gemini handles Bengali/Urdu well under Hindi/English context usually, or we can add specific codes if supported by Browser STT
        { code: 'bn-BD', label: '🇧🇩 Bengali' }
    ];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_currentLang, _setCurrentLang] = useState('ar-SA');

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _handleLanguageChange = (lang: string) => {
        _setCurrentLang(lang);
        setLanguage(lang);
    };

    const containerClass = isModal
        ? "fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        : "h-full animate-in fade-in";

    const cardClass = isModal
        ? "glass-card w-full max-w-md sm:max-w-lg lg:max-w-2xl max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl relative"
        : "w-full h-full flex flex-col space-y-6";

    if (!isOpen) return null;

    return (
        <div className={containerClass}>
            <div className={cardClass}>

                {/* 🎤 Voice Agent Overlay */}
                {isActive && (
                    <div className="absolute inset-0 z-50 bg-black/60 rounded-3xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300" style={{ backdropFilter: 'none' }}>
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all duration-500 ${status === 'listening' ? 'bg-primary-500 animate-pulse shadow-[0_0_50px_rgba(59,130,246,0.5)]' :
                            status === 'processing' ? 'bg-purple-500 animate-bounce' :
                                status === 'speaking' ? 'bg-green-500' : 'bg-gray-500'
                            }`}>
                            {status === 'listening' && <div className="text-4xl">🎤</div>}
                            {status === 'processing' && <div className="text-4xl">🧠</div>}
                            {status === 'speaking' && <div className="text-4xl">🗣️</div>}
                            {status === 'executing' && <div className="text-4xl">✅</div>}
                        </div>

                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                            {status === 'listening' ? 'أنا سامعك...' :
                                status === 'processing' ? 'جاري التحليل...' :
                                    status === 'speaking' ? 'الرد...' :
                                        status === 'executing' ? 'جاري التنفيذ...' : ''}
                        </h3>

                        <p className="text-slate-600 dark:text-white/60 text-lg mb-8 text-center max-w-md">
                            {transcript || feedback || "قول مثلاً: 'ضفي 50 منشفة كبيرة للمخزون'"}
                        </p>

                        <button
                            onClick={cancel}
                            className="px-8 py-3 rounded-full bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-white font-medium transition-colors"
                        >
                            إلغاء
                        </button>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Package className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">إدارة جرد المغسلة</h3>
                            <p className="text-sm text-slate-600 dark:text-white/60">تحكم كامل بالبنود والتقارير</p>
                        </div>
                    </div>



                    <div className="flex items-center gap-2">
                        {isModal && (
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-white/60 hover:text-slate-800 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-white/20"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-white/10 px-4">
                    {[
                        { id: 'items' as TabType, label: 'البنود', icon: Package },
                        { id: 'reports' as TabType, label: 'التقارير', icon: BarChart3 },
                        { id: 'settings' as TabType, label: 'الإعدادات', icon: Settings }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${activeTab === tab.id
                                ? 'border-purple-400 text-purple-400'
                                : 'border-transparent text-slate-600 dark:text-white/60 hover:text-slate-800 dark:hover:text-white'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <AdoraLoader size="md" message="جاري تحميل البيانات..." />
                        </div>
                    ) : activeTab === 'items' ? (
                        // Items Tab
                        <div className="space-y-4">
                            {/* 🚨 Procurement Alerts Banner */}
                            {lowStockItems.length > 0 && (
                                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                                            <ShoppingCart className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-amber-400 font-bold text-sm">تنبيه مشتريات عاجل!</div>
                                            <div className="text-slate-600 dark:text-white/60 text-xs">يوجد {lowStockItems.length} بنود قاربت على النفاد من المخزون</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                // Could open procurement modal or filter
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[10px] font-bold"
                                        >
                                            جدولة شراء
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                    <div className="text-blue-400 text-2xl font-bold">{items.length}</div>
                                    <div className="text-white/60 text-sm">إجمالي البنود</div>
                                </div>
                                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                    <div className="text-green-400 text-2xl font-bold">
                                        {items.filter(i => i.showInCards).length}
                                    </div>
                                    <div className="text-white/60 text-sm">تظهر في الكروت</div>
                                </div>
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 col-span-1 md:col-span-3 lg:col-span-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-red-400 font-bold flex items-center gap-2">
                                            <TrendingDown className="w-5 h-5" />
                                            سجل العجز (نشط)
                                        </div>
                                        <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-lg">إجمالي: {totalDeficitValue.toFixed(2)} ر.س</span>
                                    </div>
                                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                        {/* Dynamic List from Context/Items */}
                                        {items.filter(i => cumulativeDeficit[i.id] && cumulativeDeficit[i.id] > 0).map(item => (
                                            <div key={item.id} className="flex justify-between items-center text-sm bg-slate-100 dark:bg-white/5 p-2 rounded-lg group">
                                                <span className="text-slate-800 dark:text-white/80">{item.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-red-400 font-mono font-bold">-{cumulativeDeficit[item.id]}</span>

                                                    {/* Settle Button */}
                                                    <button
                                                        onClick={() => handleSettleClick(item.id, item.name, cumulativeDeficit[item.id])}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-green-500/20 text-green-400 p-1 rounded hover:bg-green-500/30 text-xs"
                                                        title="تسوية العجز (استرجاع)"
                                                    >
                                                        تسوية
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {Object.keys(cumulativeDeficit).length === 0 && (
                                            <div className="text-slate-500 dark:text-white/40 text-sm text-center py-4">لا يوجد عجز مسجل ✨</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Add Item Button */}
                            <button
                                onClick={() => setShowAddItem(true)}
                                className="w-full p-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                إضافة بند جديد
                            </button>

                            {/* Add Item Form */}
                            {showAddItem && (
                                <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <input
                                            type="text"
                                            placeholder="اسم البند"
                                            value={newItemName}
                                            onChange={e => setNewItemName(e.target.value)}
                                            style={{
                                                background: 'var(--theme-bg-secondary)',
                                                color: 'var(--theme-text-primary)',
                                                borderColor: 'var(--theme-border-primary)',
                                            }}
                                            className="px-3 py-2 rounded-xl placeholder:text-slate-400 dark:placeholder:text-white/40"
                                        />
                                        <input
                                            style={{
                                                background: 'var(--theme-bg-secondary)',
                                                color: 'var(--theme-text-primary)',
                                                borderColor: 'var(--theme-border-primary)',
                                            }}
                                            className="px-3 py-2 rounded-xl placeholder:text-slate-400 dark:placeholder:text-white/40"
                                        />
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="السعر"
                                            value={newItemPrice}
                                            onChange={e => setNewItemPrice(e.target.value)}
                                            style={{
                                                background: 'var(--theme-bg-secondary)',
                                                color: 'var(--theme-text-primary)',
                                                borderColor: 'var(--theme-border-primary)',
                                            }}
                                            className="px-3 py-2 rounded-xl placeholder:text-slate-400 dark:placeholder:text-white/40"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                placeholder="المستودع"
                                                title="الرصيد في المستودع"
                                                value={newItemStock} // Reusing this state for Warehouse temporarily or split? Best to be clear.
                                                onChange={e => setNewItemStock(e.target.value)}
                                                style={{
                                                    background: 'var(--theme-bg-secondary)',
                                                    color: 'var(--theme-text-primary)',
                                                    borderColor: 'var(--theme-border-primary)',
                                                }}
                                                className="w-1/2 px-3 py-2 rounded-xl placeholder:text-slate-400 dark:placeholder:text-white/40 border-blue-500/30"
                                            />
                                            {/* We rely on defaults for Rooms/Laundry on create, or I need more states. checking... 
                                                Let's stick to Warehouse for quick add, edit for details. */}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleAddItem}
                                            disabled={saving}
                                            className="flex-1 py-2 rounded-xl bg-purple-500 text-white hover:bg-purple-600 flex items-center justify-center gap-2"
                                        >
                                            {saving ? <AdoraLoaderInline size={16} /> : <Save className="w-4 h-4" />}
                                            حفظ
                                        </button>
                                        <button
                                            onClick={() => setShowAddItem(false)}
                                            className="px-4 py-2 rounded-xl bg-white/10 text-white/60 hover:bg-white/20"
                                        >
                                            إلغاء
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Items List */}
                            <div className="space-y-2">
                                {items.map(item => (
                                    <div
                                        key={item.id}
                                        className="p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-800 dark:text-white font-medium">{item.name}</span>
                                                    {item.showInCards && (
                                                        <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">كرت</span>
                                                    )}
                                                </div>

                                                {/* 📦 Stock Distribution Visualization */}
                                                <div className="flex items-center gap-6 mt-3 text-sm">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-slate-500 dark:text-white/40 text-xs mb-1">المستودع</span>
                                                        <input
                                                            type="number"
                                                            className="w-16 bg-transparent border-b border-slate-300 dark:border-white/20 text-center text-blue-600 dark:text-blue-300 font-mono focus:border-blue-500 outline-none"
                                                            value={item.stockWarehouse || 0}
                                                            onChange={(e) => handleUpdateItem(item.id, { stockWarehouse: parseInt(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                    <div className="text-slate-400 dark:text-white/20 text-lg">+</div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-slate-500 dark:text-white/40 text-xs mb-1">الغرف</span>
                                                        <input
                                                            type="number"
                                                            className="w-16 bg-transparent border-b border-slate-300 dark:border-white/20 text-center text-purple-600 dark:text-purple-300 font-mono focus:border-purple-500 outline-none"
                                                            value={item.stockRooms || 0}
                                                            onChange={(e) => handleUpdateItem(item.id, { stockRooms: parseInt(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                    <div className="text-slate-400 dark:text-white/20 text-lg">+</div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-slate-500 dark:text-white/40 text-xs mb-1">المغسلة</span>
                                                        <div className="text-orange-600 dark:text-orange-300 font-mono font-bold">{item.inLaundry || 0}</div>
                                                    </div>
                                                    <div className="text-slate-400 dark:text-white/20 text-lg">=</div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-slate-500 dark:text-white/40 text-xs mb-1">الإجمالي</span>
                                                        <div className="text-slate-800 dark:text-white font-bold">
                                                            {(item.stockWarehouse || 0) + (item.stockRooms || 0) + (item.inLaundry || 0)}
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0 w-full md:w-auto justify-end">
                                                {/* Toggle Card */}
                                                <button
                                                    onClick={() => handleToggleCard(item.id, !item.showInCards)}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.showInCards ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'
                                                        }`}
                                                    title={item.showInCards ? 'إخفاء من الكروت' : 'إظهار في الكروت'}
                                                >
                                                    {item.showInCards ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                </button>

                                                {/* Edit */}
                                                <button
                                                    onClick={() => setEditingItem(item)}
                                                    className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500/30"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>

                                                {/* Delete */}
                                                <button
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : activeTab === 'reports' ? (
                        // Reports Tab
                        <div className="space-y-4">
                            {/* Filters */}
                            <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 space-y-4">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-white/60">
                                    <Filter className="w-4 h-4" />
                                    <span className="font-medium">فلترة التقارير</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* Period */}
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-white/40 mb-1 block">الفترة</label>
                                        <select
                                            value={reportPeriod}
                                            onChange={e => setReportPeriod(e.target.value as ReportPeriod)}
                                            style={{
                                                background: 'var(--theme-bg-secondary)',
                                                color: 'var(--theme-text-primary)',
                                                borderColor: 'var(--theme-border-primary)',
                                            }}
                                            className="w-full px-3 py-2 rounded-xl"
                                        >
                                            <option value="day">يومي</option>
                                            <option value="week">أسبوعي</option>
                                            <option value="month">شهري</option>
                                            <option value="custom">مخصص</option>
                                        </select>
                                    </div>

                                    {/* Month */}
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-white/40 mb-1 block">الشهر</label>
                                        <select
                                            value={reportMonth}
                                            onChange={e => setReportMonth(parseInt(e.target.value))}
                                            style={{
                                                background: 'var(--theme-bg-secondary)',
                                                color: 'var(--theme-text-primary)',
                                                borderColor: 'var(--theme-border-primary)',
                                            }}
                                            className="w-full px-3 py-2 rounded-xl"
                                        >
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                                <option key={m} value={m}>
                                                    {new Date(2000, m - 1).toLocaleDateString('ar', { month: 'long' })}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Year */}
                                    <div>
                                        <label className="text-xs text-white/40 mb-1 block">السنة</label>
                                        <select
                                            value={reportYear}
                                            onChange={e => setReportYear(parseInt(e.target.value))}
                                            className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/10"
                                        >
                                            {[2024, 2025, 2026, 2027].map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Item Filter */}
                                    <div>
                                        <label className="text-xs text-white/40 mb-1 block">البند</label>
                                        <select
                                            value={selectedItemFilter}
                                            onChange={e => setSelectedItemFilter(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/10"
                                        >
                                            <option value="all">جميع البنود</option>
                                            {items.map(item => (
                                                <option key={item.id} value={item.id}>{item.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Custom Date Range */}
                                {reportPeriod === 'custom' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-white/40 mb-1 block">من تاريخ</label>
                                            <input
                                                type="date"
                                                value={customStartDate}
                                                onChange={e => setCustomStartDate(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/10"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/40 mb-1 block">إلى تاريخ</label>
                                            <input
                                                type="date"
                                                value={customEndDate}
                                                onChange={e => setCustomEndDate(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/10"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Refresh Button */}
                                <button
                                    onClick={loadReport}
                                    className="w-full py-2 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    تحديث التقرير
                                </button>
                            </div>

                            {/* Report Summary */}
                            {accountingReport && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                            <div className="text-blue-400 text-2xl font-bold">
                                                {accountingReport.grandTotal.toFixed(2)}
                                            </div>
                                            <div className="text-white/60 text-sm">إجمالي التكلفة (ر.س)</div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                            <div className="text-red-400 text-2xl font-bold flex items-center gap-1">
                                                <TrendingDown className="w-5 h-5" />
                                                {accountingReport.totalDeficitValue.toFixed(2)}
                                            </div>
                                            <div className="text-white/60 text-sm">قيمة العجز (ر.س)</div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                            <div className="text-green-400 text-2xl font-bold flex items-center gap-1">
                                                <TrendingUp className="w-5 h-5" />
                                                {accountingReport.totalSurplusValue.toFixed(2)}
                                            </div>
                                            <div className="text-white/60 text-sm">قيمة الزيادة (ر.س)</div>
                                        </div>
                                    </div>

                                    {/* Report Table */}
                                    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-white/10">
                                                    <th className="p-3 text-right text-white/60 text-sm">البند</th>
                                                    <th className="p-3 text-center text-white/60 text-sm">مسلم</th>
                                                    <th className="p-3 text-center text-white/60 text-sm">مستلم</th>
                                                    <th className="p-3 text-center text-white/60 text-sm">عجز</th>
                                                    <th className="p-3 text-center text-white/60 text-sm">زيادة</th>
                                                    <th className="p-3 text-center text-white/60 text-sm">السعر</th>
                                                    <th className="p-3 text-center text-white/60 text-sm">التكلفة</th>
                                                    <th className="p-3 text-center text-white/60 text-sm">قيمة العجز</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredReportItems.map(item => (
                                                    <tr key={item.itemId} className="border-b border-white/5 hover:bg-white/5">
                                                        <td className="p-3 text-white">{item.itemName}</td>
                                                        <td className="p-3 text-center text-white/80">{item.totalDelivered}</td>
                                                        <td className="p-3 text-center text-white/80">{item.totalReceived}</td>
                                                        <td className="p-3 text-center text-red-400">{item.deficit > 0 ? `-${item.deficit}` : '-'}</td>
                                                        <td className="p-3 text-center text-green-400">{item.surplus > 0 ? `+${item.surplus}` : '-'}</td>
                                                        <td className="p-3 text-center text-white/60">{item.pricePerUnit.toFixed(2)}</td>
                                                        <td className="p-3 text-center text-blue-400">{item.totalCost.toFixed(2)}</td>
                                                        <td className="p-3 text-center text-red-400">{item.deficitCost.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Export Buttons */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={async () => {
                                                if (!tenantId) return;
                                                const html = await generatePrintableReport(tenantId, branchId, reportYear, reportMonth);
                                                const win = window.open('', '_blank');
                                                if (win) {
                                                    win.document.write(html);
                                                    win.document.close();
                                                    win.print();
                                                }
                                            }}
                                            className="flex-1 py-3 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center gap-2"
                                        >
                                            <span className="text-xl">🖨️</span>
                                            طباعة PDF
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!tenantId) return;
                                                const csv = await generateCSVReport(tenantId, branchId, reportYear, reportMonth);
                                                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `laundry-report-${reportYear}-${reportMonth}.csv`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="flex-1 py-3 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center gap-2"
                                        >
                                            <Download className="w-5 h-5" />
                                            تصدير Excel
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        // Settings Tab
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                                <h4 className="text-white font-medium flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                    إعدادات التنبيهات
                                </h4>

                                <div>
                                    <label className="text-sm text-white/60 mb-2 block">
                                        حد تنبيه العجز (عدد القطع)
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.deficitAlertThreshold}
                                        onChange={e => setSettings(prev => ({
                                            ...prev,
                                            deficitAlertThreshold: parseInt(e.target.value) || 10
                                        }))}
                                        className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border border-white/10"
                                    />
                                    <p className="text-xs text-white/40 mt-1">
                                        سيتم إرسال تنبيه عند وصول العجز لهذا الحد
                                    </p>
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 group">
                                    <div>
                                        <div className="text-white font-medium">تنبيهات المشتريات</div>
                                        <div className="text-sm text-white/40">تنبيه عند وجود مشتريات لبنود المغسلة</div>
                                    </div>
                                    <Switch
                                        checked={settings.enablePurchaseAlerts}
                                        onChange={(val) => setSettings(prev => ({ ...prev, enablePurchaseAlerts: val }))}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSaveSettings}
                                disabled={saving}
                                className="w-full py-3 rounded-xl bg-purple-500 text-white hover:bg-purple-600 flex items-center justify-center gap-2"
                            >
                                {saving ? <AdoraLoaderInline size={20} /> : <Save className="w-5 h-5" />}
                                حفظ الإعدادات
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {/* Settle Modal */}
            {showSettleModal && settleItem && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" style={{ backdropFilter: 'none' }}>
                    <div className="glass-card w-full max-w-sm p-6 space-y-4">
                        <h3 className="text-lg font-bold text-white">تسوية عجز: {settleItem.name}</h3>
                        <p className="text-white/60 text-sm">أدخل الكمية التي تم استردادها/إصلاحها من المغسلة.</p>

                        <div>
                            <label className="block text-sm text-white/60 mb-2">الكمية المستردة</label>
                            <input
                                type="number"
                                value={settleQuantity}
                                onChange={e => setSettleQuantity(Math.min(parseInt(e.target.value) || 0, settleItem.max))}
                                max={settleItem.max}
                                min={1}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white text-center text-xl font-bold border border-white/10 focus:border-green-500"
                            />
                            <p className="text-xs text-right mt-1 text-white/40">الحد الأقصى: {settleItem.max}</p>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setShowSettleModal(false)}
                                className="flex-1 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleSettleSubmit}
                                disabled={saving || settleQuantity <= 0}
                                className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 flex items-center justify-center gap-2"
                            >
                                {saving ? <AdoraLoaderInline size={16} /> : <Check className="w-4 h-4" />}
                                تأكيد التسوية
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default LaundryManagement;
