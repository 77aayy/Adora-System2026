/**
 * Main Application Entry
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Link, useLocation, useSearchParams } from 'react-router-dom';
import {
    Phone,
    Sparkles,
    BellRing,
    Wrench,
    LogOut,
    User,
    ShoppingCart,
    ChevronDown,
    Building2,
    Check,
    Activity,
    Settings,
    Bell,
    MessageSquare,
    DollarSign,
    Coffee,
} from 'lucide-react';
import { AppRoutes } from './AppRoutes';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/common/ToastManager';
import { ConfirmProvider } from './components/common/ConfirmDialog';
import { useTenant } from './context/TenantContext';
import { TenantProvider } from './context/TenantContext';
import { GlobalServicesProvider } from './components/providers/GlobalServicesProvider';
import { ProviderComposer } from './components/providers/ProviderComposer';
import { UXProvider, useUX } from './context/UXContext';
import { AIProvider } from './context/AIContext';
import { VoiceInputButton } from './components/shared/VoiceInputButton';
import { useFeatureGate } from './hooks/useFeatureGate';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts';
import { ToastContainer } from './components/common/EnhancedToast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SplashScreen } from './components/common/SplashScreen';
import SimulationCanvas from './components/SimulationCanvas';
import { MaintenanceMode } from './components/system/MaintenanceMode';
import { BroadcastMessages } from './components/system/BroadcastMessages';
import { UpdateNotifications } from './components/system/UpdateNotifications';
import { UnifiedManagerHeader } from './components/layout/UnifiedManagerHeader';
import './index.css';

// ✅ CRITICAL: Pre-import Chart.js to ensure vendor-chartjs is in dependency graph
// This ensures it's added to modulepreload automatically by Vite
import 'chart.js';
import 'react-chartjs-2';

// ⚡ Performance: Route preloading
import { useRoutePreload, preloadAdjacentRoutes } from './hooks/useRoutePreload';

// Navigation Item Component (exported for potential reuse)
interface NavItemProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _NavItem: React.FC<NavItemProps> = ({ to, icon, label, isActive }) => (
    <Link
        to={to}
        className={`
            flex items-center gap-2 px-3 sm:px-6 py-2 rounded-xl transition-all duration-200
            ${isActive
                ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-lg shadow-teal-500/30'
                : 'hover:scale-105'}
        `}
        style={!isActive ? {
            color: 'var(--theme-text-secondary)',
            background: 'transparent',
        } : undefined}
    >
        <span>{icon}</span>
        <span className="hidden sm:inline font-medium">{label}</span>
    </Link>
);


// Toggle Switch Component moved to common/Switch.ts
// (Deleted ToggleSwitch from here)

// Navigation Bar Component - Memoized for performance
const NavigationBar: React.FC<{
    isVoiceEnabled: boolean;
    onToggleVoice: (enabled: boolean) => void;
}> = React.memo(({ isVoiceEnabled, onToggleVoice }) => {
    const location = useLocation();
    const { user, isAuthenticated, logout, branchId, setBranch } = useAuth();
    
    // ⚡ Performance: Preload routes on hover
    const { getPreloadProps } = useRoutePreload();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tenantId: _tenantId } = useTenant();
    const [branchName, setBranchName] = React.useState<string>('');
    const [availableBranches, setAvailableBranches] = React.useState<Array<{ id: string; name: string; code?: string }>>([]);
    const [showBranchTabs, setShowBranchTabs] = React.useState(false);
    const [isBranchMenuOpen, setIsBranchMenuOpen] = React.useState(false);
    
    // ✅ OWNER TABS - useSearchParams MUST be called before any conditional returns
    const [searchParams, setSearchParams] = useSearchParams();
    const currentTab = searchParams.get('tab') || 'overview';

    // ✅ Load branch name
    React.useEffect(() => {
        const loadBranchName = async () => {
            if (!branchId || !user) return;

            try {
                if ((user as any).tenantId) {
                    // Load from tenant branches
                    const { doc, getDoc } = await import('firebase/firestore');
                    const { db } = await import('./services/firebase');
                    if (!db) {
                        setBranchName(branchId);
                        return;
                    }
                    const branchRef = doc(db, `tenants/${(user as any).tenantId}/branches`, branchId);
                    const branchDoc = await getDoc(branchRef);
                    if (branchDoc.exists()) {
                        setBranchName(branchDoc.data().name || branchId);
                    } else {
                        setBranchName(branchId);
                    }
                } else {
                    // Legacy: Use branchId as name
                    setBranchName(branchId);
                }
            } catch (error) {
                console.error('Error loading branch name:', error);
                setBranchName(branchId || '');
            }
        };

        loadBranchName();
    }, [branchId, user]);

    // ✅ Load available branches for tabs
    React.useEffect(() => {
        const loadAvailableBranches = async () => {
            if (!user) return;

            try {
                const { loadAvailableBranches } = await import('./services/userService');
                const branches = await loadAvailableBranches(user as any);
                setAvailableBranches(branches);
                setShowBranchTabs(branches.length > 1);
            } catch (error) {
                console.error('Error loading available branches:', error);
            }
        };

        // ✅ FIX: Load branches for ANY user with multiple branches (not just manager)
        // This allows employees assigned to multiple branches to switch between them
        if (user && (user.role === 'manager' || user.role === 'owner' || (user.branches && user.branches.length > 1))) {
            loadAvailableBranches();
        }
    }, [user]);

    // ✅ Feature Gates: Check which features are enabled (MUST be before any returns)
    const { isEnabled: isProcurementEnabled } = useFeatureGate('procurementSystem');
    const { isEnabled: isAiAssistantEnabled } = useFeatureGate('aiAssistant');

    // Hide nav on login, guest, and admin pages (Admin has its own layout)
    const hiddenPaths = ['/login', '/guest', '/admin'];
    if (hiddenPaths.some(path => location.pathname.startsWith(path))) {
        return null;
    }

    // Only show if authenticated
    if (!isAuthenticated) return null;

    // ✅ OWNER: Should NOT see operational departments (reception, housekeeping, etc.)
    // Owner only sees Admin/Owner Dashboard - these are operational tools for managers/employees
    const isOwner = user?.role === 'owner';
    const isManager = user?.role === 'manager';
    const isOnOwnerDashboard = location.pathname === '/owner-dashboard';

    // ✅ OWNER TABS - Show in navbar when owner is on dashboard
    // ✅ تم حذف "الإحصائيات" لأنها كانت تعرض بيانات وهمية - تم نقل البيانات الحقيقية إلى "نظرة عامة"
    const ownerTabs = [
        { id: 'overview', label: 'نظرة عامة', icon: <Activity className="w-4 h-4" />, shortLabel: 'نظرة' },
        { id: 'tenants', label: 'المستأجرون', icon: <Building2 className="w-4 h-4" />, shortLabel: 'مستأجرون' },
        { id: 'settings', label: 'الإعدادات', icon: <Settings className="w-4 h-4" />, shortLabel: 'إعدادات' },
        { id: 'updates', label: 'التحديثات', icon: <Bell className="w-4 h-4" />, shortLabel: 'تحديثات' },
        { id: 'broadcasts', label: 'الرسائل', icon: <MessageSquare className="w-4 h-4" />, shortLabel: 'رسائل' },
        { id: 'billing', label: 'الإدارة المالية', icon: <DollarSign className="w-4 h-4" />, shortLabel: 'المالية', special: true }
    ];

    const handleTabChange = (tabId: string) => {
        setSearchParams({ tab: tabId });
    };

    const navItems: Array<{ to: string; icon: React.ReactNode; label: string }> = [];

    // ✅ OWNER: Only Owner Dashboard (unified experience)
    if (isOwner && !isOnOwnerDashboard) {
        navItems.push({ to: '/owner-dashboard', icon: <Building2 className="w-5 h-5" />, label: 'لوحة المالك' });
    } 
    // ✅ MANAGER: Admin + Operational Departments (filtered by feature gates)
    else if (isManager) {
        navItems.push({ to: '/admin', icon: <Building2 className="w-5 h-5" />, label: 'لوحة التحكم' });
        navItems.push(
            { to: '/reception', icon: <Phone className="w-5 h-5" />, label: 'الاستقبال' },
            { to: '/bellman', icon: <BellRing className="w-5 h-5" />, label: 'البيلمان' },
            { to: '/coffeeshop', icon: <Coffee className="w-5 h-5" />, label: 'الكافي شوب' },
            { to: '/housekeeping', icon: <Sparkles className="w-5 h-5" />, label: 'الهاوس كيبنج' },
            { to: '/maintenance', icon: <Wrench className="w-5 h-5" />, label: 'الصيانة' },
            ...(isProcurementEnabled ? [{ to: '/procurement', icon: <ShoppingCart className="w-5 h-5" />, label: 'المشتريات' }] : [])
        );
    }
    // ✅ EMPLOYEE: Only Operational Departments (filtered by feature gates)
    else {
        navItems.push(
            { to: '/reception', icon: <Phone className="w-5 h-5" />, label: 'الاستقبال' },
            { to: '/bellman', icon: <BellRing className="w-5 h-5" />, label: 'البيلمان' },
            { to: '/coffeeshop', icon: <Coffee className="w-5 h-5" />, label: 'الكافي شوب' },
            { to: '/housekeeping', icon: <Sparkles className="w-5 h-5" />, label: 'الهاوس كيبنج' },
            { to: '/maintenance', icon: <Wrench className="w-5 h-5" />, label: 'الصيانة' },
            ...(isProcurementEnabled ? [{ to: '/procurement', icon: <ShoppingCart className="w-5 h-5" />, label: 'المشتريات' }] : [])
        );
    }

    // ✅ Handle branch switch
    const handleBranchSwitch = (newBranchId: string) => {
        setBranch(newBranchId);
        setIsBranchMenuOpen(false);
        // Reload page to update branch context
        window.location.reload();
    };


    return (
        <nav 
            className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-4 py-2 flex items-center justify-between gap-3 transition-colors duration-300"
            style={{
                background: 'var(--theme-nav-bg)',
                borderBottom: '1px solid var(--theme-border-primary)',
                boxShadow: 'var(--theme-shadow-md)'
            }}
        >
            {/* RIGHT (RTL): Logo & User Profile */}
            <div className="flex items-center gap-3 shrink-0">
                {/* Logo */}
                <Link to="/" className="flex items-center">
                    <img
                        src="/adora-logo.png"
                        alt="Adora"
                        className="h-9 sm:h-10 w-auto object-contain transition-all duration-300"
                        style={{ filter: 'var(--logo-filter, none)' }}
                    />
                </Link>

                {/* User Profile - Hidden on mobile */}
                {user && (
                    <div 
                        className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl"
                        style={{
                            background: 'var(--theme-bg-tertiary)',
                            border: '1px solid var(--theme-border-primary)'
                        }}
                    >
                        {/* ✅ صورة المستخدم مع حركة دوران للمالك */}
                        <div className="relative w-7 h-7">
                            {isOwner && (
                                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-teal-400 border-r-emerald-400 animate-spin" style={{ animationDuration: '3s' }}></div>
                            )}
                            <div className={`w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center border ${isOwner ? 'border-teal-400/50' : 'border-teal-500/30'}`}>
                                <User className="w-3.5 h-3.5 text-teal-400" />
                            </div>
                        </div>
                        <div className="flex flex-col items-start">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium" style={{ color: 'var(--theme-text-primary)' }}>{isOwner ? 'ايمن ابو ورده' : user.name}</span>
                                {isOwner && (
                                    <span className="flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                                    </span>
                                )}
                            </div>
                            {branchName && (
                                <span className="text-[10px]" style={{ color: 'var(--theme-text-tertiary)' }}>{branchName}</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* CENTER: Navigation Links / Owner Tabs */}
            <div className="flex-1 min-w-0 mx-1 sm:mx-2">
                <div 
                    className="flex items-center justify-center gap-0.5 sm:gap-1 rounded-xl sm:rounded-2xl p-0.5 sm:p-1 overflow-x-auto scrollbar-hide max-w-full w-full flex-nowrap whitespace-nowrap"
                    style={{
                        background: 'var(--theme-bg-tertiary)',
                        border: '1px solid var(--theme-border-primary)'
                    }}
                >
                    {/* ✅ OWNER TABS - Show when owner is on dashboard */}
                    {isOwner && isOnOwnerDashboard ? (
                        ownerTabs.map((tab) => {
                            const isActive = currentTab === tab.id;
                            const isSpecial = tab.special;
                            
                            // Light Mode aware colors
                            const specialActiveClass = 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border border-emerald-400/50 shadow-lg shadow-emerald-500/20';
                            const specialInactiveClass = 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:border-emerald-400';
                            const normalActiveClass = 'bg-teal-500 text-white shadow-lg shadow-teal-500/20';
                            const normalInactiveClass = 'text-slate-600 hover:text-teal-600 hover:bg-teal-50';
                            
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    title={tab.label}
                                    className={`
                                        flex items-center gap-1 sm:gap-1.5 md:gap-2 px-1.5 sm:px-2 md:px-3 lg:px-4 py-2 rounded-xl transition-all duration-300 flex-shrink-0 min-w-[40px] sm:min-w-[60px]
                                        ${isSpecial
                                            ? (isActive ? specialActiveClass : specialInactiveClass)
                                            : (isActive ? normalActiveClass : normalInactiveClass)
                                        }
                                    `}
                                >
                                    <span className="flex-shrink-0">{tab.icon}</span>
                                    {/* ✅ إخفاء النص تماماً على الشاشات الصغيرة جداً، إظهار مختصر على متوسطة، كامل على كبيرة */}
                                    <span className="hidden sm:inline md:hidden text-[10px] font-medium">{tab.shortLabel}</span>
                                    <span className="hidden md:inline text-xs lg:text-sm font-medium">{tab.label}</span>
                                    {isSpecial && <span className="hidden xl:inline text-[10px] bg-emerald-500/30 px-1.5 py-0.5 rounded-full">جديد</span>}
                                </button>
                            );
                        })
                    ) : (
                        // ✅ REGULAR NAVIGATION for non-owner or when not on dashboard
                        // ⚡ Performance: Preload routes on hover
                        navItems.map((item) => {
                            const isActive = location.pathname.startsWith(item.to);
                            const isAdminTab = item.to === '/admin';

                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    title={item.label}
                                    {...getPreloadProps(item.to)}
                                    className={`
                                        flex items-center gap-2 px-2 sm:px-3 md:px-4 py-2 rounded-xl transition-all duration-300 flex-shrink-0
                                        ${isActive
                                            ? isAdminTab
                                                ? 'bg-amber-100 text-amber-700 border border-amber-300 shadow-lg shadow-amber-500/10'
                                                : 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                                            : isAdminTab
                                                ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 border border-amber-200'
                                                : 'text-slate-600 hover:text-teal-600 hover:bg-teal-50'}
                                    `}
                                >
                                    <span>{item.icon}</span>
                                    <span className="hidden lg:inline font-medium">{item.label}</span>
                                </Link>
                            );
                        })
                    )}
                </div>
            </div>


            {/* LEFT (RTL): Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Branch Dropdown - Show first */}
                {showBranchTabs && availableBranches.length > 1 && (
                    <div className="relative">
                        <button
                            onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
                            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-600 hover:bg-teal-100 hover:text-teal-700 transition-all shadow-sm text-xs sm:text-sm"
                            title="تغيير الفرع الحالي"
                        >
                            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="font-bold hidden sm:inline max-w-[100px] truncate">
                                {availableBranches.find(b => b.id === branchId)?.name || 'الفرع'}
                            </span>
                            <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isBranchMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {isBranchMenuOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40 bg-black/10"
                                    onClick={() => setIsBranchMenuOpen(false)}
                                />
                                <div 
                                    className="absolute top-full left-0 mt-2 w-52 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                                    style={{
                                        background: 'var(--theme-bg-secondary)',
                                        border: '1px solid var(--theme-border-primary)'
                                    }}
                                >
                                    <div className="p-2 space-y-1">
                                        <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--theme-text-tertiary)', borderBottom: '1px solid var(--theme-border-secondary)' }}>
                                            فروع المؤسسة
                                        </div>
                                        {availableBranches.map((branch) => (
                                            <button
                                                key={branch.id}
                                                onClick={() => handleBranchSwitch(branch.id)}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${branchId === branch.id
                                                    ? 'bg-teal-500/20 text-teal-600'
                                                    : 'hover:bg-slate-100'
                                                    }`}
                                                style={{ color: branchId === branch.id ? 'var(--theme-primary-600)' : 'var(--theme-text-secondary)' }}
                                            >
                                                <span className="truncate">{branch.name}</span>
                                                {branchId === branch.id && <Check className="w-4 h-4" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* 🧠 Voice Agent Toggle (Compact) - Only show if feature is enabled */}
                {isAiAssistantEnabled && (
                    <button
                        onClick={() => onToggleVoice(!isVoiceEnabled)}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-105 ${
                            isVoiceEnabled 
                                ? 'bg-teal-100 border-teal-300 text-teal-600' 
                                : 'border'
                        }`}
                        style={!isVoiceEnabled ? {
                            background: 'var(--theme-bg-tertiary)',
                            borderColor: 'var(--theme-border-primary)',
                            color: 'var(--theme-text-tertiary)'
                        } : undefined}
                        title={isVoiceEnabled ? 'تعطيل المساعد الصوتي' : 'تفعيل المساعد الصوتي'}
                    >
                        <Sparkles className="w-4 h-4" />
                    </button>
                )}

                {/* 🚪 Logout Button */}
                {user && (
                    <button
                        onClick={logout}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-105 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                        style={{
                            background: 'var(--theme-bg-tertiary)',
                            border: '1px solid var(--theme-border-primary)',
                            color: 'var(--theme-text-secondary)'
                        }}
                        title="تسجيل خروج"
                    >
                        <LogOut className="w-4 h-4 flip-rtl" />
                    </button>
                )}
            </div>
        </nav>
    );
});

