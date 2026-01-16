/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * QuickActionsSection Component - Premium SaaS Design
 * World-class design for enterprise SaaS application
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Sparkles, Wrench, Bell, Coffee, Eye, AlertTriangle } from 'lucide-react';
import type { QuickAction } from '../../utils/quickActionsConfig';

interface QuickActionsSectionProps {
    quickActions: QuickAction[];
    onQuickAction: (type: string) => void;
}

// Premium color configurations for each action type
const actionConfigs: Record<string, {
    gradient: string;
    iconBg: string;
    iconColor: string;
    shadow: string;
    hoverShadow: string;
    border: string;
}> = {
    cleaning: {
        gradient: 'from-cyan-50 via-teal-50 to-emerald-50 dark:from-cyan-500/10 dark:via-teal-500/10 dark:to-emerald-500/10',
        iconBg: 'bg-gradient-to-br from-cyan-100 to-teal-100 dark:from-cyan-500/20 dark:to-teal-500/20',
        iconColor: 'text-cyan-600 dark:text-cyan-400',
        shadow: 'shadow-cyan-200/50 dark:shadow-cyan-500/20',
        hoverShadow: 'shadow-cyan-300/60 dark:shadow-cyan-500/30',
        border: 'border-cyan-200/50 dark:border-cyan-500/30'
    },
    maintenance: {
        gradient: 'from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-500/10 dark:via-indigo-500/10 dark:to-purple-500/10',
        iconBg: 'bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-500/20 dark:to-indigo-500/20',
        iconColor: 'text-blue-600 dark:text-blue-400',
        shadow: 'shadow-blue-200/50 dark:shadow-blue-500/20',
        hoverShadow: 'shadow-blue-300/60 dark:shadow-blue-500/30',
        border: 'border-blue-200/50 dark:border-blue-500/30'
    },
    bellman: {
        gradient: 'from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-500/10 dark:via-amber-500/10 dark:to-yellow-500/10',
        iconBg: 'bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-500/20 dark:to-amber-500/20',
        iconColor: 'text-orange-600 dark:text-orange-400',
        shadow: 'shadow-orange-200/50 dark:shadow-orange-500/20',
        hoverShadow: 'shadow-orange-300/60 dark:shadow-orange-500/30',
        border: 'border-orange-200/50 dark:border-orange-500/30'
    },
    coffee: {
        gradient: 'from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-500/10 dark:via-amber-500/10 dark:to-orange-500/10',
        iconBg: 'bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-500/20 dark:to-amber-500/20',
        iconColor: 'text-yellow-600 dark:text-yellow-500',
        shadow: 'shadow-yellow-200/50 dark:shadow-yellow-500/20',
        hoverShadow: 'shadow-yellow-300/60 dark:shadow-yellow-500/30',
        border: 'border-yellow-200/50 dark:border-yellow-500/30'
    },
    inspection: {
        gradient: 'from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-500/10 dark:via-green-500/10 dark:to-teal-500/10',
        iconBg: 'bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-500/20 dark:to-green-500/20',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        shadow: 'shadow-emerald-200/50 dark:shadow-emerald-500/20',
        hoverShadow: 'shadow-emerald-300/60 dark:shadow-emerald-500/30',
        border: 'border-emerald-200/50 dark:border-emerald-500/30'
    },
    other: {
        gradient: 'from-purple-50 via-pink-50 to-rose-50 dark:from-purple-500/10 dark:via-pink-500/10 dark:to-rose-500/10',
        iconBg: 'bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-500/20 dark:to-pink-500/20',
        iconColor: 'text-purple-600 dark:text-purple-400',
        shadow: 'shadow-purple-200/50 dark:shadow-purple-500/20',
        hoverShadow: 'shadow-purple-300/60 dark:shadow-purple-500/30',
        border: 'border-purple-200/50 dark:border-purple-500/30'
    }
};

export const QuickActionsSection: React.FC<QuickActionsSectionProps> = ({
    quickActions,
    onQuickAction
}) => {
    const { t } = useTranslation();

    return (
        <div className="mb-6 sm:mb-8 lg:mb-10" data-tour="quick-actions">
            {/* Premium Section Header */}
            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-xl blur-lg opacity-30 animate-pulse" />
                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
                        <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2.5} />
                    </div>
                </div>
                <div className="flex-1">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold adora-text-primary tracking-tight">
                        {t('reception.quickCreateTitle')}
                    </h2>
                    <p className="text-xs sm:text-sm adora-text-tertiary mt-0.5 hidden sm:block">
                        {t('reception.quickCreateDescription')}
                    </p>
                </div>
            </div>
            
            {/* Premium Action Cards Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                {quickActions.map((action) => {
                    const IconComponent = action.icon;
                    const config = actionConfigs[action.type] || actionConfigs.other;
                    
                    return (
                        <button
                            key={action.type}
                            onClick={() => onQuickAction(action.type)}
                            className={`
                                group relative
                                flex flex-col items-center justify-center
                                gap-3 sm:gap-4
                                p-4 sm:p-5 lg:p-6
                                rounded-2xl sm:rounded-3xl
                                bg-gradient-to-br ${config.gradient}
                                border ${config.border}
                                backdrop-blur-sm
                                transition-all duration-300 ease-out
                                hover:scale-[1.05] hover:-translate-y-1
                                active:scale-[0.98]
                                touch-manipulation
                                overflow-hidden
                                shadow-lg ${config.shadow}
                                hover:shadow-xl ${config.hoverShadow}
                                min-h-[120px] sm:min-h-[140px] lg:min-h-[160px]
                                min-w-[80px] sm:min-w-[100px] lg:min-w-[120px]
                            `}
                            style={{
                                // ✅ UX: Ensure touch targets are at least 44x44px (iOS/Android guidelines)
                                minHeight: '120px',
                                minWidth: '80px'
                            }}
                        >
                            {/* Premium Shine Effect */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                            </div>
                            
                            {/* Icon Container - Premium Design */}
                            <div className={`
                                relative z-10
                                w-14 h-14 sm:w-16 sm:h-16 lg:w-18 lg:h-18
                                rounded-2xl sm:rounded-3xl
                                ${config.iconBg}
                                flex items-center justify-center
                                transition-all duration-300
                                group-hover:scale-110 group-hover:rotate-3
                                shadow-md ${config.shadow}
                                group-hover:shadow-lg ${config.hoverShadow}
                            `}>
                                <IconComponent 
                                    className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 ${config.iconColor}`}
                                    strokeWidth={2}
                                />
                            </div>
                            
                            {/* Label - Premium Typography */}
                            <span className={`
                                relative z-10
                                text-xs sm:text-sm lg:text-base
                                font-bold
                                ${config.iconColor}
                                text-center
                                leading-tight
                                tracking-tight
                                transition-all duration-300
                                group-hover:scale-105
                            `}>
                                {action.label}
                            </span>
                            
                            {/* Subtle Glow on Hover */}
                            <div className={`
                                absolute inset-0 rounded-2xl sm:rounded-3xl
                                opacity-0 group-hover:opacity-100
                                transition-opacity duration-300
                                ${config.shadow}
                                blur-xl
                                -z-10
                            `} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
