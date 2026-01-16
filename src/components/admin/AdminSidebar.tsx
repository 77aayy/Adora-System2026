import React, { useEffect } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
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
            label: t('sidebar.dashboard') || 'لوحة التحكم',
            icon: <Crown className="w-4 h-4" style={{ color: 'var(--theme-accent-yellow)' }} />,
            items: [
                { to: '/owner-dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: t('sidebar.overview') || 'الرئيسية', end: true },
                { to: '/owner-dashboard?tab=tenants', icon: <Users className="w-4 h-4" />, label: t('admin.manageTenants') || 'إدارة المشتركين' },
                { to: '/owner-dashboard?tab=billing', icon: <DollarSign className="w-4 h-4" />, label: t('admin.billing') || 'الفواتير' },
                { to: '/owner-dashboard?tab=broadcasts', icon: <Bell className="w-4 h-4" />, label: t('admin.broadcasts') || 'الرسائل والإعلانات' },
            ]
        },
        {
            id: 'settings',
            label: t('sidebar.settings') || 'الإعدادات',
            icon: <Settings className="w-4 h-4" style={{ color: 'var(--theme-accent-blue)' }} />,
            items: [
                { to: '/owner-dashboard?tab=settings', icon: <Settings className="w-4 h-4" />, label: t('admin.systemSettings') || 'إعدادات النظام' },
                { to: '/owner-dashboard?tab=core-config', icon: <ShieldCheck className="w-4 h-4" />, label: t('admin.coreSetup') || '🔐 التأسيس' },
            ]
        },
        {
            id: 'support',
            label: t('admin.technicalSupport') || 'الدعم الفني',
            icon: <Mail className="w-4 h-4" style={{ color: 'var(--theme-accent-purple)' }} />,
            items: [
                { 
                    to: '/admin/support-tickets', 
                    icon: <Mail className="w-4 h-4" />, 
                    label: t('admin.supportTickets') || 'تذاكر الدعم',
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

    // ✅ MANAGER MENU: Reorganized with professional grouping (i18n-aware)
    const managerSections = [
        {
            id: 'dashboard',
            label: t('sidebar.dashboard') || 'لوحة التحكم',
            icon: <LayoutDashboard className="w-4 h-4" style={{ color: 'var(--theme-primary-500)' }} />,
            items: [
                { to: '/admin', icon: <LayoutDashboard className="w-4 h-4" />, label: t('sidebar.overview') || 'نظرة عامة', end: true },
                { to: '/admin/pulse', icon: <Activity className="w-4 h-4" />, label: t('admin.pulse') || '⏱️ النبض اللحظي' },
            ]
        },
        {
            id: 'facilities',
            label: t('admin.facilities') || 'إدارة المنشأة',
            icon: <Building2 className="w-4 h-4" style={{ color: 'var(--theme-primary-500)' }} />,
            items: [
                { to: '/admin/branches', icon: <Globe className="w-4 h-4" />, label: t('sidebar.branches') || 'الفروع' },
                { to: '/admin/rooms', icon: <DoorOpen className="w-4 h-4" />, label: t('admin.roomsAndFloors') || 'الغرف والأدوار' },
                { to: '/admin/employees', icon: <Users className="w-4 h-4" />, label: t('sidebar.employees') || 'الموظفين' },
            ]
        },
        {
            id: 'operations',
            label: t('admin.dailyOperations') || 'العمليات اليومية',
            icon: <Layers className="w-4 h-4" style={{ color: 'var(--theme-accent-purple)' }} />,
            items: [
                { to: '/admin/chat-monitor', icon: <Radio className="w-4 h-4" />, label: t('admin.chatRadar') || '📡 رادار الشات' },
                { to: '/admin/chat-settings', icon: <MessageCircle className="w-4 h-4" />, label: t('admin.chatSettings') || '💬 إعدادات الشات' },
                ...(isScheduledTasksEnabled ? [{ to: '/admin/tasks', icon: <Calendar className="w-4 h-4" />, label: t('admin.scheduledTasks') || 'أوامر الشغل' }] : []),
            ]
        },
        {
            id: 'inventory',
            label: t('admin.inventoryAndWarehouses') || 'المخزون والمستودعات',
            icon: <Package className="w-4 h-4" style={{ color: 'var(--theme-accent-orange)' }} />,
            items: [
                ...(isInventoryEnabled ? [{ to: '/admin/inventory', icon: <Package className="w-4 h-4" />, label: t('sidebar.inventory') || 'المخزون' }] : []),
                ...(isLaundryEnabled ? [{ to: '/admin/laundry', icon: <Shirt className="w-4 h-4" />, label: t('departments.laundry') || 'المغسلة' }] : []),
                { to: '/admin/lost-found', icon: <Search className="w-4 h-4" />, label: t('admin.lostFound') || 'المفقودات' },
            ]
        },
        {
            id: 'finance',
            label: t('admin.financeAndMotivation') || 'المالية والتحفيز',
            icon: <DollarSign className="w-4 h-4" style={{ color: 'var(--theme-accent-green)' }} />,
            items: [
                { to: '/admin/prices', icon: <DollarSign className="w-4 h-4" />, label: t('admin.priceManagement') || 'تعديل الأسعار' },
                ...(isPointsEnabled ? [
                    { to: '/admin/points', icon: <Target className="w-4 h-4" />, label: t('admin.pointsRules') || 'قواعد النقاط' },
                    { to: '/admin/gamification', icon: <Award className="w-4 h-4" />, label: t('admin.badgesAndRanks') || 'الشارات والرتب' },
                    { to: '/admin/payouts', icon: <HandCoins className="w-4 h-4" />, label: t('admin.pointsPayout') || 'صرف النقاط' },
                ] : []),
            ]
        },
        {
            id: 'settings',
            label: t('admin.settingsAndConfiguration') || 'الإعدادات والتكوين',
            icon: <Settings className="w-4 h-4" style={{ color: 'var(--theme-text-tertiary)' }} />,
            items: [
                { to: '/admin/settings', icon: <Settings className="w-4 h-4" />, label: t('admin.appManagement') || 'إدارة التطبيق' },
                { to: '/admin/auto-transfer', icon: <Activity className="w-4 h-4" />, label: t('admin.autoTransfer') || 'التحويل التلقائي' },
                { to: '/admin/translations', icon: <Languages className="w-4 h-4" />, label: t('admin.translations') || '🌍 إدارة الترجمات' },
                ...(isWhatsAppEnabled ? [{ to: '/admin/whatsapp-templates', icon: <MessageCircle className="w-4 h-4" />, label: t('admin.whatsappTemplates') || 'نماذج WhatsApp' }] : []),
            ]
        },
        {
            id: 'communications',
            label: t('admin.communicationsAndAnnouncements') || 'الاتصالات والإعلانات',
            icon: <Bell className="w-4 h-4" style={{ color: 'var(--theme-accent-yellow)' }} />,
            items: [
                { to: '/admin/manager-announcements', icon: <Bell className="w-4 h-4" />, label: t('admin.urgentMessages') || 'الرسائل العاجلة للأقسام' },
                { to: '/admin/general-instructions', icon: <BookOpen className="w-4 h-4" />, label: t('admin.generalInstructions') || 'التعليمات العامة' },
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

    // ✅ MOBILE-FIRST DESIGN: Modern glassmorphism sidebar
    return (
        <div 
            className={`w-full sm:w-72 lg:w-80 flex flex-col h-screen overflow-hidden relative transition-all duration-300 ${className}`} 
            style={{ 
                background: 'var(--theme-bg-primary)',
                borderLeft: '1px solid var(--theme-border-primary)',
            }}
        >
            {/* 🎨 Header with Dynamic Logo - ✅ MOBILE-FIRST */}
            <div className="p-3 sm:p-4 flex-none border-b space-y-3 sm:space-y-4 transition-colors duration-300" style={{ borderColor: 'var(--theme-border-primary)' }}>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        {/* Check if active branch has logo, else fallback */}
                        {activeBranch?.logoUrl ? (
                            <img
                                src={activeBranch.logoUrl}
                                alt="Hotel Logo"
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shadow-lg border transition-all duration-300 flex-shrink-0"
                                style={{ borderColor: 'var(--theme-border-primary)' }}
                            />
                        ) : (
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20 flex-shrink-0">
                                <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                            </div>
                        )}

                        <div className="min-w-0 flex-1">
                            <h1 className="text-base sm:text-lg font-bold truncate leading-tight transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>
                                {activeBranch?.name || 'Adora Admin'}
                            </h1>
                            <p className="text-[8px] sm:text-[9px] text-teal-500 font-bold tracking-wider uppercase opacity-80 truncate">
                                {isOwner ? (t('admin.ownerDashboard') || 'لوحة المالك') : (t('admin.managerDashboard') || 'مدير النظام')}
                            </p>
                        </div>
                    </div>

                    {/* ✅ Mobile Close Button */}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all duration-300 active:scale-95 flex-shrink-0"
                            style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-text-secondary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-text-primary)'; e.currentTarget.style.background = 'var(--theme-bg-secondary)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-text-secondary)'; e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; }}
                        >
                            <ArrowLeft className="w-4 h-4 flip-rtl" />
                        </button>
                    )}
                </div>

                {/* ✅ Branch Selector - MANAGER ONLY: Owner doesn't have branches - ✅ MOBILE-FIRST */}
                {!isOwnerRole && filteredBranches.length > 1 && (
                    <div className="p-1.5 rounded-xl border transition-all duration-300 hover:border-teal-500/50" style={{ background: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-primary)' }}>
                        <div className="flex items-center gap-2 px-2.5 py-2">
                            <Building2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 transition-colors duration-300 flex-shrink-0" style={{ color: 'var(--theme-text-tertiary)' }} />
                            <select
                                value={branchId || ''}
                                onChange={(e) => {
                                    setBranch(e.target.value);
                                    // ✅ Trigger page reload to update all branch-scoped data
                                    window.dispatchEvent(new CustomEvent('branch-changed', { detail: { branchId: e.target.value } }));
                                }}
                                className="flex-1 bg-transparent text-xs sm:text-[11px] outline-none cursor-pointer appearance-none transition-colors duration-300 truncate"
                                style={{ color: 'var(--theme-text-primary)' }}
                            >
                                {filteredBranches.map(b => (
                                    <option key={b.id} value={b.id} style={{ background: 'var(--theme-bg-primary)', color: 'var(--theme-text-primary)' }}>
                                        {(b as any).name || `فرع ${(b as any).code || b.id}`}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 sm:w-3 sm:h-3 transition-colors duration-300 flex-shrink-0" style={{ color: 'var(--theme-text-tertiary)' }} />
                        </div>
                    </div>
                )}
            </div>

            {/* 🔗 Scrollable Navigation - ✅ MOBILE-FIRST */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 custom-scrollbar space-y-3 sm:space-y-4 pb-20 sm:pb-24">
                <nav className="space-y-1">
                    {sections.map((section) => {
                        const isExpanded = expandedSections.includes(section.id);
                        return (
                            <div key={section.id} className="mb-1.5 sm:mb-2">
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full flex items-center justify-between px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all group active:scale-[0.98]"
                                    style={{ 
                                        color: 'var(--theme-text-secondary)',
                                        background: isExpanded ? 'var(--theme-bg-tertiary)' : 'transparent'
                                    }}
                                    onMouseEnter={(e) => { 
                                        if (!isExpanded) {
                                            e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; 
                                            e.currentTarget.style.color = 'var(--theme-text-primary)'; 
                                        }
                                    }}
                                    onMouseLeave={(e) => { 
                                        if (!isExpanded) {
                                            e.currentTarget.style.background = 'transparent'; 
                                            e.currentTarget.style.color = 'var(--theme-text-secondary)'; 
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
                                        <div className={`p-1.5 sm:p-1.5 rounded-lg transition-all duration-300 flex-shrink-0 ${isExpanded ? 'bg-teal-500/20 shadow-sm' : ''}`}
                                             style={!isExpanded ? { background: 'var(--theme-bg-secondary)' } : {}}>
                                            {section.icon}
                                        </div>
                                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">{section.label}</span>
                                    </div>
                                    <ChevronDown
                                        className={`w-3.5 h-3.5 sm:w-3 sm:h-3 transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                                        style={{ color: isExpanded ? 'var(--theme-primary-500)' : 'var(--theme-text-tertiary)' }}
                                    />
                                </button>

                                {isExpanded && (
                                    <div className="mt-1.5 sm:mt-1 ml-3 sm:ml-4 border-l-2 space-y-0.5 sm:space-y-1 animate-in slide-in-from-top-2 duration-200 transition-colors duration-300" style={{ borderColor: 'var(--theme-primary-500)' }}>
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
                                                        className={`w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm transition-all relative active:scale-[0.98] ${isActive
                                                            ? 'bg-teal-500/15 text-teal-400 font-bold shadow-sm'
                                                            : ''
                                                        }`}
                                                        style={{
                                                            color: isActive ? 'var(--theme-primary-500)' : 'var(--theme-text-secondary)',
                                                            background: isActive ? 'rgba(20, 184, 166, 0.15)' : 'transparent'
                                                        }}
                                                    >
                                                        {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 sm:w-1 h-4 sm:h-5 bg-teal-500 rounded-l-full shadow-[0_0_8px_rgba(20,184,166,0.5)]" />}
                                                        <span className="flex-shrink-0 w-4 h-4 sm:w-4 sm:h-4" style={{ color: 'inherit' }}>{item.icon}</span>
                                                        <span className="text-right flex-1 truncate">{item.label}</span>
                                                        {(item as any).badge && (item as any).badge > 0 && (
                                                            <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[16px] sm:min-w-[18px] text-center flex-shrink-0">
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
                                                        `flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm transition-all relative active:scale-[0.98] ${isActive
                                                            ? 'bg-teal-500/15 text-teal-400 font-bold shadow-sm'
                                                            : ''
                                                        }`
                                                    }
                                                    style={({ isActive }) => ({
                                                        color: isActive ? 'var(--theme-primary-500)' : 'var(--theme-text-secondary)',
                                                        background: isActive ? 'rgba(20, 184, 166, 0.15)' : 'transparent'
                                                    })}
                                                    onMouseEnter={(e) => {
                                                        if (!e.currentTarget.classList.contains('bg-teal-500/15')) {
                                                            e.currentTarget.style.background = 'var(--theme-bg-tertiary)';
                                                            e.currentTarget.style.color = 'var(--theme-text-primary)';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!e.currentTarget.classList.contains('bg-teal-500/15')) {
                                                            e.currentTarget.style.background = 'transparent';
                                                            e.currentTarget.style.color = 'var(--theme-text-secondary)';
                                                        }
                                                    }}
                                                >
                                                    {({ isActive }) => (
                                                        <>
                                                            {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 sm:w-1 h-4 sm:h-5 bg-teal-500 rounded-l-full shadow-[0_0_8px_rgba(20,184,166,0.5)]" />}
                                                            <span className="flex-shrink-0 w-4 h-4 sm:w-4 sm:h-4 transition-colors duration-300" style={{ color: 'inherit' }}>
                                                                {item.icon}
                                                            </span>
                                                            <span className="flex-1 truncate">{item.label}</span>
                                                            {(item as any).badge && (item as any).badge > 0 && (
                                                                <span className={`ml-auto px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-xs font-bold flex-shrink-0 ${
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



                    {/* 🏥 Data Health Indicator - ✅ MOBILE-FIRST COMPACT */}
                    <div className="mt-6 sm:mt-8 mx-0.5 sm:mx-1 px-2.5 sm:px-3 py-2.5 sm:py-3 rounded-xl border flex items-center gap-2.5 sm:gap-3 transition-all duration-300 hover:border-teal-500/30" style={{ background: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-primary)' }}>
                        <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" style={{ color: 'var(--theme-primary-500)' }} />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1 sm:mb-1.5 gap-1">
                                <span className="text-[9px] sm:text-[10px] font-bold uppercase transition-colors duration-300 truncate" style={{ color: 'var(--theme-primary-500)' }}>{t('admin.safeWorkEnvironment') || 'بيئة العمل آمنة'}</span>
                                <span className="text-[9px] sm:text-[10px] transition-colors duration-300 flex-shrink-0" style={{ color: 'var(--theme-primary-500)' }}>100%</span>
                            </div>
                            <div className="h-0.5 sm:h-1 w-full rounded-full overflow-hidden transition-colors duration-300" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                <div className="h-full w-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.5)]"></div>
                            </div>
                        </div>
                    </div>
                </nav>
            </div>

            {/* 🚪 Fixed Footer - ✅ MOBILE-FIRST */}
            <div className="flex-none p-3 sm:p-4 border-t flex items-center justify-center gap-2 z-10 transition-colors duration-300" style={{ 
                background: 'var(--theme-bg-primary)',
                borderColor: 'var(--theme-border-primary)',
            }}>
                {/* ✅ Logout Button - Centered, Mobile-optimized */}
                <button
                    onClick={() => {
                        if (onClose) onClose();
                        logout();
                    }}
                    className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-95 transition-all outline-none border border-red-500/20 hover:border-red-500/40"
                    title={t('auth.logout') || 'تسجيل الخروج'}
                >
                    <LogOut className="w-4 h-4 sm:w-5 sm:h-5 flip-rtl" />
                </button>
            </div>
        </div>
    );
};
