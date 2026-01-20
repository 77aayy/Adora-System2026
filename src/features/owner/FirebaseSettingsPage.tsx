/**
 * Firebase Settings Page 🔧
 * Allows Owner to configure Firebase credentials for their tenant
 * 
 * Features:
 * - Dynamic Firebase configuration
 * - Test Connection with visual feedback
 * - Auto-seeding for new databases
 * - Security rules guidance
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import {
    Database, Key, Globe, FolderOpen, Send, Shield,
    CheckCircle2, XCircle, Loader2, AlertTriangle,
    Eye, EyeOff, Info, ExternalLink, RefreshCw, Save,
    Trash2, Download, Copy, Check, Server, Zap, FileText
} from 'lucide-react';
import {
    FirebaseConfig,
    testFirebaseConnection,
    saveFirebaseConfig,
    clearFirebaseConfig,
    getCurrentConfig,
    isFirebaseConfigured,
    hasTenantConfig,
    getFullConfig
} from '../../services/firebase';
import { seedTenantDatabase, checkMissingCollections } from '../../services/tenantSeedingService';
import { getDatabaseHealthReport, DatabaseHealthReport } from '../../services/dataDoctorService';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';

// ============================================================
// TYPES
// ============================================================

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

// ============================================================
// FIRESTORE RULES TEMPLATE
// ============================================================

const FIRESTORE_RULES_TEMPLATE = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================================
    // 🔐 Adora Hotel Management System Rules
    // V4 Simplified - Complete Version
    // ============================================
    
    // 🏢 Tenant data - accessible by authenticated users
    match /tenants/{tenantId}/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // 🔑 Global codes - readable by all (for PIN login)
    match /globalCodes/{codeId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // 👤 Users collection
    // ✅ V5 FIX: Allow owner/admin to manage all users
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;  // Allows owner to delete/modify managers
    }
    
    // 📋 Requests collection
    match /requests/{requestId} {
      allow read, write: if request.auth != null;
    }
    
    // 🏥 Health check
    match /health_check/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // ⚙️ System settings (CRITICAL for subscription price!)
    match /system/{settingId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // ⚙️ System settings (alternate path)
    match /systemSettings/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // ⚙️ System configs
    match /system_configs/{configId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // 👔 Managers collection (CRITICAL!)
    match /managers/{managerId} {
      allow read, write: if request.auth != null;
    }
    
    // 🗑️ Deleted managers archive
    match /deleted_managers/{managerId} {
      allow read, write: if request.auth != null;
    }
    
    // 🔗 User bindings (role mapping)
    match /userBindings/{uid} {
      allow read, write: if request.auth != null;
    }
    
    // 📜 Audit logs - append only
    match /audit_logs/{logId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
    
    // 📜 Audit logs (alternate path)
    match /auditLogs/{logId} {
      allow read: if request.auth != null;
      allow create: if true;
      allow update, delete: if false;
    }
    
    // 🧾 Receipts & Invoices
    match /receiptVouchers/{id} {
      allow read, write: if request.auth != null;
    }
    
    match /invoices/{id} {
      allow read, write: if request.auth != null;
    }
    
    // 📊 Global logs
    match /logs/{logId} {
      allow read, write: if request.auth != null;
    }
    
    // 🔐 Secure access tokens
    match /secureAccessTokens/{tokenId} {
      allow read, write: if request.auth != null;
    }
    
    // ⚙️ Global settings
    match /settings/{settingId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // 📱 Demo links
    match /demoLinks/{linkId} {
      allow read, write: if request.auth != null;
    }
    
    // 📜 License notifications
    match /licenseNotifications/{notificationId} {
      allow read, write: if request.auth != null;
    }
    
    // 💾 Global backups
    match /backups/{backupId} {
      allow read, write: if request.auth != null;
    }
    
    // ⛔ DEFAULT DENY
  }
}`;

// ============================================================
// MAIN COMPONENT
// ============================================================

export const FirebaseSettingsPage: React.FC = () => {
    const { user } = useAuth();
    const { t } = useTranslation();

    // Form state
    const [config, setConfig] = useState<FirebaseConfig>({
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: ''
    });

    // UI state
    const [showApiKey, setShowApiKey] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
    const [connectionMessage, setConnectionMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [seedingMessage, setSeedingMessage] = useState('');
    const [copiedRules, setCopiedRules] = useState(false);
    const [healthReport, setHealthReport] = useState<DatabaseHealthReport | null>(null);
    const [loadingHealth, setLoadingHealth] = useState(false);

    // Current config display
    const [currentConfig, setCurrentConfig] = useState<Partial<FirebaseConfig> | null>(null);
    const [hasExistingConfig, setHasExistingConfig] = useState(false);
    const [missingCollections, setMissingCollections] = useState<string[]>([]);

    // Load current config on mount
    useEffect(() => {
        const loadConfig = async () => {
            const current = getCurrentConfig();
            setCurrentConfig(current);
            setHasExistingConfig(hasTenantConfig());

            if (isFirebaseConfigured()) {
                // ✅ SaaS: Check for missing collections with tenantId
                const tenantId = user?.tenantId;
                const missing = await checkMissingCollections(tenantId || undefined);
                setMissingCollections(missing);

                // Load health report
                if (user?.tenantId) {
                    setLoadingHealth(true);
                    try {
                        const report = await getDatabaseHealthReport(user.tenantId);
                        setHealthReport(report);
                    } catch (e) {
                        console.error('Failed to load health report:', e);
                    }
                    setLoadingHealth(false);
                }
            }
        };

        loadConfig();
    }, [user?.tenantId]);

    // Auto-fill auth domain and storage bucket when project ID changes
    useEffect(() => {
        if (config.projectId) {
            if (!config.authDomain) {
                setConfig(prev => ({
                    ...prev,
                    authDomain: `${config.projectId}.firebaseapp.com`
                }));
            }
            if (!config.storageBucket) {
                setConfig(prev => ({
                    ...prev,
                    storageBucket: `${config.projectId}.appspot.com`
                }));
            }
        }
    }, [config.projectId]);

    const handleInputChange = (field: keyof FirebaseConfig, value: string) => {
        setConfig(prev => ({ ...prev, [field]: value.trim() }));
        if (connectionStatus !== 'idle') {
            setConnectionStatus('idle');
            setConnectionMessage('');
        }
    };

    const handleTestConnection = async () => {
        if (!config.apiKey || !config.projectId || !config.authDomain) {
            setConnectionStatus('error');
            setConnectionMessage('❌ يرجى ملء جميع الحقول المطلوبة');
            return;
        }

        setConnectionStatus('testing');
        setConnectionMessage('🔄 جاري اختبار الاتصال...');

        const result = await testFirebaseConnection(config);

        if (result.success) {
            setConnectionStatus('success');
            setConnectionMessage(result.message);
        } else {
            setConnectionStatus('error');
            setConnectionMessage(result.message);
        }
    };

    const handleSave = async () => {
        if (connectionStatus !== 'success') {
            setConnectionMessage('⚠️ يجب اختبار الاتصال بنجاح قبل الحفظ');
            return;
        }

        setSaving(true);

        try {
            saveFirebaseConfig(config);
            setConnectionMessage('✅ تم الحفظ بنجاح! جاري إعادة تشغيل النظام...');

            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error) {
            console.error('Save error:', error);
            setConnectionMessage('❌ فشل في حفظ الإعدادات');
            setSaving(false);
        }
    };

    const handleClearConfig = () => {
        if (window.confirm(t('admin.deleteFirebaseConfirm') || 'هل أنت متأكد من حذف إعدادات Firebase الحالية؟\nسيتم إعادة تشغيل النظام.')) {
            clearFirebaseConfig();
            window.location.reload();
        }
    };

    const handleSeedDatabase = async () => {
        setSeeding(true);
        setSeedingMessage('🌱 جاري تأسيس البيانات الأساسية...');

        try {
            // ✅ SaaS: Get tenantId for data isolation
            const tenantId = user?.tenantId;
            if (!tenantId) {
                setSeedingMessage('❌ يجب تسجيل الدخول كمدير أولاً');
                return;
            }
            const result = await seedTenantDatabase(tenantId, { includeDemoRoom: true, forceReseed: false });

            if (result.success) {
                setSeedingMessage(`✅ تم إنشاء ${result.totalDocuments} سجل في ${result.collectionsCreated.length} جدول`);
                // Refresh missing collections
                const missing = await checkMissingCollections(tenantId);
                setMissingCollections(missing);
            } else {
                setSeedingMessage(`⚠️ تم التأسيس مع ${result.errors.length} أخطاء`);
            }
        } catch (error: any) {
            setSeedingMessage(`❌ فشل التأسيس: ${error.message}`);
        }

        setSeeding(false);
    };

    const handleCopyRules = () => {
        navigator.clipboard.writeText(FIRESTORE_RULES_TEMPLATE);
        setCopiedRules(true);
        setTimeout(() => setCopiedRules(false), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Database className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                            ⚙️ إعدادات قاعدة البيانات
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--theme-text-tertiary)' }}>
                            إدارة الاتصال بـ Firebase
                        </p>
                    </div>
                </div>

                {hasExistingConfig && (
                    <button
                        onClick={handleClearConfig}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline text-sm">إعادة تهيئة</span>
                    </button>
                )}
            </div>

            {/* Current Status */}
            {currentConfig && (
                <div 
                    className="p-4 rounded-xl"
                    style={{
                        background: 'var(--theme-bg-tertiary)',
                        border: '1px solid var(--theme-border-primary)'
                    }}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <Server className="w-5 h-5 text-teal-500" />
                        <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                            الاتصال الحالي
                        </span>
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            متصل
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span style={{ color: 'var(--theme-text-tertiary)' }}>Project ID:</span>
                            <span className="font-mono mr-2" style={{ color: 'var(--theme-text-primary)' }}>
                                {currentConfig.projectId}
                            </span>
                        </div>
                        <div>
                            <span style={{ color: 'var(--theme-text-tertiary)' }}>Auth Domain:</span>
                            <span className="font-mono mr-2" style={{ color: 'var(--theme-text-primary)' }}>
                                {currentConfig.authDomain}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Health Report */}
            {healthReport && (
                <div 
                    className={`p-4 rounded-xl ${
                        healthReport.overallHealth === 'healthy' 
                            ? 'bg-green-500/10 border border-green-500/30'
                            : healthReport.overallHealth === 'warning'
                                ? 'bg-amber-500/10 border border-amber-500/30'
                                : 'bg-red-500/10 border border-red-500/30'
                    }`}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <Zap className={`w-5 h-5 ${
                            healthReport.overallHealth === 'healthy' ? 'text-green-500' :
                            healthReport.overallHealth === 'warning' ? 'text-amber-500' : 'text-red-500'
                        }`} />
                        <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                            صحة قاعدة البيانات
                        </span>
                    </div>
                    <div className="space-y-2">
                        {healthReport.recommendations.map((rec, i) => (
                            <div key={i} className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                • {rec}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Missing Collections Warning */}
            {missingCollections.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center gap-3 mb-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <span className="font-medium text-amber-600">
                            جداول مفقودة ({missingCollections.length})
                        </span>
                    </div>
                    <p className="text-sm text-amber-700 mb-3">
                        الجداول التالية غير موجودة: {missingCollections.join(', ')}
                    </p>
                    <button
                        onClick={handleSeedDatabase}
                        disabled={seeding}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-all disabled:opacity-50"
                    >
                        {seeding ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Database className="w-4 h-4" />
                        )}
                        {seeding ? 'جاري التأسيس...' : 'تأسيس البيانات الأساسية'}
                    </button>
                    {seedingMessage && (
                        <p className="mt-2 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                            {seedingMessage}
                        </p>
                    )}
                </div>
            )}

            {/* Configuration Form */}
            <div 
                className="p-6 rounded-xl space-y-4"
                style={{
                    background: 'var(--theme-bg-secondary)',
                    border: '1px solid var(--theme-border-primary)'
                }}
            >
                <h3 className="font-medium flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
                    <Key className="w-5 h-5 text-amber-500" />
                    {hasExistingConfig ? 'تحديث بيانات الاتصال' : 'إعداد اتصال جديد'}
                </h3>

                {/* Info Banner */}
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                            <p className="font-medium text-blue-400 mb-1">كيفية الحصول على المفاتيح:</p>
                            <ol className="space-y-1 text-xs list-decimal list-inside" style={{ color: 'var(--theme-text-tertiary)' }}>
                                <li>اذهب إلى <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Firebase Console</a></li>
                                <li>أنشئ مشروع جديد أو اختر مشروع موجود</li>
                                <li>من Project Settings ← General ← Your apps</li>
                                <li>انسخ القيم من firebaseConfig</li>
                            </ol>
                        </div>
                    </div>
                </div>

                {/* API Key */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                        <Key className="w-4 h-4 text-amber-400" />
                        API Key <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type={showApiKey ? 'text' : 'password'}
                            value={config.apiKey}
                            onChange={(e) => handleInputChange('apiKey', e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full px-4 py-3 pr-12 rounded-xl text-sm font-mono"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                border: '1px solid var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--theme-text-tertiary)' }}
                        >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Project ID & Auth Domain */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                            <Database className="w-4 h-4 text-teal-400" />
                            Project ID <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={config.projectId}
                            onChange={(e) => handleInputChange('projectId', e.target.value)}
                            placeholder="my-hotel-app"
                            className="w-full px-4 py-3 rounded-xl text-sm font-mono"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                border: '1px solid var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                            <Globe className="w-4 h-4 text-purple-400" />
                            Auth Domain <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={config.authDomain}
                            onChange={(e) => handleInputChange('authDomain', e.target.value)}
                            placeholder="my-hotel-app.firebaseapp.com"
                            className="w-full px-4 py-3 rounded-xl text-sm font-mono"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                border: '1px solid var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        />
                    </div>
                </div>

                {/* Storage Bucket */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                        <FolderOpen className="w-4 h-4 text-green-400" />
                        Storage Bucket
                    </label>
                    <input
                        type="text"
                        value={config.storageBucket}
                        onChange={(e) => handleInputChange('storageBucket', e.target.value)}
                        placeholder="my-hotel-app.appspot.com"
                        className="w-full px-4 py-3 rounded-xl text-sm font-mono"
                        style={{
                            background: 'var(--theme-bg-tertiary)',
                            border: '1px solid var(--theme-border-primary)',
                            color: 'var(--theme-text-primary)'
                        }}
                    />
                </div>

                {/* Optional fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: 'var(--theme-text-tertiary)' }}>
                            <Send className="w-4 h-4" />
                            Messaging Sender ID
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10">اختياري</span>
                        </label>
                        <input
                            type="text"
                            value={config.messagingSenderId || ''}
                            onChange={(e) => handleInputChange('messagingSenderId', e.target.value)}
                            placeholder="123456789"
                            className="w-full px-4 py-3 rounded-xl text-sm font-mono"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                border: '1px solid var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: 'var(--theme-text-tertiary)' }}>
                            <Shield className="w-4 h-4" />
                            App ID
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10">للتحليلات</span>
                        </label>
                        <input
                            type="text"
                            value={config.appId || ''}
                            onChange={(e) => handleInputChange('appId', e.target.value)}
                            placeholder="1:123456789:web:abc123"
                            className="w-full px-4 py-3 rounded-xl text-sm font-mono"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                border: '1px solid var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        />
                    </div>
                </div>

                {/* Connection Status */}
                {connectionMessage && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${
                        connectionStatus === 'success'
                            ? 'bg-green-500/10 border border-green-500/30'
                            : connectionStatus === 'error'
                                ? 'bg-red-500/10 border border-red-500/30'
                                : connectionStatus === 'testing'
                                    ? 'bg-blue-500/10 border border-blue-500/30'
                                    : 'bg-white/5 border border-white/10'
                    }`}>
                        {connectionStatus === 'testing' && (
                            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                        )}
                        {connectionStatus === 'success' && (
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                        )}
                        {connectionStatus === 'error' && (
                            <XCircle className="w-5 h-5 text-red-400" />
                        )}
                        <span className={`text-sm ${
                            connectionStatus === 'success' ? 'text-green-400' :
                            connectionStatus === 'error' ? 'text-red-400' :
                            connectionStatus === 'testing' ? 'text-blue-400' : ''
                        }`} style={{ color: connectionStatus === 'idle' ? 'var(--theme-text-secondary)' : undefined }}>
                            {connectionMessage}
                        </span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <button
                        onClick={handleTestConnection}
                        disabled={connectionStatus === 'testing' || !config.apiKey || !config.projectId}
                        className="flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            background: 'var(--theme-bg-tertiary)',
                            border: '1px solid var(--theme-border-primary)',
                            color: 'var(--theme-text-primary)'
                        }}
                    >
                        {connectionStatus === 'testing' ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                جاري الاختبار...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4" />
                                اختبار الاتصال
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={connectionStatus !== 'success' || saving}
                        className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                            connectionStatus === 'success'
                                ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-teal-500/25'
                                : 'bg-white/10 text-white/30 cursor-not-allowed'
                        }`}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                جاري الحفظ...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                حفظ وتفعيل النظام
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Security Rules Section */}
            <div 
                className="p-6 rounded-xl"
                style={{
                    background: 'var(--theme-bg-secondary)',
                    border: '1px solid var(--theme-border-primary)'
                }}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
                        <FileText className="w-5 h-5 text-purple-500" />
                        قواعد الأمان (Firestore Rules)
                    </h3>
                    <button
                        onClick={handleCopyRules}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-all"
                        style={{ color: 'var(--theme-text-secondary)' }}
                    >
                        {copiedRules ? (
                            <>
                                <Check className="w-4 h-4 text-green-500" />
                                <span className="text-sm text-green-500">تم النسخ!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4" />
                                <span className="text-sm">نسخ</span>
                            </>
                        )}
                    </button>
                </div>

                <p className="text-sm mb-4" style={{ color: 'var(--theme-text-tertiary)' }}>
                    انسخ القواعد التالية والصقها في Firebase Console → Firestore → Rules
                </p>

                <pre 
                    className="p-4 rounded-xl text-xs overflow-x-auto"
                    style={{
                        background: 'var(--theme-bg-tertiary)',
                        border: '1px solid var(--theme-border-secondary)',
                        color: 'var(--theme-text-secondary)'
                    }}
                >
                    {FIRESTORE_RULES_TEMPLATE}
                </pre>

                <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px]" style={{ color: 'var(--theme-text-tertiary)' }}>
                            <span className="text-amber-400 font-medium">تنبيه أمني:</span> هذه قواعد أساسية للبدء.
                            يُنصح بتعديلها لتقييد الوصول حسب الدور والمستأجر في بيئة الإنتاج.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FirebaseSettingsPage;
