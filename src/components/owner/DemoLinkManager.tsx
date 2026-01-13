/**
 * Demo Link Manager - V2 (Simplified)
 * ====================================
 * نفس نافذة إنشاء المشترك لكن للديمو
 * - بدون دفع أو فواتير
 * - Firebase منفصل للديمو
 * - رابط تجريبي مع رقم واتس للمبيعات
 * 
 * @author Adora System
 * @version 2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Plus, X, Copy, Trash2, Pause, Play, ExternalLink, Loader2,
    Users, Building, Building2, Shield, ChevronRight, Save,
    CheckCircle, AlertTriangle, MessageSquare, Phone, Clock,
    Link as LinkIcon, Share2, Sparkles, Calendar, Eraser
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { testFirebaseConnection, FirebaseConfig } from '../../services/firebaseMulti';
import { formatDualDate } from '../../utils/dateUtils';
import { isPinAvailable } from '../../services/ownerService';
import { 
    createDemoLink, getDemoLinks, updateDemoLink, deleteDemoLink,
    DemoLinkConfig
} from '../../services/demoLinkService';

// ============================================================
// TYPES & INTERFACES
// ============================================================

interface DemoLinkManagerProps {
    tenantId: string;
    ownerId: string;
    ownerName: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const EXPIRY_OPTIONS = [
    { value: 24, label: '24 ساعة' },
    { value: 72, label: '3 أيام' },
    { value: 168, label: 'أسبوع' },
    { value: 720, label: 'شهر' },
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export const DemoLinkManager: React.FC<DemoLinkManagerProps> = ({
    tenantId,
    ownerId,
    ownerName
}) => {
    const { success, error } = useUX();
    const { user, authReady } = useAuth();
    
    // ============ State ============
    const [links, setLinks] = useState<DemoLinkConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    
    // ============ Load Links ============
    const loadLinks = useCallback(async () => {
        try {
            const data = await getDemoLinks(tenantId);
            setLinks(data.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
        } catch (err) {
            error('فشل تحميل روابط الديمو');
        } finally {
            setLoading(false);
        }
    }, [tenantId, error]);
    
    useEffect(() => {
        loadLinks();
    }, [loadLinks]);
    
    // ============ Handlers ============
    const handleCopyLink = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            success('تم نسخ الرابط');
        } catch {
            error('فشل نسخ الرابط');
        }
    };
    
    const handleTogglePause = async (link: DemoLinkConfig) => {
        try {
            await updateDemoLink(link.id, { isPaused: !link.isPaused });
            setLinks(prev => prev.map(l => 
                l.id === link.id ? { ...l, isPaused: !l.isPaused } : l
            ));
            success(link.isPaused ? 'تم تفعيل الرابط' : 'تم إيقاف الرابط مؤقتاً');
        } catch {
            error('فشل تحديث الرابط');
        }
    };
    
    const [deleting, setDeleting] = useState<string | null>(null);
    
    const handleDeleteLink = async (linkId: string, linkCode: string) => {
        const link = links.find(l => l.id === linkId);
        const hasSandbox = link?.isSandboxMode && link?.demoFirebaseConfig;
        
        const confirmMsg = hasSandbox
            ? `⚠️ هل أنت متأكد من حذف "${link?.demoManager?.name || 'المشترك التجريبي'}"؟\n\n🗑️ سيتم مسح جميع البيانات من Firebase الديمو:\n- الفروع والغرف\n- الموظفين والمستخدمين\n- الطلبات والإشعارات\n\nهذا الإجراء لا يمكن التراجع عنه!`
            : 'هل أنت متأكد من حذف هذا الرابط؟';
        
        if (!confirm(confirmMsg)) return;
        
        setDeleting(linkId);
        
        try {
            const result = await deleteDemoLink(linkId, true);
            
            setLinks(prev => prev.filter(l => l.id !== linkId));
            
            if (result.sandboxWiped && result.wipedData) {
                const total = Object.values(result.wipedData).reduce((a: number, b: number) => a + b, 0);
                success(`🗑️ تم الحذف! مُسحت ${total} سجل من Firebase الديمو`);
            } else {
                success('تم حذف الرابط ✓');
            }
        } catch (err) {
            error('فشل حذف الرابط');
        } finally {
            setDeleting(null);
        }
    };
    
    // ============ Render ============
    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Share2 className="w-6 h-6 text-teal-400" />
                        روابط الديمو
                    </h2>
                    <p className="text-white/60 mt-1">
                        أنشئ مشتركين تجريبيين لتجربة النظام
                    </p>
                </div>
                
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold rounded-xl hover:from-teal-400 hover:to-cyan-500 shadow-lg shadow-teal-500/25 transition-all"
                >
                    <Plus className="w-5 h-5" />
                    إنشاء مشترك تجريبي
                </button>
            </div>
            
            {/* 📊 إحصائيات الديمو فقط - هذه الأرقام مرتبطة بروابط الديمو فقط */}
            {links.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
                            <LinkIcon className="w-3.5 h-3.5" />
                            إجمالي الروابط
                        </div>
                        <p className="text-xl font-bold text-white">{links.length}</p>
                    </div>
                    <div className="bg-teal-500/10 rounded-xl p-3 border border-teal-500/20">
                        <div className="flex items-center gap-2 text-teal-400 text-xs mb-1">
                            <Play className="w-3.5 h-3.5" />
                            نشط
                        </div>
                        <p className="text-xl font-bold text-teal-400">
                            {links.filter(l => l.isActive && !l.isPaused).length}
                        </p>
                    </div>
                    <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
                        <div className="flex items-center gap-2 text-amber-400 text-xs mb-1">
                            <Pause className="w-3.5 h-3.5" />
                            متوقف
                        </div>
                        <p className="text-xl font-bold text-amber-400">
                            {links.filter(l => l.isPaused).length}
                        </p>
                    </div>
                    <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                        <div className="flex items-center gap-2 text-red-400 text-xs mb-1">
                            <Clock className="w-3.5 h-3.5" />
                            منتهي
                        </div>
                        <p className="text-xl font-bold text-red-400">
                            {links.filter(l => l.expiresAt && l.expiresAt.toDate() < new Date()).length}
                        </p>
                    </div>
                </div>
            )}
            
            {/* Links List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
                </div>
            ) : links.length === 0 ? (
                <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
                    <LinkIcon className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <p className="text-white/60 mb-4">لا توجد روابط ديمو بعد</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-teal-500/20 text-teal-400 rounded-xl hover:bg-teal-500/30 transition-colors"
                    >
                        أنشئ أول رابط
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {links.map(link => (
                        <DemoLinkCard 
                            key={link.id}
                            link={link}
                            isDeleting={deleting === link.id}
                            onCopy={() => handleCopyLink(link.linkUrl)}
                            onTogglePause={() => handleTogglePause(link)}
                            onDelete={() => handleDeleteLink(link.id, link.linkCode)}
                        />
                    ))}
                </div>
            )}
            
            {/* Create Modal - نفس نافذة إنشاء المشترك */}
            {showCreateModal && (
                <CreateDemoManagerModal
                    tenantId={tenantId}
                    ownerId={ownerId}
                    ownerName={ownerName}
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={(newLink) => {
                        setLinks(prev => [newLink, ...prev]);
                        setShowCreateModal(false);
                        success('تم إنشاء المشترك التجريبي بنجاح! 🎭');
                    }}
                />
            )}
        </div>
    );
};

