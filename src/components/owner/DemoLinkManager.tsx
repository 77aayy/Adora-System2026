/**
 * Demo Link Manager
 * Owner dashboard component for creating and managing demo links
 * Adora Hotel Management System V3 - SaaS
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Link as LinkIcon, Plus, Copy, Trash2, Pause, Play, 
    Eye, EyeOff, Clock, Users, Shield, BarChart3,
    CheckCircle, AlertTriangle, Settings, Share2, 
    RefreshCw, ExternalLink, ChevronDown, ChevronUp,
    Building2, Sparkles, Loader2, Calendar
} from 'lucide-react';
import { 
    createDemoLink, getDemoLinks, updateDemoLink, deleteDemoLink,
    getDemoAnalytics, DemoLinkConfig, DemoPermissionLevel, DemoScope
} from '../../services/demoLinkService';
import { useUX } from '../../context/UXContext';

// ============================================================
// TYPES
// ============================================================

interface DemoLinkManagerProps {
    tenantId: string;
    ownerId: string;
    ownerName: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const SCOPE_OPTIONS: { value: DemoScope; label: string; icon: any }[] = [
    { value: 'all', label: 'كل الأقسام', icon: Sparkles },
    { value: 'reception', label: 'الاستقبال', icon: Users },
    { value: 'housekeeping', label: 'النظافة', icon: Building2 },
    { value: 'bellman', label: 'البيلمان', icon: Users },
    { value: 'maintenance', label: 'الصيانة', icon: Settings },
    { value: 'admin', label: 'لوحة المدير', icon: BarChart3 },
    { value: 'owner', label: 'لوحة المالك', icon: Shield },
];

const PERMISSION_LEVELS: { value: DemoPermissionLevel; label: string; description: string }[] = [
    { value: 'viewer', label: 'مشاهد فقط', description: 'يمكنه رؤية كل شيء بدون تعديل' },
    { value: 'tester', label: 'مختبر', description: 'يمكنه إنشاء طلبات وهمية' },
    { value: 'full_access', label: 'صلاحيات كاملة', description: 'يمكنه الوصول لكل شيء' },
];

const EXPIRY_OPTIONS = [
    { value: 24, label: '24 ساعة' },
    { value: 72, label: '3 أيام' },
    { value: 168, label: 'أسبوع' },
    { value: 720, label: 'شهر' },
    { value: 0, label: 'بلا انتهاء' },
];

// ============================================================
// COMPONENT
// ============================================================

export const DemoLinkManager: React.FC<DemoLinkManagerProps> = ({
    tenantId,
    ownerId,
    ownerName
}) => {
    const { success, error } = useUX();
    
    // State
    const [links, setLinks] = useState<DemoLinkConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [expandedLink, setExpandedLink] = useState<string | null>(null);
    const [analytics, setAnalytics] = useState<any>(null);
    
    // Create form state
    const [permissionLevel, setPermissionLevel] = useState<DemoPermissionLevel>('tester');
    const [selectedScopes, setSelectedScopes] = useState<DemoScope[]>(['all']);
    const [canCreateRequests, setCanCreateRequests] = useState(true);
    const [canManageEmployees, setCanManageEmployees] = useState(false);
    const [canViewReports, setCanViewReports] = useState(true);
    const [canAccessSettings, setCanAccessSettings] = useState(false);
    const [includeTour, setIncludeTour] = useState(true);
    const [tourLanguage, setTourLanguage] = useState<'ar' | 'en'>('ar');
    const [maxUses, setMaxUses] = useState(10);
    const [validForHours, setValidForHours] = useState(72);
    const [multiLicense, setMultiLicense] = useState(false);
    const [licensesCount, setLicensesCount] = useState(1);
    const [branchesPerLicense, setBranchesPerLicense] = useState(1);
    
    // ============================================================
    // LOAD DATA
    // ============================================================
    
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
    
    const loadAnalytics = useCallback(async () => {
        try {
            const data = await getDemoAnalytics(tenantId);
            setAnalytics(data);
        } catch (err) {
            console.error('Error loading analytics:', err);
        }
    }, [tenantId]);
    
    useEffect(() => {
        loadLinks();
        loadAnalytics();
    }, [loadLinks, loadAnalytics]);
    
    // ============================================================
    // HANDLERS
    // ============================================================
    
    const handleCreateLink = async () => {
        setCreating(true);
        
        try {
            const newLink = await createDemoLink(
                { id: ownerId, name: ownerName },
                tenantId,
                {
                    permissionLevel,
                    allowedScopes: selectedScopes,
                    canCreateRequests,
                    canManageEmployees,
                    canViewReports,
                    canAccessSettings,
                    includeTour,
                    tourLanguage,
                    maxUses,
                    validForHours,
                    multiLicense,
                    licensesCount,
                    branchesPerLicense,
                }
            );
            
            setLinks(prev => [newLink, ...prev]);
            setShowCreateModal(false);
            success('تم إنشاء رابط الديمو بنجاح!');
            
            // Copy to clipboard
            await navigator.clipboard.writeText(newLink.linkUrl);
            success('تم نسخ الرابط للحافظة');
            
        } catch (err) {
            error('فشل إنشاء رابط الديمو');
        } finally {
            setCreating(false);
        }
    };
    
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
    
    const handleDeleteLink = async (linkId: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا الرابط؟')) return;
        
        try {
            await deleteDemoLink(linkId);
            setLinks(prev => prev.filter(l => l.id !== linkId));
            success('تم حذف الرابط');
        } catch {
            error('فشل حذف الرابط');
        }
    };
    
    const toggleScope = (scope: DemoScope) => {
        if (scope === 'all') {
            setSelectedScopes(['all']);
        } else {
            setSelectedScopes(prev => {
                const filtered = prev.filter(s => s !== 'all');
                if (filtered.includes(scope)) {
                    return filtered.filter(s => s !== scope);
                } else {
                    return [...filtered, scope];
                }
            });
        }
    };
    
    // ============================================================
    // RENDER
    // ============================================================
    
    return (
        <div className="space-y-6" dir="rtl">
            {/* Header with Analytics */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Share2 className="w-6 h-6 text-teal-400" />
                        روابط الديمو
                    </h2>
                    <p className="text-white/60 mt-1">
                        أنشئ روابط تجريبية لمشاركتها مع المشترين المحتملين
                    </p>
                </div>
                
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold rounded-xl hover:from-teal-400 hover:to-cyan-500 shadow-lg shadow-teal-500/25 transition-all"
                >
                    <Plus className="w-5 h-5" />
                    إنشاء رابط جديد
                </button>
            </div>
            
            {/* Analytics Cards */}
            {analytics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2 text-blue-400 mb-2">
                            <LinkIcon className="w-4 h-4" />
                            <span className="text-xs">إجمالي الروابط</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{analytics.totalLinks}</p>
                    </div>
                    
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2 text-green-400 mb-2">
                            <Users className="w-4 h-4" />
                            <span className="text-xs">الجلسات</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{analytics.totalSessions}</p>
                    </div>
                    
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2 text-purple-400 mb-2">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs">أكملوا الجولة</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{analytics.completedTours}</p>
                    </div>
                    
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2 text-cyan-400 mb-2">
                            <BarChart3 className="w-4 h-4" />
                            <span className="text-xs">معدل الإتمام</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{analytics.conversionRate}%</p>
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
                        <div 
                            key={link.id}
                            className={`rounded-2xl bg-white/5 border ${
                                link.isPaused ? 'border-amber-500/30' : 
                                link.isActive ? 'border-white/10' : 'border-red-500/30'
                            } overflow-hidden transition-all`}
                        >
                            {/* Link Header */}
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
                                        <div className="flex items-center gap-2">
                                            <code className="text-white font-mono text-lg">{link.linkCode}</code>
                                            {link.isPaused && (
                                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                                                    متوقف
                                                </span>
                                            )}
                                            {link.multiLicense && (
                                                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs">
                                                    {link.licensesCount} ترخيص
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-white/50 text-sm">
                                            {link.currentUses}/{link.maxUses || '∞'} استخدام • 
                                            {link.expiresAt 
                                                ? ` ينتهي ${link.expiresAt.toDate().toLocaleDateString('ar-SA')}`
                                                : ' بلا انتهاء'}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleCopyLink(link.linkUrl)}
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
                                        onClick={() => handleTogglePause(link)}
                                        className={`p-2 ${link.isPaused ? 'text-green-400' : 'text-amber-400'} hover:opacity-80 transition-colors`}
                                        title={link.isPaused ? 'تفعيل' : 'إيقاف'}
                                    >
                                        {link.isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                                    </button>
                                    
                                    <button
                                        onClick={() => handleDeleteLink(link.id)}
                                        className="p-2 text-white/50 hover:text-red-400 transition-colors"
                                        title="حذف"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                    
                                    <button
                                        onClick={() => setExpandedLink(expandedLink === link.id ? null : link.id)}
                                        className="p-2 text-white/50 hover:text-white transition-colors"
                                    >
                                        {expandedLink === link.id ? (
                                            <ChevronUp className="w-5 h-5" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            
                            {/* Expanded Details */}
                            {expandedLink === link.id && (
                                <div className="p-4 border-t border-white/10 bg-black/20">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                        <div>
                                            <p className="text-white/50 text-xs mb-1">مستوى الصلاحية</p>
                                            <p className="text-white font-medium">
                                                {link.permissionLevel === 'viewer' ? 'مشاهد' :
                                                 link.permissionLevel === 'tester' ? 'مختبر' : 'كامل'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-white/50 text-xs mb-1">الجولة التعريفية</p>
                                            <p className="text-white font-medium">
                                                {link.includeTour ? 'مفعلة' : 'معطلة'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-white/50 text-xs mb-1">تاريخ الإنشاء</p>
                                            <p className="text-white font-medium">
                                                {link.createdAt.toDate().toLocaleDateString('ar-SA')}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-white/50 text-xs mb-1">آخر استخدام</p>
                                            <p className="text-white font-medium">
                                                {link.lastUsedAt 
                                                    ? link.lastUsedAt.toDate().toLocaleDateString('ar-SA')
                                                    : 'لم يُستخدم بعد'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Permissions */}
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs ${
                                            link.canCreateRequests ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                        }`}>
                                            {link.canCreateRequests ? '✓' : '✗'} إنشاء طلبات
                                        </span>
                                        <span className={`px-3 py-1 rounded-full text-xs ${
                                            link.canManageEmployees ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                        }`}>
                                            {link.canManageEmployees ? '✓' : '✗'} إدارة الموظفين
                                        </span>
                                        <span className={`px-3 py-1 rounded-full text-xs ${
                                            link.canViewReports ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                        }`}>
                                            {link.canViewReports ? '✓' : '✗'} التقارير
                                        </span>
                                        <span className={`px-3 py-1 rounded-full text-xs ${
                                            link.canAccessSettings ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                        }`}>
                                            {link.canAccessSettings ? '✓' : '✗'} الإعدادات
                                        </span>
                                    </div>
                                    
                                    {/* Scopes */}
                                    <div className="mt-3">
                                        <p className="text-white/50 text-xs mb-2">الأقسام المتاحة:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {link.allowedScopes.map(scope => (
                                                <span 
                                                    key={scope}
                                                    className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-400 text-xs"
                                                >
                                                    {scope === 'all' ? 'الكل' :
                                                     scope === 'reception' ? 'الاستقبال' :
                                                     scope === 'housekeeping' ? 'النظافة' :
                                                     scope === 'bellman' ? 'البيلمان' :
                                                     scope === 'maintenance' ? 'الصيانة' :
                                                     scope === 'admin' ? 'المدير' :
                                                     scope === 'owner' ? 'المالك' : scope}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Full URL */}
                                    <div className="mt-4 p-3 rounded-xl bg-black/30 flex items-center justify-between">
                                        <code className="text-teal-400 text-sm break-all" dir="ltr">{link.linkUrl}</code>
                                        <button
                                            onClick={() => handleCopyLink(link.linkUrl)}
                                            className="ml-2 p-2 text-white/50 hover:text-white transition-colors flex-shrink-0"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            
            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* ✅ SOLID backdrop - no transparency */}
                    <div 
                        className="absolute inset-0 bg-black/90"
                        onClick={() => setShowCreateModal(false)}
                    />
                    
                    {/* ✅ SOLID modal background */}
                    <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-3xl shadow-2xl border border-white/10">
                        {/* Header - ✅ SOLID background */}
                        <div className="sticky top-0 z-10 p-6 border-b border-white/10 bg-slate-900">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Plus className="w-6 h-6 text-teal-400" />
                                إنشاء رابط ديمو جديد
                            </h3>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* Permission Level */}
                            <div>
                                <label className="block text-white font-medium mb-3">مستوى الصلاحية</label>
                                <div className="space-y-2">
                                    {PERMISSION_LEVELS.map(level => (
                                        <button
                                            key={level.value}
                                            onClick={() => setPermissionLevel(level.value)}
                                            className={`w-full p-4 rounded-xl text-right transition-all ${
                                                permissionLevel === level.value
                                                    ? 'bg-teal-500/20 border-2 border-teal-500'
                                                    : 'bg-white/5 border-2 border-transparent hover:border-white/20'
                                            }`}
                                        >
                                            <p className="text-white font-medium">{level.label}</p>
                                            <p className="text-white/50 text-sm">{level.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Scopes */}
                            <div>
                                <label className="block text-white font-medium mb-3">الأقسام المتاحة</label>
                                <div className="flex flex-wrap gap-2">
                                    {SCOPE_OPTIONS.map(scope => (
                                        <button
                                            key={scope.value}
                                            onClick={() => toggleScope(scope.value)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                                                selectedScopes.includes(scope.value)
                                                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500'
                                                    : 'bg-white/5 text-white/60 border border-transparent hover:border-white/20'
                                            }`}
                                        >
                                            <scope.icon className="w-4 h-4" />
                                            <span>{scope.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Detailed Permissions */}
                            <div>
                                <label className="block text-white font-medium mb-3">صلاحيات تفصيلية</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={canCreateRequests}
                                            onChange={(e) => setCanCreateRequests(e.target.checked)}
                                            className="w-5 h-5 rounded accent-teal-500"
                                        />
                                        <span className="text-white">إنشاء طلبات</span>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={canManageEmployees}
                                            onChange={(e) => setCanManageEmployees(e.target.checked)}
                                            className="w-5 h-5 rounded accent-teal-500"
                                        />
                                        <span className="text-white">إدارة الموظفين</span>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={canViewReports}
                                            onChange={(e) => setCanViewReports(e.target.checked)}
                                            className="w-5 h-5 rounded accent-teal-500"
                                        />
                                        <span className="text-white">عرض التقارير</span>
                                    </label>
                                    
                                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={canAccessSettings}
                                            onChange={(e) => setCanAccessSettings(e.target.checked)}
                                            className="w-5 h-5 rounded accent-teal-500"
                                        />
                                        <span className="text-white">الوصول للإعدادات</span>
                                    </label>
                                </div>
                            </div>
                            
                            {/* Tour Settings */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={includeTour}
                                            onChange={(e) => setIncludeTour(e.target.checked)}
                                            className="w-5 h-5 rounded accent-teal-500"
                                        />
                                        <span className="text-white">تضمين الجولة التعريفية</span>
                                    </label>
                                </div>
                                
                                {includeTour && (
                                    <div>
                                        <select
                                            value={tourLanguage}
                                            onChange={(e) => setTourLanguage(e.target.value as 'ar' | 'en')}
                                            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white"
                                        >
                                            <option value="ar">العربية</option>
                                            <option value="en">English</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            
                            {/* Limits */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-white/70 text-sm mb-2">الحد الأقصى للاستخدام</label>
                                    <input
                                        type="number"
                                        value={maxUses}
                                        onChange={(e) => setMaxUses(parseInt(e.target.value) || 0)}
                                        min={0}
                                        className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white"
                                        placeholder="0 = بلا حد"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-white/70 text-sm mb-2">مدة الصلاحية</label>
                                    <select
                                        value={validForHours}
                                        onChange={(e) => setValidForHours(parseInt(e.target.value))}
                                        className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white"
                                    >
                                        {EXPIRY_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            
                            {/* Multi-License */}
                            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={multiLicense}
                                        onChange={(e) => setMultiLicense(e.target.checked)}
                                        className="w-5 h-5 rounded accent-purple-500"
                                    />
                                    <div>
                                        <p className="text-white font-medium">عرض متعدد التراخيص</p>
                                        <p className="text-white/50 text-sm">محاكاة نظام بأكثر من ترخيص وفروع</p>
                                    </div>
                                </label>
                                
                                {multiLicense && (
                                    <div className="mt-4 grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-white/70 text-sm mb-2">عدد التراخيص</label>
                                            <input
                                                type="number"
                                                value={licensesCount}
                                                onChange={(e) => setLicensesCount(parseInt(e.target.value) || 1)}
                                                min={1}
                                                max={10}
                                                className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-white/70 text-sm mb-2">فروع لكل ترخيص</label>
                                            <input
                                                type="number"
                                                value={branchesPerLicense}
                                                onChange={(e) => setBranchesPerLicense(parseInt(e.target.value) || 1)}
                                                min={1}
                                                max={10}
                                                className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Actions - ✅ SOLID background */}
                        <div className="sticky bottom-0 p-6 border-t border-white/10 bg-slate-900 flex gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 py-3 px-4 rounded-xl bg-white/5 text-white/70 font-medium hover:bg-white/10 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleCreateLink}
                                disabled={creating}
                                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold flex items-center justify-center gap-2 hover:from-teal-400 hover:to-cyan-500 disabled:opacity-50 transition-all"
                            >
                                {creating ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Plus className="w-5 h-5" />
                                        إنشاء الرابط
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DemoLinkManager;
