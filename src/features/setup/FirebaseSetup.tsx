/**
 * Firebase Setup Page
 * Initial Firebase configuration for Adora Hotel Management System
 * 
 * 🔐 This page allows first-time setup of Firebase credentials
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
    RefreshCw,
    Shield,
    Server,
    Sparkles,
} from 'lucide-react';
import {
    saveFirebaseConfig,
    testFirebaseConnection,
    isFirebaseConfigured,
    reinitializeFirebase,
    type FirebaseConfig,
} from '../../services/firebase';
import { AdoraLoaderInline } from '../../components/common/AdoraLoader';

// ============================================================
// FIREBASE SETUP COMPONENT
// ============================================================

export const FirebaseSetup: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);
    const [showApiKey, setShowApiKey] = useState(false);
    const [copied, setCopied] = useState(false);

    // Form state
    const [config, setConfig] = useState<FirebaseConfig>({
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
    });

    // Check if already configured
    useEffect(() => {
        if (isFirebaseConfigured()) {
            navigate('/login');
        }
    }, [navigate]);

    // Auto-fill authDomain and storageBucket based on projectId
    useEffect(() => {
        if (config.projectId && !config.authDomain) {
            setConfig(prev => ({
                ...prev,
                authDomain: `${config.projectId}.firebaseapp.com`,
            }));
        }
        if (config.projectId && !config.storageBucket) {
            setConfig(prev => ({
                ...prev,
                storageBucket: `${config.projectId}.appspot.com`,
            }));
        }
    }, [config.projectId]);

    // Test connection
    const handleTestConnection = async () => {
        setIsLoading(true);
        setTestResult(null);

        try {
            const result = await testFirebaseConnection(config);
            setTestResult(result);
        } catch (error) {
            setTestResult({
                success: false,
                message: '❌ حدث خطأ غير متوقع أثناء الاختبار',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Save and continue
    const handleSaveAndContinue = async () => {
        setIsLoading(true);
        try {
            // Save config
            saveFirebaseConfig(config);
            
            // Wait a moment for Firebase to reinitialize
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify connection is working
            const verifyResult = await testFirebaseConnection(config);
            
            if (verifyResult.success) {
                setTestResult({
                    success: true,
                    message: '🚀 تم الاتصال بنجاح! جاري التحويل لصفحة الدخول...'
                });
                
                // Navigate after short delay
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1000);
            } else {
                setTestResult({
                    success: false,
                    message: verifyResult.message
                });
            }
        } catch (error) {
            setTestResult({
                success: false,
                message: '❌ حدث خطأ أثناء الحفظ'
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Copy instructions
    const copyInstructions = () => {
        const text = `
خطوات إعداد Firebase لنظام أدورا:

1. افتح https://console.firebase.google.com
2. أنشئ مشروع جديد أو اختر مشروع موجود
3. اذهب إلى Project Settings (⚙️) > General
4. أنشئ Web App إذا لم يكن موجوداً
5. انسخ القيم من firebaseConfig
6. الصق القيم في هذه الصفحة
        `.trim();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isFormValid = config.apiKey && config.projectId && config.authDomain;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="p-3 rounded-2xl bg-teal-500/20">
                            <Database className="w-8 h-8 text-teal-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-white">إعداد Firebase</h1>
                    </div>
                    <p className="text-white/60">
                        لتشغيل نظام أدورا، يجب إدخال بيانات مشروع Firebase الخاص بك
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl">
                    {/* Instructions */}
                    <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
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
                                <button
                                    onClick={copyInstructions}
                                    className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                >
                                    {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    {copied ? 'تم النسخ!' : 'نسخ التعليمات'}
                                </button>
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
                            <summary className="text-sm text-white/50 cursor-pointer hover:text-white/70 transition-colors">
                                ▸ إعدادات متقدمة (اختياري)
                            </summary>
                            <div className="mt-4 space-y-4 pl-4 border-l border-slate-700">
                                {/* Messaging Sender ID */}
                                <div>
                                    <label className="block text-sm text-white/70 mb-1.5">
                                        Messaging Sender ID
                                    </label>
                                    <input
                                        type="text"
                                        value={config.messagingSenderId || ''}
                                        onChange={(e) => setConfig({ ...config, messagingSenderId: e.target.value.trim() })}
                                        placeholder="123456789"
                                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm"
                                        dir="ltr"
                                    />
                                </div>

                                {/* App ID */}
                                <div>
                                    <label className="block text-sm text-white/70 mb-1.5">
                                        App ID
                                    </label>
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

                    {/* Test Result */}
                    {testResult && (
                        <div className={`mt-6 p-4 rounded-xl ${
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

                    {/* Actions */}
                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
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
                            onClick={handleSaveAndContinue}
                            disabled={!isFormValid || !testResult?.success}
                            className="flex-1 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Shield className="w-4 h-4" />
                            حفظ والمتابعة
                        </button>
                    </div>

                    {/* Footer Note */}
                    <p className="mt-6 text-center text-xs text-white/40">
                        🔐 بياناتك مخزنة محلياً فقط ولا يتم إرسالها لأي طرف ثالث
                    </p>
                </div>

                {/* Help Link */}
                <div className="mt-6 text-center">
                    <a
                        href="https://firebase.google.com/docs/web/setup"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-white/40 hover:text-white/60 transition-colors inline-flex items-center gap-1"
                    >
                        <ExternalLink className="w-3 h-3" />
                        مساعدة Firebase الرسمية
                    </a>
                </div>
            </div>
        </div>
    );
};

export default FirebaseSetup;
