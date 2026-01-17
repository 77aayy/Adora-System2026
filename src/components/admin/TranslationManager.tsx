/**
 * Translation Manager Component
 * Manages dynamic translations with auto-sync
 * Adora Hotel Management System V3 - SaaS
 */

import React, { useState, useEffect } from 'react';
import {
    Languages,
    RefreshCw,
    Check,
    X,
    Clock,
    AlertTriangle,
    Upload,
    Download,
    Search,
    Edit3,
    Save,
    Globe,
    Sparkles,
    Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import {
    getFirebaseTranslations,
    saveTranslation,
    runWeeklySync,
    translateText,
    TranslationEntry,
    Language,
} from '../../services/dynamicTranslationService';

// ============================================================
// TYPES
// ============================================================

interface TranslationRow extends TranslationEntry {
    isEditing?: boolean;
    editValues?: Partial<Record<Language, string>>;
}

// ============================================================
// COMPONENT
// ============================================================

interface TranslationManagerProps {
    isOpen?: boolean;
    onClose?: () => void;
    standalone?: boolean; // For use as a full page
}

const TranslationManager: React.FC<TranslationManagerProps> = ({
    isOpen = true, // Default to open for standalone mode
    standalone = false,
    onClose,
}) => {
    const { t } = useTranslation();
    const { tenantId } = useAuth();
    const { success, error: showError, haptic } = useUX();
    
    const [translations, setTranslations] = useState<TranslationRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'verified'>('all');
    const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
    
    // Stats
    const totalCount = translations.length;
    const pendingCount = translations.filter(t => !t.verified).length;
    const verifiedCount = translations.filter(t => t.verified).length;
    
    // Load translations
    useEffect(() => {
        if (!isOpen || !tenantId) return;
        loadTranslations();
    }, [isOpen, tenantId]);
    
    const loadTranslations = async () => {
        if (!tenantId) return;
        
        setIsLoading(true);
        try {
            const data = await getFirebaseTranslations(tenantId);
            setTranslations(Object.values(data));
        } catch (err) {
            console.error('Error loading translations:', err);
        }
        setIsLoading(false);
    };
    
    // Filter translations
    const filteredTranslations = translations.filter(t => {
        // Status filter
        if (filterStatus === 'pending' && t.verified) return false;
        if (filterStatus === 'verified' && !t.verified) return false;
        
        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            return (
                t.key.toLowerCase().includes(search) ||
                t.ar?.toLowerCase().includes(search) ||
                t.en?.toLowerCase().includes(search) ||
                t.hi?.toLowerCase().includes(search) ||
                t.bn?.toLowerCase().includes(search)
            );
        }
        
        return true;
    });
    
    // Run sync
    const handleSync = async () => {
        if (!tenantId) return;
        
        setIsSyncing(true);
        haptic('medium');
        
        try {
            const result = await runWeeklySync(tenantId);
            success(`تم مزامنة ${result.translated} ترجمة بنجاح`);
            await loadTranslations();
        } catch (err) {
            showError('فشل في المزامنة');
        }
        
        setIsSyncing(false);
    };
    
    // Edit translation
    const handleEdit = (key: string) => {
        setTranslations(prev =>
            prev.map(t =>
                t.key === key
                    ? { ...t, isEditing: true, editValues: { ar: t.ar, en: t.en || '', hi: t.hi || '', bn: t.bn || '' } }
                    : t
            )
        );
    };
    
    // Save edit
    const handleSave = async (row: TranslationRow) => {
        if (!tenantId || !row.editValues) return;
        
        try {
            await saveTranslation(tenantId, row.key, row.editValues, 'manual');
            
            setTranslations(prev =>
                prev.map(t =>
                    t.key === row.key
                        ? {
                            ...t,
                            ...row.editValues,
                            isEditing: false,
                            verified: true,
                            editValues: undefined,
                        }
                        : t
                )
            );
            
            success('تم حفظ الترجمة');
            haptic('success');
        } catch (err) {
            showError('فشل في الحفظ');
        }
    };
    
    // Cancel edit
    const handleCancel = (key: string) => {
        setTranslations(prev =>
            prev.map(t =>
                t.key === key ? { ...t, isEditing: false, editValues: undefined } : t
            )
        );
    };
    
    // Auto-translate single field
    const handleAutoTranslate = async (row: TranslationRow, targetLang: Language) => {
        if (!row.ar) {
            showError('لا يوجد نص عربي للترجمة');
            return;
        }
        
        haptic('light');
        const result = await translateText(row.ar, 'ar', targetLang);
        
        if (result.translation) {
            setTranslations(prev =>
                prev.map(t =>
                    t.key === row.key
                        ? {
                            ...t,
                            editValues: {
                                ...t.editValues,
                                [targetLang]: result.translation,
                            },
                        }
                        : t
                )
            );
            success(`تمت الترجمة عبر ${result.source}`);
        } else {
            showError('فشلت الترجمة التلقائية');
        }
    };
    
    // Export translations
    const handleExport = () => {
        const exportData = {
            ar: {} as Record<string, string>,
            en: {} as Record<string, string>,
            hi: {} as Record<string, string>,
            bn: {} as Record<string, string>,
        };
        
        translations.forEach(t => {
            if (t.ar) exportData.ar[t.key] = t.ar;
            if (t.en) exportData.en[t.key] = t.en;
            if (t.hi) exportData.hi[t.key] = t.hi;
            if (t.bn) exportData.bn[t.key] = t.bn;
        });
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `translations_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        success('تم تصدير الترجمات');
    };
    
    if (!isOpen) return null;
    
    // Wrapper for modal vs standalone
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        if (standalone) {
            return <div className="p-4 animate-fade-in">{children}</div>;
        }
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                {children}
            </div>
        );
    };
    
    return (
        <Wrapper>
            <div className={`bg-white dark:bg-slate-800 rounded-2xl w-full ${standalone ? '' : 'max-w-6xl max-h-[90vh]'} overflow-hidden shadow-2xl`}>
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-teal-500 to-cyan-500">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <Languages className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">🌍 مدير الترجمات الديناميكية</h2>
                                <p className="text-white/70 text-sm">مراجعة وتعديل الترجمات التلقائية</p>
                            </div>
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="bg-white/10 rounded-xl p-3 text-center">
                            <div className="text-2xl font-bold text-white">{totalCount}</div>
                            <div className="text-xs text-white/70">إجمالي الترجمات</div>
                        </div>
                        <div className="bg-white/10 rounded-xl p-3 text-center">
                            <div className="text-2xl font-bold text-green-300">{verifiedCount}</div>
                            <div className="text-xs text-white/70">مُراجَعة</div>
                        </div>
                        <div className="bg-white/10 rounded-xl p-3 text-center">
                            <div className="text-2xl font-bold text-yellow-300">{pendingCount}</div>
                            <div className="text-xs text-white/70">بانتظار المراجعة</div>
                        </div>
                    </div>
                </div>
                
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="بحث في الترجمات..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                        />
                    </div>
                    
                    {/* Filter */}
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value as any)}
                        className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                    >
                        <option value="all">الكل</option>
                        <option value="pending">بانتظار المراجعة</option>
                        <option value="verified">مُراجَعة</option>
                    </select>
                    
                    {/* Actions */}
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="px-4 py-2 rounded-lg bg-slate-400 text-white flex items-center gap-2 hover:bg-slate-500 disabled:opacity-50 transition-colors text-sm"
                        title="مزامنة الترجمات القديمة (الترجمة التلقائية مفعلة للنصوص الجديدة)"
                    >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">مزامنة قديمة</span>
                    </button>
                    
                    <button
                        onClick={handleExport}
                        className="px-4 py-2 rounded-lg bg-teal-500 text-white flex items-center gap-2 hover:bg-teal-600 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        تصدير
                    </button>
                </div>
                
                {/* Table */}
                <div className="overflow-auto max-h-[50vh]">
                    {isLoading ? (
                        <div className="p-8 text-center">
                            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-teal-500" />
                            <p className="mt-2 text-slate-500">جاري التحميل...</p>
                        </div>
                    ) : filteredTranslations.length === 0 ? (
                        <div className="p-8 text-center">
                            <Globe className="w-12 h-12 mx-auto text-slate-300" />
                            <p className="mt-2 text-slate-500">لا توجد ترجمات</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">المفتاح</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">🇸🇦 عربي</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">🇬🇧 English</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">🇮🇳 हिंदी</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">🇧🇩 বাংলা</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">الحالة</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {filteredTranslations.map(row => (
                                    <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 font-mono text-xs">
                                            {row.key.substring(0, 20)}...
                                        </td>
                                        
                                        {/* Arabic */}
                                        <td className="px-4 py-3">
                                            {row.isEditing ? (
                                                <input
                                                    type="text"
                                                    value={row.editValues?.ar || ''}
                                                    onChange={e =>
                                                        setTranslations(prev =>
                                                            prev.map(t =>
                                                                t.key === row.key
                                                                    ? { ...t, editValues: { ...t.editValues, ar: e.target.value } }
                                                                    : t
                                                            )
                                                        )
                                                    }
                                                    className="w-full px-2 py-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                                                    dir="rtl"
                                                />
                                            ) : (
                                                <span className="text-sm text-slate-800 dark:text-white">{row.ar || '-'}</span>
                                            )}
                                        </td>
                                        
                                        {/* English */}
                                        <td className="px-4 py-3">
                                            {row.isEditing ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="text"
                                                        value={row.editValues?.en || ''}
                                                        onChange={e =>
                                                            setTranslations(prev =>
                                                                prev.map(t =>
                                                                    t.key === row.key
                                                                        ? { ...t, editValues: { ...t.editValues, en: e.target.value } }
                                                                        : t
                                                                )
                                                            )
                                                        }
                                                        className="flex-1 px-2 py-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                                                        dir="ltr"
                                                    />
                                                    <button
                                                        onClick={() => handleAutoTranslate(row, 'en')}
                                                        className="p-1 text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded"
                                                        title="ترجمة تلقائية"
                                                    >
                                                        <Sparkles className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={`text-sm ${row.en ? 'text-slate-800 dark:text-white' : 'text-red-400'}`}>
                                                    {row.en || '⚠️'}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* Hindi */}
                                        <td className="px-4 py-3">
                                            {row.isEditing ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="text"
                                                        value={row.editValues?.hi || ''}
                                                        onChange={e =>
                                                            setTranslations(prev =>
                                                                prev.map(t =>
                                                                    t.key === row.key
                                                                        ? { ...t, editValues: { ...t.editValues, hi: e.target.value } }
                                                                        : t
                                                                )
                                                            )
                                                        }
                                                        className="flex-1 px-2 py-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                                                    />
                                                    <button
                                                        onClick={() => handleAutoTranslate(row, 'hi')}
                                                        className="p-1 text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded"
                                                    >
                                                        <Sparkles className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={`text-sm ${row.hi ? 'text-slate-800 dark:text-white' : 'text-red-400'}`}>
                                                    {row.hi || '⚠️'}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* Bengali */}
                                        <td className="px-4 py-3">
                                            {row.isEditing ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="text"
                                                        value={row.editValues?.bn || ''}
                                                        onChange={e =>
                                                            setTranslations(prev =>
                                                                prev.map(t =>
                                                                    t.key === row.key
                                                                        ? { ...t, editValues: { ...t.editValues, bn: e.target.value } }
                                                                        : t
                                                                )
                                                            )
                                                        }
                                                        className="flex-1 px-2 py-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                                                    />
                                                    <button
                                                        onClick={() => handleAutoTranslate(row, 'bn')}
                                                        className="p-1 text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded"
                                                    >
                                                        <Sparkles className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={`text-sm ${row.bn ? 'text-slate-800 dark:text-white' : 'text-red-400'}`}>
                                                    {row.bn || '⚠️'}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* Status */}
                                        <td className="px-4 py-3">
                                            {row.verified ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs">
                                                    <Check className="w-3 h-3" />
                                                    مُراجَع
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 text-xs">
                                                    <Clock className="w-3 h-3" />
                                                    تلقائي
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* Actions */}
                                        <td className="px-4 py-3">
                                            {row.isEditing ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleSave(row)}
                                                        className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancel(row.key)}
                                                        className="p-1.5 rounded-lg bg-slate-500 text-white hover:bg-slate-600"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleEdit(row.key)}
                                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-center text-sm text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-green-500" />
                            <span className="font-semibold text-green-600 dark:text-green-400">✅ الترجمة التلقائية مفعلة للنصوص الجديدة</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span>الترجمة التلقائية عبر: MyMemory API (مجاني) + Lingva (Google Mirror) + LibreTranslate</span>
                        </div>
                    </div>
                </div>
            </div>
        </Wrapper>
    );
};

export { TranslationManager };
export default TranslationManager;
