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
    ChevronRight,
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
    Award,
    Menu,
    X
} from 'lucide-react';
import { BookOpen, MessageCircle, MessageSquare, Radio, Languages, Share2, Sparkles, User, Phone, Key, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenantBranches } from '../../hooks/useTenantData';
import { useTenant } from '../../context/TenantContext';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { useTheme } from '../../context/ThemeContext'; // ✅ Use theme context
import { Branch } from '../../types';
import { subscribeToTicketStatus, getUnrespondedTicketsCount, type SupportTicketStatus } from '../../services/supportTicketService';
import { getAllTrialRequests, submitTrialRequest } from '../../services/trialRequestService';
import { UnifiedModal, ModalActions } from '../common/UnifiedModal';
import { toast } from '../common/EnhancedToast';
import { useUX } from '../../context/UXContext';

interface AdminSidebarProps {
    isOwner: boolean;
    onClose?: () => void; // ✅ For mobile closing
    className?: string;   // ✅ For custom styling
    onCollapseChange?: (isCollapsed: boolean) => void; // ✅ Callback for collapse state
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOwner, onClose, className = '', onCollapseChange }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { t } = useTranslation();
    const { branchId, setBranch, logout, user } = useAuth(); // ✅ Get logout function & User
    const { branches } = useTenantBranches();
    const { tenantId } = useTenant();
    // ✅ Removed isDark - using CSS theme variables exclusively
    const [ticketStatus, setTicketStatus] = React.useState<SupportTicketStatus | null>(null);
    const [pendingSubscriptionRequests, setPendingSubscriptionRequests] = React.useState<number>(0);
    const [unrespondedTicketsCount, setUnrespondedTicketsCount] = React.useState<number>(0);
    
    // ✅ DEMO SUBSCRIPTION MODAL: State for "أرغب في الاشتراك" button (Demo only)
    const [showSubscriptionModal, setShowSubscriptionModal] = React.useState(false);
    const [subscriptionName, setSubscriptionName] = React.useState('');
    const [subscriptionPhone, setSubscriptionPhone] = React.useState('');
    const [subscriptionRequiredBranches, setSubscriptionRequiredBranches] = React.useState<number>(1);
    const [isSubmittingSubscription, setIsSubmittingSubscription] = React.useState(false);
    const [isSubscriptionSuccess, setIsSubscriptionSuccess] = React.useState(false);
    const { success, error: showError } = useUX();
    
    // ✅ Check if user is demo account
    const isDemoAccount = (user as any)?.isDemo === true;
    
    // ✅ ADORA SMART SIDEBAR: Collapsed State Management
    const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);
    const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);

    // ✅ Notify parent component of collapse state changes
    React.useEffect(() => {
        onCollapseChange?.(isCollapsed);
    }, [isCollapsed, onCollapseChange]);

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

    // ✅ CRITICAL FIX: Feature Gates MUST be defined BEFORE using them in ownerSections
    // ✅ Feature Gates: Check which features are enabled
    const { isEnabled: isInventoryEnabled } = useFeatureGate('inventoryManagement');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isEnabled: _isProcurementEnabled } = useFeatureGate('procurementSystem');
    const { isEnabled: isLaundryEnabled } = useFeatureGate('laundryManagement');
    const { isEnabled: isPointsEnabled } = useFeatureGate('pointsSystem');
    const { isEnabled: isScheduledTasksEnabled } = useFeatureGate('scheduledTasks');
    const { isEnabled: isWhatsAppEnabled } = useFeatureGate('whatsappIntegration');

    // ✅ OWNER vs MANAGER: Completely different menu structures
    const isOwnerRole = isOwner || user?.role === 'owner';
    
    // ✅ OWNER MENU: ONLY System-Level Functions (Demo, Settings, Create Manager)
    // ✅ CRITICAL: Owner does NOT manage branches, rooms, employees - that's Manager's job
    const ownerSections = [
        {
            id: 'dashboard',
            label: t('sidebar.dashboard') || 'لوحة التحكم',
            icon: <Crown className="w-4 h-4" style={{ color: 'var(--theme-accent-yellow)' }} />,
            items: [
                { to: '/owner-dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: t('admin.overview') || t('admin.mainDashboard') || 'Overview', end: true },
                { to: '/owner-panel', icon: <ShieldCheck className="w-4 h-4" />, label: t('admin.ownerDashboard') || 'Owner Dashboard' },
                { to: '/owner-dashboard?tab=tenants', icon: <Users className="w-4 h-4" />, label: t('admin.manageSubscribers') || 'إدارة المشتركين' },
                { to: '/owner-dashboard?tab=billing', icon: <DollarSign className="w-4 h-4" />, label: t('admin.billing') || 'Billing' },
                { 
                    to: '/owner-dashboard?tab=subscription-requests', 
                    icon: <MessageSquare className="w-4 h-4" />, 
                    label: t('admin.subscriptionRequests') || 'طلبات التجربة والاشتراك',
                    badge: pendingSubscriptionRequests > 0 ? pendingSubscriptionRequests : undefined
                },
                { to: '/owner-dashboard?tab=demo', icon: <Share2 className="w-4 h-4" />, label: t('admin.demoLinks') || 'Demo Links' },
            ]
        },
        {
            id: 'settings',
            label: t('admin.settingsAndConfiguration') || 'إعدادات النظام',
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
                    label: t('admin.supportTickets.title') || t('admin.supportTickets') || 'تذاكر الدعم',
                    badge: isOwner 
                        ? (unrespondedTicketsCount > 0 ? unrespondedTicketsCount : undefined)
                        : (ticketStatus && ticketStatus.unreadCount > 0 ? ticketStatus.unreadCount : undefined)
                }
            ]
        }
    ];

    // ✅ MANAGER MENU: Reorganized with professional grouping (i18n-aware)
    const managerSections = [
        {
            id: 'dashboard',
            label: t('sidebar.dashboard') || 'لوحة التحكم',
            icon: <LayoutDashboard className="w-4 h-4" style={{ color: 'var(--theme-primary-500)' }} />,
            items: [
                { to: '/admin', icon: <LayoutDashboard className="w-4 h-4" />, label: t('sidebar.overview') || 'نظرة عامة', end: true },
                { to: '/admin/pulse', icon: <Activity className="w-4 h-4" />, label: t('admin.pulse') || '⏱️ النبض اللحظي' },
                { to: '/admin/kpi', icon: <BarChart3 className="w-4 h-4" />, label: t('admin.kpiDashboard') || '📊 لوحة المؤشرات' },
            ]
        },
        {
            id: 'facilities',
            label: t('admin.facilities') || 'إدارة المنشأة',
            icon: <Building2 className="w-4 h-4" style={{ color: 'var(--theme-primary-500)' }} />,
            items: [
                { to: '/admin/branches', icon: <Globe className="w-4 h-4" />, label: t('sidebar.branches') },
                { to: '/admin/rooms', icon: <DoorOpen className="w-4 h-4" />, label: t('admin.roomsAndFloors') || 'الغرف والأدوار' },
                { to: '/admin/employees', icon: <Users className="w-4 h-4" />, label: t('sidebar.employees') },
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
                ...(isInventoryEnabled ? [{ to: '/admin/inventory', icon: <Package className="w-4 h-4" />, label: t('sidebar.inventory') }] : []),
                ...(isLaundryEnabled ? [{ to: '/admin/laundry', icon: <Shirt className="w-4 h-4" />, label: t('departments.laundry') }] : []),
                { to: '/admin/lost-found', icon: <Search className="w-4 h-4" />, label: t('admin.lostFound') },
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
            id: 'communications',
            label: t('admin.communicationsAndAnnouncements'),
            icon: <Bell className="w-4 h-4" style={{ color: 'var(--theme-accent-yellow)' }} />,
            items: [
                { to: '/admin/manager-announcements', icon: <Bell className="w-4 h-4" />, label: t('admin.urgentMessages') },
                { to: '/admin/general-instructions', icon: <BookOpen className="w-4 h-4" />, label: t('admin.generalInstructions') },
                ...(isWhatsAppEnabled ? [{ to: '/admin/whatsapp-templates', icon: <MessageCircle className="w-4 h-4" />, label: t('admin.whatsappTemplates') }] : []),
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
                    label: t('admin.supportTickets.title') || t('admin.supportTickets') || 'تذاكر الدعم',
                    badge: unrespondedTicketsCount > 0 ? unrespondedTicketsCount : undefined
                }
            ]
        }
    ];
    
    // ✅ Use appropriate sections based on role
    const sections = isOwnerRole ? ownerSections : managerSections;

    // ✅ Subscribe to ticket status (for owner only)
    useEffect(() => {
        if (!isOwner || !tenantId) return;

        let unsub: (() => void) | null = null;
        try {
            unsub = subscribeToTicketStatus(tenantId, (status) => {
                setTicketStatus(status);
            });
        } catch (error) {
            console.error('Error setting up ticket status subscription:', error);
        }

        return () => {
            if (unsub) {
                try {
                    unsub();
                } catch (error) {
                    console.warn('Error cleaning up ticket status subscription:', error);
                }
            }
        };
    }, [isOwner, tenantId]);

    // ✅ Fetch pending subscription requests count (for owner only)
    useEffect(() => {
        if (!isOwner) return;

        const fetchPendingRequests = async () => {
            try {
                const result = await getAllTrialRequests();
                if (result.success && result.data) {
                    const notContacted = result.data.filter(r => !r.contactedAt).length;
                    setPendingSubscriptionRequests(notContacted);
                }
            } catch (err) {
                // Silent fail - don't show error for badge count
            }
        };

        fetchPendingRequests();
        // Refresh every 30 seconds
        const interval = setInterval(fetchPendingRequests, 30000);
        return () => clearInterval(interval);
    }, [isOwner]);

    // ✅ Fetch unresponded support tickets count (for owner only - SaaS: from all tenants)
    useEffect(() => {
        if (!isOwner) return;

        const fetchUnrespondedTickets = async () => {
            try {
                const count = await getUnrespondedTicketsCount();
                setUnrespondedTicketsCount(count);
            } catch (err) {
                // Silent fail - don't show error for badge count
            }
        };

        fetchUnrespondedTickets();
        // Refresh every 30 seconds
        const interval = setInterval(fetchUnrespondedTickets, 30000);
        return () => clearInterval(interval);
    }, [isOwner]);

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

    // ✅ ADORA SMART & FLUID SIDEBAR V5.2 - Premium Specifications
    return (
        <aside 
            className={`flex flex-col min-h-screen relative ${className}`} 
            style={{ 
                width: isCollapsed ? '80px' : '280px',
                minHeight: '100vh',
                background: 'var(--theme-bg-secondary)',
                backdropFilter: 'var(--theme-backdrop-filter, blur(20px) saturate(180%))',
                borderRight: '1px solid var(--theme-border-primary)',
                boxShadow: 'var(--theme-shadow-card)',
                padding: isCollapsed ? '15px 8px' : '15px 16px',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 100,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden', // ✅ FIX: Prevent text overflow and line artifacts when collapsed
            }}
        >
            {/* 🎨 Header with Dynamic Logo & Toggle Button - ✅ ADORA SMART SIDEBAR */}
            <div 
                className="flex-none border-b relative transition-colors duration-300" 
                style={{ 
                    borderColor: 'var(--theme-border-primary)',
                    padding: isCollapsed ? '12px 8px' : '16px 12px',
                    minHeight: '64px',
                }}
            >
                {/* ✅ Toggle Button - Circular on Sidebar Edge */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full shadow-md flex items-center justify-center z-10 transition-all duration-200"
                    style={{
                        background: 'var(--theme-bg-secondary)',
                        border: '1px solid var(--theme-border-primary)',
                        boxShadow: 'var(--theme-shadow-sm)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--theme-bg-tertiary)';
                        e.currentTarget.style.borderColor = 'var(--theme-border-hover)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--theme-bg-secondary)';
                        e.currentTarget.style.borderColor = 'var(--theme-border-primary)';
                    }}
                    aria-label={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
                >
                    {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary-600)' }} />
                    ) : (
                        <ChevronRight className="w-3.5 h-3.5 rotate-180" style={{ color: 'var(--theme-primary-600)' }} />
                    )}
                </button>

                {/* ✅ Logo Area - Dynamic based on state */}
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                    {activeBranch?.logoUrl ? (
                        <img
                            src={activeBranch.logoUrl}
                            alt="Hotel Logo"
                            className={`rounded-xl object-cover shadow-lg border transition-all duration-300 flex-shrink-0`}
                            style={{ 
                                width: isCollapsed ? '32px' : '48px',
                                height: isCollapsed ? '32px' : '48px',
                                borderColor: '#f1f5f9',
                            }}
                        />
                    ) : (
                        <div 
                            className="rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20 flex-shrink-0"
                            style={{
                                width: isCollapsed ? '32px' : '48px',
                                height: isCollapsed ? '32px' : '48px',
                            }}
                        >
                            {isCollapsed ? (
                                <Crown className="w-4 h-4 text-white" />
                            ) : (
                                <Crown className="w-6 h-6 text-white" />
                            )}
                        </div>
                    )}

                    {/* ✅ Branch Name - Hidden when collapsed */}
                    {!isCollapsed && (
                        <div className="min-w-0 flex-1">
                            <h1 
                                className="text-base font-bold leading-tight transition-colors duration-300" 
                                style={{ 
                                    color: 'var(--theme-text-primary)',
                                    fontSize: '16px',
                                    fontFamily: 'Cairo, sans-serif',
                                    fontWeight: 600,
                                }}
                            >
                                {activeBranch?.name || 'Adora Admin'}
                            </h1>
                            <p 
                                className="text-[9px] font-bold tracking-wider uppercase opacity-80"
                                style={{
                                    color: 'var(--theme-primary-600)',
                                    fontFamily: 'Cairo, sans-serif',
                                }}
                            >
                                {isOwner ? (t('admin.ownerDashboard') || 'لوحة المالك') : (t('admin.managerDashboard') || 'مدير النظام')}
                            </p>
                        </div>
                    )}
                </div>

                {/* ✅ Branch Selector - Hidden when collapsed */}
                {!isOwnerRole && filteredBranches.length > 1 && !isCollapsed && (
                    <div 
                        className="p-1.5 rounded-xl border transition-all duration-300 hover:border-teal-500/50 mt-3" 
                        style={{ 
                            background: 'var(--theme-bg-tertiary)',
                            borderColor: 'var(--theme-border-primary)',
                        }}
                    >
                        <div className="flex items-center gap-2 px-2.5 py-2">
                            <Building2 className="w-4 h-4 transition-colors duration-300 flex-shrink-0" style={{ color: 'var(--theme-text-secondary)' }} />
                            <select
                                value={branchId || ''}
                                onChange={(e) => {
                                    setBranch(e.target.value);
                                    window.dispatchEvent(new CustomEvent('branch-changed', { detail: { branchId: e.target.value } }));
                                }}
                                className="flex-1 bg-transparent text-xs outline-none cursor-pointer appearance-none transition-colors duration-300"
                                style={{ 
                                    color: 'var(--theme-text-primary)',
                                    fontFamily: 'Cairo, sans-serif',
                                }}
                            >
                                {filteredBranches.map(b => (
                                    <option key={b.id} value={b.id} style={{ background: 'var(--theme-bg-secondary)', color: 'var(--theme-text-primary)' }}>
                                        {(b as any).name || `فرع ${(b as any).code || b.id}`}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 transition-colors duration-300 flex-shrink-0" style={{ color: 'var(--theme-text-secondary)' }} />
                        </div>
                    </div>
                )}

                {/* ✅ Mobile Close Button */}
                {onClose && (
                    <button
                        onClick={onClose}
                        className="lg:hidden absolute top-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 active:scale-95"
                        style={{ 
                            background: 'var(--theme-bg-tertiary)',
                            color: 'var(--theme-text-secondary)'
                        }}
                        onMouseEnter={(e) => { 
                            e.currentTarget.style.color = 'var(--theme-text-primary)';
                            e.currentTarget.style.background = 'var(--theme-bg-hover, var(--theme-primary-100))';
                        }}
                        onMouseLeave={(e) => { 
                            e.currentTarget.style.color = 'var(--theme-text-secondary)';
                            e.currentTarget.style.background = 'var(--theme-bg-tertiary)';
                        }}
                    >
                        <ArrowLeft className="w-4 h-4 flip-rtl" />
                    </button>
                )}
            </div>

            {/* 🔗 Navigation - ✅ Full height navigation (no scroll) */}
            <div
                className="flex-1"
                style={{
                    padding: isCollapsed ? '12px 4px' : '16px 8px',
                    paddingBottom: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <nav className="space-y-1 flex-1 overflow-x-hidden" style={{ 
                    paddingRight: isCollapsed ? '0' : '4px',
                    marginRight: isCollapsed ? '0' : '-4px',
                }}>
                    {sections.map((section) => {
                        const isExpanded = expandedSections.includes(section.id);
                        return (
                            <div key={section.id} className="mb-1.5 sm:mb-2">
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full flex items-center justify-between px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all group active:scale-[0.98]"
                                    style={{ 
                                        color: 'var(--theme-text-secondary)',
                                        background: isExpanded ? 'var(--theme-bg-tertiary)' : 'transparent',
                                        transform: 'scale(1)',
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: 'none',
                                    }}
                                    onMouseEnter={(e) => { 
                                        if (!isExpanded) {
                                            e.currentTarget.style.background = 'var(--theme-bg-tertiary)';
                                            e.currentTarget.style.color = 'var(--theme-text-primary)';
                                            e.currentTarget.style.transform = 'scale(1.02) translateX(-2px)'; // ✅ Zoom + slight slide
                                            e.currentTarget.style.boxShadow = 'var(--theme-shadow-sm)';
                                        } else {
                                            e.currentTarget.style.transform = 'scale(1.01) translateX(-1px)'; // ✅ Subtle zoom for expanded
                                        }
                                    }}
                                    onMouseLeave={(e) => { 
                                        if (!isExpanded) {
                                            e.currentTarget.style.background = 'transparent'; 
                                            e.currentTarget.style.color = 'var(--theme-text-secondary)';
                                            e.currentTarget.style.transform = 'scale(1) translateX(0)'; // ✅ Reset transform
                                            e.currentTarget.style.boxShadow = 'none';
                                        } else {
                                            e.currentTarget.style.transform = 'scale(1) translateX(0)';
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0" style={{ overflow: 'hidden' }}>
                                        <div className={`p-1.5 sm:p-1.5 rounded-lg transition-all duration-300 flex-shrink-0 ${isExpanded ? 'bg-teal-500/20 shadow-sm' : ''}`}
                                             style={!isExpanded ? { background: 'var(--theme-bg-secondary)' } : {}}>
                                            {section.icon}
                                        </div>
                                        {/* ✅ FIX: Hide section label when collapsed */}
                                        {!isCollapsed && (
                                            <span 
                                                className="text-[10px] sm:text-xs font-bold uppercase tracking-wider"
                                                style={{
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    lineHeight: '1.4',
                                                    color: 'var(--theme-text-secondary)',
                                                }}
                                            >
                                                {section.label}
                                            </span>
                                        )}
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
                                            
                                            // ✅ Check if this is the "Invoices" item
                                            const isInvoicesItem = item.label === t('admin.billing');
                                            
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
                                                        className={`w-full flex items-center relative active:scale-[0.98] ${isActive ? 'font-semibold' : ''}`}
                                                    style={{
                                                        height: '40px', // ✅ Strict height
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: isCollapsed ? '0' : '10px', // ✅ FIX: No gap when collapsed
                                                        padding: isCollapsed ? '0 8px' : '0 12px', // ✅ FIX: Reduced padding when collapsed
                                                        marginBottom: '2px', // ✅ Minimal margin
                                                        borderRadius: '8px', // ✅ Strict border radius
                                                        fontSize: '13.5px', // ✅ Strict font size
                                                        fontWeight: 500, // ✅ Strict font weight
                                                        cursor: 'pointer',
                                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', // ✅ Smooth transition with easing
                                                        transform: 'scale(1)', // ✅ Initial scale
                                                        color: isActive ? 'var(--theme-primary-600)' : 'var(--theme-text-secondary)', // ✅ Active: Primary color | Inactive: Secondary text
                                                        background: isActive ? 'var(--theme-primary-100)' : 'transparent', // ✅ Active: Light primary | Inactive: Transparent
                                                        position: 'relative', // ✅ For ActiveBar positioning
                                                        overflow: 'hidden', // ✅ FIX: Prevent text overflow artifacts
                                                        // ✅ Premium Primary Border for Invoices when active
                                                        border: isActive && isInvoicesItem ? '2px solid var(--theme-primary-600)' : 'none',
                                                        borderWidth: isActive && isInvoicesItem ? '2px' : '0',
                                                        borderStyle: isActive && isInvoicesItem ? 'solid' : 'none',
                                                        borderColor: isActive && isInvoicesItem ? 'var(--theme-primary-600)' : 'transparent',
                                                        boxShadow: isActive && isInvoicesItem ? '0 0 0 2px var(--theme-primary-200), 0 4px 12px var(--theme-primary-100)' : 'none',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (!isActive) {
                                                            e.currentTarget.style.background = 'var(--theme-bg-tertiary)';
                                                            e.currentTarget.style.color = 'var(--theme-primary-600)';
                                                            e.currentTarget.style.transform = 'scale(1.02) translateX(-2px)';
                                                            e.currentTarget.style.boxShadow = 'var(--theme-shadow-sm)';
                                                        } else if (isInvoicesItem) {
                                                            e.currentTarget.style.boxShadow = '0 0 0 2px var(--theme-primary-300), 0 6px 16px var(--theme-primary-200)';
                                                            e.currentTarget.style.transform = 'scale(1.03) translateX(-2px)';
                                                        } else {
                                                            e.currentTarget.style.transform = 'scale(1.02) translateX(-2px)';
                                                            e.currentTarget.style.boxShadow = 'var(--theme-shadow-sm)';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!isActive) {
                                                            e.currentTarget.style.background = 'transparent';
                                                            e.currentTarget.style.color = 'var(--theme-text-secondary)';
                                                            e.currentTarget.style.transform = 'scale(1) translateX(0)';
                                                            e.currentTarget.style.boxShadow = 'none';
                                                        } else if (isInvoicesItem) {
                                                            e.currentTarget.style.boxShadow = '0 0 0 2px var(--theme-primary-200), 0 4px 12px var(--theme-primary-100)';
                                                            e.currentTarget.style.transform = 'scale(1) translateX(0)';
                                                        } else {
                                                            e.currentTarget.style.transform = 'scale(1) translateX(0)';
                                                            e.currentTarget.style.boxShadow = 'none';
                                                        }
                                                    }}
                                                    >
                                                        {/* ✅ ActiveBar - Thin vertical indicator on the right (RTL) - Hidden when collapsed */}
                                                        {isActive && !isCollapsed && (
                                                            <div 
                                                                className="absolute right-0 top-1/2 -translate-y-1/2"
                                                                style={{
                                                                    width: '3px', // ✅ Thin bar
                                                                    height: '20px', // ✅ Premium height
                                                                    background: '#20B2AA', // ✅ Turquoise DNA
                                                                    borderRadius: '10px', // ✅ Rounded
                                                                    position: 'absolute',
                                                                    right: 0, // ✅ RTL positioning
                                                                }}
                                                            />
                                                        )}
                                                        {/* ✅ Icon styling - Premium Lucide icons */}
                                                        <span 
                                                            className="flex-shrink-0 transition-colors duration-300" 
                                                            style={{ 
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                            }}
                                                        >
                                                            {React.isValidElement(item.icon) 
                                                                ? React.cloneElement(item.icon as React.ReactElement<any>, {
                                                                    className: isCollapsed ? 'w-5.5 h-5.5' : 'w-5 h-5',
                                                                    size: 22, // ✅ Premium size
                                                                    strokeWidth: 2.5, // ✅ Premium stroke width
                                                                    style: { 
                                                                        color: 'inherit', // ✅ Inherits color from parent
                                                                        opacity: 1,
                                                                    }
                                                                })
                                                                : item.icon
                                                            }
                                                        </span>
                                                        {/* ✅ Label - Hidden when collapsed with proper overflow handling */}
                                                        {!isCollapsed && (
                                                            <span 
                                                                className="flex-1 truncate"
                                                                style={{
                                                                    fontFamily: 'Cairo, sans-serif',
                                                                    fontSize: '14px',
                                                                    fontWeight: 600,
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                    maxWidth: '100%',
                                                                }}
                                                            >
                                                                {item.label}
                                                            </span>
                                                        )}
                                                        {/* ✅ FIX: Ensure label is completely hidden when collapsed */}
                                                        {isCollapsed && (
                                                            <span style={{ display: 'none' }}>{item.label}</span>
                                                        )}
                                                        {/* ✅ Tooltip - Shows when collapsed and hovered */}
                                                        {isCollapsed && hoveredItem === item.to && (
                                                            <div
                                                                className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 whitespace-nowrap"
                                                                style={{
                                                                    fontFamily: 'Cairo, sans-serif',
                                                                    fontSize: '12px',
                                                                    fontWeight: 500,
                                                                }}
                                                            >
                                                                {item.label}
                                                                <div 
                                                                    className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-t-transparent border-r-4 border-r-gray-900 border-b-4 border-b-transparent"
                                                                />
                                                            </div>
                                                        )}
                                                        {(item as any).badge && (item as any).badge > 0 && (
                                                            <span 
                                                                className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[16px] sm:min-w-[18px] text-center flex-shrink-0 animate-pulse"
                                                                style={{
                                                                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                                                                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
                                                                }}
                                                            >
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
                                                        `flex items-center relative active:scale-[0.98] ${isActive ? 'font-semibold' : ''}`
                                                    }
                                                    style={({ isActive }) => ({
                                                        height: '40px', // ✅ Strict height
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: isCollapsed ? '0' : '10px', // ✅ FIX: No gap when collapsed
                                                        padding: isCollapsed ? '0 8px' : '0 12px', // ✅ FIX: Reduced padding when collapsed
                                                        marginBottom: '2px', // ✅ Minimal margin
                                                        borderRadius: '8px', // ✅ Strict border radius
                                                        overflow: 'hidden', // ✅ FIX: Prevent text overflow artifacts
                                                        fontSize: '13.5px', // ✅ Strict font size
                                                        fontWeight: 500, // ✅ Strict font weight
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease-in-out', // ✅ Strict transition
                                                        color: isActive 
                                                            ? 'var(--theme-primary-600)' 
                                                            : 'var(--theme-text-secondary)', // ✅ Active: Primary | Inactive: Secondary text
                                                        background: isActive 
                                                            ? 'var(--theme-primary-100)' 
                                                            : 'transparent', // ✅ Active: Turquoise bg | Inactive: Transparent
                                                        position: 'relative', // ✅ For ActiveBar positioning
                                                    })}
                                                    onMouseEnter={(e) => {
                                                        if (!e.currentTarget.classList.contains('bg-teal-500/15')) {
                                                            e.currentTarget.style.background = 'var(--theme-bg-tertiary)';
                                                            e.currentTarget.style.color = 'var(--theme-primary-600)';
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
                                                            {/* ✅ ActiveBar - Thin indicator on the right (RTL) */}
                                                            {isActive && (
                                                                <div 
                                                                    className="absolute right-0 top-1/2 -translate-y-1/2"
                                                                    style={{
                                                                        width: '3px', // ✅ Thin bar
                                                                        height: '16px', // ✅ Compact height
                                                                        background: '#20B2AA', // ✅ ADORA Turquoise
                                                                        borderRadius: '10px', // ✅ Rounded
                                                                        position: 'absolute',
                                                                        right: 0, // ✅ RTL positioning
                                                                    }}
                                                                />
                                                            )}
                                                            {/* ✅ Icon styling - Inherits color from parent */}
                                                            <span 
                                                                className="flex-shrink-0 transition-colors duration-300" 
                                                                style={{ 
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                }}
                                                            >
                                                                {React.isValidElement(item.icon) 
                                                                    ? React.cloneElement(item.icon as React.ReactElement<any>, {
                                                                        className: 'w-4 h-4', // ✅ Smaller icon for compact sidebar
                                                                        size: 16,
                                                                        strokeWidth: 2, // ✅ Normal stroke width
                                                                        style: { 
                                                                            color: 'inherit', // ✅ Inherits color from parent (Turquoise when active, Slate when inactive)
                                                                            opacity: 1,
                                                                        }
                                                                    })
                                                                    : item.icon
                                                                }
                                                            </span>
                                                            {/* ✅ FIX: Hide label when collapsed */}
                                                            {!isCollapsed ? (
                                                                <span 
                                                                    className="flex-1 text-sm"
                                                                    style={{
                                                                        whiteSpace: 'nowrap',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        lineHeight: '1.4',
                                                                    }}
                                                                >
                                                                    {item.label}
                                                                </span>
                                                            ) : null}
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



                    {/* 🏥 Data Health Indicator - ✅ Hidden when collapsed */}
                    {!isCollapsed && (
                        <div 
                            className="mt-6 mx-0.5 px-2.5 py-2.5 rounded-xl border flex items-center gap-2.5 transition-all duration-300 hover:border-teal-500/30" 
                            style={{ 
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: 'var(--theme-border-primary)',
                                marginTop: '16px',
                            }}
                        >
                            <Activity className="w-3.5 h-3.5 shrink-0" style={{ color: '#20B2AA' }} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1 gap-1">
                                    <span 
                                        className="text-[10px] font-bold uppercase transition-colors duration-300"
                                        style={{ 
                                            color: '#20B2AA',
                                            fontFamily: 'Cairo, sans-serif',
                                            whiteSpace: 'normal',
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {t('admin.safeWorkEnvironment') || 'بيئة العمل آمنة'}
                                    </span>
                                    <span 
                                        className="text-[10px] transition-colors duration-300 flex-shrink-0" 
                                        style={{ color: '#20B2AA' }}
                                    >
                                        100%
                                    </span>
                                </div>
                                <div className="h-1 w-full rounded-full overflow-hidden transition-colors duration-300" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <div className="h-full w-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.5)]"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ✅ DEMO SUBSCRIPTION BUTTON: "أرغب في الاشتراك" - Only for Demo accounts */}
                    {!isCollapsed && isDemoAccount && (
                        <button
                            onClick={() => setShowSubscriptionModal(true)}
                            className="mt-4 mx-0.5 px-4 py-3 rounded-xl border-2 flex items-center justify-center gap-2.5 transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                            style={{ 
                                background: 'linear-gradient(135deg, #20B2AA 0%, #14B8A6 100%)',
                                borderColor: '#20B2AA',
                                color: '#ffffff',
                                fontWeight: 600,
                                fontFamily: 'Cairo, sans-serif',
                            }}
                        >
                            <Sparkles className="w-4 h-4" />
                            <span className="text-sm">أرغب في الاشتراك</span>
                        </button>
                    )}
                </nav>
            </div>

            {/* 🚪 Logout Button - ✅ REMOVED: Moved to header next to refresh button in EnhancedOwnerDashboard */}

            {/* ✅ DEMO SUBSCRIPTION MODAL: "أرغب في الاشتراك" Modal (same as AboutUs trial modal) */}
            <UnifiedModal
                isOpen={showSubscriptionModal}
                onClose={() => {
                    if (!isSubmittingSubscription) {
                        setShowSubscriptionModal(false);
                        setIsSubscriptionSuccess(false);
                        setSubscriptionName('');
                        setSubscriptionPhone('');
                        setSubscriptionRequiredBranches(1);
                    }
                }}
                title={isSubscriptionSuccess ? undefined : (t('admin.wantToSubscribe') || 'أرغب في الاشتراك الرسمي')}
                subtitle={isSubscriptionSuccess ? undefined : (t('admin.subscriptionFormMessage') || 'يرجى ملء البيانات التالية وسنتواصل معك قريباً')}
                icon={isSubscriptionSuccess ? <CheckCircle2 className="w-6 h-6 text-green-400" /> : <Sparkles className="w-6 h-6 text-teal-400" />}
                size="md"
                showCloseButton={!isSubscriptionSuccess && !isSubmittingSubscription}
                closeOnBackdrop={!isSubmittingSubscription}
            >
                {isSubscriptionSuccess ? (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-green-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">تم إرسال طلبك بنجاح!</h3>
                        <p className="text-white/80">سنتواصل معك قريباً لإتمام عملية الاشتراك الرسمي</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Name Input */}
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                                الاسم <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="text"
                                    value={subscriptionName}
                                    onChange={(e) => setSubscriptionName(e.target.value)}
                                    placeholder={t('placeholder.enterName')}
                                    className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                                    dir="rtl"
                                    disabled={isSubmittingSubscription}
                                />
                            </div>
                        </div>

                        {/* Phone Input */}
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                                رقم الجوال <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="tel"
                                    value={subscriptionPhone}
                                    onChange={(e) => setSubscriptionPhone(e.target.value.replace(/\D/g, ''))}
                                    placeholder={t('placeholder.phoneNumber')}
                                    className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                                    dir="ltr"
                                    disabled={isSubmittingSubscription}
                                    maxLength={15}
                                />
                            </div>
                            <p className="text-xs text-white/50 mt-1">مثال: 0501234567</p>
                        </div>

                        {/* Required Branches Input */}
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                                عدد التراخيص المطلوبة (كل فرع = ترخيص واحد)
                            </label>
                            <div className="space-y-3">
                                <div className="grid grid-cols-4 gap-2">
                                    {[1, 2, 3, 4, 5, 10, 15, 20].map((num) => (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => setSubscriptionRequiredBranches(num)}
                                            disabled={isSubmittingSubscription}
                                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                                subscriptionRequiredBranches === num
                                                    ? 'bg-teal-500 text-white border-2 border-teal-400'
                                                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/70 border border-slate-300 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'
                                            }`}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative">
                                    <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={subscriptionRequiredBranches}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 1;
                                            setSubscriptionRequiredBranches(Math.max(1, Math.min(100, val)));
                                        }}
                                        placeholder={t('placeholder.customBranches')}
                                        className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                                        dir="ltr"
                                        disabled={isSubmittingSubscription}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-white/50 mt-2">
                                المحدد: <span className="text-teal-400 font-semibold">{subscriptionRequiredBranches} ترخيص</span>
                            </p>
                        </div>

                        {/* Submit Button */}
                        <ModalActions
                            onCancel={() => {
                                if (!isSubmittingSubscription) {
                                    setShowSubscriptionModal(false);
                                    setSubscriptionName('');
                                    setSubscriptionPhone('');
                                    setSubscriptionRequiredBranches(1);
                                }
                            }}
                            onConfirm={async () => {
                                if (!subscriptionName.trim() || !subscriptionPhone.trim()) {
                                    showError('يرجى ملء جميع الحقول المطلوبة');
                                    return;
                                }

                                const phoneRegex = /^[0-9]{8,15}$/;
                                const cleanPhone = subscriptionPhone.replace(/\s+/g, '');
                                if (!phoneRegex.test(cleanPhone)) {
                                    showError('رقم الجوال غير صحيح');
                                    return;
                                }

                                setIsSubmittingSubscription(true);
                                try {
                                    // ✅ Submit with source: 'demo_account' to distinguish from AboutUs requests
                                    const result = await submitTrialRequest(
                                        subscriptionName.trim(), 
                                        cleanPhone, 
                                        'demo_account', 
                                        subscriptionRequiredBranches
                                    );

                                    if (result.success) {
                                        setIsSubscriptionSuccess(true);
                                        success('تم إرسال طلبك بنجاح! سنتواصل معك قريباً');
                                        
                                        setTimeout(() => {
                                            setShowSubscriptionModal(false);
                                            setIsSubscriptionSuccess(false);
                                            setSubscriptionName('');
                                            setSubscriptionPhone('');
                                            setSubscriptionRequiredBranches(1);
                                        }, 3000);
                                    } else {
                                        showError(result.error || 'فشل إرسال الطلب');
                                    }
                                } catch (err: any) {
                                    showError(err.message || t('trialForm.error'));
                                } finally {
                                    setIsSubmittingSubscription(false);
                                }
                            }}
                            cancelText={t('common.cancel')}
                            confirmText={t('common.submit')}
                            confirmVariant="primary"
                            loading={isSubmittingSubscription}
                            disabled={!subscriptionName.trim() || !subscriptionPhone.trim() || isSubmittingSubscription}
                        />
                    </div>
                )}
            </UnifiedModal>
        </aside>
    );
};
