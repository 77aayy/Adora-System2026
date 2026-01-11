/**
 * Notification Settings Manager
 * Allows managers to configure SMS, Email, and WhatsApp notification providers
 * 
 * ✅ Complete Flow:
 * 1. Owner enables/disables feature from owner dashboard (إدارة الميزات)
 * 2. Manager configures provider settings (API keys, etc.)
 * 3. Feature works only when BOTH conditions are met
 */

import React, { useState, useEffect } from 'react';
import {
    Mail, MessageSquare, Phone, Settings, Save, ChevronDown,
    AlertTriangle, CheckCircle, Info, Eye, EyeOff, RefreshCw,
    Lock, Unlock, ShieldCheck, ShieldX
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useUX } from '../../context/UXContext';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import {
    NotificationConfig,
    getNotificationConfig,
    saveNotificationConfig
} from '../../services/communicationService';

// SMS Providers
const SMS_PROVIDERS = [
    { id: 'twilio', name: 'Twilio', region: 'Global', logo: '📱' },
    { id: 'messagebird', name: 'MessageBird', region: 'Global', logo: '🐦' },
    { id: 'unifonic', name: 'Unifonic', region: 'MENA', logo: '🌙' },
    { id: 'custom', name: 'Custom API', region: 'Any', logo: '⚙️' }
] as const;

// Email Providers
const EMAIL_PROVIDERS = [
    { id: 'sendgrid', name: 'SendGrid', logo: '📧' },
    { id: 'mailgun', name: 'Mailgun', logo: '📬' },
    { id: 'ses', name: 'Amazon SES', logo: '☁️' },
    { id: 'smtp', name: 'SMTP Server', logo: '📤' },
    { id: 'custom', name: 'Custom API', logo: '⚙️' }
] as const;

