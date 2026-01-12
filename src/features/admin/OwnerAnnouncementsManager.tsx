/**
 * Owner Announcements Manager
 * Allows owner to create and manage urgent announcements for managers
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import {
    Bell, Plus, Trash2, Edit2, Save, X, AlertTriangle, Sparkles,
    Wrench, Info, Calendar, Users, Building2, Eye, TrendingUp, Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useTenant } from '../../context/TenantContext';
import { useTenantBranches } from '../../hooks/useTenantData';
import {
    subscribeToAllOwnerAnnouncements,
    createOwnerAnnouncement,
    updateOwnerAnnouncement,
    deactivateOwnerAnnouncement,
    getAnnouncementStats,
    type OwnerAnnouncement
} from '../../services/ownerAnnouncementService';
import { Timestamp } from 'firebase/firestore';

export const OwnerAnnouncementsManager: React.FC = () => {
    const { user } = useAuth();
    const { success, error } = useUX();
    const { tenantId } = useTenant();
    const { branches: rawBranches } = useTenantBranches();
    
    // ✅ ARCHITECT FIX: Ensure branches is always an array (SaaS Safety)
    const branches = Array.isArray(rawBranches) ? rawBranches : [];

    const [announcements, setAnnouncements] = useState<OwnerAnnouncement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<OwnerAnnouncement | null>(null);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<OwnerAnnouncement | null>(null);
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState<any>(null);

    // Form state
    const [formData, setFormData] = useState<Partial<OwnerAnnouncement>>({
        title: '',
        titleAr: '',
        message: '',
        messageAr: '',
        type: 'general',
        priority: 'medium',
        targetAudience: 'all_managers',
        targetBranches: [],
        targetTenants: [],
        showAsBanner: true,
        showAsModal: false,
        autoShow: true,
        dismissible: true,
        showCount: 0, // 0 = unlimited
        isActive: true
    });

    useEffect(() => {
        if (!user || user.role !== 'owner') return;

        const unsubscribe = subscribeToAllOwnerAnnouncements((announcementsList) => {
            setAnnouncements(announcementsList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleEdit = (announcement: OwnerAnnouncement) => {
        setFormData(announcement);
        setEditingAnnouncement(announcement);
        setShowModal(true);
    };

    const handleDelete = async (announcementId: string) => {
        if (!confirm('هل أنت متأكد من حذف هذه الرسالة؟')) return;
        try {
            await deactivateOwnerAnnouncement(announcementId);
            success('تم حذف الرسالة');
        } catch (err) {
            error('فشل حذف الرسالة');
        }
    };

    const handleViewStats = async (announcement: OwnerAnnouncement) => {
        try {
            const statsData = await getAnnouncementStats(announcement.id);
            setStats(statsData);
            setSelectedAnnouncement(announcement);
            setShowStats(true);
        } catch (err) {
            error('فشل تحميل الإحصائيات');
        }
    };

    const handleSave = async () => {
        if (!user || !formData.titleAr?.trim() || !formData.messageAr?.trim()) {
            error('يرجى إدخال العنوان والرسالة');
            return;
        }

        try {
            if (editingAnnouncement) {
                await updateOwnerAnnouncement(
                    editingAnnouncement.id,
                    formData as Partial<OwnerAnnouncement>,
                    user.id,
                    user.name || ''
                );
                success('تم تحديث الرسالة');
            } else {
                await createOwnerAnnouncement(
                    formData as Omit<OwnerAnnouncement, 'id' | 'createdAt' | 'views' | 'dismissals'>,
                    user.id,
                    user.name || ''
                );
                success('تم إرسال الرسالة العاجلة');
            }
            setShowModal(false);
            setFormData({
                title: '',
                titleAr: '',
                message: '',
                messageAr: '',
                type: 'general',
                priority: 'medium',
                targetAudience: 'all_managers',
                targetBranches: [],
                targetTenants: [],
                showAsBanner: true,
                showAsModal: false,
                autoShow: true,
                dismissible: true,
                showCount: 0,
                isActive: true
            });
        } catch (err) {
            error('فشل حفظ الرسالة');
        }
    };

    if (loading) return null;

    return (
        <>
            <div className="min-h-screen theme-page p-6">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                <Bell className="w-6 h-6 text-amber-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">الرسائل العاجلة للمديرين</h1>
                                <p className="text-sm text-white/60">إرسال رسائل عاجلة تظهر كشريط إخباري للمديرين</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setEditingAnnouncement(null);
                                setFormData({
                                    title: '',
                                    titleAr: '',
                                    message: '',
                                    messageAr: '',
                                    type: 'general',
                                    priority: 'medium',
                                    targetAudience: 'all_managers',
                                    targetBranches: [],
                                    targetTenants: [],
                                    showAsBanner: true,
                                    showAsModal: false,
                                    autoShow: true,
                                    dismissible: true,
                                    showCount: 0,
                                    isActive: true
                                });
                                setShowModal(true);
                            }}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold hover:shadow-lg hover:shadow-amber-500/25 transition-all flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            رسالة عاجلة جديدة
                        </button>
                    </div>

                    {/* Quick Templates */}
                    <div className="mb-6">
                        <p className="text-sm text-white/60 mb-3">قوالب سريعة:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <button
                                onClick={() => {
                                    setFormData({
                                        title: 'Subscription Warning',
                                        titleAr: 'تنبيه انتهاء الاشتراك',
                                        message: 'Your subscription will expire in 7 days. Please renew to continue using the service.',
                                        messageAr: 'سينتهي اشتراكك خلال 7 أيام. يرجى التجديد للاستمرار في استخدام الخدمة.',
                                        type: 'subscription_warning',
                                        priority: 'critical',
                                        targetAudience: 'all_managers',
                                        showAsBanner: true,
                                        showAsModal: true,
                                        autoShow: true,
                                        dismissible: false,
                                        showCount: 0,
                                        isActive: true
                                    });
                                    setEditingAnnouncement(null);
                                    setShowModal(true);
                                }}
                                className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors text-right"
                            >
                                <div className="text-2xl mb-1">⚠️</div>
                                <div className="text-red-400 font-medium text-sm">انتهاء الاشتراك</div>
                            </button>
                            <button
                                onClick={() => {
                                    setFormData({
                                        title: 'Update Notification',
                                        titleAr: 'تحديث جديد',
                                        message: 'A new update is available with improved features and bug fixes.',
                                        messageAr: 'تحديث جديد متاح مع ميزات محسنة وإصلاحات للأخطاء.',
                                        type: 'update_notification',
                                        priority: 'high',
                                        targetAudience: 'all_managers',
                                        showAsBanner: true,
                                        showAsModal: false,
                                        autoShow: true,
                                        dismissible: true,
                                        showCount: 3,
                                        isActive: true
                                    });
                                    setEditingAnnouncement(null);
                                    setShowModal(true);
                                }}
                                className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors text-right"
                            >
                                <div className="text-2xl mb-1">✨</div>
                                <div className="text-blue-400 font-medium text-sm">تحديث جديد</div>
                            </button>
                            <button
                                onClick={() => {
                                    setFormData({
                                        title: 'Feature Announcement',
                                        titleAr: 'ميزة جديدة',
                                        message: 'We have added a new feature: [Feature Name]. Check it out in the dashboard!',
                                        messageAr: 'تمت إضافة ميزة جديدة: [اسم الميزة]. تحقق منها في لوحة التحكم!',
                                        type: 'feature_announcement',
                                        priority: 'high',
                                        targetAudience: 'all_managers',
                                        showAsBanner: true,
                                        showAsModal: false,
                                        autoShow: true,
                                        dismissible: true,
                                        showCount: 5,
                                        isActive: true
                                    });
                                    setEditingAnnouncement(null);
                                    setShowModal(true);
                                }}
                                className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-colors text-right"
                            >
                                <div className="text-2xl mb-1">🎉</div>
                                <div className="text-green-400 font-medium text-sm">ميزة جديدة</div>
                            </button>
                            <button
                                onClick={() => {
                                    setFormData({
                                        title: 'Maintenance Notice',
                                        titleAr: 'إشعار صيانة',
                                        message: 'Scheduled maintenance will occur on [Date] from [Time] to [Time].',
                                        messageAr: 'سيتم إجراء صيانة مجدولة في [التاريخ] من [الوقت] إلى [الوقت].',
                                        type: 'maintenance',
                                        priority: 'medium',
                                        targetAudience: 'all_managers',
                                        showAsBanner: true,
                                        showAsModal: false,
                                        autoShow: true,
                                        dismissible: true,
                                        showCount: 0,
                                        isActive: true
                                    });
                                    setEditingAnnouncement(null);
                                    setShowModal(true);
                                }}
                                className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 transition-colors text-right"
                            >
                                <div className="text-2xl mb-1">🔧</div>
                                <div className="text-orange-400 font-medium text-sm">صيانة</div>
                            </button>
                        </div>
                    </div>

                    {/* Announcements List */}
                    <div className="space-y-4">
                        {announcements.map(announcement => (
                            <div
                                key={announcement.id}
                                className="glass-card p-4 rounded-xl border border-white/10 hover:border-amber-500/30 transition-all"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                            announcement.priority === 'critical' ? 'bg-red-500/20' :
                                            announcement.priority === 'high' ? 'bg-orange-500/20' :
                                            announcement.priority === 'medium' ? 'bg-yellow-500/20' :
                                            'bg-blue-500/20'
                                        }`}>
                                            {announcement.type === 'subscription_warning' ? <AlertTriangle className="w-5 h-5 text-red-400" /> :
                                             announcement.type === 'update_notification' ? <Sparkles className="w-5 h-5 text-blue-400" /> :
                                             announcement.type === 'feature_announcement' ? <Bell className="w-5 h-5 text-green-400" /> :
                                             announcement.type === 'maintenance' ? <Wrench className="w-5 h-5 text-orange-400" /> :
                                             <Info className="w-5 h-5 text-blue-400" />}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-white font-semibold mb-1">{announcement.titleAr || announcement.title}</h3>
                                            <p className="text-white/60 text-sm line-clamp-2">{announcement.messageAr || announcement.message}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            announcement.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                            announcement.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                            announcement.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-blue-500/20 text-blue-400'
                                        }`}>
                                            {announcement.priority === 'critical' ? 'حرج' :
                                             announcement.priority === 'high' ? 'مهم' :
                                             announcement.priority === 'medium' ? 'متوسط' : 'منخفض'}
                                        </span>
                                        <button
                                            onClick={() => handleViewStats(announcement)}
                                            className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                            title="الإحصائيات"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleEdit(announcement)}
                                            className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(announcement.id)}
                                            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 pt-3 border-t border-white/10 text-xs text-white/40">
                                    <span className={announcement.isActive ? 'text-green-400' : 'text-red-400'}>
                                        {announcement.isActive ? 'نشط' : 'غير نشط'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {announcement.targetAudience === 'all_managers' ? 'جميع المشتركين' :
                                         announcement.targetAudience === 'specific_branches' ? `${announcement.targetBranches?.length || 0} فرع` :
                                         `${announcement.targetTenants?.length || 0} مشترك`}
                                    </span>
                                    {announcement.showAsBanner && (
                                        <span className="flex items-center gap-1">
                                            <Bell className="w-3 h-3" />
                                            شريط إخباري
                                        </span>
                                    )}
                                    {announcement.expiresAt && (
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(announcement.expiresAt.toDate ? announcement.expiresAt.toDate() : announcement.expiresAt).toLocaleString('ar-SA')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {announcements.length === 0 && (
                            <div className="text-center py-12 text-white/40">
                                <Bell className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <p>لا توجد رسائل عاجلة</p>
                                <p className="text-xs mt-1">استخدم القوالب السريعة أو أضف رسالة مخصصة</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Announcement Modal */}
            {showModal && (
                <AnnouncementModal
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSave}
                    onClose={() => {
                        setShowModal(false);
                        setEditingAnnouncement(null);
                    }}
                    branches={branches}
                    editingAnnouncement={editingAnnouncement}
                />
            )}

            {/* Stats Modal */}
            {showStats && selectedAnnouncement && stats && (
                <StatsModal
                    announcement={selectedAnnouncement}
                    stats={stats}
                    onClose={() => {
                        setShowStats(false);
                        setSelectedAnnouncement(null);
                        setStats(null);
                    }}
                />
            )}
        </>
    );
};

// Announcement Modal Component
const AnnouncementModal: React.FC<{
    formData: Partial<OwnerAnnouncement>;
    setFormData: (data: Partial<OwnerAnnouncement>) => void;
    onSave: () => void;
    onClose: () => void;
    branches: any[];
    editingAnnouncement: OwnerAnnouncement | null;
}> = ({ formData, setFormData, onSave, onClose, branches: rawBranches, editingAnnouncement }) => {
    // ✅ ARCHITECT FIX: Ensure branches is always an array (SaaS Safety)
    const branches = Array.isArray(rawBranches) ? rawBranches : [];
    const [selectedBranches, setSelectedBranches] = useState<string[]>(formData.targetBranches || []);

    const toggleBranch = (branchId: string) => {
        if (selectedBranches.includes(branchId)) {
            const newBranches = selectedBranches.filter(b => b !== branchId);
            setSelectedBranches(newBranches);
            setFormData({ ...formData, targetBranches: newBranches });
        } else {
            const newBranches = [...selectedBranches, branchId];
            setSelectedBranches(newBranches);
            setFormData({ ...formData, targetBranches: newBranches });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl modal-enter">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">رسالة عاجلة للمديرين</h2>
                        <button onClick={onClose} className="text-white/60 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Type */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">نوع الرسالة</label>
                            <select
                                value={formData.type || 'general'}
                                onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none transition-all"
                            >
                                <option value="subscription_warning">تنبيه انتهاء الاشتراك</option>
                                <option value="update_notification">إشعار تحديث</option>
                                <option value="feature_announcement">إعلان ميزة جديدة</option>
                                <option value="maintenance">إشعار صيانة</option>
                                <option value="urgent">عاجل</option>
                                <option value="general">عام</option>
                            </select>
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">الأولوية</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { value: 'low', label: 'منخفضة', color: 'blue' },
                                    { value: 'medium', label: 'متوسطة', color: 'yellow' },
                                    { value: 'high', label: 'عالية', color: 'orange' },
                                    { value: 'critical', label: 'حرج', color: 'red' }
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

                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">العنوان بالعربية *</label>
                                <input
                                    type="text"
                                    value={formData.titleAr || ''}
                                    onChange={e => setFormData({ ...formData, titleAr: e.target.value })}
                                    placeholder="تنبيه انتهاء الاشتراك"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">العنوان بالإنجليزية</label>
                                <input
                                    type="text"
                                    value={formData.title || ''}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Subscription Warning"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">الرسالة بالعربية *</label>
                            <textarea
                                value={formData.messageAr || ''}
                                onChange={e => setFormData({ ...formData, messageAr: e.target.value })}
                                placeholder="سينتهي اشتراكك خلال 7 أيام..."
                                rows={4}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white resize-none focus:border-amber-500/50 focus:outline-none transition-all"
                            />
                        </div>

                        {/* Targeting */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">الجمهور المستهدف</label>
                            <select
                                value={formData.targetAudience || 'all_managers'}
                                onChange={e => {
                                    setFormData({ ...formData, targetAudience: e.target.value as any });
                                    if (e.target.value !== 'specific_branches') {
                                        setSelectedBranches([]);
                                    }
                                }}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none transition-all"
                            >
                                <option value="all_managers">جميع المشتركين</option>
                                <option value="specific_branches">فروع محددة</option>
                            </select>
                        </div>

                        {/* Branch Selection */}
                        {formData.targetAudience === 'specific_branches' && (
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <label className="block text-sm text-white/60 mb-3">اختر الفروع:</label>
                                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                                    {branches.map(branch => (
                                        <button
                                            key={branch.id}
                                            onClick={() => toggleBranch(branch.id)}
                                            className={`py-2 px-3 rounded-lg text-sm transition-all ${
                                                selectedBranches.includes(branch.id)
                                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                    : 'bg-white/10 text-white/60 border border-white/10 hover:bg-white/20'
                                            }`}
                                        >
                                            {branch.name || branch.id}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Display Settings */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm text-white/60">عرض كشريط إخباري</span>
                                    <button
                                        onClick={() => setFormData({ ...formData, showAsBanner: !formData.showAsBanner })}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${formData.showAsBanner
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : 'bg-white/10 text-white/60 border border-white/10'
                                            }`}
                                    >
                                        {formData.showAsBanner ? 'مفعّل' : 'معطّل'}
                                    </button>
                                </label>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm text-white/60">يمكن إغلاقه</span>
                                    <button
                                        onClick={() => setFormData({ ...formData, dismissible: !formData.dismissible })}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${formData.dismissible
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : 'bg-white/10 text-white/60 border border-white/10'
                                            }`}
                                    >
                                        {formData.dismissible ? 'نعم' : 'لا'}
                                    </button>
                                </label>
                            </div>
                        </div>

                        {/* Timing */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">تاريخ البدء (اختياري)</label>
                                <input
                                    type="datetime-local"
                                    value={formData.startDate ? new Date(formData.startDate.toDate ? formData.startDate.toDate() : formData.startDate).toISOString().slice(0, 16) : ''}
                                    onChange={e => {
                                        if (e.target.value) {
                                            setFormData({ ...formData, startDate: Timestamp.fromDate(new Date(e.target.value)) });
                                        } else {
                                            setFormData({ ...formData, startDate: undefined });
                                        }
                                    }}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">تاريخ الانتهاء (اختياري)</label>
                                <input
                                    type="datetime-local"
                                    value={formData.expiresAt ? new Date(formData.expiresAt.toDate ? formData.expiresAt.toDate() : formData.expiresAt).toISOString().slice(0, 16) : ''}
                                    onChange={e => {
                                        if (e.target.value) {
                                            setFormData({ ...formData, expiresAt: Timestamp.fromDate(new Date(e.target.value)) });
                                        } else {
                                            setFormData({ ...formData, expiresAt: undefined });
                                        }
                                    }}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none transition-all"
                                />
                            </div>
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
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold hover:shadow-lg hover:shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                {editingAnnouncement ? 'تحديث' : 'إرسال'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Stats Modal Component
const StatsModal: React.FC<{
    announcement: OwnerAnnouncement;
    stats: any;
    onClose: () => void;
}> = ({ announcement, stats, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-2xl rounded-2xl modal-enter">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">إحصائيات الرسالة</h2>
                        <button onClick={onClose} className="text-white/60 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                                <div className="text-blue-400 text-sm mb-1">إجمالي المشاهدات</div>
                                <div className="text-white text-2xl font-bold">{stats.totalViews}</div>
                            </div>
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                                <div className="text-red-400 text-sm mb-1">إجمالي الإغلاقات</div>
                                <div className="text-white text-2xl font-bold">{stats.totalDismissals}</div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-white font-semibold mb-3">المشاهدات حسب المشترك</h3>
                            <div className="space-y-2">
                                {Object.entries(stats.viewsByTenant).map(([tenantId, count]) => (
                                    <div key={tenantId} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                                        <span className="text-white/60 text-sm">{tenantId}</span>
                                        <span className="text-white font-medium">{count as number} مشاهدة</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full mt-6 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                    >
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
};
