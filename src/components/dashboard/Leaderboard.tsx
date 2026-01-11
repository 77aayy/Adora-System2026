/**
 * Leaderboard Component
 * Gamified employee ranking with animations
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { Crown, Medal, Star, TrendingUp, TrendingDown, Minus, Trophy, Flame, Zap } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

export interface LeaderboardEntry {
    id: string;
    name: string;
    department: string;
    points: number;
    avatar?: string;
    streak?: number;
    trend?: 'up' | 'down' | 'same';
    rank?: number;
}

interface LeaderboardProps {
    entries: LeaderboardEntry[];
    title?: string;
    maxEntries?: number;
    showStreak?: boolean;
    animate?: boolean;
}

// ============================================================
// DEPARTMENT CONFIG
// ============================================================

const DEPT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    reception: { label: 'استقبال', color: '#6366F1', icon: '📞' },
    bellman: { label: 'بيلمان', color: '#3B82F6', icon: '🛎️' },
    housekeeping: { label: 'هاوس كيبنج', color: '#10B981', icon: '✨' },
    maintenance: { label: 'صيانة', color: '#F59E0B', icon: '🔧' },
    manager: { label: 'إدارة', color: '#8B5CF6', icon: '👔' },
};

// ============================================================
// RANK MEDALS
// ============================================================

const getRankDisplay = (rank: number) => {
    switch (rank) {
        case 1:
            return {
                icon: <Crown className="w-6 h-6" />,
                color: 'from-yellow-400 to-yellow-600',
                glow: 'shadow-yellow-500/50',
                bg: 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10',
            };
        case 2:
            return {
                icon: <Medal className="w-5 h-5" />,
                color: 'from-slate-300 to-slate-400',
                glow: 'shadow-slate-400/30',
                bg: 'bg-gradient-to-r from-slate-400/20 to-slate-500/10',
            };
        case 3:
            return {
                icon: <Medal className="w-5 h-5" />,
                color: 'from-amber-600 to-amber-700',
                glow: 'shadow-amber-600/30',
                bg: 'bg-gradient-to-r from-amber-600/20 to-amber-700/10',
            };
        default:
            return {
                icon: <span className="text-sm font-bold text-white/60">{rank}</span>,
                color: 'from-white/20 to-white/10',
                glow: '',
                bg: 'bg-white/5',
            };
    }
};

// ============================================================
// LEADERBOARD ENTRY COMPONENT
// ============================================================

const LeaderboardItem: React.FC<{
    entry: LeaderboardEntry;
    rank: number;
    showStreak: boolean;
    animate: boolean;
    index: number;
}> = ({ entry, rank, showStreak, animate, index }) => {
    const [isVisible, setIsVisible] = useState(!animate);
    const rankDisplay = getRankDisplay(rank);
    const deptConfig = DEPT_CONFIG[entry.department] || { label: entry.department, color: '#6B7280', icon: '👤' };

    useEffect(() => {
        if (animate) {
            const timer = setTimeout(() => setIsVisible(true), index * 100);
            return () => clearTimeout(timer);
        }
    }, [animate, index]);

    const getTrendIcon = () => {
        switch (entry.trend) {
            case 'up':
                return <TrendingUp className="w-4 h-4 text-emerald-400" />;
            case 'down':
                return <TrendingDown className="w-4 h-4 text-red-400" />;
            default:
                return <Minus className="w-4 h-4 text-white/30" />;
        }
    };

    return (
        <div
            className={`
                relative overflow-hidden rounded-xl transition-all duration-500
                ${rankDisplay.bg}
                ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
                ${rank <= 3 ? 'border border-white/10' : ''}
                hover:scale-[1.02] hover:bg-white/10
            `}
            style={{ transitionDelay: `${index * 50}ms` }}
        >
            <div className="flex items-center gap-4 p-4">
                {/* Rank Badge */}
                <div
                    className={`
                        w-10 h-10 rounded-xl flex items-center justify-center
                        bg-gradient-to-br ${rankDisplay.color}
                        ${rank <= 3 ? `shadow-lg ${rankDisplay.glow}` : ''}
                    `}
                >
                    {rankDisplay.icon}
                </div>

                {/* Avatar */}
                <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{
                        background: `linear-gradient(135deg, ${deptConfig.color}40, ${deptConfig.color}20)`,
                        border: `2px solid ${deptConfig.color}60`,
                    }}
                >
                    {entry.avatar || entry.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-white truncate">{entry.name}</span>
                        {rank === 1 && (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                الأول
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/50">
                        <span>{deptConfig.icon}</span>
                        <span>{deptConfig.label}</span>
                    </div>
                </div>

                {/* Streak */}
                {showStreak && entry.streak && entry.streak > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 rounded-lg">
                        <Flame className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-bold text-orange-400">{entry.streak}</span>
                    </div>
                )}

                {/* Points */}
                <div className="text-right">
                    <div className="text-xl font-bold text-white flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        {entry.points.toLocaleString('ar-SA')}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-white/40">
                        نقطة
                        {getTrendIcon()}
                    </div>
                </div>
            </div>

            {/* Progress bar for top 3 */}
            {rank <= 3 && (
                <div
                    className="absolute bottom-0 left-0 h-1 rounded-full"
                    style={{
                        width: `${(entry.points / (entry.points + 50)) * 100}%`,
                        background: `linear-gradient(90deg, ${deptConfig.color}80, ${deptConfig.color})`,
                    }}
                />
            )}
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const Leaderboard: React.FC<LeaderboardProps> = ({
    entries,
    title = '🏆 المتصدرون',
    maxEntries = 10,
    showStreak = true,
    animate = true,
}) => {
    const sortedEntries = [...entries]
        .sort((a, b) => b.points - a.points)
        .slice(0, maxEntries);

    const totalPoints = entries.reduce((sum, e) => sum + e.points, 0);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-lg">
            {/* Header */}
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-lg shadow-yellow-500/30">
                            <Trophy className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">{title}</h3>
                            <p className="text-sm text-white/50">
                                {entries.length} موظف • {totalPoints.toLocaleString('ar-SA')} نقطة إجمالي
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-white/70">اليوم</span>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                {sortedEntries.map((entry, index) => (
                    <LeaderboardItem
                        key={entry.id}
                        entry={entry}
                        rank={index + 1}
                        showStreak={showStreak}
                        animate={animate}
                        index={index}
                    />
                ))}
            </div>

            {/* Footer */}
            {entries.length > maxEntries && (
                <div className="p-4 border-t border-white/5 text-center">
                    <span className="text-sm text-white/40">
                        و {entries.length - maxEntries} موظف آخر
                    </span>
                </div>
            )}

            {/* Styles */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255,255,255,0.05);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.2);
                }
            `}</style>
        </div>
    );
};

export default Leaderboard;
