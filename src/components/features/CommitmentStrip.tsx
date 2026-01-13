/**
 * Commitment Strip - شريط الالتزام المصغر
 * شريط متغير الألوان يظهر في الهيدر بجانب الكأس
 * الألوان: أحمر → برتقالي → أصفر → أخضر فاتح → أخضر غامق
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CheckCircle2, Lock, X, Flame } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { checkDailyAttendance, getChallengeConfig } from '../../services/challengeService';
import { UserChallengeProgress, ChallengeMilestone } from '../../types';

export const CommitmentStrip: React.FC = () => {
    const { user } = useAuth();
    const { tenantId } = useTenant();

    const [progress, setProgress] = useState<UserChallengeProgress | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [milestones, setMilestones] = useState<ChallengeMilestone[]>([]);

    useEffect(() => {
        if (user?.id && tenantId) {
            loadData();
        }
    }, [user?.id, tenantId]);

    const loadData = async () => {
        if (!tenantId || !user?.id) return;

        try {
            const config = await getChallengeConfig(tenantId);
            if (config?.milestones) {
                setMilestones(config.milestones);
            }

            const userData = user as any;
            if (userData.challengeProgress) {
                setProgress(userData.challengeProgress);
            }

            // Perform daily check
            await checkDailyAttendance(tenantId, user.id);
        } catch (error) {
            console.error('Error loading commitment data:', error);
        }
    };

    const currentStreak = progress?.currentStreak || 0;
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    const progressPercent = Math.min((currentDay / daysInMonth) * 100, 100);

    // ✅ حساب اللون المتدرج حسب التقدم في الشهر والالتزام
    const getGradientColor = () => {
        const streakPercent = (currentStreak / daysInMonth) * 100;
        
        if (streakPercent < 20) {
            // أحمر - بداية ضعيفة
            return { from: '#ef4444', to: '#dc2626', text: '#fecaca' };
        } else if (streakPercent < 40) {
            // برتقالي - تقدم بطيء
            return { from: '#f97316', to: '#ea580c', text: '#fed7aa' };
        } else if (streakPercent < 60) {
            // أصفر - في المنتصف
            return { from: '#eab308', to: '#ca8a04', text: '#fef3c7' };
        } else if (streakPercent < 80) {
            // أخضر فاتح - تقدم جيد
            return { from: '#22c55e', to: '#16a34a', text: '#bbf7d0' };
        } else {
            // أخضر غامق - ممتاز
            return { from: '#059669', to: '#047857', text: '#a7f3d0' };
        }
    };

    const colors = getGradientColor();

    return (
        <>
            {/* الشريط الصغير - قابل للضغط */}
            <button
                onClick={() => setShowDetails(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:scale-105 active:scale-95 group"
                style={{
                    background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)`,
                    boxShadow: `0 2px 10px ${colors.from}40`
                }}
                title="شريط الالتزام - اضغط للتفاصيل"
            >
                {/* أيقونة النار إذا كان الالتزام جيد */}
                {currentStreak >= 3 && (
                    <Flame className="w-3.5 h-3.5 text-white animate-pulse" />
                )}
                
                {/* رقم الالتزام */}
                <span className="text-white font-black text-sm tabular-nums">
                    {currentStreak}
                </span>
                
                {/* خط فاصل */}
                <div className="w-px h-4 bg-white/30" />
                
                {/* اليوم الحالي من الشهر */}
                <span className="text-white/80 text-[10px] font-bold">
                    {currentDay}/{daysInMonth}
                </span>
            </button>

            {/* نافذة التفاصيل */}
            {showDetails && createPortal(
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 animate-fadeIn"
                    style={{ zIndex: 99999 }}
                    onClick={() => setShowDetails(false)}
                >
                    <div
                        className="glass-dark w-full max-w-[400px] rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-scaleIn"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div 
                            className="p-6 flex items-center justify-between"
                            style={{ background: `linear-gradient(135deg, ${colors.from}20 0%, ${colors.to}20 100%)` }}
                        >
                            <div className="flex items-center gap-3">
                                <div 
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                    style={{ 
                                        background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)`,
                                        boxShadow: `0 4px 15px ${colors.from}40`
                                    }}
                                >
                                    <span className="text-white font-black text-xl">{currentStreak}</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white">سجل الالتزام</h3>
                                    <p className="text-xs text-white/60">
                                        {new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDetails(false)}
                                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                            >
                                <X className="w-4 h-4 text-white/70" />
                            </button>
                        </div>

                        {/* Calendar Grid */}
                        <div className="p-5">
                            {/* أسماء الأيام */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'].map((day, i) => (
                                    <div key={i} className="text-center text-[9px] font-bold text-white/40 py-1">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* أيام الشهر */}
                            <div className="grid grid-cols-7 gap-1">
                                {(() => {
                                    const year = today.getFullYear();
                                    const month = today.getMonth();
                                    const firstDay = new Date(year, month, 1).getDay();
                                    const cells = [];

                                    // خلايا فارغة
                                    for (let i = 0; i < firstDay; i++) {
                                        cells.push(<div key={`empty-${i}`} className="aspect-square" />);
                                    }

                                    // أيام الشهر
                                    for (let day = 1; day <= daysInMonth; day++) {
                                        const targetDate = new Date(year, month, day);
                                        const dateStr = targetDate.toISOString().split('T')[0];
                                        const isToday = day === currentDay;
                                        const isPast = day < currentDay;

                                        const historyItem = progress?.attendanceHistory?.find(h => h.date === dateStr);
                                        const attended = historyItem?.attended || false;
                                        const isException = historyItem?.isException || false;

                                        cells.push(
                                            <div
                                                key={day}
                                                className={`
                                                    aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all
                                                    ${attended
                                                        ? 'bg-emerald-500/30 border border-emerald-500/50 text-emerald-400'
                                                        : isException
                                                            ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                                                            : isPast
                                                                ? 'bg-red-500/10 border border-red-500/20 text-red-400/60'
                                                                : isToday
                                                                    ? 'bg-primary-500/30 border-2 border-primary-500 text-primary-400 animate-pulse'
                                                                    : 'bg-white/5 border border-white/10 text-white/30'
                                                    }
                                                `}
                                                title={targetDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            >
                                                {day}
                                            </div>
                                        );
                                    }

                                    return cells;
                                })()}
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="px-5 pb-5">
                            <div className="flex flex-wrap gap-3 justify-center">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50" />
                                    <span className="text-[10px] text-white/60">حضور</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30" />
                                    <span className="text-[10px] text-white/60">إجازة</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded bg-red-500/10 border border-red-500/20" />
                                    <span className="text-[10px] text-white/60">غياب</span>
                                </div>
                            </div>
                        </div>

                        {/* Stats Footer */}
                        <div 
                            className="p-4 border-t border-white/10 flex items-center justify-between"
                            style={{ background: `linear-gradient(135deg, ${colors.from}10 0%, ${colors.to}10 100%)` }}
                        >
                            <div className="text-center">
                                <div className="text-lg font-black text-white">{currentStreak}</div>
                                <div className="text-[9px] text-white/50">يوم متتالي</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-black text-white">{currentDay}</div>
                                <div className="text-[9px] text-white/50">يوم من الشهر</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-black text-white">{daysInMonth - currentDay}</div>
                                <div className="text-[9px] text-white/50">يوم متبقي</div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default CommitmentStrip;
