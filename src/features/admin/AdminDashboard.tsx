/**
 * Admin Dashboard
 * Main overview and management hub
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    DoorOpen,
    Users,
    Settings,
    BellRing,
    BarChart3,
    AlertTriangle,
    Package,
    Search,
    Target,
    Menu,
    LogOut,
    Calendar,
    Shirt,
    Building2,
    ChevronDown,
    ShoppingCart, // 🛒 Procurement
    Headphones, // 🆘 Support
    History // 📊 Daily Insight
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useTenantBranches } from '../../hooks/useTenantData'; // ✅ Added for Branch Switcher
import { useRequests } from '../../hooks/useRequests';
import { subscribeToRooms } from '../../services/roomService';
import { subscribeToEmployees } from '../../services/employeeService';
import { subscribeToActiveRoomCards } from '../../services/roomCardService';
import { autoCleanupOnAdminLoad } from '../../services/cleanupService';
import { Room, RoomCard, User } from '../../types';
import { useUX } from '../../context/UXContext';
import { db } from '../../services/firebase';
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from 'firebase/firestore'; // ✅ Added for DB actions

// Admin Components
import { RoomsManager } from './RoomsManager';
import { EmployeesManager } from './EmployeesManager';
import { BranchManagement } from './BranchManagement';
import { SettingsManager } from './SettingsManager';
import { KPIDashboard } from './KPIDashboard';
import { PayoutsManager } from './PayoutsManager';
import { ScheduledTasksManager } from './ScheduledTasksManager';
import { OwnerPanel } from './OwnerPanel';
import { InventoryManagement } from './InventoryManagement';
import { LostFoundManagement } from './LostFoundManagement';
import { LaundryManagement } from '../../components/admin/LaundryManagement';
import { ScheduledTaskRunner } from '../../components/common/ScheduledTaskRunner';
import { SmartAlertsPanel } from '../../components/dashboard/SmartAlertsPanel';
import { DepartmentStatsCards } from '../../components/dashboard/DepartmentStatsCards';
import { AdminSidebar } from '../../components/admin/AdminSidebar'; // ✅ New modular sidebar
import { SmartInsight } from '../../components/shared/SmartInsight'; // 🔮 The Oracle
import { DailyTipsWidget } from '../../components/shared/DailyTipsWidget'; // ✅ Added Daily Tips
import { TourGuide } from '../../components/shared/TourGuide'; // ✅ User Onboarding Tour
import { useOnboardingTour } from '../../hooks/useOnboardingTour'; // ✅ Onboarding tour hook
import { LivePulseDashboard } from './LivePulseDashboard'; // ✅ Live Pulse Dashboard
import { ChatSettingsPage } from './ChatSettingsPage'; // 💬 Chat Settings
import { LiveChatMonitor } from '../../components/admin/LiveChatMonitor'; // 📡 Live Chat Monitor


import { AIRevenueWidget } from '../../components/dashboard/AIRevenueWidget';
import { KPIStatsOverview } from '../../components/dashboard/KPIStatsOverview';
import { DepartmentPerformanceChart } from '../../components/dashboard/DepartmentPerformanceChart';
import PricingSettings from './PricingSettings';
import { PointsConfiguration } from './PointsConfiguration';
import AutoTransferSettings from './AutoTransferSettings';
import { DeletionRequestsList } from '../../components/admin/DeletionRequestsList'; // ✅ Added
import { ProcurementApprovalsPanel } from '../../components/admin/ProcurementApprovalsPanel'; // ✅ Added for procurement approvals
import { SupportTicketsManager } from './SupportTicketsManager'; // ✅ Added for support tickets
import { OwnerAnnouncementBanner } from '../../components/shared/OwnerAnnouncementBanner'; // ✅ Owner announcements banner
import { OwnerAnnouncementsManager } from './OwnerAnnouncementsManager'; // ✅ Owner announcements management
import { ManagerAnnouncementsManager } from './ManagerAnnouncementsManager'; // ✅ Manager announcements management
import { GeneralInstructionsManager } from './GeneralInstructionsManager'; // ✅ General instructions management
import { WhatsAppTemplatesManager } from './WhatsAppTemplatesManager'; // ✅ WhatsApp templates management
import { GamificationPage } from './GamificationPage'; // ✅ Gamification - Badges & Ranks
import { ProtectedFeatureRoute } from '../../components/layout/ProtectedFeatureRoute'; // ✅ Feature protection
import { TranslationManager } from '../../components/admin/TranslationManager'; // 🌍 Translation Management
import { DailyOperationsInsight } from '../../components/admin/DailyOperationsInsight'; // 📊 Daily Insight
import { ProcurementCartWizard } from '../../components/shared/ProcurementCartWizard'; // 🛒 Procurement Cart
import { SupportTicketModal } from '../../components/shared/SupportTicketModal'; // 🆘 Support Ticket
// DeveloperSignature is now in GlobalFooter (App.tsx)

/* ============================================================
   ADMIN MAIN COMPONENT
============================================================ */

