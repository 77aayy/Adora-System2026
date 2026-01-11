/**
 * Challenge Timeline Component
 * Gamified attendance tracker inspired by H Rewards
 */

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Lock, Unlock, CheckCircle2, Trophy, Clock,
    Calendar, TrendingUp, ChevronLeft, ChevronRight,
    Star, Gift, Sparkles, Loader2, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { checkDailyAttendance, getChallengeConfig } from '../../services/challengeService';
import { soundManager } from '../../utils/soundManager';
import { UserChallengeProgress, ChallengeMilestone } from '../../types';
import confetti from 'canvas-confetti';

export const ChallengeTimeline: React.FC = () => {
    const { user } = useAuth();
    const { tenantId } = useTenant();

    // State
    const [progress, setProgress] = useState<UserChallengeProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCelebration, setShowCelebration] = useState<ChallengeMilestone | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [milestones, setMilestones] = useState<ChallengeMilestone[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (user?.id && tenantId) {
            handleAttendanceCheck();
        }
    }, [user?.id, tenantId]);

    const handleAttendanceCheck = async () => {
        if (!tenantId || !user?.id) {
            setLoading(false); // ✅ Stop loading if no user
            return;
        }

        try {
            // Initial load of config
            const config = await getChallengeConfig(tenantId);
            if (config?.milestones) {
                setMilestones(config.milestones);
            }

            // Initial load of current state
            const userData = user as any;
            if (userData.challengeProgress) {
                setProgress(userData.challengeProgress);
            }

            // Perform daily check
            const result = await checkDailyAttendance(tenantId, user.id);

            if (result.success && result.unlocked) {
                // Milestone Unlocked!
                soundManager.playUnlock();
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#F59E0B', '#10B981', '#3B82F6']
                });
                setShowCelebration(result.unlocked);
            }
        } catch (error) {
            console.error('Error in challenge attendance check:', error);
        } finally {
            // ✅ ALWAYS stop loading, even on error
            setLoading(false);
        }
    };

    const currentStreak = progress?.currentStreak || 0;

    // Helper to determine status of a day node
    const getStatus = (day: number) => {
        if (day <= currentStreak) return 'completed';
        const nextMilestone = milestones.find(m => m.day > currentStreak);
        if (nextMilestone && day === nextMilestone.day) return 'target';
        return 'locked';
    };

    // ✅ REMOVED: Loading state causes issues when Firestore rules block access
    // Component now renders immediately with available data

    return (
        <div className="animate-fadeIn relative group/timeline w-full">
            {/* Adora Sophisticated Micro-UI: Fully Fluid & Responsive (~56px Height) */}
            <div className="glass-dark rounded-xl border border-white/10 flex items-center h-14 px-2 sm:px-4 gap-2 sm:gap-4 overflow-hidden shadow-[0_4px_25px_rgba(0,0,0,0.4)] relative w-full">

                {/* 1. Branding & Next Goal (Clickable for History) */}
                <button
                    onClick={() => setShowHistory(true)}
                    className="flex-shrink-0 flex items-center gap-2 sm:gap-4 border-r border-white/5 pr-2 sm:pr-4 hover:bg-white/5 transition-colors cursor-pointer active:scale-95 group/branding text-right"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary-500/20 flex items-center justify-center border border-primary-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover/branding:border-primary-400">
                            <Trophy className="w-4.5 h-4.5 text-primary-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-white/90 leading-none tracking-tight">سجل</span>
                            <span className="text-[8px] font-bold text-primary-400/80 uppercase mt-1">الالتزام 📊</span>
                        </div>
                    </div>

                    {/* Next Reward Pill */}
                    <div className="hidden sm:flex items-center gap-2.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 shadow-inner group-hover/branding:border-white/10">
                        <Sparkles className="w-4 h-4 text-yellow-500 animate-pulse" />
                        <div className="flex flex-col items-start min-w-[80px]">
                            <span className="text-[8px] font-bold text-white/20 leading-none mb-1">الهدف القادم</span>
                            <div className="flex items-center gap-1">
                                <Gift className="w-3 h-3 text-yellow-500/80" />
                                <span className="text-[11px] font-black text-primary-400 leading-none">
                                    {(() => {
                                        const next = milestones.find(m => m.day > currentStreak);
                                        return next ? `يوم ${next.day}: ${next.rewardPoints} نقطة` : 'اكتمل!';
                                    })()}
                                </span>
                            </div>
                        </div>
                    </div>
                </button>

                {/* 2. Micro Progress Track */}
                <div ref={scrollRef} className="flex-1 min-w-0 h-full overflow-x-auto scrollbar-hide">
                    <div className="flex items-center gap-2 min-w-max h-full py-1 pr-2">
                        {Array.from({ length: 30 }).map((_, i) => {
                            const dayNum = i + 1;
                            const milestone = milestones.find(m => m.day === dayNum);
                            const status = getStatus(dayNum);
                            const isNext = dayNum === currentStreak + 1;

                            // MILESTONE: High Contrast Stretchy Tablet
                            if (milestone) {
                                return (
                                    <div key={dayNum} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                        <span className={`text-[9px] font-black uppercase tracking-tight ${status === 'completed' ? 'text-emerald-400' : 'text-white/40'}`}>
                                            يوم {dayNum}
                                        </span>
                                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all relative
                                        ${status === 'completed' ? 'bg-emerald-500/20 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-yellow-500/10 border-yellow-500/30'}
                                    `}>
                                            <div className="relative">
                                                <Gift className={`w-3.5 h-3.5 ${status === 'completed' ? 'text-emerald-400' : 'text-yellow-500'}`} />
                                                {status !== 'completed' && <Lock className="w-2 h-2 text-yellow-600 absolute -top-1 -right-1" />}
                                            </div>
                                            <span className={`text-[10px] font-black tracking-tight ${status === 'completed' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                                {milestone.rewardPoints}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }

                            // CURRENT TARGET: Focal Point
                            if (isNext) {
                                return (
                                    <div key={dayNum} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                        <span className="text-[10px] font-black text-primary-400 animate-pulse drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">هدفك 🎯</span>
                                        <div className="w-7 h-7 rounded-xl bg-primary-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.6)] animate-pulse border-2 border-white/30">
                                            <span className="text-white font-black text-[12px] tabular-nums">{dayNum}</span>
                                        </div>
                                    </div>
                                );
                            }

                            // NORMAL DAY: Mini Dot (Fluid)
                            return (
                                <div
                                    key={dayNum}
                                    className={`
                                        w-1.5 h-1.5 rounded-full transition-all mt-4 flex-shrink-0
                                        ${dayNum <= currentStreak ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-white/10'}
                                    `}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* 3. Timer */}
                <div className="flex-shrink-0 hidden sm:flex items-center gap-2 border-l border-white/5 pl-4 ml-2">
                    <Clock className="w-4 h-4 text-primary-400" />
                    <span className="text-[11px] font-black text-white/40 tabular-nums">
                        {31 - new Date().getDate()}d
                    </span>
                </div>
            </div>

            {/* Attendance History Modal (PORTAL ARCHITECTURE) */}
            {showHistory && createPortal(
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 animate-fadeIn"
                    style={{ backdropFilter: 'none', zIndex: 99999 }}
                    onClick={() => setShowHistory(false)}
                >
                    <div
                        className="glass-dark w-full max-w-[450px] rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-scaleIn"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/10 to-transparent">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary-500/20 flex items-center justify-center border border-primary-500/30">
                                    <Calendar className="w-6 h-6 text-primary-400" />
                                </div>
                                <div className="text-right">
                                    <h3 className="text-xl font-black text-white">شفافية الالتزام</h3>
                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">سجل الـ 30 يوماً الماضية</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowHistory(false)}
                                className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 hover:bg-red-500/30 transition-colors"
                                title="إغلاق"
                            >
                                <X className="w-5 h-5 text-red-500" />
                            </button>
                        </div>

                        {/* History Content */}
                        <div className="p-8">
                            <div className="grid grid-cols-7 gap-2 mb-8">
                                {Array.from({ length: 30 }).map((_, i) => {
                                    // ✅ FIX: Calculate actual date for last 30 days (not day of month)
                                    const today = new Date();
                                    const targetDate = new Date(today);
                                    targetDate.setDate(today.getDate() - (29 - i)); // Day 0 = 29 days ago, Day 29 = today
                                    const dateStr = targetDate.toISOString().split('T')[0];
                                    const isPast = targetDate < today;
                                    const isToday = targetDate.toISOString().split('T')[0] === today.toISOString().split('T')[0];
                                    
                                    // Find history item by actual date string
                                    const historyItem = progress?.attendanceHistory?.find(h => h.date === dateStr);
                                    
                                    const attended = historyItem ? historyItem.attended : false;
                                    const isException = historyItem?.isException;

                                    return (
                                        <div key={i} className="flex flex-col items-center gap-1.5">
                                            <div
                                                className={`w-full aspect-square rounded-lg border transition-all flex items-center justify-center relative group/day
                                                    ${attended
                                                        ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                                                        : isException
                                                            ? 'bg-white/10 border-white/20 shadow-inner'
                                                            : isPast
                                                                ? 'bg-red-500/10 border-red-500/30'
                                                                : 'bg-white/5 border-white/10'
                                                    }
                                                `}
                                            >
                                                {attended ? (
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                ) : isException ? (
                                                    <Calendar className="w-3 h-3 text-white/40" />
                                                ) : isPast ? (
                                                    <Lock className="w-2.5 h-2.5 text-red-500" />
                                                ) : null}

                                                {/* Tooltip on hover */}
                                                <div className="absolute bottom-full mb-2 hidden group-hover/day:block z-50">
                                                    <div className="bg-slate-900 border border-white/10 px-2 py-1 rounded text-[8px] text-white whitespace-nowrap">
                                                        {targetDate.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })} {attended ? '(حاضر)' : isException ? '(إجازة)' : isPast ? '(غياب)' : ''}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[8px] font-bold text-white/20 uppercase">
                                                {isToday ? 'اليوم' : targetDate.toLocaleDateString('ar-SA', { day: 'numeric' })}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Legend & Stats */}
                            <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-white/5">
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span className="text-[9px] font-black text-white/40 uppercase">حضور</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-sm bg-white/10 border border-white/20" />
                                        <span className="text-[9px] font-black text-white/40 uppercase">إجازة</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        <span className="text-[9px] font-black text-white/40 uppercase">غياب</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-primary-400 uppercase tracking-tighter italic">التزامك الحالي: {currentStreak} يوم</span>
                                </div>
                            </div>
                        </div>

                        {/* Motivation Footer */}
                        <div className="bg-white/5 p-6 text-center border-t border-white/5">
                            <p className="text-[10px] text-white/60 font-medium italic">
                                "الاستمرارية هي مفتاح الربح. لا تدع يوماً واحداً يكسر سلسلتك!"
                            </p>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Celebration Modal (PORTAL ARCHITECTURE) */}
            {showCelebration && createPortal(
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 animate-fadeIn"
                    style={{ backdropFilter: 'none', zIndex: 99999 }}
                >
                    <div className="glass-dark w-full max-w-[300px] rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(16,185,129,0.15)] text-center p-8 relative overflow-hidden group">
                        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-primary-500/10 blur-[100px] opacity-30 animate-pulse" />
                        <div className="relative">
                            <div className="w-14 h-18 bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl transform rotate-3 scale-110">
                                <span className="text-white font-black text-3xl italic">H</span>
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">إنجاز رائع! 🎉</h3>
                            <p className="text-white/40 text-[11px] font-bold mb-6 leading-relaxed">
                                سجلت حضورك لـ {currentStreak} أيام متتالية وتستحق المكافأة
                            </p>
                            <div className="bg-emerald-500/10 rounded-2xl p-6 mb-8 border border-emerald-500/20 shadow-inner group-hover:scale-105 transition-transform">
                                <span className="text-4xl font-black text-emerald-400 tabular-nums">+{showCelebration.rewardPoints}</span>
                                <p className="text-[9px] text-emerald-400/60 font-black uppercase tracking-widest mt-1">نقطة مضافة لمحفظتك</p>
                            </div>
                            <button
                                onClick={() => setShowCelebration(null)}
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
                            >
                                استمرار في النجاح 🚀
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ChallengeTimeline;
