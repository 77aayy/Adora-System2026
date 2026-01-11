/**
 * Department Points Settings Component
 * Allows manager to configure points and grace days for each department
 * Adora Hotel Management System V3 - SaaS
 */

import React, { useState, useEffect } from 'react';
import {
    Settings, Save, Clock, Award, AlertTriangle, Zap,
    RefreshCw, Check, X, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { getPointsConfig, clearPointsConfigCache } from '../../services/pointsService';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

// ============================================================
// TYPES
// ============================================================

type DepartmentType = 'bellman' | 'housekeeping' | 'maintenance' | 'reception' | 'procurement' | 'coffeeshop';

interface DepartmentSettings {
    // Fast completion bonus
    fast: number;
    fastTime: number; // minutes
    
    // Normal completion
    complete: number;
    
    // Delay penalty
    delay: number;
    delayTime: number; // minutes
    
    // Grace days (for procurement)
    graceDays?: number;
    
    // Additional settings
    enabled: boolean;
}

interface PointsSettingsConfig {
    bellman: DepartmentSettings;
    housekeeping: DepartmentSettings;
    maintenance: DepartmentSettings;
    reception: DepartmentSettings;
    procurement: DepartmentSettings;
    coffeeshop: DepartmentSettings;
}

// ============================================================
// DEFAULTS
// ============================================================

const DEFAULT_SETTINGS: PointsSettingsConfig = {
    bellman: {
        fast: 2,
        fastTime: 10,
        complete: 1,
        delay: -1,
        delayTime: 20,
        enabled: true,
    },
    housekeeping: {
        fast: 2,
        fastTime: 25,
        complete: 1,
        delay: -1,
        delayTime: 30,
        enabled: true,
    },
    maintenance: {
        fast: 1,
        fastTime: 30,
        complete: 1,
        delay: -1,
        delayTime: 60,
        enabled: true,
    },
    reception: {
        fast: 1,
        fastTime: 3,
        complete: 1,
        delay: -1,
        delayTime: 5,
        enabled: true,
    },
    procurement: {
        fast: 2,
        fastTime: 1440, // 1 day in minutes
        complete: 1,
        delay: -2,
        delayTime: 2880, // 2 days
        graceDays: 1,
        enabled: true,
    },
    coffeeshop: {
        fast: 2,
        fastTime: 5,
        complete: 1,
        delay: -1,
        delayTime: 10,
        enabled: true,
    },
};

const DEPARTMENT_INFO: Record<DepartmentType, { label: string; icon: string; color: string; description: string }> = {
    bellman: {
        label: 'البيلمان',
        icon: '🧳',
        color: 'blue',
        description: 'نقاط إدخال وإخراج النزلاء والأمتعة',
    },
    housekeeping: {
        label: 'النظافة',
        icon: '🧹',
        color: 'green',
        description: 'نقاط تنظيف الغرف والفحص',
    },
    maintenance: {
        label: 'الصيانة',
        icon: '🔧',
        color: 'yellow',
        description: 'نقاط إتمام طلبات الصيانة',
    },
    reception: {
        label: 'الاستقبال',
        icon: '🛎️',
        color: 'purple',
        description: 'نقاط تأكيد وتوجيه الطلبات',
    },
    procurement: {
        label: 'المشتريات',
        icon: '🛒',
        color: 'orange',
        description: 'نقاط شراء واستلام الطلبات',
    },
    coffeeshop: {
        label: 'الكافي شوب',
        icon: '☕',
        color: 'amber',
        description: 'نقاط تحضير وتوصيل الطلبات',
    },
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const DepartmentPointsSettings: React.FC<{
    onClose?: () => void;
}> = ({ onClose }) => {
    const { tenantId } = useAuth();
    const { success, error, haptic } = useUX();
    
    const [settings, setSettings] = useState<PointsSettingsConfig>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expandedDept, setExpandedDept] = useState<DepartmentType | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    
    // Load current settings
    useEffect(() => {
        const loadSettings = async () => {
            if (!tenantId) return;
            
            try {
                const config = await getPointsConfig(tenantId);
                
                // Map loaded config to settings format
                const mapped: PointsSettingsConfig = {
                    bellman: {
                        fast: (config as any).bellman?.fast || DEFAULT_SETTINGS.bellman.fast,
                        fastTime: (config as any).bellman?.fastTime || DEFAULT_SETTINGS.bellman.fastTime,
                        complete: (config as any).bellman?.complete || DEFAULT_SETTINGS.bellman.complete,
                        delay: (config as any).bellman?.delay || DEFAULT_SETTINGS.bellman.delay,
                        delayTime: (config as any).bellman?.delayTime || DEFAULT_SETTINGS.bellman.delayTime,
                        enabled: (config as any).bellman?.enabled !== false,
                    },
                    housekeeping: {
                        fast: (config as any).housekeeping?.fast || DEFAULT_SETTINGS.housekeeping.fast,
                        fastTime: (config as any).housekeeping?.fastTime || DEFAULT_SETTINGS.housekeeping.fastTime,
                        complete: (config as any).housekeeping?.completeOccupied || DEFAULT_SETTINGS.housekeeping.complete,
                        delay: (config as any).housekeeping?.delay || DEFAULT_SETTINGS.housekeeping.delay,
                        delayTime: (config as any).housekeeping?.delayTime || DEFAULT_SETTINGS.housekeeping.delayTime,
                        enabled: (config as any).housekeeping?.enabled !== false,
                    },
                    maintenance: {
                        fast: (config as any).maintenance?.complete || DEFAULT_SETTINGS.maintenance.fast,
                        fastTime: DEFAULT_SETTINGS.maintenance.fastTime,
                        complete: (config as any).maintenance?.complete || DEFAULT_SETTINGS.maintenance.complete,
                        delay: DEFAULT_SETTINGS.maintenance.delay,
                        delayTime: DEFAULT_SETTINGS.maintenance.delayTime,
                        enabled: (config as any).maintenance?.enabled !== false,
                    },
                    reception: {
                        fast: 1,
                        fastTime: (config as any).reception?.targetConfirmationTime || DEFAULT_SETTINGS.reception.fastTime,
                        complete: (config as any).reception?.confirm || DEFAULT_SETTINGS.reception.complete,
                        delay: (config as any).reception?.lateConfirmationPenalty || DEFAULT_SETTINGS.reception.delay,
                        delayTime: (config as any).reception?.lateConfirmationTime || DEFAULT_SETTINGS.reception.delayTime,
                        enabled: (config as any).reception?.enabled !== false,
                    },
                    procurement: {
                        fast: (config as any).procurement?.early || DEFAULT_SETTINGS.procurement.fast,
                        fastTime: (config as any).procurement?.targetTime || DEFAULT_SETTINGS.procurement.fastTime,
                        complete: (config as any).procurement?.ontime || DEFAULT_SETTINGS.procurement.complete,
                        delay: (config as any).procurement?.delay || DEFAULT_SETTINGS.procurement.delay,
                        delayTime: ((config as any).procurement?.targetTime || DEFAULT_SETTINGS.procurement.fastTime) * 2,
                        graceDays: (config as any).procurement?.graceDays || DEFAULT_SETTINGS.procurement.graceDays,
                        enabled: (config as any).procurement?.enabled !== false,
                    },
                    coffeeshop: {
                        fast: (config as any).coffeeshop?.fast || DEFAULT_SETTINGS.coffeeshop.fast,
                        fastTime: (config as any).coffeeshop?.fastTime || DEFAULT_SETTINGS.coffeeshop.fastTime,
                        complete: (config as any).coffeeshop?.complete || DEFAULT_SETTINGS.coffeeshop.complete,
                        delay: (config as any).coffeeshop?.delay || DEFAULT_SETTINGS.coffeeshop.delay,
                        delayTime: (config as any).coffeeshop?.delayTime || DEFAULT_SETTINGS.coffeeshop.delayTime,
                        enabled: (config as any).coffeeshop?.enabled !== false,
                    },
                };
                
                setSettings(mapped);
            } catch (err) {
                console.error('Error loading points settings:', err);
            }
            setLoading(false);
        };
        
        loadSettings();
    }, [tenantId]);
    
    // Update department setting
    const updateDepartment = (dept: DepartmentType, field: keyof DepartmentSettings, value: number | boolean) => {
        setSettings(prev => ({
            ...prev,
            [dept]: {
                ...prev[dept],
                [field]: value,
            }
        }));
        setHasChanges(true);
    };
    
    // Save settings
    const saveSettings = async () => {
        if (!tenantId) return;
        
        setSaving(true);
        try {
            // Convert to Firebase format
            const firebaseConfig = {
                bellman: {
                    checkin: 1,
                    checkout: 1,
                    complete: settings.bellman.complete,
                    fast: settings.bellman.fast,
                    fastTime: settings.bellman.fastTime,
                    delay: settings.bellman.delay,
                    delayTime: settings.bellman.delayTime,
                    enabled: settings.bellman.enabled,
                },
                housekeeping: {
                    start: 1,
                    completeOccupied: settings.housekeeping.complete,
                    completeCheckout: settings.housekeeping.complete,
                    inspection: 1,
                    fast: settings.housekeeping.fast,
                    fastTime: settings.housekeeping.fastTime,
                    delay: settings.housekeeping.delay,
                    delayTime: settings.housekeeping.delayTime,
                    enabled: settings.housekeeping.enabled,
                },
                maintenance: {
                    complete: settings.maintenance.complete,
                    enabled: settings.maintenance.enabled,
                },
                reception: {
                    create: 2,
                    confirm: settings.reception.complete,
                    complete: 1,
                    targetConfirmationTime: settings.reception.fastTime,
                    lateConfirmationTime: settings.reception.delayTime,
                    lateConfirmationPenalty: settings.reception.delay,
                    veryLateConfirmationTime: settings.reception.delayTime * 2,
                    veryLateConfirmationPenalty: settings.reception.delay * 2,
                    enabled: settings.reception.enabled,
                },
                procurement: {
                    purchase: 1,
                    receive: 1,
                    early: settings.procurement.fast,
                    ontime: settings.procurement.complete,
                    delay: settings.procurement.delay,
                    targetTime: settings.procurement.fastTime,
                    graceDays: settings.procurement.graceDays,
                    enabled: settings.procurement.enabled,
                },
                coffeeshop: {
                    fast: settings.coffeeshop.fast,
                    fastTime: settings.coffeeshop.fastTime,
                    complete: settings.coffeeshop.complete,
                    delay: settings.coffeeshop.delay,
                    delayTime: settings.coffeeshop.delayTime,
                    enabled: settings.coffeeshop.enabled,
                },
            };
            
            const configRef = doc(db, `tenants/${tenantId}/settings/pointsConfig`);
            await setDoc(configRef, firebaseConfig, { merge: true });
            
            // Clear cache
            clearPointsConfigCache(tenantId);
            
            haptic('success');
            success('تم حفظ إعدادات النقاط بنجاح');
            setHasChanges(false);
        } catch (err) {
            console.error('Error saving points settings:', err);
            haptic('error');
            error('فشل حفظ الإعدادات');
        }
        setSaving(false);
    };
    
    // Format time display
    const formatTime = (minutes: number): string => {
        if (minutes < 60) return `${minutes} دقيقة`;
        if (minutes < 1440) return `${Math.round(minutes / 60)} ساعة`;
        return `${Math.round(minutes / 1440)} يوم`;
    };
    
    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                        <Settings className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">إعدادات النقاط</h2>
                        <p className="text-white/50 text-sm">تحكم في نظام النقاط لكل قسم</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <span className="text-yellow-400 text-sm flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            تغييرات غير محفوظة
                        </span>
                    )}
                    <button
                        onClick={saveSettings}
                        disabled={saving || !hasChanges}
                        className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                            hasChanges
                                ? 'bg-teal-500 text-white hover:bg-teal-400'
                                : 'bg-white/10 text-white/40 cursor-not-allowed'
                        }`}
                    >
                        {saving ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        حفظ
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-white/10 text-white/60 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
            
            {/* Departments */}
            <div className="space-y-3 p-4">
                {(Object.keys(DEPARTMENT_INFO) as DepartmentType[]).map(dept => {
                    const info = DEPARTMENT_INFO[dept];
                    const deptSettings = settings[dept];
                    const isExpanded = expandedDept === dept;
                    
                    return (
                        <div
                            key={dept}
                            className={`rounded-2xl border overflow-hidden transition-all ${
                                deptSettings.enabled
                                    ? `bg-${info.color}-500/10 border-${info.color}-500/30`
                                    : 'bg-white/5 border-white/10 opacity-50'
                            }`}
                        >
                            {/* Header */}
                            <div
                                className="flex items-center justify-between p-4 cursor-pointer"
                                onClick={() => setExpandedDept(isExpanded ? null : dept)}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{info.icon}</span>
                                    <div>
                                        <h3 className="text-white font-bold">{info.label}</h3>
                                        <p className="text-white/50 text-xs">{info.description}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    {/* Quick stats */}
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-green-400">+{deptSettings.fast}</span>
                                        <span className="text-white/30">/</span>
                                        <span className="text-red-400">{deptSettings.delay}</span>
                                    </div>
                                    
                                    {/* Enable toggle */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateDepartment(dept, 'enabled', !deptSettings.enabled);
                                        }}
                                        className={`w-12 h-6 rounded-full transition-colors ${
                                            deptSettings.enabled ? 'bg-teal-500' : 'bg-white/20'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                            deptSettings.enabled ? 'translate-x-6' : 'translate-x-0.5'
                                        }`} />
                                    </button>
                                    
                                    {isExpanded ? (
                                        <ChevronUp className="w-5 h-5 text-white/40" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-white/40" />
                                    )}
                                </div>
                            </div>
                            
                            {/* Expanded Settings */}
                            {isExpanded && deptSettings.enabled && (
                                <div className="p-4 pt-0 border-t border-white/10">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {/* Fast Points */}
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-sm text-white/60">
                                                <Zap className="w-4 h-4 text-green-400" />
                                                نقاط السرعة
                                            </label>
                                            <input
                                                type="number"
                                                value={deptSettings.fast}
                                                onChange={(e) => updateDepartment(dept, 'fast', parseInt(e.target.value) || 0)}
                                                className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 focus:border-green-500 focus:outline-none"
                                            />
                                        </div>
                                        
                                        {/* Fast Time */}
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-sm text-white/60">
                                                <Clock className="w-4 h-4 text-green-400" />
                                                وقت السرعة ({dept === 'procurement' ? 'ساعات' : 'دقائق'})
                                            </label>
                                            <input
                                                type="number"
                                                value={dept === 'procurement' ? Math.round(deptSettings.fastTime / 60) : deptSettings.fastTime}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    updateDepartment(dept, 'fastTime', dept === 'procurement' ? val * 60 : val);
                                                }}
                                                className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 focus:border-green-500 focus:outline-none"
                                            />
                                        </div>
                                        
                                        {/* Normal Points */}
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-sm text-white/60">
                                                <Award className="w-4 h-4 text-yellow-400" />
                                                نقاط الإتمام
                                            </label>
                                            <input
                                                type="number"
                                                value={deptSettings.complete}
                                                onChange={(e) => updateDepartment(dept, 'complete', parseInt(e.target.value) || 0)}
                                                className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 focus:border-yellow-500 focus:outline-none"
                                            />
                                        </div>
                                        
                                        {/* Delay Penalty */}
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-sm text-white/60">
                                                <AlertTriangle className="w-4 h-4 text-red-400" />
                                                خصم التأخير
                                            </label>
                                            <input
                                                type="number"
                                                value={Math.abs(deptSettings.delay)}
                                                onChange={(e) => updateDepartment(dept, 'delay', -Math.abs(parseInt(e.target.value) || 1))}
                                                className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 focus:border-red-500 focus:outline-none"
                                            />
                                        </div>
                                        
                                        {/* Delay Time */}
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-sm text-white/60">
                                                <Clock className="w-4 h-4 text-red-400" />
                                                وقت التأخير ({dept === 'procurement' ? 'ساعات' : 'دقائق'})
                                            </label>
                                            <input
                                                type="number"
                                                value={dept === 'procurement' ? Math.round(deptSettings.delayTime / 60) : deptSettings.delayTime}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    updateDepartment(dept, 'delayTime', dept === 'procurement' ? val * 60 : val);
                                                }}
                                                className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 focus:border-red-500 focus:outline-none"
                                            />
                                        </div>
                                        
                                        {/* Grace Days (Procurement only) */}
                                        {dept === 'procurement' && (
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-sm text-white/60">
                                                    <Info className="w-4 h-4 text-blue-400" />
                                                    أيام السماح
                                                </label>
                                                <input
                                                    type="number"
                                                    value={deptSettings.graceDays || 1}
                                                    onChange={(e) => updateDepartment(dept, 'graceDays' as any, parseInt(e.target.value) || 1)}
                                                    min={1}
                                                    max={30}
                                                    className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Preview */}
                                    <div className="mt-4 p-3 rounded-xl bg-black/20 text-sm text-white/60">
                                        <p>
                                            ⚡ سريع: إتمام قبل <strong className="text-green-400">{formatTime(deptSettings.fastTime)}</strong> = <strong className="text-green-400">+{deptSettings.fast}</strong> نقاط
                                        </p>
                                        <p>
                                            ⏱️ عادي: إتمام قبل <strong className="text-yellow-400">{formatTime(deptSettings.delayTime)}</strong> = <strong className="text-yellow-400">+{deptSettings.complete}</strong> نقطة
                                        </p>
                                        <p>
                                            ⚠️ متأخر: إتمام بعد <strong className="text-red-400">{formatTime(deptSettings.delayTime)}</strong> = <strong className="text-red-400">{deptSettings.delay}</strong> نقطة
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DepartmentPointsSettings;