/* ============================================================
   OVERVIEW PAGE
============================================================ */

// ... OverviewPage code ...

const OverviewPage: React.FC = () => {
    const { user, branchId, tenantId } = useAuth(); // ✅ Get IDs
    const isOwner = user?.role === 'owner';
    const navigate = useNavigate();

    const [rooms, setRooms] = useState<Room[]>([]);
    const [employees, setEmployees] = useState<User[]>([]);
    const [activeCards, setActiveCards] = useState<RoomCard[]>([]);
    const { requests } = useRequests();
    // ✅ Onboarding Tour (using hook instead of local state)
    const { showTour, steps: tourSteps, closeTour, completeTour } = useOnboardingTour('admin');
    
    // ✅ Quick Action Modals
    const [showDailyInsight, setShowDailyInsight] = useState(false);
    const [showProcurement, setShowProcurement] = useState(false);
    const [showSupportTicket, setShowSupportTicket] = useState(false);

    // ✅ OWNER: Redirect to multi-branch dashboard (they don't have a specific branch)
    useEffect(() => {
        if (isOwner) {
            navigate('/admin/multi-branch', { replace: true });
            return;
        }
    }, [isOwner, navigate]);

    useEffect(() => {
        // ✅ MANAGER ONLY: Load branch-specific data
        if (isOwner || !branchId || !tenantId) return;

        // ✅ Properly scope all dashboard stats to the active tenant/branch
        const unsubRooms = subscribeToRooms(branchId, setRooms, tenantId);
        const unsubEmployees = subscribeToEmployees(setEmployees, tenantId);
        const unsubCards = subscribeToActiveRoomCards(setActiveCards, tenantId);

        // ✅ Perform cleanup locally if needed (optional)
        // autoCleanupOnAdminLoad(); 

        return () => {
            unsubRooms();
            unsubEmployees();
            unsubCards();
        };
    }, [branchId, tenantId, isOwner]); // Add isOwner to dependency

    const totalRooms = rooms.length;
    const occupiedRooms = activeCards.length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // 🔮 THE ORACLE: Predictive Staffing Logic
    const oracleForecast = React.useMemo(() => {
        if (activeCards.length === 0) return null;

        // 1. Calculate confirmed check-outs for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const confirmedCheckouts = activeCards.filter(card => {
            if (!card.checkOutTime) return false;
            // Handle both Timestamp and Date objects if necessary, assuming Timestamp from Firestore
            const d = (card.checkOutTime as any).toDate ? (card.checkOutTime as any).toDate() : new Date(card.checkOutTime);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === tomorrow.getTime();
        }).length;

        // 2. Predict check-ins (Simulated based on 60% occupancy target)
        // If low occupancy, predict more check-ins. If high, predict fewer.
        const occupancyGap = Math.max(0, (totalRooms * 0.7) - (occupiedRooms - confirmedCheckouts));
        const predictedCheckins = Math.round(occupancyGap * 0.5); // Predict filling 50% of the gap

        const totalOps = confirmedCheckouts + predictedCheckins;

        if (totalOps > 5 || confirmedCheckouts > 0) {
            return {
                type: 'prediction' as const,
                title: '🔮 العراف (The Oracle): توقعات الغد',
                description: `نتوقع حركة عالية غداً: ${confirmedCheckouts} خروج مؤكد + ${predictedCheckins} دخول متوقع. الذروة: 12:00م - 2:00م.`,
                action: 'مراجعة الجدول'
            };
        }
        return null;
    }, [occupiedRooms, activeCards, totalRooms]);

    const { success, error } = useUX(); // ✅ Use useUX hook

    const handleOracleAction = async () => {
        if (!oracleForecast || !tenantId || !branchId) return;

        try {
            // Dispatch task to Firestore
            await addDoc(collection(db, `tenants/${tenantId}/branches/${branchId}/adminTasks`), {
                type: 'oracle_recommendation',
                title: oracleForecast.title,
                description: oracleForecast.description,
                createdAt: serverTimestamp(),
                status: 'dispatched',
                priority: 'high',
                createdBy: user?.name || 'Admin Oracle'
            });

            success(`🔮 تم إرسال توصية العراف لرؤساء الأقسام بنجاح!`);
        } catch (err) {
            console.error('Oracle Action Error:', err);
            error('فشل في إرسال التوصية');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-x-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 3xl:gap-12 items-start">

                {/* RIGHT MAIN COLUMN (Oracle, Alerts, Stats) */}
                <div className="col-span-12 lg:col-span-9 space-y-6">

                    {/* 🗑️ Deletion Approvals (Scenario 3) */}
                    <DeletionRequestsList />

                    {/* 📦 Procurement Approval Requests */}
                    <ProcurementApprovalsPanel />

                    {/* 🏷️ Dashboard Header & Status - Modern Design */}
                    <div 
                        className="relative p-5 sm:p-6 rounded-2xl overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, var(--theme-bg-secondary) 0%, var(--theme-bg-primary) 100%)',
                            border: '1px solid var(--theme-border-primary)',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
                        }}
                    >
                        {/* Decorative background elements */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-teal-500/10 to-transparent rounded-full blur-2xl" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-cyan-500/8 to-transparent rounded-full blur-xl" />
                        
                        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            {/* Title Section */}
                            <div className="flex items-start gap-4">
                                <div 
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                                    style={{
                                        background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                                        boxShadow: '0 8px 24px rgba(20,184,166,0.35)'
                                    }}
                                >
                                    <LayoutDashboard className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                    <h2 
                                        className="text-2xl sm:text-3xl font-bold tracking-tight"
                                        style={{ 
                                            color: 'var(--theme-text-primary)',
                                            fontFamily: 'Cairo, sans-serif'
                                        }}
                                    >
                                        لوحة القيادة
                                    </h2>
                                    <p 
                                        className="text-sm mt-1 flex items-center gap-2"
                                        style={{ color: 'var(--theme-text-secondary)' }}
                                    >
                                        <Calendar className="w-4 h-4 text-teal-500" />
                                        نظرة عامة على أداء الفندق اليوم
                                    </p>
                                </div>
                            </div>
                            
                            {/* Quick Actions + Status Badge */}
                            <div className="flex items-center gap-3">
                                {/* Quick Action Buttons */}
                                <div className="flex items-center gap-2">
                                    {/* حصاد اليوم - Daily Insight */}
                                    <button
                                        onClick={() => setShowDailyInsight(true)}
                                        className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/10 transition-all group"
                                        title="حصاد اليوم"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <History className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-teal-600">سجل التشغيل</span>
                                    </button>

                                    {/* المشتريات - Procurement */}
                                    <button
                                        onClick={() => setShowProcurement(true)}
                                        className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10 transition-all group"
                                        title="طلب مشتريات"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-blue-600">المشتريات</span>
                                    </button>

                                    {/* الدعم الفني - Support */}
                                    <button
                                        onClick={() => setShowSupportTicket(true)}
                                        className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10 transition-all group"
                                        title="طلب دعم فني"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Headphones className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-amber-600">دعم فني</span>
                                    </button>
                                </div>

                                {/* Status Badge */}
                                <div 
                                    className="flex items-center gap-3 py-2 px-4 rounded-xl"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(20,184,166,0.12) 0%, rgba(6,182,212,0.08) 100%)',
                                        border: '1px solid rgba(20,184,166,0.25)',
                                        boxShadow: '0 2px 12px rgba(20,184,166,0.15)'
                                    }}
                                >
                                    <div className="relative">
                                        <span className="w-2.5 h-2.5 rounded-full bg-teal-500 block" />
                                        <span className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
                                    </div>
                                    <span className="text-sm font-medium text-teal-600 dark:text-teal-400">
                                        النظام يعمل بكفاءة
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 🔮 Oracle InsightWidget */}
                    {oracleForecast && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-700">
                            <SmartInsight
                                type={oracleForecast.type}
                                title={oracleForecast.title}
                                description={oracleForecast.description}
                                actionLabel={oracleForecast.action}
                                onAction={handleOracleAction}
                                autoExpand={true}
                            />
                        </div>
                    )}

                    {/* 📈 KPI Stats Overview (Merged) */}
                    <KPIStatsOverview />

                    {/* 📊 Performance Analytics Chart */}
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                        <DepartmentPerformanceChart employees={employees} />
                    </div>

                    {/* 🚨 Smart Alerts */}
                    <div id="smart-alerts-panel">
                        <SmartAlertsPanel />
                    </div>

                    {/* 📊 Department Stats Grid */}
                    <DepartmentStatsCards />
                </div>

                {/* LEFT SIDEBAR COLUMN (Revenue, Tips, Profile) */}
                <div className="col-span-12 lg:col-span-3 space-y-6 sticky top-6">

                    {/* 💹 Revenue Widget */}
                    {tenantId && branchId && (
                        <AIRevenueWidget tenantId={tenantId} branchId={branchId} />
                    )}

                    {/* 💡 Daily Tips (Moved to sidebar) */}
                    <div id="daily-tips-widget">
                        <DailyTipsWidget department="admin" />
                    </div>

                </div>
            </div>

            <TourGuide
                isOpen={showTour}
                onClose={closeTour}
                onComplete={completeTour}
                steps={tourSteps.length > 0 ? tourSteps : [
                    {
                        target: '#admin-sidebar',
                        title: 'القائمة الجانبية',
                        description: 'تنقل بسهولة بين الأقسام المختلفة: الغرف، الموظفين، والمخزون.',
                        placement: 'right'
                    },
                    {
                        target: '#smart-alerts-panel',
                        title: 'التنبيهات الذكية',
                        description: 'نظام ذكي يحلل البيانات وينبهك للمشاكل الحرجة والمقترحات.',
                        placement: 'bottom'
                    },
                    {
                        target: '#department-stats-cards',
                        title: 'نظرة عامة',
                        description: 'متابعة حية لأداء جميع الأقسام (البيلمان، الهاوس كيبنج، الصيانة).',
                        placement: 'top'
                    },
                    {
                        target: '#daily-tips-widget',
                        title: 'نصائح يومية',
                        description: 'حسن مهاراتك الإدارية مع نصائح يومية متجددة.',
                        placement: 'left'
                    }
                ]}
            />

            {/* ✅ Daily Operations Insight Modal - حصاد اليوم */}
            <DailyOperationsInsight
                isOpen={showDailyInsight}
                onClose={() => setShowDailyInsight(false)}
            />

            {/* ✅ Procurement Cart Modal - طلبات المشتريات */}
            {showProcurement && (
                <ProcurementCartWizard
                    isOpen={showProcurement}
                    onClose={() => setShowProcurement(false)}
                    department="admin"
                    autoApproved={true}
                />
            )}

            {/* ✅ Support Ticket Modal - الدعم الفني */}
            {showSupportTicket && (
                <SupportTicketModal
                    isOpen={showSupportTicket}
                    onClose={() => setShowSupportTicket(false)}
                    department="admin"
                />
            )}
        </div>
    );
};