// ============================================================
// DEMO LINK CARD
// ============================================================

const DemoLinkCard: React.FC<{
    link: DemoLinkConfig;
    isDeleting?: boolean;
    onCopy: () => void;
    onTogglePause: () => void;
    onDelete: () => void;
}> = ({ link, isDeleting, onCopy, onTogglePause, onDelete }) => {
    return (
        <div className={`rounded-2xl bg-white/5 border ${
            link.isPaused ? 'border-amber-500/30' : 
            link.isActive ? 'border-white/10' : 'border-red-500/30'
        } overflow-hidden transition-all`}>
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${
                        link.isPaused ? 'bg-amber-500/20' :
                        link.isActive ? 'bg-teal-500/20' : 'bg-red-500/20'
                    } flex items-center justify-center`}>
                        <LinkIcon className={`w-6 h-6 ${
                            link.isPaused ? 'text-amber-400' :
                            link.isActive ? 'text-teal-400' : 'text-red-400'
                        }`} />
                    </div>
                    
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-bold">
                                {link.demoManager?.name || 'مدير تجريبي'}
                            </span>
                            <code className="text-teal-400 font-mono text-sm bg-teal-500/10 px-2 py-0.5 rounded">
                                {link.demoManager?.code || link.linkCode}
                            </code>
                            {link.isPaused && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                                    متوقف
                                </span>
                            )}
                        </div>
                        <p className="text-white/50 text-sm">
                            {link.demoManager?.branchName || 'فرع تجريبي'} • 
                            {link.expiresAt 
                                ? ` ينتهي ${formatDualDate(link.expiresAt.toDate(), { dateStyle: 'short' })}`
                                : ' بلا انتهاء'}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={onCopy}
                        className="p-2 text-white/50 hover:text-teal-400 transition-colors"
                        title="نسخ الرابط"
                    >
                        <Copy className="w-5 h-5" />
                    </button>
                    
                    <button
                        onClick={() => window.open(link.linkUrl, '_blank')}
                        className="p-2 text-white/50 hover:text-blue-400 transition-colors"
                        title="فتح الرابط"
                    >
                        <ExternalLink className="w-5 h-5" />
                    </button>
                    
                    <button
                        onClick={onTogglePause}
                        className={`p-2 ${link.isPaused ? 'text-green-400' : 'text-amber-400'} hover:opacity-80 transition-colors`}
                        title={link.isPaused ? 'تفعيل' : 'إيقاف'}
                    >
                        {link.isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                    </button>
                    
                    <button
                        onClick={onDelete}
                        disabled={isDeleting}
                        className={`p-2 transition-colors ${
                            isDeleting 
                                ? 'text-red-400 animate-pulse cursor-wait' 
                                : 'text-white/50 hover:text-red-400'
                        }`}
                        title={isDeleting ? 'جاري حذف البيانات...' : 'حذف'}
                    >
                        {isDeleting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Trash2 className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>
            
            {/* Link URL */}
            <div className="px-4 pb-4">
                <div className="p-3 rounded-xl bg-black/30 flex items-center justify-between">
                    <code className="text-teal-400 text-sm break-all" dir="ltr">{link.linkUrl}</code>
                    <button
                        onClick={onCopy}
                        className="ml-2 p-2 text-white/50 hover:text-white transition-colors flex-shrink-0"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// CREATE DEMO MANAGER MODAL (نفس نافذة إنشاء المشترك)
// ============================================================

const CreateDemoManagerModal: React.FC<{
    tenantId: string;
    ownerId: string;
    ownerName: string;
    onClose: () => void;
    onSuccess: (link: DemoLinkConfig) => void;
}> = ({ tenantId, ownerId, ownerName, onClose, onSuccess }) => {
    const { user, authReady } = useAuth();
    const { success: showSuccess, error: showError } = useUX();
    
    // ============ Wizard State ============
    const [currentStep, setCurrentStep] = useState(1);
    const TOTAL_STEPS = 4;
    
    // ============ Step 1: Basic Info ============
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [hotelName, setHotelName] = useState('');
    
    // ============ Step 2: Branches ============
    const [branchCodes, setBranchCodes] = useState<Array<{ code: string; name: string }>>([]);
    const [currentBranchCode, setCurrentBranchCode] = useState('');
    const [currentBranchName, setCurrentBranchName] = useState('');
    
    // ============ Step 3: Demo Settings (بدلاً من الدفع) ============
    const [validForHours, setValidForHours] = useState(168); // أسبوع
    const [salesWhatsApp, setSalesWhatsApp] = useState('');
    
    // ============ Firebase Config ============
    const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig>({
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: ''
    });
    const [firebaseTestPassed, setFirebaseTestPassed] = useState(false);
    const [testingFirebase, setTestingFirebase] = useState(false);
    
    // ============ General State ============
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [conflictingCodes, setConflictingCodes] = useState<Set<string>>(new Set());
    const [checkingCodes, setCheckingCodes] = useState(false);
    
    // ============ Step Titles ============
    const stepTitles = {
        1: 'البيانات الأساسية',
        2: 'الفروع',
        3: 'إعدادات الديمو',
        4: 'المراجعة والحفظ'
    };
    
    // ============ Validation ============
    const canGoNext = () => {
        switch (currentStep) {
            case 1:
                return name.trim().length >= 2 && code.length === 4 && /^\d+$/.test(code);
            case 2:
                return branchCodes.length > 0;
            case 3:
                return firebaseConfig.apiKey && firebaseConfig.projectId && firebaseTestPassed;
            case 4:
                return true;
            default:
                return false;
        }
    };
    
    const handleNext = () => {
        if (currentStep < TOTAL_STEPS && canGoNext()) {
            setError('');
            setCurrentStep(prev => prev + 1);
        }
    };
    
    const handleBack = () => {
        if (currentStep > 1) {
            setError('');
            setCurrentStep(prev => prev - 1);
        }
    };
    
    // ============ Code Handlers ============
    const handleCodeChange = async (newCode: string) => {
        setCode(newCode);
        setError('');
        // للديمو: لا نتحقق من الأكواد في Firebase الأساسي
        // لأن الأكواد ستكون في Firebase منفصل
    };
    
    const handleAddBranch = () => {
        if (!currentBranchCode.trim() || !currentBranchName.trim()) return;
        
        const bCode = currentBranchCode.trim();
        
        if (!/^[1-9]\d{0,3}$/.test(bCode)) {
            setError('كود الفرع يجب أن يكون من 1 إلى 4 أرقام');
            return;
        }
        if (branchCodes.some(b => b.code === bCode)) {
            setError('كود الفرع موجود بالفعل');
            return;
        }
        if (bCode === code) {
            setError('كود الفرع يجب أن يختلف عن كود المدير');
            return;
        }
        
        setBranchCodes([...branchCodes, { code: bCode, name: currentBranchName.trim() }]);
        setCurrentBranchCode('');
        setCurrentBranchName('');
        setError('');
    };
    
    const handleRemoveBranch = (codeToRemove: string) => {
        setBranchCodes(branchCodes.filter(c => c.code !== codeToRemove));
    };
    
    // ============ Firebase Test ============
    const handleTestFirebase = async () => {
        if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
            setError('يرجى إدخال بيانات Firebase');
            return;
        }
        
        setTestingFirebase(true);
        setError('');
        
        try {
            const result = await testFirebaseConnection(firebaseConfig);
            if (result.success) {
                setFirebaseTestPassed(true);
                showSuccess(`✅ اتصال ناجح بـ ${result.projectId}`);
            } else {
                setFirebaseTestPassed(false);
                setError(result.error || 'فشل الاتصال');
            }
        } catch (err: any) {
            setFirebaseTestPassed(false);
            setError(err.message);
        } finally {
            setTestingFirebase(false);
        }
    };
    
    // ============ Firebase Config Paste ============
    const handleFirebaseConfigPaste = (text: string) => {
        try {
            const apiKeyMatch = text.match(/apiKey:\s*["']([^"']+)["']/);
            const authDomainMatch = text.match(/authDomain:\s*["']([^"']+)["']/);
            const projectIdMatch = text.match(/projectId:\s*["']([^"']+)["']/);
            const storageBucketMatch = text.match(/storageBucket:\s*["']([^"']+)["']/);
            const messagingSenderIdMatch = text.match(/messagingSenderId:\s*["']([^"']+)["']/);
            const appIdMatch = text.match(/appId:\s*["']([^"']+)["']/);
            
            if (apiKeyMatch || projectIdMatch) {
                setFirebaseConfig({
                    apiKey: apiKeyMatch?.[1] || '',
                    authDomain: authDomainMatch?.[1] || '',
                    projectId: projectIdMatch?.[1] || '',
                    storageBucket: storageBucketMatch?.[1] || '',
                    messagingSenderId: messagingSenderIdMatch?.[1] || '',
                    appId: appIdMatch?.[1] || '',
                });
                setFirebaseTestPassed(false);
                showSuccess('✅ تم استخراج بيانات Firebase');
            }
        } catch {
            // ignore
        }
    };
    
    // ============ Submit ============
    const handleSubmit = async () => {
        if (!firebaseTestPassed) {
            setError('يرجى اختبار اتصال Firebase أولاً');
            return;
        }
        
        setLoading(true);
        setError('');
        
        try {
            // إنشاء رابط الديمو مع بيانات المشترك التجريبي
            const newLink = await createDemoLink(
                { id: ownerId, name: ownerName },
                tenantId,
                {
                    validForHours,
                    maxUses: 100, // استخدام غير محدود تقريباً
                    isSandboxMode: true,
                    demoFirebaseConfig: firebaseConfig,
                    salesWhatsAppNumber: salesWhatsApp || undefined,
                    demoManager: {
                        name: name.trim() || 'مدير تجريبي',
                        code: code,
                        branchName: branchCodes[0]?.name || 'فرع تجريبي',
                    },
                    // بيانات إضافية
                    permissionLevel: 'full_access',
                    allowedScopes: ['all'],
                    canCreateRequests: true,
                    canManageEmployees: true,
                    canViewReports: true,
                    canAccessSettings: true,
                }
            );
            
            // نسخ الرابط
            await navigator.clipboard.writeText(newLink.linkUrl);
            showSuccess('تم نسخ الرابط للحافظة');
            
            onSuccess(newLink);
            
        } catch (err: any) {
            setError(err.message || 'حدث خطأ');
            showError(err.message || 'فشل إنشاء المشترك التجريبي');
        } finally {
            setLoading(false);
        }
    };
    
    // ============ Render ============
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-card relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden !p-0">
                
                {/* Header */}
                <div className="p-4 flex items-center justify-between border-b border-theme">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                إنشاء مشترك تجريبي
                            </h3>
                            <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                                {stepTitles[currentStep as keyof typeof stepTitles]}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors"
                        style={{ color: 'var(--theme-text-secondary)' }}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Step Progress */}
                <div className="px-4 py-3 flex gap-2 border-b border-theme">
                    {[1, 2, 3, 4].map((step) => (
                        <div key={step} className="flex-1">
                            <div className={`h-1.5 rounded-full mb-1 ${
                                step < currentStep ? 'bg-purple-500' : 
                                step === currentStep ? 'bg-pink-500' : 
                                'bg-gray-300 dark:bg-white/10'
                            }`} />
                            <span className="text-[9px] block text-center" style={{ 
                                color: step <= currentStep ? 'var(--theme-text-primary)' : 'var(--theme-text-disabled)' 
                            }}>
                                {step === 1 ? 'الأساسية' : step === 2 ? 'الفروع' : step === 3 ? 'الإعدادات' : 'المراجعة'}
                            </span>
                        </div>
                    ))}
                </div>
                
                {/* Step Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    
                    {/* ==================== STEP 1: Basic Info ==================== */}
                    {currentStep === 1 && (
                        <div className="space-y-4">
                            {/* Demo Badge */}
                            <div className="p-3 rounded-xl flex items-center gap-3 bg-purple-500/10 border border-purple-500/30">
                                <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0" />
                                <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                    هذا المشترك <strong>تجريبي</strong> - بدون دفع أو فواتير
                                </p>
                            </div>
                            
                            {/* Name */}
                            <div>
                                <label className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Users className="w-4 h-4 text-teal-500" />
                                    اسم المشترك التجريبي
                                    <span className="text-red-500">*</span>
                                </label>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    className="input" 
                                    placeholder="عميل تجريبي"
                                />
                            </div>
                            
                            {/* Phone (Optional for demo) */}
                            <div>
                                <label className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <MessageSquare className="w-4 h-4 text-green-500" />
                                    رقم الهاتف
                                    <span className="text-[10px]" style={{ color: 'var(--theme-text-disabled)' }}>(اختياري)</span>
                                </label>
                                <input 
                                    type="tel" 
                                    value={phone} 
                                    onChange={e => setPhone(e.target.value.replace(/[^0-9+]/g, ''))} 
                                    className="input text-left" 
                                    placeholder="05xxxxxxxx" 
                                    dir="ltr"
                                />
                            </div>
                            
                            {/* Manager Code */}
                            <div>
                                <label className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Shield className="w-4 h-4 text-yellow-500" />
                                    كود الدخول
                                    <span className="text-red-500">*</span>
                                    <span style={{ color: 'var(--theme-text-disabled)' }} className="text-[11px]">(4 أرقام)</span>
                                </label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={e => handleCodeChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                    className={`input text-center text-2xl font-mono tracking-[0.4em] ${
                                        code.length === 4 ? '!border-green-500 !bg-green-500/10' : ''
                                    }`}
                                    placeholder="• • • •"
                                    maxLength={4}
                                />
                            </div>
                            
                            {/* Hotel Name */}
                            <div>
                                <label className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Building className="w-4 h-4 text-purple-500" />
                                    اسم الفندق
                                </label>
                                <input 
                                    type="text" 
                                    value={hotelName} 
                                    onChange={e => setHotelName(e.target.value)} 
                                    className="input" 
                                    placeholder="فندق تجريبي"
                                />
                            </div>
                        </div>
                    )}
                    
                    {/* ==================== STEP 2: Branches ==================== */}
                    {currentStep === 2 && (
                        <div className="space-y-4">
                            {/* Info */}
                            <div className="p-3 rounded-xl flex items-center gap-3 bg-blue-500/10 border border-blue-500/30">
                                <Building className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                    أضف فروع الفندق التجريبي
                                </p>
                            </div>
                            
                            {/* Add Branch Form */}
                            <div className="glass rounded-xl p-4">
                                <label className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Plus className="w-4 h-4 text-teal-500" />
                                    إضافة فرع
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={currentBranchCode}
                                        onChange={e => {
                                            let val = e.target.value.replace(/\D/g, '');
                                            if (val.startsWith('0')) val = val.slice(1);
                                            if (val.length > 4) val = val.slice(0, 4);
                                            setCurrentBranchCode(val);
                                        }}
                                        maxLength={4}
                                        className="input w-20 text-center font-mono text-lg tracking-wider"
                                        placeholder="كود"
                                    />
                                    <input
                                        type="text"
                                        value={currentBranchName}
                                        onChange={e => setCurrentBranchName(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddBranch()}
                                        className="input flex-1"
                                        placeholder="اسم الفرع"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddBranch}
                                    disabled={!currentBranchCode.trim() || !currentBranchName.trim()}
                                    className="w-full mt-3 py-3 rounded-xl text-white font-bold disabled:opacity-40 transition-all flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600"
                                >
                                    <Plus className="w-5 h-5" />إضافة الفرع
                                </button>
                                
                                {error && error.includes('الفرع') && (
                                    <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                                        <p className="text-sm flex items-center gap-2 text-red-500">
                                            <AlertTriangle className="w-4 h-4" />{error}
                                        </p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Branch List */}
                            <div>
                                <label className="flex items-center justify-between text-sm mb-3" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <span className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-purple-500" />
                                        الفروع المضافة
                                    </span>
                                    {branchCodes.length > 0 && (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-500/20 text-teal-600">
                                            {branchCodes.length} فرع
                                        </span>
                                    )}
                                </label>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {branchCodes.length > 0 ? branchCodes.map((branch, idx) => (
                                        <div key={branch.code} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20">
                                            <div className="flex items-center gap-3">
                                                <span className="w-7 h-7 rounded-lg text-white text-sm flex items-center justify-center font-bold bg-teal-500">
                                                    {idx + 1}
                                                </span>
                                                <div>
                                                    <span className="text-sm font-medium block" style={{ color: 'var(--theme-text-primary)' }}>
                                                        {branch.name}
                                                    </span>
                                                    <span className="text-xs font-mono" style={{ color: 'var(--theme-text-disabled)' }}>
                                                        كود: {branch.code}
                                                    </span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveBranch(branch.code)} 
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )) : (
                                        <div className="text-center py-8 rounded-xl glass border-2 border-dashed">
                                            <Building className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--theme-text-disabled)' }} />
                                            <p className="text-sm" style={{ color: 'var(--theme-text-disabled)' }}>
                                                لا توجد فروع مضافة بعد
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* ==================== STEP 3: Demo Settings ==================== */}
                    {currentStep === 3 && (
                        <div className="space-y-4">
                            {/* Firebase Config */}
                            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                                <div className="flex items-center gap-2 mb-4">
                                    <Sparkles className="w-5 h-5 text-amber-400" />
                                    <h4 className="text-white font-bold">Firebase للديمو</h4>
                                    <span className="text-amber-400 text-xs bg-amber-500/20 px-2 py-0.5 rounded-full">مطلوب</span>
                                </div>
                                
                                <p className="text-white/50 text-sm mb-4">
                                    💡 الصق كود Firebase Config من مشروع الديمو
                                </p>
                                
                                {/* Paste Area */}
                                <textarea
                                    placeholder="الصق كود Firebase Config هنا..."
                                    className="w-full p-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-white/30 text-sm font-mono resize-none h-20"
                                    dir="ltr"
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        const text = e.clipboardData.getData('text');
                                        handleFirebaseConfigPaste(text);
                                    }}
                                />
                                
                                {/* Manual Fields */}
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <div>
                                        <label className="block text-white/60 text-xs mb-1">API Key *</label>
                                        <input
                                            type="text"
                                            value={firebaseConfig.apiKey}
                                            onChange={(e) => {
                                                setFirebaseConfig(prev => ({ ...prev, apiKey: e.target.value }));
                                                setFirebaseTestPassed(false);
                                            }}
                                            className="w-full p-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm font-mono"
                                            dir="ltr"
                                            placeholder="AIzaSy..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-white/60 text-xs mb-1">Project ID *</label>
                                        <input
                                            type="text"
                                            value={firebaseConfig.projectId}
                                            onChange={(e) => {
                                                setFirebaseConfig(prev => ({ ...prev, projectId: e.target.value }));
                                                setFirebaseTestPassed(false);
                                            }}
                                            className="w-full p-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm font-mono"
                                            dir="ltr"
                                            placeholder="my-project"
                                        />
                                    </div>
                                </div>
                                
                                {/* Test Button */}
                                <button
                                    type="button"
                                    onClick={handleTestFirebase}
                                    disabled={testingFirebase || !firebaseConfig.apiKey || !firebaseConfig.projectId}
                                    className={`mt-4 w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                                        firebaseTestPassed 
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                                    } disabled:opacity-50`}
                                >
                                    {testingFirebase ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : firebaseTestPassed ? (
                                        <><CheckCircle className="w-5 h-5" /> الاتصال ناجح ✓</>
                                    ) : (
                                        <><Sparkles className="w-5 h-5" /> اختبار الاتصال</>
                                    )}
                                </button>
                            </div>
                            
                            {/* Validity Duration */}
                            <div>
                                <label className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    مدة صلاحية الرابط
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {EXPIRY_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setValidForHours(opt.value)}
                                            className={`p-2 rounded-xl text-sm font-medium transition-all border ${
                                                validForHours === opt.value 
                                                    ? 'border-teal-500 bg-teal-500/10 text-teal-400' 
                                                    : 'border-white/10 text-white/60 hover:border-white/20'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Sales WhatsApp */}
                            <div>
                                <label className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Phone className="w-4 h-4 text-green-500" />
                                    رقم المبيعات (واتساب)
                                    <span className="text-[10px]" style={{ color: 'var(--theme-text-disabled)' }}>(اختياري)</span>
                                </label>
                                <input
                                    type="tel"
                                    value={salesWhatsApp}
                                    onChange={(e) => setSalesWhatsApp(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="input text-left"
                                    placeholder="966501234567"
                                    dir="ltr"
                                />
                                <p className="text-xs mt-1" style={{ color: 'var(--theme-text-disabled)' }}>
                                    💬 سيظهر للعميل زر "اشترك الآن" يحوله لهذا الرقم
                                </p>
                            </div>
                            
                            {error && !error.includes('الفرع') && (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                                    <p className="text-sm flex items-center gap-2 text-red-500">
                                        <AlertTriangle className="w-4 h-4" />{error}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* ==================== STEP 4: Review ==================== */}
                    {currentStep === 4 && (
                        <div className="space-y-3">
                            {/* Success Banner */}
                            <div className="p-3 rounded-xl flex items-center gap-3 bg-green-500/10 border border-green-500/30">
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                    راجع البيانات قبل <strong>إنشاء المشترك التجريبي</strong>
                                </p>
                            </div>
                            
                            {/* Summary */}
                            <div className="space-y-2">
                                {/* Basic Info */}
                                <div className="glass rounded-xl p-3">
                                    <h4 className="text-xs font-bold mb-2 flex items-center gap-2 text-teal-500">
                                        <Users className="w-3.5 h-3.5" />البيانات الأساسية
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-xs block" style={{ color: 'var(--theme-text-disabled)' }}>الاسم</span>
                                            <span style={{ color: 'var(--theme-text-primary)' }}>{name || 'مدير تجريبي'}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs block" style={{ color: 'var(--theme-text-disabled)' }}>كود الدخول</span>
                                            <span className="font-mono font-bold text-teal-500">{code}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Branches */}
                                <div className="glass rounded-xl p-3">
                                    <h4 className="text-xs font-bold mb-2 flex items-center gap-2 text-purple-500">
                                        <Building2 className="w-3.5 h-3.5" />الفروع ({branchCodes.length})
                                    </h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {branchCodes.map((b, i) => (
                                            <span key={b.code} className="px-2 py-1 rounded-lg text-xs bg-teal-500/10 text-teal-600 border border-teal-500/20">
                                                {i + 1}. {b.name} ({b.code})
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Demo Info */}
                                <div className="glass rounded-xl p-3 border-purple-500/30">
                                    <h4 className="text-xs font-bold mb-2 flex items-center gap-2 text-purple-500">
                                        <Sparkles className="w-3.5 h-3.5" />إعدادات الديمو
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-xs block" style={{ color: 'var(--theme-text-disabled)' }}>المدة</span>
                                            <span style={{ color: 'var(--theme-text-primary)' }}>
                                                {EXPIRY_OPTIONS.find(o => o.value === validForHours)?.label}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-xs block" style={{ color: 'var(--theme-text-disabled)' }}>Firebase</span>
                                            <span className="text-green-500 text-xs">✓ {firebaseConfig.projectId}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {error && (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                                    <p className="text-sm flex items-center gap-2 text-red-500">
                                        <AlertTriangle className="w-4 h-4" />{error}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-4 border-t border-theme">
                    <div className="flex gap-3">
                        {currentStep > 1 && (
                            <button 
                                type="button" 
                                onClick={handleBack} 
                                disabled={loading}
                                className="flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 glass border border-theme"
                                style={{ color: 'var(--theme-text-primary)' }}
                            >
                                <ChevronRight className="w-5 h-5 rotate-180" />رجوع
                            </button>
                        )}
                        {currentStep < TOTAL_STEPS ? (
                            <button 
                                type="button" 
                                onClick={handleNext} 
                                disabled={!canGoNext()}
                                className="flex-1 py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-all bg-purple-500 hover:bg-purple-600"
                            >
                                التالي<ChevronRight className="w-5 h-5" />
                            </button>
                        ) : (
                            <button 
                                onClick={handleSubmit} 
                                disabled={loading}
                                className="flex-1 py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <><Sparkles className="w-5 h-5" />إنشاء المشترك التجريبي</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DemoLinkManager;
