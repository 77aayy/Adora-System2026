/**
 * Announcements Manager
 * Allows managers to create and manage guest announcements
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import {
    Bell, Plus, Trash2, Edit2, Save, X, AlertTriangle,
    RefreshCw, ChevronDown, ChevronUp, MoveUp, MoveDown,
    AlertCircle, CheckCircle, Info
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useUX } from '../../context/UXContext';
import { useAuth } from '../../context/AuthContext';
import {
    getAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    type Announcement
} from '../../services/announcementService';
import { logger } from '../../services/loggerService';

interface AnnouncementsManagerProps {
    branchId: string;
    branchName: string;
}

export const AnnouncementsManager: React.FC<AnnouncementsManagerProps> = ({ branchId, branchName }) => {
    const { tenantId } = useTenant();
    const { success, error } = useUX();
    const { user } = useAuth();

    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

    // Form state
    const [formData, setFormData] = useState<Partial<Announcement>>({
        title: '',
        titleAr: '',
        content: '',
        contentAr: '',
        icon: '🔔',
        priority: 'medium',
        showType: 'once',
        showCount: 1,
        isActive: true,
        order: 0
    });

    useEffect(() => {
        loadAnnouncements();
    }, [tenantId, branchId]);

    const loadAnnouncements = async () => {
        if (!tenantId || !branchId) return;
        setLoading(true);
        try {
            const loaded = await getAnnouncements(branchId, tenantId);
            setAnnouncements(loaded);
        } catch (err) {
            logger.error('Error loading announcements', err, 'AnnouncementsManager');
            error('فشل تحميل التنبيهات');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (announcement: Announcement) => {
        setFormData(announcement);
        setEditingAnnouncement(announcement);
        setShowAnnouncementModal(true);
    };

    const handleDelete = async (announcementId: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا التنبيه؟')) return;
        try {
            await deleteAnnouncement(announcementId);
            success('تم حذف التنبيه');
            loadAnnouncements();
        } catch (err) {
            error('فشل حذف التنبيه');
        }
    };

    const handleSave = async () => {
        if (!tenantId || !branchId || !user) return;
        if (!formData.titleAr?.trim() || !formData.contentAr?.trim()) {
            error('يرجى إدخال العنوان والمحتوى');
            return;
        }

        try {
            if (editingAnnouncement) {
                await updateAnnouncement(editingAnnouncement.id, formData as Partial<Announcement>, user.id, user.name || '');
                success('تم تحديث التنبيه');
            } else {
                await createAnnouncement({
                    ...formData as Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>,
                    branchId,
                    tenantId
                }, user.id, user.name || '');
                success('تم إضافة التنبيه');
            }
            setShowAnnouncementModal(false);
            setFormData({
                title: '',
                titleAr: '',
                content: '',
                contentAr: '',
                icon: '🔔',
                priority: 'medium',
                showType: 'once',
                showCount: 1,
                isActive: true,
                order: announcements.length
            });
            loadAnnouncements();
        } catch (err) {
            error('فشل حفظ التنبيه');
        }
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
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                            <Bell className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">التنبيهات والإعلانات</h3>
                            <p className="text-sm text-white/60">{announcements.length} تنبيه متاح</p>
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
                            <p className="text-sm text-white/60 mb-3">قوالب سريعة:</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        setFormData({
                                            title: 'No Smoking',
                                            titleAr: 'ممنوع التدخين',
                                            content: 'Smoking is strictly prohibited in all rooms. Violators will be charged a cleaning fee.',
                                            contentAr: 'التدخين ممنوع منعاً باتاً في جميع الغرف. سيتم فرض رسوم تنظيف على المخالفين.',
                                            icon: '🚭',
                                            priority: 'high',
                                            showType: 'always',
                                            isActive: true,
                                            order: announcements.length
                                        });
                                        setEditingAnnouncement(null);
                                        setShowAnnouncementModal(true);
                                    }}
                                    className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-right"
                                >
                                    <div className="text-2xl mb-1">🚭</div>
                                    <div className="text-white font-medium text-sm">ممنوع التدخين</div>
                                </button>
                                <button
                                    onClick={() => {
                                        setFormData({
                                            title: 'Room Care',
                                            titleAr: 'الحفاظ على الغرفة',
                                            content: 'Please keep the room clean and report any damages immediately.',
                                            contentAr: 'يرجى الحفاظ على نظافة الغرفة والإبلاغ عن أي أضرار فوراً.',
                                            icon: '🏨',
                                            priority: 'medium',
                                            showType: 'once',
                                            isActive: true,
                                            order: announcements.length
                                        });
                                        setEditingAnnouncement(null);
                                        setShowAnnouncementModal(true);
                                    }}
                                    className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-right"
                                >
                                    <div className="text-2xl mb-1">🏨</div>
                                    <div className="text-white font-medium text-sm">الحفاظ على الغرفة</div>
                                </button>
                            </div>
                        </div>

                        {/* Add New Button */}
                        <button
                            onClick={() => {
                                setEditingAnnouncement(null);
                                setFormData({
                                    title: '',
                                    titleAr: '',
                                    content: '',
                                    contentAr: '',
                                    icon: '🔔',
                                    priority: 'medium',
                                    showType: 'once',
                                    showCount: 1,
                                    isActive: true,
                                    order: announcements.length
                                });
                                setShowAnnouncementModal(true);
                            }}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            إضافة تنبيه جديد
                        </button>

                        {/* Announcements List */}
                        <div className="space-y-3">
                            {announcements.map(announcement => (
                                <div
                                    key={announcement.id}
                                    className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="text-3xl">{announcement.icon || '🔔'}</div>
                                            <div>
                                                <div className="text-white font-medium">{announcement.titleAr || announcement.title}</div>
                                                <div className="text-white/50 text-xs">
                                                    {announcement.showType === 'once' ? 'مرة واحدة' : 
                                                     announcement.showType === 'always' ? 'كل مرة' : 
                                                     `${announcement.showCount || 1} مرة`}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                announcement.priority === 'high'
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : announcement.priority === 'medium'
                                                    ? 'bg-yellow-500/20 text-yellow-400'
                                                    : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                                {announcement.priority === 'high' ? 'مهم' : announcement.priority === 'medium' ? 'متوسط' : 'عادي'}
                                            </span>
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
                                    <p className="text-white/60 text-sm line-clamp-2">{announcement.contentAr || announcement.content}</p>
                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10 text-xs text-white/40">
                                        <span className={announcement.isActive ? 'text-green-400' : 'text-red-400'}>
                                            {announcement.isActive ? 'نشط' : 'غير نشط'}
                                        </span>
                                        <span>الترتيب: {announcement.order || 0}</span>
                                    </div>
                                </div>
                            ))}

                            {announcements.length === 0 && (
                                <div className="text-center py-8 text-white/40">
                                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>لا توجد تنبيهات مضافة</p>
                                    <p className="text-xs mt-1">استخدم القوالب السريعة أو أضف تنبيه مخصص</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Announcement Modal */}
            {showAnnouncementModal && (
                <AnnouncementModal
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSave}
                    onClose={() => {
                        setShowAnnouncementModal(false);
                        setEditingAnnouncement(null);
                    }}
                />
            )}
        </>
    );
};

