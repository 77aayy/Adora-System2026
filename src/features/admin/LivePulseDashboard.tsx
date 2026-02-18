/**
 * Live Pulse Dashboard ⏱️
 * Real-time view of all hotel operations for managers
 * Shows: Active cleaning timers, pending requests, coffee orders, etc.
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    Activity, Clock, AlertTriangle, CheckCircle2, Users,
    Coffee, Sparkles, Wrench, BellRing, Package,
    TrendingUp, TrendingDown, Minus, RefreshCw, Filter,
    ChevronDown, Eye, Bell, Zap, Timer
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useUX } from '../../context/UXContext';
import { useTranslation } from 'react-i18next';
import { subscribeToLivePulse } from '../../services/dashboardStatsService';
import { useLiveTimer, getElapsedMinutes, getElapsedWithColor } from '../../services/liveTimerService';
import { haptic, playSound } from '../../utils/uxEffects';
import { getSystemSettings } from '../../services/systemSettingsService';
import { logger } from '../../services/loggerService';
import { formatTimeGregorianEn } from '../../utils/dateUtils';
// ✅ Architecture: Use services instead of direct Firebase calls
// Note: subscribeToLivePulse is already in dashboardStatsService

// ============================================================
// TYPES
// ============================================================

interface PulseItem {
    id: string;
    type: 'cleaning' | 'maintenance' | 'bellman' | 'coffee' | 'reception' | 'other';
    roomNumber?: string;
    description: string;
    status: string;
    startTime: Date | any;
    assignedTo?: string;
    priority?: 'normal' | 'urgent';
    department: string;
    // Calculated
    elapsedMinutes?: number;
    isDelayed?: boolean;
}

// ✅ Points Config Type (from PointsConfiguration)
interface PointsConfig {
    bellman?: { delayTime?: number; fastTime?: number };
    housekeeping?: { delayTime?: number; fastTime?: number };
    maintenance?: { delayTime?: number; fastTime?: number };
    coffeeShop?: { delayTime?: number; fastTime?: number };
    procurement?: { targetTime?: number };
    reception?: { veryLateConfirmationTime?: number };
}

type FilterType = 'all' | 'delayed' | 'cleaning' | 'maintenance' | 'coffee' | 'bellman';

// ============================================================
// CONSTANTS (Default Fallbacks)
// ============================================================

// ✅ Default thresholds - Used if manager hasn't configured custom values
const DEFAULT_THRESHOLDS: Record<string, number> = {
    cleaning: 30,        // 30 min default (can be customized)
    maintenance: 60,     // 1 hour default
    bellman: 20,         // 20 min default
    coffee: 20,          // 20 min for coffee orders
    reception: 10,       // 10 min for reception requests
    other: 30            // 30 min default
};

// TYPE_CONFIG will be created with useMemo inside component

// ============================================================
// HELPER COMPONENTS
// ============================================================

// Live Timer Badge
const LiveTimerBadge: React.FC<{
    startTime: Date | any;
    threshold: number;
    size?: 'sm' | 'md' | 'lg';
}> = ({ startTime, threshold, size = 'md' }) => {
    const { duration, elapsedMinutes } = useLiveTimer(startTime);
    const isDelayed = elapsedMinutes > threshold;
    const isWarning = elapsedMinutes > threshold * 0.8;

    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-3 py-1',
        lg: 'text-base px-4 py-1.5 font-bold'
    };

    return (
        <div
            className={`rounded-full font-mono flex items-center gap-1.5 transition-all ${sizeClasses[size]} ${
                isDelayed
                    ? 'bg-red-500/30 text-red-300 animate-pulse'
                    : isWarning
                        ? 'bg-orange-500/30 text-orange-300'
                        : 'bg-white/10 text-white/70'
            }`}
        >
            <Timer className={`w-3.5 h-3.5 ${isDelayed ? 'animate-bounce' : ''}`} />
            <span>{duration}</span>
        </div>
    );
};

// Pulse Card
const PulseCard: React.FC<{
    item: PulseItem;
    thresholds: Record<string, number>;
    onClick?: () => void;
}> = ({ item, thresholds, onClick }) => {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.other;
    const Icon = config.icon;
    const threshold = thresholds[item.type] || thresholds.other || 30;
    const { elapsedMinutes } = useLiveTimer(item.startTime);
    const isDelayed = elapsedMinutes > threshold;

    return (
        <div
            onClick={onClick}
            className={`solid-modal rounded-xl p-4 transition-all cursor-pointer hover:scale-[1.02] ${
                isDelayed ? 'ring-2 ring-red-500/50 shadow-lg shadow-red-500/10' : ''
            }`}
            style={{
                background: 'var(--theme-bg-secondary)',
                border: `1px solid ${isDelayed ? 'rgba(239, 68, 68, 0.3)' : 'var(--theme-border-primary)'}`
            }}
        >
            <div className="flex items-start justify-between gap-3">
                {/* Icon & Info */}
                <div className="flex items-start gap-3 flex-1">
                    <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0 ${
                        isDelayed ? 'animate-pulse' : ''
                    }`}>
                        <Icon className={`w-6 h-6 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            {item.roomNumber && (
                                <span className="font-mono font-bold text-lg" style={{ color: 'var(--theme-text-primary)' }}>
                                    {item.roomNumber}
                                </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                                {config.label}
                            </span>
                            {item.priority === 'urgent' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                                    ⚡ عاجل
                                </span>
                            )}
                        </div>
                        <p className="text-sm mt-1 truncate" style={{ color: 'var(--theme-text-secondary)' }}>
                            {item.description}
                        </p>
                        {item.assignedTo && (
                            <p className="text-xs mt-1" style={{ color: 'var(--theme-text-tertiary)' }}>
                                👤 {item.assignedTo}
                            </p>
                        )}
                    </div>
                </div>

                {/* Timer */}
                <div className="flex flex-col items-end gap-2">
                    <LiveTimerBadge
                        startTime={item.startTime}
                        threshold={threshold}
                        size={isDelayed ? 'lg' : 'md'}
                    />
                    {isDelayed && (
                        <span className="text-[10px] text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            متأخر!
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

// Stats Summary Card
const StatsSummary: React.FC<{
    total: number;
    delayed: number;
    byType: Record<string, number>;
}> = ({ total, delayed, byType }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
            {/* Total Active */}
            <div className="solid-modal rounded-xl p-4" style={{ background: 'var(--theme-bg-secondary)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>{total}</p>
                        <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>نشط الآن</p>
                    </div>
                </div>
            </div>

            {/* Delayed */}
            <div className={`solid-modal rounded-xl p-4 ${delayed > 0 ? 'ring-2 ring-red-500/30' : ''}`}
                style={{ background: delayed > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--theme-bg-secondary)' }}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${delayed > 0 ? 'bg-red-500/30 animate-pulse' : 'bg-red-500/20'} flex items-center justify-center`}>
                        <AlertTriangle className={`w-5 h-5 ${delayed > 0 ? 'text-red-400' : 'text-red-300'}`} />
                    </div>
                    <div>
                        <p className={`text-2xl font-bold ${delayed > 0 ? 'text-red-400' : ''}`}
                            style={{ color: delayed > 0 ? undefined : 'var(--theme-text-primary)' }}>
                            {delayed}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>متأخر</p>
                    </div>
                </div>
            </div>

            {/* By Type */}
            {Object.entries(byType).map(([type, count]) => {
                const config = TYPE_CONFIG[type] || TYPE_CONFIG.other;
                const Icon = config.icon;
                return (
                    <div key={type} className="solid-modal rounded-xl p-4" style={{ background: 'var(--theme-bg-secondary)' }}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center`}>
                                <Icon className={`w-5 h-5 ${config.color}`} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>{count}</p>
                                <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>{config.label}</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const LivePulseDashboard: React.FC = () => {
    const { user, branchId } = useAuth();
    const { tenantId } = useTenant();
    const { haptic: triggerHaptic } = useUX();
    const { t } = useTranslation();

    const [pulseItems, setPulseItems] = useState<PulseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);
    
    // ✅ Dynamic thresholds from manager's Points Configuration
    const [delayThresholds, setDelayThresholds] = useState<Record<string, number>>(DEFAULT_THRESHOLDS);
    
    // ✅ Load manager's custom timing settings
    useEffect(() => {
        const loadPointsConfig = async () => {
            if (!tenantId || !branchId) return;
            
            // ✅ Null Safety: Check db before operations
            if (!db) {
                logger.error('Cannot load points config', new Error('Database not initialized'), 'LivePulseDashboard');
                return;
            }

            try {
                // Try branch-specific settings first
                const branchPointsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'points');
                let pointsSnap = await getDoc(branchPointsRef);
                
                // Fallback to tenant-level settings
                if (!pointsSnap.exists()) {
                    const tenantPointsRef = doc(db, `tenants/${tenantId}/settings`, 'points');
                    pointsSnap = await getDoc(tenantPointsRef);
                }
                
                if (pointsSnap.exists()) {
                    const config = pointsSnap.data() as PointsConfig;
                    
                    // ✅ Build dynamic thresholds from manager's config
                    const customThresholds: Record<string, number> = {
                        cleaning: config.housekeeping?.delayTime || DEFAULT_THRESHOLDS.cleaning,
                        maintenance: config.maintenance?.delayTime || DEFAULT_THRESHOLDS.maintenance,
                        bellman: config.bellman?.delayTime || DEFAULT_THRESHOLDS.bellman,
                        coffee: config.coffeeShop?.delayTime || DEFAULT_THRESHOLDS.coffee,
                        reception: config.reception?.veryLateConfirmationTime || DEFAULT_THRESHOLDS.reception,
                        other: DEFAULT_THRESHOLDS.other
                    };
                    
                    setDelayThresholds(customThresholds);
                    logger.info('Loaded custom delay thresholds from manager settings', customThresholds, 'LivePulseDashboard');
                }
            } catch (error: any) {
                logger.warn('Could not load points config, using defaults', error, 'LivePulseDashboard');
            }
        };
        
        loadPointsConfig();
    }, [tenantId, branchId]);

    // Real-time subscription to all active requests
    useEffect(() => {
        if (!tenantId || !branchId) return;

        const items: PulseItem[] = [];
        // ✅ Null Safety: Check db before operations
        if (!db) {
            logger.error('Cannot subscribe to live pulse', new Error('Database not initialized'), 'LivePulseDashboard');
            return;
        }

        const unsubscribes: (() => void)[] = [];

        // ✅ FIX: Use tenant-scoped collection
        // Subscribe to cleaning requests (Housekeeping)
        const cleaningQuery = query(
            collection(db, `tenants/${tenantId}/requests`),
            where('branch', '==', branchId),
            where('type', '==', 'cleaning'),
            where('status', 'in', ['CONFIRMED', 'IN_PROGRESS'])
        );

        const cleaningUnsub = onSnapshot(cleaningQuery, (snapshot) => {
            const cleaningItems: PulseItem[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    type: 'cleaning',
                    roomNumber: data.roomNumber,
                    description: data.cleaningType === 'checkout' ? 'تنظيف خروج' : 'تنظيف يومي',
                    status: data.status,
                    startTime: data.timeline?.started || data.timeline?.confirmed || data.createdAt,
                    assignedTo: data.assignedTo?.name,
                    priority: data.priority,
                    department: 'housekeeping'
                };
            });

            setPulseItems(prev => {
                const filtered = prev.filter(i => i.type !== 'cleaning');
                return [...filtered, ...cleaningItems];
            });
        });
        unsubscribes.push(cleaningUnsub);

        // ✅ FIX: Use tenant-scoped collection
        // Subscribe to maintenance requests
        const maintenanceQuery = query(
            collection(db, `tenants/${tenantId}/requests`),
            where('branch', '==', branchId),
            where('type', '==', 'maintenance'),
            where('status', 'in', ['CONFIRMED', 'IN_PROGRESS'])
        );

        const maintenanceUnsub = onSnapshot(maintenanceQuery, (snapshot) => {
            const maintenanceItems: PulseItem[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    type: 'maintenance',
                    roomNumber: data.roomNumber,
                    description: data.maintenanceType || data.description || 'طلب صيانة',
                    status: data.status,
                    startTime: data.timeline?.started || data.timeline?.confirmed || data.createdAt,
                    assignedTo: data.assignedTo?.name,
                    priority: data.priority,
                    department: 'maintenance'
                };
            });

            setPulseItems(prev => {
                const filtered = prev.filter(i => i.type !== 'maintenance');
                return [...filtered, ...maintenanceItems];
            });
        });
        unsubscribes.push(maintenanceUnsub);

        // ✅ FIX: Use tenant-scoped collection
        // Subscribe to bellman requests
        const bellmanQuery = query(
            collection(db, `tenants/${tenantId}/requests`),
            where('branch', '==', branchId),
            where('type', '==', 'bellman'),
            where('status', 'in', ['CONFIRMED', 'IN_PROGRESS'])
        );

        const bellmanUnsub = onSnapshot(bellmanQuery, (snapshot) => {
            const bellmanItems: PulseItem[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    type: 'bellman',
                    roomNumber: data.roomNumber,
                    description: data.requestType || 'طلب بيلمان',
                    status: data.status,
                    startTime: data.createdAt,
                    assignedTo: data.assignedTo?.name,
                    priority: data.priority,
                    department: 'bellman'
                };
            });

            setPulseItems(prev => {
                const filtered = prev.filter(i => i.type !== 'bellman');
                return [...filtered, ...bellmanItems];
            });
        });
        unsubscribes.push(bellmanUnsub);

        // Subscribe to coffee shop orders
        const coffeeQuery = query(
            collection(db, `tenants/${tenantId}/coffeeShopOrders`),
            where('branchId', '==', branchId),
            where('status', 'in', ['pending', 'in_progress'])
        );

        const coffeeUnsub = onSnapshot(coffeeQuery, (snapshot) => {
            const coffeeItems: PulseItem[] = snapshot.docs.map(doc => {
                const data = doc.data();
                const itemCount = data.items?.length || 0;
                return {
                    id: doc.id,
                    type: 'coffee',
                    roomNumber: data.roomNumber,
                    description: `${itemCount} ${t('common.product') || 'صنف'} - ${data.status === 'pending' ? (t('common.pending') || 'بانتظار') : (t('coffeeshop.preparing') || 'قيد التحضير')}`,
                    status: data.status,
                    startTime: data.createdAt,
                    assignedTo: data.preparedBy?.name,
                    priority: data.isUrgent ? 'urgent' : 'normal',
                    department: 'coffee_shop'
                };
            });

            setPulseItems(prev => {
                const filtered = prev.filter(i => i.type !== 'coffee');
                return [...filtered, ...coffeeItems];
            });
        });
        unsubscribes.push(coffeeUnsub);

        // ✅ FIX: Use tenant-scoped collection
        // Subscribe to reception requests
        const receptionQuery = query(
            collection(db, `tenants/${tenantId}/requests`),
            where('branch', '==', branchId),
            where('status', '==', 'PENDING_RECEPTION')
        );

        const receptionUnsub = onSnapshot(receptionQuery, (snapshot) => {
            const receptionItems: PulseItem[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    type: 'reception',
                    roomNumber: data.roomNumber,
                    description: data.type || 'طلب جديد',
                    status: data.status,
                    startTime: data.createdAt,
                    priority: data.priority,
                    department: 'reception'
                };
            });

            setPulseItems(prev => {
                const filtered = prev.filter(i => i.type !== 'reception');
                return [...filtered, ...receptionItems];
            });
        });
        unsubscribes.push(receptionUnsub);

        setLoading(false);

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [tenantId, branchId]);

    // Calculate stats (using dynamic thresholds)
    const stats = useMemo(() => {
        const now = new Date();
        let delayed = 0;
        const byType: Record<string, number> = {};

        pulseItems.forEach(item => {
            // Count by type
            byType[item.type] = (byType[item.type] || 0) + 1;

            // Check if delayed (using manager's custom thresholds)
            const startTime = item.startTime instanceof Date
                ? item.startTime
                : item.startTime?.toDate?.() || new Date(item.startTime);
            const elapsed = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
            const threshold = delayThresholds[item.type] || delayThresholds.other || 30;
            if (elapsed > threshold) {
                delayed++;
            }
        });

        return { total: pulseItems.length, delayed, byType };
    }, [pulseItems, delayThresholds]);

    // Filter items (using dynamic thresholds)
    const filteredItems = useMemo(() => {
        const now = new Date();

        let items = [...pulseItems];

        // Apply type filter
        if (filter !== 'all' && filter !== 'delayed') {
            items = items.filter(i => i.type === filter);
        }

        // Apply delayed filter (using manager's custom thresholds)
        if (filter === 'delayed') {
            items = items.filter(item => {
                const startTime = item.startTime instanceof Date
                    ? item.startTime
                    : item.startTime?.toDate?.() || new Date(item.startTime);
                const elapsed = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
                const threshold = delayThresholds[item.type] || delayThresholds.other || 30;
                return elapsed > threshold;
            });
        }

        // Sort by elapsed time (most delayed first)
        items.sort((a, b) => {
            const aStart = a.startTime instanceof Date ? a.startTime : a.startTime?.toDate?.() || new Date(a.startTime);
            const bStart = b.startTime instanceof Date ? b.startTime : b.startTime?.toDate?.() || new Date(b.startTime);
            return aStart.getTime() - bStart.getTime();
        });

        return items;
    }, [pulseItems, filter, delayThresholds]);

    // Play alert sound when new delayed item appears
    useEffect(() => {
        if (stats.delayed > 0) {
            // Check for new delays
            const interval = setInterval(() => {
                if (stats.delayed > 0) {
                    triggerHaptic('warning');
                }
            }, 60000); // Check every minute

            return () => clearInterval(interval);
        }
    }, [stats.delayed, triggerHaptic]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--theme-text-primary)' }}>
                        <Activity className="w-7 h-7 text-teal-400" />
                        النبض اللحظي
                        {stats.delayed > 0 && (
                            <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-bold animate-pulse">
                                {stats.delayed} متأخر
                            </span>
                        )}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--theme-text-tertiary)' }}>
                        مراقبة جميع العمليات النشطة في الفندق لحظة بلحظة
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Auto Refresh Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="sr-only"
                        />
                        <div className={`w-10 h-6 rounded-full transition-colors ${autoRefresh ? 'bg-teal-500' : 'bg-white/20'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform mt-1 ${autoRefresh ? 'translate-x-5' : 'translate-x-1'}`} />
                        </div>
                        <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>تحديث تلقائي</span>
                    </label>

                    {/* Last Refresh */}
                    <span className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                        آخر تحديث: {formatTimeGregorianEn(lastRefresh)}
                    </span>
                </div>
            </div>

            {/* Stats Summary */}
            <StatsSummary total={stats.total} delayed={stats.delayed} byType={stats.byType} />

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                {[
                    { id: 'all', label: t('common.all') || 'الكل', count: pulseItems.length },
                    { id: 'delayed', label: `⚠️ ${t('common.delayed') || 'متأخر'}`, count: stats.delayed },
                    { id: 'cleaning', label: `🧹 ${t('departments.housekeeping') || 'تنظيف'}`, count: stats.byType.cleaning || 0 },
                    { id: 'maintenance', label: `🔧 ${t('departments.maintenance') || 'صيانة'}`, count: stats.byType.maintenance || 0 },
                    { id: 'coffee', label: `☕ ${t('departments.coffeeshop') || 'كوفي'}`, count: stats.byType.coffee || 0 },
                    { id: 'bellman', label: `🛎️ ${t('departments.bellman') || 'بيلمان'}`, count: stats.byType.bellman || 0 },
                ].map(f => (
                    <button
                        key={f.id}
                        onClick={() => {
                            setFilter(f.id as FilterType);
                            triggerHaptic('light');
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                            filter === f.id
                                ? f.id === 'delayed'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-teal-500 text-white'
                                : 'hover:bg-white/10'
                        }`}
                        style={{
                            background: filter === f.id ? undefined : 'var(--theme-bg-secondary)',
                            color: filter === f.id ? undefined : 'var(--theme-text-secondary)',
                            border: `1px solid ${filter === f.id ? 'transparent' : 'var(--theme-border-primary)'}`
                        }}
                    >
                        {f.label}
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                            filter === f.id ? 'bg-white/20' : 'bg-white/10'
                        }`}>
                            {f.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Pulse Items Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="solid-modal rounded-2xl p-12 text-center" style={{ background: 'var(--theme-bg-secondary)' }}>
                    <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" />
                    <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                        {filter === 'all' ? 'لا توجد عمليات نشطة' : 'لا توجد عمليات في هذا التصنيف'}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--theme-text-tertiary)' }}>
                        جميع العمليات مكتملة 👍
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {filteredItems.map(item => (
                        <PulseCard key={item.id} item={item} thresholds={delayThresholds} />
                    ))}
                </div>
            )}

            {/* Legend - Shows dynamic thresholds from manager settings */}
            <div className="solid-modal rounded-xl p-4" style={{ background: 'var(--theme-bg-secondary)' }}>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium" style={{ color: 'var(--theme-text-tertiary)' }}>
                        ⏱️ حدود التأخير (قابلة للتعديل من إعدادات النقاط):
                    </p>
                    <a 
                        href="/admin/points-config" 
                        className="text-xs text-teal-400 hover:text-teal-300 hover:underline"
                    >
                        ⚙️ تعديل الحدود
                    </a>
                </div>
                <div className="flex flex-wrap gap-4">
                    {Object.entries(delayThresholds).filter(([type]) => type !== 'other').map(([type, minutes]) => {
                        const config = TYPE_CONFIG[type] || TYPE_CONFIG.other;
                        return (
                            <div key={type} className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${config.bg}`} />
                                <span className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                                    {config.label}: {minutes} دقيقة
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default LivePulseDashboard;
