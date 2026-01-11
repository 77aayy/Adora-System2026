/**
 * Chat Settings Page (إعدادات الشات للمدير)
 * صفحة إعداد البوت والخيارات السريعة وSLA
 * 
 * ✅ Features:
 * - Welcome message customization
 * - Quick options management (CRUD)
 * - SLA time configuration
 * - Preview mode
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import {
    MessageCircle,
    Save,
    Plus,
    Trash2,
    Edit3,
    GripVertical,
    Clock,
    Check,
    Forward,
    Eye,
    X,
    Settings,
    AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
    ChatSettings,
    QuickOption,
    getChatSettings,
    updateChatSettings,
    saveQuickOption
} from '../../services/smartChatService';
import { haptic, playSound } from '../../utils/uxEffects';

// ============================================================
// TYPES
// ============================================================

interface ChatSettingsPageProps {
    tenantId: string;
}

// ============================================================
// QUICK OPTION EDITOR
// ============================================================

interface QuickOptionEditorProps {
    option?: QuickOption;
    onSave: (option: QuickOption) => void;
    onCancel: () => void;
}

const QuickOptionEditor: React.FC<QuickOptionEditorProps> = ({
    option,
    onSave,
    onCancel
}) => {
    const [formData, setFormData] = useState<Partial<QuickOption>>(
        option || {
            id: `opt_${Date.now()}`,
            label: '',
            labelEn: '',
            icon: '📋',
            type: 'approval',
            forwardTo: '',
            autoResponse: '',
            isActive: true,
            order: 99
        }
    );

    const ICONS = ['📋', '🕐', '📅', '🧹', '🔧', '🛎️', '🍽️', '☕', '🧺', '💬', '❓', '⭐'];
    const DEPARTMENTS = [
        { id: 'housekeeping', label: 'النظافة' },
        { id: 'maintenance', label: 'الصيانة' },
        { id: 'bellman', label: 'البيلمان' },
        { id: 'coffee', label: 'خدمة الغرف' }
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.label) return;
        onSave(formData as QuickOption);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-xl p-4 border border-white/10">
            <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-teal-400" />
                {option ? 'تعديل الخيار' : 'إضافة خيار جديد'}
            </h4>

            <div className="space-y-4">
                {/* Icon Selection */}
                <div>
                    <label className="block text-white/60 text-sm mb-2">الأيقونة:</label>
                    <div className="flex flex-wrap gap-2">
                        {ICONS.map(icon => (
                            <button
                                key={icon}
                                type="button"
                                onClick={() => setFormData(f => ({ ...f, icon }))}
                                className={`w-10 h-10 rounded-lg text-xl transition-all ${
                                    formData.icon === icon
                                        ? 'bg-teal-500/20 border-2 border-teal-500'
                                        : 'bg-white/10 border border-transparent hover:border-white/30'
                                }`}
                            >
                                {icon}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Labels */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-white/60 text-sm mb-2">العنوان (عربي): *</label>
                        <input
                            type="text"
                            value={formData.label || ''}
                            onChange={(e) => setFormData(f => ({ ...f, label: e.target.value }))}
                            placeholder="مثال: خروج متأخر"
                            className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2
                                       text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/50"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-white/60 text-sm mb-2">العنوان (إنجليزي):</label>
                        <input
                            type="text"
                            value={formData.labelEn || ''}
                            onChange={(e) => setFormData(f => ({ ...f, labelEn: e.target.value }))}
                            placeholder="e.g. Late Checkout"
                            className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2
                                       text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/50"
                        />
                    </div>
                </div>

                {/* Type */}
                <div>
                    <label className="block text-white/60 text-sm mb-2">نوع الخيار:</label>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData(f => ({ ...f, type: 'approval' }))}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${
                                formData.type === 'approval'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                        >
                            <Check className="w-4 h-4" />
                            <span>موافقة فورية</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData(f => ({ ...f, type: 'forward' }))}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${
                                formData.type === 'forward'
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                        >
                            <Forward className="w-4 h-4" />
                            <span>توجيه للقسم</span>
                        </button>
                    </div>
                </div>

                {/* Forward To (if type is forward) */}
                {formData.type === 'forward' && (
                    <div>
                        <label className="block text-white/60 text-sm mb-2">توجيه إلى:</label>
                        <div className="flex flex-wrap gap-2">
                            {DEPARTMENTS.map(dept => (
                                <button
                                    key={dept.id}
                                    type="button"
                                    onClick={() => setFormData(f => ({ ...f, forwardTo: dept.id }))}
                                    className={`px-4 py-2 rounded-lg text-sm transition-all ${
                                        formData.forwardTo === dept.id
                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                                    }`}
                                >
                                    {dept.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Auto Response */}
                <div>
                    <label className="block text-white/60 text-sm mb-2">الرد التلقائي للنزيل:</label>
                    <textarea
                        value={formData.autoResponse || ''}
                        onChange={(e) => setFormData(f => ({ ...f, autoResponse: e.target.value }))}
                        placeholder="مثال: تم استلام طلبكم وسيتم الرد قريباً..."
                        className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2
                                   text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/50
                                   resize-none h-20"
                        dir="rtl"
                    />
                </div>

                {/* Active Toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData(f => ({ ...f, isActive: e.target.checked }))}
                        className="w-5 h-5 rounded bg-white/10 border-white/20 text-teal-500 focus:ring-teal-500/50"
                    />
                    <span className="text-white/70">مفعّل للنزلاء</span>
                </label>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
                    >
                        إلغاء
                    </button>
                    <button
                        type="submit"
                        className="flex-1 py-2 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 transition-colors
                                   flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        حفظ
                    </button>
                </div>
            </div>
        </form>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ChatSettingsPage: React.FC<ChatSettingsPageProps> = ({ tenantId }) => {
    const { user } = useAuth();
    
    // State
    const [settings, setSettings] = useState<ChatSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingOption, setEditingOption] = useState<QuickOption | null>(null);
    const [showAddOption, setShowAddOption] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // Form state
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [welcomeMessageEn, setWelcomeMessageEn] = useState('');
    const [slaMinutes, setSlaMinutes] = useState(5);

    // ============================================================
    // LOAD DATA
    // ============================================================

    useEffect(() => {
        loadSettings();
    }, [tenantId]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const data = await getChatSettings(tenantId);
            setSettings(data);
            setWelcomeMessage(data.welcomeMessage || '');
            setWelcomeMessageEn(data.welcomeMessageEn || '');
            setSlaMinutes(data.slaMinutes || 5);
        } catch (error) {
            console.error('Error loading chat settings:', error);
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // ACTIONS
    // ============================================================

    const handleSaveGeneral = async () => {
        setSaving(true);
        haptic('medium');

        try {
            await updateChatSettings(tenantId, {
                welcomeMessage,
                welcomeMessageEn,
                slaMinutes
            });
            playSound('success');
        } catch (error) {
            console.error('Error saving settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveOption = async (option: QuickOption) => {
        try {
            const updatedOptions = settings?.quickOptions || [];
            const existingIndex = updatedOptions.findIndex(o => o.id === option.id);
            
            if (existingIndex >= 0) {
                updatedOptions[existingIndex] = option;
            } else {
                updatedOptions.push({ ...option, order: updatedOptions.length + 1 });
            }

            await updateChatSettings(tenantId, { quickOptions: updatedOptions });
            
            setSettings(s => s ? { ...s, quickOptions: updatedOptions } : null);
            setEditingOption(null);
            setShowAddOption(false);
            playSound('success');
            haptic('success');
        } catch (error) {
            console.error('Error saving option:', error);
        }
    };

    const handleDeleteOption = async (optionId: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا الخيار؟')) return;

        try {
            const updatedOptions = (settings?.quickOptions || []).filter(o => o.id !== optionId);
            await updateChatSettings(tenantId, { quickOptions: updatedOptions });
            setSettings(s => s ? { ...s, quickOptions: updatedOptions } : null);
            playSound('pop');
        } catch (error) {
            console.error('Error deleting option:', error);
        }
    };

    const handleToggleOption = async (optionId: string) => {
        const updatedOptions = (settings?.quickOptions || []).map(o =>
            o.id === optionId ? { ...o, isActive: !o.isActive } : o
        );

        await updateChatSettings(tenantId, { quickOptions: updatedOptions });
        setSettings(s => s ? { ...s, quickOptions: updatedOptions } : null);
        haptic('light');
    };

    // ============================================================
    // RENDER
    // ============================================================

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center">
                        <Settings className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">إعدادات الشات</h1>
                        <p className="text-white/60 text-sm">تخصيص البوت والخيارات السريعة</p>
                    </div>
                </div>

                <button
                    onClick={() => setShowPreview(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white/70
                               hover:bg-white/20 transition-colors"
                >
                    <Eye className="w-4 h-4" />
                    معاينة
                </button>
            </div>

            {/* Section 1: Welcome Message */}
            <div className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-teal-400" />
                        رسالة الترحيب
                    </h3>
                    <p className="text-white/50 text-sm mt-1">
                        هذه الرسالة تظهر للنزيل أول ما يفتح الشات
                    </p>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-white/60 text-sm mb-2">الرسالة بالعربي:</label>
                        <textarea
                            value={welcomeMessage}
                            onChange={(e) => setWelcomeMessage(e.target.value)}
                            placeholder="مرحباً بك في فندق أدورا! كيف يمكننا مساعدتك؟"
                            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                                       text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/50
                                       resize-none h-24"
                            dir="rtl"
                        />
                    </div>

                    <div>
                        <label className="block text-white/60 text-sm mb-2">الرسالة بالإنجليزي:</label>
                        <textarea
                            value={welcomeMessageEn}
                            onChange={(e) => setWelcomeMessageEn(e.target.value)}
                            placeholder="Welcome to Adora Hotel! How can we help you?"
                            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                                       text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/50
                                       resize-none h-24"
                        />
                    </div>
                </div>
            </div>

            {/* Section 2: SLA Configuration */}
            <div className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-400" />
                        وقت الاستجابة (SLA)
                    </h3>
                    <p className="text-white/50 text-sm mt-1">
                        بعد هذا الوقت، يتم تنبيه المدير وتلوين الطلب بالأحمر
                    </p>
                </div>

                <div className="p-4">
                    <div className="flex items-center gap-4">
                        <input
                            type="number"
                            min={1}
                            max={30}
                            value={slaMinutes}
                            onChange={(e) => setSlaMinutes(Number(e.target.value))}
                            className="w-24 bg-white/10 border border-white/10 rounded-xl px-4 py-3
                                       text-white text-center text-xl font-bold focus:outline-none focus:border-amber-500/50"
                        />
                        <span className="text-white/60">دقيقة</span>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 rounded-lg p-3">
                        <AlertTriangle className="w-4 h-4" />
                        <span>لو الطلب ما اتجاوبش خلال {slaMinutes} دقائق، هيظهر تنبيه للمدير</span>
                    </div>
                </div>
            </div>

            {/* Section 3: Quick Options */}
            <div className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <GripVertical className="w-5 h-5 text-purple-400" />
                            الخيارات السريعة
                        </h3>
                        <p className="text-white/50 text-sm mt-1">
                            الأزرار اللي بتظهر للنزيل يختار منها
                        </p>
                    </div>

                    <button
                        onClick={() => setShowAddOption(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white
                                   hover:bg-teal-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        إضافة
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    {(showAddOption || editingOption) && (
                        <QuickOptionEditor
                            option={editingOption || undefined}
                            onSave={handleSaveOption}
                            onCancel={() => {
                                setShowAddOption(false);
                                setEditingOption(null);
                            }}
                        />
                    )}

                    {settings?.quickOptions?.map(option => (
                        <div
                            key={option.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                option.isActive
                                    ? 'bg-white/5 border-white/10'
                                    : 'bg-white/[0.02] border-white/5 opacity-50'
                            }`}
                        >
                            <span className="text-2xl">{option.icon}</span>
                            
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-medium">{option.label}</p>
                                <p className="text-white/50 text-xs">
                                    {option.type === 'approval' ? '✅ موافقة فورية' : `➡️ توجيه: ${option.forwardTo}`}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleToggleOption(option.id)}
                                    className={`w-10 h-6 rounded-full transition-colors ${
                                        option.isActive ? 'bg-teal-500' : 'bg-white/20'
                                    }`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                        option.isActive ? 'translate-x-5' : 'translate-x-1'
                                    }`} />
                                </button>

                                <button
                                    onClick={() => setEditingOption(option)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => handleDeleteOption(option.id)}
                                    className="p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {(!settings?.quickOptions || settings.quickOptions.length === 0) && !showAddOption && (
                        <div className="text-center text-white/40 py-8">
                            لم يتم إضافة خيارات بعد
                        </div>
                    )}
                </div>
            </div>

            {/* Save Button */}
            <button
                onClick={handleSaveGeneral}
                disabled={saving}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold
                           hover:from-teal-400 hover:to-cyan-400 transition-all disabled:opacity-50
                           flex items-center justify-center gap-2 shadow-lg shadow-teal-500/30"
            >
                {saving ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        جاري الحفظ...
                    </>
                ) : (
                    <>
                        <Save className="w-5 h-5" />
                        حفظ الإعدادات
                    </>
                )}
            </button>

            {/* Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-white font-bold">معاينة الشات</h3>
                            <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-white/10 rounded-lg">
                                <X className="w-5 h-5 text-white/60" />
                            </button>
                        </div>
                        <div className="p-4">
                            {/* Bot Message */}
                            <div className="bg-purple-500/20 rounded-2xl rounded-bl-sm px-4 py-3 mb-4">
                                <p className="text-white whitespace-pre-wrap">{welcomeMessage}</p>
                            </div>

                            {/* Quick Options */}
                            <p className="text-white/50 text-xs mb-2 text-center">اختر من القائمة:</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {settings?.quickOptions?.filter(o => o.isActive).map(option => (
                                    <div
                                        key={option.id}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 text-white text-sm"
                                    >
                                        <span>{option.icon}</span>
                                        <span>{option.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatSettingsPage;
