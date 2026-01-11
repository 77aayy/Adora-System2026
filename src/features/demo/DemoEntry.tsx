/**
 * Demo Entry Page
 * Landing page for demo links - validates link and starts session
 * Adora Hotel Management System V3 - SaaS
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Play, Sparkles, Shield, Users, BarChart3, 
    Clock, CheckCircle, AlertTriangle, Loader2,
    ChevronRight, Building2, Zap, Globe, 
    Phone, Mail, ArrowRight
} from 'lucide-react';
import { 
    validateDemoLink, startDemoSession, saveDemoSessionLocally,
    DemoLinkConfig, DemoSession 
} from '../../services/demoLinkService';

// ============================================================
// FEATURES LIST
// ============================================================

const FEATURES = [
    { icon: Building2, title: 'إدارة الغرف', titleEn: 'Room Management', color: 'text-blue-400' },
    { icon: Users, title: 'إدارة الموظفين', titleEn: 'Staff Management', color: 'text-green-400' },
    { icon: Zap, title: 'طلبات فورية', titleEn: 'Instant Requests', color: 'text-yellow-400' },
    { icon: BarChart3, title: 'تقارير ذكية', titleEn: 'Smart Reports', color: 'text-purple-400' },
    { icon: Globe, title: 'نظام QR للنزلاء', titleEn: 'Guest QR System', color: 'text-cyan-400' },
    { icon: Shield, title: 'أمان متقدم', titleEn: 'Advanced Security', color: 'text-red-400' },
];

// ============================================================
// COMPONENT
// ============================================================

export const DemoEntry: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    
    // State
    const [loading, setLoading] = useState(true);
    const [validating, setValidating] = useState(true);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [link, setLink] = useState<DemoLinkConfig | null>(null);
    
    // User info form
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [userPhone, setUserPhone] = useState('');
    const [showForm, setShowForm] = useState(false);
    
    // ============================================================
    // VALIDATE LINK
    // ============================================================
    
    useEffect(() => {
        const validateLink = async () => {
            if (!code) {
                setError('رابط الديمو غير صحيح');
                setValidating(false);
                setLoading(false);
                return;
            }
            
            try {
                const result = await validateDemoLink(code);
                
                if (!result.valid) {
                    setError(result.error || 'رابط الديمو غير صالح');
                } else {
                    setLink(result.link!);
                }
            } catch (err) {
                setError('حدث خطأ أثناء التحقق من الرابط');
            } finally {
                setValidating(false);
                setLoading(false);
            }
        };
        
        validateLink();
    }, [code]);
    
    // ============================================================
    // START DEMO
    // ============================================================
    
    const handleStartDemo = async () => {
        if (!link) return;
        
        setStarting(true);
        
        try {
            const session = await startDemoSession(link.linkCode, {
                name: userName || undefined,
                email: userEmail || undefined,
                phone: userPhone || undefined,
            });
            
            if (session) {
                // Save session locally
                saveDemoSessionLocally(session);
                
                // Navigate to appropriate dashboard based on permissions
                const firstScope = link.allowedScopes[0] || 'reception';
                const routes: Record<string, string> = {
                    'all': '/reception',
                    'reception': '/reception',
                    'housekeeping': '/housekeeping',
                    'bellman': '/bellman',
                    'maintenance': '/maintenance',
                    'admin': '/admin',
                    'owner': '/owner-dashboard',
                };
                
                navigate(routes[firstScope] || '/reception', { 
                    state: { demoSession: session, showTour: link.includeTour }
                });
            } else {
                setError('فشل بدء جلسة الديمو. حاول مرة أخرى.');
            }
        } catch (err) {
            setError('حدث خطأ أثناء بدء الديمو');
        } finally {
            setStarting(false);
        }
    };
    
    // ============================================================
    // RENDER - LOADING
    // ============================================================
    
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center animate-pulse">
                        <Sparkles className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-white/60 text-lg">جاري التحقق من الرابط...</p>
                    <Loader2 className="w-6 h-6 text-teal-400 animate-spin mx-auto mt-4" />
                </div>
            </div>
        );
    }
    
    // ============================================================
    // RENDER - ERROR
    // ============================================================
    
    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-red-500/20 flex items-center justify-center">
                        <AlertTriangle className="w-10 h-10 text-red-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-3">رابط غير صالح</h1>
                    <p className="text-white/60 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
                    >
                        العودة للرئيسية
                    </button>
                </div>
            </div>
        );
    }
    
    // ============================================================
    // RENDER - DEMO WELCOME
    // ============================================================
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" dir="rtl">
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>
            
            <div className="relative z-10 container mx-auto px-4 py-12 max-w-4xl">
                {/* Header */}
                <div className="text-center mb-12">
                    {/* Logo */}
                    <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-2xl shadow-teal-500/30">
                        <span className="text-4xl font-black text-white">أ</span>
                    </div>
                    
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
                        مرحباً بك في <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">أدورا</span>
                    </h1>
                    
                    <p className="text-xl text-white/60 max-w-2xl mx-auto">
                        نظام إدارة الفنادق الذكي - جرب كل المميزات مجاناً
                    </p>
                </div>
                
                {/* Link Info */}
                {link && (
                    <div className="mb-8 flex flex-wrap justify-center gap-4">
                        {link.expiresAt && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                                <Clock className="w-4 h-4" />
                                <span className="text-sm">
                                    صالح حتى: {link.expiresAt.toDate().toLocaleDateString('ar-SA')}
                                </span>
                            </div>
                        )}
                        {link.maxUses > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300">
                                <Users className="w-4 h-4" />
                                <span className="text-sm">
                                    الاستخدامات: {link.currentUses}/{link.maxUses}
                                </span>
                            </div>
                        )}
                        {link.multiLicense && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300">
                                <Building2 className="w-4 h-4" />
                                <span className="text-sm">
                                    {link.licensesCount} ترخيص - {link.branchesPerLicense} فرع لكل ترخيص
                                </span>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Features Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
                    {FEATURES.map((feature, idx) => (
                        <div 
                            key={idx}
                            className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-teal-500/30 transition-all group"
                        >
                            <feature.icon className={`w-8 h-8 ${feature.color} mb-3 group-hover:scale-110 transition-transform`} />
                            <p className="text-white font-bold">{feature.title}</p>
                        </div>
                    ))}
                </div>
                
                {/* User Info Form */}
                {showForm ? (
                    <div className="max-w-md mx-auto mb-8 space-y-4">
                        <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                            <h3 className="text-white font-bold mb-4 text-center">
                                معلوماتك (اختياري)
                            </h3>
                            
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    placeholder="الاسم"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-white/40 focus:border-teal-500 focus:outline-none"
                                />
                                <input
                                    type="email"
                                    value={userEmail}
                                    onChange={(e) => setUserEmail(e.target.value)}
                                    placeholder="البريد الإلكتروني"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-white/40 focus:border-teal-500 focus:outline-none"
                                    dir="ltr"
                                />
                                <input
                                    type="tel"
                                    value={userPhone}
                                    onChange={(e) => setUserPhone(e.target.value)}
                                    placeholder="رقم الجوال"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-white/40 focus:border-teal-500 focus:outline-none"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center mb-4">
                        <button
                            onClick={() => setShowForm(true)}
                            className="text-teal-400 hover:text-teal-300 text-sm underline"
                        >
                            أريد إدخال معلوماتي للتواصل لاحقاً
                        </button>
                    </div>
                )}
                
                {/* Start Button */}
                <div className="text-center">
                    <button
                        onClick={handleStartDemo}
                        disabled={starting}
                        className="group relative inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-xl font-bold rounded-2xl shadow-2xl shadow-teal-500/30 hover:shadow-teal-500/50 hover:from-teal-400 hover:to-cyan-500 disabled:opacity-50 transition-all"
                    >
                        {starting ? (
                            <>
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <span>جاري التحميل...</span>
                            </>
                        ) : (
                            <>
                                <Play className="w-6 h-6" />
                                <span>ابدأ التجربة المجانية</span>
                                <ArrowRight className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                    
                    {link?.includeTour && (
                        <p className="text-white/40 text-sm mt-4">
                            ستبدأ جولة تعريفية تلقائية لشرح كل الخصائص
                        </p>
                    )}
                </div>
                
                {/* Permissions Info */}
                {link && (
                    <div className="mt-12 p-6 rounded-3xl bg-white/5 border border-white/10">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-teal-400" />
                            صلاحيات هذا الديمو
                        </h3>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className={`p-3 rounded-xl ${link.canCreateRequests ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border`}>
                                <div className="flex items-center gap-2">
                                    {link.canCreateRequests ? (
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                    ) : (
                                        <AlertTriangle className="w-4 h-4 text-red-400" />
                                    )}
                                    <span className={link.canCreateRequests ? 'text-green-300' : 'text-red-300'}>إنشاء طلبات</span>
                                </div>
                            </div>
                            
                            <div className={`p-3 rounded-xl ${link.canManageEmployees ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border`}>
                                <div className="flex items-center gap-2">
                                    {link.canManageEmployees ? (
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                    ) : (
                                        <AlertTriangle className="w-4 h-4 text-red-400" />
                                    )}
                                    <span className={link.canManageEmployees ? 'text-green-300' : 'text-red-300'}>إدارة الموظفين</span>
                                </div>
                            </div>
                            
                            <div className={`p-3 rounded-xl ${link.canViewReports ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border`}>
                                <div className="flex items-center gap-2">
                                    {link.canViewReports ? (
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                    ) : (
                                        <AlertTriangle className="w-4 h-4 text-red-400" />
                                    )}
                                    <span className={link.canViewReports ? 'text-green-300' : 'text-red-300'}>عرض التقارير</span>
                                </div>
                            </div>
                            
                            <div className={`p-3 rounded-xl ${link.canAccessSettings ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border`}>
                                <div className="flex items-center gap-2">
                                    {link.canAccessSettings ? (
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                    ) : (
                                        <AlertTriangle className="w-4 h-4 text-red-400" />
                                    )}
                                    <span className={link.canAccessSettings ? 'text-green-300' : 'text-red-300'}>الإعدادات</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Allowed Sections */}
                        <div className="mt-4">
                            <p className="text-white/60 text-sm mb-2">الأقسام المتاحة:</p>
                            <div className="flex flex-wrap gap-2">
                                {link.allowedScopes.map(scope => (
                                    <span 
                                        key={scope}
                                        className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-sm"
                                    >
                                        {scope === 'all' ? 'كل الأقسام' :
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
                    </div>
                )}
                
                {/* Footer */}
                <div className="mt-12 text-center text-white/30 text-sm">
                    <p>نظام أدورا لإدارة الفنادق © 2024</p>
                    <p className="mt-1">هذه نسخة تجريبية - البيانات وهمية للعرض فقط</p>
                </div>
            </div>
        </div>
    );
};

export default DemoEntry;
