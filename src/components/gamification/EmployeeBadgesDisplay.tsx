import React, { useState, useEffect, useMemo } from 'react';
import {
    Award, Star, Zap, Crown, Medal, Trophy, ThumbsUp, Heart,
    Shield, Flag, Eye, Timer, Wrench, Clock, TrendingUp, Sparkles,
    ChevronRight, Lock, CheckCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { Achievement, EmployeeAchievement } from '../../types';

const ICONS: Record<string, React.FC<{ className?: string }>> = {
    Award, Star, Zap, Crown, Medal, Trophy, ThumbsUp, Heart,
    Shield, Flag, Eye, Timer, Wrench, Clock
};

interface EmployeeBadgesDisplayProps {
    employeeId?: string;
    compact?: boolean;
    showProgress?: boolean;
}

export const EmployeeBadgesDisplay: React.FC<EmployeeBadgesDisplayProps> = ({
    employeeId,
    compact = false,
    showProgress = true
}) => {
    const { user } = useAuth();
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [earnedAchievements, setEarnedAchievements] = useState<EmployeeAchievement[]>([]);
    const [employeePoints, setEmployeePoints] = useState(0);
    const [loading, setLoading] = useState(true);

    const targetEmployeeId = employeeId || user?.id;
    const tenantId = user?.tenantId || (user?.role === 'owner' ? user.id : null);

    // Fetch available achievements
    useEffect(() => {
        if (!tenantId) return;

        const q = query(
            collection(db, `tenants/${tenantId}/achievements`),
            where('active', '==', true),
            orderBy('requirement.value', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Achievement));
            setAchievements(data);
        });

        return () => unsubscribe();
    }, [tenantId]);

    // Fetch employee's earned achievements
    useEffect(() => {
        if (!tenantId || !targetEmployeeId) return;

        const q = query(
            collection(db, `tenants/${tenantId}/employeeAchievements`),
            where('employeeId', '==', targetEmployeeId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as EmployeeAchievement));
            setEarnedAchievements(data);
        });

        return () => unsubscribe();
    }, [tenantId, targetEmployeeId]);

    // Fetch employee's current points
    useEffect(() => {
        if (!tenantId || !targetEmployeeId) return;

        const fetchPoints = async () => {
            try {
                const userDoc = await getDocs(
                    query(
                        collection(db, `tenants/${tenantId}/users`),
                        where('id', '==', targetEmployeeId)
                    )
                );
                if (!userDoc.empty) {
                    const userData = userDoc.docs[0].data();
                    setEmployeePoints(userData.totalPoints || 0);
                }
            } catch (error) {
                console.error('Error fetching employee points:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPoints();

        // Also listen for real-time updates
        const unsubscribe = onSnapshot(
            query(collection(db, `tenants/${tenantId}/users`), where('id', '==', targetEmployeeId)),
            (snapshot) => {
                if (!snapshot.empty) {
                    const userData = snapshot.docs[0].data();
                    setEmployeePoints(userData.totalPoints || 0);
                }
            }
        );

        return () => unsubscribe();
    }, [tenantId, targetEmployeeId]);

    // Calculate current rank and progress
    const rankInfo = useMemo(() => {
        const sortedAchievements = [...achievements]
            .filter(a => a.category === 'rank' && a.requirement?.value > 0)
            .sort((a, b) => (a.requirement?.value || 0) - (b.requirement?.value || 0));

        let currentRank: Achievement | null = null;
        let nextRank: Achievement | null = null;

        for (let i = 0; i < sortedAchievements.length; i++) {
            const ach = sortedAchievements[i];
            const threshold = ach.requirement?.value || 0;

            if (employeePoints >= threshold) {
                currentRank = ach;
            } else if (!nextRank) {
                nextRank = ach;
                break;
            }
        }

        // Calculate progress to next rank
        let progressPercent = 0;
        let pointsToNext = 0;

        if (nextRank) {
            const currentThreshold = currentRank?.requirement?.value || 0;
            const nextThreshold = nextRank.requirement?.value || 0;
            const range = nextThreshold - currentThreshold;
            const progress = employeePoints - currentThreshold;
            progressPercent = Math.min(100, Math.round((progress / range) * 100));
            pointsToNext = nextThreshold - employeePoints;
        } else if (currentRank) {
            progressPercent = 100; // Max rank achieved
        }

        return { currentRank, nextRank, progressPercent, pointsToNext };
    }, [achievements, employeePoints]);

    const earnedIds = useMemo(() => {
        return new Set(earnedAchievements.map(ea => ea.achievementId));
    }, [earnedAchievements]);

    const renderIcon = (iconName: string, className: string) => {
        const IconComponent = ICONS[iconName] || Award;
        return <IconComponent className={className} />;
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-24 bg-white/5 rounded-2xl" />
                <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-16 bg-white/5 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (compact) {
        return (
            <div className="flex items-center gap-3">
                {rankInfo.currentRank ? (
                    <div 
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${(rankInfo.currentRank as any).bgColor || 'bg-yellow-500/20'}`}
                    >
                        {renderIcon(rankInfo.currentRank.icon || 'Award', `w-4 h-4 ${(rankInfo.currentRank as any).color || 'text-yellow-400'}`)}
                        <span className={`text-sm font-bold ${(rankInfo.currentRank as any).color || 'text-yellow-400'}`}>
                            {rankInfo.currentRank.name}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5">
                        <Star className="w-4 h-4 text-white/40" />
                        <span className="text-sm text-white/40">مبتدئ</span>
                    </div>
                )}
                <div className="flex items-center gap-1 text-yellow-500 font-mono text-sm">
                    <Zap className="w-4 h-4" />
                    <span className="font-bold">{employeePoints.toLocaleString()}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Current Rank Card */}
            <div className="solid-modal rounded-2xl p-6 relative overflow-hidden"
                style={{ 
                    background: 'var(--theme-bg-secondary)', 
                    border: '1px solid var(--theme-border-primary)' 
                }}
            >
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20"
                    style={{ 
                        background: rankInfo.currentRank 
                            ? `var(--theme-primary-400, #2dd4bf)` 
                            : 'var(--theme-text-tertiary)' 
                    }}
                />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                            🏆 رتبتك الحالية
                        </h3>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'var(--theme-bg-tertiary)' }}
                        >
                            <Zap className="w-4 h-4 text-yellow-500" />
                            <span className="font-bold font-mono text-yellow-500">
                                {employeePoints.toLocaleString()}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>نقطة</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {rankInfo.currentRank ? (
                            <>
                                <div 
                                    className={`w-20 h-20 rounded-2xl flex items-center justify-center ${(rankInfo.currentRank as any).bgColor || 'bg-yellow-500/20'}`}
                                >
                                    {renderIcon(
                                        rankInfo.currentRank.icon || 'Award',
                                        `w-10 h-10 ${(rankInfo.currentRank as any).color || 'text-yellow-400'}`
                                    )}
                                </div>
                                <div>
                                    <h4 className={`text-2xl font-black ${(rankInfo.currentRank as any).color || 'text-yellow-400'}`}>
                                        {rankInfo.currentRank.name}
                                    </h4>
                                    <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                        {rankInfo.currentRank.description}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center">
                                    <Star className="w-10 h-10 text-white/20" />
                                </div>
                                <div>
                                    <h4 className="text-2xl font-black" style={{ color: 'var(--theme-text-secondary)' }}>
                                        مبتدئ
                                    </h4>
                                    <p className="text-sm" style={{ color: 'var(--theme-text-tertiary)' }}>
                                        اجمع المزيد من النقاط للترقية!
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Progress to Next Rank */}
                    {showProgress && rankInfo.nextRank && (
                        <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--theme-border-primary)' }}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-teal-400" />
                                    <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                        الرتبة التالية:
                                    </span>
                                    <span className={`font-bold ${(rankInfo.nextRank as any).color || 'text-yellow-400'}`}>
                                        {rankInfo.nextRank.name}
                                    </span>
                                </div>
                                <span className="text-xs font-mono" style={{ color: 'var(--theme-text-tertiary)' }}>
                                    {rankInfo.pointsToNext.toLocaleString()} نقطة متبقية
                                </span>
                            </div>
                            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                <div 
                                    className="h-full rounded-full transition-all duration-500 relative overflow-hidden"
                                    style={{ 
                                        width: `${rankInfo.progressPercent}%`,
                                        background: 'linear-gradient(90deg, #14b8a6, #06b6d4)'
                                    }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                                </div>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-[10px]" style={{ color: 'var(--theme-text-tertiary)' }}>
                                    {rankInfo.currentRank?.requirement?.value || 0}
                                </span>
                                <span className="text-[10px] font-bold" style={{ color: 'var(--theme-text-tertiary)' }}>
                                    {rankInfo.progressPercent}%
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--theme-text-tertiary)' }}>
                                    {rankInfo.nextRank.requirement?.value || 0}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Max Rank Achieved */}
                    {!rankInfo.nextRank && rankInfo.currentRank && (
                        <div className="mt-6 pt-4 flex items-center gap-3" 
                            style={{ borderTop: '1px solid var(--theme-border-primary)' }}
                        >
                            <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
                            <span className="text-sm font-bold text-yellow-400">
                                🎉 مبروك! لقد وصلت لأعلى رتبة!
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* All Ranks Grid */}
            <div className="solid-modal rounded-2xl p-6"
                style={{ 
                    background: 'var(--theme-bg-secondary)', 
                    border: '1px solid var(--theme-border-primary)' 
                }}
            >
                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--theme-text-primary)' }}>
                    📊 سلم الترقيات
                </h3>

                <div className="space-y-3">
                    {achievements
                        .filter(a => a.category === 'rank' && a.requirement?.value > 0)
                        .sort((a, b) => (a.requirement?.value || 0) - (b.requirement?.value || 0))
                        .map((ach, index) => {
                            const isEarned = employeePoints >= (ach.requirement?.value || 0);
                            const isCurrent = rankInfo.currentRank?.id === ach.id;

                            return (
                                <div 
                                    key={ach.id}
                                    className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                                        isCurrent 
                                            ? 'ring-2 ring-teal-400/50' 
                                            : ''
                                    }`}
                                    style={{ 
                                        background: isEarned 
                                            ? 'var(--theme-bg-tertiary)' 
                                            : 'transparent',
                                        opacity: isEarned ? 1 : 0.5,
                                        border: `1px solid ${isEarned ? 'var(--theme-border-primary)' : 'transparent'}`
                                    }}
                                >
                                    {/* Rank Number */}
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                                        style={{ 
                                            background: isEarned ? 'var(--theme-primary-400, #2dd4bf)' : 'var(--theme-bg-tertiary)',
                                            color: isEarned ? 'white' : 'var(--theme-text-tertiary)'
                                        }}
                                    >
                                        {index + 1}
                                    </div>

                                    {/* Icon */}
                                    <div 
                                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                            isEarned ? (ach as any).bgColor || 'bg-yellow-500/20' : 'bg-white/5'
                                        }`}
                                    >
                                        {isEarned ? (
                                            renderIcon(
                                                ach.icon || 'Award',
                                                `w-6 h-6 ${(ach as any).color || 'text-yellow-400'}`
                                            )
                                        ) : (
                                            <Lock className="w-5 h-5 text-white/20" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className={`font-bold ${
                                                isEarned 
                                                    ? (ach as any).color || 'text-yellow-400'
                                                    : ''
                                            }`}
                                                style={{ color: isEarned ? undefined : 'var(--theme-text-tertiary)' }}
                                            >
                                                {ach.name}
                                            </h4>
                                            {isCurrent && (
                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-500/20 text-teal-400 rounded-full">
                                                    رتبتك الحالية
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                            {ach.description || `الوصول إلى ${ach.requirement?.value} نقطة`}
                                        </p>
                                    </div>

                                    {/* Points Required */}
                                    <div className="text-left">
                                        <div className="flex items-center gap-1 font-mono text-sm">
                                            <Zap className={`w-4 h-4 ${isEarned ? 'text-yellow-500' : 'text-white/20'}`} />
                                            <span className={isEarned ? 'text-yellow-500 font-bold' : ''}
                                                style={{ color: isEarned ? undefined : 'var(--theme-text-tertiary)' }}
                                            >
                                                {(ach.requirement?.value || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        {isEarned && (
                                            <div className="flex items-center gap-1 text-[10px] text-green-400 mt-0.5">
                                                <CheckCircle className="w-3 h-3" />
                                                <span>محقق</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                    {achievements.filter(a => a.category === 'rank').length === 0 && (
                        <div className="py-8 text-center" style={{ color: 'var(--theme-text-tertiary)' }}>
                            <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>لم يتم إعداد نظام الرتب بعد</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Earned Badges Section */}
            {earnedAchievements.length > 0 && (
                <div className="solid-modal rounded-2xl p-6"
                    style={{ 
                        background: 'var(--theme-bg-secondary)', 
                        border: '1px solid var(--theme-border-primary)' 
                    }}
                >
                    <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--theme-text-primary)' }}>
                        🎖️ إنجازاتك ({earnedAchievements.length})
                    </h3>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {earnedAchievements.map((ea) => {
                            const achievement = achievements.find(a => a.id === ea.achievementId);
                            if (!achievement) return null;

                            return (
                                <div 
                                    key={ea.id}
                                    className="flex flex-col items-center p-3 rounded-xl transition-all hover:scale-105"
                                    style={{ background: 'var(--theme-bg-tertiary)' }}
                                    title={`${achievement.name}\n${achievement.description}`}
                                >
                                    <div 
                                        className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${
                                            (achievement as any).bgColor || 'bg-yellow-500/20'
                                        }`}
                                    >
                                        {renderIcon(
                                            achievement.icon || 'Award',
                                            `w-6 h-6 ${(achievement as any).color || 'text-yellow-400'}`
                                        )}
                                    </div>
                                    <span className="text-[10px] font-medium text-center truncate w-full"
                                        style={{ color: 'var(--theme-text-secondary)' }}
                                    >
                                        {achievement.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeBadgesDisplay;
