/**
 * Manager Announcements Manager
 * Allows manager to create and manage urgent announcements for all departments
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import {
    Bell, Plus, Trash2, Edit2, Save, X, AlertTriangle, Zap,
    Droplet, Wrench, Info, Calendar, Users, Building2, Eye, TrendingUp, Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useTenant } from '../../context/TenantContext';
import { useTranslation } from 'react-i18next';
import {
    subscribeToAllManagerAnnouncements,
    createManagerAnnouncement,
    updateManagerAnnouncement,
    deactivateManagerAnnouncement,
    getManagerAnnouncementStats,
    getAnnouncementAuditLog,
    type ManagerAnnouncement,
    type DepartmentType,
    type ManagerAnnouncementView
} from '../../services/managerAnnouncementService';
import { Timestamp } from 'firebase/firestore';
import { formatDateTimeGregorianEn } from '../../utils/dateUtils';

const DEPARTMENTS: { value: DepartmentType; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'جميع الأقسام', icon: <Users className="w-4 h-4" /> },
    { value: 'reception', label: 'الاستقبال', icon: <Building2 className="w-4 h-4" /> },
    { value: 'housekeeping', label: 'الهاوس كيبنج', icon: <Users className="w-4 h-4" /> },
    { value: 'maintenance', label: 'الصيانة', icon: <Wrench className="w-4 h-4" /> },
    { value: 'bellman', label: 'البيلمان', icon: <Users className="w-4 h-4" /> },
    { value: 'coffee_shop', label: 'الكوفي شوب', icon: <Bell className="w-4 h-4" /> },
    { value: 'procurement', label: 'المشتريات', icon: <Building2 className="w-4 h-4" /> }
];

export const ManagerAnnouncementsManager: React.FC = () => {
    const { user } = useAuth();
    const { success, error } = useUX();
    const { tenantId } = useTenant();
    const { t } = useTranslation();
    const branchId = (user as any)?.branchId || (user as any)?.branch;

    const [announcements, setAnnouncements] = useState<ManagerAnnouncement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<ManagerAnnouncement | null>(null);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<ManagerAnnouncement | null>(null);
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [showAuditLog, setShowAuditLog] = useState(false);
    const [auditLog, setAuditLog] = useState<ManagerAnnouncementView[]>([]);
    const [auditAnnouncement, setAuditAnnouncement] = useState<ManagerAnnouncement | null>(null);

    // Form state
    const [formData, setFormData] = useState<Partial<ManagerAnnouncement>>({
        title: '',
        titleAr: '',
        message: '',
        messageAr: '',
        type: 'general',
        priority: 'medium',
        targetDepartments: ['all'],
        showAsBanner: true,
        showAsModal: false,
        autoShow: true,
        dismissible: true,
        isActive: true,
        branchId: branchId
    });

    useEffect(() => {
        if (!user || !tenantId) return;
        const isManager = ['manager', 'owner', 'admin'].includes(user.role || '');

        if (!isManager) return;

        const unsubscribe = subscribeToAllManagerAnnouncements(tenantId, (announcementsList) => {
            setAnnouncements(announcementsList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, tenantId]);

    const handleEdit = (announcement: ManagerAnnouncement) => {
        setFormData(announcement);
        setEditingAnnouncement(announcement);
        setShowModal(true);
    };

    const handleDelete = async (announcementId: string) => {
        if (!confirm(t('admin.deleteConfirm') || 'هل أنت متأكد من حذف هذه الرسالة؟')) return;
        if (!tenantId) return;
        try {
            await deactivateManagerAnnouncement(tenantId, announcementId);
            success(t('admin.deleteSuccess') || 'تم الحذف بنجاح');
        } catch (err) {
            error('فشل حذف الرسالة');
        }
    };

    const handleViewStats = async (announcement: ManagerAnnouncement) => {
        if (!tenantId) return;
        try {
            const statsData = await getManagerAnnouncementStats(tenantId, announcement.id);
            setStats(statsData);
            setSelectedAnnouncement(announcement);
            setShowStats(true);
        } catch (err) {
            error('فشل تحميل الإحصائيات');
        }
    };

    const handleViewAuditLog = async (announcement: ManagerAnnouncement) => {
        if (!tenantId) return;
        try {
            const log = await getAnnouncementAuditLog(tenantId, announcement.id);
            setAuditLog(log.views);
            setAuditAnnouncement(announcement);
            setShowAuditLog(true);
        } catch (err) {
            error('فشل تحميل سجل الرسالة');
        }
    };

    const handleSave = async () => {
        if (!user || !tenantId || !formData.titleAr?.trim() || !formData.messageAr?.trim()) {
            error('يرجى إدخال العنوان والرسالة');
            return;
        }

        try {
            if (editingAnnouncement) {
                await updateManagerAnnouncement(
                    tenantId,
                    editingAnnouncement.id,
                    formData as Partial<ManagerAnnouncement>,
                    user.id,
                    user.name || ''
                );
                success('تم تحديث الرسالة');
            } else {
                await createManagerAnnouncement(
                    tenantId,
                    formData as Omit<ManagerAnnouncement, 'id' | 'createdAt' | 'views' | 'dismissals' | 'tenantId'>,
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
                targetDepartments: ['all'],
                showAsBanner: true,
                showAsModal: false,
                autoShow: true,
                dismissible: true,
                isActive: true,
                branchId: branchId
            });
        } catch (err) {
            error('فشل حفظ الرسالة');
        }
    };

    const toggleDepartment = (dept: DepartmentType) => {
        const current = formData.targetDepartments || [];
        if (dept === 'all') {
            setFormData({ ...formData, targetDepartments: ['all'] });
        } else {
            const newDepts = current.includes('all')
                ? [dept]
                : current.includes(dept)
                    ? current.filter(d => d !== dept)
                    : [...current, dept];
            setFormData({ ...formData, targetDepartments: newDepts.length === 0 ? ['all'] : newDepts });
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
                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <Bell className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">الرسائل العاجلة للأقسام</h1>
                                <p className="text-sm text-white/60">إرسال رسائل عاجلة تظهر كشريط إخباري في جميع الأقسام</p>
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
                                    targetDepartments: ['all'],
                                    showAsBanner: true,
                                    showAsModal: false,
                                    autoShow: true,
                                    dismissible: true,
                                    isActive: true,
                                    branchId: branchId
                                });
                                setShowModal(true);
                            }}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center gap-2"
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
                                        title: 'Power Outage Alert',
                                        titleAr: 'تنبيه انقطاع الكهرباء',
                                        message: 'Power will be cut off at 5:00 PM. Please take necessary precautions.',
                                        messageAr: 'سيتم قطع الكهرباء الساعة 5:00 مساءً. يرجى اتخاذ الاحتياطات اللازمة.',
                                        type: 'power_outage',
                                        priority: 'critical',
                                        scheduledTime: '5:00 PM',
                                        targetDepartments: ['all'],
                                        showAsBanner: true,
                                        showAsModal: true,
                                        autoShow: true,
                                        dismissible: false,
                                        isActive: true,
                                        branchId: branchId
                                    });
                                    setEditingAnnouncement(null);
                                    setShowModal(true);
                                }}
                                className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors text-right"
                            >
                                <div className="text-2xl mb-1">⚡</div>
                                <div className="text-red-400 font-medium text-sm">انقطاع الكهرباء</div>
                            </button>
                            <button
                                onClick={() => {
                                    setFormData({
                                        title: 'Water Outage Alert',
                                        titleAr: 'تنبيه انقطاع المياه',
                                        message: 'Water will be cut off at 2:00 PM. Please prepare in advance.',
                                        messageAr: 'سيتم قطع المياه الساعة 2:00 مساءً. يرجى الاستعداد مسبقاً.',
                                        type: 'water_outage',
                                        priority: 'high',
                                        scheduledTime: '2:00 PM',
                                        targetDepartments: ['all'],
                                        showAsBanner: true,
                                        showAsModal: false,
                                        autoShow: true,
                                        dismissible: true,
                                        isActive: true,
                                        branchId: branchId
                                    });
                                    setEditingAnnouncement(null);
                                    setShowModal(true);
                                }}
                                className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors text-right"
                            >
                                <div className="text-2xl mb-1">💧</div>
                                <div className="text-blue-400 font-medium text-sm">انقطاع المياه</div>
                            </button>
                            <button
                                onClick={() => {
                                    setFormData({
                                        title: 'Maintenance Alert',
                                        titleAr: 'تنبيه صيانة',
                                        message: 'Scheduled maintenance will occur today at 3:00 PM. Some services may be temporarily unavailable.',
                                        messageAr: 'سيتم إجراء صيانة مجدولة اليوم الساعة 3:00 مساءً. قد تكون بعض الخدمات غير متاحة مؤقتاً.',
                                        type: 'maintenance_alert',
                                        priority: 'high',
                                        scheduledTime: '3:00 PM',
                                        targetDepartments: ['all'],
                                        showAsBanner: true,
                                        showAsModal: false,
                                        autoShow: true,
                                        dismissible: true,
                                        isActive: true,
                                        branchId: branchId
                                    });
                                    setEditingAnnouncement(null);
                                    setShowModal(true);
                                }}
                                className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 transition-colors text-right"
                            >
                                <div className="text-2xl mb-1">🔧</div>
                                <div className="text-orange-400 font-medium text-sm">صيانة</div>
                            </button>
                            <button
                                onClick={() => {
                                    setFormData({
                                        title: 'System Update',
                                        titleAr: 'تحديث النظام',
                                        message: 'A system update is scheduled for tomorrow. The system will be unavailable for 30 minutes.',
                                        messageAr: 'تم جدولة تحديث النظام غداً. سيكون النظام غير متاح لمدة 30 دقيقة.',
                                        type: 'system_update',
                                        priority: 'medium',
                                        targetDepartments: ['all'],
                                        showAsBanner: true,
                                        showAsModal: false,
                                        autoShow: true,
                                        dismissible: true,
                                        isActive: true,
                                        branchId: branchId
                                    });
                                    setEditingAnnouncement(null);
                                    setShowModal(true);
                                }}
                                className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-colors text-right"
                            >
                                <div className="text-2xl mb-1">🔄</div>
                                <div className="text-green-400 font-medium text-sm">تحديث النظام</div>
                            </button>
                        </div>
                    </div>

                    {/* Announcements List */}
                    <div className="space-y-4">
                        {announcements.map(announcement => (
                            <div
                                key={announcement.id}
                                className="glass-card p-4 rounded-xl border border-white/10 hover:border-blue-500/30 transition-all"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                            announcement.priority === 'critical' ? 'bg-red-500/20' :
                                            announcement.priority === 'high' ? 'bg-orange-500/20' :
                                            announcement.priority === 'medium' ? 'bg-yellow-500/20' :
                                            'bg-blue-500/20'
                                        }`}>
                                            {announcement.type === 'power_outage' ? <Zap className="w-5 h-5 text-red-400" /> :
                                             announcement.type === 'water_outage' ? <Droplet className="w-5 h-5 text-blue-400" /> :
                                             announcement.type === 'maintenance_alert' ? <Wrench className="w-5 h-5 text-orange-400" /> :
                                             announcement.type === 'system_update' ? <Bell className="w-5 h-5 text-green-400" /> :
                                             <Info className="w-5 h-5 text-blue-400" />}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-white font-semibold mb-1">{announcement.titleAr || announcement.title}</h3>
                                            <p className="text-white/60 text-sm line-clamp-2">{announcement.messageAr || announcement.message}</p>
                                            {announcement.scheduledTime && (
                                                <p className="text-orange-400 text-xs mt-1">⏰ الوقت: {announcement.scheduledTime}</p>
                                            )}
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
                                            onClick={() => handleViewAuditLog(announcement)}
                                            className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                                            title="سجل الرسالة (من شاهد/ألغى)"
                                        >
                                            <Clock className="w-4 h-4" />
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
                                        {announcement.isActive ? t('common.active') : t('common.inactive')}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {announcement.targetDepartments.includes('all') ? 'جميع الأقسام' :
                                         `${announcement.targetDepartments.length} قسم`}
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
                                            {formatDateTimeGregorianEn(announcement.expiresAt.toDate ? announcement.expiresAt.toDate() : announcement.expiresAt, { showSeconds: false })}
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
                    toggleDepartment={toggleDepartment}
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

            {/* Audit Log Modal */}
            {showAuditLog && auditAnnouncement && (
                <AuditLogModal
                    announcement={auditAnnouncement}
                    auditLog={auditLog}
                    onClose={() => {
                        setShowAuditLog(false);
                        setAuditAnnouncement(null);
                        setAuditLog([]);
                    }}
                />
            )}
        </>
    );
};

// Announcement Modal Component
const AnnouncementModal: React.FC<{
    formData: Partial<ManagerAnnouncement>;
    setFormData: (data: Partial<ManagerAnnouncement>) => void;
    onSave: () => void;
    onClose: () => void;
    toggleDepartment: (dept: DepartmentType) => void;
}> = ({ formData, setFormData, onSave, onClose, toggleDepartment }) => {
    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl modal-enter">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">رسالة عاجلة للأقسام</h2>
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
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-blue-500/50 focus:outline-none transition-all"
                            >
                                <option value="power_outage">انقطاع الكهرباء</option>
                                <option value="water_outage">انقطاع المياه</option>
                                <option value="maintenance_alert">تنبيه صيانة</option>
                                <option value="system_update">تحديث النظام</option>
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
                                    placeholder="تنبيه انقطاع الكهرباء"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-blue-500/50 focus:outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">العنوان بالإنجليزية</label>
                                <input
                                    type="text"
                                    value={formData.title || ''}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Power Outage Alert"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-blue-500/50 focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">الرسالة بالعربية *</label>
                            <textarea
                                value={formData.messageAr || ''}
                                onChange={e => setFormData({ ...formData, messageAr: e.target.value })}
                                placeholder="سيتم قطع الكهرباء الساعة 5:00 مساءً..."
                                rows={4}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white resize-none focus:border-blue-500/50 focus:outline-none transition-all"
                            />
                        </div>

                        {/* Scheduled Time */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">الوقت المحدد (اختياري)</label>
                            <input
                                type="text"
                                value={formData.scheduledTime || ''}
                                onChange={e => setFormData({ ...formData, scheduledTime: e.target.value })}
                                placeholder="5:00 PM"
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-blue-500/50 focus:outline-none transition-all"
                            />
                            <p className="text-xs text-white/40 mt-1">مثال: 5:00 PM, 3:30 مساءً</p>
                        </div>

                        {/* Department Selection */}
                        <div>
                            <label className="block text-sm text-white/60 mb-3">اختر الأقسام المستهدفة:</label>
                            <div className="grid grid-cols-3 gap-2 p-4 rounded-xl bg-white/5 border border-white/10">
                                {DEPARTMENTS.map(dept => (
                                    <button
                                        key={dept.value}
                                        onClick={() => toggleDepartment(dept.value)}
                                        className={`py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-2 ${
                                            (formData.targetDepartments || []).includes(dept.value)
                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                : 'bg-white/10 text-white/60 border border-white/10 hover:bg-white/20'
                                        }`}
                                    >
                                        {dept.icon}
                                        {dept.label}
                                    </button>
                                ))}
                            </div>
                        </div>

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
                                        {formData.showAsBanner ? t('common.active') : t('common.disabled')}
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
                                        {formData.dismissible ? t('common.yes') : t('common.no')}
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
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-blue-500/50 focus:outline-none transition-all"
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
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-blue-500/50 focus:outline-none transition-all"
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
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                {formData.id ? t('common.update') : t('common.submit')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Audit Log Modal Component
const AuditLogModal: React.FC<{
    announcement: ManagerAnnouncement;
    auditLog: ManagerAnnouncementView[];
    onClose: () => void;
}> = ({ announcement, auditLog, onClose }) => {
    const viewedEmployees = auditLog.filter(v => v.viewedAt && !v.dismissedAt);
    const dismissedEmployees = auditLog.filter(v => v.dismissedAt);

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl modal-enter">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white mb-1">سجل الرسالة</h2>
                            <p className="text-sm text-white/60">{announcement.titleAr || announcement.title}</p>
                        </div>
                        <button onClick={onClose} className="text-white/60 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                            <div className="text-2xl font-bold text-blue-400">{auditLog.length}</div>
                            <div className="text-sm text-white/60">إجمالي الموظفين</div>
                        </div>
                        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                            <div className="text-2xl font-bold text-green-400">{viewedEmployees.length}</div>
                            <div className="text-sm text-white/60">شاهدوا الرسالة</div>
                        </div>
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                            <div className="text-2xl font-bold text-red-400">{dismissedEmployees.length}</div>
                            <div className="text-sm text-white/60">ألغوا الرسالة</div>
                        </div>
                    </div>

                    {/* Detailed Log */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-white mb-4">التفاصيل:</h3>
                        {auditLog.length === 0 ? (
                            <div className="text-center py-8 text-white/40">
                                <Clock className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p>لا يوجد سجل بعد</p>
                            </div>
                        ) : (
                            auditLog.map((log) => {
                                const viewedAt = log.viewedAt?.toDate ? log.viewedAt.toDate() : new Date(log.viewedAt);
                                const dismissedAt = log.dismissedAt?.toDate ? log.dismissedAt.toDate() : (log.dismissedAt ? new Date(log.dismissedAt) : null);

                                return (
                                    <div
                                        key={log.id}
                                        className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="font-semibold text-white">{log.employeeName}</span>
                                                    <span className="text-xs text-white/40">({log.department})</span>
                                                    {log.branchId && (
                                                        <span className="text-xs text-white/40">• {log.branchId}</span>
                                                    )}
                                                </div>
                                                <div className="space-y-1 text-sm">
                                                    <div className="flex items-center gap-2 text-green-400">
                                                        <Eye className="w-4 h-4" />
                                                        <span>شاهد: {formatDateTimeGregorianEn(viewedAt, { showSeconds: false })}</span>
                                                        <span className="text-white/40">({log.viewCount} مرة)</span>
                                                    </div>
                                                    {dismissedAt && (
                                                        <div className="flex items-center gap-2 text-red-400">
                                                            <X className="w-4 h-4" />
                                                            <span>ألغى: {formatDateTimeGregorianEn(dismissedAt, { showSeconds: false })}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {dismissedAt ? (
                                                <span className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/30">
                                                    ألغى
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium border border-green-500/30">
                                                    شاهد فقط
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Stats Modal Component
const StatsModal: React.FC<{
    announcement: ManagerAnnouncement;
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
                            <h3 className="text-white font-semibold mb-3">المشاهدات حسب القسم</h3>
                            <div className="space-y-2">
                                {Object.entries(stats.viewsByDepartment || {}).map(([dept, count]) => (
                                    <div key={dept} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                                        <span className="text-white/60 text-sm">{dept}</span>
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
