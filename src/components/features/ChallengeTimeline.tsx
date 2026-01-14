/**
 * Challenge Timeline Component
 * تايم لاين الالتزام - مستوحى من H Rewards
 * تصميم أفقي مع دوائر المراحل والأقفال
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
            setLoading(false);
            return;
        }

        try {
            const config = await getChallengeConfig(tenantId);
            if (config?.milestones) {
                setMilestones(config.milestones);
            }

            const userData = user as any;
            if (userData.challengeProgress) {
                setProgress(userData.challengeProgress);
            }

            const result = await checkDailyAttendance(tenantId, user.id);

            if (result.success && result.unlocked) {
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
            setLoading(false);
        }
    };

    const currentStreak = progress?.currentStreak || 0;
    const today = new Date();
    const currentMonth = today.toLocaleDateString('ar-EG', { month: 'long' });
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - today.getDate();

    // تحديد حالة كل مرحلة
    const getMilestoneStatus = (milestone: ChallengeMilestone) => {
        const claimedMilestones = progress?.claimedMilestones || [];
        if (claimedMilestones.includes(milestone.day)) return 'claimed';
        if (currentStreak >= milestone.day) return 'unlocked';
        return 'locked';
    };

    return (
        <>
        {/* ✅ تصميم موحد مع الكروت الإحصائية - Adora Style */}
        <div 
            className="group relative overflow-hidden rounded-lg sm:rounded-xl bg-gradient-to-br from-teal-100 to-teal-50 dark:from-teal-500/10 dark:to-teal-500/5 border border-teal-200/50 dark:border-teal-500/20 backdrop-blur-sm shadow-sm hover:shadow-lg hover:shadow-teal-100 dark:hover:shadow-teal-500/10 hover:scale-[1.01] transition-all duration-300 cursor-pointer p-2 sm:p-3"
            onClick={() => setShowHistory(true)}
        >
            {/* Shine effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </div>

            <div className="relative">
                {/* الهيدر */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-teal-200 dark:bg-teal-500/15 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">تحدي الالتزام</div>
                            <div className="text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-400">{currentMonth}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">{daysRemaining}d</div>
                        <div className="text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-400">متبقي</div>
                    </div>
                </div>

                {/* التايم لاين - البيانات بين الأقفال */}
                <div className="flex items-center" ref={scrollRef}>
                    {milestones.slice(0, 5).map((milestone, index) => {
                        const status = getMilestoneStatus(milestone);
                        const isLast = index === Math.min(4, milestones.length - 1);
                        
                        return (
                            <React.Fragment key={milestone.day}>
                                {/* القفل بحد تركواز */}
                                <div className={`
                                    w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all
                                    ${status === 'claimed' 
                                        ? 'bg-amber-500 border-amber-400 shadow-sm shadow-amber-300' 
                                        : status === 'unlocked'
                                            ? 'bg-amber-400 border-amber-300 shadow-sm shadow-amber-200 animate-pulse'
                                            : 'bg-teal-100 dark:bg-teal-900/30 border-teal-400 dark:border-teal-500'
                                    }
                                `}>
                                    {status === 'claimed' ? (
                                        <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                                    ) : status === 'unlocked' ? (
                                        <Gift className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                                    ) : (
                                        <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-teal-600 dark:text-teal-400" />
                                    )}
                                </div>
                                
                                {/* البيانات بين الأقفال */}
                                {!isLast && (
                                    <div className="flex-1 flex flex-col items-center px-0.5 sm:px-1">
                                        <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {milestone.day}d
                                        </span>
                                        <div className={`w-full h-0.5 rounded-full my-0.5 ${
                                            status === 'claimed' ? 'bg-amber-400' : 'bg-teal-200 dark:bg-teal-700'
                                        }`} />
                                        <span className={`text-[10px] sm:text-xs font-bold ${
                                            status === 'claimed' ? 'text-amber-600 dark:text-amber-400' : 'text-teal-600 dark:text-teal-400'
                                        }`}>
                                            {milestone.rewardPoints}
                                        </span>
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* الفوتر */}
                <div className="mt-2 pt-2 border-t border-teal-200 dark:border-teal-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                        <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">{currentStreak} يوم متتالي</span>
                    </div>
                    <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 group-hover:text-teal-600 transition-colors">التفاصيل ←</span>
                </div>
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
                                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">سجل الـ 30 يوماً الماضية</p>
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
                        <div className="p-6">
                            {/* Month Header */}
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-bold text-white/80">
                                    {new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
                                </h4>
                                <span className="text-xs text-white/50">
                                    من 1 إلى {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}
                                </span>
                            </div>

                            {/* Days Grid - Dynamic based on current month */}
                            <div className="grid grid-cols-7 gap-1.5 mb-6">
                                {/* Day names header */}
                                {['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'].map((dayName, i) => (
                                    <div key={`header-${i}`} className="text-center text-[9px] font-bold text-white/40 py-1">
                                        {dayName}
                                    </div>
                                ))}
                                
                                {(() => {
                                    const today = new Date();
                                    const year = today.getFullYear();
                                    const month = today.getMonth();
                                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                                    const firstDayOfMonth = new Date(year, month, 1).getDay();
                                    
                                    // Create array for empty cells + actual days
                                    const cells = [];
                                    
                                    // Add empty cells for days before the 1st
                                    for (let i = 0; i < firstDayOfMonth; i++) {
                                        cells.push(
                                            <div key={`empty-${i}`} className="aspect-square" />
                                        );
                                    }
                                    
                                    // Add actual days of the month
                                    for (let day = 1; day <= daysInMonth; day++) {
                                        const targetDate = new Date(year, month, day);
                                        const dateStr = targetDate.toISOString().split('T')[0];
                                        const isToday = day === today.getDate();
                                        const isPast = day < today.getDate();
                                        const isFuture = day > today.getDate();
                                        
                                        // Find history item
                                        const historyItem = progress?.attendanceHistory?.find(h => h.date === dateStr);
                                        const attended = historyItem?.attended || false;
                                        const isException = historyItem?.isException || false;
                                        
                                        // Day name for tooltip
                                        const dayName = targetDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
                                        
                                        cells.push(
                                            <div key={day} className="flex flex-col items-center group/day relative">
                                                <div
                                                    className={`
                                                        w-full aspect-square rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer
                                                        ${attended
                                                            ? 'bg-emerald-500/20 border-2 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                                            : isException
                                                                ? 'bg-blue-500/15 border border-blue-500/30'
                                                                : isPast
                                                                    ? 'bg-red-500/10 border border-red-500/20'
                                                                    : isToday
                                                                        ? 'bg-primary-500/30 border-2 border-primary-500 shadow-[0_0_15px_rgba(20,184,166,0.3)] animate-pulse'
                                                                        : 'bg-white/5 border border-white/10'
                                                        }
                                                    `}
                                                >
                                                    {/* Day Number */}
                                                    <span className={`text-sm font-black ${
                                                        attended ? 'text-emerald-400' : 
                                                        isException ? 'text-blue-400' : 
                                                        isPast ? 'text-red-400/70' : 
                                                        isToday ? 'text-primary-400' : 
                                                        'text-white/30'
                                                    }`}>
                                                        {day}
                                                    </span>
                                                    
                                                    {/* Status Icon */}
                                                    {attended && <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5" />}
                                                    {isException && <Calendar className="w-2.5 h-2.5 text-blue-400 mt-0.5" />}
                                                    {isPast && !attended && !isException && <Lock className="w-2.5 h-2.5 text-red-400/50 mt-0.5" />}
                                                </div>
                                                
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-2 hidden group-hover/day:block z-50 pointer-events-none">
                                                    <div className="bg-slate-900 border border-white/20 px-3 py-2 rounded-xl text-[11px] text-white whitespace-nowrap shadow-xl">
                                                        <div className="font-bold">{dayName}</div>
                                                        <div className={`text-[10px] mt-1 ${
                                                            attended ? 'text-emerald-400' : 
                                                            isException ? 'text-blue-400' : 
                                                            isPast ? 'text-red-400' : 
                                                            'text-white/50'
                                                        }`}>
                                                            {attended ? '✓ حاضر' : isException ? '📅 إجازة معتمدة' : isPast ? '✗ غياب' : isFuture ? '⏳ قادم' : '🎯 اليوم'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    
                                    return cells;
                                })()}
                            </div>

                            {/* Legend & Stats */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                                <div className="flex flex-wrap gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50" />
                                        <span className="text-[10px] font-bold text-white/70">حضور</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30" />
                                        <span className="text-[10px] font-bold text-white/70">إجازة</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-red-500/10 border border-red-500/20" />
                                        <span className="text-[10px] font-bold text-white/70">غياب</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-white/5 border border-white/10" />
                                        <span className="text-[10px] font-bold text-white/70">قادم</span>
                                    </div>
                                </div>
                                <div className="bg-primary-500/10 px-3 py-1.5 rounded-lg border border-primary-500/20">
                                    <span className="text-[11px] font-black text-primary-400">🔥 سلسلة الالتزام: {currentStreak} يوم</span>
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
                            <p className="text-white/70 text-[11px] font-bold mb-6 leading-relaxed">
                                سجلت حضورك لـ {currentStreak} أيام متتالية وتستحق المكافأة
                            </p>
                            <div className="bg-primary-500/10 rounded-2xl p-6 mb-8 border border-primary-500/20 shadow-inner group-hover:scale-105 transition-transform">
                                <span className="text-4xl font-black text-emerald-400 tabular-nums">+{showCelebration.rewardPoints}</span>
                                <p className="text-[9px] text-emerald-400/60 font-black uppercase tracking-widest mt-1">نقطة مضافة لمحفظتك</p>
                            </div>
                            <button
                                onClick={() => setShowCelebration(null)}
                                className="w-full py-4 bg-primary-500 hover:bg-teal-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
                            >
                                استمرار في النجاح 🚀
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default ChallengeTimeline;
