/**
 * Golden Alert Components V2
 * Display (with special effects) and create golden alerts
 * Features: Scheduling, Read Receipts (✓✓), Special Sound/Haptic
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Clock, Send, Bell, Check, AlertTriangle, Info, Calendar, Users, Eye, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import {
    GoldenAlert,
    subscribeToGoldenAlerts,
    markAlertViewed,
    createGoldenAlert,
    subscribeToAlertViews,
    getManagerAlertHistory,
    GOLDEN_ALERT_CONFIG,
} from '../../services/goldenAlertService';

// ============================================================
// SPECIAL SOUND PLAYER
// ============================================================

const playGoldenAlertSound = (type: 'info' | 'warning' | 'urgent') => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Different frequencies for different types
        const frequencies = {
            info: [440, 550, 660],
            warning: [440, 330, 440, 550],
            urgent: [880, 660, 880, 660, 880, 660],
        };

        const freqs = frequencies[type];
        let time = audioContext.currentTime;

        freqs.forEach((freq, i) => {
            oscillator.frequency.setValueAtTime(freq, time + i * 0.15);
        });

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.log('Audio not supported');
    }
};

// ============================================================
// SPECIAL HAPTIC
// ============================================================

const triggerGoldenHaptic = (type: 'info' | 'warning' | 'urgent') => {
    if ('vibrate' in navigator) {
        const patterns = {
            info: [50, 100, 50],
            warning: [100, 50, 100, 50, 100],
            urgent: [200, 100, 200, 100, 200, 100, 200],
        };
        navigator.vibrate(patterns[type]);
    }
};

// ============================================================
// VIEWERS POPUP
// ============================================================

interface ViewersPopupProps {
    isOpen: boolean;
    onClose: () => void;
    alertId: string;
    alertTitle: string;
}

const ViewersPopup: React.FC<ViewersPopupProps> = ({ isOpen, onClose, alertId, alertTitle }) => {
    const [viewers, setViewers] = useState<{ id: string; name: string; time: Date }[]>([]);

    useEffect(() => {
        if (!isOpen) return;

        const unsubscribe = subscribeToAlertViews(alertId, (views) => {
            setViewers(views);
        });

        return () => unsubscribe();
    }, [alertId, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose} style={{ backdropFilter: 'none' }}>
            <div className="glass-card w-full max-w-sm max-h-[60vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <CheckCheck className="w-5 h-5 text-blue-400" />
                        <span className="font-bold text-white">من شاهد الكرت</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10">
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                <div className="p-4">
                    <p className="text-sm text-white/50 mb-3">{alertTitle}</p>

                    {viewers.length === 0 ? (
                        <div className="text-center py-6">
                            <Eye className="w-10 h-10 text-white/20 mx-auto mb-2" />
                            <p className="text-white/40">لم يشاهد أحد هذا الكرت بعد</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                            {viewers.map((viewer, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <Users className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <span className="text-white font-medium">{viewer.name}</span>
                                    </div>
                                    <span className="text-xs text-white/40">
                                        {viewer.time.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 text-center text-sm text-white/50">
                        <CheckCheck className="w-4 h-4 inline text-blue-400" />
                        {' '}{viewers.length} شاهد الكرت
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// GOLDEN ALERT DISPLAY (For All Departments)
// ============================================================

interface GoldenAlertDisplayProps {
    department: string;
}

export const GoldenAlertDisplay: React.FC<GoldenAlertDisplayProps> = ({ department }) => {
    const { user } = useAuth();
    const branchId = (user as any)?.branch || 'default';

    const [alerts, setAlerts] = useState<GoldenAlert[]>([]);
    const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
    const shownAlertsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!branchId) return;

        const unsubscribe = subscribeToGoldenAlerts(branchId, department, (newAlerts) => {
            setAlerts(newAlerts);

            // Play sound/haptic for new alerts
            newAlerts.forEach(alert => {
                if (!shownAlertsRef.current.has(alert.id)) {
                    shownAlertsRef.current.add(alert.id);
                    playGoldenAlertSound(alert.type);
                    triggerGoldenHaptic(alert.type);
                }
            });
        });

        return () => unsubscribe();
    }, [branchId, department]);

    const handleView = async (alertId: string) => {
        if (!user?.id || viewedIds.has(alertId)) return;

        await markAlertViewed(alertId, user.id, user.name || 'موظف');
        setViewedIds(prev => new Set([...prev, alertId]));
    };

    if (alerts.length === 0) return null;

    return (
        <div className="space-y-3">
            {alerts.map(alert => {
                const config = GOLDEN_ALERT_CONFIG[alert.type];
                const timeLeft = Math.max(0, Math.ceil((alert.expiresAt.getTime() - Date.now()) / 60000));
                const hasViewed = viewedIds.has(alert.id) || alert.viewed.some(v => v.id === user?.id);

                return (
                    <div
                        key={alert.id}
                        onClick={() => handleView(alert.id)}
                        className={`relative overflow-hidden rounded-2xl p-4 border-2 cursor-pointer
                            ${config.bgClass} ${config.borderClass} ${config.glowClass}
                            animate-pulse transition-all hover:scale-[1.01]`}
                        style={{
                            animation: alert.type === 'urgent' ? 'pulse 1s infinite, glow 2s infinite' : 'pulse 2s infinite',
                        }}
                    >
                        {/* Golden shimmer effect */}
                        <div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent"
                            style={{
                                animation: 'shimmer 2s infinite',
                            }}
                        />

                        {/* Crown icon */}
                        <div className="absolute -top-2 -right-2 text-3xl">
                            🏆
                        </div>

                        <div className="relative flex items-start gap-3">
                            <div className="text-3xl flex-shrink-0 animate-bounce">
                                {config.icon}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className={`text-xs px-2 py-0.5 rounded-full bg-yellow-500/30 text-yellow-300 font-bold border border-yellow-400/50`}>
                                        🏆 الكرت الذهبي
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgClass} ${config.textColor}`}>
                                        {config.label}
                                    </span>
                                </div>
                                <h4 className={`font-bold text-xl ${config.textColor}`}>{alert.title}</h4>
                                <p className="text-white/90 mt-2 text-lg">{alert.message}</p>
                                <div className="flex items-center gap-4 mt-3 text-sm text-white/60">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        باقي {timeLeft} دقيقة
                                    </div>
                                    <div className="flex items-center gap-1">
                                        من {alert.createdBy.name}
                                    </div>
                                </div>
                            </div>
                            {hasViewed && (
                                <div className="flex-shrink-0 bg-green-500/20 rounded-full p-2">
                                    <Check className="w-5 h-5 text-green-400" />
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* CSS Animation Styles */}
            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                @keyframes glow {
                    0%, 100% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.4); }
                    50% { box-shadow: 0 0 40px rgba(239, 68, 68, 0.8); }
                }
            `}</style>
        </div>
    );
};

