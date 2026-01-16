/**
 * KPI Stats Overview Component
 * To be embedded in the main Admin Dashboard
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
    TrendingUp, TrendingDown, Clock, CheckCircle2, AlertTriangle, Star,
    Zap, ThumbsUp, RefreshCw, Calendar
} from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../common/StatCard';

// ============================================================
// TYPES & HELPERS
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

const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)} د`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}س ${mins}د`;
};

const CHART_COLORS = ['#14B8A6', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// Helper to map color to iconColor variant
const getIconColorVariant = (color: string): 'teal' | 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'yellow' | 'pink' => {
    if (color === '#3B82F6') return 'blue';
    if (color === '#22C55E') return 'green';
    if (color === '#14B8A6') return 'teal';
    if (color === '#F59E0B') return 'yellow';
    if (color === '#EF4444') return 'red';
    if (color === '#8B5CF6') return 'purple';
    return 'teal';
};

export const KPIStatsOverview: React.FC = () => {
    const { user } = useAuth();
    const branchId = (user as any)?.branch || (user as any)?.branchId || 'default';
    const tenantId = (user as any)?.tenantId;
    const [loading, setLoading] = useState(true);

    // Stats
    const [totalRequests, setTotalRequests] = useState(0);
    const [completedRequests, setCompletedRequests] = useState(0);
    const [avgResponseTime, setAvgResponseTime] = useState(0);
    const [avgRating, setAvgRating] = useState(0);
    const [minibarRevenue, setMinibarRevenue] = useState(0);
    const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
    const [requestsByType, setRequestsByType] = useState<any[]>([]);

    // Yesterday's stats for trend calculation
    const [yesterdayRequests, setYesterdayRequests] = useState(0);
    const [yesterdayCompleted, setYesterdayCompleted] = useState(0);

    // Helper functions for dynamic trends
    const calculateChange = (today: number, yesterday: number): number =>
        yesterday === 0 ? 0 : Math.abs(Math.round(((today - yesterday) / yesterday) * 100));
    const getTrend = (today: number, yesterday: number): 'up' | 'down' | 'stable' =>
        today > yesterday ? 'up' : today < yesterday ? 'down' : 'stable';

    const loadData = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get requests for last 7 days
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            const constraints: any[] = [where('branch', '==', branchId)];
            if (tenantId) constraints.push(where('tenantId', '==', tenantId));

            constraints.push(orderBy('createdAt', 'desc'));
            constraints.push(limit(500));

            const q = query(
                collection(db, 'requests'),
                ...constraints
            );

            const snapshot = await getDocs(q);
            const requests: any[] = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.createdAt && data.createdAt.toDate() >= weekAgo) {
                    requests.push({ id: doc.id, ...data });
                }
            });

            // Calculate Totals (All time in view)
            setTotalRequests(requests.length);
            setCompletedRequests(requests.filter(r => r.status === 'COMPLETED').length);

            // Response Time
            const completed = requests.filter(r => r.status === 'COMPLETED' && r.completedAt);
            if (completed.length > 0) {
                const totalMinutes = completed.reduce((sum, r) => {
                    return sum + (r.completedAt.toDate().getTime() - r.createdAt.toDate().getTime()) / 60000;
                }, 0);
                setAvgResponseTime(totalMinutes / completed.length);
            }

            // Rating
            const rated = requests.filter(r => r.rating);
            if (rated.length > 0) {
                setAvgRating(rated.reduce((sum, r) => sum + r.rating, 0) / rated.length);
            }

            // Minibar Revenue
            let revenue = 0;
            requests.forEach(r => {
                if (r.minibarTotal) revenue += r.minibarTotal;
                else if (r.minibarConsumption) r.minibarConsumption.forEach((i: any) => revenue += i.total || 0);
            });
            setMinibarRevenue(revenue);

            // Time Series
            const days: Record<string, any> = {};
            const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                days[d.toDateString()] = { date: dayNames[d.getDay()], requests: 0, completed: 0 };
            }

            requests.forEach(r => {
                const d = r.createdAt.toDate().toDateString();
                if (days[d]) {
                    days[d].requests++;
                    if (r.status === 'COMPLETED') days[d].completed++;
                }
            });
            const daysArray = Object.values(days);
            setTimeSeriesData(daysArray);

            // Extract yesterday's data for trend calculation
            const todayData = daysArray[6]; // Last element = today
            const yesterdayData = daysArray[5]; // Second to last = yesterday
            setYesterdayRequests(yesterdayData?.requests || 0);
            setYesterdayCompleted(yesterdayData?.completed || 0);

            // By Type
            const typeMap: Record<string, number> = {};
            requests.forEach(r => {
                const type = r.type || 'other';
                typeMap[type] = (typeMap[type] || 0) + 1;
            });
            const typeLabels: any = { cleaning: 'تنظيف', maintenance: 'صيانة', bellman: 'بيلمان', coffee: 'مشروبات', laundry: 'غسيل', minibar: 'ميني بار' };
            setRequestsByType(Object.entries(typeMap).map(([k, v]) => ({ name: typeLabels[k] || k, value: v })));

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [branchId]);

    const cards = [
        { id: 'total', title: '📋 إجمالي الطلبات', value: totalRequests, change: calculateChange(totalRequests, yesterdayRequests), trend: getTrend(totalRequests, yesterdayRequests), icon: Zap, iconColor: 'blue' as const },
        { id: 'completed', title: '✅ مكتملة', value: completedRequests, change: calculateChange(completedRequests, yesterdayCompleted), trend: getTrend(completedRequests, yesterdayCompleted), icon: CheckCircle2, iconColor: 'green' as const },
        { id: 'time', title: '⏱️ وقت الاستجابة', value: formatTime(avgResponseTime), change: 0, trend: 'stable' as const, icon: Clock, iconColor: 'teal' as const },
        { id: 'rating', title: '⭐ التقييم', value: avgRating.toFixed(1), change: 0, trend: 'stable' as const, icon: Star, iconColor: 'yellow' as const },
    ];

    if (loading) return <div className="h-40 animate-pulse transition-colors duration-300" style={{ background: 'var(--theme-bg-primary)', borderRadius: 'var(--radius-lg)' }} />;

    return (
        <div className="space-y-6">
            {/* Cards Grid - ✅ Mobile-First Responsive */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                {cards.map((c) => (
                    <div key={c.id} className="stat-card-pro-compact">
                        <StatCard
                            icon={c.icon}
                            iconColor={c.iconColor}
                            label={c.title}
                            count={typeof c.value === 'number' ? c.value : undefined}
                            value={typeof c.value === 'string' ? c.value : undefined}
                            lastUpdate={c.change > 0 ? `${c.change}% مقارنة بالأمس` : "تم التحديث الآن"}
                            trend={c.trend === 'up' ? `+${c.change}%` : c.trend === 'down' ? `-${c.change}%` : undefined}
                        />
                    </div>
                ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 transition-colors duration-300" style={{ background: 'var(--theme-bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--theme-border-primary)' }}>
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2 transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>
                        <Calendar className="w-4 h-4 text-blue-400" />
                        النشاط الأسبوعي
                    </h3>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timeSeriesData}>
                                <defs>
                                    <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px' }} />
                                <Area type="monotone" dataKey="requests" stroke="#3B82F6" fill="url(#gReq)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="p-4 transition-colors duration-300" style={{ background: 'var(--theme-bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--theme-border-primary)' }}>
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2 transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>
                        <PieChart className="w-4 h-4 text-teal-400" />
                        توزيع الخدمات
                    </h3>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={requestsByType} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                                    {requestsByType.map((_, index) => (
                                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px' }} />
                                <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
