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
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();
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
        if (lp >= 5000) return { label: t('pointsTracker.lifetimeBadges.legend'), icon: '👑', color: 'text-indigo-400' };
        if (lp >= 2000) return { label: t('pointsTracker.lifetimeBadges.goldenStar'), icon: '⭐', color: 'text-yellow-400' };
        if (lp >= 500) return { label: t('pointsTracker.lifetimeBadges.distinguished'), icon: '🚀', color: 'text-blue-400' };
        return { label: t('pointsTracker.lifetimeBadges.ambitious'), icon: '🌱', color: 'text-green-400' };
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
                alert(res.error || t('pointsTracker.redeemFailed'));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setRedeeming(false);
        }
    };

    // Animation Classes
    const pulseStyle = isPulsing ? 'animate-bounce scale-110' : '';

    // ✅ FIX: Check feature status for inline mode too
    // Inline version
    if (inline) {
        // ✅ If feature disabled, show disabled state
        if (featureDisabled) {
            return (
                <div className="flex items-center gap-2 relative opacity-50 cursor-not-allowed" title={t('pointsTracker.pointsSystemDisabled')}>
                    <Trophy className="w-5 h-5 text-white/50" />
                    <span className="font-black text-white/50 text-sm tracking-tighter">-</span>
                </div>
            );
        }
        
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
                                        <span className="text-sm font-bold text-white/80">{t('pointsTracker.point')}</span>
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
                    aria-label={t('pointsTracker.pointsHistory')}
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
                    <div 
                        className="fixed inset-0 flex items-center justify-center p-4 animate-fadeIn" 
                        style={{ 
                            backdropFilter: 'blur(8px) saturate(180%)',
                            backgroundColor: 'rgba(0, 0, 0, 0.4)',
                            zIndex: 9999 
                        }}
                        onClick={() => setShowHistoryModal(false)}
                    >
                        <div 
                            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl"
                            style={{
                                background: 'rgba(255, 255, 255, 0.95)',
                                backdropFilter: 'blur(20px) saturate(180%)',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header - Premium Glassmorphism */}
                            <div 
                                className="px-6 py-5 flex items-center justify-between relative overflow-hidden"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 193, 7, 0.05) 100%)',
                                    borderBottom: '1px solid rgba(255, 215, 0, 0.2)'
                                }}
                            >
                                {/* Decorative gradient overlay */}
                                <div 
                                    className="absolute inset-0 opacity-10"
                                    style={{
                                        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)'
                                    }}
                                />
                                <div className="flex items-center gap-4 relative z-10">
                                    <div 
                                        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                                        style={{
                                            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                                            boxShadow: '0 8px 24px rgba(255, 215, 0, 0.4)'
                                        }}
                                    >
                                        <Trophy className="w-7 h-7 text-white drop-shadow-md" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                                            {t('pointsTracker.pointsHistory')}
                                        </h3>
                                        <p className="text-sm mt-0.5" style={{ color: 'var(--theme-text-tertiary)' }}>
                                            {t('pointsTracker.transparencyHistoryDescription')}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowHistoryModal(false)}
                                    className="w-11 h-11 rounded-xl flex items-center justify-center transition-all relative z-10 hover:scale-110 active:scale-95"
                                    style={{ 
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: '#ef4444'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                    }}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* ✅ إجمالي النقاط الكبير - ديناميكي حسب التبويب - Premium Design */}
                            {(() => {
                                // حساب القيم الديناميكية حسب التبويب المختار
                                const displayConfig = {
                                    all: {
                                        icon: '🏆',
                                        title: t('pointsTracker.totalPoints'),
                                        value: points ?? 0,
                                        subtitle: t('pointsTracker.pointsAvailable'),
                                        gradient: 'linear-gradient(135deg, #20B2AA 0%, #14B8A6 50%, #0D9488 100%)',
                                        glow: 'rgba(20, 178, 170, 0.3)',
                                        count: history.length
                                    },
                                    performance: {
                                        icon: '⚡',
                                        title: t('pointsTracker.performancePoints'),
                                        value: categoryStats.performance.total,
                                        subtitle: t('pointsTracker.fromOperations', { count: categoryStats.performance.count }),
                                        gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
                                        glow: 'rgba(59, 130, 246, 0.3)',
                                        count: categoryStats.performance.count
                                    },
                                    attendance: {
                                        icon: '📅',
                                        title: t('pointsTracker.attendancePoints'),
                                        value: categoryStats.attendance.total,
                                        subtitle: t('pointsTracker.fromOperations', { count: categoryStats.attendance.count }),
                                        gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
                                        glow: 'rgba(34, 197, 94, 0.3)',
                                        count: categoryStats.attendance.count
                                    },
                                    achievements: {
                                        icon: '🏅',
                                        title: t('pointsTracker.achievementPoints'),
                                        value: categoryStats.achievements.total,
                                        subtitle: t('pointsTracker.fromAchievements', { count: categoryStats.achievements.count }),
                                        gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
                                        glow: 'rgba(255, 215, 0, 0.4)',
                                        count: categoryStats.achievements.count
                                    }
                                };
                                const config = displayConfig[activityFilter];
                                
                                return (
                                    <div 
                                        className="relative px-8 py-8 text-center transition-all duration-500 overflow-hidden"
                                        style={{ 
                                            background: config.gradient,
                                            boxShadow: `0 10px 40px ${config.glow}`
                                        }}
                                    >
                                        {/* Animated background pattern */}
                                        <div 
                                            className="absolute inset-0 opacity-10"
                                            style={{
                                                backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.2) 0%, transparent 50%)'
                                            }}
                                        />
                                        <div className="relative z-10">
                                            <div className="flex items-center justify-center gap-3 mb-3">
                                                <span className="text-4xl drop-shadow-lg filter">{config.icon}</span>
                                                <span className="text-white/95 text-base font-bold drop-shadow-md">{config.title}</span>
                                            </div>
                                            <div className={`text-6xl font-black text-white mb-2 drop-shadow-lg ${config.value < 0 ? 'text-red-200' : ''}`}>
                                                {config.value > 0 && activityFilter !== 'all' ? '+' : ''}{config.value}
                                            </div>
                                            <div className="text-white/80 text-sm font-medium drop-shadow-sm">{config.subtitle}</div>
                                            {activityFilter === 'all' && (
                                                <div className="mt-4 pt-4 border-t border-white/20 flex justify-center gap-8">
                                                    <div className="text-center">
                                                        <div className="text-xl font-bold text-white drop-shadow-md">{lifetimePoints}</div>
                                                        <div className="text-xs text-white/70 mt-1">{t('pointsTracker.historicalTotal')}</div>
                                                    </div>
                                                    <div className="w-px h-12 bg-white/20" />
                                                    <div className="text-center">
                                                        <div className="text-xl font-bold text-white drop-shadow-md">{history.length}</div>
                                                        <div className="text-xs text-white/70 mt-1">{t('pointsTracker.operationsCount')}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* ✅ تبويبات تصنيف النقاط - Premium Design */}
                            <div 
                                className="px-6 py-4" 
                                style={{ 
                                    background: 'rgba(248, 250, 252, 0.8)',
                                    borderBottom: '1px solid rgba(226, 232, 240, 0.5)'
                                }}
                            >
                                <div className="flex gap-2 p-1.5 rounded-2xl" style={{ background: 'rgba(241, 245, 249, 0.8)' }}>
                                    <button
                                        onClick={() => setActivityFilter('all')}
                                        className={`flex-1 py-2.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            activityFilter === 'all' 
                                                ? 'bg-white dark:bg-slate-700 shadow-sm adora-text-primary' 
                                                : 'adora-text-tertiary hover:adora-text-primary'
                                        }`}
                                    >
                                        <span>📊</span>
                                        <span>{t('pointsTracker.all')}</span>
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
                                        <span className="hidden sm:inline">{t('pointsTracker.performance')}</span>
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
                                        <span className="hidden sm:inline">{t('pointsTracker.achievements')}</span>
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
                                                ? t('pointsTracker.noHistoryYet')
                                                : t('pointsTracker.noPointsFromCategory', {
                                                    category: activityFilter === 'performance' ? t('pointsTracker.performance') :
                                                    activityFilter === 'attendance' ? t('pointsTracker.attendance') : t('pointsTracker.achievements')
                                                })
                                            }
                                        </p>
                                        <p className="text-xs adora-text-tertiary mt-1">{t('pointsTracker.startCompletingTasks')}</p>
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
                                                    <p className="text-xs adora-text-tertiary">{t('pointsTracker.point')}</p>
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

    // ✅ FIX: Check feature status for full card version too
    // Full card version
    if (featureDisabled) {
        return (
            <div className="glass-card p-5 relative overflow-hidden group opacity-50">
                <div className="flex items-center justify-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gray-500/10 flex items-center justify-center">
                        <Trophy className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">{t('pointsTracker.pointsSystemDisabled')}</h3>
                        <p className="text-sm text-white/40">{t('common.disabled') || t('pointsConfiguration.disabled')}</p>
                    </div>
                </div>
            </div>
        );
    }
    
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
                            <h3 className="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">{t('pointsTracker.royalBalance')}</h3>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-white">{points ?? 0}</span>
                                <span className="text-xs font-bold text-white/70">{t('pointsTracker.point')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {showLeaderboard && (
                            <button
                                onClick={handleShowLeaderboard}
                                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all"
                                title={t('pointsTracker.leaderboard')}
                            >
                                <Users className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            onClick={handleShowHistory}
                            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                            title={t('pointsTracker.transparencyHistory')}
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
                            <span className="text-xs font-bold text-white/70">{t('common.team')} {teamName}</span>
                        </div>
                        <span className="text-blue-400 font-black text-sm">{teamPoints}</span>
                    </div>
                )}
            </div>

            {/* Transparency Modal (History) */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 animate-fadeIn" style={{ backdropFilter: 'none', zIndex: 9999 }}>
                    <div className="glass-card w-full max-w-xl max-h-[85vh] flex flex-col rounded-[2.5rem] border border-slate-300 dark:border-white/10 overflow-hidden shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-500/5 to-transparent">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                                    <History className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-tight">{t('pointsTracker.transparencyHistory')}</h3>
                                    <p className="text-xs text-white/70">{t('pointsTracker.transparencyHistoryDescription')}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-white/70 hover:text-white hover:bg-red-500/20 transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex bg-slate-100 dark:bg-white/5 mx-6 p-1 rounded-2xl border border-slate-300 dark:border-white/5">
                            <button
                                onClick={() => setActiveTab('activity')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'activity' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-600 dark:text-white/70 hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                <Zap className="w-4 h-4" />
                                {t('pointsTracker.myActivity')}
                            </button>
                            <button
                                onClick={() => setActiveTab('wallet')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'wallet' ? 'bg-primary-500 text-white shadow-lg shadow-emerald-500/20' : 'text-white/70 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <DollarSign className="w-4 h-4" />
                                {t('pointsTracker.myWallet')}
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
                                                    : 'bg-slate-100 dark:bg-white/5 border border-transparent hover:bg-slate-200 dark:hover:bg-white/10'
                                            }`}
                                        >
                                            <div className="text-lg">📊</div>
                                            <span className="text-[10px] font-bold text-white/70">{t('pointsTracker.all')}</span>
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
                                            <span className="text-[10px] font-bold text-blue-400">{t('pointsTracker.performance')}</span>
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
                                            <span className="text-[10px] font-bold text-green-400">{t('pointsTracker.attendance')}</span>
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
                                            <span className="text-[10px] font-bold text-yellow-400">{t('pointsTracker.achievements')}</span>
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
                                                    ? t('pointsTracker.noHistoryYet')
                                                    : t('pointsTracker.noPointsFromCategory', {
                                                        category: activityFilter === 'performance' ? t('pointsTracker.performance') :
                                                        activityFilter === 'attendance' ? t('pointsTracker.attendance') : t('pointsTracker.achievements')
                                                    })
                                                }
                                            </p>
                                            <p className="text-xs text-white/40 mt-2">{t('pointsTracker.startCompletingTasks')}</p>
                                        </div>
                                    ) : (
                                        filteredHistory.map((item) => {
                                        const isPositive = item.points > 0;
                                        const isNeutral = item.points === 0;

                                        return (
                                            <div key={item.id} className="relative group">
                                                <div className={`absolute inset-0 bg-gradient-to-r ${isPositive ? 'from-green-500/5' : isNeutral ? 'from-gray-500/5' : 'from-red-500/5'} to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                                                <div className="relative p-5 glass-dark rounded-3xl border border-slate-300 dark:border-white/5 transition-all duration-300 hover:border-slate-400 dark:hover:border-white/10">
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
                                                            <p className="text-xs text-white/70 font-bold">{t('pointsTracker.point')}</p>
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
                                                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/70 cursor-not-allowed border border-slate-300 dark:border-white/5'
                                                    }`}
                                            >
                                                {redeeming ? <AdoraLoaderInline size={20} /> : <DollarSign className="w-5 h-5" />}
                                                {t('pointsTracker.transferPointsForRedemption')}
                                            </button>

                                            {(points || 0) < minRedemption && (
                                                <p className="text-xs text-white/70 font-bold">
                                                    {t('pointsTracker.needMorePoints', { count: minRedemption - (points || 0) })}
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
                                                <span className="text-xs font-black text-white/70 uppercase tracking-wider">{t('pointsTracker.historicalTotal')}</span>
                                            </div>
                                            <div className="text-2xl font-black text-white">{lifetimePoints}</div>
                                        </div>
                                        <div className="glass-dark p-5 rounded-3xl border border-white/5">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                                    <Star className="w-4 h-4 text-indigo-400" />
                                                </div>
                                                <span className="text-xs font-black text-white/70 uppercase tracking-wider">{t('pointsTracker.performanceLevel')}</span>
                                            </div>
                                            <div className={`text-sm font-black ${getLifetimeBadge(lifetimePoints).color}`}>
                                                {getLifetimeBadge(lifetimePoints).icon} {getLifetimeBadge(lifetimePoints).label}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Payout History */}
                                    <div className="space-y-3 pt-2">
                                        <h4 className="text-xs font-black text-white/70 uppercase tracking-[0.2em] px-2 flex items-center justify-between">
                                            <span>{t('pointsTracker.redemptionRequests')}</span>
                                            <span className="text-indigo-400 lowercase">Last 3 only</span>
                                        </h4>
                                        {payoutHistory.slice(0, 3).length === 0 ? (
                                            <div className="p-8 text-center bg-white/[0.02] border border-white/5 border-dashed rounded-3xl">
                                                <p className="text-xs text-white/70 font-bold">{t('pointsTracker.noRedemptionRequestsYet')}</p>
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
                                                            <p className="text-sm font-bold text-white">{t('pointsTracker.pointsAmount', { points: req.pointsAmount })}</p>
                                                            <p className="text-xs font-bold text-white/70 uppercase tracking-wider">{formatDate(req.createdAt)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-left">
                                                        <div className={`text-xs font-black px-3 py-1 rounded-full ${req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                                                            req.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                                            }`}>
                                                            {req.status === 'pending' ? t('pointsTracker.pendingReview') : req.status === 'approved' ? t('pointsTracker.paid') : t('pointsTracker.rejected')}
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
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 animate-fadeIn" style={{ backdropFilter: 'none', zIndex: 9999 }}>
                    <div className="glass-card w-full max-w-lg max-h-[85vh] flex flex-col rounded-[2.5rem] border border-slate-300 dark:border-white/10 overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                                    <Trophy className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-xl font-black text-white">{t('pointsTracker.leaderboard')}</h3>
                            </div>
                            <button onClick={() => setShowLeaderboardModal(false)} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-white/70">
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
