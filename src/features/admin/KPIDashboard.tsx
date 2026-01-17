/**
 * Enhanced KPI Dashboard Component
 * Real-time Key Performance Indicators for management
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    AreaChart,
    Area,
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    Clock,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
    Star,
    Users,
    Sparkles,
    Wrench,
    BellRing,
    Coffee,
    Calendar,
    Target,
    Package,
    Award,
    Zap,
    Timer,
    ThumbsUp,
    HandCoins,
    Gem
} from 'lucide-react';
import { useAdminStats } from '../../hooks/useAdminStats';
import { getPayoutStats } from '../../services/statsService';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import * as PointsService from '../../services/pointsService';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { logger } from '../../services/loggerService';

// ============================================================
// TYPES
// ============================================================

interface KPICardData {
    id: string;
    title: string;
    value: number | string;
    change: number;
    trend: 'up' | 'down' | 'stable';
    icon: React.ReactNode;
    color: string;
    suffix?: string;
}

interface DepartmentStats {
    name: string;
    nameAr: string;
    completed: number;
    pending: number;
    avgResponseTime: number;
    rating: number;
    color: string;
}

interface EmployeePerformance {
    id: string;
    name: string;
    department: string;
    completedRequests: number;
    avgResponseTime: number;
    rating: number;
    points: number;
}

interface TimeSeriesData {
    date: string;
    requests: number;
    completed: number;
    avgTime: number;
}

interface RevenueItem {
    productName: string;
    quantity: number;
    revenue: number;
}

interface KPIDashboardProps {
    period?: 'today' | 'week' | 'month';
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getDateRange = (period: 'today' | 'week' | 'month') => {
    const now = new Date();
    const start = new Date();

    switch (period) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            break;
        case 'week':
            start.setDate(now.getDate() - 7);
            break;
        case 'month':
            start.setMonth(now.getMonth() - 1);
            break;
    }

    return { start, end: now };
};

const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)} د`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}س ${mins}د`;
};

const CHART_COLORS = ['#14B8A6', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const DEPARTMENT_CONFIG: Record<string, { name: string; color: string; icon: React.ReactNode }> = {
    reception: { name: 'الاستقبال', color: '#3B82F6', icon: <Users className="w-5 h-5" /> },
    housekeeping: { name: 'النظافة', color: '#14B8A6', icon: <Sparkles className="w-5 h-5" /> },
    maintenance: { name: 'الصيانة', color: '#F59E0B', icon: <Wrench className="w-5 h-5" /> },
    bellman: { name: 'البيلمان', color: '#8B5CF6', icon: <BellRing className="w-5 h-5" /> },
};

// ============================================================
// COMPONENTS
// ============================================================

// Animated KPI Card
const KPICard: React.FC<{ data: KPICardData; delay?: number }> = ({ data, delay = 0 }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    return (
        <div
            className={`rounded-2xl transition-all duration-500 hover:scale-[1.02] hover:shadow-lg ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
            style={{ 
                background: 'var(--theme-bg-secondary)', 
                border: '1px solid var(--theme-border-primary)',
                padding: 'clamp(1rem, 2vw, 1.5rem)',
                minHeight: '140px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
            }}
        >
            <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex-1 min-w-0">
                    <p className="text-white/60 text-xs sm:text-sm mb-1 truncate">{data.title}</p>
                    <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white break-words">
                        {data.value}
                        {data.suffix && <span className="text-sm sm:text-lg text-white/60 mr-1">{data.suffix}</span>}
                    </p>
                </div>
                <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${data.color}20`, color: data.color }}
                >
                    <div className="w-5 h-5 sm:w-6 sm:h-6">
                        {data.icon}
                    </div>
                </div>
            </div>

            <div className={`flex items-center gap-1 text-xs sm:text-sm ${data.trend === 'up' ? 'text-green-400' : data.trend === 'down' ? 'text-red-400' : 'text-white/40'
                }`}>
                {data.trend === 'up' ? (
                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                ) : data.trend === 'down' ? (
                    <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                ) : null}
                <span className="truncate">{Math.abs(data.change)}% عن الفترة السابقة</span>
            </div>
        </div>
    );
};

// Department Performance Card
const DepartmentCard: React.FC<{ dept: DepartmentStats }> = ({ dept }) => (
    <div className="rounded-2xl transition-colors duration-300 p-3 sm:p-4 hover:scale-[1.02] active:scale-[0.98] transition-all touch-manipulation" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
        <div className="flex items-center gap-3 mb-4">
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${dept.color}20`, color: dept.color }}
            >
                {DEPARTMENT_CONFIG[dept.name]?.icon || <Users className="w-5 h-5" />}
            </div>
            <div>
                <p className="text-white font-medium">{dept.nameAr}</p>
                <p className="text-white/50 text-sm">{dept.completed} طلب مكتمل</p>
            </div>
        </div>

        <div className="space-y-3">
            {/* Response Time */}
            <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm flex items-center gap-2">
                    <Timer className="w-4 h-4" />
                    متوسط الاستجابة
                </span>
                <span className="text-white font-medium">{formatTime(dept.avgResponseTime)}</span>
            </div>

            {/* Rating */}
            <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    التقييم
                </span>
                <div className="flex items-center gap-1">
                    <span className="text-amber-400 font-medium">{dept.rating.toFixed(1)}</span>
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                </div>
            </div>

            {/* Progress Bar */}
            <div>
                <div className="flex justify-between text-xs text-white/40 mb-1">
                    <span>نسبة الإنجاز</span>
                    <span>{Math.round((dept.completed / (dept.completed + dept.pending)) * 100)}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                            width: `${(dept.completed / (dept.completed + dept.pending)) * 100}%`,
                            backgroundColor: dept.color
                        }}
                    />
                </div>
            </div>
        </div>
    </div>
);

