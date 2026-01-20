/**
 * WhatsApp Templates Manager
 * Allows manager to create and manage WhatsApp message templates
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import {
    MessageCircle, Plus, Trash2, Edit2, Save, X, AlertCircle, Zap,
    Calendar, Clock, Info, Eye, Copy
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useTenant } from '../../context/TenantContext';
import { useTranslation } from 'react-i18next';
import {
    subscribeToAllTemplates,
    createWhatsAppTemplate,
    updateWhatsAppTemplate,
    deactivateWhatsAppTemplate,
    getDefaultTemplates,
    fillTemplate,
    type WhatsAppTemplate,
    type TemplateVariable
} from '../../services/whatsappTemplatesService';
import { Timestamp } from 'firebase/firestore';

export const WhatsAppTemplatesManager: React.FC = () => {
    const { user } = useAuth();
    const { success, error } = useUX();
    const { tenantId } = useTenant();
    const branchId = (user as any)?.branchId || (user as any)?.branch;

    const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
    const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplate | null>(null);

    // Form state
    const [formData, setFormData] = useState<Partial<WhatsAppTemplate>>({
        name: '',
        nameAr: '',
        description: '',
        messageFormat: '',
        messageFormatAr: '',
        variables: [],
        category: '',
        priority: 'medium',
        isActive: true,
        branchId: branchId
    });

    useEffect(() => {
        if (!user || !tenantId) return;
        const isManager = ['manager', 'owner', 'admin'].includes(user.role || '');

        if (!isManager) return;

        const unsubscribe = subscribeToAllTemplates(tenantId, (templatesList) => {
            setTemplates(templatesList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, tenantId]);

    const handleEdit = (template: WhatsAppTemplate) => {
        setFormData(template);
        setEditingTemplate(template);
        setShowModal(true);
    };

    const handleDelete = async (templateId: string) => {
        if (!confirm(t('admin.deleteTemplateConfirm') || 'هل أنت متأكد من حذف هذا النموذج؟')) return;
        if (!tenantId) return;
        try {
            await deactivateWhatsAppTemplate(tenantId, templateId);
            success(t('admin.deleteSuccess') || 'تم الحذف بنجاح');
        } catch (err) {
            error('فشل حذف النموذج');
        }
    };

    const handlePreview = (template: WhatsAppTemplate) => {
        setPreviewTemplate(template);
    };

    const handleSave = async () => {
        if (!user || !tenantId || !formData.nameAr?.trim() || !formData.messageFormatAr?.trim()) {
            error('يرجى إدخال الاسم وصيغة الرسالة');
            return;
        }

        try {
            if (editingTemplate) {
                await updateWhatsAppTemplate(
                    tenantId,
                    editingTemplate.id,
                    formData as Partial<WhatsAppTemplate>,
                    user.id,
                    user.name || ''
                );
                success('تم تحديث النموذج');
            } else {
                await createWhatsAppTemplate(
                    tenantId,
                    formData as Omit<WhatsAppTemplate, 'id' | 'createdAt' | 'tenantId' | 'createdBy'>,
                    user.id,
                    user.name || ''
                );
                success('تم إضافة النموذج');
            }
            setShowModal(false);
            setFormData({
                name: '',
                nameAr: '',
                description: '',
                messageFormat: '',
                messageFormatAr: '',
                variables: [],
                category: '',
                priority: 'medium',
                isActive: true,
                branchId: branchId
            });
        } catch (err) {
            error('فشل حفظ النموذج');
        }
    };

    const handleLoadDefaults = async () => {
        if (!user || !tenantId) return;
        const defaultTemplates = getDefaultTemplates();
        
        try {
            for (const template of defaultTemplates) {
                await createWhatsAppTemplate(
                    tenantId,
                    template,
                    user.id,
                    user.name || ''
                );
            }
            success('تم تحميل النماذج الافتراضية');
        } catch (err) {
            error('فشل تحميل النماذج الافتراضية');
        }
    };

    const addVariable = () => {
        const newVar: TemplateVariable = {
            key: '',
            label: '',
            labelAr: '',
            type: 'text',
            required: false
        };
        setFormData({
            ...formData,
            variables: [...(formData.variables || []), newVar]
        });
    };

    const updateVariable = (index: number, updates: Partial<TemplateVariable>) => {
        const vars = [...(formData.variables || [])];
        vars[index] = { ...vars[index], ...updates };
        setFormData({ ...formData, variables: vars });
    };

    const removeVariable = (index: number) => {
        const vars = [...(formData.variables || [])];
        vars.splice(index, 1);
        setFormData({ ...formData, variables: vars });
    };

    if (loading) return null;

    return (
        <>
            <div className="min-h-screen theme-page p-6">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                <MessageCircle className="w-6 h-6 text-green-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">نماذج رسائل WhatsApp</h1>
                                <p className="text-sm text-white/60">إدارة النماذج التي يستخدمها موظفو الاستقبال لإرسال الرسائل</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {templates.length === 0 && (
                                <button
                                    onClick={handleLoadDefaults}
                                    className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors border border-blue-500/30"
                                >
                                    تحميل نماذج افتراضية
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setEditingTemplate(null);
                                    setFormData({
                                        name: '',
                                        nameAr: '',
                                        description: '',
                                        messageFormat: '',
                                        messageFormatAr: '',
                                        variables: [],
                                        category: '',
                                        priority: 'medium',
                                        isActive: true,
                                        branchId: branchId
                                    });
                                    setShowModal(true);
                                }}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-bold hover:shadow-lg hover:shadow-green-500/25 transition-all flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                نموذج جديد
                            </button>
                        </div>
                    </div>

                    {/* Templates List */}
                    <div className="space-y-4">
                        {templates.length === 0 ? (
                            <div className="text-center py-12 text-white/40">
                                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <p>لا توجد نماذج</p>
                                <p className="text-xs mt-1">استخدم "تحميل نماذج افتراضية" أو أضف نموذج مخصص</p>
                            </div>
                        ) : (
                            templates.map(template => (
                                <div
                                    key={template.id}
                                    className="glass-card p-4 rounded-xl border border-white/10 hover:border-green-500/30 transition-all"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                                <MessageCircle className="w-5 h-5 text-green-400" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-white font-semibold mb-1">{template.nameAr || template.name}</h3>
                                                {template.description && (
                                                    <p className="text-white/60 text-sm">{template.description}</p>
                                                )}
                                                {template.category && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-white/10 text-white/60 text-xs mt-1 inline-block">
                                                        {template.category}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handlePreview(template)}
                                                className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                                title="معاينة"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(template)}
                                                className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(template.id)}
                                                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 pt-3 border-t border-white/10 text-xs text-white/40">
                                        <span className={template.isActive ? 'text-green-400' : 'text-red-400'}>
                                            {template.isActive ? t('common.active') : t('common.inactive')}
                                        </span>
                                        {template.variables && template.variables.length > 0 && (
                                            <span>متغيرات: {template.variables.length}</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Template Modal */}
            {showModal && (
                <TemplateModal
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSave}
                    onClose={() => {
                        setShowModal(false);
                        setEditingTemplate(null);
                    }}
                    addVariable={addVariable}
                    updateVariable={updateVariable}
                    removeVariable={removeVariable}
                />
            )}

            {/* Preview Modal */}
            {previewTemplate && (
                <PreviewModal
                    template={previewTemplate}
                    onClose={() => setPreviewTemplate(null)}
                />
            )}
        </>
    );
};