// Developer Signature Footer - International Professional Style
const DeveloperFooter: React.FC = () => {
    const location = useLocation();
    const [isDark, setIsDark] = useState(
        document.documentElement.getAttribute('data-theme') === 'dark'
    );

    // Listen for theme changes - MUST be before any conditional return!
    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme') {
                    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);
    
    // ✅ Hide footer on login page and guest page (they have their own footers)
    const isLoginPage = location.pathname === '/login';
    const isGuestPage = location.pathname === '/guest' || location.pathname.startsWith('/guest');
    if (isLoginPage || isGuestPage) return null;

    // ✅ Get config from localStorage (set by owner in settings)
    const getConfig = () => {
        try {
            return {
                devName: localStorage.getItem('adora_dev_name') || 'Ayman Abo Warda',
                phoneSA: localStorage.getItem('adora_dev_phone_sa') || '966570707121',
                phoneEG: localStorage.getItem('adora_dev_phone_eg') || '201500000162',
                email: localStorage.getItem('adora_dev_email') || '77aayy@gmail.com',
            };
        } catch {
            return {
                devName: 'Ayman Abo Warda',
                phoneSA: '966570707121',
                phoneEG: '201500000162',
                email: '77aayy@gmail.com',
            };
        }
    };

    // ✅ FIX: State to force re-render when settings update
    const [devConfig, setDevConfig] = useState(getConfig());
    
    // ✅ FIX: Listen for settings updates from owner dashboard
    useEffect(() => {
        const handleSettingsUpdate = (event: CustomEvent) => {
            setDevConfig(event.detail);
        };
        
        window.addEventListener('adora_dev_settings_updated', handleSettingsUpdate as EventListener);
        
        return () => {
            window.removeEventListener('adora_dev_settings_updated', handleSettingsUpdate as EventListener);
        };
    }, []);

    const config = devConfig;
    const currentYear = new Date().getFullYear();

    const getWhatsAppMessage = () => {
        const hour = new Date().getHours();
        return hour >= 5 && hour < 12 ? 'صباح الخير، أنا مهتم بمشروعك' : 'مساء الخير، أنا مهتم بمشروعك';
    };

    // ⚠️ EXACT FORMAT FROM LoginScreen.tsx - DO NOT CHANGE
    // Format: © السنة • الاسم • +رقم سعودي • +رقم مصري • الإيميل
    return (
        <footer 
            className="fixed bottom-0 left-0 right-0 z-50 py-2 text-center pointer-events-auto transition-all duration-300"
            dir="ltr"
            style={{
                background: isDark 
                    ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 1) 100%)' 
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 1) 100%)',
                borderTop: '1px solid',
                borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
            }}
        >
            <p 
                className="text-[8px] sm:text-[9px] tracking-wide transition-all duration-300 flex items-center justify-center gap-1.5 flex-wrap px-4"
                style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}
            >
                {/* Copyright */}
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                    © {currentYear}
                </span>
                <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                
                {/* Developer Name */}
                <span className={`font-semibold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                    {config.devName}
                </span>
                <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                
                {/* Saudi Phone */}
                <a 
                    href={`https://wa.me/${config.phoneSA}?text=${encodeURIComponent(getWhatsAppMessage())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`hover:underline transition-colors ${
                        isDark 
                            ? 'text-slate-300 hover:text-teal-400' 
                            : 'text-slate-600 hover:text-teal-600'
                    }`}
                >
                    +{config.phoneSA}
                </a>
                <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                
                {/* Egypt Phone */}
                <a 
                    href={`https://wa.me/${config.phoneEG}?text=${encodeURIComponent(getWhatsAppMessage())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`hover:underline transition-colors ${
                        isDark 
                            ? 'text-slate-300 hover:text-teal-400' 
                            : 'text-slate-600 hover:text-teal-600'
                    }`}
                >
                    +{config.phoneEG}
                </a>
                <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                
                {/* Developer Email */}
                <a 
                    href={`mailto:${config.email}`}
                    className={`hover:underline transition-colors ${
                        isDark 
                            ? 'text-slate-300 hover:text-teal-400' 
                            : 'text-slate-600 hover:text-teal-600'
                    }`}
                >
                    {config.email}
                </a>
            </p>
        </footer>
    );
};

// App Content Wrapper
const AppContent: React.FC = () => {
    const location = useLocation();
    const { voiceEnabled, toggleVoice, success } = useUX();
    const { user, branchId, setBranch } = useAuth();
    
    // ✅ Enable global keyboard shortcuts (Alt+1-8 navigation)
    useGlobalKeyboardShortcuts();
    
    // ⚡ Performance: Preload adjacent routes when page changes
    useEffect(() => {
        preloadAdjacentRoutes(location.pathname);
    }, [location.pathname]);

    // ✅ Auto-Switch Branch: Monitor location and switch branch automatically
    useEffect(() => {
        if (!user?.tenantId || !user?.branches || user.branches.length <= 1) return;
        if (!branchId) return;
        
        // Only enable on admin/reception dashboards (not on login/guest pages)
        if (location.pathname === '/login' || location.pathname.startsWith('/guest')) return;

        const loadAutoSwitch = async () => {
            try {
                const { createGeofenceMonitor } = await import('./services/autoSwitchBranchService');

                const monitor = createGeofenceMonitor(
                    user.tenantId,
                    branchId,
                    user.branches,
                    60000 // Check every minute
                );

                // Handle branch enter event
                monitor.onEnter((event) => {
                    if (event.branchId !== branchId) {
                        // Ask user if they want to switch (using confirm for simplicity)
                        if (window.confirm(`أنت دخلت نطاق ${event.branchName}.\nهل تريد التبديل إلى هذا الفرع؟`)) {
                            setBranch(event.branchId);
                            success(`تم التبديل إلى ${event.branchName}`);
                        }
                    }
                });

                // Start monitoring
                monitor.start();

                // Cleanup on unmount
                return () => {
                    monitor.stop();
                };
            } catch (error) {
                console.error('Error loading auto-switch:', error);
                // Fail silently - don't interrupt user
                return undefined;
            }
        };

        const cleanup = loadAutoSwitch();
        
        return () => {
            cleanup.then(cleanupFn => cleanupFn?.()).catch(console.error);
        };
    }, [user?.tenantId, user?.branches, branchId, setBranch, success, location.pathname]);

    // ✅ Determine which header to show
    const isManager = user?.role === 'manager';
    const isOwner = user?.role === 'owner';
    const isOnLoginOrGuest = location.pathname === '/login' || location.pathname.startsWith('/guest');
    
    // Manager paths where unified header should show
    const managerPaths = ['/admin', '/reception', '/housekeeping', '/bellman', '/coffeeshop', '/maintenance', '/procurement'];
    const isOnManagerPage = managerPaths.some(path => location.pathname.startsWith(path));
    
    // Show unified header for managers on manager pages
    const showUnifiedHeader = isManager && isOnManagerPage && !isOnLoginOrGuest;
    
    // Show regular nav for non-managers or when unified header is not shown
    const showRegularNav = !isOnLoginOrGuest && !showUnifiedHeader && !isOwner;

    return (
        <div 
            className={`min-h-screen overflow-x-hidden ${isOnLoginOrGuest ? '' : 'pb-12 sm:pb-16 md:pb-20'}`} 
            style={{ background: isOnLoginOrGuest ? 'transparent' : 'var(--theme-bg-primary)' }}
        >
            {/* ✅ Unified Manager Header - Sticky tabs navigation */}
            {showUnifiedHeader && <UnifiedManagerHeader />}
            
            {/* ✅ Regular Navigation Bar for employees */}
            {showRegularNav && <NavigationBar isVoiceEnabled={voiceEnabled} onToggleVoice={toggleVoice} />}
            
            <main className={`overflow-x-hidden w-full ${showRegularNav ? 'pt-16 sm:pt-20 md:pt-24' : ''}`}>
                <ErrorBoundary key={location.pathname}>
                    <AppRoutes />
                </ErrorBoundary>
            </main>
            {/* Floating Voice Input Button - Visibility managed internally via UXContext */}
            <VoiceInputButton />
            {/* ✅ Enhanced Toast Notifications */}
            <ToastContainer />
            {/* Developer Signature */}
            <DeveloperFooter />
        </div>
    );
};

// Main App Component
const App: React.FC = () => {
    const showSim = new URLSearchParams(window.location.search).has('sim');

    if (showSim) {
        return <SimulationCanvas />;
    }

    const [showSplash, setShowSplash] = useState(() => {
        // ✅ Only show splash on FIRST visit (not on refresh)
        // Check if user is already logged in - if yes, skip splash completely
        const isLoggedIn = localStorage.getItem('adora_user');
        
        // If user is logged in, skip splash (they're refreshing, not first visit)
        if (isLoggedIn) {
            return false;
        }
        
        // Only show splash on first visit
        const hasShownSplash = localStorage.getItem('adora_splash_shown');
        return !hasShownSplash;
    });

    const handleSplashComplete = () => {
        localStorage.setItem('adora_splash_shown', 'true');
        setShowSplash(false);
    };

    // 🧠 GENIUS DEBUG TOOLS & GLOBAL ERROR HANDLING
    useEffect(() => {
        const loadGeniusTools = async () => {
            // Import and init error handler globally
            const { initErrorHandler } = await import('./services/errorHandlerService');
            initErrorHandler();

            // ✅ RUN DATA DOCTOR (Self-Healing System)
            try {
                const { runDataDoctor, performHealthCheck } = await import('./services/dataDoctorService');
                
                // 🏥 First: Check database integrity and auto-seed missing collections
                const healthResult = await performHealthCheck();
                if (healthResult.seeded) {
                    console.log('🌱 Database seeded:', healthResult.seedingResult?.collectionsCreated);
                }
                
                // Then: Run regular diagnostics if user is logged in
                const userData = localStorage.getItem('adora_user');
                if (userData) {
                    const user = JSON.parse(userData);
                    if (user.tenantId && (user.branch || (user.branches && user.branches[0]))) {
                        const branch = user.branch || user.branches[0];
                        runDataDoctor(user.tenantId, branch);
                    }
                }
            } catch (doctorErr) {
                console.error('Data Doctor failed to start:', doctorErr);
            }

            // Floating Copy Button removed by user request

            const predictive = await import('./services/predictiveMaintenanceService');
            const sentiment = await import('./services/ai/sentimentService');
            const i18n = await import('./services/i18nService');
            const smartAlerts = await import('./services/smartAlertsService');
            const firebase = await import('./services/firebase');
            const firestore = await import('firebase/firestore');

            // @ts-ignore
            window.debugGenius = {
                predictive,
                sentiment,
                i18n,
                smartAlerts,
                laundry: await import('./services/laundryInventoryService'),
                housekeeping: await import('./services/housekeepingService'),
                db: firebase.db,
                firestore
            };
            console.log('🧠 GENIUS DEBUG TOOLS LOADED: window.debugGenius');
        };
        loadGeniusTools();
    }, []);

    // ✅ Provider Composer - Clean provider composition
    // Providers are applied in order (first = outermost, last = innermost)
    // CRITICAL: TenantProvider MUST be first to identify which tenant before loading anything else
    const providers = [
        { Component: TenantProvider },      // 1️⃣ Tenant identification (SaaS context)
        // ✅ i18n is initialized globally in main.tsx (react-i18next)
        { Component: ThemeProvider },        // 2️⃣ Visual theme
        { Component: AuthProvider },         // 3️⃣ User authentication
        { Component: GlobalServicesProvider }, // 4️⃣ Global background services
        { Component: ToastProvider },        // 5️⃣ Notifications
        { Component: UXProvider },           // 6️⃣ UX settings (voice, animations)
        { Component: ConfirmProvider },      // 7️⃣ Confirmation dialogs
        { Component: AIProvider },           // 8️⃣ AI assistant
        { Component: MaintenanceMode },      // 9️⃣ Maintenance mode check
    ];

    return (
        <>
            {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <ProviderComposer providers={providers}>
                    <AppContent />
                    <BroadcastMessages />
                    <UpdateNotifications />
                </ProviderComposer>
            </BrowserRouter>
        </>
    );
};

export default App;