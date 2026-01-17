/**
 * Rating Templates Manager
 * Allows managers to customize rating forms
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import {
    Star, Plus, Trash2, Edit2, Save, X, AlertTriangle,
    RefreshCw, ChevronDown, ChevronUp, MoveUp, MoveDown,
    Palette, Settings, Clock, Sparkles
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useUX } from '../../context/UXContext';
import { useAuth } from '../../context/AuthContext';
import {
    getRatingTemplates,
    createRatingTemplate,
    updateRatingTemplate,
    deleteRatingTemplate,
    getDefaultRatingTemplate,
    type RatingTemplate,
    type RatingQuestion
} from '../../services/ratingService';
import { logger } from '../../services/loggerService';

interface RatingTemplatesManagerProps {
    branchId: string;
    branchName: string;
}

export const RatingTemplatesManager: React.FC<RatingTemplatesManagerProps> = ({ branchId, branchName }) => {
    const { tenantId } = useTenant();
    const { success, error } = useUX();
    const { user } = useAuth();

    const [templates, setTemplates] = useState<RatingTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<RatingTemplate | null>(null);

    // Form state
    const [formData, setFormData] = useState<Partial<RatingTemplate>>({
        name: '',
        nameAr: '',
        description: '',
        primaryColor: '#10b981',
        backgroundColor: '#0f172a',
        icon: '⭐',
        title: '',
        titleAr: '',
        subtitle: '',
        subtitleAr: '',
        triggerEvent: 'checkout',
        autoShow: true,
        delaySeconds: 5,
        requireAllQuestions: false,
        isActive: true,
        questions: [],
        order: 0
    });

    useEffect(() => {
        loadTemplates();
    }, [tenantId, branchId]);

    const loadTemplates = async () => {
        if (!tenantId || !branchId) return;
        setLoading(true);
        try {
            const loaded = await getRatingTemplates(branchId, tenantId);
            setTemplates(loaded);
        } catch (err) {
            logger.error('Error loading rating templates', err, 'RatingTemplatesManager');
            error('فشل تحميل القوالب');
        } finally {
            setLoading(false);
        }
    };

    const handleAddFromDefault = () => {
        const defaultTemplate = getDefaultRatingTemplate();
        setFormData({
            ...defaultTemplate,
            branchId,
            tenantId,
            order: templates.length
        });
        setEditingTemplate(null);
        setShowTemplateModal(true);
    };

    const handleEdit = (template: RatingTemplate) => {
        setFormData(template);
        setEditingTemplate(template);
        setShowTemplateModal(true);
    };

    const handleDelete = async (templateId: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا القالب؟')) return;
        try {
            await deleteRatingTemplate(templateId);
            success('تم حذف القالب');
            loadTemplates();
        } catch (err) {
            error('فشل حذف القالب');
        }
    };

    const handleSave = async () => {
        if (!tenantId || !branchId || !user) return;
        if (!formData.name?.trim() || !formData.titleAr?.trim()) {
            error('يرجى إدخال الاسم والعنوان');
            return;
        }

        try {
            if (editingTemplate) {
                await updateRatingTemplate(editingTemplate.id, formData as Partial<RatingTemplate>, user.id, user.name || '');
                success('تم تحديث القالب');
            } else {
                await createRatingTemplate({
                    ...formData as Omit<RatingTemplate, 'id' | 'createdAt' | 'updatedAt'>,
                    branchId,
                    tenantId
                }, user.id, user.name || '');
                success('تم إضافة القالب');
            }
            setShowTemplateModal(false);
            setFormData({
                name: '',
                nameAr: '',
                primaryColor: '#10b981',
                backgroundColor: '#0f172a',
                icon: '⭐',
                triggerEvent: 'checkout',
                autoShow: true,
                delaySeconds: 5,
                requireAllQuestions: false,
                isActive: true,
                questions: [],
                order: templates.length
            });
            loadTemplates();
        } catch (err) {
            error('فشل حفظ القالب');
        }
    };

    const addQuestion = () => {
        const newQuestion: RatingQuestion = {
            id: `q_${Date.now()}`,
            type: 'star',
            question: '',
            questionAr: '',
            required: false
        };
        setFormData({
            ...formData,
            questions: [...(formData.questions || []), newQuestion]
        });
    };

    const updateQuestion = (index: number, updates: Partial<RatingQuestion>) => {
        const questions = [...(formData.questions || [])];
        questions[index] = { ...questions[index], ...updates };
        setFormData({ ...formData, questions });
    };

    const removeQuestion = (index: number) => {
        const questions = [...(formData.questions || [])];
        questions.splice(index, 1);
        setFormData({ ...formData, questions });
    };

    if (loading) return null;

    return (
        <>
            <div className="glass rounded-2xl overflow-hidden border border-white/5 transition-all duration-300">
                {/* Header */}
                <div
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-6 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                            <Star className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">قوالب التقييم الديناميكية</h3>
                            <p className="text-sm text-white/60">{templates.length} قالب متاح</p>
                        </div>
                    </div>
                    <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                        <ChevronDown className="w-4 h-4 text-white/60" />
                    </div>
                </div>

                {/* Content */}
                <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[1000px] opacity-100 overflow-y-auto'}`}>
                    <div className="p-6 space-y-4">
                        {/* Add Default Template Button */}
                        <button
                            onClick={handleAddFromDefault}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            إضافة قالب افتراضي (تقييم الخروج)
                        </button>

                        {/* Add New Button */}
                        <button
                            onClick={() => {
                                setEditingTemplate(null);
                                setFormData({
                                    name: '',
                                    nameAr: '',
                                    primaryColor: '#10b981',
                                    backgroundColor: '#0f172a',
                                    icon: '⭐',
                                    triggerEvent: 'checkout',
                                    autoShow: true,
                                    delaySeconds: 5,
                                    requireAllQuestions: false,
                                    isActive: true,
                                    questions: [],
                                    order: templates.length
                                });
                                setShowTemplateModal(true);
                            }}
                            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            إضافة قالب مخصص
                        </button>

                        {/* Templates List */}
                        <div className="space-y-3">
                            {templates.map(template => (
                                <div
                                    key={template.id}
                                    className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="text-3xl">{template.icon || '⭐'}</div>
                                            <div>
                                                <div className="text-white font-medium">{template.nameAr || template.name}</div>
                                                <div className="text-white/50 text-xs">{template.triggerEvent} - {template.questions.length} أسئلة</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
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
                                    <div className="flex items-center gap-4 text-xs text-white/60">
                                        <span>التأخير: {template.delaySeconds || 0} ثانية</span>
                                        <span className={template.isActive ? 'text-green-400' : 'text-red-400'}>
                                            {template.isActive ? 'نشط' : 'غير نشط'}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {templates.length === 0 && (
                                <div className="text-center py-8 text-white/40">
                                    <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>لا توجد قوالب مضافة</p>
                                    <p className="text-xs mt-1">استخدم القالب الافتراضي أو أضف قالب مخصص</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Template Modal */}
            {showTemplateModal && (
                <TemplateModal
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSave}
                    onClose={() => {
                        setShowTemplateModal(false);
                        setEditingTemplate(null);
                    }}
                    onAddQuestion={addQuestion}
                    onUpdateQuestion={updateQuestion}
                    onRemoveQuestion={removeQuestion}
                />
            )}
        </>
    );
};

// Template Modal Component
const TemplateModal: React.FC<{
    formData: Partial<RatingTemplate>;
    setFormData: (data: Partial<RatingTemplate>) => void;
    onSave: () => void;
    onClose: () => void;
    onAddQuestion: () => void;
    onUpdateQuestion: (index: number, updates: Partial<RatingQuestion>) => void;
    onRemoveQuestion: (index: number) => void;
}> = ({ formData, setFormData, onSave, onClose, onAddQuestion, onUpdateQuestion, onRemoveQuestion }) => {
    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">إضافة / تعديل قالب التقييم</h2>
                        <button onClick={onClose} className="text-white/60 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">اسم القالب *</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Checkout Rating"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">الاسم بالعربية *</label>
                                <input
                                    type="text"
                                    value={formData.nameAr || ''}
                                    onChange={e => setFormData({ ...formData, nameAr: e.target.value })}
                                    placeholder="تقييم الخروج"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Design */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <label className="block text-sm text-white/60 mb-3">التصميم</label>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">اللون الأساسي</label>
                                    <input
                                        type="color"
                                        value={formData.primaryColor || '#10b981'}
                                        onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                                        className="w-full h-10 rounded-lg border border-white/10"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">لون الخلفية</label>
                                    <input
                                        type="color"
                                        value={formData.backgroundColor || '#0f172a'}
                                        onChange={e => setFormData({ ...formData, backgroundColor: e.target.value })}
                                        className="w-full h-10 rounded-lg border border-white/10"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-white/60 mb-1">الأيقونة (إيموجي)</label>
                                    <input
                                        type="text"
                                        value={formData.icon || '⭐'}
                                        onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-center text-2xl focus:border-primary-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">العنوان *</label>
                                <input
                                    type="text"
                                    value={formData.titleAr || ''}
                                    onChange={e => setFormData({ ...formData, titleAr: e.target.value })}
                                    placeholder="كيف كانت إقامتك؟"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">العنوان الفرعي</label>
                                <input
                                    type="text"
                                    value={formData.subtitleAr || ''}
                                    onChange={e => setFormData({ ...formData, subtitleAr: e.target.value })}
                                    placeholder="نقدر رأيك ونسعى لتحسين خدماتنا"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Settings */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">حدث التشغيل</label>
                                <select
                                    value={formData.triggerEvent || 'checkout'}
                                    onChange={e => setFormData({ ...formData, triggerEvent: e.target.value as any })}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                >
                                    <option value="checkout">الخروج</option>
                                    <option value="request_completed">إتمام الطلب</option>
                                    <option value="manual">يدوي</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">التأخير (ثواني)</label>
                                <input
                                    type="number"
                                    value={formData.delaySeconds || 5}
                                    onChange={e => setFormData({ ...formData, delaySeconds: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={() => setFormData({ ...formData, autoShow: !formData.autoShow })}
                                    className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${formData.autoShow
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : 'bg-white/10 text-white/60 border border-white/10'
                                        }`}
                                >
                                    {formData.autoShow ? 'عرض تلقائي' : 'عرض يدوي'}
                                </button>
                            </div>
                        </div>

                        {/* Questions */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm text-white font-medium">الأسئلة</label>
                                <button
                                    onClick={onAddQuestion}
                                    className="px-3 py-1.5 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors flex items-center gap-1 text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    إضافة سؤال
                                </button>
                            </div>

                            <div className="space-y-3">
                                {formData.questions?.map((question, index) => (
                                    <div key={index} className="p-3 rounded-lg bg-white/5 border border-white/10">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-white/60">سؤال #{index + 1}</span>
                                            <button
                                                onClick={() => onRemoveQuestion(index)}
                                                className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <input
                                                type="text"
                                                value={question.questionAr || ''}
                                                onChange={e => onUpdateQuestion(index, { questionAr: e.target.value })}
                                                placeholder="السؤال بالعربية"
                                                className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:border-primary-500 focus:outline-none"
                                            />
                                            <select
                                                value={question.type}
                                                onChange={e => onUpdateQuestion(index, { type: e.target.value as any })}
                                                className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:border-primary-500 focus:outline-none"
                                            >
                                                <option value="star">نجوم</option>
                                                <option value="emoji">إيموجي</option>
                                                <option value="text">نص</option>
                                                <option value="number">رقم</option>
                                                <option value="yes_no">نعم/لا</option>
                                                <option value="multiple_choice">اختيار متعدد</option>
                                            </select>
                                        </div>
                                        <label className="flex items-center gap-2 text-xs text-white/60">
                                            <input
                                                type="checkbox"
                                                checked={question.required || false}
                                                onChange={e => onUpdateQuestion(index, { required: e.target.checked })}
                                                className="rounded"
                                            />
                                            مطلوب
                                        </label>
                                    </div>
                                ))}
                                {(!formData.questions || formData.questions.length === 0) && (
                                    <div className="text-center py-4 text-white/40 text-sm">
                                        لا توجد أسئلة. اضغط "إضافة سؤال"
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                            <span className="text-sm text-white/60">حالة القالب</span>
                            <button
                                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${formData.isActive
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    }`}
                            >
                                {formData.isActive ? 'نشط' : 'معطّل'}
                            </button>
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
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold hover:shadow-lg hover:shadow-primary-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                حفظ
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
