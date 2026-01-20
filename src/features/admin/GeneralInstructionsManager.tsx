/**
 * General Instructions Manager
 * Allows manager to create and manage general instructions for departments
 * Employees can view department-specific instructions and hotel policies
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import {
    BookOpen, Plus, Trash2, Edit2, Save, X, Shield, AlertCircle,
    FileText, List, Users, Building2, Info, ArrowUp, ArrowDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useTenant } from '../../context/TenantContext';
import { useTranslation } from 'react-i18next';
import {
    subscribeToAllInstructions,
    createGeneralInstruction,
    updateGeneralInstruction,
    deactivateGeneralInstruction,
    type GeneralInstruction,
    type DepartmentType
} from '../../services/generalInstructionsService';
import { Timestamp } from 'firebase/firestore';

const DEPARTMENTS: { value: DepartmentType; label: string; icon: React.ReactNode }[] = [
    { value: 'general', label: 'عام (دستور الفندق)', icon: <BookOpen className="w-4 h-4" /> },
    { value: 'all', label: 'جميع الأقسام', icon: <Users className="w-4 h-4" /> },
    { value: 'reception', label: 'الاستقبال', icon: <Building2 className="w-4 h-4" /> },
    { value: 'housekeeping', label: 'الهاوس كيبنج', icon: <Users className="w-4 h-4" /> },
    { value: 'maintenance', label: 'الصيانة', icon: <Info className="w-4 h-4" /> },
    { value: 'bellman', label: 'البيلمان', icon: <Users className="w-4 h-4" /> },
    { value: 'coffee_shop', label: 'الكوفي شوب', icon: <Building2 className="w-4 h-4" /> },
    { value: 'procurement', label: 'المشتريات', icon: <Building2 className="w-4 h-4" /> }
];

const CATEGORIES = [
    { value: 'general_policy', label: 'سياسة عامة', icon: <BookOpen className="w-4 h-4" /> },
    { value: 'rights', label: 'حقوق الموظفين (ما له)', icon: <Shield className="w-4 h-4" /> },
    { value: 'obligations', label: 'واجبات الموظفين (ما عليه)', icon: <AlertCircle className="w-4 h-4" /> },
    { value: 'department_specific', label: 'تعليمات خاصة بالقسم', icon: <Building2 className="w-4 h-4" /> },
    { value: 'procedures', label: 'إجراءات العمل', icon: <FileText className="w-4 h-4" /> },
    { value: 'rules', label: 'قواعد', icon: <List className="w-4 h-4" /> }
];

const SECTIONS = [
    'دستور الفندق',
    'حقوق الموظفين',
    'واجبات الموظفين',
    'إجراءات العمل',
    'قواعد السلوك',
    'معايير الجودة',
    'الأمان والسلامة',
    'أخرى'
];

export const GeneralInstructionsManager: React.FC = () => {
    const { user } = useAuth();
    const { success, error } = useUX();
    const { tenantId } = useTenant();
    const { t } = useTranslation();
    const branchId = (user as any)?.branchId || (user as any)?.branch;

    const [instructions, setInstructions] = useState<GeneralInstruction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingInstruction, setEditingInstruction] = useState<GeneralInstruction | null>(null);
    const [filterDepartment, setFilterDepartment] = useState<DepartmentType | 'all'>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');

    // Form state
    const [formData, setFormData] = useState<Partial<GeneralInstruction>>({
        title: '',
        titleAr: '',
        content: '',
        contentAr: '',
        category: 'general_policy',
        targetDepartment: 'general',
        section: 'دستور الفندق',
        order: 0,
        isActive: true,
        branchId: branchId
    });

    useEffect(() => {
        if (!user || !tenantId) return;
        const isManager = ['manager', 'owner', 'admin'].includes(user.role || '');

        if (!isManager) return;

        const unsubscribe = subscribeToAllInstructions(tenantId, (instructionsList) => {
            setInstructions(instructionsList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, tenantId]);

    const handleEdit = (instruction: GeneralInstruction) => {
        setFormData(instruction);
        setEditingInstruction(instruction);
        setShowModal(true);
    };

    const handleDelete = async (instructionId: string) => {
        if (!confirm(t('admin.deleteInstructionsConfirm') || 'هل أنت متأكد من حذف هذه التعليمات؟')) return;
        if (!tenantId) return;
        try {
            await deactivateGeneralInstruction(tenantId, instructionId);
            success('تم حذف التعليمات');
        } catch (err) {
            error('فشل حذف التعليمات');
        }
    };

    const handleSave = async () => {
        if (!user || !tenantId || !formData.titleAr?.trim() || !formData.contentAr?.trim()) {
            error('يرجى إدخال العنوان والمحتوى');
            return;
        }

        try {
            if (editingInstruction) {
                await updateGeneralInstruction(
                    tenantId,
                    editingInstruction.id,
                    formData as Partial<GeneralInstruction>,
                    user.id,
                    user.name || ''
                );
                success('تم تحديث التعليمات');
            } else {
                // Get max order for new instruction
                const maxOrder = instructions.length > 0 
                    ? Math.max(...instructions.map(i => i.order || 0)) 
                    : 0;
                
                await createGeneralInstruction(
                    tenantId,
                    {
                        ...formData as Omit<GeneralInstruction, 'id' | 'createdAt' | 'tenantId'>,
                        order: formData.order || maxOrder + 1
                    },
                    user.id,
                    user.name || ''
                );
                success('تم إضافة التعليمات');
            }
            setShowModal(false);
            setFormData({
                title: '',
                titleAr: '',
                content: '',
                contentAr: '',
                category: 'general_policy',
                targetDepartment: 'general',
                section: 'دستور الفندق',
                order: 0,
                isActive: true,
                branchId: branchId
            });
        } catch (err) {
            error('فشل حفظ التعليمات');
        }
    };

    const handleMoveOrder = async (instruction: GeneralInstruction, direction: 'up' | 'down') => {
        if (!tenantId) return;
        try {
            const currentOrder = instruction.order || 0;
            const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
            
            // Find instruction with target order
            const targetInstruction = instructions.find(i => 
                i.id !== instruction.id && 
                (i.order || 0) === targetOrder &&
                i.targetDepartment === instruction.targetDepartment
            );

            if (targetInstruction) {
                // Swap orders
                await updateGeneralInstruction(tenantId, instruction.id, { order: targetOrder }, user?.id || '', user?.name || '');
                await updateGeneralInstruction(tenantId, targetInstruction.id, { order: currentOrder }, user?.id || '', user?.name || '');
            } else {
                // Just update order
                await updateGeneralInstruction(tenantId, instruction.id, { order: targetOrder }, user?.id || '', user?.name || '');
            }
            success('تم تحديث الترتيب');
        } catch (err) {
            error('فشل تحديث الترتيب');
        }
    };

    const filteredInstructions = instructions.filter(i => {
        if (filterDepartment !== 'all' && i.targetDepartment !== filterDepartment) return false;
        if (filterCategory !== 'all' && i.category !== filterCategory) return false;
        return true;
    });

    if (loading) return null;

    return (
        <>
            <div className="min-h-screen theme-page p-6">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <BookOpen className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">التعليمات العامة</h1>
                                <p className="text-sm text-white/60">إدارة دستور الفندق والتعليمات لكل قسم</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setEditingInstruction(null);
                                const maxOrder = instructions.length > 0 
                                    ? Math.max(...instructions.map(i => i.order || 0)) 
                                    : 0;
                                setFormData({
                                    title: '',
                                    titleAr: '',
                                    content: '',
                                    contentAr: '',
                                    category: 'general_policy',
                                    targetDepartment: 'general',
                                    section: 'دستور الفندق',
                                    order: maxOrder + 1,
                                    isActive: true,
                                    branchId: branchId
                                });
                                setShowModal(true);
                            }}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold hover:shadow-lg hover:shadow-purple-500/25 transition-all flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            إضافة تعليمات جديدة
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm text-white/60 mb-2">فلترة حسب القسم</label>
                            <select
                                value={filterDepartment}
                                onChange={e => setFilterDepartment(e.target.value as DepartmentType | 'all')}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none transition-all"
                            >
                                <option value="all">جميع الأقسام</option>
                                {DEPARTMENTS.map(dept => (
                                    <option key={dept.value} value={dept.value}>{dept.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-white/60 mb-2">فلترة حسب الفئة</label>
                            <select
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none transition-all"
                            >
                                <option value="all">جميع الفئات</option>
                                {CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Quick Templates */}
                    <div className="mb-6">
                        <p className="text-sm text-white/60 mb-3">قوالب سريعة:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 3xl:grid-cols-6 4xl:grid-cols-8 gap-2 sm:gap-3 lg:gap-4 3xl:gap-6">
                            {[
                                { 
                                    category: 'rights' as const, 
                                    titleAr: 'حقوق الموظف', 
                                    contentAr: '• حق الحصول على راتب عادل\n• حق الحصول على إجازات\n• حق بيئة عمل آمنة\n• حق التدريب والتطوير',
                                    section: 'حقوق الموظفين'
                                },
                                { 
                                    category: 'obligations' as const, 
                                    titleAr: 'واجبات الموظف', 
                                    contentAr: '• الالتزام بمواعيد العمل\n• الحفاظ على سرية المعلومات\n• احترام العملاء والزملاء\n• اتباع إجراءات السلامة',
                                    section: 'واجبات الموظفين'
                                },
                                { 
                                    category: 'general_policy' as const, 
                                    titleAr: 'سياسة الفندق', 
                                    contentAr: '• معايير الخدمة العالية\n• الالتزام بالجودة\n• رضا العملاء أولوية\n• العمل الجماعي',
                                    section: 'دستور الفندق'
                                },
                                { 
                                    category: 'procedures' as const, 
                                    titleAr: 'إجراءات العمل', 
                                    contentAr: '• خطوات تنفيذ المهام\n• معايير الجودة المطلوبة\n• وقت الاستجابة المتوقع\n• قنوات التواصل',
                                    section: 'إجراءات العمل'
                                }
                            ].map((template, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        const maxOrder = instructions.length > 0 
                                            ? Math.max(...instructions.map(i => i.order || 0)) 
                                            : 0;
                                        setFormData({
                                            title: '',
                                            titleAr: template.titleAr,
                                            content: '',
                                            contentAr: template.contentAr,
                                            category: template.category,
                                            targetDepartment: 'all',
                                            section: template.section,
                                            order: maxOrder + 1,
                                            isActive: true,
                                            branchId: branchId
                                        });
                                        setEditingInstruction(null);
                                        setShowModal(true);
                                    }}
                                    className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors text-right"
                                >
                                    <div className="text-2xl mb-1">📋</div>
                                    <div className="text-purple-400 font-medium text-sm">{template.titleAr}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Instructions List */}
                    <div className="space-y-4">
                        {filteredInstructions.length === 0 ? (
                            <div className="text-center py-12 text-white/40">
                                <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <p>لا توجد تعليمات</p>
                                <p className="text-xs mt-1">استخدم القوالب السريعة أو أضف تعليمات مخصصة</p>
                            </div>
                        ) : (
                            filteredInstructions.map(instruction => (
                                <div
                                    key={instruction.id}
                                    className="glass-card p-4 rounded-xl border border-white/10 hover:border-purple-500/30 transition-all"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                instruction.category === 'rights' ? 'bg-green-500/20' :
                                                instruction.category === 'obligations' ? 'bg-orange-500/20' :
                                                instruction.category === 'general_policy' ? 'bg-blue-500/20' :
                                                instruction.category === 'procedures' ? 'bg-purple-500/20' :
                                                'bg-gray-500/20'
                                            }`}>
                                                {instruction.category === 'rights' ? <Shield className="w-5 h-5 text-green-400" /> :
                                                 instruction.category === 'obligations' ? <AlertCircle className="w-5 h-5 text-orange-400" /> :
                                                 instruction.category === 'general_policy' ? <BookOpen className="w-5 h-5 text-blue-400" /> :
                                                 instruction.category === 'procedures' ? <FileText className="w-5 h-5 text-purple-400" /> :
                                                 <Info className="w-5 h-5 text-gray-400" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-white font-semibold">{instruction.titleAr || instruction.title}</h3>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        instruction.category === 'rights' ? 'bg-green-500/20 text-green-400' :
                                                        instruction.category === 'obligations' ? 'bg-orange-500/20 text-orange-400' :
                                                        instruction.category === 'general_policy' ? 'bg-blue-500/20 text-blue-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                    }`}>
                                                        {CATEGORIES.find(c => c.value === instruction.category)?.label || instruction.category}
                                                    </span>
                                                </div>
                                                <p className="text-white/60 text-sm line-clamp-2">{instruction.contentAr || instruction.content}</p>
                                                {instruction.section && (
                                                    <span className="px-2 py-0.5 rounded-lg bg-white/10 text-white/60 text-xs mt-1 inline-block">
                                                        {instruction.section}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                                                {DEPARTMENTS.find(d => d.value === instruction.targetDepartment)?.label || instruction.targetDepartment}
                                            </span>
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => handleMoveOrder(instruction, 'up')}
                                                    className="p-1 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
                                                    title="نقل للأعلى"
                                                >
                                                    <ArrowUp className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleMoveOrder(instruction, 'down')}
                                                    className="p-1 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
                                                    title="نقل للأسفل"
                                                >
                                                    <ArrowDown className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => handleEdit(instruction)}
                                                className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(instruction.id)}
                                                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 pt-3 border-t border-white/10 text-xs text-white/40">
                                        <span className={instruction.isActive ? 'text-green-400' : 'text-red-400'}>
                                            {instruction.isActive ? t('common.active') : t('common.inactive')}
                                        </span>
                                        <span>الترتيب: {instruction.order || 0}</span>
                                        {instruction.updatedAt && (
                                            <span>آخر تحديث: {new Date(instruction.updatedAt.toDate ? instruction.updatedAt.toDate() : instruction.updatedAt).toLocaleDateString('ar-SA')}</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Instruction Modal */}
            {showModal && (
                <InstructionModal
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSave}
                    onClose={() => {
                        setShowModal(false);
                        setEditingInstruction(null);
                    }}
                    departments={DEPARTMENTS}
                    categories={CATEGORIES}
                    sections={SECTIONS}
                />
            )}
        </>
    );
};

