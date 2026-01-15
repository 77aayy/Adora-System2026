import React, { useEffect } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Settings,
    Package,
    Calendar,
    Shirt,
    Building2,
    ChevronDown,
    DollarSign,
    HandCoins,
    ArrowLeft,
    LogOut,
    Crown,
    DoorOpen,
    BarChart3,
    Search,
    Layers,
    Target,
    Globe,
    Activity,
    ShieldCheck,
    Mail,
    Bell,
    Award
} from 'lucide-react';
import { BookOpen, MessageCircle, Radio, Languages } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenantBranches } from '../../hooks/useTenantData';
import { useTenant } from '../../context/TenantContext';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { useTheme } from '../../context/ThemeContext'; // ✅ Use theme context
import { Branch } from '../../types';
import { subscribeToTicketStatus, type SupportTicketStatus } from '../../services/supportTicketService';

interface AdminSidebarProps {
    isOwner: boolean;
    onClose?: () => void; // ✅ For mobile closing
    className?: string;   // ✅ For custom styling
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOwner, onClose, className = '' }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { branchId, setBranch, logout, user } = useAuth(); // ✅ Get logout function & User
    const { branches } = useTenantBranches();
    const { tenantId } = useTenant();
    const { isDark } = useTheme(); // ✅ Use theme context for live updates
    const [ticketStatus, setTicketStatus] = React.useState<SupportTicketStatus | null>(null);

    // ✅ Filter Branches based on Access Control (SaaS Dynamic)
    const filteredBranches = React.useMemo<Branch[]>(() => {
        if (!branches || branches.length === 0) return [];

        // 1. Owner: Access All
        if (isOwner || user?.role === 'owner') return branches;

        // 2. Manager: Access Assigned Only (or all if no branchCodes specified)
        if (user?.role === 'manager') {
            const assignedCodes = (user as any).branchCodes || [];
            // ✅ If no branchCodes specified, give access to all branches (backward compatibility)
            if (assignedCodes.length === 0) {
                return branches;
            }
            // ✅ Filter by assigned codes
            return branches.filter(b => {
                const branchCode = (b as any).code || '';
                return assignedCodes.includes(branchCode);
            });
        }

        // 3. Employee: Access Current Only (Fallback)
        return branches.filter(b => b.id === branchId);
    }, [branches, isOwner, user, branchId]);

    const [expandedSections, setExpandedSections] = React.useState<string[]>(['dashboard']);

    const toggleSection = (section: string) => {
        setExpandedSections(prev =>
            prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
        );
    };

    // ✅ OWNER vs MANAGER: Completely different menu structures
    const isOwnerRole = isOwner || user?.role === 'owner';
    
    // ✅ OWNER MENU: Streamlined - all tabs point to EnhancedOwnerDashboard
    const ownerSections = [
        {
            id: 'dashboard',
            label: 'لوحة التحكم',
            icon: <Crown className="w-4 h-4" style={{ color: 'var(--theme-accent-yellow)' }} />,
            items: [
                { to: '/owner-dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: 'الرئيسية', end: true },
                { to: '/owner-dashboard?tab=tenants', icon: <Users className="w-4 h-4" />, label: 'إدارة المشتركين' },
                { to: '/owner-dashboard?tab=billing', icon: <DollarSign className="w-4 h-4" />, label: 'الفواتير' },
                { to: '/owner-dashboard?tab=broadcasts', icon: <Bell className="w-4 h-4" />, label: 'الرسائل والإعلانات' },
            ]
        },
        {
            id: 'settings',
            label: 'الإعدادات',
            icon: <Settings className="w-4 h-4" style={{ color: 'var(--theme-accent-blue)' }} />,
            items: [
                { to: '/owner-dashboard?tab=settings', icon: <Settings className="w-4 h-4" />, label: 'إعدادات النظام' },
                { to: '/owner-dashboard?tab=core-config', icon: <ShieldCheck className="w-4 h-4" />, label: '🔐 التأسيس' },
            ]
        },
        {
            id: 'support',
            label: 'الدعم الفني',
            icon: <Mail className="w-4 h-4" style={{ color: 'var(--theme-accent-purple)' }} />,
            items: [
                { 
                    to: '/admin/support-tickets', 
                    icon: <Mail className="w-4 h-4" />, 
                    label: 'تذاكر الدعم',
                    badge: ticketStatus && ticketStatus.unreadCount > 0 ? ticketStatus.unreadCount : undefined
                }
            ]
        }
    ];
    
    // ✅ Feature Gates: Check which features are enabled
    const { isEnabled: isInventoryEnabled } = useFeatureGate('inventoryManagement');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isEnabled: _isProcurementEnabled } = useFeatureGate('procurementSystem');
    const { isEnabled: isLaundryEnabled } = useFeatureGate('laundryManagement');
    const { isEnabled: isPointsEnabled } = useFeatureGate('pointsSystem');
    const { isEnabled: isScheduledTasksEnabled } = useFeatureGate('scheduledTasks');
    const { isEnabled: isWhatsAppEnabled } = useFeatureGate('whatsappIntegration');

    // ✅ MANAGER MENU: Reorganized with professional grouping
    const managerSections = [
        {
            id: 'dashboard',
            label: 'لوحة التحكم',
            icon: <LayoutDashboard className="w-4 h-4" style={{ color: 'var(--theme-primary-500)' }} />,
            items: [
                { to: '/admin', icon: <LayoutDashboard className="w-4 h-4" />, label: 'نظرة عامة', end: true },
                { to: '/admin/pulse', icon: <Activity className="w-4 h-4" />, label: '⏱️ النبض اللحظي' },
            ]
        },
        {
            id: 'facilities',
            label: 'إدارة المنشأة',
            icon: <Building2 className="w-4 h-4" style={{ color: 'var(--theme-primary-500)' }} />,
            items: [
                { to: '/admin/branches', icon: <Globe className="w-4 h-4" />, label: 'الفروع' },
                { to: '/admin/rooms', icon: <DoorOpen className="w-4 h-4" />, label: 'الغرف والأدوار' },
                { to: '/admin/employees', icon: <Users className="w-4 h-4" />, label: 'الموظفين' },
            ]
        },
        {
            id: 'operations',
            label: 'العمليات اليومية',
            icon: <Layers className="w-4 h-4" style={{ color: 'var(--theme-accent-purple)' }} />,
            items: [
                { to: '/admin/chat-monitor', icon: <Radio className="w-4 h-4" />, label: '📡 رادار الشات' },
                { to: '/admin/chat-settings', icon: <MessageCircle className="w-4 h-4" />, label: '💬 إعدادات الشات' },
                ...(isScheduledTasksEnabled ? [{ to: '/admin/tasks', icon: <Calendar className="w-4 h-4" />, label: 'أوامر الشغل' }] : []),
            ]
        },
        {
            id: 'inventory',
            label: 'المخزون والمستودعات',
            icon: <Package className="w-4 h-4" style={{ color: 'var(--theme-accent-orange)' }} />,
            items: [
                ...(isInventoryEnabled ? [{ to: '/admin/inventory', icon: <Package className="w-4 h-4" />, label: 'المخزون' }] : []),
                ...(isLaundryEnabled ? [{ to: '/admin/laundry', icon: <Shirt className="w-4 h-4" />, label: 'المغسلة' }] : []),
                { to: '/admin/lost-found', icon: <Search className="w-4 h-4" />, label: 'المفقودات' },
            ]
        },
        {
            id: 'finance',
            label: 'المالية والتحفيز',
            icon: <DollarSign className="w-4 h-4" style={{ color: 'var(--theme-accent-green)' }} />,
            items: [
                { to: '/admin/prices', icon: <DollarSign className="w-4 h-4" />, label: 'تعديل الأسعار' },
                ...(isPointsEnabled ? [
                    { to: '/admin/points', icon: <Target className="w-4 h-4" />, label: 'قواعد النقاط' },
                    { to: '/admin/gamification', icon: <Award className="w-4 h-4" />, label: 'الشارات والرتب' },
                    { to: '/admin/payouts', icon: <HandCoins className="w-4 h-4" />, label: 'صرف النقاط' },
                ] : []),
            ]
        },
        {
            id: 'settings',
            label: 'الإعدادات والتكوين',
            icon: <Settings className="w-4 h-4" style={{ color: 'var(--theme-text-tertiary)' }} />,
            items: [
                { to: '/admin/settings', icon: <Settings className="w-4 h-4" />, label: 'إدارة التطبيق' },
                { to: '/admin/auto-transfer', icon: <Activity className="w-4 h-4" />, label: 'التحويل التلقائي' },
                { to: '/admin/translations', icon: <Languages className="w-4 h-4" />, label: '🌍 إدارة الترجمات' },
                ...(isWhatsAppEnabled ? [{ to: '/admin/whatsapp-templates', icon: <MessageCircle className="w-4 h-4" />, label: 'نماذج WhatsApp' }] : []),
            ]
        },
        {
            id: 'communications',
            label: 'الاتصالات والإعلانات',
            icon: <Bell className="w-4 h-4" style={{ color: 'var(--theme-accent-yellow)' }} />,
            items: [
                { to: '/admin/manager-announcements', icon: <Bell className="w-4 h-4" />, label: 'الرسائل العاجلة للأقسام' },
                { to: '/admin/general-instructions', icon: <BookOpen className="w-4 h-4" />, label: 'التعليمات العامة' },
            ]
        }
    ];
    
    // ✅ Use appropriate sections based on role
    const sections = isOwnerRole ? ownerSections : managerSections;

    // ✅ Subscribe to ticket status (for owner only)
    useEffect(() => {
        if (!isOwner || !tenantId) return;

        const unsub = subscribeToTicketStatus(tenantId, (status) => {
            setTicketStatus(status);
        });

        return () => unsub();
    }, [isOwner, tenantId]);

    // ✅ Auto-expand section based on active route
    useEffect(() => {
        const activeSection = sections.find(s =>
            s.items.some(item => {
                if ((item as any).end) return location.pathname === item.to;
                return location.pathname.startsWith(item.to);
            })
        );

        if (activeSection && !expandedSections.includes(activeSection.id)) {
            setExpandedSections(prev => [...prev, activeSection.id]);
        }
    }, [location.pathname]);

    // Removed unused sidebarClass - using inline styles instead

    // ✅ Use filteredBranches for active branch (respects access control)
    const activeBranch = filteredBranches.find(b => b.id === branchId) || filteredBranches[0];

    return (
        <div className={`w-80 flex flex-col h-screen overflow-hidden relative shadow-2xl lg:shadow-none transition-colors duration-300 ${className}`} 
             style={{ 
                 background: isDark ? '#0f172a' : '#f8fafc',
                 borderLeft: '1px solid var(--theme-border-primary)',
                 backdropFilter: 'none',
                 WebkitBackdropFilter: 'none',
                 opacity: '1'
             }}>
            {/* 🎨 Header with Dynamic Logo */}
            <div className="p-4 flex-none border-b space-y-4 transition-colors duration-300" style={{ borderColor: 'var(--theme-border-primary)' }}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Check if active branch has logo, else fallback */}
                        {activeBranch?.logoUrl ? (
                            <img
                                src={activeBranch.logoUrl}
                                alt="Hotel Logo"
                                className="w-10 h-10 rounded-xl object-cover shadow-lg border transition-colors duration-300"
                                style={{ borderColor: 'var(--theme-border-primary)' }}
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                                <Crown className="w-5 h-5 text-white" />
                            </div>
                        )}

                        <div className="min-w-0">
                            <h1 className="text-lg font-bold truncate leading-tight transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>
                                {activeBranch?.name || 'Adora Admin'}
                            </h1>
                            <p className="text-[9px] text-teal-500 font-bold tracking-wider uppercase opacity-80">
                                {isOwner ? 'لوحة المالك' : 'مدير النظام'}
                            </p>
                        </div>
                    </div>

                    {/* ✅ Mobile Close Button */}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300"
                            style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-text-secondary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-text-secondary)'; }}
                        >
                            <ArrowLeft className="w-4 h-4 flip-rtl" />
                        </button>
                    )}
                </div>

                {/* ✅ Branch Selector - MANAGER ONLY: Owner doesn't have branches */}
                {!isOwnerRole && filteredBranches.length > 1 && (
                    <div className="p-1 rounded-xl border transition-colors duration-300" style={{ background: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-primary)' }}>
                        <div className="flex items-center gap-2 px-2 py-1.5">
                            <Building2 className="w-3.5 h-3.5 transition-colors duration-300" style={{ color: 'var(--theme-text-tertiary)' }} />
                            <select
                                value={branchId || ''}
                                onChange={(e) => {
                                    setBranch(e.target.value);
                                    // ✅ Trigger page reload to update all branch-scoped data
                                    window.dispatchEvent(new CustomEvent('branch-changed', { detail: { branchId: e.target.value } }));
                                }}
                                className="flex-1 bg-transparent text-xs outline-none cursor-pointer appearance-none transition-colors duration-300"
                                style={{ color: 'var(--theme-text-primary)' }}
                            >
                                {filteredBranches.map(b => (
                                    <option key={b.id} value={b.id} style={{ background: 'var(--theme-bg-primary)', color: 'var(--theme-text-primary)' }}>
                                        {(b as any).name || `فرع ${(b as any).code || b.id}`}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="w-3 h-3 transition-colors duration-300" style={{ color: 'var(--theme-text-tertiary)' }} />
                        </div>
                    </div>
                )}
            </div>

            {/* 🔗 Scrollable Navigation */}
            <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar space-y-4 pb-24">
                <nav className="space-y-1">
                    {sections.map((section) => {
                        const isExpanded = expandedSections.includes(section.id);
                        return (
                            <div key={section.id} className="mb-2">
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group transition-colors duration-300"
                                    style={{ color: 'var(--theme-text-secondary)' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--theme-text-secondary)'; }}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={`p-1.5 rounded-lg transition-colors duration-300 ${isExpanded ? 'bg-teal-500/10' : ''}`}
                                             style={!isExpanded ? { background: 'var(--theme-bg-tertiary)' } : {}}>
                                            {section.icon}
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-widest">{section.label}</span>
                                    </div>
                                    <ChevronDown
                                        className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                        style={{ color: isExpanded ? 'var(--theme-primary-500)' : 'var(--theme-text-tertiary)' }}
                                    />
                                </button>

                                {isExpanded && (
                                    <div className="mt-1 ml-4 border-l space-y-1 animate-in slide-in-from-top-2 duration-300 transition-colors duration-300" style={{ borderColor: 'var(--theme-border-primary)' }}>
                                        {section.items.map((item) => {
                                            // ✅ Check if this is a tab link (contains ?tab=)
                                            const isTabLink = item.to.includes('?tab=');
                                            const tabParam = isTabLink ? new URLSearchParams(item.to.split('?')[1]).get('tab') : null;
                                            const basePath = item.to.split('?')[0];
                                            
                                            // ✅ Check if this item is active
                                            const isActiveTab = isTabLink && location.pathname === basePath && searchParams.get('tab') === tabParam;
                                            const isActiveRoute = !isTabLink && ((item as any).end 
                                                ? location.pathname === item.to 
                                                : location.pathname.startsWith(item.to));
                                            const isActive = isActiveTab || isActiveRoute;
                                            
                                            // ✅ Handle click for tab links
                                            const handleClick = () => {
                                                if (isTabLink) {
                                                    navigate(item.to);
                                                }
                                                onClose?.();
                                            };
                                            
                                            // ✅ Use button for tab links, NavLink for regular routes
                                            if (isTabLink) {
                                                return (
                                                    <button
                                                        key={item.to}
                                                        onClick={handleClick}
                                                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all relative transition-colors duration-300 ${isActive
                                                            ? 'bg-teal-500/10 text-teal-400 font-bold'
                                                            : ''
                                                        }`}
                                                        style={{
                                                            color: isActive ? 'var(--theme-primary-500)' : 'var(--theme-text-secondary)',
                                                            background: isActive ? 'rgba(20, 184, 166, 0.1)' : 'transparent'
                                                        }}
                                                    >
                                                        {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-teal-500 rounded-l-full shadow-[0_0_8px_rgba(20,184,166,0.5)]" />}
                                                        <span style={{ color: 'inherit' }}>{item.icon}</span>
                                                        <span className="text-right flex-1">{item.label}</span>
                                                        {(item as any).badge && (item as any).badge > 0 && (
                                                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center">
                                                                {(item as any).badge}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            }
                                            
                                            return (
                                            <NavLink
                                                key={item.to}
                                                to={item.to}
                                                end={(item as any).end}
                                                onClick={onClose}
                                                className={({ isActive }) =>
                                                    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all relative transition-colors duration-300 ${isActive
                                                        ? 'bg-teal-500/10 text-teal-400 font-bold'
                                                        : ''
                                                    }`
                                                }
                                                style={({ isActive }) => ({
                                                    color: isActive ? 'var(--theme-primary-500)' : 'var(--theme-text-secondary)',
                                                    background: isActive ? 'rgba(20, 184, 166, 0.1)' : 'transparent'
                                                })}
                                                onMouseEnter={(e) => {
                                                    if (!e.currentTarget.classList.contains('bg-teal-500/10')) {
                                                        e.currentTarget.style.background = 'var(--theme-bg-tertiary)';
                                                        e.currentTarget.style.color = 'var(--theme-text-primary)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!e.currentTarget.classList.contains('bg-teal-500/10')) {
                                                        e.currentTarget.style.background = 'transparent';
                                                        e.currentTarget.style.color = 'var(--theme-text-secondary)';
                                                    }
                                                }}
                                            >
                                                {({ isActive }) => (
                                                    <>
                                                        {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-teal-500 rounded-l-full shadow-[0_0_8px_rgba(20,184,166,0.5)]" />}
                                                        <span className="transition-colors duration-300" style={{ color: 'inherit' }}>
                                                            {item.icon}
                                                        </span>
                                                        <span>{item.label}</span>
                                                        {(item as any).badge && (item as any).badge > 0 && (
                                                            <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${
                                                                isActive 
                                                                    ? 'bg-red-500 text-white animate-pulse' 
                                                                    : 'bg-red-500/20 text-red-400'
                                                            }`}>
                                                                {(item as any).badge}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </NavLink>
                                        );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}



                    {/* 🏥 Data Health Indicator - More Compact */}
                    <div className="mt-8 mx-1 px-3 py-3 rounded-xl border flex items-center gap-3 transition-colors duration-300" style={{ background: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-primary)' }}>
                        <Activity className="w-4 h-4 shrink-0" style={{ color: 'var(--theme-primary-500)' }} />
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-bold uppercase transition-colors duration-300" style={{ color: 'var(--theme-primary-500)' }}>بيئة العمل آمنة</span>
                                <span className="text-[10px] transition-colors duration-300" style={{ color: 'var(--theme-primary-500)' }}>100%</span>
                            </div>
                            <div className="h-1 w-full rounded-full overflow-hidden transition-colors duration-300" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                <div className="h-full w-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.5)]"></div>
                            </div>
                        </div>
                    </div>
                </nav>
            </div>

            {/* 🚪 Fixed Footer */}
            <div className="flex-none p-4 border-t flex items-center justify-between gap-2 z-10 transition-colors duration-300" style={{ 
                background: isDark ? '#0f172a' : '#f8fafc',
                borderColor: 'var(--theme-border-primary)',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                opacity: '1'
            }}>
                {/* ✅ Logout Button - Full width since العودة للرئيسية removed (use unified header tabs) */}
                <button
                    onClick={() => {
                        if (onClose) onClose();
                        logout();
                    }}
                    className="flex items-center justify-center w-11 h-11 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-95 transition-all outline-none border border-red-500/10"
                    title="تسجيل الخروج"
                >
                    <LogOut className="w-5 h-5 flip-rtl" />
                </button>
            </div>
        </div>
    );
};
