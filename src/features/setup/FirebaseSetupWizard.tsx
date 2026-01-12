/**
 * Firebase Setup Wizard
 * Multi-step wizard for complete Firebase configuration
 * 
 * 🔐 Step-by-step guide for setting up Firebase
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Database,
    CheckCircle,
    AlertTriangle,
    Eye,
    EyeOff,
    Copy,
    ExternalLink,
    Shield,
    Server,
    Sparkles,
    ArrowRight,
    ArrowLeft,
    Check,
    FileCode,
    Key,
    Users,
    Zap,
    BookOpen,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import {
    saveFirebaseConfig,
    testFirebaseConnection,
    isFirebaseConfigured,
    saveRecaptchaSiteKey,
    getRecaptchaSiteKey,
    type FirebaseConfig,
} from '../../services/firebase';
import { AdoraLoaderInline } from '../../components/common/AdoraLoader';

// ============================================================
// TYPES
// ============================================================

type SetupStep = 'config' | 'rules' | 'indexes' | 'auth' | 'verify';

interface StepInfo {
    id: SetupStep;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
}

// ============================================================
// CONSTANTS
// ============================================================

const STEPS: StepInfo[] = [
    { id: 'config', title: 'بيانات Firebase', subtitle: 'إدخال معلومات المشروع', icon: <Database className="w-5 h-5" /> },
    { id: 'rules', title: 'Security Rules', subtitle: 'قواعد الأمان', icon: <Shield className="w-5 h-5" /> },
    { id: 'indexes', title: 'Indexes', subtitle: 'الفهارس المركبة', icon: <FileCode className="w-5 h-5" /> },
    { id: 'auth', title: 'Authentication', subtitle: 'تفعيل المصادقة', icon: <Users className="w-5 h-5" /> },
    { id: 'verify', title: 'التحقق النهائي', subtitle: 'اختبار الاتصال', icon: <Zap className="w-5 h-5" /> },
];

// Security Rules Template - V4 Simplified (Easy to Understand)
const SECURITY_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================================
    // 🔐 Adora Hotel Management System Rules
    // ============================================
    
    // 🏢 Tenant data - accessible by authenticated users
    match /tenants/{tenantId}/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // 🔑 Global codes - readable by all (for PIN login), writable by authenticated
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
    
    // 📋 Requests collection - accessible by authenticated users
    match /requests/{requestId} {
      allow read, write: if request.auth != null;
    }
    
    // 🏥 Health check collection - for connection testing
    match /health_check/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // ⚙️ System settings - read by all, write by authenticated
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
    
    // 👔 Managers collection (Owner's view)
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
    
    // 📜 Audit logs - append only (immutable)
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
    
    // ⛔ DEFAULT DENY - Anything not explicitly allowed is DENIED!
  }
}`;

// Firestore Indexes Template
const FIRESTORE_INDEXES = `{
  "indexes": [
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "department", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "roomCards",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "checkInDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "managers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}`;

// ============================================================
// MAIN COMPONENT
// ============================================================

export const FirebaseSetupWizard: React.FC = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState<SetupStep>('config');
    const [isLoading, setIsLoading] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [copiedItem, setCopiedItem] = useState<string | null>(null);
    
    // 🔒 SECURITY: Redirect to login if Firebase is already configured
    // This prevents unauthorized access to setup page
    useEffect(() => {
        if (isFirebaseConfigured()) {
            console.log('🔒 Firebase already configured - redirecting to login');
            navigate('/login', { replace: true });
        }
    }, [navigate]);
    
    // Step completion status
    const [stepStatus, setStepStatus] = useState({
        config: false,
        rules: false,
        indexes: false,
        auth: false,
        verify: false,
    });
    
    // Test results
    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);

    // 🎨 Modern Toast Notification (بديل عن alert البدائية)
    const [toast, setToast] = useState<{
        show: boolean;
        type: 'success' | 'error' | 'info';
        title: string;
        message: string;
    } | null>(null);

    const showToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
        setToast({ show: true, type, title, message });
        // Auto-hide after 4 seconds
        setTimeout(() => setToast(null), 4000);
    };

    // Form state - ✅ Load from localStorage on init (ALWAYS, not just when configured)
    // ⚠️ Use same key as firebase.ts: 'adora_client_config'
    const [config, setConfig] = useState<FirebaseConfig>(() => {
        const saved = localStorage.getItem('adora_client_config');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return {
                    apiKey: '',
                    authDomain: '',
                    projectId: '',
                    storageBucket: '',
                    messagingSenderId: '',
                    appId: '',
                };
            }
        }
        return {
            apiKey: '',
            authDomain: '',
            projectId: '',
            storageBucket: '',
            messagingSenderId: '',
            appId: '',
        };
    });

    // 🛡️ reCAPTCHA Site Key for App Check
    const [recaptchaSiteKey, setRecaptchaSiteKey] = useState<string>(() => {
        return getRecaptchaSiteKey() || '';
    });

    // Check if already configured - update step status
    useEffect(() => {
        // ✅ Always check localStorage for saved config (same key as firebase.ts)
        const saved = localStorage.getItem('adora_client_config');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Only mark as complete if essential fields are present
                if (parsed.apiKey && parsed.projectId) {
                    setStepStatus(prev => ({ ...prev, config: true }));
                }
            } catch {
                // Ignore parse errors
            }
        }
        
        if (isFirebaseConfigured()) {
            // Load existing config for display (redundant but safe)
            const savedConfig = localStorage.getItem('adora_client_config');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                setConfig(parsed);
                setStepStatus(prev => ({ ...prev, config: true }));
            }
        }
    }, []);

    // Auto-fill authDomain and storageBucket based on projectId
    useEffect(() => {
        if (config.projectId) {
            setConfig(prev => ({
                ...prev,
                authDomain: prev.authDomain || `${config.projectId}.firebaseapp.com`,
                storageBucket: prev.storageBucket || `${config.projectId}.appspot.com`,
            }));
        }
    }, [config.projectId]);

    // Get current step index
    const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

    // Navigation
    const goToStep = (step: SetupStep) => {
        setCurrentStep(step);
        setTestResult(null);
    };

    const goNext = () => {
        const nextIndex = currentStepIndex + 1;
        if (nextIndex < STEPS.length) {
            setCurrentStep(STEPS[nextIndex].id);
            setTestResult(null);
        }
    };

    const goPrev = () => {
        const prevIndex = currentStepIndex - 1;
        if (prevIndex >= 0) {
            setCurrentStep(STEPS[prevIndex].id);
            setTestResult(null);
        }
    };

    // Copy to clipboard
    const copyToClipboard = async (text: string, item: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedItem(item);
        setTimeout(() => setCopiedItem(null), 2000);
    };

    // Test Firebase connection
    const handleTestConnection = async () => {
        setIsLoading(true);
        setTestResult(null);

        try {
            const result = await testFirebaseConnection(config);
            setTestResult(result);
            if (result.success) {
                setStepStatus(prev => ({ ...prev, config: true }));
            }
        } catch (error) {
            setTestResult({
                success: false,
                message: '❌ حدث خطأ غير متوقع أثناء الاختبار',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Save config and proceed
    const handleSaveConfig = async () => {
        setIsLoading(true);
        try {
            saveFirebaseConfig(config);
            setStepStatus(prev => ({ ...prev, config: true }));
            setTestResult({
                success: true,
                message: '✅ تم حفظ الإعدادات بنجاح!'
            });
            setTimeout(() => goNext(), 500);
        } catch (error) {
            setTestResult({
                success: false,
                message: '❌ حدث خطأ أثناء الحفظ'
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Mark step as done
    const markStepDone = (step: SetupStep) => {
        setStepStatus(prev => ({ ...prev, [step]: true }));
        goNext();
    };

    // Final verification - includes Anonymous Auth check
    const handleFinalVerification = async () => {
        setIsLoading(true);
        setTestResult(null);

        try {
            // Step 1: Test basic Firebase connection
            const connectionResult = await testFirebaseConnection(config);
            if (!connectionResult.success) {
                setTestResult(connectionResult);
                return;
            }

            // Step 2: Test Anonymous Auth (CRITICAL!)
            const { checkAnonymousAuthEnabled } = await import('../../services/firebase');
            const authResult = await checkAnonymousAuthEnabled();
            
            if (!authResult.enabled) {
                setTestResult({
                    success: false,
                    message: authResult.error || '❌ Anonymous Authentication غير مفعل!\n\n' +
                             '📍 الحل:\n' +
                             'Firebase Console → Authentication → Sign-in method → Anonymous → Enable ✅'
                });
                return;
            }

            // All tests passed!
            setTestResult({
                success: true,
                message: '✅ تم التحقق بنجاح!\n\n' +
                         '• اتصال Firebase: ✓\n' +
                         '• Anonymous Auth: ✓\n\n' +
                         '🎉 النظام جاهز للاستخدام!'
            });
            setStepStatus(prev => ({ ...prev, verify: true }));
            
        } catch (error) {
            setTestResult({
                success: false,
                message: '❌ فشل التحقق من الاتصال',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Complete setup
    const handleComplete = () => {
        navigate('/login');
    };

    const isFormValid = config.apiKey && config.projectId && config.authDomain;

    // Get Firebase Console URLs
    const getFirestoreRulesUrl = () => 
        `https://console.firebase.google.com/project/${config.projectId}/firestore/rules`;
    const getFirestoreIndexesUrl = () => 
        `https://console.firebase.google.com/project/${config.projectId}/firestore/indexes`;
    const getAuthUrl = () => 
        `https://console.firebase.google.com/project/${config.projectId}/authentication/providers`;

    // ============================================================
    // RENDER STEPS
    // ============================================================

    const renderConfigStep = () => (
        <div className="space-y-6">
            {/* Instructions */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-blue-400 mb-2">كيفية الحصول على البيانات:</h3>
                        <ol className="text-sm text-white/70 space-y-1 list-decimal list-inside">
                            <li>افتح <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Firebase Console <ExternalLink className="w-3 h-3 inline" /></a></li>
                            <li>أنشئ مشروع جديد أو اختر مشروع موجود</li>
                            <li>اذهب إلى Project Settings (⚙️) → General</li>
                            <li>أنشئ Web App وانسخ القيم من firebaseConfig</li>
                        </ol>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
                {/* API Key */}
                <div>
                    <label className="block text-sm text-white/70 mb-1.5">
                        <span className="text-red-400">*</span> API Key
                    </label>
                    <div className="relative">
                        <input
                            type={showApiKey ? 'text' : 'password'}
                            value={config.apiKey}
                            onChange={(e) => setConfig({ ...config, apiKey: e.target.value.trim() })}
                            placeholder="AIzaSy..."
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm"
                            dir="ltr"
                        />
                        <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                        >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Project ID */}
                <div>
                    <label className="block text-sm text-white/70 mb-1.5">
                        <span className="text-red-400">*</span> Project ID
                    </label>
                    <input
                        type="text"
                        value={config.projectId}
                        onChange={(e) => setConfig({ ...config, projectId: e.target.value.trim() })}
                        placeholder="my-hotel-project"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm"
                        dir="ltr"
                    />
                </div>

                {/* Auth Domain */}
                <div>
                    <label className="block text-sm text-white/70 mb-1.5">
                        <span className="text-red-400">*</span> Auth Domain
                    </label>
                    <input
                        type="text"
                        value={config.authDomain}
                        onChange={(e) => setConfig({ ...config, authDomain: e.target.value.trim() })}
                        placeholder="my-hotel-project.firebaseapp.com"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm"
                        dir="ltr"
                    />
                </div>

                {/* Storage Bucket */}
                <div>
                    <label className="block text-sm text-white/70 mb-1.5">
                        Storage Bucket (اختياري)
                    </label>
                    <input
                        type="text"
                        value={config.storageBucket}
                        onChange={(e) => setConfig({ ...config, storageBucket: e.target.value.trim() })}
                        placeholder="my-hotel-project.appspot.com"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm"
                        dir="ltr"
                    />
                </div>

                {/* Advanced Toggle */}
                <details className="group">
                    <summary className="text-sm text-white/50 cursor-pointer hover:text-white/70 transition-colors flex items-center gap-1">
                        <ChevronDown className="w-4 h-4 group-open:hidden" />
                        <ChevronUp className="w-4 h-4 hidden group-open:block" />
                        إعدادات متقدمة (اختياري)
                    </summary>
                    <div className="mt-4 space-y-4 pl-4 border-l border-slate-700">
                        <div>
                            <label className="block text-sm text-white/70 mb-1.5">Messaging Sender ID</label>
                            <input
                                type="text"
                                value={config.messagingSenderId || ''}
                                onChange={(e) => setConfig({ ...config, messagingSenderId: e.target.value.trim() })}
                                placeholder="123456789"
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm"
                                dir="ltr"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-white/70 mb-1.5">App ID</label>
                            <input
                                type="text"
                                value={config.appId || ''}
                                onChange={(e) => setConfig({ ...config, appId: e.target.value.trim() })}
                                placeholder="1:123456789:web:abc123..."
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm"
                                dir="ltr"
                            />
                        </div>
                    </div>
                </details>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={handleTestConnection}
                    disabled={!isFormValid || isLoading}
                    className="flex-1 px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <AdoraLoaderInline size={16} />
                            جاري الاختبار...
                        </>
                    ) : (
                        <>
                            <Server className="w-4 h-4" />
                            اختبار الاتصال
                        </>
                    )}
                </button>

                <button
                    onClick={handleSaveConfig}
                    disabled={!isFormValid}
                    className="flex-1 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    حفظ والتالي
                    <ArrowLeft className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

    const renderRulesStep = () => (
        <div className="space-y-6">
            {/* Quick Guide - Always Visible */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <h3 className="font-bold text-amber-400 mb-3 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    📍 الاستخدام السريع:
                </h3>
                <div className="text-sm text-white/80 space-y-2">
                    <p className="font-mono bg-slate-800/50 px-3 py-2 rounded-lg text-amber-300">
                        Firebase Console → Firestore → تبويب Rules → امسح الكود → الصق → Publish
                    </p>
                </div>
            </div>

            {/* Detailed Guide - Collapsible */}
            <details className="group">
                <summary className="cursor-pointer text-sm text-white/60 hover:text-white/80 transition-colors flex items-center gap-2 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
                    <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                    <span>📖 لو أول مرة أو نسيت الخطوات (اضغط هنا)</span>
                </summary>
                <div className="mt-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-4">
                    {/* Step 1 */}
                    <div className="border-r-2 border-amber-500 pr-4">
                        <h4 className="font-semibold text-white mb-2">1️⃣ إنشاء Database (لو مش موجود)</h4>
                        <ul className="text-sm text-white/70 space-y-1">
                            <li>• اضغط <span className="text-amber-400">Create Database</span> (الزر الأصفر)</li>
                            <li>• اختر <span className="text-green-400">Standard edition</span> ✅</li>
                            <li>• اختر السيرفر: <span className="text-cyan-400">us-central1</span> (أسرع وأرخص)</li>
                            <li>• اختر <span className="text-green-400">Production mode</span> ✅</li>
                        </ul>
                    </div>
                    
                    {/* Step 2 */}
                    <div className="border-r-2 border-amber-500 pr-4">
                        <h4 className="font-semibold text-white mb-2">2️⃣ تطبيق Rules</h4>
                        <ul className="text-sm text-white/70 space-y-1">
                            <li>• اضغط تبويب <span className="text-amber-400">Rules</span> من فوق</li>
                            <li>• امسح كل الكود الموجود</li>
                            <li>• الصق كود أدورا (من تحت)</li>
                            <li>• اضغط <span className="text-blue-400">Publish</span> (الزر الأزرق)</li>
                        </ul>
                    </div>

                    {/* Why us-central1 */}
                    <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <p className="text-xs text-cyan-300">
                            💡 <strong>ليه us-central1؟</strong> ده السيرفر الرئيسي لجوجل - أسرع تحديثات، أقل تكلفة، ومشمول في Free Tier
                        </p>
                    </div>
                </div>
            </details>

            {/* Code Block */}
            <div className="relative">
                <div className="absolute top-3 left-3 flex gap-2 z-10">
                    <button
                        onClick={() => copyToClipboard(SECURITY_RULES, 'rules')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                            copiedItem === 'rules' 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-slate-700 text-white hover:bg-slate-600'
                        }`}
                    >
                        {copiedItem === 'rules' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedItem === 'rules' ? 'تم النسخ!' : 'نسخ'}
                    </button>
                    <a
                        href={getFirestoreRulesUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors flex items-center gap-1"
                    >
                        <ExternalLink className="w-3 h-3" />
                        فتح Firebase
                    </a>
                </div>
                <pre className="bg-slate-900 border border-slate-700 rounded-xl p-4 pt-14 text-xs text-white/80 font-mono overflow-x-auto max-h-64 overflow-y-auto">
                    {SECURITY_RULES}
                </pre>
            </div>

            {/* Confirmation */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={stepStatus.rules}
                        onChange={(e) => setStepStatus(prev => ({ ...prev, rules: e.target.checked }))}
                        className="w-5 h-5 rounded border-slate-600 text-teal-500 focus:ring-teal-500"
                    />
                    <span className="text-white/70">تم نسخ ولصق Security Rules في Firebase Console</span>
                </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={goPrev}
                    className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors flex items-center gap-2"
                >
                    <ArrowRight className="w-4 h-4" />
                    السابق
                </button>
                <button
                    onClick={goNext}
                    disabled={!stepStatus.rules}
                    className="flex-1 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    التالي
                    <ArrowLeft className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

    const renderIndexesStep = () => (
        <div className="space-y-6">
            {/* Quick Guide */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                <h3 className="font-bold text-purple-400 mb-3 flex items-center gap-2">
                    <FileCode className="w-5 h-5" />
                    📍 الاستخدام السريع:
                </h3>
                <div className="text-sm text-white/80 space-y-2">
                    <p className="font-mono bg-slate-800/50 px-3 py-2 rounded-lg text-purple-300">
                        Firebase Console → Firestore → تبويب Indexes → Create Index (أو تخطي)
                    </p>
                    <p className="text-xs text-yellow-400">
                        ⚡ هذه الخطوة اختيارية - النظام يعمل بدونها، لكنها تسرّع البحث
                    </p>
                </div>
            </div>

            {/* Detailed Guide - Collapsible */}
            <details className="group">
                <summary className="cursor-pointer text-sm text-white/60 hover:text-white/80 transition-colors flex items-center gap-2 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
                    <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                    <span>📖 متى أحتاج Indexes؟ (اضغط هنا)</span>
                </summary>
                <div className="mt-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-3">
                    <div className="text-sm text-white/70">
                        <p className="mb-2">الـ Indexes تحتاجها لما:</p>
                        <ul className="space-y-1">
                            <li>• عندك <span className="text-purple-400">بيانات كتير</span> (آلاف الطلبات)</li>
                            <li>• بتعمل <span className="text-purple-400">بحث معقد</span> (فلترة + ترتيب)</li>
                            <li>• ظهرت رسالة <span className="text-red-400">"requires an index"</span></li>
                        </ul>
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <p className="text-xs text-green-300">
                            ✅ <strong>نصيحة:</strong> ابدأ بدون Indexes، ولما يطلبها Firebase هيديك رابط مباشر لإنشائها
                        </p>
                    </div>
                </div>
            </details>

            {/* Code Block */}
            <div className="relative">
                <div className="absolute top-3 left-3 flex gap-2 z-10">
                    <button
                        onClick={() => copyToClipboard(FIRESTORE_INDEXES, 'indexes')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                            copiedItem === 'indexes' 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-slate-700 text-white hover:bg-slate-600'
                        }`}
                    >
                        {copiedItem === 'indexes' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedItem === 'indexes' ? 'تم النسخ!' : 'نسخ'}
                    </button>
                    <a
                        href={getFirestoreIndexesUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors flex items-center gap-1"
                    >
                        <ExternalLink className="w-3 h-3" />
                        فتح Firebase
                    </a>
                </div>
                <pre className="bg-slate-900 border border-slate-700 rounded-xl p-4 pt-14 text-xs text-white/80 font-mono overflow-x-auto max-h-48 overflow-y-auto">
                    {FIRESTORE_INDEXES}
                </pre>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={goPrev}
                    className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors flex items-center gap-2"
                >
                    <ArrowRight className="w-4 h-4" />
                    السابق
                </button>
                <button
                    onClick={() => {
                        setStepStatus(prev => ({ ...prev, indexes: true }));
                        goNext();
                    }}
                    className="flex-1 px-6 py-3 rounded-xl bg-slate-600 hover:bg-slate-500 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                    تخطي (اختياري)
                </button>
                <button
                    onClick={() => markStepDone('indexes')}
                    className="flex-1 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                    تم، التالي
                    <ArrowLeft className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

    const renderAuthStep = () => (
        <div className="space-y-6">
            {/* 🚨 Critical Security Warning */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30">
                <h3 className="font-bold text-red-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    ⚠️ مهم جداً - حماية الميزانية!
                </h3>
                <p className="text-sm text-white/80">
                    تفعيل <span className="text-yellow-400 font-bold">Anonymous Authentication</span> ضروري لحماية ميزانيتك من استنزاف الـ Quota.
                    بدونه، أي شخص يستطيع قراءة البيانات مجاناً وتحميلك فلوس!
                </p>
            </div>

            {/* Quick Guide - Anonymous Auth */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20">
                <h3 className="font-bold text-yellow-400 mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    📍 الخطوة الأولى (إلزامي): Anonymous Auth
                </h3>
                <div className="text-sm text-white/80 space-y-2">
                    <p className="font-mono bg-slate-800/50 px-3 py-2 rounded-lg text-yellow-300">
                        Firebase Console → Authentication → Sign-in method → Anonymous → Enable ✅
                    </p>
                </div>
            </div>

            {/* Quick Guide - Email/Password */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                <h3 className="font-bold text-cyan-400 mb-3 flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    📍 الخطوة الثانية: Email/Password
                </h3>
                <div className="text-sm text-white/80 space-y-2">
                    <p className="font-mono bg-slate-800/50 px-3 py-2 rounded-lg text-cyan-300">
                        Firebase Console → Authentication → Sign-in method → Email/Password → Enable ✅
                    </p>
                </div>
            </div>

            {/* Detailed Guide - Collapsible */}
            <details className="group">
                <summary className="cursor-pointer text-sm text-white/60 hover:text-white/80 transition-colors flex items-center gap-2 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
                    <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                    <span>📖 الخطوات بالتفصيل (اضغط هنا)</span>
                </summary>
                <div className="mt-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-3">
                    <div className="border-r-2 border-yellow-500 pr-4 mb-4">
                        <h4 className="text-yellow-400 font-medium mb-2">🔐 Anonymous Auth (للضيوف عبر QR):</h4>
                        <ul className="text-sm text-white/70 space-y-2">
                            <li>1️⃣ افتح <span className="text-yellow-400">Authentication</span> من القائمة الجانبية</li>
                            <li>2️⃣ اذهب إلى <span className="text-yellow-400">Sign-in method</span></li>
                            <li>3️⃣ اختر <span className="text-yellow-400">Anonymous</span></li>
                            <li>4️⃣ فعّل <span className="text-green-400">Enable</span> واضغط <span className="text-blue-400">Save</span></li>
                        </ul>
                    </div>
                    <div className="border-r-2 border-cyan-500 pr-4">
                        <h4 className="text-cyan-400 font-medium mb-2">📧 Email/Password (للموظفين):</h4>
                        <ul className="text-sm text-white/70 space-y-2">
                            <li>1️⃣ نفس الخطوات أعلاه</li>
                            <li>2️⃣ اختر <span className="text-cyan-400">Email/Password</span></li>
                            <li>3️⃣ فعّل <span className="text-green-400">Enable</span> واضغط <span className="text-blue-400">Save</span></li>
                        </ul>
                    </div>
                </div>
            </details>

            {/* Visual Guide */}
            <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-800/50 border border-yellow-500/30">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-medium text-white">Anonymous</span>
                    </div>
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">إلزامي 🔴</span>
                    <p className="text-xs text-white/50 mt-2">للضيوف (QR)</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/50 border border-green-500/30">
                    <div className="flex items-center gap-2 mb-2">
                        <Key className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium text-white">Email/Pass</span>
                    </div>
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">مطلوب ✅</span>
                    <p className="text-xs text-white/50 mt-2">للموظفين</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                        <Key className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium text-white">Phone</span>
                    </div>
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">اختياري</span>
                    <p className="text-xs text-white/50 mt-2">OTP</p>
                </div>
            </div>

            {/* Direct Link */}
            <a
                href={getAuthUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors text-center"
            >
                <div className="flex items-center justify-center gap-2 text-cyan-400 font-medium">
                    <ExternalLink className="w-5 h-5" />
                    فتح صفحة Authentication في Firebase
                </div>
            </a>

            {/* 🛡️ App Check Section - Budget Protection */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30">
                <h3 className="font-bold text-emerald-400 mb-3 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    🛡️ App Check - حماية الميزانية (مُوصى به بشدة!)
                </h3>
                <p className="text-sm text-white/70 mb-4">
                    يمنع أي شخص من استخدام الـ API Keys خارج تطبيقك = <span className="text-green-400 font-bold">حماية الـ $10 ميزانية من الاستنزاف</span>
                </p>
                
                {/* Step by Step Guide */}
                <div className="space-y-4">
                    {/* Step 1: Get reCAPTCHA Key */}
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                        <h4 className="text-sm font-bold text-amber-400 mb-2">الخطوة 1: إنشاء مفتاح reCAPTCHA</h4>
                        <ol className="text-xs text-white/70 space-y-1 pr-4 list-decimal list-inside">
                            <li>افتح <a href="https://www.google.com/recaptcha/admin/create" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">Google reCAPTCHA Admin</a></li>
                            <li>في <span className="text-yellow-400">Label</span>: اكتب <span className="text-green-400 font-mono">Adora Hotel</span></li>
                            <li>في <span className="text-yellow-400">reCAPTCHA type</span>: اختر <span className="text-green-400">Score based (v3)</span></li>
                            <li>في <span className="text-yellow-400">Domains</span>: أضف <span className="text-green-400 font-mono">localhost</span> + دومين موقعك</li>
                            <li>اضغط <span className="text-blue-400">Submit</span></li>
                            <li>📋 <span className="text-red-400 font-bold">انسخ الـ SECRET KEY</span> (المفتاح السري)</li>
                        </ol>
                        <a
                            href="https://www.google.com/recaptcha/admin/create"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                        >
                            <ExternalLink className="w-3 h-3" />
                            فتح reCAPTCHA Admin
                        </a>
                    </div>

                    {/* Step 2: Register in Firebase */}
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                        <h4 className="text-sm font-bold text-amber-400 mb-2">الخطوة 2: تسجيل في Firebase App Check</h4>
                        <ol className="text-xs text-white/70 space-y-1 pr-4 list-decimal list-inside">
                            <li>افتح <span className="text-emerald-400">App Check</span> من القائمة الجانبية في Firebase</li>
                            <li>اضغط على تطبيقك <span className="text-green-400">Adora-platform</span></li>
                            <li>اختر <span className="text-green-400">reCAPTCHA</span> (⚠️ ليس Enterprise!)</li>
                            <li>الصق الـ <span className="text-red-400 font-bold">SECRET KEY</span> في الخانة</li>
                            <li>اترك <span className="text-yellow-400">Token time to live</span> = <span className="text-green-400">1 day</span></li>
                            <li>اضغط <span className="text-blue-400">Save</span></li>
                        </ol>
                    </div>

                    {/* Step 3: Enforce */}
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                        <h4 className="text-sm font-bold text-amber-400 mb-2">الخطوة 3: تفعيل الحماية على APIs</h4>
                        <ol className="text-xs text-white/70 space-y-1 pr-4 list-decimal list-inside">
                            <li>بعد التسجيل، اذهب لتبويب <span className="text-emerald-400">APIs</span></li>
                            <li>فعّل <span className="text-green-400">Firestore</span> → Enforce</li>
                            <li>فعّل <span className="text-green-400">Storage</span> → Enforce</li>
                            <li>فعّل <span className="text-green-400">Authentication</span> → Enforce</li>
                        </ol>
                        <p className="mt-2 text-xs text-yellow-400">
                            ⚠️ بعد الـ Enforce، أي طلب من خارج التطبيق سيُرفض تلقائياً!
                        </p>
                    </div>
                </div>

                {/* 📋 Keys Explanation */}
                <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <h4 className="text-sm font-bold text-blue-400 mb-2">📋 فهم المفتاحين من Google reCAPTCHA:</h4>
                    <div className="space-y-3 text-xs">
                        <div className="p-3 rounded bg-slate-800/50 border border-amber-500/30">
                            <p className="text-amber-400 font-bold mb-2">🔐 المفتاح السري (Secret Key):</p>
                            <p className="text-white/70 italic border-r-2 border-amber-500 pr-2">"استخدِم هذا المفتاح السري لإجراء الاتصال بين موقعك الإلكتروني وخدمة reCAPTCHA."</p>
                            <p className="text-green-400 mt-2 font-bold">✅ هذا حطيته في Firebase App Check (خلاص تم!)</p>
                        </div>
                        <div className="p-3 rounded bg-slate-800/50 border border-emerald-500/30">
                            <p className="text-emerald-400 font-bold mb-2">🌐 مفتاح الموقع الإلكتروني (Site Key):</p>
                            <p className="text-white/70 italic border-r-2 border-emerald-500 pr-2">"استخدِم مفتاح الموقع الإلكتروني هذا في رمز HTML الذي يعرضه موقعك الإلكتروني للمستخدمين."</p>
                            <p className="text-yellow-400 mt-2 font-bold">⬇️ هذا حطه هنا تحت في الخانة!</p>
                        </div>
                    </div>
                </div>

                {/* 🔑 Site Key Input */}
                <div className="mt-3 p-3 rounded-lg bg-slate-800/80 border border-emerald-500/30">
                    <label className="block text-sm font-medium text-emerald-400 mb-2">
                        🔑 reCAPTCHA Site Key (للتفعيل في التطبيق)
                    </label>
                    <p className="text-xs text-white/50 mb-2">
                        الصق <span className="text-emerald-400 font-bold">مفتاح الموقع الإلكتروني</span> هنا (الأول، ليس السري!)
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={recaptchaSiteKey}
                            onChange={(e) => setRecaptchaSiteKey(e.target.value)}
                            placeholder="6Lc...ABC (Site Key من Google reCAPTCHA)"
                            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-white/30 focus:border-emerald-500 focus:outline-none"
                        />
                        <button
                            onClick={() => {
                                if (recaptchaSiteKey.trim()) {
                                    saveRecaptchaSiteKey(recaptchaSiteKey.trim());
                                    showToast(
                                        'success',
                                        '✅ تم حفظ Site Key!',
                                        'أعد تحميل الصفحة لتفعيل App Check.'
                                    );
                                }
                            }}
                            disabled={!recaptchaSiteKey.trim()}
                            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            حفظ
                        </button>
                    </div>
                    {recaptchaSiteKey && (
                        <p className="mt-2 text-xs text-green-400">
                            ✅ Site Key محفوظ - أعد تحميل الصفحة ثم يمكنك عمل Enforce
                        </p>
                    )}
                </div>

                <div className="flex gap-2 mt-4">
                    <a
                        href={config.projectId ? `https://console.firebase.google.com/project/${config.projectId}/appcheck` : 'https://console.firebase.google.com/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors text-sm"
                    >
                        <ExternalLink className="w-4 h-4" />
                        فتح App Check
                    </a>
                    <a
                        href="https://www.google.com/recaptcha/admin/create"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors text-sm"
                    >
                        <Key className="w-4 h-4" />
                        إنشاء مفتاح reCAPTCHA
                    </a>
                </div>
            </div>

            {/* Confirmation */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={stepStatus.auth}
                        onChange={(e) => setStepStatus(prev => ({ ...prev, auth: e.target.checked }))}
                        className="w-5 h-5 rounded border-slate-600 text-teal-500 focus:ring-teal-500"
                    />
                    <span className="text-white/70">تم تفعيل Anonymous + Email/Password</span>
                </label>
                <p className="text-xs text-white/40 pr-8">
                    💡 App Check اختياري الآن، لكن يُنصح بتفعيله لاحقاً لحماية ميزانيتك
                </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={goPrev}
                    className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors flex items-center gap-2"
                >
                    <ArrowRight className="w-4 h-4" />
                    السابق
                </button>
                <button
                    onClick={goNext}
                    disabled={!stepStatus.auth}
                    className="flex-1 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    التالي
                    <ArrowLeft className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

    const renderVerifyStep = () => (
        <div className="space-y-6">
            {/* Status Summary */}
            <div className="space-y-3">
                {STEPS.slice(0, -1).map((step) => (
                    <div
                        key={step.id}
                        className={`p-4 rounded-xl border flex items-center gap-3 ${
                            stepStatus[step.id]
                                ? 'bg-green-500/10 border-green-500/20'
                                : 'bg-slate-800/50 border-slate-700'
                        }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            stepStatus[step.id] ? 'bg-green-500/20' : 'bg-slate-700'
                        }`}>
                            {stepStatus[step.id] ? (
                                <Check className="w-4 h-4 text-green-400" />
                            ) : (
                                <span className="text-white/40">{step.icon}</span>
                            )}
                        </div>
                        <div className="flex-1">
                            <p className={`font-medium ${stepStatus[step.id] ? 'text-green-400' : 'text-white/60'}`}>
                                {step.title}
                            </p>
                            <p className="text-xs text-white/40">{step.subtitle}</p>
                        </div>
                        {stepStatus[step.id] && (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                        )}
                    </div>
                ))}
            </div>

            {/* Final Test */}
            <button
                onClick={handleFinalVerification}
                disabled={isLoading}
                className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
                {isLoading ? (
                    <>
                        <AdoraLoaderInline size={20} />
                        جاري التحقق...
                    </>
                ) : (
                    <>
                        <Zap className="w-5 h-5" />
                        اختبار الاتصال النهائي
                    </>
                )}
            </button>

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={goPrev}
                    className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors flex items-center gap-2"
                >
                    <ArrowRight className="w-4 h-4" />
                    السابق
                </button>
                <button
                    onClick={handleComplete}
                    disabled={!testResult?.success}
                    className="flex-1 px-6 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <Check className="w-5 h-5" />
                    إنهاء والدخول للنظام 🎉
                </button>
            </div>
        </div>
    );

    // ============================================================
    // MAIN RENDER
    // ============================================================

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            {/* 🎨 Modern Toast Notification - في وسط الشاشة */}
            {toast && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm slide-down">
                    <div className={`
                        flex flex-col items-center gap-4 px-8 py-6 rounded-3xl shadow-2xl border-2 max-w-md mx-4
                        ${toast.type === 'success' 
                            ? 'bg-slate-900 border-emerald-500 text-emerald-100' 
                            : toast.type === 'error'
                            ? 'bg-slate-900 border-red-500 text-red-100'
                            : 'bg-slate-900 border-blue-500 text-blue-100'
                        }
                    `}>
                        {/* أيقونة كبيرة */}
                        <div className={`
                            w-16 h-16 rounded-2xl flex items-center justify-center
                            ${toast.type === 'success' 
                                ? 'bg-emerald-500/20' 
                                : toast.type === 'error'
                                ? 'bg-red-500/20'
                                : 'bg-blue-500/20'
                            }
                        `}>
                            {toast.type === 'success' && <CheckCircle className="w-8 h-8 text-emerald-400" />}
                            {toast.type === 'error' && <AlertTriangle className="w-8 h-8 text-red-400" />}
                            {toast.type === 'info' && <Sparkles className="w-8 h-8 text-blue-400" />}
                        </div>
                        
                        {/* النص */}
                        <div className="text-center">
                            <p className="font-bold text-lg mb-1">{toast.title}</p>
                            <p className="text-sm opacity-80">{toast.message}</p>
                        </div>
                        
                        {/* زر الإغلاق */}
                        <button 
                            onClick={() => setToast(null)}
                            className={`
                                w-full py-3 rounded-xl font-medium transition-all
                                ${toast.type === 'success' 
                                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white' 
                                    : toast.type === 'error'
                                    ? 'bg-red-500 hover:bg-red-400 text-white'
                                    : 'bg-blue-500 hover:bg-blue-400 text-white'
                                }
                            `}
                        >
                            حسناً ✓
                        </button>
                    </div>
                </div>
            )}

            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="p-3 rounded-2xl bg-teal-500/20">
                            <Database className="w-8 h-8 text-teal-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-white">معالج إعداد Firebase</h1>
                    </div>
                    <p className="text-white/60">
                        اتبع الخطوات لإعداد قاعدة البيانات بشكل صحيح
                    </p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    {STEPS.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <button
                                onClick={() => goToStep(step.id)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                    currentStep === step.id
                                        ? 'bg-teal-500 text-white'
                                        : stepStatus[step.id]
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-slate-700 text-white/40'
                                }`}
                                title={step.title}
                            >
                                {stepStatus[step.id] ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    <span className="text-sm font-medium">{index + 1}</span>
                                )}
                            </button>
                            {index < STEPS.length - 1 && (
                                <div className={`w-8 h-0.5 ${
                                    stepStatus[step.id] ? 'bg-green-500' : 'bg-slate-700'
                                }`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Current Step Title */}
                <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold text-white">
                        {STEPS[currentStepIndex].title}
                    </h2>
                    <p className="text-sm text-white/50">{STEPS[currentStepIndex].subtitle}</p>
                </div>

                {/* Main Card */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl">
                    {/* Test Result */}
                    {testResult && (
                        <div className={`mb-6 p-4 rounded-xl ${
                            testResult.success 
                                ? 'bg-green-500/10 border border-green-500/20' 
                                : 'bg-red-500/10 border border-red-500/20'
                        }`}>
                            <div className="flex items-start gap-3">
                                {testResult.success ? (
                                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                                ) : (
                                    <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                                )}
                                <p className={`text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                    {testResult.message}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step Content */}
                    {currentStep === 'config' && renderConfigStep()}
                    {currentStep === 'rules' && renderRulesStep()}
                    {currentStep === 'indexes' && renderIndexesStep()}
                    {currentStep === 'auth' && renderAuthStep()}
                    {currentStep === 'verify' && renderVerifyStep()}
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-white/40">
                        🔐 بياناتك مخزنة محلياً فقط ولا يتم إرسالها لأي طرف ثالث
                    </p>
                    <a
                        href="https://firebase.google.com/docs/web/setup"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 text-sm text-white/40 hover:text-white/60 transition-colors inline-flex items-center gap-1"
                    >
                        <BookOpen className="w-3 h-3" />
                        مساعدة Firebase الرسمية
                    </a>
                </div>
            </div>
        </div>
    );
};

export default FirebaseSetupWizard;
