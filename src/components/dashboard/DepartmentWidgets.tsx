/**
 * Department Stats Widget
 * Reusable animated stats for department dashboards
 * Adora Hotel Management System V2
 */

import React, { useEffect, useState } from 'react';
import { LucideIcon } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

export interface DeptStatItem {
    label: string;
    value: number;
    icon: LucideIcon;
    color: string;
    bgGradient: string;
    suffix?: string;
}

interface DepartmentStatsProps {
    stats: DeptStatItem[];
    animate?: boolean;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const DepartmentStats: React.FC<DepartmentStatsProps> = ({
    stats,
    animate = true,
}) => {
    const [animatedValues, setAnimatedValues] = useState<number[]>(
        stats.map(() => 0)
    );

    useEffect(() => {
        if (!animate) {
            setAnimatedValues(stats.map(s => s.value));
            return;
        }

        const duration = 1000;
        const startTime = Date.now();
        const targetValues = stats.map(s => s.value);

        const animationFrame = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);

            setAnimatedValues(targetValues.map(target => Math.round(target * easeOut)));

            if (progress < 1) {
                requestAnimationFrame(animationFrame);
            }
        };

        requestAnimationFrame(animationFrame);
    }, [stats, animate]);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                    <div
                        key={index}
                        className={`
                            relative overflow-hidden rounded-2xl p-5
                            bg-gradient-to-br ${stat.bgGradient}
                            border border-slate-200 dark:border-white/10 shadow-lg
                            transform transition-all duration-300 hover:scale-105
                        `}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: `${stat.color}30` }}
                            >
                                <Icon className="w-6 h-6" style={{ color: stat.color }} />
                            </div>
                            <span className="text-sm" style={{ color: `${stat.color}CC` }}>
                                {stat.label}
                            </span>
                        </div>
                        <p className="text-4xl font-bold text-white">
                            {animatedValues[index]}
                            {stat.suffix && <span className="text-xl text-white/50 ml-1">{stat.suffix}</span>}
                        </p>
                        {/* Glow effect */}
                        <div
                            className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl"
                            style={{ backgroundColor: `${stat.color}20` }}
                        />
                    </div>
                );
            })}
        </div>
    );
};

// ============================================================
// QUICK ACTIONS BAR
// ============================================================

export interface QuickAction {
    id: string;
    label: string;
    icon: LucideIcon;
    color: string;
    onClick: () => void;
    badge?: number;
    disabled?: boolean;
}

interface QuickActionsBarProps {
    actions: QuickAction[];
    title?: string;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
    actions,
    title = 'إجراءات سريعة',
}) => {
    return (
        <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4 border border-slate-200 dark:border-white/10 shadow-md">
            <h3 className="text-sm text-white/60 mb-4 flex items-center gap-2">
                ⚡ {title}
            </h3>
            <div className="flex flex-wrap gap-3">
                {actions.map(action => {
                    const Icon = action.icon;
                    return (
                        <button
                            key={action.id}
                            onClick={action.onClick}
                            disabled={action.disabled}
                            className={`
                                relative flex items-center gap-2 px-4 py-3 rounded-xl
                                transition-all duration-300
                                ${action.disabled
                                    ? 'opacity-50 cursor-not-allowed bg-white/5'
                                    : 'hover:scale-105 active:scale-95'
                                }
                            `}
                            style={{
                                background: action.disabled ? undefined : `linear-gradient(135deg, ${action.color}20, ${action.color}10)`,
                                border: `1px solid ${action.color}30`,
                            }}
                        >
                            <Icon className="w-5 h-5" style={{ color: action.color }} />
                            <span className="text-sm font-medium text-white/80">{action.label}</span>
                            {action.badge && action.badge > 0 && (
                                <span
                                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white"
                                    style={{ backgroundColor: action.color }}
                                >
                                    {action.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================================
// TASK PROGRESS TRACKER
// ============================================================

interface TaskProgressProps {
    completed: number;
    total: number;
    label: string;
    color?: string;
}

export const TaskProgress: React.FC<TaskProgressProps> = ({
    completed,
    total,
    label,
    color = '#10B981',
}) => {
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const [animatedPercentage, setAnimatedPercentage] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setAnimatedPercentage(percentage), 100);
        return () => clearTimeout(timer);
    }, [percentage]);

    return (
        <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-md">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{label}</h3>
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold" style={{ color }}>
                        {completed}
                    </span>
                    <span className="text-white/50">/ {total}</span>
                </div>
            </div>

            <div className="h-4 bg-white/5 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                    style={{
                        width: `${animatedPercentage}%`,
                        background: `linear-gradient(90deg, ${color}80, ${color})`,
                        boxShadow: `0 0 20px ${color}40`,
                    }}
                >
                    <div
                        className="absolute inset-0 bg-white/20"
                        style={{ animation: 'shimmer 2s infinite' }}
                    />
                </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-white/50">التقدم</span>
                <span style={{ color }}>{animatedPercentage}%</span>
            </div>

            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};

// ============================================================
// FILTER TABS
// ============================================================

export interface FilterTab {
    id: string;
    label: string;
    count?: number;
    icon?: LucideIcon;
}

interface FilterTabsProps {
    tabs: FilterTab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
    tabs,
    activeTab,
    onTabChange,
}) => {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {tabs.map(tab => {
                const isActive = tab.id === activeTab;
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
                            flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap
                            transition-all duration-300
                            ${isActive
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                                : 'bg-white/5 text-white/70 hover:bg-white/10'
                            }
                        `}
                    >
                        {Icon && <Icon className="w-4 h-4" />}
                        <span>{tab.label}</span>
                        {tab.count !== undefined && (
                            <span className={`
                                px-2 py-0.5 rounded-full text-xs font-bold
                                ${isActive ? 'bg-white/20' : 'bg-white/10'}
                            `}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default {
    DepartmentStats,
    QuickActionsBar,
    TaskProgress,
    FilterTabs,
};
