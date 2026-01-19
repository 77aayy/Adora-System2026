/**
 * Admin Dashboard
 * Main overview and management hub
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
    History, // 📊 Daily Insight
    Wrench,
    CheckCircle2
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
import { createAdminTask } from '../../services/adminTasksService';
import { db } from '../../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { logger } from '../../services/loggerService';

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

    // ✅ OWNER: Redirect to owner dashboard (unified interface)
    // NOTE: Removed redirect to /admin/multi-branch as it conflicts with AdminDashboard's redirect
    // Owner should use /owner-dashboard directly
    useEffect(() => {
        if (isOwner) {
            navigate('/owner-dashboard', { replace: true });
            return;
        }
    }, [isOwner, navigate]);

    useEffect(() => {
        // ✅ MANAGER ONLY: Load branch-specific data
        if (isOwner || !branchId || !tenantId) return;

        // ✅ Properly scope all dashboard stats to the active tenant/branch
        const unsubRooms = subscribeToRooms(branchId, setRooms, tenantId);
        const unsubEmployees = subscribeToEmployees(setEmployees, tenantId);
        // ✅ CRITICAL FIX: Pass branchId to prevent duplicate Room Cards from other branches
        const unsubCards = subscribeToActiveRoomCards(setActiveCards, tenantId, branchId);

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
    const underMaintenance = rooms.filter(r => r.status === 'maintenance' || r.status === 'MAINTENANCE').length;
    const availableRooms = rooms.filter(r => r.status === 'available' || r.status === 'AVAILABLE').length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // Physics Worker Refs for Floor Load Efficiency
    const workerRef = useRef<Worker | null>(null);
    const positionsRef = useRef<Float32Array | null>(null);
    const [floorLoadData, setFloorLoadData] = useState<Array<{ floorNumber: number; loadPercentage: number; maxCapacity: number; currentLoad: number }>>([]);

    // Initialize Physics Worker for Floor Load Efficiency
    useEffect(() => {
        if (!tenantId || !branchId || rooms.length === 0) return;

        try {
            const objectCount = Math.max(rooms.length || 100, 100);
            const sharedPositions = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 2 * objectCount);
            const sharedVelocities = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 2 * objectCount);
            const positions = new Float32Array(sharedPositions);
            const velocities = new Float32Array(sharedVelocities);

            for (let i = 0; i < objectCount * 2; i += 2) {
                positions[i] = Math.random() * 100;
                positions[i + 1] = Math.random() * 100;
                velocities[i] = (Math.random() - 0.5) * 2;
                velocities[i + 1] = (Math.random() - 0.5) * 2;
            }

            positionsRef.current = positions;
            workerRef.current = new Worker(
                new URL('../../workers/physics.worker.ts', import.meta.url),
                { type: 'module' }
            );

            workerRef.current.postMessage({
                type: 'INIT',
                sharedPositions,
                sharedVelocities,
                count: objectCount
            });

            const calculateFloorLoad = () => {
                const floorMap = new Map<number, Room[]>();
                rooms.forEach(room => {
                    const floor = room.floor || 1;
                    if (!floorMap.has(floor)) floorMap.set(floor, []);
                    floorMap.get(floor)!.push(room);
                });

                const floorData: Array<{ floorNumber: number; loadPercentage: number; maxCapacity: number; currentLoad: number }> = [];
                floorMap.forEach((floorRooms, floorNumber) => {
                    const totalRoomsOnFloor = floorRooms.length;
                    const occupiedOnFloor = floorRooms.filter(r => r.status === 'occupied' || r.status === 'OCCUPIED').length;
                    const loadPercentage = totalRoomsOnFloor > 0 ? Math.round((occupiedOnFloor / totalRoomsOnFloor) * 100) : 0;
                    
                    floorData.push({
                        floorNumber,
                        loadPercentage,
                        maxCapacity: totalRoomsOnFloor,
                        currentLoad: occupiedOnFloor
                    });
                });

                setFloorLoadData(floorData.sort((a, b) => a.floorNumber - b.floorNumber));
            };

            const interval = setInterval(calculateFloorLoad, 2000);
            calculateFloorLoad();

            return () => {
                clearInterval(interval);
                workerRef.current?.terminate();
            };
        } catch (error) {
            console.error('Failed to initialize physics worker:', error);
        }
    }, [tenantId, branchId, rooms]);

    const avgFloorLoadEfficiency = useMemo(() => {
        if (floorLoadData.length === 0) return 0;
        const sum = floorLoadData.reduce((acc, floor) => acc + floor.loadPercentage, 0);
        return Math.round(sum / floorLoadData.length);
    }, [floorLoadData]);

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
            // ✅ Architecture: Use service instead of direct Firebase call
            const result = await createAdminTask(tenantId, branchId, {
                type: 'oracle_recommendation',
                title: oracleForecast.title,
                description: oracleForecast.description,
                priority: 'high',
                createdBy: user?.name || 'Admin Oracle'
            });

            if (result.success) {
                success(`🔮 تم إرسال توصية العراف لرؤساء الأقسام بنجاح!`);
            } else {
                error(result.error || 'فشل في إرسال التوصية');
            }
        } catch (err: any) {
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
                                        className="flex flex-col items-center gap-1 p-2 rounded-xl border transition-all group"
                                        style={{
                                            background: 'var(--theme-bg-secondary)',
                                            borderColor: 'var(--theme-border-primary)',
                                        }}
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
                                        style={{
                                            background: 'var(--theme-bg-secondary)',
                                            borderColor: 'var(--theme-border-primary)',
                                        }}
                                        title="طلب مشتريات"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 dark:from-blue-500/30 dark:to-indigo-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <ShoppingCart 
                                                className="w-5 h-5 text-blue-600 dark:text-blue-400" 
                                            />
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            المشتريات
                                        </span>
                                    </button>

                                    {/* الدعم الفني - Support */}
                                    <button
                                        onClick={() => setShowSupportTicket(true)}
                                        className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10 transition-all group"
                                        style={{
                                            background: 'var(--theme-bg-secondary)',
                                            borderColor: 'var(--theme-border-primary)',
                                        }}
                                        title="طلب دعم فني"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 dark:from-amber-500/30 dark:to-orange-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Headphones 
                                                className="w-5 h-5 text-amber-600 dark:text-amber-400" 
                                            />
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                            دعم فني
                                        </span>
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

                    {/* 🏨 Hotel Stats Cards - Turquoise Theme (#40E0D0) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Total Rooms */}
                        <div 
                            className="p-6 rounded-xl transition-all hover:scale-105"
                            style={{
                                background: 'rgba(64, 224, 208, 0.1)',
                                border: '1px solid rgba(64, 224, 208, 0.2)',
                                boxShadow: '0 4px 16px rgba(64, 224, 208, 0.15)'
                            }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm opacity-75">
                                    إجمالي الغرف
                                </div>
                                <DoorOpen className="w-5 h-5" style={{ color: '#40E0D0' }} />
                            </div>
                            <div className="text-3xl font-bold" style={{ color: '#40E0D0' }}>
                                {totalRooms}
                            </div>
                        </div>

                        {/* Occupied Rooms */}
                        <div 
                            className="p-6 rounded-xl transition-all hover:scale-105"
                            style={{
                                background: 'rgba(34, 197, 94, 0.1)',
                                border: '1px solid rgba(34, 197, 94, 0.2)',
                                boxShadow: '0 4px 16px rgba(34, 197, 94, 0.15)'
                            }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm opacity-75">
                                    مشغولة
                                </div>
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="text-3xl font-bold text-green-500">
                                {occupiedRooms}
                            </div>
                        </div>

                        {/* Under Maintenance */}
                        <div 
                            className="p-6 rounded-xl transition-all hover:scale-105"
                            style={{
                                background: 'rgba(251, 146, 60, 0.1)',
                                border: '1px solid rgba(251, 146, 60, 0.2)',
                                boxShadow: '0 4px 16px rgba(251, 146, 60, 0.15)'
                            }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm opacity-75">
                                    قيد الصيانة
                                </div>
                                <Wrench className="w-5 h-5 text-orange-500" />
                            </div>
                            <div className="text-3xl font-bold text-orange-500">
                                {underMaintenance}
                            </div>
                        </div>

                        {/* Available Rooms */}
                        <div 
                            className="p-6 rounded-xl transition-all hover:scale-105"
                            style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.15)'
                            }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm opacity-75">
                                    متاحة
                                </div>
                                <CheckCircle2 className="w-5 h-5 text-blue-500" />
                            </div>
                            <div className="text-3xl font-bold text-blue-500">
                                {availableRooms}
                            </div>
                        </div>
                    </div>

                    {/* 📊 Floor Load Efficiency - Turquoise Theme */}
                    {floorLoadData.length > 0 && (
                        <div 
                            className="p-6 rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-700"
                            style={{
                                background: 'rgba(64, 224, 208, 0.1)',
                                border: '1px solid rgba(64, 224, 208, 0.2)',
                                boxShadow: '0 8px 32px rgba(64, 224, 208, 0.15)'
                            }}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <BarChart3 className="w-6 h-6" style={{ color: '#40E0D0' }} />
                                <h2 className="text-xl font-bold" style={{ color: '#40E0D0' }}>
                                    كفاءة تحميل الأدوار
                                </h2>
                            </div>

                            {/* Average Efficiency */}
                            <div className="text-center p-4 rounded-lg mb-4" style={{ background: 'rgba(64, 224, 208, 0.1)' }}>
                                <div className="text-sm opacity-75 mb-1">
                                    متوسط الكفاءة
                                </div>
                                <div className="text-4xl font-bold" style={{ color: '#40E0D0' }}>
                                    {avgFloorLoadEfficiency}%
                                </div>
                            </div>

                            {/* Floor Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {floorLoadData.map((floor) => (
                                    <div
                                        key={floor.floorNumber}
                                        className="p-4 rounded-lg"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(64, 224, 208, 0.2)'
                                        }}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-semibold">
                                                الدور {floor.floorNumber}
                                            </span>
                                            <span className="text-sm opacity-75">
                                                {floor.currentLoad}/{floor.maxCapacity}
                                            </span>
                                        </div>
                                        <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'rgba(64, 224, 208, 0.2)' }}>
                                            <div
                                                className="h-full transition-all duration-500"
                                                style={{
                                                    width: `${floor.loadPercentage}%`,
                                                    background: 'linear-gradient(90deg, #40E0D0 0%, #14b8a6 100%)',
                                                    boxShadow: '0 0 12px rgba(64, 224, 208, 0.5)'
                                                }}
                                            />
                                        </div>
                                        <div className="text-xs mt-1 opacity-75">
                                            {floor.loadPercentage.toFixed(1)}% محمّل
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
                steps={tourSteps && tourSteps.length > 0 ? tourSteps : [
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
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // ✅ Listen for mobile menu toggle from header
    useEffect(() => {
        const handleToggleSidebar = () => {
            setShowMobileSidebar(prev => !prev);
        };
        
        window.addEventListener('toggle-admin-sidebar', handleToggleSidebar);
        return () => window.removeEventListener('toggle-admin-sidebar', handleToggleSidebar);
    }, []);

    // ✅ OWNER: Redirect to unified owner dashboard (no duplicate interface)
    // ✅ CRITICAL FIX: Allow Owner to access /admin/support-tickets
    useEffect(() => {
        if (isOwner) {
            const currentPath = window.location.pathname;
            // ✅ Allow Owner to access support-tickets route
            if (currentPath.includes('/admin/support-tickets')) {
                return; // Don't redirect - Owner can access support tickets
            }
            // ✅ Redirect to owner dashboard for all other /admin/* routes
            navigate('/owner-dashboard', { replace: true });
        }
    }, [isOwner, navigate]);

    // navItems moved to AdminSidebar component

    // ✅ Branch Name Logic for Badge
    const { branches } = useTenantBranches();
    const currentBranchName = branches.find(b => b.id === (user as any)?.branchId)?.name || 'كل الفروع';

    // 🦅 HAWK-EYE FIX: Sync "Phantom Toggles" (Sound/Notifications) from DB to LocalStorage
    useEffect(() => {
        // ✅ CRITICAL FIX: Owner doesn't have tenantId/branchId - skip this for owner
        if (isOwner || !user?.tenantId || !user?.branchId || !db) return;

        // Listen to System Settings (where soundEnabled lives)
        // Note: Assuming 'system' doc. If it's in a different doc, this path needs to match SettingsManager.
        // In SettingsManager, soundEnabled was in 'settings' state, loaded from... ? 
        // Let's assume it's in 'system' or the main 'branch' doc. 
        // Based on earlier view, 'maintenanceMode' and 'soundEnabled' were in 'settings' state.
        // I will listen to the most likely path: branches/{id}/settings/system

        // ✅ Null Safety: Check db before operations
        if (!db || !user?.tenantId || !user?.branchId) return;

        const systemSettingsRef = doc(db, `tenants/${user.tenantId}/branches/${user.branchId}/settings`, 'system');
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
                    logger.warn('Maintenance Mode is ON', null, 'AdminDashboard');
                }
            }
        }, (error) => {
            logger.error('Error in system settings subscription', error, 'AdminDashboard');
        });
        return () => unsub();
    }, [isOwner, user?.tenantId, user?.branchId]);

    return (
        <div className="flex min-h-screen transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
            <ScheduledTaskRunner />
            
            {/* ✅ DESKTOP SIDEBAR - Hidden on mobile */}
            <div className="hidden lg:block desktop-sidebar-container flex-shrink-0 fixed top-0 right-0 h-screen z-30">
                <aside id="admin-sidebar" className="h-full">
                    <AdminSidebar 
                        isOwner={isOwner} 
                        onCollapseChange={setIsSidebarCollapsed}
                    />
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

            {/* Main Content Area - Responsive margin for sidebar */}
            <main className="flex-1 p-3 sm:p-4 pb-24 lg:pb-32 lg:pt-4 pt-4 overflow-x-hidden min-w-0 flex flex-col lg:mr-[280px]">
                <div className="flex-1">
                    <Routes>
                        <Route index element={<OverviewPage />} />
                        {/* ✅ MANAGER ONLY: KPI Dashboard (branch-specific metrics) */}
                        {!isOwner && (
                            <Route path="kpi" element={<KPIDashboard />} />
                        )}
                        {/* ✅ multi-branch route is handled in AppRoutes.tsx - no need to duplicate */}
                        
                        {/* ✅ Points Configuration - Available for both Owner and Manager */}
                        <Route path="points" element={<PointsConfiguration />} />
                        
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
                        
                        {/* ✅ SUPPORT TICKETS: Available for both Manager (to create/view their tickets) and Owner (to manage all tickets) */}
                        <Route path="support-tickets" element={<SupportTicketsManager />} />
                        
                        {/* ✅ OWNER ONLY: Owner-specific features - MUST BE VISIBLE */}
                        {isOwner && (
                            <>
                                <Route path="managers" element={<OwnerPanel />} />
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