// Announcement Modal Component
const AnnouncementModal: React.FC<{
    formData: Partial<Announcement>;
    setFormData: (data: Partial<Announcement>) => void;
    onSave: () => void;
    onClose: () => void;
}> = ({ formData, setFormData, onSave, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">إضافة / تعديل تنبيه</h2>
                        <button onClick={onClose} className="text-white/60 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">العنوان بالعربية *</label>
                                <input
                                    type="text"
                                    value={formData.titleAr || ''}
                                    onChange={e => setFormData({ ...formData, titleAr: e.target.value })}
                                    placeholder="ممنوع التدخين"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">الأيقونة (إيموجي)</label>
                                <input
                                    type="text"
                                    value={formData.icon || '🔔'}
                                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                    placeholder="🚭"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white text-center text-2xl focus:border-primary-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Content */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">المحتوى بالعربية *</label>
                            <textarea
                                value={formData.contentAr || ''}
                                onChange={e => setFormData({ ...formData, contentAr: e.target.value })}
                                placeholder="التدخين ممنوع منعاً باتاً في جميع الغرف..."
                                rows={4}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white resize-none focus:border-primary-500 focus:outline-none"
                            />
                        </div>

                        {/* Settings */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">الأولوية</label>
                                <select
                                    value={formData.priority || 'medium'}
                                    onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all appearance-none cursor-pointer hover:bg-white/10 hover:border-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                                >
                                    <option value="low">عادية</option>
                                    <option value="medium">متوسطة</option>
                                    <option value="high">مهمة</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">نوع العرض</label>
                                <select
                                    value={formData.showType || 'once'}
                                    onChange={e => setFormData({ ...formData, showType: e.target.value as any })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all appearance-none cursor-pointer hover:bg-white/10 hover:border-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                                >
                                    <option value="once">مرة واحدة</option>
                                    <option value="always">كل مرة</option>
                                    <option value="times">عدد مرات محدد</option>
                                </select>
                            </div>
                            {formData.showType === 'times' && (
                                <div>
                                    <label className="block text-sm text-white/60 mb-2">عدد المرات</label>
                                    <input
                                        type="number"
                                        value={formData.showCount || 1}
                                        onChange={e => setFormData({ ...formData, showCount: parseInt(e.target.value) || 1 })}
                                        min={1}
                                        max={50}
                                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Status */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                            <span className="text-sm text-white/60">حالة التنبيه</span>
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
