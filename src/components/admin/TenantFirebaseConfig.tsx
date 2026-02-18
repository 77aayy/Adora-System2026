/**
 * Tenant Firebase Configuration Component 🔧
 * Enhanced with step-by-step helper text for each field
 * 
 * Used in:
 * - Add Manager Modal (Owner Dashboard)
 * - Manager Settings Page
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    Database, Key, Globe, FolderOpen, FileJson,
    CheckCircle2, XCircle, Loader2, Shield, ExternalLink,
    Eye, EyeOff, Info, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Server
} from 'lucide-react';
import {
    FirebaseConfig,
    testFirebaseConnection
} from '../../services/firebase';

// ============================================================
// TYPES
// ============================================================

interface ExtendedFirebaseConfig extends FirebaseConfig {
    serviceAccountJson?: string; // Service Account Key (JSON)
}

interface TenantFirebaseConfigProps {
    config: ExtendedFirebaseConfig;
    onChange: (config: ExtendedFirebaseConfig) => void;
    disabled?: boolean;
    compact?: boolean; // Smaller version for modals
    showTestButton?: boolean;
    showServiceAccount?: boolean; // Show Service Account JSON field
    onTestResult?: (success: boolean) => void;
    onDeployReady?: (serviceAccountJson: string) => void; // Called when deploy data is ready
}

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

// ============================================================
// HELPER TEXT CONFIGURATION - الشروحات التوضيحية
// ============================================================

const HELPER_TEXTS = {
    apiKey: {
        label: 'API Key',
        emoji: '🔑',
        instruction: 'ادخل على Firebase Console > Project Settings > General > هتلاقيها تحت في الـ Web App',
        linkText: 'افتح Firebase Console',
        linkUrl: 'https://console.firebase.google.com/project/_/settings/general'
    },
    projectId: {
        label: 'Project ID',
        emoji: '📁',
        instruction: 'موجود في نفس الصفحة Project Settings تحت اسم Project ID',
        linkText: null,
        linkUrl: null
    },
    appId: {
        label: 'App ID',
        emoji: '📲',
        instruction: 'موجود في أسفل صفحة Project Settings في بيانات الـ Web App',
        linkText: null,
        linkUrl: null
    },
    authDomain: {
        label: 'Auth Domain',
        emoji: '🌐',
        instruction: 'يُملأ تلقائياً من الـ Project ID (اختياري)',
        linkText: null,
        linkUrl: null
    },
    storageBucket: {
        label: 'Storage Bucket',
        emoji: '📦',
        instruction: 'يُملأ تلقائياً من الـ Project ID (اختياري)',
        linkText: null,
        linkUrl: null
    },
    serviceAccountJson: {
        label: 'Service Account JSON',
        emoji: '🔐',
        instruction: 'ادخل على Project Settings > Service Accounts > دوس على Generate New Private Key > هيتحمل ملف، افتحه بـ Notepad وخد النص اللي جواه كله كوبي وحطه هنا',
        linkText: 'افتح Service Accounts',
        linkUrl: 'https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk',
        warning: '⚠️ هام: لن يتم حفظ هذا المفتاح - سيُستخدم مرة واحدة فقط لإعداد الـ Rules والـ Indexes ثم يُحذف فوراً للأمان'
    }
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const TenantFirebaseConfig: React.FC<TenantFirebaseConfigProps> = ({
    config,
    onChange,
    disabled = false,
    compact = false,
    showTestButton = true,
    showServiceAccount = true,
    onTestResult,
    onDeployReady
}) => {
    const [showApiKey, setShowApiKey] = useState(false);
    const [showServiceAccountJson, setShowServiceAccountJson] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
    const [connectionMessage, setConnectionMessage] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const [serviceAccountValid, setServiceAccountValid] = useState<boolean | null>(null);
    const [pasteTextareaValue, setPasteTextareaValue] = useState(''); // ✅ State للـ textarea
    const extractTimeoutRef = useRef<NodeJS.Timeout | null>(null); // ✅ Ref لتخزين timeout

    // ✅ Cleanup timeout عند unmount
    useEffect(() => {
        return () => {
            if (extractTimeoutRef.current) {
                clearTimeout(extractTimeoutRef.current);
            }
        };
    }, []);

    // Auto-fill auth domain and storage bucket when project ID changes
    useEffect(() => {
        if (config.projectId) {
            const updates: Partial<ExtendedFirebaseConfig> = {};
            
            if (!config.authDomain) {
                updates.authDomain = `${config.projectId}.firebaseapp.com`;
            }
            if (!config.storageBucket) {
                updates.storageBucket = `${config.projectId}.appspot.com`;
            }
            
            if (Object.keys(updates).length > 0) {
                onChange({ ...config, ...updates });
            }
        }
    }, [config.projectId]);

    // Validate Service Account JSON
    useEffect(() => {
        if (config.serviceAccountJson) {
            try {
                const parsed = JSON.parse(config.serviceAccountJson);
                // Check for required fields in Service Account
                if (parsed.type === 'service_account' && parsed.project_id && parsed.private_key) {
                    setServiceAccountValid(true);
                    // Auto-fill project ID from service account if empty
                    if (!config.projectId && parsed.project_id) {
                        onChange({ ...config, projectId: parsed.project_id });
                    }
                } else {
                    setServiceAccountValid(false);
                }
            } catch {
                setServiceAccountValid(false);
            }
        } else {
            setServiceAccountValid(null);
        }
    }, [config.serviceAccountJson]);

    const handleInputChange = (field: keyof ExtendedFirebaseConfig, value: string) => {
        onChange({ ...config, [field]: value.trim() });
        if (connectionStatus !== 'idle') {
            setConnectionStatus('idle');
            setConnectionMessage('');
        }
    };

    const handleServiceAccountChange = (value: string) => {
        onChange({ ...config, serviceAccountJson: value });
    };

    const handleTestConnection = async () => {
        if (!config.apiKey || !config.projectId || !config.authDomain) {
            setConnectionStatus('error');
            setConnectionMessage('❌ يرجى ملء الحقول المطلوبة (API Key, Project ID)');
            onTestResult?.(false);
            return;
        }

        setConnectionStatus('testing');
        setConnectionMessage('🔄 جاري اختبار الاتصال...');

        const result = await testFirebaseConnection(config);

        if (result.success) {
            setConnectionStatus('success');
            setConnectionMessage(result.message);
            onTestResult?.(true);
            
            // If service account is valid, notify parent for deployment
            if (serviceAccountValid && config.serviceAccountJson && onDeployReady) {
                onDeployReady(config.serviceAccountJson);
            }
        } else {
            setConnectionStatus('error');
            setConnectionMessage(result.message);
            onTestResult?.(false);
        }
    };

    const hasConfig = Boolean(config.apiKey || config.projectId);
    const hasServiceAccount = Boolean(config.serviceAccountJson && serviceAccountValid);

    // Helper component for input fields with instructions
    const InputWithHelper: React.FC<{
        fieldKey: keyof typeof HELPER_TEXTS;
        type?: 'text' | 'password';
        value: string;
        onChange: (value: string) => void;
        showPassword?: boolean;
        onTogglePassword?: () => void;
        isTextarea?: boolean;
        rows?: number;
        validationStatus?: boolean | null;
        icon: React.ReactNode;
    }> = ({ fieldKey, type = 'text', value, onChange, showPassword, onTogglePassword, isTextarea, rows = 6, validationStatus, icon }) => {
        const helper = HELPER_TEXTS[fieldKey];
        
        return (
            <div className="space-y-2">
                {/* Label with Icon */}
                <label className="flex items-center gap-2 text-sm font-medium text-white">
                    {icon}
                    <span>{helper.emoji} {helper.label}</span>
                    {validationStatus === true && (
                        <CheckCircle2 className="w-4 h-4 text-green-400 mr-auto" />
                    )}
                    {validationStatus === false && (
                        <XCircle className="w-4 h-4 text-red-400 mr-auto" />
                    )}
                </label>
                
                {/* Helper Instruction Box */}
                <div className="p-2.5 rounded-lg bg-gradient-to-r from-blue-500/10 to-teal-500/10 border border-blue-500/20">
                    <p className="text-[11px] text-white/70 leading-relaxed">
                        📍 <strong className="text-teal-400">الخطوات:</strong> {helper.instruction}
                    </p>
                    {helper.linkUrl && (
                        <a
                            href={helper.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-teal-400 hover:text-teal-300 mt-1.5 underline"
                        >
                            <ExternalLink className="w-3 h-3" />
                            {helper.linkText}
                        </a>
                    )}
                    {(helper as any).warning && (
                        <p className="text-[10px] text-amber-400 mt-2 flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            {(helper as any).warning}
                        </p>
                    )}
                </div>
                
                {/* Input Field */}
                {isTextarea ? (
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={disabled}
                        placeholder='{"type": "service_account", "project_id": "...", ...}'
                        rows={rows}
                        className={`w-full px-3 py-3 rounded-xl text-xs font-mono bg-white/5 border text-white placeholder-white/30 focus:outline-none focus:border-teal-400 disabled:opacity-50 resize-none ${
                            validationStatus === true ? 'border-green-500/50' : 
                            validationStatus === false ? 'border-red-500/50' : 
                            'border-white/10'
                        }`}
                        dir="ltr"
                    />
                ) : (
                    <div className="relative">
                        <input
                            type={type === 'password' && !showPassword ? 'password' : 'text'}
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            disabled={disabled}
                            placeholder={fieldKey === 'apiKey' ? 'AIzaSy...' : fieldKey === 'projectId' ? 'my-hotel-project' : fieldKey === 'appId' ? '1:123456789:web:abc123' : ''}
                            className="w-full px-3 py-3 pr-10 rounded-xl text-sm font-mono bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-teal-400 disabled:opacity-50"
                            dir="ltr"
                        />
                        {type === 'password' && (
                            <button
                                type="button"
                                onClick={onTogglePassword}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-3">
            {/* Header with expand/collapse */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 rounded-xl transition-all hover:scale-[1.01]"
                style={{
                    background: hasConfig 
                        ? hasServiceAccount 
                            ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(20, 184, 166, 0.15) 100%)'
                            : 'rgba(34, 197, 94, 0.1)' 
                        : 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                    border: hasConfig 
                        ? hasServiceAccount
                            ? '1px solid rgba(34, 197, 94, 0.4)'
                            : '1px solid rgba(34, 197, 94, 0.3)' 
                        : '1px solid rgba(59, 130, 246, 0.3)'
                }}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        hasConfig ? 'bg-green-500/20' : 'bg-blue-500/20'
                    }`}>
                        <Database className={`w-5 h-5 ${hasConfig ? 'text-green-400' : 'text-blue-400'}`} />
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-white">
                            🔥 ربط قاعدة بيانات Firebase خاصة
                        </p>
                        <p className="text-[11px] text-white/60 mt-0.5">
                            {hasConfig 
                                ? hasServiceAccount
                                    ? `✅ مُعد بالكامل - ${config.projectId}`
                                    : `⚠️ مُعد جزئياً - ${config.projectId} (بدون Service Account)`
                                : '(اختياري) لفصل بيانات العميل عن النظام الرئيسي'}
                        </p>
                    </div>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isExpanded ? 'bg-white/10' : 'bg-white/5'
                }`}>
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-white/60" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-white/60" />
                    )}
                </div>
            </button>

            {/* Expandable Content */}
            {isExpanded && (
                <div className="space-y-5 p-4 rounded-xl bg-white/5 border border-white/10">
                    {/* ✨ Smart Paste Zone - اللصق الذكي */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border-2 border-dashed border-amber-500/40">
                        <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                <FileJson className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white flex items-center gap-2">
                                    ⚡ اللصق الذكي - أسرع طريقة!
                                </p>
                                <p className="text-[11px] text-white/60">
                                    الصق كود Firebase Config من Firebase Console وسيتم ملء جميع الحقول تلقائياً
                                </p>
                            </div>
                        </div>
                        <textarea
                            placeholder={'الصق هنا كود firebaseConfig الكامل من Firebase Console...\n\nمثال:\nconst firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "...",\n  projectId: "...",\n  ...\n};'}
                            className="w-full p-3 rounded-xl bg-black/30 border border-amber-500/30 text-white placeholder-white/30 text-xs font-mono resize-none h-24 focus:outline-none focus:border-amber-400"
                            dir="ltr"
                            value={pasteTextareaValue}
                            onChange={(e) => {
                                const text = e.target.value;
                                // ✅ السماح بالكتابة العادية
                                setPasteTextareaValue(text);
                                
                                // ✅ إلغاء أي timeout سابق
                                if (extractTimeoutRef.current) {
                                    clearTimeout(extractTimeoutRef.current);
                                }
                                
                                // ✅ استخراج القيم من النص بعد توقف المستخدم عن الكتابة (debounce)
                                extractTimeoutRef.current = setTimeout(() => {
                                    const apiKeyMatch = text.match(/apiKey:\s*["']([^"']+)["']/);
                                    const authDomainMatch = text.match(/authDomain:\s*["']([^"']+)["']/);
                                    const projectIdMatch = text.match(/projectId:\s*["']([^"']+)["']/);
                                    const storageBucketMatch = text.match(/storageBucket:\s*["']([^"']+)["']/);
                                    const messagingSenderIdMatch = text.match(/messagingSenderId:\s*["']([^"']+)["']/);
                                    const appIdMatch = text.match(/appId:\s*["']([^"']+)["']/);
                                    
                                    // التحقق من وجود قيم Firebase صالحة
                                    if (apiKeyMatch || projectIdMatch) {
                                        const newConfig: ExtendedFirebaseConfig = {
                                            ...config,
                                            apiKey: apiKeyMatch?.[1] || config.apiKey,
                                            authDomain: authDomainMatch?.[1] || config.authDomain,
                                            projectId: projectIdMatch?.[1] || config.projectId,
                                            storageBucket: storageBucketMatch?.[1] || config.storageBucket,
                                            messagingSenderId: messagingSenderIdMatch?.[1] || config.messagingSenderId,
                                            appId: appIdMatch?.[1] || config.appId,
                                        };
                                        
                                        // Auto-fill auth domain and storage if not present
                                        if (!newConfig.authDomain && newConfig.projectId) {
                                            newConfig.authDomain = `${newConfig.projectId}.firebaseapp.com`;
                                        }
                                        if (!newConfig.storageBucket && newConfig.projectId) {
                                            newConfig.storageBucket = `${newConfig.projectId}.appspot.com`;
                                        }
                                        
                                        onChange(newConfig);
                                        setConnectionStatus('idle');
                                        setConnectionMessage('');
                                        
                                        // عرض رسالة نجاح
                                        const extractedCount = [apiKeyMatch, projectIdMatch, appIdMatch, authDomainMatch, storageBucketMatch, messagingSenderIdMatch].filter(Boolean).length;
                                        setPasteTextareaValue(`✅ تم استخراج ${extractedCount} حقول بنجاح!\n\nProject: ${newConfig.projectId || 'N/A'}`);
                                        
                                        // مسح الـ textarea بعد ثانيتين
                                        setTimeout(() => {
                                            setPasteTextareaValue('');
                                        }, 2000);
                                    }
                                }, 300); // ✅ انتظار 300ms بعد توقف المستخدم عن الكتابة
                            }}
                        />
                        <p className="text-[10px] text-amber-400/70 mt-2 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            💡 فقط الصق الكود هنا وسيتم ملء جميع الحقول أدناه تلقائياً!
                        </p>
                    </div>
                    
                    {/* Info Banner */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm text-white font-medium mb-1">
                                    🎯 ما فائدة هذا القسم؟
                                </p>
                                <p className="text-[11px] text-white/60 leading-relaxed">
                                    اتركها فارغة لاستخدام قاعدة البيانات الرئيسية، أو أدخل بيانات مشروع Firebase منفصل لعزل بيانات هذا العميل تماماً (SaaS Isolation).
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 1: API Keys */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                            <Key className="w-4 h-4 text-amber-400" />
                            <h4 className="text-sm font-bold text-white">
                                1️⃣ بيانات الربط الأساسية (API Keys)
                            </h4>
                        </div>

                        {/* API Key */}
                        <InputWithHelper
                            fieldKey="apiKey"
                            type="password"
                            value={config.apiKey}
                            onChange={(v) => handleInputChange('apiKey', v)}
                            showPassword={showApiKey}
                            onTogglePassword={() => setShowApiKey(!showApiKey)}
                            icon={<Key className="w-4 h-4 text-amber-400" />}
                        />

                        {/* Project ID */}
                        <InputWithHelper
                            fieldKey="projectId"
                            value={config.projectId}
                            onChange={(v) => handleInputChange('projectId', v)}
                            icon={<Database className="w-4 h-4 text-teal-400" />}
                        />

                        {/* App ID */}
                        <InputWithHelper
                            fieldKey="appId"
                            value={config.appId || ''}
                            onChange={(v) => handleInputChange('appId', v)}
                            icon={<Server className="w-4 h-4 text-purple-400" />}
                        />

                        {/* Auth Domain & Storage - Grid (Collapsible/Auto-filled) */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="flex items-center gap-2 text-[11px] font-medium text-white/60 mb-1.5">
                                    <Globe className="w-3 h-3 text-purple-400" />
                                    Auth Domain (تلقائي)
                                </label>
                                <input
                                    type="text"
                                    value={config.authDomain}
                                    onChange={(e) => handleInputChange('authDomain', e.target.value)}
                                    disabled={disabled}
                                    placeholder="app.firebaseapp.com"
                                    className="w-full px-3 py-2.5 rounded-xl text-[11px] font-mono bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-teal-400 disabled:opacity-50"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[11px] font-medium text-white/60 mb-1.5">
                                    <FolderOpen className="w-3 h-3 text-green-400" />
                                    Storage Bucket (تلقائي)
                                </label>
                                <input
                                    type="text"
                                    value={config.storageBucket}
                                    onChange={(e) => handleInputChange('storageBucket', e.target.value)}
                                    disabled={disabled}
                                    placeholder="app.appspot.com"
                                    className="w-full px-3 py-2.5 rounded-xl text-[11px] font-mono bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-teal-400 disabled:opacity-50"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Service Account (for automated deployment) */}
                    {showServiceAccount && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                                <Shield className="w-4 h-4 text-red-400" />
                                <h4 className="text-sm font-bold text-white">
                                    2️⃣ مفتاح التحكم (Service Account)
                                </h4>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 mr-auto">
                                    اختياري للإعداد التلقائي
                                </span>
                            </div>

                            <InputWithHelper
                                fieldKey="serviceAccountJson"
                                isTextarea
                                rows={8}
                                value={config.serviceAccountJson || ''}
                                onChange={handleServiceAccountChange}
                                validationStatus={serviceAccountValid}
                                icon={<FileJson className="w-4 h-4 text-red-400" />}
                            />
                            
                            {/* Service Account Validation Status */}
                            {serviceAccountValid === true && (
                                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    <span className="text-[11px] text-green-400">
                                        ✅ Service Account صالح - سيُستخدم لنشر الـ Rules والـ Indexes تلقائياً
                                    </span>
                                </div>
                            )}
                            {serviceAccountValid === false && (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                                    <XCircle className="w-4 h-4 text-red-400" />
                                    <span className="text-[11px] text-red-400">
                                        ❌ Service Account غير صالح - تأكد من نسخ محتوى الملف كاملاً
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Test Connection */}
                    {showTestButton && (
                        <div className="space-y-3 pt-3 border-t border-white/10">
                            <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={connectionStatus === 'testing' || !config.apiKey || !config.projectId || disabled}
                                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white shadow-lg shadow-teal-500/20"
                            >
                                {connectionStatus === 'testing' ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        جاري اختبار الاتصال...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4" />
                                        🔗 اختبار الاتصال بـ Firebase
                                    </>
                                )}
                            </button>

                            {/* Connection Status */}
                            {connectionMessage && (
                                <div className={`p-3 rounded-xl flex items-center gap-3 ${
                                    connectionStatus === 'success'
                                        ? 'bg-green-500/15 border border-green-500/40'
                                        : connectionStatus === 'error'
                                            ? 'bg-red-500/15 border border-red-500/40'
                                            : 'bg-blue-500/15 border border-blue-500/40'
                                }`}>
                                    {connectionStatus === 'testing' && (
                                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />
                                    )}
                                    {connectionStatus === 'success' && (
                                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                                    )}
                                    {connectionStatus === 'error' && (
                                        <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                                    )}
                                    <span className={`text-sm font-medium ${
                                        connectionStatus === 'success' ? 'text-green-400' :
                                        connectionStatus === 'error' ? 'text-red-400' :
                                        'text-blue-400'
                                    }`}>
                                        {connectionMessage}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TenantFirebaseConfig;
