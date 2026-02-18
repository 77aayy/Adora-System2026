/**
 * Emergency Alerts Manager
 * Allows managers to send urgent/emergency notifications to guests
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import {
    AlertTriangle, Plus, Trash2, Edit2, Save, X, Bell,
    RefreshCw, ChevronDown, Clock, Target, Volume2, VolumeX
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useUX } from '../../context/UXContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
    createEmergencyAlert,
    updateEmergencyAlert,
    deactivateEmergencyAlert,
    type EmergencyAlert
} from '../../services/emergencyAlertService';
import { getAllEmergencyAlertsForBranch } from '../../services/emergencyAlertsAdminService';
import { logger } from '../../services/loggerService';
import { subscribeToRooms } from '../../services/roomService';
import { formatDateTimeGregorianEn } from '../../utils/dateUtils';

interface EmergencyAlertsManagerProps {
    branchId: string;
    branchName: string;
}

export const EmergencyAlertsManager: React.FC<EmergencyAlertsManagerProps> = ({ branchId, branchName }) => {
    const { tenantId } = useTenant();
    const { success, error } = useUX();
    const { user } = useAuth();
    const { t } = useTranslation();

    const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [editingAlert, setEditingAlert] = useState<EmergencyAlert | null>(null);
    const [availableRooms, setAvailableRooms] = useState<string[]>([]);

    // Form state
    const [formData, setFormData] = useState<Partial<EmergencyAlert>>({
        title: '',
        titleAr: '',
        message: '',
        messageAr: '',
        type: 'general',
        severity: 'high',
        showSound: true,
        soundType: 'alert',
        showNotification: true,
        autoShow: true,
        dismissible: true,
        targetRooms: [],
        isActive: true
    });

    useEffect(() => {
        loadAlerts();
        loadAvailableRooms();
    }, [tenantId, branchId]);

    const loadAlerts = async () => {
        // ✅ Null Safety: Check required params
        if (!tenantId || !branchId) {
            logger.warn('EmergencyAlertsManager: Missing tenantId or branchId', null, 'EmergencyAlertsManager');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // ✅ Architecture: Use service instead of direct Firebase call
            const loaded = await getAllEmergencyAlertsForBranch(branchId, tenantId);
            setAlerts(loaded);
        } catch (err: any) {
            logger.error('Error loading emergency alerts', err, 'EmergencyAlertsManager');
            // ✅ Only show error if it's a real error, not just empty collection
            if (err.code !== 'permission-denied') {
                error('فشل تحميل التنبيهات الطارئة');
            }
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableRooms = async () => {
        // ✅ Null Safety: Check required params
        if (!tenantId || !branchId) {
            logger.warn('Cannot load rooms: Missing tenantId or branchId', null, 'EmergencyAlertsManager');
            return;
        }

        try {
            // ✅ Architecture: Use service instead of direct Firebase call
            // Use subscribeToRooms to get rooms, then extract room numbers
            const unsubscribe = subscribeToRooms(branchId, (rooms) => {
                const roomNumbers = rooms
                    .map(room => room.number)
                    .filter(Boolean)
                    .sort();
                setAvailableRooms(roomNumbers);
                unsubscribe(); // Unsubscribe after first load
            }, tenantId, 1000);

            // Cleanup after 5 seconds if still subscribed
            setTimeout(() => {
                if (unsubscribe) unsubscribe();
            }, 5000);
        } catch (err: any) {
            logger.error('Error loading rooms', err, 'EmergencyAlertsManager');
        }
    };

    const handleEdit = (alert: EmergencyAlert) => {
        setFormData(alert);
        setEditingAlert(alert);
        setShowAlertModal(true);
    };

    const handleDelete = async (alertId: string) => {
        if (!confirm(t('admin.cancelAlertConfirm') || 'هل أنت متأكد من إلغاء هذا التنبيه الطارئ؟')) return;
        try {
            await deactivateEmergencyAlert(alertId);
            success(t('admin.cancelSuccess') || 'تم الإلغاء بنجاح');
            loadAlerts();
        } catch (err) {
            error(t('admin.cancelError') || 'فشل الإلغاء');
        }
    };

    const handleSave = async () => {
        if (!tenantId || !branchId || !user) return;
        if (!formData.titleAr?.trim() || !formData.messageAr?.trim()) {
            error(t('admin.titleAndMessageRequired') || 'يرجى إدخال العنوان والرسالة');
            return;
        }

        try {
            if (editingAlert) {
                await updateEmergencyAlert(editingAlert.id, formData as Partial<EmergencyAlert>, user.id, user.name || '');
                success(t('admin.updateSuccess') || 'تم التحديث بنجاح');
            } else {
                await createEmergencyAlert({
                    ...formData as Omit<EmergencyAlert, 'id' | 'createdAt'>,
                    branchId,
                    tenantId
                }, user.id, user.name || '');
                success(t('admin.sendSuccess') || 'تم الإرسال بنجاح');
            }
            setShowAlertModal(false);
            setFormData({
                title: '',
                titleAr: '',
                message: '',
                messageAr: '',
                type: 'general',
                severity: 'high',
                showSound: true,
                soundType: 'alert',
                showNotification: true,
                autoShow: true,
                dismissible: true,
                targetRooms: [],
                isActive: true
            });
            loadAlerts();
        } catch (err) {
            error(t('admin.saveError') || 'فشل الحفظ');
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
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600/20 to-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">التنبيهات الطارئة</h3>
                            <p className="text-sm text-white/60">{alerts.filter(a => a.isActive).length} تنبيه نشط</p>
                        </div>
                    </div>
                    <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                        <ChevronDown className="w-4 h-4 text-white/60" />
                    </div>
                </div>

                {/* Content */}
                <div className={`transition-all duration-300 ease-in-out border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[1000px] opacity-100 overflow-y-auto'}`}>
                    <div className="p-6 space-y-4">
                        {/* Quick Templates */}
                        <div>
                            <p className="text-sm text-white/60 mb-3">قوالب سريعة:</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        setFormData({
                                            title: 'Fire Emergency',
                                            titleAr: 'حالة حريق - إخلاء فوري',
                                            message: 'There is a fire emergency. Please evacuate the building immediately through the nearest exit.',
                                            messageAr: 'يوجد حالة حريق. يرجى إخلاء المبنى فوراً من أقرب مخرج.',
                                            type: 'fire',
                                            severity: 'critical',
                                            showSound: true,
                                            soundType: 'siren',
                                            showNotification: true,
                                            autoShow: true,
                                            dismissible: false,
                                            targetRooms: [],
                                            isActive: true
                                        });
                                        setEditingAlert(null);
                                        setShowAlertModal(true);
                                    }}
                                    className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors text-right"
                                >
                                    <div className="text-2xl mb-1">🔥</div>
                                    <div className="text-red-400 font-medium text-sm">حالة حريق</div>
                                </button>
                                <button
                                    onClick={() => {
                                        setFormData({
                                            title: 'Checkout Time Change',
                                            titleAr: 'تغيير موعد الخروج',
                                            message: 'Checkout time has been changed to 4:00 PM today.',
                                            messageAr: 'تم تغيير موعد الخروج إلى الساعة 4:00 مساءً اليوم.',
                                            type: 'checkout_change',
                                            severity: 'high',
                                            showSound: true,
                                            soundType: 'bell',
                                            showNotification: true,
                                            autoShow: true,
                                            dismissible: true,
                                            targetRooms: [],
                                            isActive: true
                                        });
                                        setEditingAlert(null);
                                        setShowAlertModal(true);
                                    }}
                                    className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 transition-colors text-right"
                                >
                                    <div className="text-2xl mb-1">🕐</div>
                                    <div className="text-orange-400 font-medium text-sm">تغيير موعد الخروج</div>
                                </button>
                            </div>
                        </div>

                        {/* Add New Button */}
                        <button
                            onClick={() => {
                                setEditingAlert(null);
                                setFormData({
                                    title: '',
                                    titleAr: '',
                                    message: '',
                                    messageAr: '',
                                    type: 'general',
                                    severity: 'high',
                                    showSound: true,
                                    soundType: 'alert',
                                    showNotification: true,
                                    autoShow: true,
                                    dismissible: true,
                                    targetRooms: [],
                                    isActive: true
                                });
                                setShowAlertModal(true);
                            }}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600/20 to-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            إرسال تنبيه طارئ جديد
                        </button>

                        {/* Alerts List */}
                        <div className="space-y-3">
                            {alerts.map(alert => (
                                <div
                                    key={alert.id}
                                    className={`p-4 rounded-xl border ${
                                        alert.severity === 'critical'
                                            ? 'bg-red-500/10 border-red-500/30'
                                            : alert.severity === 'high'
                                            ? 'bg-orange-500/10 border-orange-500/30'
                                            : 'bg-yellow-500/10 border-yellow-500/30'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="text-3xl">
                                                {alert.type === 'fire' ? '🔥' :
                                                 alert.type === 'evacuation' ? '🚨' :
                                                 alert.type === 'security' ? '🔒' :
                                                 alert.type === 'weather' ? '⛈️' :
                                                 '⚠️'}
                                            </div>
                                            <div>
                                                <div className="text-slate-800 dark:text-white font-medium">{alert.titleAr || alert.title}</div>
                                                <div className="text-slate-600 dark:text-white/50 text-xs">
                                                    {alert.targetRooms && alert.targetRooms.length > 0
                                                        ? `${alert.targetRooms.length} غرفة`
                                                        : 'جميع الغرف'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                alert.severity === 'critical'
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : alert.severity === 'high'
                                                    ? 'bg-orange-500/20 text-orange-400'
                                                    : 'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                                {alert.severity === 'critical' ? 'حرج' : alert.severity === 'high' ? 'مهم' : 'متوسط'}
                                            </span>
                                            <button
                                                onClick={() => handleEdit(alert)}
                                                className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(alert.id)}
                                                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-white/60 text-sm line-clamp-2 mb-3">{alert.messageAr || alert.message}</p>
                                    <div className="flex items-center gap-4 pt-3 border-t border-white/10 text-xs text-white/40">
                                        <span className={alert.isActive ? 'text-green-400' : 'text-red-400'}>
                                            {alert.isActive ? t('common.active') : t('common.cancelled')}
                                        </span>
                                        {alert.showSound && (
                                            <span className="flex items-center gap-1">
                                                <Volume2 className="w-3 h-3" />
                                                صوت
                                            </span>
                                        )}
                                        {alert.showNotification && (
                                            <span className="flex items-center gap-1">
                                                <Bell className="w-3 h-3" />
                                                إشعار
                                            </span>
                                        )}
                                        {alert.expiresAt && (
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatDateTimeGregorianEn(alert.expiresAt.toDate ? alert.expiresAt.toDate() : alert.expiresAt, { showSeconds: false })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {alerts.length === 0 && (
                                <div className="text-center py-8 text-slate-500 dark:text-white/40">
                                    <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>لا توجد تنبيهات طارئة</p>
                                    <p className="text-xs mt-1">استخدم القوالب السريعة أو أضف تنبيه مخصص</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Alert Modal */}
            {showAlertModal && (
                <AlertModal
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSave}
                    onClose={() => {
                        setShowAlertModal(false);
                        setEditingAlert(null);
                    }}
                    availableRooms={availableRooms}
                    isEditing={!!editingAlert}
                />
            )}
        </>
    );
};

// Alert Modal Component
const AlertModal: React.FC<{
    formData: Partial<EmergencyAlert>;
    setFormData: (data: Partial<EmergencyAlert>) => void;
    onSave: () => void;
    onClose: () => void;
    availableRooms: string[];
    isEditing?: boolean;
}> = ({ formData, setFormData, onSave, onClose, availableRooms, isEditing }) => {
    const [selectedRooms, setSelectedRooms] = useState<string[]>(formData.targetRooms || []);

    const toggleRoom = (roomNumber: string) => {
        if (selectedRooms.includes(roomNumber)) {
            setSelectedRooms(selectedRooms.filter(r => r !== roomNumber));
        } else {
            setSelectedRooms([...selectedRooms, roomNumber]);
        }
        setFormData({ ...formData, targetRooms: selectedRooms.includes(roomNumber) 
            ? selectedRooms.filter(r => r !== roomNumber)
            : [...selectedRooms, roomNumber]
        });
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">إرسال تنبيه طارئ</h2>
                        <button onClick={onClose} className="text-white/60 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-600 dark:text-white/60 mb-2">العنوان بالعربية *</label>
                                <input
                                    type="text"
                                    value={formData.titleAr || ''}
                                    onChange={e => setFormData({ ...formData, titleAr: e.target.value })}
                                    placeholder={t('emergencyAlerts.fireExample') || 'حالة حريق - إخلاء فوري'}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white focus:border-primary-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 dark:text-white/60 mb-2">نوع التنبيه</label>
                                <select
                                    value={formData.type || 'general'}
                                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white focus:border-primary-500 focus:outline-none"
                                >
                                    <option value="fire">حريق</option>
                                    <option value="evacuation">إخلاء</option>
                                    <option value="security">أمني</option>
                                    <option value="weather">طقس</option>
                                    <option value="checkout_change">تغيير موعد الخروج</option>
                                    <option value="maintenance">صيانة</option>
                                    <option value="general">عام</option>
                                </select>
                            </div>
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">الرسالة بالعربية *</label>
                            <textarea
                                value={formData.messageAr || ''}
                                onChange={e => setFormData({ ...formData, messageAr: e.target.value })}
                                placeholder={t('emergencyAlerts.fireMessageExample') || 'يوجد حالة حريق. يرجى إخلاء المبنى فوراً...'}
                                rows={4}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white resize-none focus:border-primary-500 focus:outline-none"
                            />
                        </div>

                        {/* Settings */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm text-slate-600 dark:text-white/60 mb-2">الأولوية</label>
                                <select
                                    value={formData.severity || 'high'}
                                    onChange={e => setFormData({ ...formData, severity: e.target.value as any })}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white focus:border-primary-500 focus:outline-none"
                                >
                                    <option value="critical">حرج</option>
                                    <option value="high">مهم</option>
                                    <option value="medium">متوسط</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 dark:text-white/60 mb-2">نوع الصوت</label>
                                <select
                                    value={formData.soundType || 'alert'}
                                    onChange={e => setFormData({ ...formData, soundType: e.target.value as any })}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white focus:border-primary-500 focus:outline-none"
                                >
                                    <option value="alert">تنبيه</option>
                                    <option value="siren">صافرة</option>
                                    <option value="bell">جرس</option>
                                    <option value="chime">نغمة</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-white/60 mb-2">تاريخ الانتهاء (اختياري)</label>
                                <input
                                    type="datetime-local"
                                    value={formData.expiresAt ? new Date(formData.expiresAt.toDate ? formData.expiresAt.toDate() : formData.expiresAt).toISOString().slice(0, 16) : ''}
                                    onChange={e => {
                                        if (e.target.value) {
                                            const expiresAt = Timestamp.fromDate(new Date(e.target.value));
                                            setFormData({ ...formData, expiresAt });
                                        } else {
                                            setFormData({ ...formData, expiresAt: undefined });
                                        }
                                    }}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-primary-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Toggles */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm text-slate-700 dark:text-white/60">تشغيل الصوت</span>
                                    <button
                                        onClick={() => setFormData({ ...formData, showSound: !formData.showSound })}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${formData.showSound
                                            ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
                                            : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/60 border border-slate-300 dark:border-white/10'
                                        }`}
                                    >
                                        {formData.showSound ? t('common.active') : t('common.disabled')}
                                    </button>
                                </label>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm text-slate-700 dark:text-white/60">إشعار المتصفح</span>
                                    <button
                                        onClick={() => setFormData({ ...formData, showNotification: !formData.showNotification })}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${formData.showNotification
                                            ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
                                            : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/60 border border-slate-300 dark:border-white/10'
                                        }`}
                                    >
                                        {formData.showNotification ? t('common.active') : t('common.disabled')}
                                    </button>
                                </label>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm text-slate-700 dark:text-white/60">عرض تلقائي</span>
                                    <button
                                        onClick={() => setFormData({ ...formData, autoShow: !formData.autoShow })}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${formData.autoShow
                                            ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
                                            : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/60 border border-slate-300 dark:border-white/10'
                                        }`}
                                    >
                                        {formData.autoShow ? t('common.active') : t('common.disabled')}
                                    </button>
                                </label>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm text-slate-700 dark:text-white/60">يمكن إغلاقه</span>
                                    <button
                                        onClick={() => setFormData({ ...formData, dismissible: !formData.dismissible })}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${formData.dismissible
                                            ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
                                            : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/60 border border-slate-300 dark:border-white/10'
                                        }`}
                                    >
                                        {formData.dismissible ? t('common.yes') || 'نعم' : t('common.no') || 'لا'}
                                    </button>
                                </label>
                            </div>
                        </div>

                        {/* Target Rooms */}
                        <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10">
                            <label className="block text-sm text-slate-700 dark:text-white/60 mb-3">الغرف المستهدفة (فارغ = جميع الغرف)</label>
                            <div className="max-h-40 overflow-y-auto grid grid-cols-4 gap-2">
                                {availableRooms.map(room => (
                                    <button
                                        key={room}
                                        onClick={() => {
                                            const newRooms = selectedRooms.includes(room)
                                                ? selectedRooms.filter(r => r !== room)
                                                : [...selectedRooms, room];
                                            setSelectedRooms(newRooms);
                                            setFormData({ ...formData, targetRooms: newRooms });
                                        }}
                                        className={`py-2 px-3 rounded-lg text-sm transition-all ${
                                            selectedRooms.includes(room)
                                                ? 'bg-primary-500/20 text-primary-600 dark:text-primary-400 border border-primary-500/30'
                                                : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/60 border border-slate-300 dark:border-white/10 hover:bg-slate-300 dark:hover:bg-white/20'
                                        }`}
                                    >
                                        {room}
                                    </button>
                                ))}
                            </div>
                            {selectedRooms.length > 0 && (
                                <p className="text-xs text-slate-500 dark:text-white/40 mt-2">
                                    {selectedRooms.length} غرفة محددة
                                </p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white hover:bg-slate-300 dark:hover:bg-white/20 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={onSave}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold hover:shadow-lg hover:shadow-red-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                {isEditing ? t('common.update') : t('common.submit')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
