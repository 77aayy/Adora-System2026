/**
 * Settings Manager
 * Admin interface for branch and system settings
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import {
    Settings,
    Building2,
    QrCode,
    Power,
    Copy,
    Check,
    ExternalLink,
    Sparkles,
    AlertTriangle,
    RefreshCw,
    Clock,
    Shirt,
    Plus,
    Trash2,
    Save,
    Edit2,
    DollarSign,
    Globe,
    ChevronUp,
    ChevronDown,
    Activity,
    ShieldCheck,
    Terminal,
    Copy as CopyIcon,
    Wrench,
    Bell as BellRing,
    Coffee,
    Package,
    Phone
} from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Switch } from '../../components/common/Switch';
import { confirm as customConfirm } from '../../services/customConfirmService';
import { PointsConfiguration } from './PointsConfiguration';
import { useTenant } from '../../context/TenantContext';
import { useUX } from '../../context/UXContext';
import { useAuth } from '../../context/AuthContext';
import { useTenantBranches, useAllBranchesForOwner } from '../../hooks/useTenantData';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import {
    getCalendarSources,
    saveCalendarSources,
    addCalendarSource,
    removeCalendarSource,
    toggleCalendarSource,
    CalendarSource,
    CalendarSettings,
    DEFAULT_CALENDAR_SOURCES
} from '../../services/calendarSyncService';
import { useConnectivity } from '../../services/connectivityService';
import {
    getLocationSettings,
    saveLocationSettings,
    extractCoordinatesFromLink,
    type LocationSettings
} from '../../services/locationService';
import { MapPin } from 'lucide-react';
import { InteractiveMap } from '../../components/map/InteractiveMap';
import { QRServicesManager } from './QRServicesManager';
import { RatingTemplatesManager } from './RatingTemplatesManager';
import { AnnouncementsManager } from './AnnouncementsManager';
import { EmergencyAlertsManager } from './EmergencyAlertsManager';
import { NotificationSettingsManager } from '../../components/admin/NotificationSettingsManager';
import { QRRoomManager } from './QRRoomManager';

// ============================================================
// TYPES & PROPS
// ============================================================

interface BranchSettingsProps {
    branchId: string;
    branchName: string;
    tenantId?: string; // ✅ Dynamic: For owner viewing branches from different managers
}

// ============================================================
// QR CODE GENERATOR
// ============================================================

const QRCodeGenerator: React.FC<BranchSettingsProps> = ({ branchId, tenantId: propTenantId }) => {
    const { tenantId: contextTenantId } = useTenant();
    // ✅ Dynamic: Use prop tenantId (for owner) or context tenantId (for manager)
    const tenantId = propTenantId || contextTenantId;
    const [roomNumber, setRoomNumber] = useState('');
    const [copied, setCopied] = useState(false);
    const [secureToken, setSecureToken] = useState('');
    const [generating, setGenerating] = useState(false);

    // UI State
    const [isCollapsed, setIsCollapsed] = useState(true);

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const generateSecureLink = async () => {
        if (!roomNumber) return;
        setGenerating(true);
        try {
            const roomRef = doc(db, `tenants/${tenantId}/branches/${branchId}/rooms`, roomNumber);
            const snap = await getDoc(roomRef);

            if (!snap.exists()) {
                await customConfirm({
                    title: 'الغرفة غير موجودة',
                    message: 'عذراً، هذه الغرفة غير موجودة في النظام. يرجى إضافتها أولاً من صفحة إدارة الغرف.',
                    confirmText: 'حسناً',
                    showCancel: false,
                    type: 'warning'
                });
                setGenerating(false);
                return;
            }

            const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

            await updateDoc(roomRef, {
                qrToken: token,
                branchId: branchId
            });

            setSecureToken(token);
        } catch (error) {
            console.error('Error generating token:', error);
            await customConfirm({
                title: 'خطأ',
                message: 'حدث خطأ أثناء توليد الرابط',
                confirmText: 'حسناً',
                showCancel: false,
                type: 'danger'
            });
        } finally {
            setGenerating(false);
        }
    };

    const getGuestUrl = () => {
        const baseUrl = window.location.origin;
        if (secureToken) {
            return `${baseUrl}/guest?token=${secureToken}`;
        }
        return `${baseUrl}/guest?room=${roomNumber}&branch=${branchId}`;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(getGuestUrl());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="rounded-2xl transition-colors duration-300 overflow-hidden border border-white/5 transition-all duration-300">
            {/* Header */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-6 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                        <QrCode className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">مولد رابط QR الآمن</h3>
                        <p className="text-sm text-white/60">رابط مشفر للغرفة يمنع التلاعب برقم الغرفة</p>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-4 h-4 text-white/60" />
                </div>
            </div>

            {/* Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[600px] opacity-100'}`}>
                <div className="p-6">
                    {isLocalhost && (
                        <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl flex gap-3">
                            <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                            <p className="text-xs text-orange-200 leading-relaxed">
                                تنبيه: أنت تستخدم خادم محلي (Localhost). هذا الرابط لن يعمل على جوالات النزلاء إلا إذا كان النظام مرفوعاً على الإنترنت.
                            </p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-sm text-white/70 mb-1">رقم الغرفة</label>
                                <input
                                    type="text"
                                    value={roomNumber}
                                    onChange={(e) => {
                                        setRoomNumber(e.target.value);
                                        setSecureToken('');
                                    }}
                                    className="input"
                                    placeholder="مثال: 101"
                                />
                            </div>
                            <div className="flex flex-col justify-end">
                                <button
                                    onClick={generateSecureLink}
                                    disabled={!roomNumber || generating}
                                    className="btn-primary h-[42px] px-4"
                                >
                                    {generating ? <AdoraLoaderInline size={16} /> : 'توليد رابط آمن'}
                                </button>
                            </div>
                        </div>

                        {secureToken && (
                            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 animate-fadeIn">
                                <div className="flex items-center gap-2 mb-2">
                                    <Check className="w-4 h-4 text-green-400" />
                                    <p className="text-xs text-green-400 font-bold">تم توليد رابط آمن بنجاح</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-sm text-white/80 bg-black/20 p-2 rounded break-all font-mono">
                                        {getGuestUrl()}
                                    </code>
                                    <button
                                        onClick={handleCopy}
                                        className="w-10 h-10 rounded-lg transition-colors duration-300 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                                        title="نسخ الرابط"
                                    >
                                        {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                                    </button>
                                    <a
                                        href={getGuestUrl()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-10 h-10 rounded-lg transition-colors duration-300 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                                        title="فتح الرابط"
                                    >
                                        <ExternalLink className="w-5 h-5" />
                                    </a>
                                </div>
                                <p className="text-xs text-white/40 mt-2">
                                    يحتوي هذا الرابط على رمز مشفر ({secureToken.substring(0, 8)}...) لا يظهر فيه رقم الغرفة.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// LOCATION SETTINGS FOR QR (NEW)
// ============================================================

const LocationSettingsComponent: React.FC<BranchSettingsProps> = ({ branchId, tenantId: propTenantId }) => {
    const { tenantId: contextTenantId } = useTenant();
    // ✅ Dynamic: Use prop tenantId (for owner) or context tenantId (for manager)
    const tenantId = propTenantId || contextTenantId;
    const { success, error } = useUX();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);
    
    // Settings state
    const [enabled, setEnabled] = useState(false);
    const [googleMapsLink, setGoogleMapsLink] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [maxDistance, setMaxDistance] = useState(100);
    const [autoDetect, setAutoDetect] = useState(true);
    const [deviceLimitEnabled, setDeviceLimitEnabled] = useState(true);
    const [maxDevices, setMaxDevices] = useState(2);

    useEffect(() => {
        loadSettings();
    }, [tenantId, branchId]);

    const loadSettings = async () => {
        if (!tenantId || !branchId) return;
        setLoading(true);
        try {
            const locationSettings = await getLocationSettings(tenantId, branchId);
            if (locationSettings) {
                setEnabled(locationSettings.enabled || false);
                setGoogleMapsLink(locationSettings.googleMapsLink || '');
                setMaxDistance(locationSettings.maxDistance || 100);
                setAutoDetect(locationSettings.autoDetect ?? true);
                
                if (locationSettings.coordinates) {
                    setLatitude(locationSettings.coordinates.latitude.toString());
                    setLongitude(locationSettings.coordinates.longitude.toString());
                }
            }
            
            // Load device limit settings
            const qrSettingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'qr');
            const qrSnap = await getDoc(qrSettingsRef);
            if (qrSnap.exists()) {
                const qrData = qrSnap.data();
                setDeviceLimitEnabled(qrData.deviceLimitEnabled ?? true);
                setMaxDevices(qrData.maxDevices ?? 2);
            }
        } catch (err) {
            console.error('Error loading location settings:', err);
            error('فشل تحميل الإعدادات');
        } finally {
            setLoading(false);
        }
    };

    const handleAutoDetect = () => {
        if (googleMapsLink) {
            const coords = extractCoordinatesFromLink(googleMapsLink);
            if (coords) {
                setLatitude(coords.latitude.toString());
                setLongitude(coords.longitude.toString());
                success('تم استخراج الإحداثيات من رابط خرائط جوجل');
            } else {
                error('لم يتم العثور على إحداثيات صحيحة في الرابط');
            }
        }
    };

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            error('المتصفح لا يدعم تحديد الموقع');
            return;
        }

        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLatitude(position.coords.latitude.toFixed(6));
                setLongitude(position.coords.longitude.toFixed(6));
                success('تم تحديد موقعك الحالي بنجاح');
                setLoading(false);
            },
            (err) => {
                error('فشل تحديد الموقع. يرجى السماح بالوصول للموقع');
                setLoading(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    const handleSave = async () => {
        if (!tenantId || !branchId) return;
        setSaving(true);
        try {
            const locationSettings: LocationSettings = {
                enabled,
                googleMapsLink: googleMapsLink || undefined,
                maxDistance,
                autoDetect,
                coordinates: (latitude && longitude) ? {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude)
                } : undefined
            };

            const saved = await saveLocationSettings(tenantId, branchId, locationSettings);
            
            if (!saved) {
                throw new Error('فشل حفظ إعدادات الموقع');
            }

            // Save device limit settings
            const qrSettingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'qr');
            await setDoc(qrSettingsRef, {
                deviceLimitEnabled,
                maxDevices,
                updatedAt: serverTimestamp()
            }, { merge: true });

            success('تم حفظ الإعدادات بنجاح');
        } catch (err: any) {
            console.error('Error saving location settings:', err);
            error(err.message || 'فشل الحفظ');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-2xl transition-colors duration-300 overflow-hidden border border-white/5 transition-all duration-300">
            {/* Header */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-6 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">إعدادات الموقع للكود (QR)</h3>
                        <p className="text-sm text-white/60">التحكم في التحقق من موقع النزيل والحد الأقصى للأجهزة</p>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-4 h-4 text-white/60" />
                </div>
            </div>

            {/* Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[800px] opacity-100'}`}>
                <div className="p-6 space-y-6">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <AdoraLoader size="md" message="جاري تحميل البيانات..." />
                        </div>
                    ) : (
                        <>
                            {/* Location Verification Toggle */}
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                                <div>
                                    <label className="font-semibold text-white block mb-1">
                                        تفعيل التحقق من الموقع
                                    </label>
                                    <p className="text-xs text-white/50">
                                        يتطلب من النزيل أن يكون في موقع الفندق لاستخدام QR
                                    </p>
                                </div>
                                <Switch
                                    checked={enabled}
                                    onChange={setEnabled}
                                />
                            </div>

                            {enabled && (
                                <>
                                    {/* Google Maps Link */}
                                    <div>
                                        <label className="block text-sm font-semibold text-white mb-2">
                                            رابط خرائط جوجل
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={googleMapsLink}
                                                onChange={(e) => setGoogleMapsLink(e.target.value)}
                                                placeholder="https://www.google.com/maps?q=lat,lng"
                                                className="input flex-1 transition-colors duration-300"
                                                style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                            />
                                            {autoDetect && (
                                                <button
                                                    onClick={handleAutoDetect}
                                                    className="px-4 py-2 bg-primary-600 rounded-lg hover:bg-primary-700 text-white text-sm font-medium whitespace-nowrap"
                                                >
                                                    استخراج الإحداثيات
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={handleUseCurrentLocation}
                                                disabled={loading}
                                                className="px-4 py-2 bg-teal-500/20 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 text-teal-400 text-sm font-medium transition-colors disabled:opacity-50"
                                            >
                                                <MapPin className="w-4 h-4 inline-block mr-1" />
                                                استخدام موقعي الحالي
                                            </button>
                                        </div>
                                        <p className="text-xs text-white/40 mt-1">
                                            الصق رابط خرائط جوجل للفندق أو استخدم موقعك الحالي أو حدد الموقع على الخريطة أدناه
                                        </p>
                                    </div>

                                    {/* Coordinates */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-white mb-2">
                                                خط العرض (Latitude)
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={latitude}
                                                onChange={(e) => {
                                                    setLatitude(e.target.value);
                                                    // Update map if valid
                                                    const lat = parseFloat(e.target.value);
                                                    if (!isNaN(lat) && longitude) {
                                                        const lng = parseFloat(longitude);
                                                        if (!isNaN(lng)) {
                                                            // Map will update via useEffect
                                                        }
                                                    }
                                                }}
                                                placeholder="24.7136"
                                                className="input w-full bg-slate-800/50 border-white/10 text-white placeholder-white/30"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-white mb-2">
                                                خط الطول (Longitude)
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={longitude}
                                                onChange={(e) => {
                                                    setLongitude(e.target.value);
                                                    // Update map if valid
                                                    if (latitude) {
                                                        const lat = parseFloat(latitude);
                                                        const lng = parseFloat(e.target.value);
                                                        if (!isNaN(lat) && !isNaN(lng)) {
                                                            // Map will update via useEffect
                                                        }
                                                    }
                                                }}
                                                placeholder="46.6753"
                                                className="input w-full bg-slate-800/50 border-white/10 text-white placeholder-white/30"
                                            />
                                        </div>
                                    </div>

                                    {/* Interactive Map */}
                                    <div>
                                        <label className="block text-sm font-semibold text-white mb-2">
                                            تحديد الموقع على الخريطة
                                        </label>
                                        <div className="rounded-xl p-1 transition-colors duration-300" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <InteractiveMap
                                                latitude={latitude && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : 24.7136}
                                                longitude={longitude && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : 46.6753}
                                                onCoordinatesChange={(lat, lng) => {
                                                    setLatitude(lat.toFixed(6));
                                                    setLongitude(lng.toFixed(6));
                                                }}
                                                height="350px"
                                            />
                                        </div>
                                        <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                                            <p className="text-xs text-blue-400 flex items-start gap-2">
                                                <span className="text-base">💡</span>
                                                <span>
                                                    <strong>طريقة سهلة:</strong> اسحب المؤشر الأحمر على الخريطة لتحديد موقع الفندق بدقة. 
                                                    يمكنك أيضاً الضغط على أي مكان في الخريطة لنقل المؤشر إليه.
                                                </span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Max Distance */}
                                    <div>
                                        <label className="block text-sm font-semibold text-white mb-2">
                                            المسافة القصوى المسموحة (بالمتر)
                                        </label>
                                        <input
                                            type="number"
                                            value={maxDistance}
                                            onChange={(e) => setMaxDistance(parseInt(e.target.value) || 500)}
                                            min={50}
                                            max={5000}
                                            step={50}
                                            className="input w-full bg-slate-800/50 border-white/10 text-white"
                                        />
                                        <p className="text-xs text-white/40 mt-1">
                                            المسافة القصوى التي يمكن أن يكون فيها النزيل من موقع الفندق (متر)
                                        </p>
                                    </div>

                                    {/* Auto Detect Toggle */}
                                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                                        <div>
                                            <label className="font-semibold text-white block mb-1">
                                                استخراج تلقائي للإحداثيات
                                            </label>
                                            <p className="text-xs text-white/50">
                                                استخراج الإحداثيات تلقائياً من رابط خرائط جوجل
                                            </p>
                                        </div>
                                        <Switch
                                            checked={autoDetect}
                                            onChange={setAutoDetect}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Device Limit Section */}
                            <div className="border-t border-white/10 pt-6">
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl mb-4">
                                    <div>
                                        <label className="font-semibold text-white block mb-1">
                                            تفعيل الحد الأقصى للأجهزة
                                        </label>
                                        <p className="text-xs text-white/50">
                                            تحديد الحد الأقصى لعدد الأجهزة المسموح بها لكل غرفة
                                        </p>
                                    </div>
                                    <Switch
                                        checked={deviceLimitEnabled}
                                        onChange={setDeviceLimitEnabled}
                                    />
                                </div>

                                {deviceLimitEnabled && (
                                    <div>
                                        <label className="block text-sm font-semibold text-white mb-2">
                                            الحد الأقصى للأجهزة لكل غرفة
                                        </label>
                                        <input
                                            type="number"
                                            value={maxDevices}
                                            onChange={(e) => setMaxDevices(parseInt(e.target.value) || 2)}
                                            min={1}
                                            max={10}
                                            className="input w-full bg-slate-800/50 border-white/10 text-white"
                                        />
                                        <p className="text-xs text-white/40 mt-1">
                                            عدد الأجهزة المسموح بها لكل غرفة (افتراضي: 2)
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <AdoraLoaderInline size={16} />
                                        جاري الحفظ...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        حفظ الإعدادات
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================
// GUEST PORTAL SETTINGS (NEW)
// ============================================================

const GuestPortalSettings: React.FC<BranchSettingsProps> = ({ branchId, tenantId: propTenantId }) => {
    const { tenantId: contextTenantId } = useTenant();
    const tenantId = propTenantId || contextTenantId;
    const { success, error } = useUX();
    const [enabledServices, setEnabledServices] = useState<Record<string, boolean>>({
        cleaning: true,
        maintenance: true,
        bellman: true,
        room_service: true,
        minibar: true
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);

    useEffect(() => {
        loadSettings();
    }, [tenantId, branchId]);

    const loadSettings = async () => {
        if (!tenantId || !branchId) return;
        setLoading(true);
        try {
            const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'services');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.enabledServices) {
                    setEnabledServices(prev => ({ ...prev, ...data.enabledServices }));
                }
            }
        } catch (err) {
            console.error('Error loading guest settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (key: string) => {
        setEnabledServices(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        if (!tenantId || !branchId) return;
        setSaving(true);
        try {
            const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'services');
            await setDoc(docRef, {
                enabledServices,
                updatedAt: serverTimestamp()
            }, { merge: true });
            success('تم تحديث إعدادات بوابة النزلاء');
        } catch (err) {
            console.error('Error saving guest settings:', err);
            error('فشل الحفظ');
        } finally {
            setSaving(false);
        }
    };

    const serviceList = [
        { key: 'cleaning', label: 'تنظيف الغرفة', icon: <Sparkles className="w-5 h-5 text-blue-400" /> },
        { key: 'maintenance', label: 'الصيانة', icon: <Wrench className="w-5 h-5 text-orange-400" /> },
        { key: 'bellman', label: 'البيلمان', icon: <BellRing className="w-5 h-5 text-purple-400" /> },
        { key: 'room_service', label: 'خدمة الغرف', icon: <Coffee className="w-5 h-5 text-green-400" /> },
        { key: 'minibar', label: 'الميني بار', icon: <Package className="w-5 h-5 text-amber-400" /> }
    ];

    return (
        <div className="rounded-2xl transition-colors duration-300 overflow-hidden border border-white/5 transition-all duration-300">
            {/* Header */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-6 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">إعدادات بوابة النزلاء (QR)</h3>
                        <p className="text-sm text-white/60">التحكم في الخدمات الظاهرة للنزيل عند مسح الكود</p>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-4 h-4 text-white/60" />
                </div>
            </div>

            {/* Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[600px] opacity-100'}`}>
                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <AdoraLoader size="md" message="جاري تحميل البيانات..." />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {serviceList.map(service => (
                                    <div
                                        key={service.key}
                                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${enabledServices[service.key]
                                            ? 'bg-white/10 border-indigo-500/30'
                                            : 'bg-white/5 border-white/5 opacity-60 hover:opacity-100'
                                            }`}
                                        onClick={() => handleToggle(service.key)}
                                    >
                                        <div className="flex items-center gap-3">
                                            {service.icon}
                                            <span className="text-white font-medium">{service.label}</span>
                                        </div>
                                        <div className={`w-10 h-6 rounded-full relative transition-colors ${enabledServices[service.key] ? 'bg-indigo-500' : 'bg-white/20'}`}>
                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${enabledServices[service.key] ? 'right-1' : 'left-1'}`} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-white/10 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="btn-primary px-6"
                                >
                                    {saving ? <AdoraLoaderInline size={16} /> : 'حفظ الإعدادات'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================
// RECEPTION VERIFICATION SETTINGS (Guest Portal Security)
// ============================================================

const ReceptionVerificationSettings: React.FC<BranchSettingsProps> = ({ branchId, tenantId: propTenantId }) => {
    const { tenantId: contextTenantId } = useTenant();
    const tenantId = propTenantId || contextTenantId;
    const { success, error } = useUX();
    const [settings, setSettings] = useState({
        autoApprovalTimeout: 5, // minutes
        verificationBase: 2,
        speedBonus: 3,
        autoPenalty: -1
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);

    useEffect(() => {
        loadSettings();
    }, [tenantId, branchId]);

    const loadSettings = async () => {
        if (!tenantId || !branchId) return;
        setLoading(true);
        try {
            const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'reception');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                setSettings(prev => ({ ...prev, ...data }));
            }
        } catch (err) {
            console.error('Error loading reception settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!tenantId || !branchId) return;
        setSaving(true);
        try {
            const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'reception');
            await setDoc(docRef, {
                ...settings,
                updatedAt: serverTimestamp()
            }, { merge: true });
            success('تم تحديث إعدادات التحقق من النزلاء');
        } catch (err) {
            console.error('Error saving reception settings:', err);
            error('فشل الحفظ');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-2xl transition-colors duration-300 overflow-hidden border border-white/5 transition-all duration-300">
            {/* Header */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-6 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">التحقق من النزلاء (Guest Verification)</h3>
                        <p className="text-sm text-white/60">إعدادات التحويل التلقائي والنقاط للاستقبال</p>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-4 h-4 text-white/60" />
                </div>
            </div>

            {/* Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[800px] opacity-100'}`}>
                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <AdoraLoader size="md" message="جاري تحميل البيانات..." />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Auto-Approval Timeout */}
                            <div>
                                <label className="block text-sm text-white/70 mb-3">
                                    <Clock className="w-4 h-4 inline mr-2 text-amber-400" />
                                    مدة التحويل التلقائي (بالدقائق)
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="5"
                                        max="15"
                                        value={settings.autoApprovalTimeout}
                                        onChange={(e) => setSettings(prev => ({ ...prev, autoApprovalTimeout: parseInt(e.target.value) }))}
                                        className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                        style={{
                                            background: `linear-gradient(to right, rgb(245, 158, 11) 0%, rgb(245, 158, 11) ${((settings.autoApprovalTimeout - 5) / 10) * 100}%, rgba(255,255,255,0.1) ${((settings.autoApprovalTimeout - 5) / 10) * 100}%, rgba(255,255,255,0.1) 100%)`
                                        }}
                                    />
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30">
                                        <span className="text-2xl font-bold text-amber-400">{settings.autoApprovalTimeout}</span>
                                        <span className="text-sm text-white/50">دقيقة</span>
                                    </div>
                                </div>
                                <p className="text-xs text-white/40 mt-2">
                                    إذا لم يستجب موظف الاستقبال خلال هذه المدة، سيتم الموافقة تلقائياً
                                </p>
                            </div>

                            {/* Points Configuration */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10">
                                {/* Base Points */}
                                <div>
                                    <label className="block text-sm text-white/70 mb-2">
                                        نقاط أساسية
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        value={settings.verificationBase}
                                        onChange={(e) => setSettings(prev => ({ ...prev, verificationBase: parseInt(e.target.value) || 0 }))}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-center font-bold focus:outline-none focus:border-green-500/50 transition-colors"
                                    />
                                    <p className="text-xs text-white/30 mt-1">للفحص والموافقة</p>
                                </div>

                                {/* Speed Bonus */}
                                <div>
                                    <label className="block text-sm text-white/70 mb-2">
                                        مكافأة السرعة
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        value={settings.speedBonus}
                                        onChange={(e) => setSettings(prev => ({ ...prev, speedBonus: parseInt(e.target.value) || 0 }))}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-center font-bold focus:outline-none focus:border-blue-500/50 transition-colors"
                                    />
                                    <p className="text-xs text-white/30 mt-1">استجابة سريعة</p>
                                </div>

                                {/* Auto Penalty */}
                                <div>
                                    <label className="block text-sm text-white/70 mb-2">
                                        خصم التأخير
                                    </label>
                                    <input
                                        type="number"
                                        min="-10"
                                        max="0"
                                        value={settings.autoPenalty}
                                        onChange={(e) => setSettings(prev => ({ ...prev, autoPenalty: parseInt(e.target.value) || 0 }))}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-center font-bold focus:outline-none focus:border-red-500/50 transition-colors"
                                    />
                                    <p className="text-xs text-white/30 mt-1">تحويل تلقائي</p>
                                </div>
                            </div>

                            {/* Example Calculation */}
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-xs text-white/50 mb-2 font-bold">مثال على حساب النقاط:</p>
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-white/40">استجابة سريعة ({"<"}{settings.autoApprovalTimeout} دقيقة):</span>
                                        <span className="text-green-400 font-bold">+{settings.verificationBase + settings.speedBonus} نقطة</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/40">تحويل تلقائي (≥{settings.autoApprovalTimeout} دقيقة):</span>
                                        <span className="text-amber-400 font-bold">+{Math.max(0, settings.verificationBase + settings.autoPenalty)} نقطة</span>
                                    </div>
                                </div>
                            </div>

                            {/* Save Button */}
                            <div className="pt-4 border-t border-white/10 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="btn-primary px-6"
                                >
                                    {saving ? <AdoraLoaderInline size={16} /> : 'حفظ الإعدادات'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


interface LaundryItem {
    id: string;
    name: string;
    price: number;
    tax: number;
    total: number;
}

const LaundryPriceManager: React.FC<BranchSettingsProps> = ({ branchId, tenantId: propTenantId }) => {
    const { tenantId: contextTenantId } = useTenant();
    const tenantId = propTenantId || contextTenantId;
    const { success, error } = useUX();
    const [items, setItems] = useState<LaundryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', total: '' });
    const [taxRate, setTaxRate] = useState(15); // Percentage
    // UI State
    const [isCollapsed, setIsCollapsed] = useState(true);

    useEffect(() => {
        loadItems();
    }, [tenantId, branchId]);

    const loadItems = async () => {
        if (!tenantId || !branchId) return;
        setLoading(true);
        try {
            const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_prices');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                setItems(data.items || []);
                if (data.taxRate !== undefined) setTaxRate(data.taxRate);
            }
        } catch (error) {
            console.error('Error loading laundry prices:', error);
        } finally {
            setLoading(false);
        }
    };

    // Load all default products from the standard price list
    const loadDefaultProducts = () => {
        const rate = taxRate / 100;
        // Calculate base price from total: price = total / (1 + rate)
        const fromTotal = (total: number) => ({
            price: total / (1 + rate),
            tax: total - (total / (1 + rate)),
            total: total
        });

        const defaultProducts: LaundryItem[] = [
            { id: '1', name: 'شرشف كبير', ...fromTotal(1.725) },
            { id: '2', name: 'شرشف صغير', ...fromTotal(1.495) },
            { id: '3', name: 'غطاء لحاف صغير', ...fromTotal(2.53) },
            { id: '4', name: 'غطاء لحاف كبير', ...fromTotal(2.53) },
            { id: '5', name: 'منشفة تجفيف', ...fromTotal(1.0925) },
            { id: '6', name: 'كيس مخدة', ...fromTotal(0.345) },
            { id: '7', name: 'بطانية كبيرة', ...fromTotal(2.875) },
            { id: '8', name: 'لحاف كبير', ...fromTotal(3.91) },
            { id: '9', name: 'شال مخدة', ...fromTotal(2.7025) },
            { id: '10', name: 'مفرش على ملاية السرير كبير', ...fromTotal(0.8625) },
            { id: '11', name: 'مفرش على ملاية السرير صغير', ...fromTotal(0.7475) },
            { id: '12', name: 'حزام سرير', ...fromTotal(2.3) },
            { id: '13', name: 'غطاء كرسي', ...fromTotal(1.3455) },
            { id: '14', name: 'دواسة حمام', ...fromTotal(0.675) },
            { id: '15', name: 'سجادة صلاة', ...fromTotal(0) },
            { id: '16', name: 'غي غطاء لحاف كبير / صغير', ...fromTotal(1.265) },
            { id: '17', name: 'ضاغط غطاء وسادة', ...fromTotal(0.1725) },
        ];

        setItems(defaultProducts);
    };

    // Update all items when tax rate changes - keep BASE PRICE fixed, recalculate tax and total
    const updateTaxRate = (newRate: number) => {
        setTaxRate(newRate);
        const rate = newRate / 100;
        setItems(prev => prev.map(item => ({
            ...item,
            tax: item.price * rate,
            total: item.price * (1 + rate)
        })));
    };

    const addItem = () => {
        if (!newItem.name || !newItem.total) return;
        const total = parseFloat(newItem.total);
        const rate = taxRate / 100;
        const price = total / (1 + rate);
        const tax = total - price;

        const item: LaundryItem = {
            id: Date.now().toString(),
            name: newItem.name,
            price, // Base stored
            tax,
            total
        };

        setItems(prev => [...prev, item]);
        setNewItem({ name: '', total: '' });
    };

    const deleteItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    // Move item up in the list
    const moveItemUp = (index: number) => {
        if (index <= 0) return;
        setItems(prev => {
            const newItems = [...prev];
            [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
            return newItems;
        });
    };

    // Move item down in the list
    const moveItemDown = (index: number) => {
        if (index >= items.length - 1) return;
        setItems(prev => {
            const newItems = [...prev];
            [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
            return newItems;
        });
    };

    const updateItemName = (id: string, newName: string) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, name: newName } : item
        ));
    };

    const updateItemTotal = (id: string, newTotal: number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const rate = taxRate / 100;
                const price = newTotal / (1 + rate);
                const tax = newTotal - price;
                return { ...item, price, tax, total: newTotal };
            }
            return item;
        }));
    };

    const handleSave = async () => {
        if (!tenantId || !branchId) return;
        setSaving(true);
        try {
            const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'laundry_prices');
            await setDoc(docRef, {
                items,
                taxRate,
                updatedAt: serverTimestamp()
            });
            success('تم حفظ إعدادات المغسلة بنجاح');
        } catch (err) {
            console.error('Error saving:', err);
            error('فشل الحفظ');
        } finally {
            setSaving(false);
        }
    };

    // Default to closed for cleaner UI
    if (loading) {
        return (
            <div className="flex justify-center items-center py-8">
                <AdoraLoader size="md" message="جاري تحميل البيانات..." />
            </div>
        );
    }

    return (
        <div className="rounded-2xl transition-colors duration-300 overflow-hidden mb-6 lg:col-span-2 border border-white/5 transition-all duration-300">
            {/* Header */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-6 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                        <Shirt className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">أسعار ومنتجات المغسلة</h3>
                        <p className="text-sm text-white/60">
                            {items.length} منتج مسجل | الضريبة: {taxRate}%
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                        <ChevronDown className="w-4 h-4 text-white/60" />
                    </div>
                </div>
            </div>

            {/* Collapsible Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[1000px] opacity-100'}`}>
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4 bg-white/5 p-3 rounded-xl">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-white/60">نسبة الضريبة:</span>
                            <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
                                <input
                                    type="number"
                                    value={taxRate}
                                    onChange={(e) => updateTaxRate(parseFloat(e.target.value) || 0)}
                                    className="w-12 bg-transparent text-center font-bold text-cyan-400 outline-none"
                                />
                                <span className="text-xs text-white/40">%</span>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="btn-primary"
                        >
                            {saving ? <AdoraLoaderInline size={16} /> : <><Save className="w-4 h-4" /> حفظ التغييرات</>}
                        </button>
                    </div>

                    {/* Add New Item */}
                    <div className="flex flex-wrap gap-2 mb-6 p-4 bg-white/5 rounded-xl">
                        <input
                            type="text"
                            value={newItem.name}
                            onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                            placeholder="اسم المنتج (مثال: ملائة سرير)"
                            className="input flex-1 min-w-[200px]"
                        />
                        <input
                            type="number"
                            value={newItem.total}
                            onChange={e => setNewItem({ ...newItem, total: e.target.value })}
                            placeholder="السعر شامل الضريبة"
                            className="input w-40 text-center"
                        />
                        <button onClick={addItem} className="btn-primary px-4">
                            <Plus className="w-5 h-5" />
                        </button>
                        <button
                            onClick={loadDefaultProducts}
                            className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors flex items-center gap-2"
                            title="تحميل قائمة المنتجات الافتراضية (17 منتج)"
                        >
                            <Sparkles className="w-4 h-4" />
                            تحميل الافتراضي
                        </button>
                    </div>

                    {/* Items Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-white">
                            <thead className="text-white/50 border-b border-white/10">
                                <tr>
                                    <th className="pb-3 pr-2 text-center w-12">م</th>
                                    <th className="pb-3 pr-2 text-center w-16">ترتيب</th>
                                    <th className="pb-3 pr-4">الصنف</th>
                                    <th className="pb-3 px-2 text-center text-cyan-400">السعر شامل الضريبة</th>
                                    <th className="pb-3 px-2 text-center">الأساسي</th>
                                    <th className="pb-3 px-2 text-center">الضريبة</th>
                                    <th className="pb-3 pl-4 text-left">حذف</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {items.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                        {/* Serial Number */}
                                        <td className="py-2 pr-2 text-center text-white/40 font-mono">
                                            {index + 1}
                                        </td>
                                        {/* Reorder Buttons */}
                                        <td className="py-2 pr-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => moveItemUp(index)}
                                                    disabled={index === 0}
                                                    className={`p-1 rounded transition-colors ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 text-white/60 hover:text-white'}`}
                                                    title="تحريك لأعلى"
                                                >
                                                    <ChevronUp className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => moveItemDown(index)}
                                                    disabled={index === items.length - 1}
                                                    className={`p-1 rounded transition-colors ${index === items.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 text-white/60 hover:text-white'}`}
                                                    title="تحريك لأسفل"
                                                >
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                        {/* Name */}
                                        <td className="py-2 pr-4">
                                            <input
                                                value={item.name}
                                                onChange={(e) => updateItemName(item.id, e.target.value)}
                                                className="bg-transparent border-b border-transparent focus:border-white/20 outline-none w-full py-1 text-white"
                                            />
                                        </td>
                                        {/* Total Price */}
                                        <td className="py-2 px-2 text-center">
                                            <input
                                                type="number"
                                                value={parseFloat(item.total.toFixed(2))}
                                                onChange={(e) => updateItemTotal(item.id, parseFloat(e.target.value) || 0)}
                                                className="w-20 bg-white/5 rounded px-2 py-1 text-center font-bold text-cyan-400 focus:bg-white/10 outline-none"
                                                step="0.01"
                                            />
                                        </td>
                                        {/* Base Price */}
                                        <td className="py-2 px-2 text-center text-white/50 text-sm">
                                            {item.price.toFixed(2)}
                                        </td>
                                        {/* Tax */}
                                        <td className="py-2 px-2 text-center text-white/50 text-sm">
                                            {item.tax.toFixed(2)}
                                        </td>
                                        {/* Delete */}
                                        <td className="py-2 pl-4 text-left">
                                            <button
                                                onClick={() => deleteItem(item.id)}
                                                className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <p className="text-xs text-white/40 mt-4">
                        * يمكنك تعديل اسم المنتج والسعر الإجمالي مباشرة. يتم حساب السعر الأساسي والضريبة تلقائياً بناءً على نسبة {taxRate}%.
                    </p>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// SYSTEM TOGGLES
// ============================================================

const SystemToggles: React.FC<BranchSettingsProps> = ({ branchId, tenantId: propTenantId }) => {
    const { tenantId: contextTenantId } = useTenant();
    const tenantId = propTenantId || contextTenantId;
    const [settings, setSettings] = useState({
        maintenanceMode: false,
        soundEnabled: true,
        notificationsEnabled: true,
    });
    const [loading, setLoading] = useState(false);

    // UI State
    const [isCollapsed, setIsCollapsed] = useState(true);

    // Load settings for specific branch
    useEffect(() => {
        const loadSettings = async () => {
            if (!tenantId || !branchId) return;
            setLoading(true);
            try {
                // Path: tenants/{tenantId}/branches/{branchId}/settings/system
                const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'system');
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setSettings(prev => ({ ...prev, ...snap.data() }));
                }
            } catch (error) {
                console.error('Error loading system settings:', error);
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, [tenantId, branchId]);

    const toggleSetting = async (key: keyof typeof settings) => {
        if (!tenantId || !branchId) return;
        const newValue = !settings[key];

        // Optimistic update
        setSettings(prev => ({ ...prev, [key]: newValue }));

        try {
            const docRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'system');
            await setDoc(docRef, { [key]: newValue }, { merge: true });
        } catch (error) {
            console.error('Error saving system setting:', error);
            // Revert on error
            setSettings(prev => ({ ...prev, [key]: !newValue }));
        }
    };

    return (
        <div className="rounded-2xl transition-colors duration-300 overflow-hidden border border-white/5 transition-all duration-300 flex flex-col h-fit">
            {/* Header */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-6 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10">
                        <Power className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">إعدادات النظام</h3>
                        <p className="text-sm text-white/50">التحكم في وظائف النظام لهذا الفرع</p>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-4 h-4 text-white/60" />
                </div>
            </div>

            {/* Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[800px] opacity-100'}`}>
                <div className="p-6">
                    {loading ? (
                        <div className="py-8 flex items-center justify-center">
                            <AdoraLoader size="md" message="جاري تحميل البيانات..." />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <ToggleItem
                                label="وضع الصيانة"
                                description="إيقاف استقبال طلبات النزلاء مؤقتاً"
                                enabled={settings.maintenanceMode}
                                onToggle={() => toggleSetting('maintenanceMode')}
                                warning
                            />
                            <ToggleItem
                                label="الأصوات"
                                description="تشغيل أصوات التنبيهات"
                                enabled={settings.soundEnabled}
                                onToggle={() => toggleSetting('soundEnabled')}
                            />
                            <ToggleItem
                                label="الإشعارات"
                                description="إظهار إشعارات المتصفح"
                                enabled={settings.notificationsEnabled}
                                onToggle={() => toggleSetting('notificationsEnabled')}
                            />

                            {/* Help block */}
                            <div className="mt-6 p-4 rounded-xl bg-primary-500/5 border border-primary-500/10">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-primary-400 mt-0.5" />
                                    <p className="text-xs text-white/40 leading-relaxed">
                                        هذه الإعدادات تؤثر فقط على <b>هذا الفرع</b>. لتغيير الإعدادات العامة لجميع الفروع، انتقل لتبويب "الإعدادات العامة".
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface ToggleItemProps {
    label: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
    warning?: boolean;
}

const ToggleItem: React.FC<ToggleItemProps> = ({ label, description, enabled, onToggle, warning }) => (
    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5">
        <div className="flex items-center gap-3">
            {warning && enabled && <AlertTriangle className="w-5 h-5 text-orange-400" />}
            <div>
                <p className="text-white">{label}</p>
                <p className="text-xs text-white/50">{description}</p>
            </div>
        </div>
        <button
            onClick={onToggle}
            className={`w-14 h-8 rounded-full transition-all relative ${enabled ? 'bg-primary-600' : 'bg-white/20'
                }`}
        >
            <div
                className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${enabled ? 'right-1' : 'left-1'
                    }`}
            />
        </button>
    </div>
);

// ============================================================
// WORKING HOURS SETTINGS
// ============================================================

interface DepartmentHours {
    is24h: boolean;
    open: string;
    close: string;
}

interface WorkingHours {
    cleaning: DepartmentHours;
    maintenance: DepartmentHours;
    bellman: DepartmentHours;
    coffee: DepartmentHours;
    reception: DepartmentHours;
}

const DEFAULT_HOURS: DepartmentHours = { is24h: true, open: '08:00', close: '22:00' };

const DEPARTMENTS_LIST = [
    { key: 'cleaning', label: 'الهاوسكيبنج', icon: <Sparkles className="w-5 h-5" />, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    { key: 'maintenance', label: 'الصيانة', icon: <Settings className="w-5 h-5" />, color: 'text-amber-400', bg: 'bg-amber-500/20' },
    { key: 'bellman', label: 'البيلمان', icon: <Building2 className="w-5 h-5" />, color: 'text-purple-400', bg: 'bg-purple-500/20' },
    { key: 'coffee', label: 'الكوفي شوب', icon: <Settings className="w-5 h-5" />, color: 'text-orange-400', bg: 'bg-orange-500/20' },
    { key: 'reception', label: 'الاستقبال', icon: <Building2 className="w-5 h-5" />, color: 'text-blue-400', bg: 'bg-blue-500/20' },
];

const WorkingHoursSettings: React.FC<BranchSettingsProps> = ({ branchId, tenantId: propTenantId }) => {
    const { tenantId: contextTenantId } = useTenant();
    const tenantId = propTenantId || contextTenantId;

    const [hours, setHours] = useState<WorkingHours>({
        cleaning: { ...DEFAULT_HOURS },
        maintenance: { ...DEFAULT_HOURS },
        bellman: { ...DEFAULT_HOURS },
        coffee: { ...DEFAULT_HOURS },
        reception: { ...DEFAULT_HOURS }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // UI State
    const [isCollapsed, setIsCollapsed] = useState(true);

    useEffect(() => {
        loadSettings();
    }, [tenantId, branchId]);

    const loadSettings = async () => {
        if (!tenantId || !branchId) return;
        setLoading(true);
        try {
            // Path: tenants/{tenantId}/branches/{branchId}/settings/workingHours
            const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'workingHours');

            const snapshot = await getDoc(settingsRef);
            if (snapshot.exists()) {
                const data = snapshot.data();
                setHours({
                    cleaning: { ...DEFAULT_HOURS, ...data.cleaning },
                    maintenance: { ...DEFAULT_HOURS, ...data.maintenance },
                    bellman: { ...DEFAULT_HOURS, ...data.bellman },
                    coffee: { ...DEFAULT_HOURS, ...data.coffee },
                    reception: { ...DEFAULT_HOURS, ...data.reception }
                });
            } else {
                // Defaults
                setHours({
                    cleaning: { ...DEFAULT_HOURS },
                    maintenance: { ...DEFAULT_HOURS },
                    bellman: { ...DEFAULT_HOURS },
                    coffee: { ...DEFAULT_HOURS },
                    reception: { ...DEFAULT_HOURS }
                });
            }
        } catch (error) {
            console.error('Error loading working hours:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateDepartment = (dept: keyof WorkingHours, field: keyof DepartmentHours, value: string | boolean) => {
        setHours(prev => ({
            ...prev,
            [dept]: { ...prev[dept], [field]: value }
        }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!tenantId || !branchId) return;
        setSaving(true);
        try {
            const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'workingHours');
            await setDoc(settingsRef, {
                ...hours,
                updatedAt: serverTimestamp()
            });
            setHasChanges(false);
            await customConfirm({
                title: 'تم الحفظ',
                message: 'تم حفظ أوقات العمل للفرع بنجاح',
                confirmText: 'حسناً',
                showCancel: false,
                type: 'success'
            });
        } catch (error) {
            console.error('Error saving working hours:', error);
            await customConfirm({
                title: 'خطأ',
                message: 'فشل الحفظ',
                confirmText: 'حسناً',
                showCancel: false,
                type: 'danger'
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return null;

    return (
        <div className="rounded-2xl transition-colors duration-300 overflow-hidden border border-white/5 transition-all duration-300">
            {/* Header */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-6 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center shadow-lg shadow-green-500/10">
                        <Clock className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">أوقات العمل</h3>
                        <p className="text-sm text-white/50">تحديد أوقات عمل كل قسم</p>
                    </div>
                </div>
                <div className={`flex items-center gap-3`}>
                    {hasChanges && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleSave(); }}
                            disabled={saving}
                            className="btn-primary py-1 px-3 text-xs"
                        >
                            {saving ? <AdoraLoaderInline size={16} /> : 'حفظ'}
                        </button>
                    )}
                    <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                        <ChevronDown className="w-4 h-4 text-white/60" />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[1200px] opacity-100'}`}>
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {DEPARTMENTS_LIST.map(dept => {
                            const deptHours = hours[dept.key as keyof WorkingHours];
                            return (
                                <div key={dept.key} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-lg ${dept.bg} flex items-center justify-center ${dept.color}`}>
                                                {dept.icon}
                                            </div>
                                            <span className="text-white font-medium">{dept.label}</span>
                                        </div>
                                        <button
                                            onClick={() => updateDepartment(dept.key as keyof WorkingHours, 'is24h', !deptHours.is24h)}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${deptHours.is24h
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : 'bg-white/10 text-white/60 border border-white/10'
                                                }`}
                                        >
                                            24 ساعة
                                        </button>
                                    </div>

                                    {!deptHours.is24h ? (
                                        <div className="grid grid-cols-2 gap-3 mt-1">
                                            <div className="relative">
                                                <label className="text-[10px] text-white/30 uppercase tracking-tighter mb-1 block">فتح</label>
                                                <input
                                                    type="time"
                                                    value={deptHours.open}
                                                    onChange={(e) => updateDepartment(dept.key as keyof WorkingHours, 'open', e.target.value)}
                                                    className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs text-center focus:ring-1 focus:ring-primary-500/50 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="relative">
                                                <label className="text-[10px] text-white/30 uppercase tracking-tighter mb-1 block">إغلاق</label>
                                                <input
                                                    type="time"
                                                    value={deptHours.close}
                                                    onChange={(e) => updateDepartment(dept.key as keyof WorkingHours, 'close', e.target.value)}
                                                    className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs text-center focus:ring-1 focus:ring-primary-500/50 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-[46px] flex items-center justify-center border border-dashed border-white/5 rounded-lg mt-1">
                                            <span className="text-[10px] text-white/20 uppercase tracking-widest italic font-bold">متاح دائماً</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// BRANCH CONTACT SETTINGS (WhatsApp & Phone)
// ============================================================

interface BranchContactSettingsProps {
    branchId: string;
    branchName: string;
    tenantId?: string; // ✅ Dynamic: For owner viewing branches from different managers
}

const BranchContactSettings: React.FC<BranchContactSettingsProps> = ({ branchId, branchName, tenantId: propTenantId }) => {
    const { tenantId: contextTenantId } = useTenant();
    // ✅ Dynamic: Use prop tenantId (for owner) or context tenantId (for manager)
    const tenantId = propTenantId || contextTenantId;
    const { success, error: showError } = useUX();

    const [contactInfo, setContactInfo] = useState({
        receptionPhone: '',
        whatsappNumber: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadContactSettings();
    }, [tenantId, branchId]);

    const loadContactSettings = async () => {
        if (!tenantId || !branchId) return;
        setLoading(true);
        try {
            const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'contact');
            const snap = await getDoc(settingsRef);
            if (snap.exists()) {
                const data = snap.data();
                setContactInfo({
                    receptionPhone: data.receptionPhone || '',
                    whatsappNumber: data.whatsappNumber || '',
                });
            }
        } catch (err) {
            console.error('Error loading contact settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const saveContactSettings = async () => {
        if (!tenantId || !branchId) return;
        setSaving(true);
        try {
            const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'contact');
            await setDoc(settingsRef, {
                ...contactInfo,
                updatedAt: serverTimestamp(),
            }, { merge: true });
            success('تم حفظ إعدادات التواصل');
        } catch (err) {
            console.error('Error saving contact settings:', err);
            showError('فشل حفظ الإعدادات');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-2xl transition-colors duration-300-dark rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <Phone className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">إعدادات التواصل</h3>
                        <p className="text-sm text-white/50">أرقام الهاتف والواتساب للنزلاء - {branchName}</p>
                    </div>
                </div>
            </div>
            <div className="p-5">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <AdoraLoader size="md" message="جاري تحميل البيانات..." />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-white/60 mb-2">هاتف الاستقبال</label>
                            <input
                                type="tel"
                                value={contactInfo.receptionPhone}
                                onChange={(e) => setContactInfo({ ...contactInfo, receptionPhone: e.target.value })}
                                placeholder="+966500000000"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-primary-500 focus:outline-none transition-colors"
                                dir="ltr"
                            />
                            <p className="text-xs text-white/30 mt-1">يظهر للنزيل عند الضغط على "اتصال بالاستقبال"</p>
                        </div>

                        <div>
                            <label className="block text-sm text-white/60 mb-2">رقم واتساب</label>
                            <input
                                type="tel"
                                value={contactInfo.whatsappNumber}
                                onChange={(e) => setContactInfo({ ...contactInfo, whatsappNumber: e.target.value })}
                                placeholder="966500000000"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-primary-500 focus:outline-none transition-colors"
                                dir="ltr"
                            />
                            <p className="text-xs text-white/30 mt-1">بدون علامة + (مثال: 966500000000)</p>
                        </div>

                        <button
                            onClick={saveContactSettings}
                            disabled={saving}
                            className="w-full py-3 rounded-xl bg-primary-500 text-white font-bold hover:bg-primary-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {saving ? <AdoraLoaderInline size={20} /> : <Save className="w-5 h-5" />}
                            حفظ الإعدادات
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================================
// CALENDAR SOURCES MANAGER (Tenant Level)
// ============================================================

const CalendarSourcesManager: React.FC = () => {
    const { tenantId } = useTenant();
    const { success, error: showError } = useUX();

    const [sources, setSources] = useState<CalendarSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [newSource, setNewSource] = useState({ name: '', url: '' });
    const [showAddForm, setShowAddForm] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);

    useEffect(() => {
        loadSources();
    }, [tenantId]);

    const loadSources = async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const settings = await getCalendarSources(tenantId);
            setSources(settings.sources);
            setLastSync(settings.lastSyncAt?.toDate() || null);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (sourceId: string, enabled: boolean) => {
        if (!tenantId) return;
        try {
            await toggleCalendarSource(tenantId, sourceId, enabled);
            setSources(prev => prev.map(s => s.id === sourceId ? { ...s, enabled } : s));
        } catch (error) {
            showError('فشل في تحديث المصدر');
        }
    };

    const handleAddSource = async () => {
        if (!tenantId) return;
        if (!newSource.name || !newSource.url) {
            showError('يرجى ملء جميع الحقول');
            return;
        }

        // Validate URL
        try {
            new URL(newSource.url);
        } catch {
            showError('رابط غير صالح');
            return;
        }

        setSaving(true);
        try {
            const added = await addCalendarSource(tenantId, {
                name: newSource.name,
                url: newSource.url,
                enabled: true
            });
            setSources(prev => [...prev, added]);
            setNewSource({ name: '', url: '' });
            setShowAddForm(false);
            success('تم إضافة المصدر');
        } catch (error) {
            showError('فشل في إضافة المصدر');
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveSource = async (sourceId: string) => {
        if (!tenantId) return;
        if (!confirm('حذف هذا المصدر؟')) return;
        try {
            await removeCalendarSource(tenantId, sourceId);
            setSources(prev => prev.filter(s => s.id !== sourceId));
            success('تم حذف المصدر');
        } catch (error) {
            showError('فشل في حذف المصدر');
        }
    };

    const handleResetToDefaults = async () => {
        if (!tenantId) return;
        if (!confirm('إعادة تعيين المصادر إلى الافتراضية؟ سيتم حذف أي مصادر مخصصة.')) return;
        setSaving(true);
        try {
            await saveCalendarSources(tenantId, {
                sources: DEFAULT_CALENDAR_SOURCES,
                lastSyncAt: null,
                autoSync: false
            });
            setSources(DEFAULT_CALENDAR_SOURCES);
            success('تم إعادة التعيين');
        } catch (error) {
            showError('فشل في إعادة التعيين');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <AdoraLoader size="md" message="جاري تحميل البيانات..." />
            </div>
        );
    }

    return (
        <div className="rounded-2xl transition-colors duration-300-dark rounded-2xl overflow-hidden border border-white/5 transition-all duration-300">
            {/* Header */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-6 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">مصادر المواسم الخارجية</h3>
                        <p className="text-sm text-slate-400">
                            {sources.filter(s => s.enabled).length} مصدر مفعل | {sources.length} إجمالي
                        </p>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-4 h-4 text-white/60" />
                </div>
            </div>

            {/* Collapsible Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[800px] opacity-100'}`}>
                <div className="p-6 space-y-6">
                    {/* Controls */}
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleResetToDefaults(); }}
                            className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition"
                        >
                            إعادة تعيين
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowAddForm(!showAddForm); }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            إضافة مصدر
                        </button>
                    </div>

                    {/* Last Sync Info */}
                    {lastSync && (
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            آخر مزامنة: {lastSync.toLocaleDateString('ar-EG')} - {lastSync.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}

                    {/* Add New Source Form */}
                    {showAddForm && (
                        <div className="rounded-2xl transition-colors duration-300 p-4 border border-purple-500/20 space-y-3" style={{ background: 'var(--theme-bg-tertiary)' }}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">اسم المصدر</label>
                                    <input
                                        type="text"
                                        value={newSource.name}
                                        onChange={e => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="مثال: تقويم الإمارات"
                                        className="w-full rounded-lg p-2 text-sm transition-colors duration-300"
                                        style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">رابط المصدر</label>
                                    <input
                                        type="url"
                                        value={newSource.url}
                                        onChange={e => setNewSource(prev => ({ ...prev, url: e.target.value }))}
                                        placeholder="https://example.com/calendar"
                                        className="w-full rounded-lg p-2 text-sm transition-colors duration-300"
                                        style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleAddSource}
                                    disabled={saving}
                                    className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition text-sm disabled:opacity-50"
                                >
                                    {saving ? <AdoraLoaderInline size={16} /> : <Check className="w-4 h-4" />}
                                    حفظ
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Sources List */}
                    <div className="space-y-2">
                        {sources.map(source => (
                            <div
                                key={source.id}
                                className={`rounded-xl p-4 flex items-center justify-between gap-4 transition-all border border-slate-700/50 ${source.enabled
                                    ? ''
                                    : ''
                                    }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${source.enabled ? 'bg-green-500' : 'bg-slate-500'}`} />
                                        <span className="font-medium text-white truncate">{source.name}</span>
                                    </div>
                                    <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-slate-400 hover:text-purple-400 truncate block mt-1"
                                        dir="ltr"
                                    >
                                        {source.url}
                                    </a>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Toggle */}
                                    <Switch
                                        checked={source.enabled}
                                        onChange={(val) => handleToggle(source.id, val)}
                                        size="sm"
                                    />

                                    {/* Delete */}
                                    <button
                                        onClick={() => handleRemoveSource(source.id)}
                                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {sources.length === 0 && (
                            <div className="text-center p-8 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                                لا توجد مصادر مضافة. أضف مصدراً جديداً أو اضغط "إعادة تعيين" للمصادر الافتراضية.
                            </div>
                        )}
                    </div>

                    {/* Info Note */}
                    <div className="text-xs p-3 rounded-lg transition-colors duration-300" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-text-tertiary)' }}>
                        <strong className="text-purple-400">💡 ملاحظة:</strong> يتم استخدام هذه المصادر عند الضغط على "مزامنة المواسم" في صفحة التسعير.
                        المصادر المفعلة فقط سيتم جلب البيانات منها.
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// PRODUCTS MANAGER
// ============================================================

const ProductsManager: React.FC<BranchSettingsProps> = ({ branchId, tenantId: propTenantId }) => {
    const { tenantId: contextTenantId } = useTenant();
    const tenantId = propTenantId || contextTenantId;

    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', price: 0, category: 'beverage' });

    // UI State
    const [isCollapsed, setIsCollapsed] = useState(true);

    useEffect(() => {
        loadProducts();
    }, [tenantId, branchId]);

    const loadProducts = async () => {
        if (!tenantId || !branchId) return;
        setLoading(true);
        try {
            const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'products');
            const snapshot = await getDoc(settingsRef);
            if (snapshot.exists()) {
                setProducts(snapshot.data().items || []);
            } else {
                setProducts([
                    { id: '1', name: 'ماء', nameEn: 'Water', price: 3, category: 'beverage', isActive: true },
                    { id: '2', name: 'كولا', nameEn: 'Cola', price: 5, category: 'beverage', isActive: true },
                ]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!tenantId || !branchId) return;
        setSaving(true);
        try {
            const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'products');
            await setDoc(settingsRef, {
                items: products,
                updatedAt: serverTimestamp()
            });
            setHasChanges(false);
            await customConfirm({
                title: 'تم الحفظ',
                message: 'تم حفظ المنتجات للفرع بنجاح',
                confirmText: 'حسناً',
                showCancel: false,
                type: 'success'
            });
        } catch (error) {
            console.error(error);
            await customConfirm({
                title: 'خطأ',
                message: 'فشل الحفظ',
                confirmText: 'حسناً',
                showCancel: false,
                type: 'danger'
            });
        } finally {
            setSaving(false);
        }
    };

    const addProduct = () => {
        if (!newProduct.name) return;
        setProducts([...products, { ...newProduct, id: Date.now().toString(), isActive: true }]);
        setNewProduct({ name: '', price: 0, category: 'beverage' });
        setHasChanges(true);
    };

    const deleteProduct = (id: string) => {
        setProducts(products.filter(p => p.id !== id));
        setHasChanges(true);
    };

    if (loading) return null;

    return (
        <div className="rounded-2xl transition-colors duration-300 overflow-hidden border border-white/5 transition-all duration-300">
            {/* Header */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-6 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">المنتجات (ميني بار / كوفي)</h3>
                        <p className="text-sm text-white/60">{products.length} منتج مسجل</p>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-4 h-4 text-white/60" />
                </div>
            </div>

            {/* Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[800px] opacity-100 overflow-y-auto'}`}>
                <div className="p-6">
                    <div className="flex justify-end mb-4">
                        {hasChanges && (
                            <button onClick={handleSave} disabled={saving} className="btn-primary">
                                {saving ? <AdoraLoaderInline size={16} /> : 'حفظ التغييرات'}
                            </button>
                        )}
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 mb-4 flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[150px]">
                            <label className="text-[10px] text-white/40 mb-1 block">اسم المنتج</label>
                            <input
                                type="text"
                                value={newProduct.name}
                                onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                placeholder="ماء، كولا..."
                                className="input w-full"
                            />
                        </div>
                        <div className="w-24">
                            <label className="text-[10px] text-white/40 mb-1 block">السعر</label>
                            <input
                                type="number"
                                value={newProduct.price}
                                onChange={e => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                                className="input w-full text-center"
                            />
                        </div>
                        <button onClick={addProduct} className="btn-primary px-3 h-[42px]">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {products.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                                <span className="text-white font-medium">{p.name}</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-amber-400 font-bold">{p.price} ر.س</span>
                                    <button onClick={() => deleteProduct(p.id)} className="text-red-400 hover:text-red-300 p-1">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


// ============================================================
// BRANCH SETTINGS (ISOLATED)
// ============================================================

const BranchSettings: React.FC<BranchSettingsProps> = ({ branchId, tenantId: propTenantId }) => {
    const { tenantId: contextTenantId } = useTenant();
    const tenantId = propTenantId || contextTenantId;
    const { success, error } = useUX();
    const [formData, setFormData] = useState({ branchName: '', branchCode: '', logoUrl: '' });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    // UI State
    const [isCollapsed, setIsCollapsed] = useState(false); // Open by default as it's the main info
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadSettings = async () => {
            if (!tenantId || !branchId) return;
            setLoading(true);
            try {
                const branchRef = doc(db, `tenants/${tenantId}/branches`, branchId);
                const branchSnap = await getDoc(branchRef);
                if (branchSnap.exists()) {
                    const data = branchSnap.data();
                    setFormData({
                        branchName: data.name || '',
                        branchCode: data.code || '',
                        logoUrl: data.logoUrl || '',
                    });
                }
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        loadSettings();
    }, [tenantId, branchId]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            error('يرجى اختيار صورة فقط');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            error('حجم الصورة يجب أن لا يتجاوز 2 ميجابايت');
            return;
        }

        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, logoUrl: reader.result as string });
                setUploading(false);
                success('تم تحميل الشعار');
            };
            reader.onerror = () => {
                error('فشل تحميل الصورة');
                setUploading(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            error('فشل تحميل الصورة');
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!tenantId || !branchId) return;
        setSaving(true);
        try {
            const branchRef = doc(db, `tenants/${tenantId}/branches`, branchId);
            await setDoc(branchRef, { logoUrl: formData.logoUrl, updatedAt: serverTimestamp() }, { merge: true });
            success('تم حفظ البيانات');
        } catch (err) { error('فشل الحفظ'); } finally { setSaving(false); }
    };

    if (loading) return null;

    return (
        <div className="rounded-2xl transition-colors duration-300 overflow-hidden border border-white/5 transition-all duration-300">
            {/* Header */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-6 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">بيانات الفرع</h3>
                        <p className="text-sm text-white/60">{formData.branchName}</p>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-4 h-4 text-white/60" />
                </div>
            </div>

            {/* Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[800px] opacity-100'}`}>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm text-white/60 mb-1">اسم الفرع</label>
                        <input value={formData.branchName} disabled className="input opacity-60" />
                    </div>
                    <div>
                        <label className="block text-sm text-white/60 mb-1">كود الفرع</label>
                        <input value={formData.branchCode} disabled className="input opacity-60" />
                    </div>

                    {/* Logo Section */}
                    <div>
                        <label className="block text-sm text-white/60 mb-2">شعار الفرع</label>

                        {/* Logo Preview */}
                        {formData.logoUrl && (
                            <div className="mb-3 p-4 bg-white/5 rounded-xl flex items-center justify-center">
                                <img
                                    src={formData.logoUrl}
                                    alt="شعار الفرع"
                                    className="max-h-24 max-w-full object-contain rounded-lg"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                            </div>
                        )}

                        {/* Upload Options */}
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="flex-1 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center justify-center gap-2"
                            >
                                {uploading ? (
                                    <AdoraLoaderInline size={16} />
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        رفع صورة
                                    </>
                                )}
                            </button>

                            {formData.logoUrl && (
                                <button
                                    onClick={() => setFormData({ ...formData, logoUrl: '' })}
                                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    حذف
                                </button>
                            )}
                        </div>

                        {/* URL Input */}
                        <div className="mt-3">
                            <p className="text-xs text-white/40 mb-1">أو أدخل رابط الصورة مباشرة:</p>
                            <input
                                value={formData.logoUrl?.startsWith('data:') ? '' : formData.logoUrl}
                                onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                                className="input text-sm"
                                placeholder="https://example.com/logo.png"
                            />
                        </div>
                    </div>

                    <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
                        {saving ? <AdoraLoaderInline size={16} /> : 'حفظ'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

// ============================================================
// GENERAL ORGANIZATION SETTINGS (NEW)
// ============================================================

const GeneralSettings: React.FC = () => {
    const { tenantId } = useTenant();
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            if (!tenantId) return;
            try {
                const docRef = doc(db, 'tenants', tenantId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setName(snap.data().info?.name || '');
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [tenantId]);

    const handleSave = async () => {
        if (!tenantId) return;
        setSaving(true);
        try {
            const docRef = doc(db, 'tenants', tenantId);
            await setDoc(docRef, { info: { name } }, { merge: true });
            await customConfirm({
                title: 'تم الحفظ',
                message: 'تم حفظ البيانات العامة بنجاح',
                confirmText: 'حسناً',
                showCancel: false,
                type: 'success'
            });
        } catch (e) {
            await customConfirm({
                title: 'خطأ',
                message: 'فشل الحفظ',
                confirmText: 'حسناً',
                showCancel: false,
                type: 'danger'
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return null;

    return (
        <div className="rounded-2xl transition-colors duration-300-dark rounded-3xl p-6 flex flex-col border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-3xl -mr-12 -mt-12 group-hover:bg-indigo-500/10 transition-colors duration-700" />

            <div className="flex items-center gap-3 mb-6 relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="text-base font-bold text-white tracking-tight">هوية المؤسسة</h3>
                    <p className="text-[10px] text-white/40">البيانات التعريفية والاسم الرسمي</p>
                </div>
            </div>

            <div className="space-y-4 flex-1 relative">
                <div className="relative group/field">
                    <label className="block text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1.5 px-1 opacity-70">اسم الفندق / المؤسسة</label>
                    <div className="relative">
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-bold focus:bg-white/[0.07] focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-white/10"
                            placeholder="مثال: فندق أدورا جراند"
                        />
                    </div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                    <p className="text-[10px] leading-relaxed text-indigo-300/60">
                        سيظهر هذا الاسم في واجهة النزلاء والتقارير المطبوعة والمراسلات الرسمية.
                    </p>
                </div>
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary w-full mt-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all"
            >
                {saving ? (
                    <div className="flex items-center justify-center gap-2">
                        <AdoraLoaderInline size={16} />
                        <span>جاري الحفظ...</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-2">
                        <Save className="w-4 h-4" />
                        <span>حفظ الهوية</span>
                    </div>
                )}
            </button>
        </div>
    );
};

/**
 * 🛠️ System Support & Diagnostics Component
 */
const SystemSupport: React.FC = () => {
    const { isOnline } = useConnectivity();
    const status = isOnline ? 'online' : 'offline';
    const [copied, setCopied] = useState(false);
    const [isSystemSupportCollapsed, setIsSystemSupportCollapsed] = useState(true);


    const handleCopyLog = async () => {
        const { copyDiagnosticReport } = await import('../../services/errorHandlerService');
        const success = await copyDiagnosticReport();
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };


    // Default to closed for cleaner UI
    // State moved to top

    return (
        <div className="rounded-2xl transition-colors duration-300-dark rounded-3xl overflow-hidden border border-white/5 transition-all duration-300">
            {/* Header - Always Visible */}
            <div
                onClick={() => setIsSystemSupportCollapsed(!isSystemSupportCollapsed)}
                className="p-6 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white tracking-tight">الدعم والتشخيص</h3>
                        <p className="text-[10px] text-white/40">أدوات ذكاء المهندس</p>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 ${isSystemSupportCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-4 h-4 text-white/60" />
                </div>
            </div>

            {/* Collapsible Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 ${isSystemSupportCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[500px] opacity-100'}`}>
                <div className="p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />

                    <div className="space-y-3 relative">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                <span className="text-[10px] font-bold text-white/40">الشبكة</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2">
                                <Activity className="w-3 h-3 text-blue-400/50" />
                                <span className="text-[10px] font-bold text-white/40">مستقر</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border flex flex-col gap-2 transition-colors duration-300" style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)' }}>
                            <p className="text-[10px] leading-relaxed text-white/30 text-center">
                                انسخ تقرير التشخيص لإرساله للمهندس مباشرة
                            </p>
                            <button
                                onClick={handleCopyLog}
                                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 ${copied
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                    : 'bg-white/5 text-white hover:bg-white/10 border border-white/5'
                                    }`}
                            >
                                {copied ? <Check className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                                <span>{copied ? 'تم النسخ!' : 'سجل التشخيص'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex justify-center">
                        <span className="text-[9px] text-white/10 font-bold uppercase tracking-[0.3em]">Designed & Developed by Ayman</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export const SettingsManager: React.FC = () => {
    // ✅ Sync with Global Auth Context
    const { branchId: globalBranchId, user } = useAuth();
    
    // ✅ For owners: Get all branches from all managers
    // ✅ For managers: Get branches from their tenant only
    const tenantBranches = useTenantBranches();
    const allBranchesForOwner = useAllBranchesForOwner();
    
    const branches = user?.role === 'owner' ? allBranchesForOwner.branches : tenantBranches.branches;
    const branchesLoading = user?.role === 'owner' ? allBranchesForOwner.loading : tenantBranches.loading;

    // UI State
    const [activeTab, setActiveTab] = useState<'branch' | 'global'>('branch');
    
    // ✅ CRITICAL FIX: Owner should NEVER have a branchId from global context
    // Owner selects branches dynamically from the list, not from globalBranchId
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
        user?.role === 'owner' ? null : (globalBranchId || null)
    );
    
    const [branchFilter, setBranchFilter] = useState<string>('');
    const [managerFilter, setManagerFilter] = useState<string>('');

    // ✅ Dynamic: Get unique managers list (for owner)
    const uniqueManagers = user?.role === 'owner' 
        ? Array.from(new Set(branches.map(b => (b as any).managerName).filter(Boolean)))
        : [];

    // ✅ Dynamic: Filter branches
    const filteredBranches = branches.filter(branch => {
        const matchesSearch = !branchFilter || 
            branch.name?.toLowerCase().includes(branchFilter.toLowerCase()) ||
            (branch as any).code?.toLowerCase().includes(branchFilter.toLowerCase());
        
        const matchesManager = !managerFilter || 
            (user?.role === 'owner' && (branch as any).managerName === managerFilter) ||
            (user?.role !== 'owner');

        return matchesSearch && matchesManager;
    });

    // ✅ Dynamic: Get selected branch
    const activeBranch = selectedBranchId 
        ? branches.find(b => b.id === selectedBranchId)
        : (filteredBranches.length > 0 ? filteredBranches[0] : null);

    // ✅ Dynamic: Auto-select first branch if none selected (for manager only)
    // Owner should manually select a branch
    useEffect(() => {
        if (!selectedBranchId && filteredBranches.length > 0 && user?.role !== 'owner') {
            setSelectedBranchId(filteredBranches[0].id);
        }
    }, [selectedBranchId, filteredBranches.length, user?.role]);

    if (branchesLoading) {
        return (
            <div className="p-8 flex justify-center">
                <AdoraLoader size="md" message="جاري تحميل البيانات..." />
            </div>
        );
    }

    // Branch Validation Logic... (Simplified for brevity as mapped to specific file lines usually)
    // Assuming context handles fallback if branches exist but globalBranchId is invalid.

    if (branches.length === 0) {
        return (
            <div className="p-8 text-center text-white/50">
                لا توجد فروع متاحة. يرجى إنشاء فرع أولاً من لوحة التحكم.
            </div>
        );
    }

    // ✅ Dynamic: Use selected branch ID
    const currentBranchId = activeBranch?.id || '';

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="rounded-2xl transition-colors duration-300 p-6 sticky top-0 z-10" style={{ background: 'var(--theme-bg-secondary)', backdropFilter: 'none' }}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center">
                            <Settings className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">إعدادات النظام</h1>
                            <p className="text-white/60">تخصيص كامل لكل فرع بشكل منفصل</p>
                        </div>
                    </div>

                    {/* Main Tabs - Premium Design */}
                    <div className="flex p-1.5 rounded-2xl border border-white/10" style={{ background: 'var(--theme-bg-tertiary)', backdropFilter: 'none' }}>
                        <button
                            onClick={() => setActiveTab('branch')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'branch'
                                ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25 ring-1 ring-white/20'
                                : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                        >
                            <Building2 className={`w-4 h-4 ${activeTab === 'branch' ? 'animate-pulse' : ''}`} />
                            <span>إعدادات الفرع الحالي</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('global')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'global'
                                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20'
                                : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                        >
                            <Globe className={`w-4 h-4 ${activeTab === 'global' ? 'animate-pulse' : ''}`} />
                            <span>الإعدادات العامة</span>
                        </button>
                    </div>
                </div>

                {/* ✅ Dynamic: Branch Selector with Filters */}
                {activeTab === 'branch' && (
                    <div className="mt-6 space-y-4">
                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Search Filter */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="بحث عن فرع..."
                                    value={branchFilter}
                                    onChange={(e) => setBranchFilter(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-primary-500/50 focus:outline-none transition-all"
                                />
                            </div>

                            {/* Manager Filter (Owner only) */}
                            {user?.role === 'owner' && uniqueManagers.length > 0 && (
                                <select
                                    value={managerFilter}
                                    onChange={(e) => setManagerFilter(e.target.value)}
                                    className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-primary-500/50 focus:outline-none transition-all"
                                >
                                    <option value="">جميع المشتركين</option>
                                    {uniqueManagers.map(manager => (
                                        <option key={manager} value={manager}>{manager}</option>
                                    ))}
                                </select>
                            )}

                            {/* Branch Count */}
                            <div className="flex items-center justify-end px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm">
                                <Building2 className="w-4 h-4 mr-2" />
                                {filteredBranches.length} فرع متاح
                            </div>
                        </div>

                        {/* Branch List */}
                        {filteredBranches.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-64 overflow-y-auto custom-scrollbar">
                                {filteredBranches.map(branch => {
                                    const isSelected = selectedBranchId === branch.id;
                                    return (
                                        <button
                                            key={branch.id}
                                            onClick={() => setSelectedBranchId(branch.id)}
                                            className={`p-4 rounded-xl border transition-all text-right ${
                                                isSelected
                                                    ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/20 border-primary-500/50 shadow-lg shadow-primary-500/10'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-primary-400' : 'bg-white/20'}`} />
                                                {user?.role === 'owner' && (branch as any).managerName && (
                                                    <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded">
                                                        {(branch as any).managerName}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-white mb-1">{branch.name || branch.id}</h3>
                                            {(branch as any).code && (
                                                <p className="text-xs text-white/50">كود: {(branch as any).code}</p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-white/50">
                                لا توجد فروع تطابق الفلاتر المحددة.
                            </div>
                        )}

                        {/* Selected Branch Info */}
                        {activeBranch ? (
                            <div className="px-4 py-3 flex items-center gap-2 text-sm text-primary-400 bg-primary-500/10 rounded-lg border border-primary-500/20">
                                <AlertTriangle className="w-4 h-4" />
                                <span>
                                    أنت تقوم بتعديل إعدادات: <b className="text-white">{activeBranch.name}</b>
                                    {user?.role === 'owner' && (activeBranch as any).managerName && (
                                        <span className="text-white/50 mr-2">(مدير: {(activeBranch as any).managerName})</span>
                                    )}
                                </span>
                            </div>
                        ) : user?.role === 'owner' && filteredBranches.length > 0 ? (
                            <div className="px-4 py-3 flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                <AlertTriangle className="w-4 h-4" />
                                <span>يرجى اختيار فرع من القائمة أعلاه لعرض وتعديل إعداداته</span>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            {/* GLOBAL SETTINGS CONTENT - SIDELINED GRID */}
            {activeTab === 'global' && (
                <div className="animate-fadeIn space-y-6 pb-12">

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                        {/* Sidebar: General Settings (4 cols) */}
                        <div className="lg:col-span-4 space-y-6">
                            <GeneralSettings />
                        </div>

                        {/* Main Stream: Points & Integrations (8 cols) */}
                        <div className="lg:col-span-8 space-y-6">


                            <div className="rounded-2xl transition-colors duration-300-dark rounded-3xl p-8 border border-white/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[100px] rounded-full -mr-32 -mt-32 group-hover:bg-purple-500/10 transition-colors duration-700" />

                                <div className="flex items-center gap-3 mb-8 px-2 relative">
                                    <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center border border-purple-500/20">
                                        <Globe className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">مركز التكاملات الخارجية</h2>
                                        <p className="text-white/40 text-sm">ربط النظام مع المصادر العالمية للمواسم والمناسبات</p>
                                    </div>
                                </div>

                                <CalendarSourcesManager />
                            </div>

                            {/* 🏆 Points & Rewards Configuration (Integrated) */}
                            <div className="rounded-2xl transition-colors duration-300-dark rounded-3xl p-8 border border-white/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 blur-[100px] rounded-full -mr-32 -mt-32 group-hover:bg-yellow-500/10 transition-colors duration-700" />
                                <PointsConfiguration />
                            </div>
                        </div>

                    </div>

                    {/* Support Section - Full Width Bottom */}
                    <SystemSupport />

                    {/* Pro Footer */}
                    <div className="flex items-center justify-between px-6 py-4 bg-white/[0.01] border border-white/5 rounded-2xl">
                        <div className="flex items-center gap-2 text-white/10 text-[9px] font-bold uppercase tracking-widest">
                            <Activity className="w-3 h-3" />
                            Global Core Systems: Operational
                        </div>
                        <div className="text-white/10 text-[9px]">
                            Sync Status: Stable • {new Date().toLocaleTimeString()}
                        </div>
                    </div>

                </div>
            )}

            {/* BRANCH SETTINGS CONTENT */}
            {activeTab === 'branch' && currentBranchId && activeBranch && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-24 animate-fadeIn">
                    {/* Column 1: Core & Identity */}
                    <div className="space-y-6">
                        <BranchSettings 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                            tenantId={(activeBranch as any).tenantId} 
                        />
                        <WorkingHoursSettings 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                            tenantId={(activeBranch as any).tenantId} 
                        />
                        <BranchContactSettings 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                            tenantId={(activeBranch as any).tenantId} 
                        />
                        <LaundryPriceManager 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                            tenantId={(activeBranch as any).tenantId} 
                        />
                    </div>

                    {/* Column 2: Features & Tools */}
                    <div className="space-y-6">
                        <ProductsManager 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                            tenantId={(activeBranch as any).tenantId} 
                        />
                        <QRCodeGenerator 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                            tenantId={(activeBranch as any).tenantId} 
                        />
                        {/* ✅ Smart QR Room Manager - Full control over room QR codes */}
                        <QRRoomManager 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                            tenantId={(activeBranch as any).tenantId} 
                        />
                        <LocationSettingsComponent 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                            tenantId={(activeBranch as any).tenantId} 
                        />
                        <GuestPortalSettings 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                            tenantId={(activeBranch as any).tenantId} 
                        />
                        <QRServicesManager 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                        />
                        <RatingTemplatesManager 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                        />
                        <AnnouncementsManager 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                        />
                        <EmergencyAlertsManager 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                        />
                        {/* ✅ Notification Settings (SMS/Email/WhatsApp) */}
                        <NotificationSettingsManager />
                        <SystemToggles 
                            branchId={currentBranchId} 
                            branchName={activeBranch.name} 
                            tenantId={(activeBranch as any).tenantId} 
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