export const NotificationSettingsManager: React.FC = () => {
    const { tenantId } = useTenant();
    const { success, error: showError } = useUX();

    // ✅ Check if features are enabled by owner
    const { isEnabled: isSmsEnabledByOwner, loading: smsFeatureLoading } = useFeatureGate('smsNotifications');
    const { isEnabled: isEmailEnabledByOwner, loading: emailFeatureLoading } = useFeatureGate('emailNotifications');
    const { isEnabled: isWhatsAppEnabledByOwner, loading: waFeatureLoading } = useFeatureGate('whatsappIntegration');

    const [config, setConfig] = useState<NotificationConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [expandedSection, setExpandedSection] = useState<'sms' | 'email' | 'whatsapp' | null>(null);

    // Load configuration
    useEffect(() => {
        loadConfig();
    }, [tenantId]);

    const loadConfig = async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const data = await getNotificationConfig(tenantId);
            setConfig(data);
        } catch (err) {
            console.error('Error loading notification config:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (type: 'sms' | 'email' | 'whatsapp') => {
        if (!tenantId || !config) return;
        setSaving(true);
        try {
            await saveNotificationConfig(tenantId, { [type]: config[type] });
            success(`تم حفظ إعدادات ${type === 'sms' ? 'الرسائل النصية' : type === 'email' ? 'البريد الإلكتروني' : 'واتساب'} بنجاح`);
        } catch (err) {
            showError('حدث خطأ أثناء الحفظ');
        } finally {
            setSaving(false);
        }
    };

    const toggleShowSecret = (key: string) => {
        setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-24 bg-white/5 rounded-xl" />
                <div className="h-24 bg-white/5 rounded-xl" />
            </div>
        );
    }

    if (!config) return null;

    // ✅ Helper to render feature status badge
    const FeatureStatusBadge: React.FC<{ enabled: boolean; loading: boolean; label: string }> = ({ enabled, loading: isLoading, label }) => {
        if (isLoading) return <span className="text-xs text-white/40">جاري التحقق...</span>;
        
        return (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                enabled 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
            }`}>
                {enabled ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {enabled ? `${label} مفعّل من المالك` : `${label} معطّل من المالك`}
            </span>
        );
    };

    return (
        <div className="space-y-4">
            {/* Info Banner - Updated with complete flow explanation */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-medium text-blue-400 mb-1">🔄 دورة تفعيل الإشعارات (كاملة)</h4>
                        <p className="text-sm text-white/60 leading-relaxed">
                            لتفعيل إرسال الإشعارات الفعلية، يجب تحقيق <span className="text-white font-medium">شرطين معاً</span>:
                        </p>
                        <div className="mt-2 space-y-1.5">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold">1</span>
                                <span className="text-white/70">تفعيل الميزة من <span className="text-purple-400 font-medium">المالك</span> (إدارة الميزات)</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-[10px] font-bold">2</span>
                                <span className="text-white/70">إعداد مزود الخدمة من <span className="text-teal-400 font-medium">المدير</span> (هنا أدناه)</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-white/40 mt-2">
                            💡 يمكنك إعداد المزود الآن حتى لو لم تكن الميزة مفعلة، وسيعمل تلقائياً عند التفعيل
                        </p>
                    </div>
                </div>
            </div>

            {/* Feature Status Summary */}
            <div className="flex flex-wrap gap-2 p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--theme-text-tertiary)' }}>حالة الميزات من المالك:</span>
                <FeatureStatusBadge enabled={isSmsEnabledByOwner} loading={smsFeatureLoading} label="SMS" />
                <FeatureStatusBadge enabled={isEmailEnabledByOwner} loading={emailFeatureLoading} label="البريد" />
                <FeatureStatusBadge enabled={isWhatsAppEnabledByOwner} loading={waFeatureLoading} label="واتساب" />
            </div>

            {/* SMS Settings */}
            <div className={`solid-modal rounded-xl overflow-hidden relative ${!isSmsEnabledByOwner ? 'ring-1 ring-orange-500/30' : ''}`}
                style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}
            >
                {/* Disabled by Owner Indicator */}
                {!isSmsEnabledByOwner && !smsFeatureLoading && (
                    <div className="absolute top-2 left-2 z-10">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold bg-orange-500/20 text-orange-400">
                            <Lock className="w-3 h-3" />
                            معطّل من المالك
                        </span>
                    </div>
                )}
                <div
                    onClick={() => setExpandedSection(expandedSection === 'sms' ? null : 'sms')}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isSmsEnabledByOwner && config.sms.enabled 
                                ? 'bg-green-500/20' 
                                : 'bg-gray-500/20'
                        }`}>
                            <Phone className={`w-5 h-5 ${
                                isSmsEnabledByOwner && config.sms.enabled 
                                    ? 'text-green-400' 
                                    : 'text-gray-400'
                            }`} />
                        </div>
                        <div>
                            <h3 className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                الرسائل النصية (SMS)
                            </h3>
                            <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                {isSmsEnabledByOwner && config.sms.enabled ? '✅ جاهز للعمل' : config.sms.enabled ? '⏳ بانتظار تفعيل المالك' : '⚪ غير مُعَد'} • {SMS_PROVIDERS.find(p => p.id === config.sms.provider)?.name || 'غير محدد'}
                            </p>
                        </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 transition-transform ${expandedSection === 'sms' ? 'rotate-180' : ''}`}
                        style={{ color: 'var(--theme-text-tertiary)' }}
                    />
                </div>

                {expandedSection === 'sms' && (
                    <div className="p-4 border-t" style={{ borderColor: 'var(--theme-border-primary)' }}>
                        <div className="space-y-4">
                            {/* Enable Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.sms.enabled}
                                    onChange={(e) => setConfig({
                                        ...config,
                                        sms: { ...config.sms, enabled: e.target.checked }
                                    })}
                                    className="w-5 h-5 rounded"
                                />
                                <span style={{ color: 'var(--theme-text-primary)' }}>تفعيل إرسال الرسائل النصية</span>
                            </label>

                            {/* Provider Selection */}
                            <div>
                                <label className="block text-xs mb-2" style={{ color: 'var(--theme-text-tertiary)' }}>
                                    مزود الخدمة
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {SMS_PROVIDERS.map(provider => (
                                        <button
                                            key={provider.id}
                                            onClick={() => setConfig({
                                                ...config,
                                                sms: { ...config.sms, provider: provider.id as any }
                                            })}
                                            className={`p-3 rounded-xl text-center transition-all ${
                                                config.sms.provider === provider.id
                                                    ? 'bg-green-500/20 ring-2 ring-green-500/50'
                                                    : 'bg-white/5 hover:bg-white/10'
                                            }`}
                                        >
                                            <span className="text-2xl">{provider.logo}</span>
                                            <p className="text-xs mt-1 font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                {provider.name}
                                            </p>
                                            <p className="text-[10px]" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                {provider.region}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* API Credentials with detailed explanations */}
                            {config.sms.provider === 'twilio' && (
                                <div className="space-y-4">
                                    {/* Helper info box */}
                                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                        <p className="text-xs text-green-400 font-medium mb-1">📋 كيفية الحصول على البيانات:</p>
                                        <ol className="text-[10px] text-white/60 space-y-0.5 list-decimal list-inside">
                                            <li>سجل في <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer" className="text-green-400 underline">Twilio</a> (مجاني للتجربة)</li>
                                            <li>من Console → ستجد Account SID و Auth Token</li>
                                            <li>اشترِ رقم هاتف من قسم Phone Numbers</li>
                                        </ol>
                                    </div>

                                    <div>
                                        <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                            Account SID <span className="text-red-400">*</span>
                                        </label>
                                        <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                            معرّف حسابك في Twilio، يبدأ بـ AC ويتكون من 34 حرف
                                        </p>
                                        <input
                                            type="text"
                                            value={config.sms.accountSid || ''}
                                            onChange={(e) => setConfig({
                                                ...config,
                                                sms: { ...config.sms, accountSid: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm font-mono"
                                            style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                            Auth Token <span className="text-red-400">*</span>
                                        </label>
                                        <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                            رمز المصادقة السري، يتكون من 32 حرف (لا تشاركه مع أحد!)
                                        </p>
                                        <div className="relative">
                                            <input
                                                type={showSecrets['twilioToken'] ? 'text' : 'password'}
                                                value={config.sms.apiSecret || ''}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    sms: { ...config.sms, apiSecret: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 pr-10 rounded-lg bg-white/5 border text-sm font-mono"
                                                style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => toggleShowSecret('twilioToken')}
                                                className="absolute left-2 top-1/2 -translate-y-1/2"
                                                style={{ color: 'var(--theme-text-tertiary)' }}
                                            >
                                                {showSecrets['twilioToken'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                            رقم المرسل (Sender ID) <span className="text-red-400">*</span>
                                        </label>
                                        <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                            رقم الهاتف الذي ستُرسل منه الرسائل (بالصيغة الدولية مثل +966xxxxxxxxx)
                                        </p>
                                        <input
                                            type="text"
                                            value={config.sms.senderId || ''}
                                            onChange={(e) => setConfig({
                                                ...config,
                                                sms: { ...config.sms, senderId: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm"
                                            style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                            placeholder="+966xxxxxxxxx"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {/* Unifonic Provider Settings */}
                            {config.sms.provider === 'unifonic' && (
                                <div className="space-y-4">
                                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                        <p className="text-xs text-green-400 font-medium mb-1">📋 Unifonic - مزود سعودي للرسائل:</p>
                                        <ol className="text-[10px] text-white/60 space-y-0.5 list-decimal list-inside">
                                            <li>سجل في <a href="https://www.unifonic.com/" target="_blank" rel="noopener noreferrer" className="text-green-400 underline">Unifonic</a></li>
                                            <li>من لوحة التحكم → API Settings</li>
                                            <li>انسخ App SID و Sender ID</li>
                                        </ol>
                                    </div>
                                    <div>
                                        <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                            App SID <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={config.sms.accountSid || ''}
                                            onChange={(e) => setConfig({
                                                ...config,
                                                sms: { ...config.sms, accountSid: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm font-mono"
                                            style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                            placeholder="معرف التطبيق من Unifonic"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                            اسم المرسل (Sender ID) <span className="text-red-400">*</span>
                                        </label>
                                        <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                            الاسم الذي سيظهر للمستلم (يجب أن يكون معتمداً من Unifonic)
                                        </p>
                                        <input
                                            type="text"
                                            value={config.sms.senderId || ''}
                                            onChange={(e) => setConfig({
                                                ...config,
                                                sms: { ...config.sms, senderId: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm"
                                            style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                            placeholder="مثال: ADORA_HOTEL"
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {/* MessageBird Provider Settings */}
                            {config.sms.provider === 'messagebird' && (
                                <div className="space-y-4">
                                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                        <p className="text-xs text-green-400 font-medium mb-1">📋 MessageBird:</p>
                                        <ol className="text-[10px] text-white/60 space-y-0.5 list-decimal list-inside">
                                            <li>سجل في <a href="https://www.messagebird.com/" target="_blank" rel="noopener noreferrer" className="text-green-400 underline">MessageBird</a></li>
                                            <li>من Dashboard → Developers → API access</li>
                                            <li>أنشئ Live API key</li>
                                        </ol>
                                    </div>
                                    <div>
                                        <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                            API Key <span className="text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showSecrets['mbKey'] ? 'text' : 'password'}
                                                value={config.sms.apiKey || ''}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    sms: { ...config.sms, apiKey: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 pr-10 rounded-lg bg-white/5 border text-sm font-mono"
                                                style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                                placeholder="live_xxxxxxxxxxxxxxxx"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => toggleShowSecret('mbKey')}
                                                className="absolute left-2 top-1/2 -translate-y-1/2"
                                                style={{ color: 'var(--theme-text-tertiary)' }}
                                            >
                                                {showSecrets['mbKey'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                            Originator (Sender ID) <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={config.sms.senderId || ''}
                                            onChange={(e) => setConfig({
                                                ...config,
                                                sms: { ...config.sms, senderId: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm"
                                            style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                            placeholder="+966xxxxxxxxx أو ADORA"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Save Button */}
                            <button
                                onClick={() => handleSave('sms')}
                                disabled={saving}
                                className="w-full px-4 py-2.5 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                حفظ إعدادات SMS
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Email Settings */}
            <div className={`solid-modal rounded-xl overflow-hidden relative ${!isEmailEnabledByOwner ? 'ring-1 ring-orange-500/30' : ''}`}
                style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}
            >
                {/* Disabled by Owner Indicator */}
                {!isEmailEnabledByOwner && !emailFeatureLoading && (
                    <div className="absolute top-2 left-2 z-10">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold bg-orange-500/20 text-orange-400">
                            <Lock className="w-3 h-3" />
                            معطّل من المالك
                        </span>
                    </div>
                )}
                <div
                    onClick={() => setExpandedSection(expandedSection === 'email' ? null : 'email')}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isEmailEnabledByOwner && config.email.enabled 
                                ? 'bg-blue-500/20' 
                                : 'bg-gray-500/20'
                        }`}>
                            <Mail className={`w-5 h-5 ${
                                isEmailEnabledByOwner && config.email.enabled 
                                    ? 'text-blue-400' 
                                    : 'text-gray-400'
                            }`} />
                        </div>
                        <div>
                            <h3 className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                البريد الإلكتروني
                            </h3>
                            <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                {isEmailEnabledByOwner && config.email.enabled ? '✅ جاهز للعمل' : config.email.enabled ? '⏳ بانتظار تفعيل المالك' : '⚪ غير مُعَد'} • {EMAIL_PROVIDERS.find(p => p.id === config.email.provider)?.name || 'غير محدد'}
                            </p>
                        </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 transition-transform ${expandedSection === 'email' ? 'rotate-180' : ''}`}
                        style={{ color: 'var(--theme-text-tertiary)' }}
                    />
                </div>

                {expandedSection === 'email' && (
                    <div className="p-4 border-t" style={{ borderColor: 'var(--theme-border-primary)' }}>
                        <div className="space-y-4">
                            {/* Enable Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.email.enabled}
                                    onChange={(e) => setConfig({
                                        ...config,
                                        email: { ...config.email, enabled: e.target.checked }
                                    })}
                                    className="w-5 h-5 rounded"
                                />
                                <span style={{ color: 'var(--theme-text-primary)' }}>تفعيل إرسال البريد الإلكتروني</span>
                            </label>

                            {/* Provider Selection */}
                            <div>
                                <label className="block text-xs mb-2" style={{ color: 'var(--theme-text-tertiary)' }}>
                                    مزود الخدمة
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {EMAIL_PROVIDERS.map(provider => (
                                        <button
                                            key={provider.id}
                                            onClick={() => setConfig({
                                                ...config,
                                                email: { ...config.email, provider: provider.id as any }
                                            })}
                                            className={`p-3 rounded-xl text-center transition-all ${
                                                config.email.provider === provider.id
                                                    ? 'bg-blue-500/20 ring-2 ring-blue-500/50'
                                                    : 'bg-white/5 hover:bg-white/10'
                                            }`}
                                        >
                                            <span className="text-2xl">{provider.logo}</span>
                                            <p className="text-xs mt-1 font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                {provider.name}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* API Credentials for SendGrid - with explanations */}
                            {config.email.provider === 'sendgrid' && (
                                <div className="space-y-4">
                                    {/* Helper info box */}
                                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                        <p className="text-xs text-blue-400 font-medium mb-1">📋 كيفية الحصول على بيانات SendGrid:</p>
                                        <ol className="text-[10px] text-white/60 space-y-0.5 list-decimal list-inside">
                                            <li>سجل في <a href="https://signup.sendgrid.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">SendGrid</a> (100 إيميل/يوم مجاناً)</li>
                                            <li>من Settings → API Keys → Create API Key</li>
                                            <li>اختر "Full Access" أو "Restricted Access" مع Mail Send</li>
                                            <li>احفظ المفتاح فوراً (لن يظهر مرة أخرى!)</li>
                                        </ol>
                                    </div>

                                    <div>
                                        <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                            API Key <span className="text-red-400">*</span>
                                        </label>
                                        <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                            مفتاح API يبدأ بـ SG. ويتكون من حوالي 69 حرف
                                        </p>
                                        <div className="relative">
                                            <input
                                                type={showSecrets['sendgridKey'] ? 'text' : 'password'}
                                                value={config.email.apiKey || ''}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    email: { ...config.email, apiKey: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 pr-10 rounded-lg bg-white/5 border text-sm font-mono"
                                                style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                                placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => toggleShowSecret('sendgridKey')}
                                                className="absolute left-2 top-1/2 -translate-y-1/2"
                                                style={{ color: 'var(--theme-text-tertiary)' }}
                                            >
                                                {showSecrets['sendgridKey'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                                اسم المرسل <span className="text-red-400">*</span>
                                            </label>
                                            <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                الاسم الذي سيظهر للمستلم في صندوق الوارد
                                            </p>
                                            <input
                                                type="text"
                                                value={config.email.fromName || ''}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    email: { ...config.email, fromName: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm"
                                                style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                                placeholder="فندق أدورا"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                                بريد المرسل <span className="text-red-400">*</span>
                                            </label>
                                            <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                يجب أن يكون بريد موثق في SendGrid
                                            </p>
                                            <input
                                                type="email"
                                                value={config.email.fromEmail || ''}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    email: { ...config.email, fromEmail: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm"
                                                style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                                placeholder="noreply@yourhotel.com"
                                                dir="ltr"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SMTP Settings - with detailed explanations */}
                            {config.email.provider === 'smtp' && (
                                <div className="space-y-4">
                                    {/* Helper info box */}
                                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                        <p className="text-xs text-blue-400 font-medium mb-1">📋 إعدادات SMTP الشائعة:</p>
                                        <div className="text-[10px] text-white/60 space-y-1">
                                            <p><strong>Gmail:</strong> smtp.gmail.com:587 (يتطلب App Password)</p>
                                            <p><strong>Outlook:</strong> smtp.office365.com:587</p>
                                            <p><strong>Yahoo:</strong> smtp.mail.yahoo.com:587</p>
                                            <p className="text-yellow-400 mt-1">⚠️ لـ Gmail: فعّل 2FA ثم أنشئ App Password من إعدادات الأمان</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                                SMTP Host <span className="text-red-400">*</span>
                                            </label>
                                            <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                عنوان خادم البريد الصادر
                                            </p>
                                            <input
                                                type="text"
                                                value={config.email.smtpHost || ''}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    email: { ...config.email, smtpHost: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm font-mono"
                                                style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                                placeholder="smtp.gmail.com"
                                                dir="ltr"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                                Port <span className="text-red-400">*</span>
                                            </label>
                                            <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                587 (TLS) أو 465 (SSL) أو 25 (غير مشفر)
                                            </p>
                                            <input
                                                type="number"
                                                value={config.email.smtpPort || 587}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    email: { ...config.email, smtpPort: parseInt(e.target.value) }
                                                })}
                                                className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm font-mono"
                                                style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                                placeholder="587"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                                اسم المستخدم <span className="text-red-400">*</span>
                                            </label>
                                            <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                عادةً عنوان البريد الإلكتروني الكامل
                                            </p>
                                            <input
                                                type="text"
                                                value={config.email.smtpUser || ''}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    email: { ...config.email, smtpUser: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm"
                                                style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                                كلمة المرور <span className="text-red-400">*</span>
                                            </label>
                                            <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                لـ Gmail: استخدم App Password وليس كلمة المرور العادية
                                            </p>
                                            <div className="relative">
                                                <input
                                                    type={showSecrets['smtpPass'] ? 'text' : 'password'}
                                                    value={config.email.smtpPassword || ''}
                                                    onChange={(e) => setConfig({
                                                        ...config,
                                                        email: { ...config.email, smtpPassword: e.target.value }
                                                    })}
                                                    className="w-full px-3 py-2 pr-10 rounded-lg bg-white/5 border text-sm"
                                                    style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                                    placeholder="••••••••••••"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => toggleShowSecret('smtpPass')}
                                                    className="absolute left-2 top-1/2 -translate-y-1/2"
                                                    style={{ color: 'var(--theme-text-tertiary)' }}
                                                >
                                                    {showSecrets['smtpPass'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Sender info for SMTP */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t" style={{ borderColor: 'var(--theme-border-primary)' }}>
                                        <div>
                                            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                                اسم المرسل
                                            </label>
                                            <input
                                                type="text"
                                                value={config.email.fromName || ''}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    email: { ...config.email, fromName: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm"
                                                style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                                placeholder="فندق أدورا"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                                بريد المرسل
                                            </label>
                                            <input
                                                type="email"
                                                value={config.email.fromEmail || ''}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    email: { ...config.email, fromEmail: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm"
                                                style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                                placeholder="info@hotel.com"
                                                dir="ltr"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Save Button */}
                            <button
                                onClick={() => handleSave('email')}
                                disabled={saving}
                                className="w-full px-4 py-2.5 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                حفظ إعدادات البريد
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* WhatsApp Settings */}
            <div className={`solid-modal rounded-xl overflow-hidden relative ${!isWhatsAppEnabledByOwner ? 'ring-1 ring-orange-500/30' : ''}`}
                style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}
            >
                {/* Disabled by Owner Indicator */}
                {!isWhatsAppEnabledByOwner && !waFeatureLoading && (
                    <div className="absolute top-2 left-2 z-10">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold bg-orange-500/20 text-orange-400">
                            <Lock className="w-3 h-3" />
                            معطّل من المالك
                        </span>
                    </div>
                )}
                <div
                    onClick={() => setExpandedSection(expandedSection === 'whatsapp' ? null : 'whatsapp')}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isWhatsAppEnabledByOwner && config.whatsapp.enabled 
                                ? 'bg-emerald-500/20' 
                                : 'bg-gray-500/20'
                        }`}>
                            <MessageSquare className={`w-5 h-5 ${
                                isWhatsAppEnabledByOwner && config.whatsapp.enabled 
                                    ? 'text-emerald-400' 
                                    : 'text-gray-400'
                            }`} />
                        </div>
                        <div>
                            <h3 className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                واتساب بيزنس
                            </h3>
                            <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                {isWhatsAppEnabledByOwner && config.whatsapp.enabled ? '✅ جاهز للعمل' : config.whatsapp.enabled ? '⏳ بانتظار تفعيل المالك' : '⚪ غير مُعَد'}
                            </p>
                        </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 transition-transform ${expandedSection === 'whatsapp' ? 'rotate-180' : ''}`}
                        style={{ color: 'var(--theme-text-tertiary)' }}
                    />
                </div>

                {expandedSection === 'whatsapp' && (
                    <div className="p-4 border-t" style={{ borderColor: 'var(--theme-border-primary)' }}>
                        {/* Detailed info box */}
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
                            <div className="flex items-start gap-3">
                                <MessageSquare className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs text-emerald-400 font-medium mb-2">📋 كيفية إعداد WhatsApp Business API:</p>
                                    <ol className="text-[10px] text-white/60 space-y-1 list-decimal list-inside">
                                        <li>أنشئ حساب <a href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">Meta Business Suite</a></li>
                                        <li>أضف WhatsApp من Apps → Add Product</li>
                                        <li>اربط رقم هاتف WhatsApp Business</li>
                                        <li>من API Setup ستجد Phone Number ID و Access Token</li>
                                    </ol>
                                    <p className="text-[10px] text-amber-400 mt-2">⚠️ ملاحظة: يتطلب موافقة Meta وقد تستغرق العملية بضعة أيام</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Enable Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.whatsapp.enabled}
                                    onChange={(e) => setConfig({
                                        ...config,
                                        whatsapp: { ...config.whatsapp, enabled: e.target.checked }
                                    })}
                                    className="w-5 h-5 rounded"
                                />
                                <span style={{ color: 'var(--theme-text-primary)' }}>تفعيل تكامل واتساب</span>
                            </label>

                            {/* API Credentials with explanations */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                        Phone Number ID <span className="text-red-400">*</span>
                                    </label>
                                    <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                        معرف رقم الهاتف من Meta Business Suite → WhatsApp → API Setup
                                    </p>
                                    <input
                                        type="text"
                                        value={config.whatsapp.phoneNumberId || ''}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            whatsapp: { ...config.whatsapp, phoneNumberId: e.target.value }
                                        })}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm font-mono"
                                        style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                        placeholder="مثال: 123456789012345"
                                        dir="ltr"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                        Access Token <span className="text-red-400">*</span>
                                    </label>
                                    <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                        رمز الوصول الدائم (Permanent Token) - يبدأ بـ EAA
                                    </p>
                                    <div className="relative">
                                        <input
                                            type={showSecrets['waToken'] ? 'text' : 'password'}
                                            value={config.whatsapp.accessToken || ''}
                                            onChange={(e) => setConfig({
                                                ...config,
                                                whatsapp: { ...config.whatsapp, accessToken: e.target.value }
                                            })}
                                            className="w-full px-3 py-2 pr-10 rounded-lg bg-white/5 border text-sm font-mono"
                                            style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                            placeholder="EAAxxxxxxxxxxxxxxxxx..."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => toggleShowSecret('waToken')}
                                            className="absolute left-2 top-1/2 -translate-y-1/2"
                                            style={{ color: 'var(--theme-text-tertiary)' }}
                                        >
                                            {showSecrets['waToken'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Business Account ID (optional) */}
                                <div>
                                    <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                        Business Account ID <span className="text-white/40 text-[10px]">(اختياري)</span>
                                    </label>
                                    <p className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                        معرف حساب الأعمال - مطلوب لبعض الميزات المتقدمة
                                    </p>
                                    <input
                                        type="text"
                                        value={config.whatsapp.businessAccountId || ''}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            whatsapp: { ...config.whatsapp, businessAccountId: e.target.value }
                                        })}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border text-sm font-mono"
                                        style={{ borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                        placeholder="مثال: 987654321098765"
                                        dir="ltr"
                                    />
                                </div>
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={() => handleSave('whatsapp')}
                                disabled={saving}
                                className="w-full px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                حفظ إعدادات واتساب
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationSettingsManager;
