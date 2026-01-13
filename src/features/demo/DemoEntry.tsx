/**
 * Demo Entry Page - V4
 * =====================
 * صفحة الديمو - متوافقة 100% مع بالتة أدورا الموحدة
 * تعمل في Light + Dark Mode بسلاسة
 * 
 * @author Adora System
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Sparkles, Loader2, AlertTriangle, Building2, 
    Clock, MessageCircle, ArrowRight, CheckCircle, Key,
    Users, BarChart3, FileText, Settings, Hotel
} from 'lucide-react';
import { validateDemoLink, recordDemoUsage, DemoLinkConfig } from '../../services/demoLinkService';
import { initializeDemoFirebase, saveDemoCode } from '../../services/firebaseMulti';

// ============================================================
// COMPONENT
// ============================================================

const DemoEntry: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [link, setLink] = useState<DemoLinkConfig | null>(null);
    const [initializing, setInitializing] = useState(false);
    
    // ============ Load Demo Link ============
    useEffect(() => {
        const loadLink = async () => {
            if (!code) {
                setError('رابط الديمو غير صالح');
                setLoading(false);
                return;
            }
            
            try {
                const validation = await validateDemoLink(code);
                
                if (!validation.valid || !validation.link) {
                    setError(validation.error || 'رابط الديمو غير صالح');
                    setLoading(false);
                    return;
                }
                
                setLink(validation.link);
            } catch (err: any) {
                setError(err.message || 'حدث خطأ');
            } finally {
                setLoading(false);
            }
        };
        
        loadLink();
    }, [code]);
    
    // ============ Start Demo ============
    const handleStartDemo = async () => {
        if (!link || !link.demoFirebaseConfig) {
            setError('بيانات الديمو غير مكتملة');
            return;
        }
        
        setInitializing(true);
        
        try {
            await recordDemoUsage(link.linkCode);
            const demoInstance = await initializeDemoFirebase(link.demoFirebaseConfig, link.linkCode);
            
            if (!demoInstance) {
                throw new Error('فشل تهيئة بيئة الديمو');
            }
            
            saveDemoCode(link.linkCode);
            navigate('/login');
            
        } catch (err: any) {
            setError(err.message || 'فشل بدء التجربة');
        } finally {
            setInitializing(false);
        }
    };
    
    // ============ WhatsApp Link ============
    const handleSubscribe = () => {
        if (!link?.salesWhatsAppNumber) return;
        const message = encodeURIComponent('السلام عليكم، أنا مهتم بالاشتراك في نظام أدورا لإدارة الفنادق');
        window.open(`https://wa.me/${link.salesWhatsAppNumber}?text=${message}`, '_blank');
    };
    
    // ============ Render Loading ============
    if (loading) {
        return (
            <div className="adora-page min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="relative inline-block">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--theme-primary-400)] to-[var(--theme-primary-600)] flex items-center justify-center mb-6 animate-pulse shadow-lg">
                            <Hotel className="w-10 h-10 text-white" />
                        </div>
                        <Loader2 className="w-8 h-8 text-[var(--theme-primary-500)] animate-spin absolute -bottom-2 -right-2" />
                    </div>
                    <p className="adora-text-secondary text-lg">جاري تحميل بيانات الديمو...</p>
                </div>
            </div>
        );
    }
    
    // ============ Render Error ============
    if (error) {
        return (
            <div className="adora-page min-h-screen flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="adora-empty-icon w-24 h-24 mx-auto mb-6" style={{ background: 'var(--theme-accent-red-light)' }}>
                        <AlertTriangle className="w-12 h-12" style={{ color: 'var(--theme-accent-red)' }} />
                    </div>
                    <h1 className="text-3xl font-bold adora-text-primary mb-4">
                        رابط الديمو غير صالح
                    </h1>
                    <p className="adora-text-tertiary text-lg mb-8">
                        {error}
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="adora-btn adora-btn-secondary adora-btn-lg"
                    >
                        العودة للرئيسية
                    </button>
                </div>
            </div>
        );
    }
    
    // ============ Render Demo Info ============
    if (!link) return null;
    
    const expiresIn = link.expiresAt 
        ? Math.max(0, Math.ceil((link.expiresAt.toDate().getTime() - Date.now()) / (1000 * 60 * 60)))
        : null;
    
    return (
        <div className="adora-page min-h-screen flex items-center justify-center p-4" dir="rtl">
            <div className="w-full max-w-lg">
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <div className="relative inline-block">
                        <img
                            src="/adora-logo.png"
                            alt="Adora"
                            className="w-24 h-24 object-contain mx-auto mb-4"
                            style={{ filter: 'var(--logo-filter)' }}
                        />
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-[var(--theme-accent-purple)] to-[var(--theme-accent-purple-dark)] rounded-lg flex items-center justify-center animate-pulse shadow-lg">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold adora-text-primary mb-3">
                        تجربة أدورا المجانية
                    </h1>
                    <p className="adora-text-secondary text-lg">
                        جرب نظام إدارة الفنادق بنفسك!
                    </p>
                </div>
                
                {/* Demo Card */}
                <div className="adora-card overflow-hidden">
                    {/* Header - Manager Info */}
                    <div className="adora-card-header" style={{ background: 'var(--theme-accent-purple-light)' }}>
                        <div className="flex items-center gap-4 w-full">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--theme-accent-purple)] to-[var(--theme-accent-purple-dark)] flex items-center justify-center shadow-lg">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold adora-text-primary">
                                    {link.demoManager?.name || 'مشترك تجريبي'}
                                </h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <Key className="w-4 h-4" style={{ color: 'var(--theme-primary-500)' }} />
                                    <span className="adora-text-secondary">كود الدخول:</span>
                                    <code className="font-mono text-xl font-bold px-3 py-0.5 rounded-lg" style={{
                                        color: 'var(--theme-primary-500)',
                                        background: 'var(--theme-primary-100)'
                                    }}>
                                        {link.demoManager?.code || '****'}
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Info Section */}
                    <div className="adora-card-body space-y-4">
                        {/* Branch */}
                        <div className="adora-alert adora-alert-teal">
                            <Building2 className="w-6 h-6 flex-shrink-0" />
                            <span className="text-lg">{link.demoManager?.branchName || 'فرع تجريبي'}</span>
                        </div>
                        
                        {/* Expiry Time */}
                        {expiresIn !== null && (
                            <div className="adora-alert adora-alert-warning">
                                <Clock className="w-6 h-6 flex-shrink-0" />
                                <span className="text-lg">صالح لمدة <strong>{expiresIn}</strong> ساعة</span>
                            </div>
                        )}
                        
                        {/* Features List */}
                        <div className="adora-border-t pt-4 mt-4">
                            <p className="adora-text-tertiary text-sm mb-4">ستتمكن من:</p>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { icon: Users, text: 'إنشاء غرف وموظفين' },
                                    { icon: FileText, text: 'إدارة طلبات النزلاء' },
                                    { icon: Settings, text: 'تجربة كل الأقسام' },
                                    { icon: BarChart3, text: 'رؤية التقارير والإحصائيات' }
                                ].map((feature, idx) => (
                                    <div 
                                        key={idx} 
                                        className="flex items-center gap-2 p-3 rounded-xl"
                                        style={{
                                            background: 'var(--theme-bg-tertiary)',
                                            border: '1px solid var(--theme-border-secondary)'
                                        }}
                                    >
                                        <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--theme-accent-green)' }} />
                                        <span className="adora-text-secondary text-sm">{feature.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="adora-card-footer flex-col">
                        {/* Start Demo Button */}
                        <button
                            onClick={handleStartDemo}
                            disabled={initializing}
                            className="adora-btn adora-btn-primary adora-btn-lg w-full"
                        >
                            {initializing ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    <Sparkles className="w-6 h-6" />
                                    ابدأ التجربة الآن
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                        
                        {/* Subscribe via WhatsApp */}
                        {link.salesWhatsAppNumber && (
                            <button
                                onClick={handleSubscribe}
                                className="adora-btn adora-btn-lg w-full"
                                style={{
                                    background: 'var(--theme-accent-green-light)',
                                    color: 'var(--theme-accent-green)',
                                    border: '1px solid var(--theme-accent-green)'
                                }}
                            >
                                <MessageCircle className="w-5 h-5" />
                                اشترك الآن
                            </button>
                        )}
                    </div>
                </div>
                
                {/* Footer Note */}
                <p className="text-center adora-text-disabled text-sm mt-6">
                    هذه نسخة تجريبية - البيانات معزولة وآمنة
                </p>
            </div>
        </div>
    );
};

export default DemoEntry;