// Template Modal Component
const TemplateModal: React.FC<{
    formData: Partial<WhatsAppTemplate>;
    setFormData: (data: Partial<WhatsAppTemplate>) => void;
    onSave: () => void;
    onClose: () => void;
    addVariable: () => void;
    updateVariable: (index: number, updates: Partial<TemplateVariable>) => void;
    removeVariable: (index: number) => void;
}> = ({ formData, setFormData, onSave, onClose, addVariable, updateVariable, removeVariable }) => {
    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 3xl:p-8">
            <div className="glass-card w-full max-w-lg sm:max-w-2xl lg:max-w-3xl 3xl:max-w-5xl 4xl:max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl 3xl:rounded-3xl modal-enter">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">إضافة/تعديل نموذج</h2>
                        <button onClick={onClose} className="text-white/60 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">الاسم (عرض في القائمة) *</label>
                                <input
                                    type="text"
                                    value={formData.nameAr || ''}
                                    onChange={e => setFormData({ ...formData, nameAr: e.target.value })}
                                    placeholder="تسجيل خروج"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-green-500/50 focus:outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">الاسم (إنجليزي)</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Checkout Notice"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-green-500/50 focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">الوصف (اختياري)</label>
                            <input
                                type="text"
                                value={formData.description || ''}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="تنبيه بتسجيل الخروج"
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-green-500/50 focus:outline-none transition-all"
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">الفئة (اختياري)</label>
                            <input
                                type="text"
                                value={formData.category || ''}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                placeholder="checkout, extension, contract, smoking"
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-green-500/50 focus:outline-none transition-all"
                            />
                        </div>

                        {/* Message Format */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">صيغة الرسالة (عربي) *</label>
                            <textarea
                                value={formData.messageFormatAr || ''}
                                onChange={e => setFormData({ ...formData, messageFormatAr: e.target.value })}
                                placeholder="عاملنا العزيز {guestName} غرفة رقم {roomNumber} في فرع فندق {branchName} رقم {branchNumber} نعلمكم أن {customText}"
                                rows={6}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white resize-none focus:border-green-500/50 focus:outline-none transition-all font-mono text-sm"
                            />
                            <p className="text-xs text-white/40 mt-1">
                                المتغيرات المتاحة: {'{guestName}'}, {'{roomNumber}'}, {'{branchName}'}, {'{branchNumber}'}, {'{customText}'}
                            </p>
                        </div>

                        {/* Variables */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="block text-sm text-white/60">المتغيرات الديناميكية</label>
                                <button
                                    onClick={addVariable}
                                    className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors text-sm"
                                >
                                    + إضافة متغير
                                </button>
                            </div>
                            <div className="space-y-2">
                                {formData.variables?.map((variable, index) => (
                                    <div key={index} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="text"
                                                value={variable.key}
                                                onChange={e => updateVariable(index, { key: e.target.value })}
                                                placeholder="checkoutTime (المفتاح)"
                                                className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:border-green-500/50 focus:outline-none"
                                            />
                                            <input
                                                type="text"
                                                value={variable.labelAr}
                                                onChange={e => updateVariable(index, { labelAr: e.target.value })}
                                                placeholder="وقت تسجيل الخروج (التسمية)"
                                                className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:border-green-500/50 focus:outline-none"
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <select
                                                value={variable.type}
                                                onChange={e => updateVariable(index, { type: e.target.value as any })}
                                                className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:border-green-500/50 focus:outline-none"
                                            >
                                                <option value="text">نص</option>
                                                <option value="time">وقت</option>
                                                <option value="date">تاريخ</option>
                                                <option value="datetime">تاريخ ووقت</option>
                                                <option value="number">رقم</option>
                                            </select>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={variable.required}
                                                    onChange={e => updateVariable(index, { required: e.target.checked })}
                                                    className="rounded"
                                                />
                                                <span className="text-white/60 text-sm">مطلوب</span>
                                            </label>
                                            <button
                                                onClick={() => removeVariable(index)}
                                                className="px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                                            >
                                                حذف
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">الأولوية</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'low', label: 'منخفضة', color: 'blue' },
                                    { value: 'medium', label: 'متوسطة', color: 'yellow' },
                                    { value: 'high', label: 'عالية', color: 'red' }
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setFormData({ ...formData, priority: opt.value as any })}
                                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                            formData.priority === opt.value
                                                ? `bg-${opt.color}-500/20 text-${opt.color}-400 border border-${opt.color}-500/30`
                                                : 'bg-white/10 text-white/60 border border-white/10 hover:bg-white/20'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Active Status */}
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm text-white/60">نشط</span>
                                <button
                                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${formData.isActive
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : 'bg-white/10 text-white/60 border border-white/10'
                                        }`}
                                >
                                    {formData.isActive ? t('common.active') : t('common.disabled')}
                                </button>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4 border-t border-white/10">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={onSave}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-bold hover:shadow-lg hover:shadow-green-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                {formData.id ? t('common.update') : t('common.save')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Preview Modal Component
const PreviewModal: React.FC<{
    template: WhatsAppTemplate;
    onClose: () => void;
}> = ({ template, onClose }) => {
    const previewMessage = fillTemplate(template, {
        guestFirstName: 'أحمد',
        roomNumber: '101',
        branchName: 'فرع الرياض',
        branchNumber: '1',
        checkoutTime: '2:00 PM',
        extensionDate: '2024-01-15',
        customText: 'تسجيل خروجك اليوم الساعة 2:00 PM'
    });

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-2xl rounded-2xl modal-enter">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">معاينة النموذج</h2>
                        <button onClick={onClose} className="text-white/60 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h3 className="text-white font-semibold mb-2">{template.nameAr || template.name}</h3>
                            <p className="text-white/80 whitespace-pre-wrap leading-relaxed p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                                {previewMessage}
                            </p>
                        </div>

                        {template.variables && template.variables.length > 0 && (
                            <div>
                                <h3 className="text-white font-semibold mb-2">المتغيرات المطلوبة:</h3>
                                <div className="space-y-2">
                                    {template.variables.map((variable, idx) => (
                                        <div key={idx} className="p-2 rounded-lg bg-white/5 text-white/60 text-sm">
                                            • {variable.labelAr} ({variable.type}) {variable.required && <span className="text-red-400">*</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={onClose}
                            className="w-full py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                        >
                            إغلاق
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
