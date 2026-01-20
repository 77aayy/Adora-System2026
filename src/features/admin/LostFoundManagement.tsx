/**
 * Lost & Found Management Component
 * Complete management for lost and found items
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search as SearchIcon,
    Plus,
    X,
    Camera,
    MapPin,
    User,
    Phone,
    Package,
    CheckCircle2,
    XCircle,
    RotateCcw,
    Trash2,
    Filter,
    Clock,
    RefreshCw,
    Save,
    Eye,
    FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { logger } from '../../services/loggerService';
import { useTranslation } from 'react-i18next';
import {
    LostFoundItem,
    ItemStatus,
    ItemCategory,
    CATEGORY_NAMES,
    STATUS_NAMES,
    CATEGORY_ICONS,
    subscribeToLostFound,
    addLostFoundItem,
    updateLostFoundItem,
    claimItem,
    returnItem,
    disposeItem,
    getLostFoundStats,
} from '../../services/lostFoundService';

// ============================================================
// HELPER COMPONENTS
// ============================================================

const StatusBadge: React.FC<{ status: ItemStatus }> = ({ status }) => {
    const { t } = useTranslation();
    const STATUS_NAMES_TRANSLATED: Record<ItemStatus, string> = {
        found: t('lostFound.status.found') || STATUS_NAMES.found,
        claimed: t('lostFound.status.claimed') || STATUS_NAMES.claimed,
        returned: t('lostFound.status.returned') || STATUS_NAMES.returned,
        donated: t('lostFound.status.donated') || STATUS_NAMES.donated,
        disposed: t('lostFound.status.disposed') || STATUS_NAMES.disposed,
    };
    const colors: Record<ItemStatus, string> = {
        found: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        claimed: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        returned: 'bg-green-500/20 text-green-400 border-green-500/30',
        disposed: 'bg-red-500/20 text-red-400 border-red-500/30',
        donated: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colors[status]}`}>
            {STATUS_NAMES_TRANSLATED[status]}
        </span>
    );
};

const CategoryBadge: React.FC<{ category: ItemCategory }> = ({ category }) => (
    <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs flex items-center gap-1">
        <span>{CATEGORY_ICONS[category]}</span>
        {CATEGORY_NAMES[category]}
    </span>
);

// Stats Card
const StatsCard: React.FC<{
    title: string;
    value: number;
    color: string;
    icon: React.ReactNode;
}> = ({ title, value, color, icon }) => (
    <div className="p-4 rounded-2xl transition-colors duration-300" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
        <div className="flex items-center gap-3">
            <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${color}20`, color }}
            >
                {icon}
            </div>
            <div>
                <p className="text-white/60 text-sm">{title}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
            </div>
        </div>
    </div>
);

// ============================================================
// ADD ITEM MODAL
// ============================================================

interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any, image?: File) => Promise<void>;
    branchId: string;
    userId: string;
    userName: string;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onSave, branchId, userId, userName }) => {
    const [formData, setFormData] = useState({
        type: 'found' as 'lost' | 'found',
        category: 'other' as ItemCategory,
        description: '',
        location: '',
        roomNumber: '',
        guestName: '',
        guestContact: '',
        storageLocation: '',
        notes: '',
    });
    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!formData.description.trim() || !formData.location.trim()) return;

        setSaving(true);
        try {
            await onSave({
                ...formData,
                branch: branchId,
                foundBy: { id: userId, name: userName },
            }, image || undefined);
            onClose();

            // Reset form
            setFormData({
                type: 'found',
                category: 'other',
                description: '',
                location: '',
                roomNumber: '',
                guestName: '',
                guestContact: '',
                storageLocation: '',
                notes: '',
            });
            setImage(null);
            setImagePreview(null);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Solid Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} style={{ backdropFilter: 'none' }} />
            {/* Modal Content */}
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                            <SearchIcon className="w-5 h-5 text-white" />
                        </div>
                        تسجيل عنصر جديد
                    </h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-5 space-y-5">
                    {/* Type Selection */}
                    <div className="flex gap-3">
                        {[
                            { value: 'found', label: 'عنصر موجود', desc: 'وجده أحد الموظفين', color: 'from-blue-400 to-blue-600' },
                            { value: 'lost', label: 'عنصر مفقود', desc: 'أبلغ عنه نزيل', color: 'from-orange-400 to-orange-600' },
                        ].map((t) => (
                            <button
                                key={t.value}
                                onClick={() => setFormData({ ...formData, type: t.value as 'lost' | 'found' })}
                                className={`flex-1 p-4 rounded-xl text-right transition-all ${formData.type === t.value
                                        ? `bg-gradient-to-br ${t.color} text-white shadow-lg`
                                        : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                                    }`}
                            >
                                <p className="font-bold">{t.label}</p>
                                <p className="text-xs opacity-80 mt-1">{t.desc}</p>
                            </button>
                        ))}
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">صورة العنصر</label>
                        <div className="relative">
                            {imagePreview ? (
                                <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600">
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => { setImage(null); setImagePreview(null); }}
                                        className="absolute top-2 left-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-all">
                                    <Camera className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2" />
                                    <span className="text-sm text-slate-500 dark:text-slate-400">اضغط لإضافة صورة</span>
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">التصنيف</label>
                        <div className="grid grid-cols-4 gap-2">
                            {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                                <button
                                    key={key}
                                    onClick={() => setFormData({ ...formData, category: key as ItemCategory })}
                                    className={`p-3 rounded-xl text-center transition-all ${formData.category === key
                                            ? 'bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-lg shadow-teal-500/20'
                                            : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                                        }`}
                                >
                                    <span className="text-xl">{CATEGORY_ICONS[key as ItemCategory]}</span>
                                    <p className="text-xs mt-1 font-medium">{name}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">الوصف *</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                            placeholder="وصف تفصيلي للعنصر..."
                            rows={3}
                        />
                    </div>

                    {/* Location & Room */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">مكان العثور *</label>
                            <div className="relative">
                                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                    placeholder={t('common.exampleLocation') || 'مثال: اللوبي'}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">رقم الغرفة</label>
                            <input
                                type="text"
                                value={formData.roomNumber}
                                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                placeholder={t('common.optional') || 'اختياري'}
                            />
                        </div>
                    </div>

                    {/* Guest Info (for lost items) */}
                    {formData.type === 'lost' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">اسم النزيل</label>
                                <input
                                    type="text"
                                    value={formData.guestName}
                                    onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">رقم التواصل</label>
                                <input
                                    type="tel"
                                    value={formData.guestContact}
                                    onChange={(e) => setFormData({ ...formData, guestContact: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                />
                            </div>
                        </div>
                    )}

                    {/* Storage Location */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">مكان التخزين</label>
                        <input
                            type="text"
                            value={formData.storageLocation}
                            onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                            placeholder={t('common.exampleStorage') || 'مثال: خزنة الاستقبال'}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">ملاحظات</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                            rows={2}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !formData.description.trim() || !formData.location.trim()}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-teal-400 to-teal-600 text-white font-bold hover:from-teal-500 hover:to-teal-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 transition-all"
                    >
                        {saving ? <AdoraLoaderInline size={20} /> : <Save className="w-5 h-5" />}
                        حفظ
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// CLAIM MODAL
// ============================================================

interface ClaimModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: LostFoundItem | null;
    onSubmit: (claimedBy: any) => Promise<void>;
}

const ClaimModal: React.FC<ClaimModalProps> = ({ isOpen, onClose, item, onSubmit }) => {
    const [formData, setFormData] = useState({
        name: '',
        contact: '',
        idType: 'national',
        idNumber: '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!formData.name.trim() || !formData.contact.trim()) return;
        setSaving(true);
        try {
            await onSubmit(formData);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Solid Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} style={{ backdropFilter: 'none' }} />
            {/* Modal Content */}
            <div className="relative w-full max-w-md rounded-2xl shadow-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <User className="w-5 h-5 text-white" />
                        </div>
                        تسجيل المطالبة
                    </h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Item Info */}
                    <div className="p-4 rounded-xl flex items-center gap-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-slate-600">
                        <span className="text-3xl">{CATEGORY_ICONS[item.category]}</span>
                        <div>
                            <p className="text-slate-800 dark:text-white font-medium">{item.description}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">{item.location}</p>
                        </div>
                    </div>

                    {/* Claimant Info */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">اسم المستلم *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">رقم التواصل *</label>
                        <input
                            type="tel"
                            value={formData.contact}
                            onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">نوع الهوية</label>
                            <select
                                value={formData.idType}
                                onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                            >
                                <option value="national">هوية وطنية</option>
                                <option value="passport">جواز سفر</option>
                                <option value="iqama">إقامة</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">رقم الهوية</label>
                            <input
                                type="text"
                                value={formData.idNumber}
                                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600">إلغاء</button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !formData.name.trim() || !formData.contact.trim()}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 hover:from-yellow-500 hover:to-orange-600 transition-all"
                    >
                        {saving ? <AdoraLoaderInline size={20} /> : <CheckCircle2 className="w-5 h-5" />}
                        تأكيد المطالبة
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// ITEM DETAILS MODAL
// ============================================================

interface ItemDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: LostFoundItem | null;
    onClaim: () => void;
    onReturn: () => void;
    onDispose: () => void;
}

const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({ isOpen, onClose, item, onClaim, onReturn, onDispose }) => {
    if (!isOpen || !item) return null;

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('ar-SA');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Solid Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} style={{ backdropFilter: 'none' }} />
            {/* Modal Content */}
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Eye className="w-5 h-5 text-white" />
                        </div>
                        تفاصيل العنصر
                    </h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Image */}
                    {item.imageUrl && (
                        <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600">
                            <img src={item.imageUrl} alt={item.description} className="w-full h-full object-cover" />
                        </div>
                    )}

                    {/* Status & Category */}
                    <div className="flex items-center gap-3">
                        <StatusBadge status={item.status} />
                        <CategoryBadge category={item.category} />
                    </div>

                    {/* Description */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">الوصف</p>
                        <p className="text-slate-800 dark:text-white font-medium">{item.description}</p>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">مكان العثور</p>
                            <p className="text-slate-800 dark:text-white font-medium">{item.location}</p>
                        </div>
                        {item.roomNumber && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">رقم الغرفة</p>
                                <p className="text-slate-800 dark:text-white font-medium">{item.roomNumber}</p>
                            </div>
                        )}
                        {item.storageLocation && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">مكان التخزين</p>
                                <p className="text-slate-800 dark:text-white font-medium">{item.storageLocation}</p>
                            </div>
                        )}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">تاريخ التسجيل</p>
                            <p className="text-slate-800 dark:text-white font-medium">{formatDate(item.createdAt)}</p>
                        </div>
                    </div>

                    {/* Found By */}
                    {item.foundBy && (
                        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border border-blue-200 dark:border-blue-800">
                            <p className="text-blue-600 dark:text-blue-400 text-sm mb-1 font-medium">سجّله</p>
                            <p className="text-slate-800 dark:text-white font-bold">{item.foundBy.name}</p>
                        </div>
                    )}

                    {/* Claimed By */}
                    {item.claimedBy && (
                        <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-50 to-orange-100 dark:from-yellow-900/30 dark:to-orange-800/30 border border-yellow-300 dark:border-yellow-800">
                            <p className="text-orange-600 dark:text-orange-400 text-sm mb-2 font-bold">بيانات المطالب</p>
                            <div className="space-y-2">
                                <p className="text-slate-800 dark:text-white"><span className="text-slate-500 dark:text-slate-400">الاسم:</span> {item.claimedBy.name}</p>
                                <p className="text-slate-700 dark:text-slate-300"><span className="text-slate-500 dark:text-slate-400">التواصل:</span> {item.claimedBy.contact}</p>
                                {item.claimedBy.idNumber && (
                                    <p className="text-slate-700 dark:text-slate-300"><span className="text-slate-500 dark:text-slate-400">الهوية:</span> {item.claimedBy.idNumber}</p>
                                )}
                                <p className="text-slate-500 dark:text-slate-400 text-sm">بتاريخ: {formatDate(item.claimedAt)}</p>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {item.notes && (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">ملاحظات</p>
                            <p className="text-slate-700 dark:text-slate-300">{item.notes}</p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 p-5 border-t border-slate-200 dark:border-slate-700">
                    {item.status === 'found' && (
                        <button
                            onClick={onClaim}
                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 hover:from-yellow-500 hover:to-orange-600 transition-all"
                        >
                            <User className="w-5 h-5" />
                            تسجيل مطالبة
                        </button>
                    )}
                    {item.status === 'claimed' && (
                        <button
                            onClick={onReturn}
                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/25 hover:from-green-500 hover:to-emerald-600 transition-all"
                        >
                            <CheckCircle2 className="w-5 h-5" />
                            تأكيد التسليم
                        </button>
                    )}
                    {(item.status === 'found' || item.status === 'claimed') && (
                        <button
                            onClick={onDispose}
                            className="py-3 px-5 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium flex items-center justify-center gap-2 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all"
                        >
                            <Trash2 className="w-5 h-5" />
                            تخلص
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="py-3 px-6 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600"
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

export const LostFoundManagement: React.FC = () => {
    const { user } = useAuth();
    const { t } = useTranslation();
    const branchId = useMemo(() => (user as any)?.branch || 'default', [user]);
    const tenantId = useMemo(() => (user as any)?.tenantId || '', [user]); // ✅ FIX: Get tenantId

    // State
    const [items, setItems] = useState<LostFoundItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<ItemStatus | 'all'>('all');
    const [stats, setStats] = useState<any>(null);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);

    // Load data
    useEffect(() => {
        // ✅ FIX: Pass tenantId for tenant-scoped collection
        if (!tenantId) {
            logger.warn('LostFoundManagement: tenantId is required', null, 'LostFoundManagement');
            return;
        }
        const unsubscribe = subscribeToLostFound(branchId, (data) => {
            setItems(data);
            setLoading(false);
        }, undefined, tenantId);

        const loadStats = async () => {
            const statsData = await getLostFoundStats(branchId, tenantId);
            setStats(statsData);
        };
        loadStats();

        return unsubscribe;
    }, [branchId]);

    // Filtered items
    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            const matchesSearch = item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.location.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [items, searchQuery, filterStatus]);

    // Handlers
    const handleAddItem = async (data: any, image?: File) => {
        await addLostFoundItem(data, image);
        const statsData = await getLostFoundStats(branchId);
        setStats(statsData);
    };

    const handleClaimItem = async (claimedBy: any) => {
        if (!selectedItem) return;
        // ✅ FIX: Pass tenantId for tenant-scoped collection
        const tenantId = selectedItem.tenantId || (user as any)?.tenantId;
        if (!tenantId) {
            throw new Error('tenantId is required');
        }
        await claimItem(selectedItem.id, claimedBy, tenantId);
        setShowClaimModal(false);
        setShowDetailsModal(false);
    };

    const handleReturnItem = async () => {
        if (!selectedItem) return;
        // ✅ FIX: Pass tenantId for tenant-scoped collection
        const tenantId = selectedItem.tenantId || (user as any)?.tenantId;
        if (!tenantId) {
            throw new Error('tenantId is required');
        }
        await returnItem(selectedItem.id, { id: user?.id || '', name: user?.name || '' }, tenantId);
        setShowDetailsModal(false);
    };

    const handleDisposeItem = async () => {
        if (!selectedItem) return;
        // ✅ FIX: Pass tenantId for tenant-scoped collection
        const tenantId = selectedItem.tenantId || (user as any)?.tenantId;
        if (!tenantId) {
            throw new Error('tenantId is required');
        }
        if (confirm(t('lostFound.disposeConfirm') || 'هل أنت متأكد من التخلص من هذا العنصر؟')) {
            await disposeItem(selectedItem.id, tenantId);
            setShowDetailsModal(false);
        }
    };

    const openItemDetails = (item: LostFoundItem) => {
        setSelectedItem(item);
        setShowDetailsModal(true);
    };

    const openClaimModal = () => {
        setShowDetailsModal(false);
        setShowClaimModal(true);
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
                        <SearchIcon className="w-8 h-8 text-teal-400" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-extrabold text-white tracking-tight">المفقودات والموجودات</h2>
                        <p className="text-white/40 text-sm mt-0.5">إدارة العناصر المفقودة والموجودة داخل الفندق</p>
                    </div>
                </div>

                <button
                    onClick={() => setShowAddModal(true)}
                    className="w-full md:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold shadow-xl shadow-teal-500/20 hover:shadow-teal-500/40 active:scale-95 transition-all flex items-center justify-center gap-2 border border-teal-400/20"
                >
                    <Plus className="w-5 h-5" />
                    تسجيل عنصر جديد
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatsCard
                        title={t('lostFound.itemsFound') || 'عناصر موجودة'}
                        value={stats.found}
                        color="#3B82F6"
                        icon={<Package className="w-6 h-6" />}
                    />
                    <StatsCard
                        title={t('lostFound.itemsClaimed') || 'مطالب بها'}
                        value={stats.claimed}
                        color="#F59E0B"
                        icon={<User className="w-6 h-6" />}
                    />
                    <StatsCard
                        title={t('lostFound.itemsReturned') || 'تم إرجاعها'}
                        value={stats.returned}
                        color="#22C55E"
                        icon={<CheckCircle2 className="w-6 h-6" />}
                    />
                    <StatsCard
                        title={t('common.total') || 'الإجمالي'}
                        value={stats.total}
                        color="#8B5CF6"
                        icon={<FileText className="w-6 h-6" />}
                    />
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                    <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pr-12 pl-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                        placeholder={t('lostFound.searchByDescriptionOrLocation') || 'البحث بالوصف أو المكان...'}
                    />
                </div>

                {/* Status Filter */}
                <div className="flex gap-2">
                    {(['all', 'found', 'claimed', 'returned', 'disposed'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${filterStatus === status
                                    ? 'bg-teal-500 text-white'
                                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                                }`}
                        >
                            {status === 'all' ? t('common.all') || 'الكل' : (status === 'found' ? (t('lostFound.status.found') || STATUS_NAMES.found) : status === 'claimed' ? (t('lostFound.status.claimed') || STATUS_NAMES.claimed) : status === 'returned' ? (t('lostFound.status.returned') || STATUS_NAMES.returned) : status === 'disposed' ? (t('lostFound.status.disposed') || STATUS_NAMES.disposed) : STATUS_NAMES[status as ItemStatus])}
                        </button>
                    ))}
                </div>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => openItemDetails(item)}
                        className="p-4 rounded-2xl cursor-pointer hover:scale-[1.02] transition-all transition-colors duration-300"
                        style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}
                    >
                        {/* Header */}
                        <div className="flex items-start gap-3 mb-3">
                            {item.imageUrl ? (
                                <img
                                    src={item.imageUrl}
                                    alt={item.description}
                                    className="w-16 h-16 rounded-xl object-cover"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center text-3xl">
                                    {CATEGORY_ICONS[item.category]}
                                </div>
                            )}
                            <div className="flex-1">
                                <p className="text-white font-medium line-clamp-2">{item.description}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <MapPin className="w-3 h-3 text-white/40" />
                                    <span className="text-white/50 text-sm">{item.location}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-white/10">
                            <StatusBadge status={item.status} />
                            <div className="flex items-center gap-1 text-white/40 text-xs">
                                <Clock className="w-3 h-3" />
                                {item.createdAt?.toDate?.().toLocaleDateString('ar-SA') || '-'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {filteredItems.length === 0 && (
                <div className="text-center py-12">
                    <SearchIcon className="w-16 h-16 text-white/20 mx-auto mb-4" />
                    <p className="text-white/40">لا توجد عناصر</p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="mt-4 px-6 py-3 rounded-xl bg-teal-500 text-white font-bold"
                    >
                        تسجيل أول عنصر
                    </button>
                </div>
            )}

            {/* Modals */}
            <AddItemModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSave={handleAddItem}
                branchId={branchId}
                userId={user?.id || ''}
                userName={user?.name || ''}
            />

            <ClaimModal
                isOpen={showClaimModal}
                onClose={() => setShowClaimModal(false)}
                item={selectedItem}
                onSubmit={handleClaimItem}
            />

            <ItemDetailsModal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                item={selectedItem}
                onClaim={openClaimModal}
                onReturn={handleReturnItem}
                onDispose={handleDisposeItem}
            />
        </div>
    );
};

export default LostFoundManagement;
