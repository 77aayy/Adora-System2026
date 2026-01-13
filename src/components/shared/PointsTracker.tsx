/**
 * 🏆 Enhanced Points Tracker (Transparency & Animation Edition)
 * Detailed history explanations + Flying Points + Haptic Feedback
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Trophy, Medal, Award, History, X, ChevronUp, ChevronDown,
    Users, Star, Zap, Clock, AlertCircle, Info, DollarSign, CheckCircle2, Sparkles, RefreshCw
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { AdoraLoaderInline } from '../../components/common/AdoraLoader';
import * as PointsService from '../../services/pointsService';
import { requestPayout, getEmployeePayoutHistory } from '../../services/payoutService';
import { PayoutRequest } from '../../types';

// ============================================================
// TYPES
// ============================================================

interface PointsHistoryItem {
    id: string;
    points: number;
    reason: string;
    timestamp: any;
}

interface LeaderboardEntry {
    id: string;
    name: string;
    points: number;
    rank: number;
    department?: string;
}

interface PointsTrackerProps {
    employeeId: string;
    showHistory?: boolean;
    showLeaderboard?: boolean;
    inline?: boolean;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const PointsTracker: React.FC<PointsTrackerProps> = ({
    employeeId,
    showHistory = false,
    showLeaderboard = false,
    inline = false
}) => {
    const { user } = useAuth();
    const { haptic, playSound } = useUX();
    
    // ✅ Feature Gate: Check if points system is enabled
    const { isEnabled: isPointsSystemEnabled } = useFeatureGate('pointsSystem');

    // State - ALL hooks must be called before any conditional returns
    const [points, setPoints] = useState<number | null>(null);
    const [lifetimePoints, setLifetimePoints] = useState<number>(0);
    const [prevPoints, setPrevPoints] = useState<number>(0);
    const [teamPoints, setTeamPoints] = useState(0);
    const [teamName, setTeamName] = useState('');
    const [history, setHistory] = useState<PointsHistoryItem[]>([]);
    const [payoutHistory, setPayoutHistory] = useState<PayoutRequest[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'activity' | 'wallet'>('activity');
    const [activityFilter, setActivityFilter] = useState<'all' | 'performance' | 'attendance' | 'achievements'>('all');
    const [loading, setLoading] = useState(true);
    const [redeeming, setRedeeming] = useState(false);

    // Dynamic Config
    const [exchangeRate, setExchangeRate] = useState(0.5);
    const [minRedemption, setMinRedemption] = useState(100);

    // Animation State
    const [flyingDelta, setFlyingDelta] = useState<number | null>(null);
    const [isPulsing, setIsPulsing] = useState(false);
    const animationTimeout = useRef<NodeJS.Timeout | null>(null);

    // Employee context
    const employeeContext: PointsService.EmployeeContext | null = useMemo(() => {
        if (!user) return null;
        return {
            hotelId: (user as any).hotelId || 'default',
            branchId: (user as any).branch || 'default',
            employeeId: employeeId,
            employeeName: user.name || ''
        };
    }, [user, employeeId]);

    // Handle Animation & Haptics on Points Change
    const triggerAwardTransition = (delta: number) => {
        if (delta === 0) return;

        // 1. Set values
        setFlyingDelta(delta);
        setIsPulsing(true);

        // 2. Feedback
        if (delta > 0) {
            haptic('medium');
            playSound?.('success');
        } else {
            haptic('error');
        }

        // 3. Clear after animation
        if (animationTimeout.current) clearTimeout(animationTimeout.current);
        animationTimeout.current = setTimeout(() => {
            setFlyingDelta(null);
            setIsPulsing(false);
        }, 3000); // Longer animation to read the text
    };

    // Listen to points updates
    useEffect(() => {
        if (!employeeId || !isPointsSystemEnabled) return;

        const tenantId = (user as any)?.tenantId || 'default';
        const userRef = doc(db, `tenants/${tenantId}/employees`, employeeId);

        const unsubscribe = onSnapshot(userRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const newPoints = data.currentPoints ?? data.personalPoints ?? 0;
                const newLifetime = data.lifetimePoints ?? newPoints;

                // If this is an update (not initial load)
                if (points !== null) {
                    const delta = newPoints - points;
                    if (delta !== 0) triggerAwardTransition(delta);
                }

                setPoints(newPoints);
                setLifetimePoints(newLifetime);
                setPrevPoints(points || 0);

                // Load streak info
                // ... logic to be added
                setLoading(false);
            }
        });

        return () => {
            unsubscribe();
            if (animationTimeout.current) clearTimeout(animationTimeout.current);
        };
    }, [employeeId, points, user, isPointsSystemEnabled]);
    
    // ✅ Show placeholder if feature is disabled (but don't hide completely)
    // This ensures the cup icon is always visible for transparency
    const featureDisabled = !isPointsSystemEnabled;

    async function getPointsServiceConfig() {
        try {
            const tenantId = (user as any)?.tenantId || 'default';
            // const configRef = doc(db, 'settings', 'pointsConfig'); // Unused
            const snap = await PointsService.getPointsConfig(tenantId);
            return snap as any;
        } catch (e) { return null; }
    }

    // Load history
    const loadHistory = async () => {
        if (!employeeContext) return;
        const tenantId = (user as any)?.tenantId || 'default';

        try {
            const [pointItems, payoutItems] = await Promise.all([
                PointsService.getPointsHistory(employeeContext, 50),
                getEmployeePayoutHistory(tenantId, employeeId)
            ]);

            setHistory(pointItems.map(item => ({
                id: item.id,
                points: item.points,
                reason: item.reason,
                timestamp: item.timestamp
            })));

            setPayoutHistory(payoutItems);
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    };

    // Load leaderboard
    const loadLeaderboard = async () => {
        if (!employeeContext) return;
        const tenantId = (user as any)?.tenantId || 'default';

        try {
            const entries = await PointsService.getLeaderboard(
                tenantId,
                10
            );
            setLeaderboard(entries.map(e => ({
                id: e.id,
                name: e.name,
                points: e.points,
                rank: e.rank,
                department: e.department
            })));
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }
    };

    const handleShowLeaderboard = () => {
        setShowLeaderboardModal(true);
        loadLeaderboard();
    };

    const handleShowHistory = () => {
        setShowHistoryModal(true);
        loadHistory();
    };

    const formatDate = (timestamp: any): string => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('ar-SA', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <div className="relative">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <div className="absolute -top-1 -right-1 text-xs animate-bounce">👑</div>
        </div>;
        switch (rank) {
            case 2: return <Medal className="w-5 h-5 text-gray-300" />;
            case 3: return <Award className="w-5 h-5 text-amber-600" />;
            default: return <span className="text-white/70 font-bold">{rank}</span>;
        }
    };

    const getLifetimeBadge = (lp: number) => {
        if (lp >= 5000) return { label: 'أسطورة Adora', icon: '👑', color: 'text-indigo-400' };
        if (lp >= 2000) return { label: 'نجم ذهبي', icon: '⭐', color: 'text-yellow-400' };
        if (lp >= 500) return { label: 'موظف متميز', icon: '🚀', color: 'text-blue-400' };
        return { label: 'طموح', icon: '🌱', color: 'text-green-400' };
    };

    // ✅ تصنيف النقاط حسب المصدر
    const categorizePoints = (reason: string): 'performance' | 'attendance' | 'achievements' => {
        const reasonLower = reason.toLowerCase();
        
        // نقاط سرعة الأداء
        if (reasonLower.includes('سريع') || reasonLower.includes('سرعة') || 
            reasonLower.includes('fast') || reasonLower.includes('إتمام') ||
            reasonLower.includes('تنظيف') || reasonLower.includes('صيانة') ||
            reasonLower.includes('طلب') || reasonLower.includes('توصيل') ||
            reasonLower.includes('check') || reasonLower.includes('تسليم')) {
            return 'performance';
        }
        
        // نقاط الرتب والأوسمة
        if (reasonLower.includes('وسام') || reasonLower.includes('رتبة') ||
            reasonLower.includes('badge') || reasonLower.includes('rank') ||
            reasonLower.includes('إنجاز') || reasonLower.includes('achievement') ||
            reasonLower.includes('تحدي') || reasonLower.includes('challenge') ||
            reasonLower.includes('مكافأة') || reasonLower.includes('bonus') ||
            reasonLower.includes('streak') || reasonLower.includes('سلسلة')) {
            return 'achievements';
        }
        
        // نقاط الالتزام (الحضور)
        if (reasonLower.includes('حضور') || reasonLower.includes('attendance') ||
            reasonLower.includes('التزام') || reasonLower.includes('يومي') ||
            reasonLower.includes('daily') || reasonLower.includes('تسجيل دخول')) {
            return 'attendance';
        }
        
        // الافتراضي: سرعة الأداء
        return 'performance';
    };

    // فلترة السجل حسب التبويب الفرعي النشط
    const filteredHistory = useMemo(() => {
        if (activityFilter === 'all') return history;
        return history.filter(item => categorizePoints(item.reason) === activityFilter);
    }, [history, activityFilter]);

    // حساب الإحصائيات لكل فئة
    const categoryStats = useMemo(() => {
        const stats = {
            performance: { count: 0, total: 0 },
            attendance: { count: 0, total: 0 },
            achievements: { count: 0, total: 0 }
        };
        
        history.forEach(item => {
            const category = categorizePoints(item.reason);
            stats[category].count++;
            stats[category].total += item.points;
        });
        
        return stats;
    }, [history]);

    const handleRedeemRequest = async () => {
        if (!points || points < minRedemption) return;
        const tenantId = (user as any)?.tenantId || 'default';

        setRedeeming(true);
        try {
            const res = await requestPayout(
                tenantId,
                employeeId,
                user?.name || '',
                user?.department || '',
                points,
                exchangeRate
            );

            if (res.success) {
                haptic('success');
                playSound?.('success');
                loadHistory(); // Refresh
            } else {
                alert(res.error || 'فشل طلب الصرف');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setRedeeming(false);
        }
    };

    // Animation Classes
    const pulseStyle = isPulsing ? 'animate-bounce scale-110' : '';

    // Inline version
    if (inline) {
        return (
            <div className="flex items-center gap-2 relative">
                {/* Flying Delta Animation */}
                {flyingDelta !== null && (
                    <>
                        {/* 🏆 Central Golden Victory Pop-up (Phase 12) */}
                        {createPortal(
                            <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center">
                                <div className="animate-fly-gold flex flex-col items-center">
                                    <div className="relative">
                                        <Trophy className="w-24 h-24 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" />
                                        <div className="absolute inset-0 animate-spin-slow">
                                            <Sparkles className="absolute -top-4 -right-4 w-8 h-8 text-yellow-200" />
                                            <Sparkles className="absolute -bottom-2 -left-4 w-6 h-6 text-yellow-200 delay-100" />
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 bg-slate-800/90 px-6 py-2 rounded-full border border-yellow-500/30">
                                        <span className="text-3xl font-black text-yellow-400">+{flyingDelta}</span>
                                        <span className="text-sm font-bold text-white/80">نقطة</span>
                                    </div>
                                    {/* Multiplier Badge if huge delta */}
                                    {flyingDelta > 5 && (
                                        <div className="mt-1 px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full text-xs font-bold text-white shadow-lg animate-bounce">
                                            X1.5 STREAK! 🔥
                                        </div>
                                    )}
                                </div>
                            </div>,
                            document.body
                        )}

                    </>
                )}

                <button
                    onClick={handleShowHistory}
                    aria-label="سجل النقاط"
                    className={`flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-3 py-2 rounded-xl shadow-lg shadow-amber-500/30 cursor-pointer transition-all duration-300 ${pulseStyle} ${flyingDelta ? 'animate-shake-cup' : ''}`}
                >
                    <Trophy className={`w-5 h-5 text-white drop-shadow-md ${flyingDelta ? 'animate-shake-cup' : ''}`} />
                    <span className="font-black text-white text-sm tracking-tighter">
                        {points ?? 0}
                    </span>
                </button>

                {teamName && teamPoints > 0 && (
                    <div className="flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/10">
                        <Users className="w-3 h-3 text-blue-400" />
                        <span className="font-bold text-blue-400 text-xs">{teamPoints}</span>
                    </div>
                )}

                {/* 🆕 History Modal for Inline Mode - Rendered via Portal */}
                {showHistoryModal && createPortal(
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn" style={{ backdropFilter: 'blur(4px)' }}>
                        <div className="adora-card w-full max-w-xl max-h-[85vh] flex flex-col rounded-[2rem] overflow-hidden shadow-2xl">
                            {/* Modal Header */}
                            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--theme-border-primary)', background: 'var(--theme-bg-tertiary)' }}>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center">
                                        <Trophy className="w-6 h-6 text-yellow-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black adora-text-primary">سجل النقاط</h3>
                                        <p className="text-xs adora-text-tertiary">كل نقطة موضحة بالتفصيل</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowHistoryModal(false)}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-red-500/10"
                                    style={{ background: 'var(--theme-bg-secondary)', color: 'var(--theme-text-secondary)' }}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* ✅ إجمالي النقاط الكبير - ديناميكي حسب التبويب */}
                            {(() => {
                                // حساب القيم الديناميكية حسب التبويب المختار
                                const displayConfig = {
                                    all: {
                                        icon: '🏆',
                                        title: 'إجمالي نقاطك',
                                        value: points ?? 0,
                                        subtitle: 'نقطة متاحة للصرف',
                                        gradient: 'linear-gradient(135deg, var(--theme-primary-500) 0%, var(--theme-primary-600) 100%)',
                                        count: history.length
                                    },
                                    performance: {
                                        icon: '⚡',
                                        title: 'نقاط سرعة الأداء',
                                        value: categoryStats.performance.total,
                                        subtitle: `من ${categoryStats.performance.count} عملية`,
                                        gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                        count: categoryStats.performance.count
                                    },
                                    attendance: {
                                        icon: '📅',
                                        title: 'نقاط الالتزام',
                                        value: categoryStats.attendance.total,
                                        subtitle: `من ${categoryStats.attendance.count} عملية`,
                                        gradient: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
                                        count: categoryStats.attendance.count
                                    },
                                    achievements: {
                                        icon: '🏅',
                                        title: 'نقاط الأوسمة والرتب',
                                        value: categoryStats.achievements.total,
                                        subtitle: `من ${categoryStats.achievements.count} إنجاز`,
                                        gradient: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                                        count: categoryStats.achievements.count
                                    }
                                };
                                const config = displayConfig[activityFilter];
                                
                                return (
                                    <div className="p-6 text-center transition-all duration-300" style={{ background: config.gradient }}>
                                        <div className="flex items-center justify-center gap-3 mb-2">
                                            <span className="text-3xl">{config.icon}</span>
                                            <span className="text-white/90 text-sm font-bold">{config.title}</span>
                                        </div>
                                        <div className={`text-5xl font-black text-white mb-1 ${config.value < 0 ? 'text-red-200' : ''}`}>
                                            {config.value > 0 && activityFilter !== 'all' ? '+' : ''}{config.value}
                                        </div>
                                        <div className="text-white/70 text-sm">{config.subtitle}</div>
                                        {activityFilter === 'all' && (
                                            <div className="mt-3 pt-3 border-t border-white/20 flex justify-center gap-6">
                                                <div className="text-center">
                                                    <div className="text-lg font-bold text-white">{lifetimePoints}</div>
                                                    <div className="text-[10px] text-white/60">الإجمالي التاريخي</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-lg font-bold text-white">{history.length}</div>
                                                    <div className="text-[10px] text-white/60">عدد العمليات</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* ✅ تبويبات تصنيف النقاط */}
                            <div className="p-3" style={{ background: 'var(--theme-bg-secondary)', borderBottom: '1px solid var(--theme-border-primary)' }}>
                                <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <button
                                        onClick={() => setActivityFilter('all')}
                                        className={`flex-1 py-2.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            activityFilter === 'all' 
                                                ? 'bg-white dark:bg-slate-700 shadow-sm adora-text-primary' 
                                                : 'adora-text-tertiary hover:adora-text-primary'
                                        }`}
                                    >
                                        <span>📊</span>
                                        <span>الكل</span>
                                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-600">{history.length}</span>
                                    </button>
                                    <button
                                        onClick={() => setActivityFilter('performance')}
                                        className={`flex-1 py-2.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            activityFilter === 'performance' 
                                                ? 'bg-blue-500 text-white shadow-sm' 
                                                : 'text-blue-500 hover:bg-blue-500/10'
                                        }`}
                                    >
                                        <span>⚡</span>
                                        <span className="hidden sm:inline">أداء</span>
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activityFilter === 'performance' ? 'bg-blue-600' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600'}`}>
                                            {categoryStats.performance.total > 0 ? '+' : ''}{categoryStats.performance.total}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setActivityFilter('attendance')}
                                        className={`flex-1 py-2.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            activityFilter === 'attendance' 
                                                ? 'bg-green-500 text-white shadow-sm' 
                                                : 'text-green-500 hover:bg-green-500/10'
                                        }`}
                                    >
                                        <span>📅</span>
                                        <span className="hidden sm:inline">التزام</span>
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activityFilter === 'attendance' ? 'bg-green-600' : 'bg-green-100 dark:bg-green-900/50 text-green-600'}`}>
                                            {categoryStats.attendance.total > 0 ? '+' : ''}{categoryStats.attendance.total}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setActivityFilter('achievements')}
                                        className={`flex-1 py-2.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            activityFilter === 'achievements' 
                                                ? 'bg-yellow-500 text-white shadow-sm' 
                                                : 'text-yellow-500 hover:bg-yellow-500/10'
                                        }`}
                                    >
                                        <span>🏅</span>
                                        <span className="hidden sm:inline">أوسمة</span>
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activityFilter === 'achievements' ? 'bg-yellow-600' : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600'}`}>
                                            {categoryStats.achievements.total > 0 ? '+' : ''}{categoryStats.achievements.total}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body - السجل */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">

                                {/* عرض السجل المُفلتر */}
                                {filteredHistory.length === 0 ? (
                                    <div className="text-center py-16">
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <Info className="w-8 h-8" style={{ color: 'var(--theme-text-tertiary)' }} />
                                        </div>
                                        <p className="adora-text-tertiary font-medium">
                                            {activityFilter === 'all' 
                                                ? 'لا يوجد سجل عمليات بعد' 
                                                : `لا توجد نقاط من فئة "${
                                                    activityFilter === 'performance' ? 'سرعة الأداء' :
                                                    activityFilter === 'attendance' ? 'الالتزام' : 'الأوسمة'
                                                }"`
                                            }
                                        </p>
                                        <p className="text-xs adora-text-tertiary mt-1">ابدأ بإكمال المهام لكسب النقاط!</p>
                                    </div>
                                ) : (
                                    filteredHistory.map((item) => {
                                        const isPositive = item.points > 0;
                                        return (
                                            <div 
                                                key={item.id} 
                                                className="p-4 rounded-xl flex items-center justify-between transition-all hover:scale-[1.01]"
                                                style={{ 
                                                    background: 'var(--theme-bg-secondary)', 
                                                    border: '1px solid var(--theme-border-primary)' 
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                                        {isPositive ? (
                                                            <Zap className="w-5 h-5 text-green-500" />
                                                        ) : (
                                                            <AlertCircle className="w-5 h-5 text-red-500" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium adora-text-primary text-sm">{item.reason}</p>
                                                        <p className="text-xs adora-text-tertiary flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {formatDate(item.timestamp)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-left">
                                                    <span className={`text-lg font-black ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                                        {isPositive ? '+' : ''}{item.points}
                                                    </span>
                                                    <p className="text-xs adora-text-tertiary">نقطة</p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        );
    }

    // Full card version
    return (
        <>
            <div className="glass-card p-5 relative overflow-hidden group">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 blur-3xl -mr-12 -mt-12 group-hover:bg-yellow-500/10 transition-all duration-700" />

                {/* Flying Delta Animation */}
                {flyingDelta !== null && (
                    <div className="absolute top-4 right-12 animate-fadeOutUp text-2xl font-black pointer-events-none z-50">
                        <span className={flyingDelta > 0 ? 'text-green-400' : 'text-red-400'}>
                            {flyingDelta > 0 ? '+' : ''}{flyingDelta}
                        </span>
                    </div>
                )}

                <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/20 transition-transform duration-500 ${pulseStyle}`}>
                            <Trophy className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">الرصيد الملكي</h3>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-white">{points ?? 0}</span>
                                <span className="text-xs font-bold text-white/70">نقطة</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {showLeaderboard && (
                            <button
                                onClick={handleShowLeaderboard}
                                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all"
                                title="لوحة المتصدرين"
                            >
                                <Users className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={handleShowHistory}
                            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                            title="سجل الشفافية"
                        >
                            <History className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Team Info */}
                {teamName && (
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Users className="w-4 h-4 text-blue-400" />
                            </div>
                            <span className="text-xs font-bold text-white/70">فريق {teamName}</span>
                        </div>
                        <span className="text-blue-400 font-black text-sm">{teamPoints}</span>
                    </div>
                )}
            </div>

            {/* Transparency Modal (History) */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn" style={{ backdropFilter: 'none' }}>
                    <div className="glass-card w-full max-w-xl max-h-[85vh] flex flex-col rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-500/5 to-transparent">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                                    <History className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-tight">سجل الشفافية</h3>
                                    <p className="text-xs text-white/70">كل نقطة موضحة بالتفصيل والوقت</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/70 hover:text-white hover:bg-red-500/20 transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex bg-white/5 mx-6 p-1 rounded-2xl border border-white/5">
                            <button
                                onClick={() => setActiveTab('activity')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'activity' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-white/70 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Zap className="w-4 h-4" />
                                نشاطي
                            </button>
                            <button
                                onClick={() => setActiveTab('wallet')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'wallet' ? 'bg-primary-500 text-white shadow-lg shadow-emerald-500/20' : 'text-white/70 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <DollarSign className="w-4 h-4" />
                                محفظتي
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {activeTab === 'activity' ? (
                                <>
                                    {/* ✅ تبويبات فرعية لتصنيف النقاط */}
                                    <div className="grid grid-cols-4 gap-2 mb-4">
                                        <button
                                            onClick={() => setActivityFilter('all')}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                                                activityFilter === 'all' 
                                                    ? 'bg-white/10 border border-white/20' 
                                                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                                            }`}
                                        >
                                            <div className="text-lg">📊</div>
                                            <span className="text-[10px] font-bold text-white/70">الكل</span>
                                            <span className="text-xs font-black text-white">{history.length}</span>
                                        </button>
                                        <button
                                            onClick={() => setActivityFilter('performance')}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                                                activityFilter === 'performance' 
                                                    ? 'bg-blue-500/20 border border-blue-500/40' 
                                                    : 'bg-white/5 border border-transparent hover:bg-blue-500/10'
                                            }`}
                                        >
                                            <div className="text-lg">⚡</div>
                                            <span className="text-[10px] font-bold text-blue-400">سرعة الأداء</span>
                                            <span className={`text-xs font-black ${categoryStats.performance.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {categoryStats.performance.total > 0 ? '+' : ''}{categoryStats.performance.total}
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => setActivityFilter('attendance')}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                                                activityFilter === 'attendance' 
                                                    ? 'bg-green-500/20 border border-green-500/40' 
                                                    : 'bg-white/5 border border-transparent hover:bg-green-500/10'
                                            }`}
                                        >
                                            <div className="text-lg">📅</div>
                                            <span className="text-[10px] font-bold text-green-400">الالتزام</span>
                                            <span className={`text-xs font-black ${categoryStats.attendance.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {categoryStats.attendance.total > 0 ? '+' : ''}{categoryStats.attendance.total}
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => setActivityFilter('achievements')}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                                                activityFilter === 'achievements' 
                                                    ? 'bg-yellow-500/20 border border-yellow-500/40' 
                                                    : 'bg-white/5 border border-transparent hover:bg-yellow-500/10'
                                            }`}
                                        >
                                            <div className="text-lg">🏅</div>
                                            <span className="text-[10px] font-bold text-yellow-400">الأوسمة</span>
                                            <span className={`text-xs font-black ${categoryStats.achievements.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {categoryStats.achievements.total > 0 ? '+' : ''}{categoryStats.achievements.total}
                                            </span>
                                        </button>
                                    </div>

                                    {/* عرض السجل المُفلتر */}
                                    {filteredHistory.length === 0 ? (
                                        <div className="text-center py-20">
                                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                                                <Info className="w-10 h-10 text-white/10" />
                                            </div>
                                            <p className="text-white/70 font-bold">
                                                {activityFilter === 'all' 
                                                    ? 'لا يوجد سجل عمليات بعد' 
                                                    : `لا توجد نقاط من فئة "${
                                                        activityFilter === 'performance' ? 'سرعة الأداء' :
                                                        activityFilter === 'attendance' ? 'الالتزام' : 'الأوسمة'
                                                    }"`
                                                }
                                            </p>
                                            <p className="text-xs text-white/40 mt-2">ابدأ بإكمال المهام لكسب النقاط!</p>
                                        </div>
                                    ) : (
                                        filteredHistory.map((item) => {
                                        const isPositive = item.points > 0;
                                        const isNeutral = item.points === 0;

                                        return (
                                            <div key={item.id} className="relative group">
                                                <div className={`absolute inset-0 bg-gradient-to-r ${isPositive ? 'from-green-500/5' : isNeutral ? 'from-gray-500/5' : 'from-red-500/5'} to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                                                <div className="relative p-5 glass-dark rounded-3xl border border-white/5 transition-all duration-300 hover:border-white/10">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-start gap-4">
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isPositive ? 'bg-green-500/10 text-green-400' :
                                                                isNeutral ? 'bg-gray-500/10 text-gray-400' :
                                                                    'bg-red-500/10 text-red-400'
                                                                }`}>
                                                                {isPositive ? <Zap className="w-6 h-6" /> :
                                                                    isNeutral ? <Clock className="w-6 h-6" /> :
                                                                        <AlertCircle className="w-6 h-6" />}
                                                            </div>
                                                            <div>
                                                                <p className="text-white font-bold leading-tight mb-1">{item.reason}</p>
                                                                <div className="flex items-center gap-2 text-xs text-white/70 font-bold uppercase tracking-wider">
                                                                    <Clock className="w-3 h-3" />
                                                                    {formatDate(item.timestamp)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-left">
                                                            <span className={`text-2xl font-black ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                                                {isPositive ? '+' : ''}{item.points}
                                                            </span>
                                                            <p className="text-xs text-white/70 font-bold">نقطة</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                    )}
                                </>
                            ) : (
                                <div className="animate-fadeIn space-y-6">
                                    {/* Balance Summary Tooltip */}
                                    <div className="glass-dark p-8 rounded-[2rem] border border-white/5 flex flex-col items-center text-center relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 blur-[50px] rounded-full -mr-16 -mt-16" />

                                        <div className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em] mb-4">الرصيد المتاح للسحب</div>
                                        <div className="text-5xl font-black text-white mb-2 leading-none flex items-baseline gap-2">
                                            {points ?? 0}
                                            <span className="text-sm font-bold text-white/70 uppercase">Pts</span>
                                        </div>
                                        <div className="text-xl font-bold text-white/70">
                                            ≈ {(points || 0) * exchangeRate} <span className="text-xs">ريال سعودي</span>
                                        </div>

                                        <div className="mt-8 w-full space-y-3">
                                            <button
                                                onClick={handleRedeemRequest}
                                                disabled={redeeming || (points || 0) < minRedemption}
                                                className={`w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 ${(points || 0) >= minRedemption
                                                    ? 'bg-gradient-to-r from-emerald-600 to-green-500 text-white shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95'
                                                    : 'bg-white/5 text-white/70 cursor-not-allowed border border-white/5'
                                                    }`}
                                            >
                                                {redeeming ? <AdoraLoaderInline size={20} /> : <DollarSign className="w-5 h-5" />}
                                                ترحيل النقاط للصرف
                                            </button>

                                            {(points || 0) < minRedemption && (
                                                <p className="text-xs text-white/70 font-bold">
                                                    * تحتاج إلى {minRedemption - (points || 0)} نقطة إضافية للتمكن من السحب
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Lifetime Stats */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="glass-dark p-5 rounded-3xl border border-white/5">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                                    <Trophy className="w-4 h-4 text-orange-400" />
                                                </div>
                                                <span className="text-xs font-black text-white/70 uppercase tracking-wider">الإجمالي التاريخي</span>
                                            </div>
                                            <div className="text-2xl font-black text-white">{lifetimePoints}</div>
                                        </div>
                                        <div className="glass-dark p-5 rounded-3xl border border-white/5">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                                    <Star className="w-4 h-4 text-indigo-400" />
                                                </div>
                                                <span className="text-xs font-black text-white/70 uppercase tracking-wider">مستوى الأداء</span>
                                            </div>
                                            <div className={`text-sm font-black ${getLifetimeBadge(lifetimePoints).color}`}>
                                                {getLifetimeBadge(lifetimePoints).icon} {getLifetimeBadge(lifetimePoints).label}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Payout History */}
                                    <div className="space-y-3 pt-2">
                                        <h4 className="text-xs font-black text-white/70 uppercase tracking-[0.2em] px-2 flex items-center justify-between">
                                            <span>أحدث طلبات الصرف</span>
                                            <span className="text-indigo-400 lowercase">Last 3 only</span>
                                        </h4>
                                        {payoutHistory.slice(0, 3).length === 0 ? (
                                            <div className="p-8 text-center bg-white/[0.02] border border-white/5 border-dashed rounded-3xl">
                                                <p className="text-xs text-white/70 font-bold">لم تطلب صرف أي مكافآت بعد</p>
                                            </div>
                                        ) : (
                                            payoutHistory.slice(0, 3).map((req) => (
                                                <div key={req.id} className="glass-dark p-4 rounded-3xl border border-white/5 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                                                            req.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                                            }`}>
                                                            {req.status === 'pending' ? <Clock className="w-5 h-5" /> :
                                                                req.status === 'approved' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-white">{req.pointsAmount} نقطة</p>
                                                            <p className="text-xs font-bold text-white/70 uppercase tracking-wider">{formatDate(req.createdAt)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-left">
                                                        <div className={`text-xs font-black px-3 py-1 rounded-full ${req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                                                            req.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                                            }`}>
                                                            {req.status === 'pending' ? 'قيد المراجعة ⌛' : req.status === 'approved' ? 'تم الدفع ✅' : 'مرفوض ❌'}
                                                        </div>
                                                        <p className="text-xs font-bold text-white/70 mt-1 capitalize">{req.monetaryValue} SAR</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Leaderboard Modal */}
            {showLeaderboardModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn" style={{ backdropFilter: 'none' }}>
                    <div className="glass-card w-full max-w-lg max-h-[85vh] flex flex-col rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                                    <Trophy className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-xl font-black text-white">قاعة المشاهير</h3>
                            </div>
                            <button onClick={() => setShowLeaderboardModal(false)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                            {leaderboard.map((entry) => {
                                const isCurrentUser = entry.id === employeeId;
                                return (
                                    <div
                                        key={entry.id}
                                        className={`flex items-center gap-4 p-4 rounded-3xl transition-all ${isCurrentUser
                                            ? 'bg-yellow-500/10 border border-yellow-500/20'
                                            : 'bg-white/[0.02] border border-white/5'
                                            }`}
                                    >
                                        <div className="w-8 h-8 flex items-center justify-center">
                                            {getRankIcon(entry.rank)}
                                        </div>
                                        <div className="flex-1">
                                            <p className={`font-bold ${isCurrentUser ? 'text-yellow-400' : 'text-white'}`}>
                                                {entry.name}
                                            </p>
                                            <p className="text-xs text-white/70 uppercase font-black">{entry.department}</p>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xl font-black text-white">{entry.points}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PointsTracker;