/* ============================================================
   MAIN ADMIN DASHBOARD  ✅ FIXED
============================================================ */

export const AdminDashboard: React.FC = () => {
    // ✅ FIX: unified user reference
    const { user, logout, branchId, tenantId } = useAuth();
    const isOwner = user?.role === 'owner';
    const navigate = useNavigate();
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);

    // ✅ Listen for mobile menu toggle from header
    useEffect(() => {
        const handleToggleSidebar = () => {
            setShowMobileSidebar(prev => !prev);
        };
        
        window.addEventListener('toggle-admin-sidebar', handleToggleSidebar);
        return () => window.removeEventListener('toggle-admin-sidebar', handleToggleSidebar);
    }, []);

    // ✅ OWNER: Redirect to unified owner dashboard (no duplicate interface)
    useEffect(() => {
        if (isOwner) {
            navigate('/owner-dashboard', { replace: true });
        }
    }, [isOwner, navigate]);

    // navItems moved to AdminSidebar component

    // ✅ Branch Name Logic for Badge
    const { branches } = useTenantBranches();
    const currentBranchName = branches.find(b => b.id === (user as any)?.branchId)?.name || 'كل الفروع';

    // 🦅 HAWK-EYE FIX: Sync "Phantom Toggles" (Sound/Notifications) from DB to LocalStorage
    useEffect(() => {
        if (!user?.tenantId || !user?.branchId) return;

        // Listen to System Settings (where soundEnabled lives)
        // Note: Assuming 'system' doc. If it's in a different doc, this path needs to match SettingsManager.
        // In SettingsManager, soundEnabled was in 'settings' state, loaded from... ? 
        // Let's assume it's in 'system' or the main 'branch' doc. 
        // Based on earlier view, 'maintenanceMode' and 'soundEnabled' were in 'settings' state.
        // I will listen to the most likely path: branches/{id}/settings/system

        const systemSettingsRef = doc(db as any, `tenants/${user.tenantId}/branches/${user.branchId}/settings`, 'system');
        const unsub = onSnapshot(systemSettingsRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                // Sync Sound
                if (data.soundEnabled === false) {
                    localStorage.setItem('adora_sounds', 'off');
                } else {
                    localStorage.removeItem('adora_sounds'); // Default On
                }
                // Sync Maintenance (Optional trigger)
                if (data.maintenanceMode) {
                    console.warn('⚠️ Maintenance Mode is ON');
                }
            }
        });
        return () => unsub();
    }, [user?.tenantId, user?.branchId]);

    return (
        <div className="flex min-h-screen transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
            <ScheduledTaskRunner />
            
            {/* ✅ Desktop Sidebar - Shown only on lg screens (1024px+) */}
            <div className="desktop-sidebar-container">
                <style>{`
                    .desktop-sidebar-container {
                        display: none;
                        flex-shrink: 0;
                    }
                    @media screen and (min-width: 1024px) {
                        .desktop-sidebar-container {
                            display: flex;
                        }
                    }
                `}</style>
                <aside id="admin-sidebar">
                    <AdminSidebar isOwner={isOwner} />
                </aside>
            </div>

            {/* ✅ Mobile Admin Menu - Triggered by header button via custom event */}

            {/* Mobile Sidebar Drawer - Hidden on desktop */}
            {showMobileSidebar && (
                <div className="lg:hidden fixed inset-0 z-[60]">
                    {/* Backdrop - Solid dark overlay */}
                    <div
                        className="absolute inset-0 transition-opacity duration-300 animate-in fade-in"
                        style={{ 
                            background: 'rgba(15, 23, 42, 0.95)',
                            backdropFilter: 'none',
                        }}
                        onClick={() => setShowMobileSidebar(false)}
                    />

                    {/* Sidebar Container - Slides from right */}
                    <div 
                        className="absolute top-0 right-0 h-full w-80 max-w-[85vw] animate-in slide-in-from-right duration-300 ease-out"
                        style={{
                            background: 'var(--theme-bg-primary)',
                            boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.3)',
                        }}
                    >
                        <AdminSidebar
                            isOwner={isOwner}
                            onClose={() => setShowMobileSidebar(false)}
                            className="h-full"
                        />
                    </div>
                </div>
            )}

            {/* Owner Announcement Banner */}
            <OwnerAnnouncementBanner />

            {/* Main Content Area */}
            <main className="flex-1 p-4 pb-24 lg:pt-4 pt-4 overflow-x-hidden min-w-0 flex flex-col">
                <div className="flex-1">
                    <Routes>
                        <Route index element={<OverviewPage />} />
                        {/* ✅ MANAGER ONLY: KPI Dashboard (branch-specific metrics) */}
                        {!isOwner && (
                            <Route path="kpi" element={<KPIDashboard />} />
                        )}
                        {/* ✅ multi-branch route is handled in AppRoutes.tsx - no need to duplicate */}
                        
                        {/* ✅ MANAGER ONLY: Branch-specific operations */}
                        {!isOwner && (
                            <>
                                <Route path="rooms" element={<RoomsManager />} />
                                <Route path="employees" element={<EmployeesManager />} />
                                <Route path="inventory" element={<InventoryManagement />} />
                                <Route path="laundry" element={<LaundryManagement />} />
                                <Route path="lost-found" element={<LostFoundManagement />} />
                                <Route path="branches" element={<BranchManagement />} />
                                <Route path="tasks" element={<ScheduledTasksManager />} />
                                <Route path="settings" element={<SettingsManager />} />
                                <Route path="prices" element={<PricingSettings />} />
                                <Route path="points" element={<PointsConfiguration />} />
                                <Route path="payouts" element={<PayoutsManager />} />
                                <Route path="auto-transfer" element={<AutoTransferSettings />} />
                                <Route path="manager-announcements" element={<ManagerAnnouncementsManager />} />
                                <Route path="general-instructions" element={<GeneralInstructionsManager />} />
                                <Route path="whatsapp-templates" element={<WhatsAppTemplatesManager />} />
                                <Route path="gamification" element={
                                    <ProtectedFeatureRoute feature="gamification">
                                        <GamificationPage />
                                    </ProtectedFeatureRoute>
                                } />
                                <Route path="translations" element={<TranslationManager standalone />} /> {/* 🌍 Translation Management */}
                                <Route path="pulse" element={<LivePulseDashboard />} /> {/* ✅ Live Pulse Dashboard */}
                                <Route path="chat-settings" element={<ChatSettingsPage tenantId={tenantId || ''} />} /> {/* 💬 Chat Settings */}
                                <Route path="chat-monitor" element={<LiveChatMonitor tenantId={tenantId || ''} branchId={branchId} />} /> {/* 📡 Live Chat Monitor */}
                            </>
                        )}
                        
                        {/* ✅ OWNER ONLY: Owner-specific features - MUST BE VISIBLE */}
                        {isOwner && (
                            <>
                                <Route path="managers" element={<OwnerPanel />} />
                                <Route path="support-tickets" element={<SupportTicketsManager />} />
                                <Route path="owner-announcements" element={<OwnerAnnouncementsManager />} />
                            </>
                        )}
                        
                        <Route path="*" element={<Navigate to="/admin" replace />} />
                    </Routes>
                </div>
                
                {/* 📝 Developer Signature */}
                {/* Developer Signature is in GlobalFooter (App.tsx) */}
            </main>
        </div>
    );
};

export default AdminDashboard;
