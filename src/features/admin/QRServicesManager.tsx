/**
 * QR Services Manager
 * Dynamic QR services configuration for guest portal
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import {
    QrCode, Plus, Trash2, Edit2, Save, X, AlertTriangle,
    RefreshCw, ChevronDown, ChevronUp, MoveUp, MoveDown,
    DollarSign, Clock, Settings
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useUX } from '../../context/UXContext';
import { useAuth } from '../../context/AuthContext';
import {
    getQRServices,
    createQRService,
    updateQRService,
    deleteQRService,
    getDefaultServiceTemplates,
    type QRService,
    type QRServiceField
} from '../../services/qrServiceService';
import { logger } from '../../services/loggerService';

interface QRServicesManagerProps {
    branchId: string;
    branchName: string;
}

export const QRServicesManager: React.FC<QRServicesManagerProps> = ({ branchId, branchName }) => {
    const { tenantId } = useTenant();
    const { success, error } = useUX();
    const { user } = useAuth();

    const [services, setServices] = useState<QRService[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [editingService, setEditingService] = useState<QRService | null>(null);

    // Form state
    const [formData, setFormData] = useState<Partial<QRService>>({
        name: '',
        description: '',
        icon: '✨',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        type: 'custom',
        isActive: true,
        hasPricing: false,
        price: 0,
        requestType: 'other',
        targetDepartment: 'reception',
        fields: [],
        order: 0
    });

    useEffect(() => {
        loadServices();
    }, [tenantId, branchId]);

    const loadServices = async () => {
        if (!tenantId || !branchId) return;
        setLoading(true);
        try {
            const loaded = await getQRServices(branchId, tenantId);
            setServices(loaded);
        } catch (err) {
            logger.error('Error loading QR services', err, 'QRServicesManager');
            error('فشل تحميل الخدمات');
        } finally {
            setLoading(false);
        }
    };

    const handleAddFromTemplate = (template: Partial<QRService>) => {
        setFormData({
            ...template,
            branchId,
            tenantId,
            order: services.length
        });
        setEditingService(null);
        setShowServiceModal(true);
    };

    const handleEdit = (service: QRService) => {
        setFormData(service);
        setEditingService(service);
        setShowServiceModal(true);
    };

    const handleDelete = async (serviceId: string) => {
        if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;
        try {
            await deleteQRService(serviceId);
            success('تم حذف الخدمة');
            loadServices();
        } catch (err) {
            error('فشل حذف الخدمة');
        }
    };

    const handleSave = async () => {
        if (!tenantId || !branchId || !user) return;
        if (!formData.name?.trim()) {
            error('يرجى إدخال اسم الخدمة');
            return;
        }
        if (!formData.requestType) {
            error('يرجى تحديد نوع الطلب');
            return;
        }

        try {
            if (editingService) {
                await updateQRService(editingService.id, formData as Partial<QRService>, user.id, user.name || '');
                success('تم تحديث الخدمة');
            } else {
                await createQRService({
                    ...formData as Omit<QRService, 'id' | 'createdAt' | 'updatedAt'>,
                    branchId,
                    tenantId
                }, user.id, user.name || '');
                success('تم إضافة الخدمة');
            }
            setShowServiceModal(false);
            setFormData({
                name: '',
                description: '',
                icon: '✨',
                type: 'custom',
                isActive: true,
                hasPricing: false,
                price: 0,
                requestType: 'other',
                targetDepartment: 'reception',
                fields: [],
                order: services.length
            });
            loadServices();
        } catch (err) {
            error('فشل حفظ الخدمة');
        }
    };

    const addField = () => {
        const newField: QRServiceField = {
            type: 'text',
            key: `field_${Date.now()}`,
            label: '',
            required: false
        };
        setFormData({
            ...formData,
            fields: [...(formData.fields || []), newField]
        });
    };

    const updateField = (index: number, updates: Partial<QRServiceField>) => {
        const fields = [...(formData.fields || [])];
        fields[index] = { ...fields[index], ...updates };
        setFormData({ ...formData, fields });
    };

    const removeField = (index: number) => {
        const fields = [...(formData.fields || [])];
        fields.splice(index, 1);
        setFormData({ ...formData, fields });
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        const fields = [...(formData.fields || [])];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= fields.length) return;
        [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
        setFormData({ ...formData, fields });
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
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                            <QrCode className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">خدمات QR الديناميكية</h3>
                            <p className="text-sm text-white/60">{services.length} خدمة متاحة</p>
                        </div>
                    </div>
                    <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                        <ChevronDown className="w-4 h-4 text-white/60" />
                    </div>
                </div>

                {/* Content */}
                <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[1000px] opacity-100 overflow-y-auto'}`}>
                    <div className="p-6 space-y-4">
                        {/* Quick Templates */}
                        <div>
                            <p className="text-sm text-white/60 mb-3">قوالب جاهزة:</p>
                            <div className="grid grid-cols-2 gap-2">
                                {getDefaultServiceTemplates().map((template, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleAddFromTemplate(template)}
                                        className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-right"
                                    >
                                        <div className="text-2xl mb-1">{template.icon}</div>
                                        <div className="text-white font-medium text-sm">{template.name}</div>
                                        <div className="text-white/40 text-xs">{template.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Add New Button */}
                        <button
                            onClick={() => {
                                setEditingService(null);
                                setFormData({
                                    name: '',
                                    description: '',
                                    icon: '✨',
                                    color: 'text-blue-400',
                                    bgColor: 'bg-blue-500/20',
                                    type: 'custom',
                                    isActive: true,
                                    hasPricing: false,
                                    price: 0,
                                    requestType: 'other',
                                    targetDepartment: 'reception',
                                    fields: [],
                                    order: services.length
                                });
                                setShowServiceModal(true);
                            }}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            إضافة خدمة جديدة
                        </button>

                        {/* Services List */}
                        <div className="space-y-3">
                            {services.map(service => (
                                <div
                                    key={service.id}
                                    className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="text-3xl">{service.icon}</div>
                                            <div>
                                                <div className="text-white font-medium">{service.name}</div>
                                                <div className="text-white/50 text-xs">{service.description}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(service)}
                                                className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(service.id)}
                                                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-white/60">
                                        <span>القسم: {service.targetDepartment}</span>
                                        {service.hasPricing && service.price && (
                                            <span className="text-green-400">السعر: {service.price} ر.س</span>
                                        )}
                                        <span className={service.isActive ? 'text-green-400' : 'text-red-400'}>
                                            {service.isActive ? 'نشط' : 'غير نشط'}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {services.length === 0 && (
                                <div className="text-center py-8 text-white/40">
                                    <QrCode className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>لا توجد خدمات مضافة</p>
                                    <p className="text-xs mt-1">استخدم القوالب الجاهزة أو أضف خدمة مخصصة</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Service Modal */}
            {showServiceModal && (
                <ServiceModal
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSave}
                    onClose={() => {
                        setShowServiceModal(false);
                        setEditingService(null);
                    }}
                    onAddField={addField}
                    onUpdateField={updateField}
                    onRemoveField={removeField}
                    onMoveField={moveField}
                />
            )}
        </>
    );
};

// Service Modal Component
const ServiceModal: React.FC<{
    formData: Partial<QRService>;
    setFormData: (data: Partial<QRService>) => void;
    onSave: () => void;
    onClose: () => void;
    onAddField: () => void;
    onUpdateField: (index: number, updates: Partial<QRServiceField>) => void;
    onRemoveField: (index: number) => void;
    onMoveField: (index: number, direction: 'up' | 'down') => void;
}> = ({ formData, setFormData, onSave, onClose, onAddField, onUpdateField, onRemoveField, onMoveField }) => {
    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">إضافة / تعديل خدمة QR</h2>
                        <button onClick={onClose} className="text-white/60 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">اسم الخدمة *</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="مثال: الخروج المتأخر"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">الأيقونة (إيموجي)</label>
                                <input
                                    type="text"
                                    value={formData.icon || '✨'}
                                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                    placeholder="🕐"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white text-center text-2xl focus:border-primary-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-white/60 mb-2">الوصف</label>
                            <textarea
                                value={formData.description || ''}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="وصف الخدمة الذي يظهر للنزيل"
                                rows={2}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white resize-none focus:border-primary-500 focus:outline-none"
                            />
                        </div>

                        {/* Service Type & Department */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">نوع الطلب *</label>
                                <select
                                    value={formData.requestType || 'other'}
                                    onChange={e => setFormData({ ...formData, requestType: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                >
                                    <option value="other">طلب طارئ</option>
                                    <option value="bellman">بيلمان</option>
                                    <option value="maintenance">صيانة</option>
                                    <option value="cleaning">تنظيف</option>
                                    <option value="coffee">كوفي شوب</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">القسم المرسل إليه *</label>
                                <select
                                    value={formData.targetDepartment || 'reception'}
                                    onChange={e => setFormData({ ...formData, targetDepartment: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                >
                                    <option value="reception">الاستقبال</option>
                                    <option value="housekeeping">الهاوس كيبنج</option>
                                    <option value="maintenance">الصيانة</option>
                                    <option value="bellman">البيلمان</option>
                                    <option value="coffee_shop">الكوفي شوب</option>
                                    <option value="procurement">المشتريات</option>
                                </select>
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm text-white/60">تسعير الخدمة</label>
                                <button
                                    onClick={() => setFormData({ ...formData, hasPricing: !formData.hasPricing })}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${formData.hasPricing
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : 'bg-white/10 text-white/60 border border-white/10'
                                        }`}
                                >
                                    {formData.hasPricing ? 'مفعّل' : 'معطّل'}
                                </button>
                            </div>
                            {formData.hasPricing && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-white/60 mb-2">السعر (ر.س)</label>
                                        <input
                                            type="number"
                                            value={formData.price || 0}
                                            onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-white/60 mb-2">وصف السعر</label>
                                        <input
                                            type="text"
                                            value={formData.priceLabel || ''}
                                            onChange={e => setFormData({ ...formData, priceLabel: e.target.value })}
                                            placeholder="مثال: رسوم الخروج المتأخر"
                                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Time Restrictions */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm text-white/60">قيود الوقت</label>
                                <button
                                    onClick={() => setFormData({
                                        ...formData,
                                        timeRestrictions: formData.timeRestrictions
                                            ? { ...formData.timeRestrictions, enabled: !formData.timeRestrictions.enabled }
                                            : { enabled: true }
                                    })}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${formData.timeRestrictions?.enabled
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : 'bg-white/10 text-white/60 border border-white/10'
                                        }`}
                                >
                                    {formData.timeRestrictions?.enabled ? 'مفعّل' : 'معطّل'}
                                </button>
                            </div>
                            {formData.timeRestrictions?.enabled && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-white/60 mb-2">من الساعة</label>
                                        <input
                                            type="time"
                                            value={formData.timeRestrictions?.startTime || ''}
                                            onChange={e => setFormData({
                                                ...formData,
                                                timeRestrictions: { ...formData.timeRestrictions!, startTime: e.target.value, enabled: true }
                                            })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-white/60 mb-2">إلى الساعة</label>
                                        <input
                                            type="time"
                                            value={formData.timeRestrictions?.endTime || ''}
                                            onChange={e => setFormData({
                                                ...formData,
                                                timeRestrictions: { ...formData.timeRestrictions!, endTime: e.target.value, enabled: true }
                                            })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Form Fields */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm text-white font-medium">حقول النموذج</label>
                                <button
                                    onClick={onAddField}
                                    className="px-3 py-1.5 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors flex items-center gap-1 text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    إضافة حقل
                                </button>
                            </div>

                            <div className="space-y-3">
                                {formData.fields?.map((field, index) => (
                                    <div key={index} className="p-3 rounded-lg bg-white/5 border border-white/10">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-white/60">حقل #{index + 1}</span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => onMoveField(index, 'up')}
                                                    disabled={index === 0}
                                                    className="p-1 rounded bg-white/10 text-white/60 hover:text-white disabled:opacity-30"
                                                >
                                                    <ChevronUp className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => onMoveField(index, 'down')}
                                                    disabled={index === (formData.fields?.length || 0) - 1}
                                                    className="p-1 rounded bg-white/10 text-white/60 hover:text-white disabled:opacity-30"
                                                >
                                                    <ChevronDown className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => onRemoveField(index)}
                                                    className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <input
                                                type="text"
                                                value={field.label}
                                                onChange={e => onUpdateField(index, { label: e.target.value })}
                                                placeholder="اسم الحقل"
                                                className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:border-primary-500 focus:outline-none"
                                            />
                                            <select
                                                value={field.type}
                                                onChange={e => onUpdateField(index, { type: e.target.value as any })}
                                                className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:border-primary-500 focus:outline-none"
                                            >
                                                <option value="text">نص</option>
                                                <option value="textarea">نص طويل</option>
                                                <option value="number">رقم</option>
                                                <option value="time">وقت</option>
                                                <option value="date">تاريخ</option>
                                                <option value="datetime">تاريخ ووقت</option>
                                                <option value="select">قائمة</option>
                                                <option value="boolean">نعم/لا</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={field.key}
                                                onChange={e => onUpdateField(index, { key: e.target.value })}
                                                placeholder="مفتاح الحقل (key)"
                                                className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:border-primary-500 focus:outline-none"
                                            />
                                            <label className="flex items-center gap-1 text-xs text-white/60">
                                                <input
                                                    type="checkbox"
                                                    checked={field.required || false}
                                                    onChange={e => onUpdateField(index, { required: e.target.checked })}
                                                    className="rounded"
                                                />
                                                مطلوب
                                            </label>
                                        </div>
                                        {field.type === 'select' && (
                                            <div className="mt-2">
                                                <label className="block text-xs text-white/60 mb-1">الخيارات (مفصولة بفواصل)</label>
                                                <input
                                                    type="text"
                                                    value={field.options?.map(o => `${o.value}:${o.label}`).join(',') || ''}
                                                    onChange={e => {
                                                        const options = e.target.value.split(',').filter(Boolean).map(item => {
                                                            const [value, label] = item.split(':');
                                                            return { value: value?.trim() || '', label: label?.trim() || value?.trim() || '' };
                                                        });
                                                        onUpdateField(index, { options });
                                                    }}
                                                    placeholder="الآن:الآن, مجدول:مجدول"
                                                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:border-primary-500 focus:outline-none"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(!formData.fields || formData.fields.length === 0) && (
                                    <div className="text-center py-4 text-white/40 text-sm">
                                        لا توجد حقول. اضغط "إضافة حقل" لإضافة حقل جديد
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                            <span className="text-sm text-white/60">حالة الخدمة</span>
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
