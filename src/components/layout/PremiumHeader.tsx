/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Premium Header Component
 * Architectural redesign for spacious, professional, Turquoise-branded experience
 * Adora Hotel Management System V3
 * 
 * 🎨 DESIGN PHILOSOPHY:
 * - Two-tier layout: Identity Bar (top) + Navigation Bar (bottom)
 * - Generous spacing with breathing room
 * - Progressive disclosure: Hide secondary actions in dropdown
 * - Mobile-first with intelligent collapsing
 * - Turquoise DNA with glassmorphism accents
 * - Smooth, fluid transitions throughout
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    LogOut,
    Building2,
    ChevronDown,
    MoreVertical,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTenantBranches } from '../../hooks/useTenantData';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { PointsTracker } from '../shared/PointsTracker';
import { ThemeToggleButton } from '../common/ThemeToggle';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { getGreetingParts } from '../../utils/greetings';
import { ADORA_THEME } from '../../design/adoraTheme';

interface DepartmentTab {
    id: string;
    path: string;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    color: string;
}

export const PremiumHeader: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, logout, branchId, setBranch } = useAuth();
    const { branches } = useTenantBranches();
    const { isEnabled: isProcurementEnabled } = useFeatureGate('procurementSystem');
    
    const [showBranchMenu, setShowBranchMenu] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [activeIndicator, setActiveIndicator] = useState({ left: 0, width: 0 });
    const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

    // Current branch name
    const currentBranch = branches.find(b => b.id === branchId);
    const branchName = currentBranch?.name || t('sidebar.branch') || 'الفرع';

    // Smart Time-based Greeting
    const greeting = useMemo(() => {
        if (!user?.name) return null;
        return getGreetingParts(user.name, t);
    }, [user?.name, t]);

    // Define department tabs
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

    // Click outside handler for Actions Menu
    const actionsMenuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
                setShowActionsMenu(false);
            }
        };
        if (showActionsMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showActionsMenu]);

    // Update indicator position with smooth animation
    useEffect(() => {
        const activeRef = tabRefs.current[activeTab];
        if (activeRef) {
            // Use requestAnimationFrame for smooth transitions
            requestAnimationFrame(() => {
                setActiveIndicator({
                    left: activeRef.offsetLeft,
                    width: activeRef.getBoundingClientRect().width,
                });
            });
        }
    }, [activeTab, location.pathname]);

    // Handle tab click with smooth navigation
    const handleTabClick = (tab: DepartmentTab) => {
        navigate(tab.path);
    };

    // Handle branch switch
    const handleBranchSwitch = (newBranchId: string) => {
        setBranch(newBranchId);
        setShowBranchMenu(false);
        window.location.reload();
    };

    // Close menus on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showBranchMenu || showActionsMenu) {
                const target = event.target as HTMLElement;
                if (!target.closest('[data-menu-container]')) {
                    setShowBranchMenu(false);
                    setShowActionsMenu(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showBranchMenu, showActionsMenu]);

    // Don't show for owners
    if (user?.role === 'owner') return null;

    return (
        <>
            {/* 🎨 PREMIUM HEADER - Two-Tier Architecture with Turquoise DNA */}
            <header 
                className="sticky top-0 transition-all duration-300 ease-out"
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: ADORA_THEME.zIndex.header,
                    background: 'var(--theme-bg-primary)',
                    borderBottom: '1px solid var(--theme-border-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'visible',
                }}
            >
                {/* TIER 1: Identity Bar - Logo, Branch, User, Primary Actions */}
                <div 
                    className="px-4 sm:px-6 lg:px-8"
                    style={{
                        height: '64px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: `0 ${ADORA_THEME.spacing.lg}`,
                        borderBottom: `1px solid ${ADORA_THEME.colors.border}`,
                    }}
                >
                    <div className="flex items-center justify-between w-full" style={{ gap: ADORA_THEME.spacing.md }}>
                        {/* LEFT: Logo + Branch (RTL) */}
                        <div className="flex items-center flex-shrink-0" style={{ gap: '12px' }}>
                            {/* Admin Menu Button - Mobile Only */}
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('toggle-admin-sidebar'))}
                                className="lg:hidden p-2.5 rounded-xl transition-all duration-200 active:scale-95 hover:scale-105"
                                style={{
                                    background: activeTab === 'admin' 
                                        ? `linear-gradient(135deg, ${ADORA_THEME.colors.primary}, #0d9488)` 
                                        : 'var(--theme-bg-secondary)',
                                    border: '1px solid var(--theme-border-primary)',
                                }}
                                aria-label={t('sidebar.openAdminMenu') || 'فتح القائمة الإدارية'}
                            >
                                <Menu 
                                    className="w-5 h-5 transition-colors duration-200" 
                                    style={{ 
                                        color: activeTab === 'admin' ? 'white' : 'var(--theme-text-secondary)' 
                                    }} 
                                />
                            </button>

                            {/* ADORA Logo - Prominent with Turquoise Glow */}
                            <Link 
                                to="/admin" 
                                className="flex items-center flex-shrink-0 group transition-transform duration-300 hover:scale-105"
                            >
                                <img
                                    src="/adora-logo.png"
                                    alt="Adora"
                                    className="h-9 sm:h-10 lg:h-11 w-auto object-contain transition-all duration-300"
                                    style={{ 
                                        filter: 'var(--logo-filter, none) drop-shadow(0 2px 8px rgba(20, 184, 166, 0.2))',
                                    }}
                                />
                            </Link>

                            {/* Branch Selector - Spacious Design with Turquoise Accent */}
                            {/* Always show branch selector, even if branches array is empty */}
                            <div 
                                className="flex-shrink-0" 
                                data-menu-container
                                style={{
                                    position: 'relative',
                                    display: 'inline-block',
                                }}
                            >
                                <button
                                    onClick={() => branches.length > 1 && setShowBranchMenu(!showBranchMenu)}
                                    className={`
                                        flex items-center px-3.5 sm:px-4 py-2.5 rounded-xl 
                                        transition-all duration-200 active:scale-[0.98] hover:scale-[1.02]
                                        ${branches.length > 1 
                                            ? 'hover:bg-teal-500/10 cursor-pointer hover:border-teal-500/30' 
                                            : 'cursor-default'
                                        }
                                    `}
                                    style={{ 
                                        background: 'var(--theme-bg-secondary)',
                                        border: '1px solid var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)',
                                    }}
                                >
                                    <Building2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 transition-colors duration-200" style={{ color: ADORA_THEME.colors.primary }} />
                                    <span className="text-sm sm:text-base font-semibold truncate max-w-[120px] sm:max-w-[160px]">
                                        {branchName}
                                    </span>
                                    {branches.length > 1 && (
                                        <ChevronDown 
                                            className={`w-4 h-4 transition-transform duration-300 ease-out flex-shrink-0 ${
                                                showBranchMenu ? 'rotate-180' : ''
                                            }`} 
                                        />
                                    )}
                                </button>

                                    {/* Branch Dropdown - Premium Styling WITHOUT Backdrop */}
                                    {showBranchMenu && branches.length > 1 && (
                                        <div 
                                            className=""
                                            style={{
                                                position: 'absolute',
                                                top: 'calc(100% + 5px)',
                                                right: 0,
                                                zIndex: ADORA_THEME.zIndex.dropdown,
                                                background: 'var(--theme-bg-secondary)',
                                                minWidth: '220px',
                                                borderRadius: '16px',
                                                border: '1px solid var(--theme-border-primary)',
                                                boxShadow: 'var(--theme-shadow-lg)',
                                                overflow: 'hidden',
                                            }}
                                        >
                                                <div className="p-2">
                                                    {branches.map((branch) => (
                                                        <button
                                                            key={branch.id}
                                                            onClick={() => handleBranchSwitch(branch.id)}
                                                            className={`
                                                                w-full px-4 py-3 text-right flex items-center gap-3 
                                                                transition-all duration-200 rounded-xl mb-1 last:mb-0
                                                                ${branch.id === branchId 
                                                                    ? 'bg-teal-500/15 text-teal-600 border border-teal-500/30' 
                                                                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-teal-500/20'
                                                                }
                                                            `}
                                                            style={{ 
                                                                color: branch.id === branchId 
                                                                    ? '#14B8A6' 
                                                                    : 'var(--theme-text-primary)',
                                                                border: branch.id === branchId 
                                                                    ? '1px solid rgba(20, 184, 166, 0.3)' 
                                                                    : '1px solid transparent',
                                                            }}
                                                        >
                                                            <Building2 className="w-4 h-4 flex-shrink-0 text-teal-500" />
                                                            <span className="text-sm font-medium flex-1">{branch.name}</span>
                                                            {branch.id === branchId && (
                                                                <span className="text-teal-500 text-lg transition-transform duration-200">✓</span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                    )}
                            </div>
                        </div>

                        {/* CENTER: Smart Greeting - Desktop Only (Subtle, Non-Distracting) */}
                        {greeting && user?.name && (
                            <div 
                                className="hidden lg:flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 hover:bg-teal-500/5"
                                style={{ 
                                    background: 'var(--theme-bg-secondary)',
                                    border: '1px solid var(--theme-border-primary)'
                                }}
                            >
                                <span className="text-lg transition-transform duration-200">{greeting.emoji}</span>
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                        {greeting.timeGreeting}
                                    </span>
                                    <span className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {user.name}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* RIGHT: User Actions - Clean & Spacious */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                            {/* Mobile: Compact Greeting Only */}
                            {greeting && user?.name && (
                                <div 
                                    className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200 hover:bg-teal-500/5" 
                                    style={{ 
                                        background: 'var(--theme-bg-secondary)',
                                        borderColor: 'var(--theme-border-primary)'
                                    }}
                                >
                                    <span className="text-sm">{greeting.emoji}</span>
                                    <span className="text-xs font-bold truncate max-w-[60px]" style={{ color: 'var(--theme-text-primary)' }}>
                                        {user.name.split(' ')[0]}
                                    </span>
                                </div>
                            )}

                            {/* Points Tracker - Desktop Only (XL screens) */}
                            {user?.id && (
                                <div className="hidden xl:block">
                                    <PointsTracker 
                                        employeeId={user.id} 
                                        inline 
                                        showHistory 
                                    />
                                </div>
                            )}

                            {/* Actions Menu - All Secondary Actions Here - ADORA MASTER UI PROTOCOL V3.1 */}
                            <div 
                                ref={actionsMenuRef}
                                className="relative" 
                                data-menu-container
                                style={{
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    padding: '8px 16px',
                                    cursor: 'pointer',
                                    gap: '6px',
                                    transition: 'all 0.2s ease-in-out',
                                }}
                                onMouseEnter={(e) => {
                                    if (!showActionsMenu) {
                                        e.currentTarget.style.color = ADORA_THEME.colors.primary;
                                        e.currentTarget.style.background = 'rgba(32, 178, 170, 0.04)';
                                        e.currentTarget.style.borderRadius = '12px';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!showActionsMenu) {
                                        e.currentTarget.style.color = ADORA_THEME.colors.text;
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.borderRadius = '0';
                                    }
                                }}
                            >
                                <button
                                    onClick={() => setShowActionsMenu(!showActionsMenu)}
                                    className="transition-all duration-200 active:scale-95"
                                    style={{
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: '12px',
                                        background: 'var(--theme-bg-secondary)',
                                        border: '1px solid var(--theme-border-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        ...(showActionsMenu ? {
                                            borderColor: ADORA_THEME.colors.primary,
                                            background: 'var(--theme-bg-primary)',
                                            boxShadow: '0 4px 12px rgba(32, 178, 170, 0.1)',
                                        } : {}),
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!showActionsMenu) {
                                            e.currentTarget.style.borderColor = ADORA_THEME.colors.primary;
                                            e.currentTarget.style.background = 'var(--theme-bg-primary)';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(32, 178, 170, 0.1)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!showActionsMenu) {
                                            e.currentTarget.style.background = 'var(--theme-bg-secondary)';
                                            e.currentTarget.style.borderColor = 'var(--theme-border-primary)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }
                                    }}
                                    aria-label="الإعدادات"
                                >
                                    <MoreVertical className="w-5 h-5 transition-transform duration-200" style={{ color: 'var(--theme-text-primary)' }} />
                                    {/* Badge for Points on Mobile - ADORA MASTER UI PROTOCOL V3.1 */}
                                    {user?.id && (
                                        <span 
                                            className="xl:hidden flex items-center justify-center"
                                            style={{
                                                position: 'absolute !important',
                                                top: '-4px',
                                                right: '-4px',
                                                background: `${ADORA_THEME.colors.primary} !important`,
                                                color: 'white',
                                                fontSize: '10px',
                                                fontWeight: 700,
                                                minWidth: '18px',
                                                height: '18px',
                                                borderRadius: '50%',
                                                border: '2px solid var(--theme-bg-primary) !important',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                zIndex: 10,
                                            }}
                                        >
                                            0
                                        </span>
                                    )}
                                </button>

                                {/* Actions Dropdown - Premium Styling WITHOUT Backdrop */}
                                {showActionsMenu && (
                                    <div 
                                        className=""
                                        style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 5px)',
                                            right: 0,
                                            zIndex: ADORA_THEME.zIndex.dropdown,
                                            background: 'var(--theme-bg-secondary)',
                                            minWidth: '220px',
                                            borderRadius: '16px',
                                            border: '1px solid var(--theme-border-primary)',
                                            boxShadow: 'var(--theme-shadow-lg)',
                                            overflow: 'hidden',
                                        }}
                                    >
                                            <div style={{ padding: '8px' }}>
                                                {/* Points Tracker - Mobile/Tablet */}
                                                {user?.id && (
                                                    <>
                                                        <div className="xl:hidden px-3 py-2 mb-2">
                                                            <PointsTracker 
                                                                employeeId={user.id} 
                                                                inline 
                                                                showHistory 
                                                            />
                                                        </div>
                                                        <div className="h-px my-2" style={{ background: 'var(--theme-border-primary)' }} />
                                                    </>
                                                )}

                                                {/* Language Switcher */}
                                                <div className="px-3 py-2.5 mb-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-200">
                                                    <LanguageSwitcher />
                                                </div>
                                                
                                                {/* Theme Toggle */}
                                                <div className="px-3 py-2.5 mb-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-200">
                                                    <ThemeToggleButton />
                                                </div>

                                                {/* Divider */}
                                                <div className="h-px my-2" style={{ background: 'var(--theme-border-primary)' }} />

                                                {/* Logout */}
                                                <button
                                                    onClick={() => {
                                                        setShowActionsMenu(false);
                                                        logout();
                                                    }}
                                                    className="w-full px-4 py-3 text-right flex items-center gap-3 rounded-xl transition-all duration-200 hover:bg-red-500/10 text-red-500 hover:scale-[1.02]"
                                                >
                                                    <LogOut className="w-4 h-4 transition-transform duration-200" />
                                                    <span className="text-sm font-medium">{t('auth.logout') || 'تسجيل الخروج'}</span>
                                                </button>
                                            </div>
                                        </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* TIER 2: Navigation Bar - Department Tabs with Turquoise DNA */}
                <nav 
                    className="relative"
                    style={{ 
                        background: 'var(--theme-bg-primary)',
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '16px',
                        padding: ADORA_THEME.spacing.md,
                        flexWrap: 'nowrap',
                        overflowX: 'auto',
                    }}
                >
                    <div className="flex items-center overflow-x-auto scrollbar-hide relative min-w-max" style={{ gap: '16px', flexWrap: 'nowrap' }}>
                        {/* Active Indicator - ADORA Turquoise DNA */}
                        <div
                            className="absolute bottom-0 transition-all duration-500 ease-out"
                            style={{
                                left: activeIndicator.left,
                                width: activeIndicator.width,
                                height: '4px',
                                background: ADORA_THEME.colors.primary,
                                borderRadius: '2px 2px 0 0',
                                position: 'absolute',
                                bottom: 0,
                            }}
                        />

                        {/* Department Tabs - Spacious Design with Turquoise Hover */}
                        {departmentTabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    ref={(el) => tabRefs.current[tab.id] = el}
                                    onClick={() => handleTabClick(tab)}
                                    title={tab.label}
                                    className={`
                                        relative transition-all duration-200
                                        ${isActive 
                                            ? 'scale-[1.02]' 
                                            : 'hover:scale-[1.01] active:scale-[0.98]'
                                        }
                                    `}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '12px 16px',
                                        background: isActive 
                                            ? `linear-gradient(135deg, ${ADORA_THEME.colors.primary}18, ${ADORA_THEME.colors.primary}12)`
                                            : 'transparent',
                                        color: isActive ? ADORA_THEME.colors.primary : 'var(--theme-text-primary)',
                                        border: isActive 
                                            ? `1px solid ${ADORA_THEME.colors.primary}4D` 
                                            : '1px solid transparent',
                                        borderRadius: '12px',
                                        transition: 'all 0.2s',
                                        ...(isActive ? {} : {
                                            ':hover': {
                                                background: 'rgba(32, 178, 170, 0.05)',
                                                color: ADORA_THEME.colors.primary,
                                            }
                                        }),
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'rgba(32, 178, 170, 0.05)';
                                            e.currentTarget.style.color = ADORA_THEME.colors.primary;
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.color = ADORA_THEME.colors.text;
                                        }
                                    }}
                                >
                                    {/* Duo-tone Icon - Primary color for active, muted for inactive */}
                                    <span className="transition-all duration-300">
                                        {React.cloneElement(tab.icon as React.ReactElement, {
                                            className: `w-5 h-5 sm:w-5 sm:h-5 lg:w-6 lg:h-6 transition-colors duration-200`,
                                            style: {
                                                color: isActive 
                                                    ? ADORA_THEME.colors.primary 
                                                    : 'var(--theme-text-primary)',
                                                opacity: isActive ? 1 : 0.6,
                                            }
                                        })}
                                    </span>
                                    
                                    {/* Label - Responsive with Turquoise on Active */}
                                    <span className={`
                                        text-[10px] sm:text-xs lg:text-sm font-semibold whitespace-nowrap 
                                        leading-tight transition-all duration-300
                                        ${isActive 
                                            ? 'text-teal-600 dark:text-teal-400 font-bold' 
                                            : 'text-current'
                                        }
                                    `}>
                                        <span className="hidden lg:inline">{tab.label}</span>
                                        <span className="lg:hidden">{tab.shortLabel}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </nav>
            </header>


            {/* CSS Animation for Dropdowns */}
            <style>{`
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </>
    );
};

export default PremiumHeader;
