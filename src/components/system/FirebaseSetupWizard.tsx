/**
 * Firebase Setup Wizard 🔧
 * Allows owner/admin to configure Firebase credentials
 * 
 * Features:
 * - Input fields for all Firebase config values
 * - Test Connection button with visual feedback
 * - Only saves config after successful connection test
 * - Auto-reloads app after saving
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import {
    Database, Key, Globe, FolderOpen, Send, Shield,
    CheckCircle2, XCircle, Loader2, AlertTriangle,
    Eye, EyeOff, Info, ExternalLink, RefreshCw, Save
} from 'lucide-react';
import {
    FirebaseConfig,
    testFirebaseConnection,
    saveFirebaseConfig,
    getCurrentConfig,
    isFirebaseConfigured
} from '../../services/firebase';

// ============================================================
// TYPES
// ============================================================

interface FirebaseSetupWizardProps {
    onSetupComplete?: () => void;
    embedded?: boolean; // If true, shows as a settings panel rather than full-screen
}

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

// ============================================================
// MAIN COMPONENT
// ============================================================

export const FirebaseSetupWizard: React.FC<FirebaseSetupWizardProps> = ({
    onSetupComplete,
    embedded = false
}) => {
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

    // Check if already configured
    const [isAlreadyConfigured, setIsAlreadyConfigured] = useState(false);

    useEffect(() => {
        const currentConfig = getCurrentConfig();
        if (currentConfig && currentConfig.projectId) {
            setIsAlreadyConfigured(true);
        }
    }, []);

    // Auto-fill storage bucket when project ID changes
    useEffect(() => {
        if (config.projectId && !config.storageBucket) {
            setConfig(prev => ({
                ...prev,
                storageBucket: `${config.projectId}.appspot.com`
            }));
        }
    }, [config.projectId]);

    const handleInputChange = (field: keyof FirebaseConfig, value: string) => {
        setConfig(prev => ({ ...prev, [field]: value.trim() }));
        // Reset connection status when config changes
        if (connectionStatus !== 'idle') {
            setConnectionStatus('idle');
            setConnectionMessage('');
        }
    };

    const handleTestConnection = async () => {
        // Validate required fields
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
            // Save configuration
            saveFirebaseConfig(config);

            // Show success message
            setConnectionMessage('✅ تم الحفظ بنجاح! جاري إعادة تشغيل النظام...');

            // Notify parent if provided
            onSetupComplete?.();

            // Reload after a short delay to apply new config
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error) {
            console.error('Save error:', error);
            setConnectionMessage('❌ فشل في حفظ الإعدادات');
            setSaving(false);
        }
    };

    const containerClass = embedded
        ? 'solid-modal rounded-2xl overflow-hidden'
        : 'min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900';

    const cardClass = embedded
        ? ''
        : 'w-full max-w-2xl solid-modal rounded-2xl overflow-hidden shadow-2xl';

    return (
        <div className={containerClass} style={!embedded ? {} : { background: 'var(--theme-bg-secondary)' }}>
            <div className={cardClass} style={!embedded ? { background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' } : {}}>
                {/* Header */}
                <div className="p-6 border-b" style={{ borderColor: 'var(--theme-border-primary)' }}>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <Database className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                {isAlreadyConfigured ? '⚙️ إعدادات Firebase' : '🔧 إعداد Firebase'}
                            </h2>
                            <p className="text-sm" style={{ color: 'var(--theme-text-tertiary)' }}>
                                {isAlreadyConfigured
                                    ? 'تحديث بيانات الاتصال بقاعدة البيانات'
                                    : 'ربط النظام بقاعدة بيانات Firebase الخاصة بك'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Info Banner */}
                <div className="mx-6 mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
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

                {/* Form */}
                <div className="p-6 space-y-4">
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
                </div>

                {/* Actions */}
                <div className="p-6 border-t flex flex-col sm:flex-row gap-3" style={{ borderColor: 'var(--theme-border-primary)' }}>
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

                {/* Security Notice */}
                <div className="px-6 pb-6">
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-[11px]" style={{ color: 'var(--theme-text-tertiary)' }}>
                                <span className="text-amber-400 font-medium">تنبيه أمني:</span> تأكد من إعداد 
                                <a href="https://firebase.google.com/docs/rules" target="_blank" rel="noopener noreferrer" className="text-amber-400 mx-1 underline">
                                    Firestore Security Rules
                                </a>
                                في مشروعك لحماية البيانات.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FirebaseSetupWizard;