// ============================================================
// GOLDEN ALERT CREATOR (For Admin - with Scheduling)
// ============================================================

interface GoldenAlertCreatorProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GoldenAlertCreator: React.FC<GoldenAlertCreatorProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const { success, error: showError, haptic } = useUX();
    const branchId = (user as any)?.branch || 'default';

    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'info' | 'warning' | 'urgent'>('warning');
    const [duration, setDuration] = useState(30);
    const [departments, setDepartments] = useState<string[]>(['all']);
    const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('09:00');
    const [sending, setSending] = useState(false);

    const deptOptions = [
        { value: 'all', label: 'الكل', icon: '🌐' },
        { value: 'bellman', label: 'البيلمان', icon: '🛎️' },
        { value: 'housekeeping', label: 'الهاوس كيبنج', icon: '🧹' },
        { value: 'maintenance', label: 'الصيانة', icon: '🔧' },
        { value: 'reception', label: 'الاستقبال', icon: '🏨' },
        { value: 'procurement', label: 'المشتريات', icon: '🛒' },
    ];

    const durationOptions = [
        { value: 5, label: '5 دقائق' },
        { value: 15, label: '15 دقيقة' },
        { value: 30, label: '30 دقيقة' },
        { value: 60, label: 'ساعة' },
        { value: 120, label: 'ساعتين' },
        { value: 240, label: '4 ساعات' },
        { value: 480, label: '8 ساعات' },
        { value: 1440, label: 'يوم كامل' },
    ];

    // Set default date to today
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setScheduleDate(today);
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!title.trim() || !message.trim()) {
            showError('يرجى ملء جميع الحقول');
            return;
        }

        let scheduledAt = new Date();

        if (scheduleType === 'later') {
            if (!scheduleDate || !scheduleTime) {
                showError('يرجى تحديد تاريخ ووقت البدء');
                return;
            }
            scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);

            if (scheduledAt <= new Date()) {
                showError('يجب أن يكون وقت الجدولة في المستقبل');
                return;
            }
        }

        setSending(true);
        try {
            await createGoldenAlert({
                title,
                message,
                type,
                scheduledAt,
                durationMinutes: duration,
                departments,
                createdBy: { id: user?.id || '', name: user?.name || '' },
                branch: branchId,
            });

            haptic('success');
            success(scheduleType === 'now'
                ? 'تم إرسال الكرت الذهبي بنجاح! 🏆'
                : 'تم جدولة الكرت الذهبي بنجاح! 📅');

            // Reset form
            setTitle('');
            setMessage('');
            setType('warning');
            setDuration(30);
            setDepartments(['all']);
            setScheduleType('now');
            onClose();
        } catch (err) {
            console.error('Error creating golden alert:', err);
            showError('فشل إرسال الكرت الذهبي');
        }
        setSending(false);
    };

    const toggleDepartment = (dept: string) => {
        if (dept === 'all') {
            setDepartments(['all']);
        } else {
            const newDepts = departments.filter(d => d !== 'all');
            if (newDepts.includes(dept)) {
                const remaining = newDepts.filter(d => d !== dept);
                setDepartments(remaining.length === 0 ? ['all'] : remaining);
            } else {
                setDepartments([...newDepts, dept]);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'none' }}>
            <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-yellow-500/30 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/40 to-orange-500/40 flex items-center justify-center text-2xl animate-pulse">
                            🏆
                        </div>
                        <div>
                            <h3 className="font-bold text-yellow-400 text-lg">الكرت الذهبي</h3>
                            <p className="text-sm text-white/50">تنبيه فوري لجميع الموظفين</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10">
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                    {/* Type Selection */}
                    <div>
                        <label className="text-sm text-white/60 mb-2 block">نوع التنبيه</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'info', label: 'معلومة', icon: <Info className="w-5 h-5" />, color: 'blue' },
                                { value: 'warning', label: 'تحذير', icon: <AlertTriangle className="w-5 h-5" />, color: 'yellow' },
                                { value: 'urgent', label: 'عاجل', icon: <Bell className="w-5 h-5" />, color: 'red' },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setType(opt.value as any)}
                                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${type === opt.value
                                            ? opt.color === 'blue' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                                : opt.color === 'yellow' ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                                                    : 'bg-red-500/20 border-red-500/50 text-red-400'
                                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    {opt.icon}
                                    <span className="text-sm">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="text-sm text-white/60 mb-2 block">العنوان</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="مثال: تنبيه مهم"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-yellow-500/50 focus:outline-none"
                        />
                    </div>

                    {/* Message */}
                    <div>
                        <label className="text-sm text-white/60 mb-2 block">الرسالة</label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="مثال: اليوم عندكم تنظيف سطح فما حدش يطلع على السطح"
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-yellow-500/50 focus:outline-none resize-none"
                        />
                    </div>

                    {/* Schedule Type */}
                    <div>
                        <label className="text-sm text-white/60 mb-2 block">وقت الإرسال</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setScheduleType('now')}
                                className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 ${scheduleType === 'now'
                                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                    }`}
                            >
                                <Send className="w-4 h-4" />
                                الآن
                            </button>
                            <button
                                onClick={() => setScheduleType('later')}
                                className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 ${scheduleType === 'later'
                                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                    }`}
                            >
                                <Calendar className="w-4 h-4" />
                                جدولة
                            </button>
                        </div>

                        {scheduleType === 'later' && (
                            <div className="grid grid-cols-2 gap-2 mt-3">
                                <input
                                    type="date"
                                    value={scheduleDate}
                                    onChange={e => setScheduleDate(e.target.value)}
                                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none"
                                />
                                <input
                                    type="time"
                                    value={scheduleTime}
                                    onChange={e => setScheduleTime(e.target.value)}
                                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none"
                                />
                            </div>
                        )}
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="text-sm text-white/60 mb-2 block">مدة الظهور</label>
                        <div className="flex flex-wrap gap-2">
                            {durationOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setDuration(opt.value)}
                                    className={`px-3 py-2 rounded-lg text-sm transition-all ${duration === opt.value
                                            ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400'
                                            : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Departments */}
                    <div>
                        <label className="text-sm text-white/60 mb-2 block">الأقسام المستهدفة</label>
                        <div className="flex flex-wrap gap-2">
                            {deptOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => toggleDepartment(opt.value)}
                                    className={`px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-1 ${departments.includes(opt.value)
                                            ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
                                            : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    <span>{opt.icon}</span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleSubmit}
                        disabled={sending || !title.trim() || !message.trim()}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:from-yellow-400 hover:to-orange-400 transition-all"
                    >
                        {sending ? (
                            <span>جاري الإرسال...</span>
                        ) : (
                            <>
                                {scheduleType === 'now' ? <Send className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                                {scheduleType === 'now' ? 'إرسال الكرت الذهبي 🏆' : 'جدولة الكرت الذهبي 📅'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// GOLDEN ALERT MANAGER (For Admin - View History & Read Receipts)
// ============================================================

interface GoldenAlertManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GoldenAlertManager: React.FC<GoldenAlertManagerProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const branchId = (user as any)?.branch || 'default';

    const [alerts, setAlerts] = useState<GoldenAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const loadAlerts = async () => {
            setLoading(true);
            const history = await getManagerAlertHistory(branchId);
            setAlerts(history);
            setLoading(false);
        };

        loadAlerts();
    }, [branchId, isOpen]);

    if (!isOpen) return null;

    const now = new Date();

    return (
        <>
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'none' }}>
                <div className="glass-card w-full max-w-2xl max-h-[80vh] overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🏆</span>
                            <h3 className="font-bold text-white">الكروت الذهبية</h3>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10">
                            <X className="w-5 h-5 text-white/60" />
                        </button>
                    </div>

                    <div className="p-4 overflow-y-auto max-h-[60vh]">
                        {loading ? (
                            <div className="text-center py-8 text-white/50">جاري التحميل...</div>
                        ) : alerts.length === 0 ? (
                            <div className="text-center py-8 text-white/50">لا توجد كروت ذهبية</div>
                        ) : (
                            <div className="space-y-3">
                                {alerts.map(alert => {
                                    const config = GOLDEN_ALERT_CONFIG[alert.type];
                                    const isActive = now >= alert.scheduledAt && now < alert.expiresAt && alert.isActive;
                                    const isScheduled = now < alert.scheduledAt && alert.isActive;
                                    const isExpired = now >= alert.expiresAt || !alert.isActive;

                                    return (
                                        <div
                                            key={alert.id}
                                            className={`p-4 rounded-xl border ${isActive ? 'bg-yellow-500/10 border-yellow-500/30' :
                                                    isScheduled ? 'bg-purple-500/10 border-purple-500/30' :
                                                        'bg-white/5 border-white/10 opacity-60'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-lg">{config.icon}</span>
                                                        <span className="font-bold text-white">{alert.title}</span>
                                                        {isActive && (
                                                            <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">نشط</span>
                                                        )}
                                                        {isScheduled && (
                                                            <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">مجدول</span>
                                                        )}
                                                        {isExpired && (
                                                            <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/40">منتهي</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-white/70">{alert.message}</p>
                                                    <div className="flex items-center gap-4 mt-2 text-xs text-white/50">
                                                        <span>
                                                            {isScheduled ? '📅' : '🕐'}{' '}
                                                            {alert.scheduledAt.toLocaleString('ar-SA', {
                                                                month: 'short', day: 'numeric',
                                                                hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Read Receipt - ✓✓ */}
                                                <button
                                                    onClick={() => setSelectedAlert(alert.id)}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                                                >
                                                    <CheckCheck className={`w-4 h-4 ${alert.viewed.length > 0 ? 'text-blue-400' : 'text-white/30'
                                                        }`} />
                                                    <span className="text-sm text-blue-400">{alert.viewed.length}</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Viewers Popup */}
            <ViewersPopup
                isOpen={!!selectedAlert}
                onClose={() => setSelectedAlert(null)}
                alertId={selectedAlert || ''}
                alertTitle={alerts.find(a => a.id === selectedAlert)?.title || ''}
            />
        </>
    );
};

export default { GoldenAlertDisplay, GoldenAlertCreator, GoldenAlertManager };
