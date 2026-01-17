/**
 * Auto Transfer Settings
 * Configure automatic transfer rules for overdue requests
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import {
    RefreshCw, Save, Plus, Trash2, Clock, ArrowRight,
    Settings, AlertCircle, CheckCircle2, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { useTenant } from '../../context/TenantContext';
import {
    loadAutoTransferConfig,
    saveAutoTransferConfig,
    getDefaultRules,
    AutoTransferRule,
    AutoTransferConfig,
} from '../../services/autoTransferService';
import { logger } from '../../services/loggerService';

const DEPARTMENTS = [
    { value: 'reception', label: 'الاستقبال' },
    { value: 'housekeeping', label: 'النظافة' },
    { value: 'maintenance', label: 'الصيانة' },
    { value: 'bellman', label: 'البلمن' },
    { value: 'coffee_shop', label: 'الكوفي شوب' },
    { value: 'procurement', label: 'المشتريات' },
];

const REQUEST_TYPES = [
    { value: 'cleaning', label: 'تنظيف' },
    { value: 'maintenance', label: 'صيانة' },
    { value: 'bellman', label: 'بلمن' },
    { value: 'coffee', label: 'كوفي شوب' },
    { value: 'inspection', label: 'فحص' },
];

const SOURCES = [
    { value: 'qr', label: 'QR Code' },
    { value: 'reception', label: 'الاستقبال' },
    { value: 'guest', label: 'النزيل' },
];

export const AutoTransferSettings: React.FC = () => {
    const { user } = useAuth();
    const { success, error } = useUX();
    const { tenantId } = useTenant();

    const branchId = (user as any)?.branch || (user as any)?.branchId || 'default';

    // Initialize with default config immediately (no null state)
    const getDefaultConfig = (): AutoTransferConfig => ({
        enabled: false,
        checkIntervalMs: 60000,
        rules: getDefaultRules(),
        branch: (user as any)?.branch || (user as any)?.branchId || 'default',
        tenantId: tenantId || 'default',
    });

    const [config, setConfig] = useState<AutoTransferConfig>(getDefaultConfig());
    const [loading, setLoading] = useState(false); // Start as false since we have default config
    const [saving, setSaving] = useState(false);

    // Load config
    useEffect(() => {
        // Always create default config first for immediate display
        const currentBranchId = (user as any)?.branch || (user as any)?.branchId || 'default';
        const currentTenantId = tenantId || 'default';
        
        // Set default config immediately
        const defaultConfig: AutoTransferConfig = {
            enabled: false,
            checkIntervalMs: 60000,
            rules: getDefaultRules(),
            branch: currentBranchId,
            tenantId: currentTenantId,
        };
        setConfig(defaultConfig);
        setLoading(false);

        // If we have valid tenantId and branchId (not 'default'), try to load from Firebase
        if (tenantId && tenantId !== 'default' && branchId && branchId !== 'default') {

            const loadConfig = async () => {
                setLoading(true);
                try {
                    const loaded = await loadAutoTransferConfig(branchId, tenantId);
                    if (loaded) {
                        setConfig(loaded);
                    }
                    // If no loaded config, keep the default we already set
                } catch (err: any) {
                    logger.error('Error loading auto-transfer config', err, 'AutoTransferSettings');
                    // Keep default config on error - don't show error toast for missing config
                } finally {
                    setLoading(false);
                }
            };

            loadConfig();
        }
        // If no valid tenantId/branchId, config is already set to default above
    }, [branchId, tenantId, error, user]);

    // Save config
    const handleSave = async () => {
        if (!config) return;

        setSaving(true);
        try {
            await saveAutoTransferConfig(config);
            success('تم حفظ الإعدادات بنجاح');
        } catch (err: any) {
            logger.error('Error saving auto-transfer config', err, 'AutoTransferSettings');
            error('فشل حفظ الإعدادات: ' + (err.message || 'خطأ غير معروف'));
        } finally {
            setSaving(false);
        }
    };

    // Add new rule
    const handleAddRule = () => {
        if (!config) return;

        const newRule: AutoTransferRule = {
            fromDepartment: 'reception',
            toDepartment: 'housekeeping',
            timeoutMinutes: 10,
            enabled: true,
        };

        setConfig({
            ...config,
            rules: [...config.rules, newRule],
        });
    };

    // Update rule
    const handleUpdateRule = (index: number, updates: Partial<AutoTransferRule>) => {
        if (!config) return;

        const updatedRules = [...config.rules];
        updatedRules[index] = { ...updatedRules[index], ...updates };
        setConfig({ ...config, rules: updatedRules });
    };

    // Delete rule
    const handleDeleteRule = (index: number) => {
        if (!config) return;

        const updatedRules = config.rules.filter((_, i) => i !== index);
        setConfig({ ...config, rules: updatedRules });
    };

    // Show loading only while fetching from Firebase (config is always available now)
    if (loading) {
        return (
            <div className="px-4 sm:px-6 max-w-7xl mx-auto w-full flex items-center justify-center min-h-[400px]">
                <AdoraLoader size="md" message="جاري تحميل البيانات..." />
            </div>
        );
    }

    return (
        <div className="space-y-6 px-4 sm:px-6 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">التحويل التلقائي للطلبات</h2>
                    <p className="text-white/60 text-sm mt-1">
                        تحويل الطلبات تلقائياً: فوراً للأقسام المعطلة | بعد المدة المحددة للطلبات المتأخرة
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 rounded-xl bg-teal-500 text-white font-bold hover:bg-teal-600 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                    {saving ? (
                        <AdoraLoaderInline size={20} />
                    ) : (
                        <Save className="w-5 h-5" />
                    )}
                    حفظ
                </button>
            </div>

            {/* Enable/Disable */}
            <div className="glass-card p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-bold mb-1">تفعيل التحويل التلقائي</h3>
                        <p className="text-white/60 text-sm">تفعيل نظام التحويل التلقائي للطلبات المتأخرة</p>
                    </div>
                    <button
                        onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                        className={`relative w-14 h-8 rounded-full transition-colors ${
                            config.enabled ? 'bg-teal-500' : 'bg-white/20'
                        }`}
                    >
                        <span
                            className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform ${
                                config.enabled ? 'translate-x-6' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>
            </div>

            {/* Rules List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">قواعد التحويل</h3>
                    <button
                        onClick={handleAddRule}
                        className="px-4 py-2 rounded-xl bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        إضافة قاعدة
                    </button>
                </div>

                {config.rules.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <Settings className="w-16 h-16 text-white/20 mx-auto mb-4" />
                        <p className="text-white/40">لا توجد قواعد محددة</p>
                        <button
                            onClick={handleAddRule}
                            className="mt-4 px-6 py-3 rounded-xl bg-teal-500 text-white font-bold"
                        >
                            إضافة قاعدة جديدة
                        </button>
                    </div>
                ) : (
                    config.rules.map((rule, index) => (
                        <div key={index} className="glass-card p-4">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                                        <ArrowRight className="w-5 h-5 text-teal-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold">قاعدة #{index + 1}</h4>
                                        <p className="text-white/60 text-sm">
                                            من {DEPARTMENTS.find(d => d.value === rule.fromDepartment)?.label} إلى{' '}
                                            {DEPARTMENTS.find(d => d.value === rule.toDepartment)?.label}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleUpdateRule(index, { enabled: !rule.enabled })}
                                        className={`w-12 h-6 rounded-full transition-colors ${
                                            rule.enabled ? 'bg-green-500' : 'bg-white/20'
                                        }`}
                                    >
                                        <span
                                            className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                                                rule.enabled ? 'translate-x-6' : 'translate-x-0.5'
                                            }`}
                                        />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteRule(index)}
                                        className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Rule Configuration */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* From Department */}
                                <div>
                                    <label className="block text-white/60 text-sm mb-2">من القسم</label>
                                    <select
                                        value={rule.fromDepartment}
                                        onChange={(e) => handleUpdateRule(index, { fromDepartment: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    >
                                        {DEPARTMENTS.map(dept => (
                                            <option key={dept.value} value={dept.value} className="bg-slate-800">
                                                {dept.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* To Department */}
                                <div>
                                    <label className="block text-white/60 text-sm mb-2">إلى القسم الاحتياطي</label>
                                    <select
                                        value={rule.toDepartment}
                                        onChange={(e) => handleUpdateRule(index, { toDepartment: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    >
                                        {DEPARTMENTS.filter(d => d.value !== rule.fromDepartment).map(dept => (
                                            <option key={dept.value} value={dept.value} className="bg-slate-800">
                                                {dept.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Timeout */}
                                <div>
                                    <label className="block text-white/60 text-sm mb-2 flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        المدة قبل التحويل (دقيقة)
                                    </label>
                                    <input
                                        type="number"
                                        value={rule.timeoutMinutes}
                                        onChange={(e) => handleUpdateRule(index, { timeoutMinutes: parseInt(e.target.value) || 10 })}
                                        className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                        min="1"
                                    />
                                </div>

                                {/* Request Types Filter (Optional) */}
                                <div>
                                    <label className="block text-white/60 text-sm mb-2">نوع الطلب (اختياري)</label>
                                    <select
                                        value={rule.requestTypes?.[0] || 'all'}
                                        onChange={(e) => {
                                            if (e.target.value === 'all') {
                                                handleUpdateRule(index, { requestTypes: undefined });
                                            } else {
                                                handleUpdateRule(index, { requestTypes: [e.target.value] });
                                            }
                                        }}
                                        className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    >
                                        <option value="all" className="bg-slate-800">جميع الأنواع</option>
                                        {REQUEST_TYPES.map(type => (
                                            <option key={type.value} value={type.value} className="bg-slate-800">
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Sources Filter (Optional) */}
                                <div>
                                    <label className="block text-white/60 text-sm mb-2">مصدر الطلب (اختياري)</label>
                                    <select
                                        value={rule.sources?.[0] || 'all'}
                                        onChange={(e) => {
                                            if (e.target.value === 'all') {
                                                handleUpdateRule(index, { sources: undefined });
                                            } else {
                                                handleUpdateRule(index, { sources: [e.target.value] });
                                            }
                                        }}
                                        className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    >
                                        <option value="all" className="bg-slate-800">جميع المصادر</option>
                                        {SOURCES.map(source => (
                                            <option key={source.value} value={source.value} className="bg-slate-800">
                                                {source.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Info */}
            <div className="glass-card p-4 bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-blue-400 font-bold mb-1">كيف يعمل التحويل التلقائي؟</h4>
                        <ul className="text-white/60 text-sm space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="text-teal-400 font-bold">✓</span>
                                <span><strong>تحويل فوري للأقسام المعطلة:</strong> إذا وصل طلب لقسم غير مفعل (مثل الكافي شوب)، يتم تحويله فوراً إلى القسم البديل المحدد في القاعدة.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-teal-400 font-bold">✓</span>
                                <span><strong>تحويل للطلبات المتأخرة:</strong> النظام يراقب الطلبات النشطة، وعند وصول المدة المحددة بدون استجابة، يتم التحويل تلقائياً.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-teal-400 font-bold">✓</span>
                                <span>يتم تسجيل جميع التحويلات في سجل الطلب وملاحظاته للشفافية والتدقيق.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-teal-400 font-bold">✓</span>
                                <span>يمكن تحديد أنواع طلبات معينة أو مصادر معينة (QR، استقبال، إلخ) للتحويل.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutoTransferSettings;