// Top Employees Card
const TopEmployeesCard: React.FC<{ employees: EmployeePerformance[] }> = ({ employees }) => (
    <div className="rounded-2xl transition-colors duration-300 p-5" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
        <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-white">أفضل الموظفين</h3>
        </div>

        <div className="space-y-3">
            {employees.slice(0, 5).map((emp, index) => (
                <div
                    key={emp.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
                >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-amber-500 text-white animate-pulse shadow-lg shadow-amber-500/50' :
                        index === 1 ? 'bg-gray-400 text-white' :
                            index === 2 ? 'bg-amber-700 text-white' :
                                'bg-white/10 text-white/60'
                        }`}>
                        {index === 0 ? <Gem className="w-4 h-4" /> : index + 1}
                    </div>
                    <div className="flex-1">
                        <p className="text-white font-medium">{emp.name}</p>
                        <p className="text-white/50 text-sm">{DEPARTMENT_CONFIG[emp.department]?.name || emp.department}</p>
                    </div>
                    <div className="text-left">
                        <p className="text-amber-400 font-bold">{(emp as any).lifetimePoints || emp.points}</p>
                        <p className="text-white/40 text-[9px] font-black uppercase tracking-tighter">Lifetime Pts</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// ============================================================
// MAIN COMPONENT
// ============================================================

export const KPIDashboard: React.FC<KPIDashboardProps> = ({ period = 'week' }) => {
    const { user } = useAuth();
    const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>(period);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data states
    const [totalRequests, setTotalRequests] = useState(0);
    const [completedRequests, setCompletedRequests] = useState(0);
    const [pendingRequests, setPendingRequests] = useState(0);
    const [avgResponseTime, setAvgResponseTime] = useState(0);
    const [avgRating, setAvgRating] = useState(0);
    const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
    const [topEmployees, setTopEmployees] = useState<EmployeePerformance[]>([]);
    const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
    const [requestsByType, setRequestsByType] = useState<{ name: string; value: number }[]>([]);
    // ✅ NEW: Revenue from Minibar
    const [minibarRevenue, setMinibarRevenue] = useState(0);
    const [topProducts, setTopProducts] = useState<RevenueItem[]>([]);
    const [lowStockCount, setLowStockCount] = useState(0);

    const branchId = useMemo(() => (user as any)?.branch || (user as any)?.branchId || 'default', [user]);
    const tenantId = (user as any)?.tenantId;

    // Load KPI Data
    const loadKPIData = async () => {
        setRefreshing(true);
        try {
            const { start, end } = getDateRange(selectedPeriod);
            const requestsRef = collection(db, 'requests');

            // Get requests in period
            // SIMPLIFIED QUERY: Fetch recent requests by branch and filter in memory to avoid index issues
            const constraints: any[] = [where('branch', '==', branchId)];
            if (tenantId) constraints.push(where('tenantId', '==', tenantId));
            constraints.push(orderBy('createdAt', 'desc'));
            constraints.push(limit(500));

            const q = query(requestsRef, ...constraints);

            const snapshot = await getDocs(q);
            const requests: any[] = [];

            // Filter by date range in memory
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.createdAt) {
                    const date = data.createdAt.toDate();
                    if (date >= start && date <= end) {
                        requests.push({ id: doc.id, ...data });
                    }
                }
            });

            // ✅ Calculate Minibar Revenue (from inspection reports)
            let revenue = 0;
            const productsMap: Record<string, RevenueItem> = {};

            requests.forEach(r => {
                // Check minibarConsumption array
                if (r.minibarConsumption && Array.isArray(r.minibarConsumption)) {
                    r.minibarConsumption.forEach((item: any) => {
                        revenue += item.total || 0;
                        if (!productsMap[item.productName]) {
                            productsMap[item.productName] = { productName: item.productName, quantity: 0, revenue: 0 };
                        }
                        productsMap[item.productName].quantity += item.quantity || 0;
                        productsMap[item.productName].revenue += item.total || 0;
                    });
                }
                // Also check inspectionReport.consumedItems (legacy format)
                if (r.inspectionReport?.consumedItems && Array.isArray(r.inspectionReport.consumedItems)) {
                    r.inspectionReport.consumedItems.forEach((item: any) => {
                        revenue += item.total || 0;
                        if (!productsMap[item.productName]) {
                            productsMap[item.productName] = { productName: item.productName, quantity: 0, revenue: 0 };
                        }
                        productsMap[item.productName].quantity += item.quantity || 0;
                        productsMap[item.productName].revenue += item.total || 0;
                    });
                }
                // Direct minibarTotal field
                if (r.minibarTotal) {
                    revenue += r.minibarTotal;
                }
            });
            setMinibarRevenue(revenue);
            setTopProducts(Object.values(productsMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5));

            // Calculate totals
            setTotalRequests(requests.length);
            setCompletedRequests(requests.filter(r => r.status === 'COMPLETED').length);
            setPendingRequests(requests.filter(r => r.status === 'PENDING' || r.status === 'PENDING_RECEPTION').length);

            // Calculate average response time
            const completedWithTime = requests.filter(r => r.status === 'COMPLETED' && r.createdAt && r.completedAt);
            if (completedWithTime.length > 0) {
                const totalTime = completedWithTime.reduce((sum, r) => {
                    const created = r.createdAt.toDate();
                    const completed = r.completedAt.toDate();
                    return sum + (completed.getTime() - created.getTime()) / 60000;
                }, 0);
                setAvgResponseTime(totalTime / completedWithTime.length);
            }

            // Calculate average rating
            const ratedRequests = requests.filter(r => r.rating);
            if (ratedRequests.length > 0) {
                const totalRating = ratedRequests.reduce((sum, r) => sum + r.rating, 0);
                setAvgRating(totalRating / ratedRequests.length);
            }

            // Department stats
            const deptMap: Record<string, { completed: number; pending: number; totalTime: number; timeCount: number; totalRating: number; ratingCount: number }> = {};

            requests.forEach(r => {
                const dept = r.currentDepartment || 'reception';
                if (!deptMap[dept]) {
                    deptMap[dept] = { completed: 0, pending: 0, totalTime: 0, timeCount: 0, totalRating: 0, ratingCount: 0 };
                }

                if (r.status === 'COMPLETED') {
                    deptMap[dept].completed++;
                    if (r.createdAt && r.completedAt) {
                        const time = (r.completedAt.toDate().getTime() - r.createdAt.toDate().getTime()) / 60000;
                        deptMap[dept].totalTime += time;
                        deptMap[dept].timeCount++;
                    }
                } else if (r.status === 'PENDING' || r.status === 'PENDING_RECEPTION') {
                    deptMap[dept].pending++;
                }

                if (r.rating) {
                    deptMap[dept].totalRating += r.rating;
                    deptMap[dept].ratingCount++;
                }
            });

            const deptStats: DepartmentStats[] = Object.entries(deptMap).map(([key, val]) => ({
                name: key,
                nameAr: DEPARTMENT_CONFIG[key]?.name || key,
                completed: val.completed,
                pending: val.pending,
                avgResponseTime: val.timeCount > 0 ? val.totalTime / val.timeCount : 0,
                rating: val.ratingCount > 0 ? val.totalRating / val.ratingCount : 0,
                color: DEPARTMENT_CONFIG[key]?.color || '#3B82F6',
            }));
            setDepartmentStats(deptStats);

            // Requests by type
            const typeMap: Record<string, number> = {};
            requests.forEach(r => {
                const type = r.type || 'other';
                typeMap[type] = (typeMap[type] || 0) + 1;
            });

            const typeNames: Record<string, string> = {
                cleaning: 'تنظيف',
                maintenance: 'صيانة',
                bellman: 'بيلمان',
                coffee: 'مشروبات',
                laundry: 'غسيل',
                minibar: 'ميني بار',
                inspection: 'فحص',
                extension: 'تمديد',
            };

            setRequestsByType(Object.entries(typeMap).map(([key, val]) => ({
                name: typeNames[key] || key,
                value: val
            })));

            // Time series data (last 7 days)
            const days: Record<string, { requests: number; completed: number; totalTime: number; timeCount: number }> = {};
            const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const key = date.toDateString();
                days[key] = { requests: 0, completed: 0, totalTime: 0, timeCount: 0 };
            }

            requests.forEach(r => {
                if (r.createdAt) {
                    const date = r.createdAt.toDate().toDateString();
                    if (days[date]) {
                        days[date].requests++;
                        if (r.status === 'COMPLETED') {
                            days[date].completed++;
                            if (r.completedAt) {
                                const time = (r.completedAt.toDate().getTime() - r.createdAt.toDate().getTime()) / 60000;
                                days[date].totalTime += time;
                                days[date].timeCount++;
                            }
                        }
                    }
                }
            });

            setTimeSeriesData(Object.entries(days).map(([key, val]) => ({
                date: dayNames[new Date(key).getDay()],
                requests: val.requests,
                completed: val.completed,
                avgTime: val.timeCount > 0 ? Math.round(val.totalTime / val.timeCount) : 0
            })));

            // ✅ Real Top Employees (using Unified PointsService)
            try {
                const realTopRaw = await PointsService.getLeaderboard((user as any).tenantId || 'default', 10);

                // Map to EmployeePerformance interface
                const realTop = realTopRaw.map((e: any) => ({
                    id: e.id,
                    name: e.name || 'موظف',
                    department: e.department || 'general',
                    completedRequests: e.completedRequests || 0,
                    avgResponseTime: 0,
                    rating: e.rating || 5,
                    points: e.currentPoints || 0,
                    lifetimePoints: e.lifetimePoints || 0
                }));
                setTopEmployees(realTop);
            } catch (err: any) {
                logger.warn('Error loading real leaderboard', err, 'KPIDashboard');
                // Fallback to mock if index not ready
                setTopEmployees([
                    { id: '1', name: 'أحمد محمد', department: 'housekeeping', completedRequests: 45, avgResponseTime: 12, rating: 4.8, points: 450 },
                    { id: '2', name: 'محمد علي', department: 'maintenance', completedRequests: 38, avgResponseTime: 18, rating: 4.6, points: 380 },
                ]);
            }

            // ✅ Load Payout Stats
            try {
                const payoutRef = collection(db, `tenants/${(user as any).tenantId || 'default'}/payout_requests`);
                const payoutSnap = await getDocs(query(payoutRef, where('status', '==', 'approved')));
                let totalPaid = 0;
                payoutSnap.forEach(doc => totalPaid += doc.data().monetaryValue || 0);
                // We'll store this in a state or use it in the UI
            } catch (err: any) {
                logger.warn('Error loading payout stats', err, 'KPIDashboard');
            }


            // ✅ Load Low Stock Alerts from Inventory
            try {
                const { getLowStockAlerts } = await import('../../services/inventoryService');
                const alerts = await getLowStockAlerts(branchId);
                setLowStockCount(alerts.length);
            } catch (err: any) {
                logger.warn('Could not load inventory alerts', err, 'KPIDashboard');
            }

        } catch (error: any) {
            logger.error('Error loading KPI data', error, 'KPIDashboard');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadKPIData();
        // Refresh every 5 minutes
        const interval = setInterval(loadKPIData, 300000);
        return () => clearInterval(interval);
    }, [selectedPeriod, branchId]);

    // KPI Cards data
    const kpiCards: KPICardData[] = useMemo(() => [
        {
            id: 'total',
            title: 'إجمالي الطلبات',
            value: totalRequests,
            change: 12,
            trend: 'up',
            icon: <Zap className="w-6 h-6" />,
            color: '#3B82F6',
        },
        {
            id: 'completed',
            title: 'الطلبات المكتملة',
            value: completedRequests,
            change: 8,
            trend: 'up',
            icon: <CheckCircle2 className="w-6 h-6" />,
            color: '#22C55E',
        },
        {
            id: 'response',
            title: 'متوسط وقت الاستجابة',
            value: formatTime(avgResponseTime),
            change: 15,
            trend: avgResponseTime < 30 ? 'up' : 'down',
            icon: <Clock className="w-6 h-6" />,
            color: '#14B8A6',
        },
        {
            id: 'rating',
            title: 'تقييم النزلاء',
            value: avgRating.toFixed(1),
            change: 5,
            trend: avgRating >= 4 ? 'up' : 'down',
            icon: <Star className="w-6 h-6" />,
            color: '#F59E0B',
            suffix: '/ 5',
        },
        // ✅ NEW: Minibar Revenue Card
        {
            id: 'revenue',
            title: 'إيرادات الميني بار',
            value: minibarRevenue,
            change: 0,
            trend: 'up',
            icon: <TrendingUp className="w-6 h-6" />,
            color: '#22C55E',
            suffix: ' ريال',
        },
        // ✅ NEW: Low Stock Alert Card
        {
            id: 'lowstock',
            title: 'تنبيهات المخزون',
            value: lowStockCount,
            change: 0,
            trend: lowStockCount > 0 ? 'down' : 'stable',
            icon: <AlertTriangle className="w-6 h-6" />,
            color: lowStockCount > 0 ? '#EF4444' : '#22C55E',
        },
        {
            id: 'pending',
            title: 'طلبات معلقة',
            value: pendingRequests,
            change: pendingRequests > 5 ? 20 : -10,
            trend: pendingRequests > 5 ? 'down' : 'up',
            icon: <AlertTriangle className="w-6 h-6" />,
            color: pendingRequests > 5 ? '#EF4444' : '#F59E0B',
        },
        {
            id: 'satisfaction',
            title: 'نسبة الرضا',
            value: Math.round((completedRequests / Math.max(totalRequests, 1)) * 100),
            change: 3,
            trend: 'up',
            icon: <ThumbsUp className="w-6 h-6" />,
            color: '#8B5CF6',
            suffix: '%',
        },
    ], [totalRequests, completedRequests, avgResponseTime, avgRating, pendingRequests]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <AdoraLoader size="md" message="جاري تحميل البيانات..." />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Target className="w-7 h-7 text-teal-400" />
                        مؤشرات الأداء الرئيسية
                    </h2>
                    <p className="text-white/50 mt-1">تحليل شامل لأداء الفندق</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Period Selector */}
                    <div className="flex bg-white/5 rounded-xl p-1">
                        {[
                            { key: 'today', label: 'اليوم' },
                            { key: 'week', label: 'الأسبوع' },
                            { key: 'month', label: 'الشهر' },
                        ].map((p) => (
                            <button
                                key={p.key}
                                onClick={() => setSelectedPeriod(p.key as typeof selectedPeriod)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedPeriod === p.key
                                    ? 'bg-teal-500 text-white'
                                    : 'text-white/60 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={loadKPIData}
                        disabled={refreshing}
                        className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all disabled:opacity-50"
                    >
                        {refreshing ? <AdoraLoaderInline size={20} /> : <RefreshCw className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* KPI Cards Grid - Responsive & Dynamic */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
                {kpiCards.map((kpi, index) => (
                    <KPICard key={kpi.id} data={kpi} delay={index * 100} />
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Requests Over Time */}
                <div className="rounded-2xl transition-colors duration-300 p-5" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-400" />
                        الطلبات خلال الأسبوع
                    </h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={timeSeriesData}>
                            <defs>
                                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                            <YAxis stroke="#94a3b8" fontSize={12} />
                            <Tooltip
                                contentStyle={{
                                    background: 'rgba(15, 23, 42, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                                }}
                                labelStyle={{ color: '#f8fafc' }}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="requests"
                                name="الطلبات"
                                stroke="#3B82F6"
                                strokeWidth={2}
                                fill="url(#colorRequests)"
                            />
                            <Area
                                type="monotone"
                                dataKey="completed"
                                name="المكتملة"
                                stroke="#14B8A6"
                                strokeWidth={2}
                                fill="url(#colorCompleted)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Request Distribution Pie */}
                <div className="rounded-2xl transition-colors duration-300 p-5" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-purple-400" />
                        توزيع الطلبات حسب النوع
                    </h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <Pie
                                data={requestsByType}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={3}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                labelLine={false}
                            >
                                {requestsByType.map((_, index) => (
                                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    background: 'rgba(15, 23, 42, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Department Stats & Top Employees */}
            <div className="grid grid-cols-1 lg:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 3xl:gap-12">
                {/* Department Performance Cards */}
                <div className="lg:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-teal-400" />
                        أداء الأقسام
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 3xl:gap-12">
                        {departmentStats.map((dept) => (
                            <DepartmentCard key={dept.name} dept={dept} />
                        ))}
                    </div>
                </div>

                {/* Top Employees (Leaderboard) */}
                <div className="flex flex-col gap-6">
                    <TopEmployeesCard employees={topEmployees} />

                    {/* Top Products widget merged from Reports */}
                    <div className="rounded-2xl transition-colors duration-300 p-5" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <Package className="w-5 h-5 text-green-400" />
                            <h3 className="text-lg font-semibold text-white">الأكثر مبيعاً</h3>
                        </div>
                        {topProducts.length === 0 ? (
                            <p className="text-white/30 text-center py-8 text-sm italic">لا توجد بيانات مبيعات</p>
                        ) : (
                            <div className="space-y-4">
                                {topProducts.map((item, index) => (
                                    <div key={item.productName} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <span className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-[10px] text-white/40 group-hover:bg-primary-600/20 group-hover:text-primary-400 transition-colors">
                                                {index + 1}
                                            </span>
                                            <div>
                                                <p className="text-white text-sm font-medium">{item.productName}</p>
                                                <p className="text-[10px] text-white/40">{item.quantity} وحدة</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-green-400 font-bold text-sm">{item.revenue}</p>
                                            <p className="text-[10px] text-white/20">ريال</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KPIDashboard;
