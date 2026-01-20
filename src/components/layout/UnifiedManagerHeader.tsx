/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Unified Manager Header
 * Sticky navigation header for managers with department tabs
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
    LayoutDashboard,
    Phone,
    Sparkles,
    BellRing,
    Coffee,
    Wrench,
    ShoppingCart,
    Menu,
    X,
    LogOut,
    Building2,
    ChevronDown,
    Settings,
    Trophy,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useGlobalServices } from '../providers/GlobalServicesProvider';
import { useTenantBranches } from '../../hooks/useTenantData';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { PointsTracker } from '../shared/PointsTracker';
import { ThemeToggleButton } from '../common/ThemeToggle';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { getGreetingParts } from '../../utils/greetings';

interface DepartmentTab {
    id: string;
    path: string;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    color: string;
}

export const UnifiedManagerHeader: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, logout, branchId, setBranch } = useAuth();
    const { isOnline } = useGlobalServices(); // ✅ Get online status from GlobalServicesProvider
    const { branches } = useTenantBranches();
    const { isEnabled: isProcurementEnabled } = useFeatureGate('procurementSystem');
    
    const [showBranchMenu, setShowBranchMenu] = useState(false);
    const [activeIndicator, setActiveIndicator] = useState({ left: 0, width: 0 });
    const tabRefs = React.useRef<{ [key: string]: HTMLButtonElement | null }>({});

    // Current branch name
    const currentBranch = branches.find(b => b.id === branchId);
    const branchName = currentBranch?.name || t('sidebar.branch') || 'الفرع';

    // ✅ FIX: Smart Time-based Greeting (replaces static "مرحباً")
    const greeting = useMemo(() => {
        if (!user?.name) return null;
        return getGreetingParts(user.name, t);
    }, [user?.name, t]);

    // Define department tabs (i18n-aware)
    const departmentTabs: DepartmentTab[] = [
        {
            id: 'admin',
            path: '/admin',
            label: t('sidebar.dashboard') || 'لوحة التحكم',
            shortLabel: t('departments.admin') || 'التحكم',
            icon: <LayoutDashboard className="w-4 h-4" />,
            color: '#14B8A6',
        },
        {
            id: 'reception',
            path: '/reception',
            label: t('departments.reception') || 'الاستقبال',
            shortLabel: t('departments.reception') || 'استقبال',
            icon: <Phone className="w-4 h-4" />,
            color: '#3B82F6',
        },
        {
            id: 'housekeeping',
            path: '/housekeeping',
            label: t('departments.housekeeping') || 'الهاوس كيبنج',
            shortLabel: t('departments.housekeeping') || 'هاوس',
            icon: <Sparkles className="w-4 h-4" />,
            color: '#8B5CF6',
        },
        {
            id: 'bellman',
            path: '/bellman',
            label: t('departments.bellman') || 'البيلمان',
            shortLabel: t('departments.bellman') || 'بيلمان',
            icon: <BellRing className="w-4 h-4" />,
            color: '#F59E0B',
        },
        {
            id: 'coffeeshop',
            path: '/coffeeshop',
            label: t('departments.coffeeshop') || 'الكافي شوب',
            shortLabel: t('departments.coffeeshop') || 'كافي',
            icon: <Coffee className="w-4 h-4" />,
            color: '#78350F',
        },
        {
            id: 'maintenance',
            path: '/maintenance',
            label: t('departments.maintenance') || 'الصيانة',
            shortLabel: t('departments.maintenance') || 'صيانة',
            icon: <Wrench className="w-4 h-4" />,
            color: '#EF4444',
        },
        ...(isProcurementEnabled ? [{
            id: 'procurement',
            path: '/procurement',
            label: t('departments.procurement') || 'المشتريات',
            shortLabel: t('departments.procurement') || 'مشتريات',
            icon: <ShoppingCart className="w-4 h-4" />,
            color: '#10B981',
        }] : []),
    ];

    // Get active tab
    const getActiveTab = () => {
        const path = location.pathname;
        if (path.startsWith('/admin')) return 'admin';
        if (path.startsWith('/reception')) return 'reception';
        if (path.startsWith('/housekeeping')) return 'housekeeping';
        if (path.startsWith('/bellman')) return 'bellman';
        if (path.startsWith('/coffeeshop')) return 'coffeeshop';
        if (path.startsWith('/maintenance')) return 'maintenance';
        if (path.startsWith('/procurement')) return 'procurement';
        return 'admin';
    };

    const activeTab = getActiveTab();
    const activeTabData = departmentTabs.find(t => t.id === activeTab);

    // Update indicator position
    useEffect(() => {
        const activeRef = tabRefs.current[activeTab];
        if (activeRef) {
            const rect = activeRef.getBoundingClientRect();
            const parentRect = activeRef.parentElement?.getBoundingClientRect();
            if (parentRect) {
                setActiveIndicator({
                    left: activeRef.offsetLeft,
                    width: rect.width,
                });
            }
        }
    }, [activeTab, location.pathname]);

    // Handle tab click with animation
    const handleTabClick = (tab: DepartmentTab) => {
        navigate(tab.path);
    };

    // Handle branch switch
    const handleBranchSwitch = (newBranchId: string) => {
        setBranch(newBranchId);
        setShowBranchMenu(false);
        window.location.reload();
    };

    // Don't show for owners
    if (user?.role === 'owner') return null;

    return (
        <>
            {/* Main Header - Solid background to prevent visual pollution on scroll */}
            <header 
                className="fixed top-0 left-0 right-0 z-50 transition-colors duration-300"
                style={{
                    background: 'var(--theme-bg-primary)', // ✅ FIX: Theme-aware background (no white gaps in dark mode)
                    borderBottom: '1px solid var(--theme-border-primary)', // ✅ FIX: Theme-aware border
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    backdropFilter: 'none',
                    WebkitBackdropFilter: 'none',
                }}
            >
                {/* Top Bar - Logo, Branch, User Info, Actions - ✅ MOBILE-FIRST */}
                <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3 md:gap-4">
                    {/* Right Side - Menu Button (Mobile) + Logo + Branch - ✅ MOBILE-FIRST */}
                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
                        {/* ✅ Admin Menu Button - Mobile Only */}
                        <button
                            id="admin-menu-trigger"
                            onClick={() => {
                                // Dispatch custom event for AdminDashboard to handle
                                window.dispatchEvent(new CustomEvent('toggle-admin-sidebar'));
                            }}
                            className="lg:hidden p-1.5 sm:p-2 rounded-xl transition-all active:scale-95 flex-shrink-0"
                            style={{
                                background: activeTab === 'admin' 
                                    ? 'linear-gradient(135deg, #14b8a6, #0d9488)' 
                                    : 'var(--theme-bg-tertiary)',
                                border: '1px solid var(--theme-border-primary)',
                            }}
                            aria-label={t('sidebar.openAdminMenu') || 'فتح القائمة الإدارية'}
                        >
                            <Menu 
                                className="w-4 h-4 sm:w-5 sm:h-5" 
                                style={{ 
                                    color: activeTab === 'admin' ? 'white' : 'var(--theme-text-secondary)' 
                                }} 
                            />
                        </button>

                        <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Link to="/admin" className="flex items-center flex-shrink-0">
                                <img
                                    src="/adora-logo.png"
                                    alt="Adora"
                                    className="h-7 w-auto sm:h-8 object-contain"
                                    style={{ filter: 'var(--logo-filter, none)' }}
                                />
                            </Link>
                            {/* ✅ Header Offline Indicator - Simple dot (green/red) next to logo */}
                            <div
                                className="w-2.5 h-2.5 rounded-full transition-all duration-300 animate-pulse"
                                style={{
                                    background: isOnline 
                                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                                        : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                    boxShadow: isOnline 
                                        ? '0 0 8px rgba(16, 185, 129, 0.5)' 
                                        : '0 0 8px rgba(239, 68, 68, 0.5)',
                                    flexShrink: 0,
                                }}
                                title={isOnline ? (t('common.online') || 'متصل بالإنترنت') : (t('common.offline') || 'غير متصل بالإنترنت')}
                                aria-label={isOnline ? (t('common.online') || 'متصل') : (t('common.offline') || 'غير متصل')}
                            />
                        </div>

                        {/* Branch Selector - ✅ MOBILE-FIRST */}
                        {branches.length > 0 && (
                            <div className="relative flex-shrink-0">
                                <button
                                    onClick={() => branches.length > 1 && setShowBranchMenu(!showBranchMenu)}
                                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-[0.98] ${branches.length > 1 ? 'hover:bg-teal-500/10 cursor-pointer' : 'cursor-default'}`}
                                    style={{
                                        background: 'var(--theme-bg-secondary)',
                                        border: '1px solid var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)',
                                    }}
                                >
                                    <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-500 flex-shrink-0" />
                                    <span className="text-xs sm:text-sm font-medium truncate max-w-[80px] sm:max-w-none">{branchName}</span>
                                    {branches.length > 1 && (
                                        <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform flex-shrink-0 ${showBranchMenu ? 'rotate-180' : ''}`} />
                                    )}
                                </button>

                                {/* Branch Dropdown */}
                                {showBranchMenu && branches.length > 1 && (
                                    <>
                                        <div 
                                            className="fixed inset-0 z-40"
                                            onClick={() => setShowBranchMenu(false)}
                                        />
                                        <div 
                                            className="absolute top-full right-0 mt-2 w-48 rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                                            style={{
                                                background: 'var(--theme-bg-secondary)',
                                                border: '1px solid var(--theme-border-primary)',
                                                boxShadow: 'var(--theme-shadow-lg)',
                                            }}
                                        >
                                            {branches.map((branch) => (
                                                <button
                                                    key={branch.id}
                                                    onClick={() => handleBranchSwitch(branch.id)}
                                                    className={`
                                                        w-full px-4 py-2.5 text-right flex items-center gap-2 transition-colors
                                                        ${branch.id === branchId ? 'bg-teal-500/10 text-teal-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}
                                                    `}
                                                    style={{ color: branch.id === branchId ? '#14B8A6' : 'var(--theme-text-primary)' }}
                                                >
                                                    <Building2 className="w-4 h-4" />
                                                    <span className="text-sm">{branch.name}</span>
                                                    {branch.id === branchId && (
                                                        <span className="mr-auto text-teal-500">✓</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Center - Smart Time-based Greeting (Desktop) - Moved to right side */}
                    {/* ✅ FIX: Removed center greeting - now only in right side profile area */}
                    <div className="hidden md:flex items-center gap-2 flex-1 justify-center min-w-0">
                        {/* Empty center for better spacing */}
                    </div>

                    {/* Right Side - Actions + Smart Greeting - ✅ MOBILE-FIRST */}
                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
                        {/* ✅ Smart Greeting - Always Visible on Mobile & Desktop */}
                        {greeting && user?.name && (
                            <>
                                {/* Mobile: Compact Greeting Badge */}
                                <div className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all" 
                                     style={{ 
                                         background: 'var(--theme-bg-secondary)',
                                         borderColor: 'var(--theme-border-primary)'
                                     }}>
                                    <span className="text-xs">{greeting.emoji}</span>
                                    <span className="text-xs font-bold truncate max-w-[60px]" style={{ color: 'var(--theme-text-primary)' }}>
                                        {user.name.split(' ')[0]}
                                    </span>
                                </div>
                                
                                {/* Desktop: Full Greeting */}
                                <div className="hidden md:flex lg:hidden items-center gap-2 px-3 py-1.5 rounded-lg border transition-all" 
                                     style={{ 
                                         background: 'var(--theme-bg-secondary)',
                                         borderColor: 'var(--theme-border-primary)'
                                     }}>
                                    <span className="text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                        {greeting.emoji} {greeting.timeGreeting}
                                    </span>
                                    <span className="text-xs font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {user.name}
                                    </span>
                                </div>
                                
                                {/* Large Desktop: Full Greeting with Comma */}
                                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all" 
                                     style={{ 
                                         background: 'var(--theme-bg-secondary)',
                                         borderColor: 'var(--theme-border-primary)'
                                     }}>
                                    <span className="text-sm font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                        {greeting.emoji} {greeting.timeGreeting}،
                                    </span>
                                    <span className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {user.name}
                                    </span>
                                </div>
                            </>
                        )}
                        
                        {/* 🏆 Points Tracker - Golden Cup - Hidden on mobile to save space */}
                        {user?.id && (
                            <div className="hidden md:block">
                                <PointsTracker 
                                    employeeId={user.id} 
                                    inline 
                                    showHistory 
                                />
                            </div>
                        )}
                        
                        {/* 🌍 Language Switcher - Hidden on very small mobile */}
                        <div className="hidden sm:block">
                            <LanguageSwitcher />
                        </div>
                        
                        {/* 🌙 Dark Mode Toggle - Hidden on very small mobile */}
                        <div className="hidden sm:block">
                            <ThemeToggleButton />
                        </div>
                        
                        <button
                            onClick={logout}
                            className="p-1.5 sm:p-2 rounded-lg transition-all hover:bg-red-500/10 active:scale-95 text-red-500 flex-shrink-0"
                            title={t('auth.logout') || 'تسجيل الخروج'}
                        >
                            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    </div>
                </div>

                {/* Department Tabs - ✅ MOBILE-FIRST Smooth Navigation */}
                <div 
                    className="relative px-2 sm:px-3 lg:px-4 overflow-x-auto scrollbar-hide"
                    style={{ 
                        background: 'var(--theme-bg-primary)',
                        borderTop: '1px solid var(--theme-border-primary)',
                    }}
                >
                    <div className="flex items-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 relative min-w-max" data-tabs-container>
                        {/* Animated Indicator */}
                        <div
                            className="absolute bottom-0 h-0.5 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full transition-all duration-300 ease-out"
                            style={{
                                left: activeIndicator.left,
                                width: activeIndicator.width,
                            }}
                        />

                        {/* Tabs - ✅ MOBILE-FIRST Modern Design with Smooth Animations */}
                        {departmentTabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    ref={(el) => tabRefs.current[tab.id] = el}
                                    onClick={() => handleTabClick(tab)}
                                    title={tab.label}
                                    className={`
                                        relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 
                                        px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 
                                        rounded-lg sm:rounded-xl 
                                        min-w-[48px] sm:min-w-[56px] lg:min-w-[64px]
                                        transition-all duration-200 ease-out
                                        ${isActive 
                                            ? 'scale-[1.02]' 
                                            : 'hover:bg-teal-50/50 dark:hover:bg-teal-900/20 active:scale-[0.98]'
                                        }
                                    `}
                                    style={{
                                        background: isActive 
                                            ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.25) 0%, rgba(13, 148, 136, 0.2) 100%)'
                                            : 'transparent',
                                        color: isActive ? '#14b8a6' : 'var(--theme-text-secondary)',
                                        boxShadow: isActive ? '0 2px 12px rgba(20, 184, 166, 0.25)' : 'none',
                                        border: isActive ? '1px solid rgba(20, 184, 166, 0.5)' : '1px solid transparent',
                                    }}
                                >
                                    {/* Icon - Responsive sizing */}
                                    <span className="transition-transform duration-200">
                                        {React.cloneElement(tab.icon as React.ReactElement, {
                                            className: `w-5 h-5 sm:w-5 sm:h-5 lg:w-4 lg:h-4 transition-colors duration-200 ${isActive ? 'text-teal-500 dark:text-teal-400' : 'text-current'}`
                                        })}
                                    </span>
                                    {/* Label - Responsive: hidden on mobile, short on tablet, full on desktop */}
                                    <span className={`hidden sm:block text-[10px] lg:text-xs font-semibold whitespace-nowrap leading-tight transition-colors duration-200 ${isActive ? 'text-teal-600 dark:text-teal-300' : 'text-current'}`}>
                                        <span className="hidden lg:inline">{tab.label}</span>
                                        <span className="lg:hidden">{tab.shortLabel}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </header>

            {/* Spacer to prevent content from going under fixed header - ✅ MOBILE-FIRST */}
            <div className="h-[88px] sm:h-[96px] lg:h-[92px]" />
        </>
    );
};

export default UnifiedManagerHeader;