// Instruction Modal Component
const InstructionModal: React.FC<{
    formData: Partial<GeneralInstruction>;
    setFormData: (data: Partial<GeneralInstruction>) => void;
    onSave: () => void;
    onClose: () => void;
    departments: typeof DEPARTMENTS;
    categories: typeof CATEGORIES;
    sections: typeof SECTIONS;
}> = ({ formData, setFormData, onSave, onClose, departments, categories, sections }) => {
    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 3xl:p-8">
            <div className="glass-card w-full max-w-lg sm:max-w-2xl lg:max-w-3xl 3xl:max-w-5xl 4xl:max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl 3xl:rounded-3xl modal-enter">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">إضافة/تعديل تعليمات</h2>
                        <button onClick={onClose} className="text-white/60 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Category */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">الفئة</label>
                            <div className="grid grid-cols-3 gap-2">
                                {categories.map(cat => (
                                    <button
                                        key={cat.value}
                                        onClick={() => setFormData({ ...formData, category: cat.value as any })}
                                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                            formData.category === cat.value
                                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                                : 'bg-white/10 text-white/60 border border-white/10 hover:bg-white/20'
                                        }`}
                                    >
                                        {cat.icon}
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Target Department */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">القسم المستهدف</label>
                            <select
                                value={formData.targetDepartment || 'general'}
                                onChange={e => setFormData({ ...formData, targetDepartment: e.target.value as DepartmentType })}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none transition-all"
                            >
                                {departments.map(dept => (
                                    <option key={dept.value} value={dept.value}>{dept.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Section */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">القسم/الباب</label>
                            <select
                                value={formData.section || 'دستور الفندق'}
                                onChange={e => setFormData({ ...formData, section: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none transition-all"
                            >
                                {sections.map(section => (
                                    <option key={section} value={section}>{section}</option>
                                ))}
                            </select>
                        </div>

                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">العنوان بالعربية *</label>
                                <input
                                    type="text"
                                    value={formData.titleAr || ''}
                                    onChange={e => setFormData({ ...formData, titleAr: e.target.value })}
                                    placeholder="حقوق الموظف"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">العنوان بالإنجليزية</label>
                                <input
                                    type="text"
                                    value={formData.title || ''}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Employee Rights"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Content */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">المحتوى بالعربية *</label>
                            <textarea
                                value={formData.contentAr || ''}
                                onChange={e => setFormData({ ...formData, contentAr: e.target.value })}
                                placeholder="• حق الحصول على راتب عادل&#10;• حق الحصول على إجازات&#10;• حق بيئة عمل آمنة"
                                rows={8}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white resize-none focus:border-purple-500/50 focus:outline-none transition-all font-mono text-sm"
                            />
                            <p className="text-xs text-white/40 mt-1">يمكنك استخدام • للقوائم</p>
                        </div>

                        {/* Order */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">الترتيب (رقم العرض)</label>
                            <input
                                type="number"
                                value={formData.order || 0}
                                onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none transition-all"
                            />
                            <p className="text-xs text-white/40 mt-1">رقم أقل = يظهر أولاً</p>
                        </div>

                        {/* Display Settings */}
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
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold hover:shadow-lg hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-2"
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
