/**
 * Daily Operations Insight - "حصاد اليوم" 📊
 * Comprehensive daily operations report for managers
 * Shows completed tasks, performance metrics, and department efficiency
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Calendar, Clock, TrendingUp, TrendingDown, Award, AlertTriangle,
    Users, CheckCircle2, BarChart3, Filter, ChevronDown, Zap, Target,
    Sparkles, ArrowRight, Trophy, Timer, Building2
} from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { getPointsConfig } from '../../services/pointsService';

// ============================================================
// TYPES
// ============================================================

interface DepartmentStats {
    department: string;
    departmentAr: string;
    icon: string;
    color: string;
    completed: number;
    inProgress: number;
    avgTimeMinutes: number;
    maxAllowedMinutes: number; // From points config
    onTimeCount: number;
    lateCount: number;
    efficiency: number; // percentage
}

interface DailyInsight {
    date: Date;
    totalCompleted: number;
    totalInProgress: number;
    busiestDepartment: DepartmentStats | null;
    fastestDepartment: DepartmentStats | null;
    slowestDepartment: DepartmentStats | null;
    departments: DepartmentStats[];
    overallAvgTime: number;
    overallEfficiency: number;
}

interface DailyOperationsInsightProps {
    isOpen: boolean;
    onClose: () => void;
}

// ============================================================
// DEPARTMENT CONFIG
// ============================================================

const DEPARTMENT_CONFIG: Record<string, { ar: string; icon: string; color: string; defaultMaxMinutes: number }> = {
    housekeeping: { ar: 'الهاوس كيبنج', icon: '🧹', color: 'bg-green-500', defaultMaxMinutes: 30 },
    maintenance: { ar: 'الصيانة', icon: '🔧', color: 'bg-yellow-500', defaultMaxMinutes: 60 },
    bellman: { ar: 'البيلمان', icon: '🛎️', color: 'bg-purple-500', defaultMaxMinutes: 15 },
    coffee_shop: { ar: 'الكوفي شوب', icon: '☕', color: 'bg-amber-600', defaultMaxMinutes: 20 },
    procurement: { ar: 'المشتريات', icon: '🛒', color: 'bg-blue-500', defaultMaxMinutes: 300 }, // 5 hours
    reception: { ar: 'الاستقبال', icon: '🏨', color: 'bg-teal-500', defaultMaxMinutes: 10 },
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const DailyOperationsInsight: React.FC<DailyOperationsInsightProps> = ({
    isOpen,
    onClose
}) => {
    const { tenantId, branchId } = useAuth();
    
    // State
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [filterMode, setFilterMode] = useState<'today' | 'yesterday' | 'custom'>('today');
    const [loading, setLoading] = useState(true);
    const [insight, setInsight] = useState<DailyInsight | null>(null);
    const [pointsConfig, setPointsConfig] = useState<any>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Load points config for timing thresholds
    useEffect(() => {
        if (!tenantId) return;
        
        const loadConfig = async () => {
            const config = await getPointsConfig(tenantId);
            setPointsConfig(config);
        };
        loadConfig();
    }, [tenantId]);

    // Set date based on filter mode
    useEffect(() => {
        const now = new Date();
        if (filterMode === 'today') {
            setSelectedDate(now);
        } else if (filterMode === 'yesterday') {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            setSelectedDate(yesterday);
        }
    }, [filterMode]);

    // Load data for selected date
    useEffect(() => {
        if (!isOpen || !tenantId || !branchId) return;
        
        const loadInsight = async () => {
            setLoading(true);
            
            try {
                // Get start and end of selected date
                const startOfDay = new Date(selectedDate);
                startOfDay.setHours(0, 0, 0, 0);
                
                const endOfDay = new Date(selectedDate);
                endOfDay.setHours(23, 59, 59, 999);

                // Query requests for the selected date
                const requestsRef = collection(db!, 'requests');
                const q = query(
                    requestsRef,
                    where('tenantId', '==', tenantId),
                    where('branchId', '==', branchId),
                    where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
                    where('createdAt', '<=', Timestamp.fromDate(endOfDay))
                );

                const snapshot = await getDocs(q);
                const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Process by department
                const deptStats: Record<string, DepartmentStats> = {};

                for (const dept of Object.keys(DEPARTMENT_CONFIG)) {
                    const config = DEPARTMENT_CONFIG[dept];
                    const maxMinutes = pointsConfig?.serviceTimes?.[dept]?.maxMinutes || config.defaultMaxMinutes;
                    
                    const deptRequests = requests.filter((r: any) => 
                        r.serviceType === dept || r.targetDepartment === dept || r.department === dept
                    );

                    const completedRequests = deptRequests.filter((r: any) => 
                        r.status === 'COMPLETED' || r.status === 'completed'
                    );

                    const inProgressRequests = deptRequests.filter((r: any) => 
                        r.status === 'IN_PROGRESS' || r.status === 'in_progress'
                    );

                    // Calculate average time
                    let totalTime = 0;
                    let timeCount = 0;
                    let onTimeCount = 0;
                    let lateCount = 0;

                    for (const req of completedRequests) {
                        const createdAt = (req as any).createdAt?.toDate?.() || new Date();
                        const completedAt = (req as any).completedAt?.toDate?.() || 
                                           (req as any).updatedAt?.toDate?.() || new Date();
                        
                        const diffMs = completedAt.getTime() - createdAt.getTime();
                        const diffMinutes = diffMs / (1000 * 60);
                        
                        if (diffMinutes > 0 && diffMinutes < 24 * 60) { // Reasonable range
                            totalTime += diffMinutes;
                            timeCount++;
                            
                            if (diffMinutes <= maxMinutes) {
                                onTimeCount++;
                            } else {
                                lateCount++;
                            }
                        }
                    }

                    const avgTime = timeCount > 0 ? totalTime / timeCount : 0;
                    const efficiency = completedRequests.length > 0 
                        ? (onTimeCount / completedRequests.length) * 100 
                        : 100;

                    deptStats[dept] = {
                        department: dept,
                        departmentAr: config.ar,
                        icon: config.icon,
                        color: config.color,
                        completed: completedRequests.length,
                        inProgress: inProgressRequests.length,
                        avgTimeMinutes: Math.round(avgTime),
                        maxAllowedMinutes: maxMinutes,
                        onTimeCount,
                        lateCount,
                        efficiency: Math.round(efficiency)
                    };
                }

                const deptArray = Object.values(deptStats);
                const activeDepts = deptArray.filter(d => d.completed > 0 || d.inProgress > 0);

                // Calculate totals
                const totalCompleted = deptArray.reduce((sum, d) => sum + d.completed, 0);
                const totalInProgress = deptArray.reduce((sum, d) => sum + d.inProgress, 0);

                // Find busiest (most requests)
                const busiestDepartment = activeDepts.length > 0
                    ? activeDepts.reduce((max, d) => (d.completed + d.inProgress) > (max.completed + max.inProgress) ? d : max)
                    : null;

                // Find fastest (lowest avg time relative to allowed)
                const completedDepts = activeDepts.filter(d => d.completed > 0 && d.avgTimeMinutes > 0);
                const fastestDepartment = completedDepts.length > 0
                    ? completedDepts.reduce((min, d) => 
                        (d.avgTimeMinutes / d.maxAllowedMinutes) < (min.avgTimeMinutes / min.maxAllowedMinutes) ? d : min)
                    : null;

                // Find slowest
                const slowestDepartment = completedDepts.length > 0
                    ? completedDepts.reduce((max, d) => 
                        (d.avgTimeMinutes / d.maxAllowedMinutes) > (max.avgTimeMinutes / max.maxAllowedMinutes) ? d : max)
                    : null;

                // Overall metrics
                const totalAvgTimes = completedDepts.reduce((sum, d) => sum + d.avgTimeMinutes, 0);
                const overallAvgTime = completedDepts.length > 0 ? totalAvgTimes / completedDepts.length : 0;
                
                const totalEfficiency = activeDepts.reduce((sum, d) => sum + d.efficiency, 0);
                const overallEfficiency = activeDepts.length > 0 ? totalEfficiency / activeDepts.length : 100;

                setInsight({
                    date: selectedDate,
                    totalCompleted,
                    totalInProgress,
                    busiestDepartment,
                    fastestDepartment,
                    slowestDepartment,
                    departments: deptArray,
                    overallAvgTime: Math.round(overallAvgTime),
                    overallEfficiency: Math.round(overallEfficiency)
                });

            } catch (err) {
                console.error('Error loading daily insight:', err);
            } finally {
                setLoading(false);
            }
        };

        loadInsight();
    }, [isOpen, tenantId, branchId, selectedDate, pointsConfig]);

    // Format date for display
    const formatDate = (date: Date) => {
        const options: Intl.DateTimeFormatOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        return date.toLocaleDateString('ar-EG', options);
    };

    // Format time
    const formatTime = (minutes: number) => {
        if (minutes < 60) return `${minutes} دقيقة`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours} ساعة و ${mins} دقيقة` : `${hours} ساعة`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4" style={{ backdropFilter: 'blur(4px)' }}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-teal-500/10 to-cyan-500/10">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg">
                            <BarChart3 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                حصاد اليوم
                                <Sparkles className="w-5 h-5 text-amber-500" />
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {formatDate(selectedDate)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-600 dark:text-white/70" />
                    </button>
                </div>

                {/* Filter Bar */}
                <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-white/10">
                            <button
                                onClick={() => setFilterMode('today')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    filterMode === 'today'
                                        ? 'bg-teal-500 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                                }`}
                            >
                                اليوم
                            </button>
                            <button
                                onClick={() => setFilterMode('yesterday')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    filterMode === 'yesterday'
                                        ? 'bg-teal-500 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                                }`}
                            >
                                أمس
                            </button>
                            <button
                                onClick={() => {
                                    setFilterMode('custom');
                                    setShowDatePicker(!showDatePicker);
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                                    filterMode === 'custom'
                                        ? 'bg-teal-500 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                                }`}
                            >
                                <Calendar className="w-4 h-4" />
                                تحديد تاريخ
                            </button>
                        </div>

                        {/* Date Picker */}
                        {showDatePicker && filterMode === 'custom' && (
                            <input
                                type="date"
                                value={selectedDate.toISOString().split('T')[0]}
                                onChange={(e) => {
                                    setSelectedDate(new Date(e.target.value));
                                    setShowDatePicker(false);
                                }}
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/20 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm"
                            />
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full" />
                        </div>
                    ) : insight ? (
                        <div className="space-y-6">
                            
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {/* Total Completed */}
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 rounded-xl p-4 border border-green-200 dark:border-green-500/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                                        <span className="text-xs text-green-700 dark:text-green-300">مكتمل</span>
                                    </div>
                                    <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                                        {insight.totalCompleted}
                                    </div>
                                    <div className="text-xs text-green-600 dark:text-green-400">طلب</div>
                                </div>

                                {/* In Progress */}
                                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 rounded-xl p-4 border border-blue-200 dark:border-blue-500/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        <span className="text-xs text-blue-700 dark:text-blue-300">قيد التنفيذ</span>
                                    </div>
                                    <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                                        {insight.totalInProgress}
                                    </div>
                                    <div className="text-xs text-blue-600 dark:text-blue-400">طلب</div>
                                </div>

                                {/* Avg Time */}
                                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Timer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                        <span className="text-xs text-amber-700 dark:text-amber-300">متوسط الوقت</span>
                                    </div>
                                    <div className="text-2xl font-bold text-amber-800 dark:text-amber-200">
                                        {insight.overallAvgTime}
                                    </div>
                                    <div className="text-xs text-amber-600 dark:text-amber-400">دقيقة</div>
                                </div>

                                {/* Efficiency */}
                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-500/10 dark:to-pink-500/10 rounded-xl p-4 border border-purple-200 dark:border-purple-500/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                        <span className="text-xs text-purple-700 dark:text-purple-300">الكفاءة</span>
                                    </div>
                                    <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                                        {insight.overallEfficiency}%
                                    </div>
                                    <div className="text-xs text-purple-600 dark:text-purple-400">في الوقت</div>
                                </div>
                            </div>

                            {/* Highlights */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* Busiest Department */}
                                {insight.busiestDepartment && (
                                    <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-500/10 dark:to-orange-500/10 rounded-xl p-4 border border-red-200 dark:border-red-500/20">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                                                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                            </div>
                                            <span className="text-sm font-medium text-red-800 dark:text-red-200">أكثر ضغطاً</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{insight.busiestDepartment.icon}</span>
                                            <div>
                                                <div className="font-bold text-slate-800 dark:text-white">
                                                    {insight.busiestDepartment.departmentAr}
                                                </div>
                                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                                    {insight.busiestDepartment.completed + insight.busiestDepartment.inProgress} طلب
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Fastest Department */}
                                {insight.fastestDepartment && (
                                    <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-500/10 dark:to-teal-500/10 rounded-xl p-4 border border-green-200 dark:border-green-500/20">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                                                <Trophy className="w-4 h-4 text-green-600 dark:text-green-400" />
                                            </div>
                                            <span className="text-sm font-medium text-green-800 dark:text-green-200">الأسرع 🏆</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{insight.fastestDepartment.icon}</span>
                                            <div>
                                                <div className="font-bold text-slate-800 dark:text-white">
                                                    {insight.fastestDepartment.departmentAr}
                                                </div>
                                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                                    {formatTime(insight.fastestDepartment.avgTimeMinutes)} متوسط
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Slowest Department */}
                                {insight.slowestDepartment && (
                                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/20">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                                                <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">يحتاج تحسين</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{insight.slowestDepartment.icon}</span>
                                            <div>
                                                <div className="font-bold text-slate-800 dark:text-white">
                                                    {insight.slowestDepartment.departmentAr}
                                                </div>
                                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                                    {formatTime(insight.slowestDepartment.avgTimeMinutes)} متوسط
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Department Details Table */}
                            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
                                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-teal-500" />
                                        تفاصيل الأقسام
                                    </h3>
                                </div>
                                <div className="divide-y divide-slate-200 dark:divide-white/10">
                                    {insight.departments.map((dept) => (
                                        <div key={dept.department} className="p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{dept.icon}</span>
                                                    <div>
                                                        <div className="font-medium text-slate-800 dark:text-white">
                                                            {dept.departmentAr}
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                            <span className="flex items-center gap-1">
                                                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                                {dept.completed} مكتمل
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3 text-blue-500" />
                                                                {dept.inProgress} جاري
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-left">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-bold ${
                                                            dept.avgTimeMinutes <= dept.maxAllowedMinutes
                                                                ? 'text-green-600 dark:text-green-400'
                                                                : 'text-amber-600 dark:text-amber-400'
                                                        }`}>
                                                            {dept.avgTimeMinutes > 0 ? formatTime(dept.avgTimeMinutes) : '-'}
                                                        </span>
                                                        {dept.avgTimeMinutes > 0 && dept.avgTimeMinutes <= dept.maxAllowedMinutes && (
                                                            <Zap className="w-4 h-4 text-green-500" />
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-400">
                                                        الحد: {formatTime(dept.maxAllowedMinutes)}
                                                    </div>
                                                    {/* Efficiency Bar */}
                                                    <div className="mt-1 w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full ${
                                                                dept.efficiency >= 80 ? 'bg-green-500' :
                                                                dept.efficiency >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                                            }`}
                                                            style={{ width: `${dept.efficiency}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* No Data State */}
                            {insight.totalCompleted === 0 && insight.totalInProgress === 0 && (
                                <div className="text-center py-10">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <Calendar className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                                        لا توجد عمليات
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        لم يتم تسجيل أي عمليات في هذا اليوم
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-slate-500 dark:text-slate-400">حدث خطأ في تحميل البيانات</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>💡 الأوقات مرتبطة بإعدادات النقاط للتقييم العادل</span>
                        <span>آخر تحديث: الآن</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyOperationsInsight;
