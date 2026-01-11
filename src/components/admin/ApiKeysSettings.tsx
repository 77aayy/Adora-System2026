/**
 * API Keys Settings Component
 * Allows Owner to manage dynamic API keys from dashboard
 * Phase 2: Dynamic Keys & Owner Control
 */

import React, { useState, useEffect } from 'react';
import {
    Key, Shield, Bell, Image, CheckCircle, XCircle,
    AlertTriangle, Save, RefreshCw, Eye, EyeOff, Copy, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import {
    getSystemConfigs,
    saveSystemConfigs,
    validateVapidKey,
    validateImgbbKey,
    SystemConfigs,
    KeyValidationResult
} from '../../services/systemConfigsService';

// ============================================================
// TYPES
// ============================================================

interface KeyFieldProps {
    label: string;
    description: string;
    value: string;
    onChange: (value: string) => void;
    onValidate: () => Promise<void>;
    validationResult: KeyValidationResult | null;
    isValidating: boolean;
    placeholder: string;
    icon: React.ReactNode;
    isSecret?: boolean;
}

// ============================================================
// KEY FIELD COMPONENT
// ============================================================

const KeyField: React.FC<KeyFieldProps> = ({
    label,
    description,
    value,
    onChange,
    onValidate,
    validationResult,
    isValidating,
    placeholder,
    icon,
    isSecret = true
}) => {
    const [showValue, setShowValue] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="font-medium text-white">{label}</span>
                {validationResult && (
                    <span className={`mr-auto text-xs px-2 py-0.5 rounded-full ${
                        validationResult.isValid 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                    }`}>
                        {validationResult.isValid ? '✓ صالح' : '✗ غير صالح'}
                    </span>
                )}
            </div>
            
            <p className="text-xs text-white/60 mb-3 leading-relaxed">{description}</p>
            
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        type={showValue && !isSecret ? 'text' : 'password'}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30"
                        dir="ltr"
                    />
                    {isSecret && (
                        <button
                            type="button"
                            onClick={() => setShowValue(!showValue)}
                            className="absolute left-10 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/70"
                        >
                            {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/70"
                        title="نسخ"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
                
                <button
                    type="button"
                    onClick={onValidate}
                    disabled={!value || isValidating}
                    className="px-3 py-2 rounded-lg bg-teal-600/20 text-teal-400 hover:bg-teal-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm"
                >
                    {isValidating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : validationResult?.isValid ? (
                        <CheckCircle className="w-4 h-4" />
                    ) : (
                        <Shield className="w-4 h-4" />
                    )}
                    فحص
                </button>
            </div>

            {validationResult && !validationResult.isValid && (
                <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {validationResult.message}
                </p>
            )}
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ApiKeysSettings: React.FC = () => {
    const { user } = useAuth();
    const { success, error } = useUX();

    // State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [configs, setConfigs] = useState<Partial<SystemConfigs>>({
        vapidKey: '',
        imgbbApiKey: '',
        firebase: {
            apiKey: '',
            authDomain: '',
            projectId: '',
            storageBucket: '',
            messagingSenderId: '',
            appId: ''
        }
    });

    // Validation states
    const [vapidValidation, setVapidValidation] = useState<KeyValidationResult | null>(null);
    const [imgbbValidation, setImgbbValidation] = useState<KeyValidationResult | null>(null);
    const [isValidatingVapid, setIsValidatingVapid] = useState(false);
    const [isValidatingImgbb, setIsValidatingImgbb] = useState(false);

    // Load existing configs
    useEffect(() => {
        const loadConfigs = async () => {
            try {
                const existingConfigs = await getSystemConfigs();
                if (existingConfigs) {
                    setConfigs(existingConfigs);
                }
            } catch (err) {
                console.error('Error loading configs:', err);
            } finally {
                setLoading(false);
            }
        };

        loadConfigs();
    }, []);

    // Validation handlers
    const handleValidateVapid = async () => {
        setIsValidatingVapid(true);
        try {
            const result = await validateVapidKey(configs.vapidKey || '');
            setVapidValidation(result);
            if (result.isValid) {
                success('مفتاح VAPID صالح ✓');
            }
        } catch (err) {
            setVapidValidation({ isValid: false, message: 'فشل في التحقق' });
        } finally {
            setIsValidatingVapid(false);
        }
    };

    const handleValidateImgbb = async () => {
        setIsValidatingImgbb(true);
        try {
            const result = await validateImgbbKey(configs.imgbbApiKey || '');
            setImgbbValidation(result);
            if (result.isValid) {
                success('مفتاح ImgBB صالح ✓');
            }
        } catch (err) {
            setImgbbValidation({ isValid: false, message: 'فشل في التحقق' });
        } finally {
            setIsValidatingImgbb(false);
        }
    };

    // Save handler
    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await saveSystemConfigs(configs, user?.id || '');
            if (result.success) {
                success(result.message);
            } else {
                error(result.message);
            }
        } catch (err) {
            error('حدث خطأ أثناء الحفظ');
        } finally {
            setSaving(false);
        }
    };

    // Update field handler
    const updateField = (field: string, value: string) => {
        setConfigs(prev => ({
            ...prev,
            [field]: value
        }));
        // Clear validation when value changes
        if (field === 'vapidKey') setVapidValidation(null);
        if (field === 'imgbbApiKey') setImgbbValidation(null);
    };

    const updateFirebaseField = (field: string, value: string) => {
        setConfigs(prev => ({
            ...prev,
            firebase: {
                ...prev.firebase,
                [field]: value
            } as SystemConfigs['firebase']
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                        <Key className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">إعدادات المفاتيح والخدمات</h2>
                        <p className="text-sm text-white/60">إدارة مفاتيح API للخدمات المختلفة</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium hover:from-teal-400 hover:to-teal-500 disabled:opacity-50 flex items-center gap-2"
                >
                    {saving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Save className="w-5 h-5" />
                    )}
                    حفظ الإعدادات
                </button>
            </div>

            {/* Last Updated Info */}
            {configs.lastUpdated && (
                <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-sm text-teal-300 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    آخر تحديث: {new Date(configs.lastUpdated).toLocaleString('ar-EG')}
                </div>
            )}

            {/* Push Notifications Section */}
            <div className="p-5 rounded-2xl bg-slate-800/50 border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                    <Bell className="w-5 h-5 text-blue-400" />
                    <h3 className="font-bold text-white">إشعارات الدفع (FCM)</h3>
                </div>
                
                <KeyField
                    label="VAPID Key"
                    description="مفتاح التنبيهات من Firebase Console → Project Settings → Cloud Messaging → Web Push certificates"
                    value={configs.vapidKey || ''}
                    onChange={(v) => updateField('vapidKey', v)}
                    onValidate={handleValidateVapid}
                    validationResult={vapidValidation}
                    isValidating={isValidatingVapid}
                    placeholder="BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ="
                    icon={<Shield className="w-4 h-4 text-blue-400" />}
                />
            </div>

            {/* Image Upload Section */}
            <div className="p-5 rounded-2xl bg-slate-800/50 border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                    <Image className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-white">رفع الصور (ImgBB)</h3>
                </div>
                
                <KeyField
                    label="ImgBB API Key"
                    description="من موقع api.imgbb.com → اعمل حساب → API → Generate Key → اختار Permanent (مش Trial)"
                    value={configs.imgbbApiKey || ''}
                    onChange={(v) => updateField('imgbbApiKey', v)}
                    onValidate={handleValidateImgbb}
                    validationResult={imgbbValidation}
                    isValidating={isValidatingImgbb}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxx"
                    icon={<Key className="w-4 h-4 text-purple-400" />}
                />

                <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>
                        <strong>تنبيه:</strong> استخدم API Key من نوع <strong>"Permanent"</strong> وليس "Trial". 
                        المفتاح التجريبي يخلي الصور تتمسح بعد 30 يوم.
                    </p>
                </div>
            </div>

            {/* Firebase Config Section */}
            <div className="p-5 rounded-2xl bg-slate-800/50 border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-5 h-5 text-orange-400" />
                    <h3 className="font-bold text-white">إعدادات Firebase</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                        للمالك فقط
                    </span>
                </div>
                
                <p className="text-xs text-white/60 mb-4">
                    هذه الإعدادات تأتي من Firebase Console → Project Settings → General → Your apps → Web app
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* API Key */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/80">API Key</label>
                        <input
                            type="password"
                            value={configs.firebase?.apiKey || ''}
                            onChange={(e) => updateFirebaseField('apiKey', e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-teal-500/50"
                            dir="ltr"
                        />
                    </div>

                    {/* Auth Domain */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/80">Auth Domain</label>
                        <input
                            type="text"
                            value={configs.firebase?.authDomain || ''}
                            onChange={(e) => updateFirebaseField('authDomain', e.target.value)}
                            placeholder="project-id.firebaseapp.com"
                            className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-teal-500/50"
                            dir="ltr"
                        />
                    </div>

                    {/* Project ID */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/80">Project ID</label>
                        <input
                            type="text"
                            value={configs.firebase?.projectId || ''}
                            onChange={(e) => updateFirebaseField('projectId', e.target.value)}
                            placeholder="my-project-id"
                            className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-teal-500/50"
                            dir="ltr"
                        />
                    </div>

                    {/* Storage Bucket */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/80">Storage Bucket</label>
                        <input
                            type="text"
                            value={configs.firebase?.storageBucket || ''}
                            onChange={(e) => updateFirebaseField('storageBucket', e.target.value)}
                            placeholder="project-id.appspot.com"
                            className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-teal-500/50"
                            dir="ltr"
                        />
                    </div>

                    {/* Messaging Sender ID */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/80">Messaging Sender ID</label>
                        <input
                            type="text"
                            value={configs.firebase?.messagingSenderId || ''}
                            onChange={(e) => updateFirebaseField('messagingSenderId', e.target.value)}
                            placeholder="123456789012"
                            className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-teal-500/50"
                            dir="ltr"
                        />
                    </div>

                    {/* App ID */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/80">App ID</label>
                        <input
                            type="text"
                            value={configs.firebase?.appId || ''}
                            onChange={(e) => updateFirebaseField('appId', e.target.value)}
                            placeholder="1:123456789:web:abc123def456"
                            className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-teal-500/50"
                            dir="ltr"
                        />
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300">
                <p className="flex items-start gap-2">
                    <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span>
                        <strong>ملاحظة أمنية:</strong> المفاتيح يتم تخزينها بشكل آمن في Firestore. 
                        عند حفظ التغييرات، سيتم تطبيقها على جميع المستخدمين في المرة القادمة يدخلوا السيستم.
                    </span>
                </p>
            </div>
        </div>
    );
};

export default ApiKeysSettings;
