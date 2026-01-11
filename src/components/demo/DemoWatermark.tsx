/**
 * Demo Watermark Component
 * Shows watermark overlay in demo mode
 * Adora Hotel Management System V3 - SaaS
 */

import React from 'react';
import { useDemoMode } from '../../hooks/useDemoMode';
import { AlertCircle, X, ExternalLink, Clock } from 'lucide-react';

// ============================================================
// WATERMARK OVERLAY
// ============================================================

export const DemoWatermark: React.FC = () => {
    const { isDemo, watermark, session } = useDemoMode();
    
    if (!isDemo || !watermark) return null;
    
    return (
        <>
            {/* Corner watermark */}
            <div className="fixed bottom-4 left-4 z-[9990] pointer-events-none">
                <div className="px-4 py-2 rounded-xl bg-amber-500/90 text-white text-sm font-bold shadow-lg flex items-center gap-2 animate-pulse">
                    <AlertCircle className="w-4 h-4" />
                    <span>{watermark}</span>
                </div>
            </div>
            
            {/* Diagonal watermark pattern (subtle) */}
            <div 
                className="fixed inset-0 z-[9989] pointer-events-none opacity-[0.03]"
                style={{
                    background: `repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 100px,
                        rgba(0,0,0,0.1) 100px,
                        rgba(0,0,0,0.1) 102px
                    )`,
                }}
            >
                <div 
                    className="absolute inset-0"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23000' font-size='14' font-family='Arial' opacity='0.1' transform='rotate(-45 100 100)'%3E${encodeURIComponent(watermark)}%3C/text%3E%3C/svg%3E")`,
                        backgroundRepeat: 'repeat',
                    }}
                />
            </div>
        </>
    );
};

// ============================================================
// DEMO MODE BANNER
// ============================================================

export const DemoModeBanner: React.FC<{
    onExit?: () => void;
}> = ({ onExit }) => {
    const { isDemo, session, permissionLevel, exitDemo } = useDemoMode();
    const [showDetails, setShowDetails] = React.useState(false);
    
    if (!isDemo) return null;
    
    const permissionLabels = {
        viewer: { label: 'مشاهدة فقط', color: 'bg-blue-500' },
        tester: { label: 'اختبار محدود', color: 'bg-yellow-500' },
        full_access: { label: 'وصول كامل', color: 'bg-green-500' },
    };
    
    const permInfo = permissionLabels[permissionLevel || 'viewer'];
    
    // Calculate remaining time
    const expiresAt = session?.expiresAt?.toDate?.() || new Date(session?.expiresAt as any);
    const remainingMs = expiresAt.getTime() - Date.now();
    const remainingHours = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60)));
    const remainingMinutes = Math.max(0, Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60)));
    
    return (
        <div className="fixed top-0 left-0 right-0 z-[9991] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white shadow-lg">
            <div className="container mx-auto px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Mode indicator */}
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${permInfo.color}`}>
                            {permInfo.label}
                        </span>
                        <span className="font-bold">🎭 وضع الديمو</span>
                    </div>
                    
                    {/* Timer */}
                    <div className="hidden sm:flex items-center gap-1 text-white/80 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>متبقي: {remainingHours} ساعة {remainingMinutes} دقيقة</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Details toggle */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-xs text-white/80 hover:text-white underline"
                    >
                        {showDetails ? 'إخفاء التفاصيل' : 'عرض الصلاحيات'}
                    </button>
                    
                    {/* Subscribe button */}
                    <a
                        href="https://adora.sa/pricing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-lg bg-white text-amber-600 text-sm font-bold hover:bg-white/90 transition-colors"
                    >
                        <span>اشترك الآن</span>
                        <ExternalLink className="w-3 h-3" />
                    </a>
                    
                    {/* Exit button */}
                    <button
                        onClick={onExit || exitDemo}
                        className="p-1 text-white/80 hover:text-white transition-colors"
                        title="الخروج من الديمو"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
            
            {/* Expanded details */}
            {showDetails && session && (
                <div className="bg-black/20 border-t border-white/20">
                    <div className="container mx-auto px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-white/60 text-xs">إنشاء الطلبات</p>
                            <p className={session.permissions.canCreateRequests ? 'text-green-300' : 'text-red-300'}>
                                {session.permissions.canCreateRequests ? '✅ مسموح' : '❌ غير مسموح'}
                            </p>
                        </div>
                        <div>
                            <p className="text-white/60 text-xs">إدارة الموظفين</p>
                            <p className={session.permissions.canManageEmployees ? 'text-green-300' : 'text-red-300'}>
                                {session.permissions.canManageEmployees ? '✅ مسموح' : '❌ غير مسموح'}
                            </p>
                        </div>
                        <div>
                            <p className="text-white/60 text-xs">عرض التقارير</p>
                            <p className={session.permissions.canViewReports ? 'text-green-300' : 'text-red-300'}>
                                {session.permissions.canViewReports ? '✅ مسموح' : '❌ غير مسموح'}
                            </p>
                        </div>
                        <div>
                            <p className="text-white/60 text-xs">الإعدادات</p>
                            <p className={session.permissions.canAccessSettings ? 'text-green-300' : 'text-red-300'}>
                                {session.permissions.canAccessSettings ? '✅ مسموح' : '❌ غير مسموح'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// DEMO BLOCKED ACTION MODAL
// ============================================================

export const DemoBlockedModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    action: string;
    reason?: string;
}> = ({ isOpen, onClose, action, reason }) => {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                        <span className="text-4xl">🎭</span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                        إجراء غير متاح في الديمو
                    </h3>
                    
                    <p className="text-slate-600 dark:text-white/60 mb-4">
                        {reason || `"${action}" غير متاح في النسخة التجريبية.`}
                    </p>
                    
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm mb-6">
                        للحصول على الصلاحيات الكاملة، اشترك في أدورا واحصل على تجربة بدون قيود!
                    </div>
                    
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white font-medium hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                        >
                            فهمت
                        </button>
                        <a
                            href="https://adora.sa/pricing"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold hover:from-teal-400 hover:to-cyan-500 transition-colors flex items-center justify-center gap-2"
                        >
                            اشترك الآن
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DemoWatermark;
