/**
 * Unified Manager Header
 * Sticky navigation header for managers with department tabs
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenantBranches } from '../../hooks/useTenantData';
import { useFeatureGate } from '../../hooks/useFeatureGate';

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
    const { user, logout, branchId, setBranch } = useAuth();
    const { branches } = useTenantBranches();
    const { isEnabled: isProcurementEnabled } = useFeatureGate('procurementSystem');
    
    const [showBranchMenu, setShowBranchMenu] = useState(false);
    const [activeIndicator, setActiveIndicator] = useState({ left: 0, width: 0 });
    const tabRefs = React.useRef<{ [key: string]: HTMLButtonElement | null }>({});

    // Current branch name
    const currentBranch = branches.find(b => b.id === branchId);
    const branchName = currentBranch?.name || 'الفرع';

    // Define department tabs
    const departmentTabs: DepartmentTab[] = [
        {
            id: 'admin',
            path: '/admin',
            label: 'لوحة التحكم',
            shortLabel: 'التحكم',
            icon: <LayoutDashboard className="w-4 h-4" />,
            color: '#14B8A6',
        },
        {
            id: 'reception',
            path: '/reception',
            label: 'الاستقبال',
            shortLabel: 'استقبال',
            icon: <Phone className="w-4 h-4" />,
            color: '#3B82F6',
        },
        {
            id: 'housekeeping',
            path: '/housekeeping',
            label: 'الهاوس كيبنج',
            shortLabel: 'هاوس',
            icon: <Sparkles className="w-4 h-4" />,
            color: '#8B5CF6',
        },
        {
            id: 'bellman',
            path: '/bellman',
            label: 'البيلمان',
            shortLabel: 'بيلمان',
            icon: <BellRing className="w-4 h-4" />,
            color: '#F59E0B',
        },
        {
            id: 'coffeeshop',
            path: '/coffeeshop',
            label: 'الكافي شوب',
            shortLabel: 'كافي',
            icon: <Coffee className="w-4 h-4" />,
            color: '#78350F',
        },
        {
            id: 'maintenance',
            path: '/maintenance',
            label: 'الصيانة',
            shortLabel: 'صيانة',
            icon: <Wrench className="w-4 h-4" />,
            color: '#EF4444',
        },
        ...(isProcurementEnabled ? [{
            id: 'procurement',
            path: '/procurement',
            label: 'المشتريات',
            shortLabel: 'مشتريات',
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
                className="fixed top-0 left-0 right-0 z-50"
                style={{
                    background: '#ffffff', // Solid white - no transparency
                    borderBottom: '1px solid var(--theme-border-primary)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    backdropFilter: 'none',
                    WebkitBackdropFilter: 'none',
                }}
            >
            {/* Dark mode override for header */}
            <style>{`
                .dark header[class*="fixed"] {
                    background: #0f172a !important;
                }
            `}</style>
                {/* Top Bar - Logo, Branch, Actions */}
                <div className="px-3 lg:px-6 py-2 flex items-center justify-between">
                    {/* Right Side - Menu Button (Mobile) + Logo */}
                    <div className="flex items-center gap-3">
                        {/* ✅ Admin Menu Button - Mobile Only */}
                        <button
                            id="admin-menu-trigger"
                            onClick={() => {
                                // Dispatch custom event for AdminDashboard to handle
                                window.dispatchEvent(new CustomEvent('toggle-admin-sidebar'));
                            }}
                            className="lg:hidden p-2 rounded-xl transition-all active:scale-95"
                            style={{
                                background: activeTab === 'admin' 
                                    ? 'linear-gradient(135deg, #14b8a6, #0d9488)' 
                                    : 'var(--theme-bg-tertiary)',
                                border: '1px solid var(--theme-border-primary)',
                            }}
                            aria-label="فتح القائمة الإدارية"
                        >
                            <Menu 
                                className="w-5 h-5" 
                                style={{ 
                                    color: activeTab === 'admin' ? 'white' : 'var(--theme-text-secondary)' 
                                }} 
                            />
                        </button>

                        <Link to="/admin" className="flex items-center">
                            <img
                                src="/adora-logo.png"
                                alt="Adora"
                                className="h-8 w-auto object-contain"
                                style={{ filter: 'var(--logo-filter, none)' }}
                            />
                        </Link>

                        {/* Branch Selector */}
                        {branches.length > 1 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowBranchMenu(!showBranchMenu)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-teal-500/10"
                                    style={{
                                        background: 'var(--theme-bg-secondary)',
                                        border: '1px solid var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)',
                                    }}
                                >
                                    <Building2 className="w-4 h-4 text-teal-500" />
                                    <span className="text-sm font-medium hidden sm:inline">{branchName}</span>
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showBranchMenu ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Branch Dropdown */}
                                {showBranchMenu && (
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

                    {/* Left Side - Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={logout}
                            className="p-2 rounded-lg transition-all hover:bg-red-500/10 text-red-500"
                            title="تسجيل الخروج"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Department Tabs - Solid background to prevent text overlap */}
                <div 
                    className="relative px-2 lg:px-4 overflow-x-auto scrollbar-hide"
                    style={{ 
                        background: '#ffffff', // Solid white background
                        borderTop: '1px solid var(--theme-border-primary)',
                    }}
                >
                    {/* Dark mode override */}
                    <style>{`
                        .dark [data-tabs-container] {
                            background: #1e293b !important;
                        }
                    `}</style>
                    <div className="flex items-center gap-1 py-1.5 relative min-w-max" data-tabs-container>
                        {/* Animated Indicator */}
                        <div
                            className="absolute bottom-0 h-0.5 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full transition-all duration-300 ease-out"
                            style={{
                                left: activeIndicator.left,
                                width: activeIndicator.width,
                            }}
                        />

                        {/* Tabs */}
                        {departmentTabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    ref={(el) => tabRefs.current[tab.id] = el}
                                    onClick={() => handleTabClick(tab)}
                                    className={`
                                        relative flex items-center gap-1.5 px-3 lg:px-4 py-2 rounded-lg transition-all duration-200
                                        ${isActive 
                                            ? 'text-white' 
                                            : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }
                                    `}
                                    style={{
                                        background: isActive 
                                            ? `linear-gradient(135deg, ${tab.color} 0%, ${tab.color}dd 100%)`
                                            : 'transparent',
                                        color: isActive ? 'white' : 'var(--theme-text-secondary)',
                                        boxShadow: isActive ? `0 4px 12px ${tab.color}40` : 'none',
                                    }}
                                >
                                    {tab.icon}
                                    <span className="text-xs lg:text-sm font-medium whitespace-nowrap">
                                        <span className="hidden lg:inline">{tab.label}</span>
                                        <span className="lg:hidden">{tab.shortLabel}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </header>

            {/* Spacer to prevent content from going under fixed header */}
            <div className="h-[100px] lg:h-[92px]" />
        </>
    );
};

export default UnifiedManagerHeader;
