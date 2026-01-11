/**
 * HierarchyGuard Component
 * Enforces the SaaS Hierarchy: Owner -> Manager -> Branch -> Floor -> Room
 * 
 * Logic:
 * - If user is 'owner', bypass (they manage the system).
 * - If user is 'manager' or 'employee', they MUST have a branchId selected.
 * - If no branchId is selected, show a selection/setup screen.
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { MapPin, Plus, LayoutDashboard } from 'lucide-react';
import { AdoraLoader } from '../../components/common/AdoraLoader';
import { useNavigate, useLocation } from 'react-router-dom';

export const HierarchyGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, branchId } = useAuth();
    const { tenantId } = useTenant();
    const navigate = useNavigate();
    const location = useLocation();

    // 0. Handle Loading State
    // If user is undefined (still loading from Firebase), show a neutral loading state
    if (user === undefined) {
        return (
            <div className="min-h-screen theme-page flex items-center justify-center">
                <AdoraLoader size="lg" message="جاري التحميل..." />
            </div>
        );
    }

    // 1. Bypass for Owner & Manager on Management Routes
    // - Owner has system-wide access to MANAGEMENT routes only (not operational).
    // - Manager needs access to /admin/* even without a branch to perform Step 0 (Set up their first branch).
    // ✅ FIX: Manager with branchId selected should have access to ALL operational dashboards
    const isManagementRoute = location.pathname.startsWith('/owner') || location.pathname.startsWith('/admin');
    const isOperationalRoute = ['/reception', '/housekeeping', '/bellman', '/maintenance', '/procurement', '/coffeeshop'].some(route => location.pathname.startsWith(route));
    
    // ✅ OWNER: Only has access to management routes, NOT operational routes
    if (user?.role === 'owner') {
        if (isOperationalRoute) {
            // Owner trying to access operational route - redirect to owner dashboard
            navigate('/owner-dashboard', { replace: true });
            return null;
        }
        // Owner has access to management routes
        return <>{children}</>;
    }
    
    // Manager with branchId can access operational routes (like an employee with full permissions)
    if (user?.role === 'manager' && branchId && isOperationalRoute) {
        return <>{children}</>;
    }
    
    // Manager on management routes (admin panel) - allow even without branchId
    if (user?.role === 'manager' && isManagementRoute) {
        return <>{children}</>;
    }

    // 2. Check for Tenant
    if (!tenantId) {
        return (
            <div className="min-h-screen theme-page flex items-center justify-center p-4">
                <div className="max-w-md w-full glass rounded-3xl p-8 text-center">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <LayoutDashboard className="w-10 h-10 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">خطأ في النظام</h1>
                    <p className="text-white/60">لم يتم العثور على بيانات الفندق (Tenant).</p>
                </div>
            </div>
        );
    }

    // 3. Check for Branch ID
    // If we are on a dashboard and have no branch, we can't function.
    if (!branchId) {
        return (
            <div className="min-h-screen theme-page flex items-center justify-center p-4">
                <div className="max-w-md w-full glass rounded-3xl p-8 text-center border-t border-primary-500/20 shadow-2xl">
                    <div className="w-20 h-20 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                        <MapPin className="w-10 h-10 text-primary-500" />
                    </div>

                    <h1 className="text-2xl font-bold text-white mb-2">
                        مطلوب اختيار فرع
                    </h1>

                    <p className="text-white/60 mb-8 leading-relaxed">
                        عفواً، لا يمكن الوصول إلى لوحة التحكم دون اختيار فرع نشط.
                        يرجى اختيار فرع من القائمة العلوية أو إنشاء فرع جديد إذا كنت المدير.
                    </p>

                    <div className="space-y-3">
                        {user?.role === 'manager' ? (
                            <div className="space-y-4">
                                <p className="text-sm text-white/40 bg-white/5 p-3 rounded-lg border border-white/10">
                                    تنبيه: لم يتم ربط حسابك بأي فروع نَشِطة حالياً.
                                </p>
                                <button
                                    onClick={() => navigate('/admin/branches')}
                                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-green-500/25 transition-all"
                                >
                                    <Plus className="w-5 h-5" />
                                    <span>إنشاء أو ربط فرع جديد</span>
                                </button>
                            </div>
                        ) : (user?.role as string) === 'owner' ? (
                            <div className="space-y-4">
                                <p className="text-sm text-white/40 bg-white/5 p-3 rounded-lg border border-white/10">
                                    تنبيه: لم يتم تحديد فرع للعمل عليه في هذه اللوحة.
                                </p>
                                <button
                                    onClick={() => navigate('/owner')}
                                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-amber-500/25 transition-all"
                                >
                                    <LayoutDashboard className="w-5 h-5" />
                                    <span>الذهاب للوحة المالك</span>
                                </button>
                            </div>
                        ) : (
                            <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/10">
                                يرجى مراجعة المدير لتفعيل فرعك.
                            </p>
                        )}

                        <p className="text-[10px] text-white/30 uppercase tracking-widest mt-4">
                            Adora Hierarchy: Branch &rarr; Floor &rarr; Room
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
