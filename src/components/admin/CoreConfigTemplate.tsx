/**
 * Core Config Template Component 🔧
 * Hidden settings tab for Owner/Super Admin to store:
 * - Firestore Security Rules template
 * - Firestore Indexes template
 * 
 * These templates are used during automated tenant setup
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import {
    Shield, Database, Save, Copy, Check, AlertTriangle,
    RefreshCw, ChevronDown, ChevronUp, Download, Lock
} from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

// ============================================================
// TYPES
// ============================================================

interface CoreConfigTemplateData {
    firestoreRules: string;
    firestoreIndexes: string;
    updatedAt?: any;
    updatedBy?: string;
}

interface CoreConfigTemplateProps {
    onSave?: () => void;
}

// ============================================================
// DEFAULT TEMPLATES
// ============================================================

const DEFAULT_FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================================
    // 🔐 Adora Hotel Management System Rules
    // ============================================
    
    // Allow read/write to authenticated users for tenant data
    match /tenants/{tenantId}/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Global codes - readable by all, writable by admins
    match /globalCodes/{codeId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Requests collection - accessible by authenticated users
    match /requests/{requestId} {
      allow read, write: if request.auth != null;
    }
    
    // Health check collection - for connection testing
    match /health_check/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // System settings - read by all, write by owner
    match /system/{settingId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Audit logs - append only
    match /audit_logs/{logId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
  }
}`;

const DEFAULT_FIRESTORE_INDEXES = `{
  "indexes": [
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "branchId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "branchId", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "rooms",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "branchId", "order": "ASCENDING" },
        { "fieldPath": "floor", "order": "ASCENDING" },
        { "fieldPath": "roomNumber", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "coffeeShopOrders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "branchId", "order": "ASCENDING" },
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

export const CoreConfigTemplate: React.FC<CoreConfigTemplateProps> = ({ onSave }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState<'rules' | 'indexes' | null>(null);
    const [expandedSection, setExpandedSection] = useState<'rules' | 'indexes' | null>('rules');
    const [showWelcome, setShowWelcome] = useState(true); // ✅ Welcome screen first
    
    const [config, setConfig] = useState<CoreConfigTemplateData>({
        firestoreRules: DEFAULT_FIRESTORE_RULES,
        firestoreIndexes: DEFAULT_FIRESTORE_INDEXES
    });

    // Load existing config
    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        if (!db) return;
        setLoading(true);
        try {
            const docRef = doc(db, 'system', 'core_config_template');
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data() as CoreConfigTemplateData;
                setConfig({
                    firestoreRules: data.firestoreRules || DEFAULT_FIRESTORE_RULES,
                    firestoreIndexes: data.firestoreIndexes || DEFAULT_FIRESTORE_INDEXES,
                    updatedAt: data.updatedAt,
                    updatedBy: data.updatedBy
                });
            }
        } catch (error) {
            console.error('Error loading core config template:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!db) return;
        setSaving(true);
        try {
            const docRef = doc(db, 'system', 'core_config_template');
            await setDoc(docRef, {
                ...config,
                updatedAt: serverTimestamp(),
                updatedBy: user?.id || 'unknown'
            });
            onSave?.();
        } catch (error) {
            console.error('Error saving core config template:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleCopy = (type: 'rules' | 'indexes') => {
        const text = type === 'rules' ? config.firestoreRules : config.firestoreIndexes;
        navigator.clipboard.writeText(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleResetToDefault = (type: 'rules' | 'indexes') => {
        if (type === 'rules') {
            setConfig(prev => ({ ...prev, firestoreRules: DEFAULT_FIRESTORE_RULES }));
        } else {
            setConfig(prev => ({ ...prev, firestoreIndexes: DEFAULT_FIRESTORE_INDEXES }));
        }
    };

    const downloadAsFile = (type: 'rules' | 'indexes') => {
        const text = type === 'rules' ? config.firestoreRules : config.firestoreIndexes;
        const filename = type === 'rules' ? 'firestore.rules' : 'firestore.indexes.json';
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
            </div>
        );
    }

    // ✅ Welcome/Introduction Screen
    if (showWelcome) {
        return (
            <div className="space-y-6 max-w-2xl mx-auto">
                {/* Welcome Header */}
                <div className="text-center py-8">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-6 border border-teal-500/30">
                        <Lock className="w-12 h-12 text-teal-400" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white mb-3">
                        🔐 صفحة التأسيس
                    </h1>
                    <p className="text-slate-600 dark:text-white/60 text-base">
                        إعداد قواعد الأمان و الفهارس لمشاريع Firebase الجديدة
                    </p>
                </div>

                {/* What You'll Find Here */}
                <div className="rounded-2xl p-6 border" style={{ background: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-primary)' }}>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <span>📋</span>
                        ماذا ستجد هنا؟
                    </h2>
                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                <Shield className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800 dark:text-white text-sm">1. قواعد الأمان (Security Rules)</h3>
                                <p className="text-xs text-slate-600 dark:text-white/60 mt-1">
                                    قواعد Firestore التي تحدد من يمكنه القراءة والكتابة في قاعدة البيانات
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                                <Database className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800 dark:text-white text-sm">2. الفهارس (Indexes)</h3>
                                <p className="text-xs text-slate-600 dark:text-white/60 mt-1">
                                    فهارس Firestore المركبة لتسريع عمليات البحث والاستعلام
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Warning */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-1">
                                ⚠️ تنبيه هام
                            </p>
                            <p className="text-xs text-slate-600 dark:text-white/70 leading-relaxed">
                                هذه الصفحة مخصصة للمطورين والمالكين فقط. التغييرات هنا تؤثر على أمان النظام.
                                تأكد من فهم الكود قبل التعديل.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Continue Button */}
                <div className="flex justify-center pt-4">
                    <button
                        onClick={() => setShowWelcome(false)}
                        className="px-8 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-500/25 transition-all transform hover:scale-105 flex items-center gap-3"
                    >
                        <span>المتابعة لعرض الأكواد</span>
                        <ChevronDown className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Back to Welcome Button */}
            <button
                onClick={() => setShowWelcome(true)}
                className="text-sm text-teal-500 hover:text-teal-400 flex items-center gap-1 transition-colors"
            >
                <ChevronUp className="w-4 h-4" />
                العودة للمقدمة
            </button>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-red-500 dark:text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                            🔐 أكواد التأسيس (Core Config Template)
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-white/60">
                            قوالب الـ Rules و الـ Indexes للمشاريع الجديدة
                        </p>
                    </div>
                </div>
                
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white shadow-lg shadow-teal-500/20 disabled:opacity-50 transition-all"
                >
                    {saving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    حفظ التغييرات
                </button>
            </div>

            {/* Info Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1">
                            ⚠️ تنبيه هام للأمان
                        </p>
                        <p className="text-xs text-slate-700 dark:text-white/70 leading-relaxed">
                            هذه الصفحة مخفية وتظهر فقط للمالك (Super Admin). القوالب هنا ستُستخدم عند إنشاء مدير جديد لديه مشروع Firebase خاص. 
                            تأكد من مراجعة الـ Rules والـ Indexes قبل الحفظ.
                        </p>
                    </div>
                </div>
            </div>

            {/* Firestore Rules Section */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10" style={{ background: 'var(--theme-bg-secondary)' }}>
                <button
                    onClick={() => setExpandedSection(expandedSection === 'rules' ? null : 'rules')}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="text-right">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                1️⃣ Firestore Security Rules
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-white/50">
                                قواعد الأمان والصلاحيات
                            </p>
                        </div>
                    </div>
                    {expandedSection === 'rules' ? (
                        <ChevronUp className="w-5 h-5 text-slate-500 dark:text-white/60" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-500 dark:text-white/60" />
                    )}
                </button>
                
                {expandedSection === 'rules' && (
                    <div className="p-4 pt-0 space-y-3">
                        {/* Instructions */}
                        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                            <p className="text-[11px] text-slate-700 dark:text-white/70 leading-relaxed">
                                📍 <strong className="text-teal-600 dark:text-teal-400">الاستخدام:</strong> انسخ هذا الكود وارفعه في Firebase Console → Firestore → Rules
                            </p>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleCopy('rules')}
                                className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-700 dark:text-white transition-colors"
                            >
                                {copied === 'rules' ? (
                                    <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                )}
                                {copied === 'rules' ? 'تم النسخ!' : 'نسخ'}
                            </button>
                            <button
                                onClick={() => downloadAsFile('rules')}
                                className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-700 dark:text-white transition-colors"
                            >
                                <Download className="w-3.5 h-3.5" />
                                تحميل
                            </button>
                            <button
                                onClick={() => handleResetToDefault('rules')}
                                className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 text-amber-700 dark:text-amber-400 transition-colors mr-auto"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                استعادة الافتراضي
                            </button>
                        </div>
                        
                        {/* Code Editor - Theme Aware */}
                        <textarea
                            value={config.firestoreRules}
                            onChange={(e) => setConfig(prev => ({ ...prev, firestoreRules: e.target.value }))}
                            rows={20}
                            className="w-full px-4 py-3 rounded-xl text-xs font-mono 
                                       bg-slate-900 dark:bg-slate-950 
                                       border border-slate-300 dark:border-white/10 
                                       text-emerald-400 dark:text-green-400 
                                       placeholder-slate-500 dark:placeholder-white/30 
                                       focus:outline-none focus:border-teal-500 dark:focus:border-teal-400 
                                       focus:ring-2 focus:ring-teal-500/20
                                       resize-none shadow-inner"
                            dir="ltr"
                            spellCheck={false}
                        />
                    </div>
                )}
            </div>

            {/* Firestore Indexes Section */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10" style={{ background: 'var(--theme-bg-secondary)' }}>
                <button
                    onClick={() => setExpandedSection(expandedSection === 'indexes' ? null : 'indexes')}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                            <Database className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div className="text-right">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                2️⃣ Firestore Indexes
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-white/50">
                                الفهارس المركبة لتسريع الاستعلامات
                            </p>
                        </div>
                    </div>
                    {expandedSection === 'indexes' ? (
                        <ChevronUp className="w-5 h-5 text-slate-500 dark:text-white/60" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-500 dark:text-white/60" />
                    )}
                </button>
                
                {expandedSection === 'indexes' && (
                    <div className="p-4 pt-0 space-y-3">
                        {/* Instructions */}
                        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                            <p className="text-[11px] text-slate-700 dark:text-white/70 leading-relaxed">
                                📍 <strong className="text-teal-600 dark:text-teal-400">الاستخدام:</strong> انسخ هذا الـ JSON وارفعه باستخدام Firebase CLI:
                                <code className="block mt-1 px-2 py-1 bg-slate-800 dark:bg-black/30 rounded text-cyan-400">
                                    firebase deploy --only firestore:indexes
                                </code>
                            </p>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleCopy('indexes')}
                                className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-700 dark:text-white transition-colors"
                            >
                                {copied === 'indexes' ? (
                                    <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                )}
                                {copied === 'indexes' ? 'تم النسخ!' : 'نسخ'}
                            </button>
                            <button
                                onClick={() => downloadAsFile('indexes')}
                                className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-700 dark:text-white transition-colors"
                            >
                                <Download className="w-3.5 h-3.5" />
                                تحميل firestore.indexes.json
                            </button>
                            <button
                                onClick={() => handleResetToDefault('indexes')}
                                className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 text-amber-700 dark:text-amber-400 transition-colors mr-auto"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                استعادة الافتراضي
                            </button>
                        </div>
                        
                        {/* Code Editor - Theme Aware */}
                        <textarea
                            value={config.firestoreIndexes}
                            onChange={(e) => setConfig(prev => ({ ...prev, firestoreIndexes: e.target.value }))}
                            rows={20}
                            className="w-full px-4 py-3 rounded-xl text-xs font-mono 
                                       bg-slate-900 dark:bg-slate-950 
                                       border border-slate-300 dark:border-white/10 
                                       text-sky-400 dark:text-cyan-400 
                                       placeholder-slate-500 dark:placeholder-white/30 
                                       focus:outline-none focus:border-teal-500 dark:focus:border-teal-400 
                                       focus:ring-2 focus:ring-teal-500/20
                                       resize-none shadow-inner"
                            dir="ltr"
                            spellCheck={false}
                        />
                    </div>
                )}
            </div>

            {/* Last Updated Info */}
            {config.updatedAt && (
                <div className="text-center text-xs text-slate-500 dark:text-white/40">
                    آخر تحديث: {config.updatedAt?.toDate?.()?.toLocaleString('ar-SA') || 'غير معروف'}
                    {config.updatedBy && ` بواسطة ${config.updatedBy}`}
                </div>
            )}
        </div>
    );
};

export default CoreConfigTemplate;
