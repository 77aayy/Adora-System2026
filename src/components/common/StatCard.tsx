/**
 * StatCard - Mobile-First Premium Status Card
 * Redesigned for elegance and space efficiency
 * Adora Hotel Management System V3
 * 
 * ✅ MOBILE FIRST - Small by default, grows on larger screens
 * ✅ Glass gradient effect
 * ✅ Subtle hover animations
 * ✅ Dark mode optimized
 * ✅ Fully responsive - shrinks with screen
 */

import React, { memo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

// Icon color variants
type IconColorVariant = 'teal' | 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'yellow' | 'pink';

interface StatCardProps {
    count?: number;
    value?: number | string;
    label: string | React.ReactNode;
    icon: React.ReactNode | React.ComponentType<any>;
    bgColor?: string;
    color?: string;
    iconColor?: IconColorVariant;
    lastUpdate?: string;
    trend?: string;
    status?: 'normal' | 'warning' | 'success' | 'error';
    compact?: boolean; // New: even more compact mode
    pulse?: boolean; // ✅ Premium heartbeat animation
    urgency?: 'low' | 'medium' | 'high' | 'critical'; // ✅ Visual urgency indicator
}

// Gradient configurations for glass effect - ✅ Enhanced for Light Mode contrast
const gradientConfigs: Record<IconColorVariant, { gradient: string; border: string; shadow: string; iconBg: string }> = {
    teal: { 
        gradient: 'from-teal-100 to-teal-50 dark:from-teal-500/10 dark:to-teal-500/5',
        border: 'border-teal-300 dark:border-teal-500/20',
        shadow: 'shadow-teal-200 dark:shadow-teal-500/10',
        iconBg: 'bg-teal-200 dark:bg-teal-500/15'
    },
    blue: { 
        gradient: 'from-blue-100 to-blue-50 dark:from-blue-500/10 dark:to-blue-500/5',
        border: 'border-blue-300 dark:border-blue-500/20',
        shadow: 'shadow-blue-200 dark:shadow-blue-500/10',
        iconBg: 'bg-blue-200 dark:bg-blue-500/15'
    },
    green: { 
        gradient: 'from-green-100 to-green-50 dark:from-green-500/10 dark:to-green-500/5',
        border: 'border-green-300 dark:border-green-500/20',
        shadow: 'shadow-green-200 dark:shadow-green-500/10',
        iconBg: 'bg-green-200 dark:bg-green-500/15'
    },
    orange: { 
        gradient: 'from-orange-100 to-orange-50 dark:from-orange-500/10 dark:to-orange-500/5',
        border: 'border-orange-300 dark:border-orange-500/20',
        shadow: 'shadow-orange-200 dark:shadow-orange-500/10',
        iconBg: 'bg-orange-200 dark:bg-orange-500/15'
    },
    red: { 
        gradient: 'from-red-100 to-red-50 dark:from-red-500/10 dark:to-red-500/5',
        border: 'border-red-300 dark:border-red-500/20',
        shadow: 'shadow-red-200 dark:shadow-red-500/10',
        iconBg: 'bg-red-200 dark:bg-red-500/15'
    },
    purple: { 
        gradient: 'from-purple-100 to-purple-50 dark:from-purple-500/10 dark:to-purple-500/5',
        border: 'border-purple-300 dark:border-purple-500/20',
        shadow: 'shadow-purple-200 dark:shadow-purple-500/10',
        iconBg: 'bg-purple-200 dark:bg-purple-500/15'
    },
    yellow: { 
        gradient: 'from-yellow-100 to-yellow-50 dark:from-yellow-500/10 dark:to-yellow-500/5',
        border: 'border-yellow-300 dark:border-yellow-500/20',
        shadow: 'shadow-yellow-200 dark:shadow-yellow-500/10',
        iconBg: 'bg-yellow-200 dark:bg-yellow-500/15'
    },
    pink: { 
        gradient: 'from-pink-100 to-pink-50 dark:from-pink-500/10 dark:to-pink-500/5',
        border: 'border-pink-300 dark:border-pink-500/20',
        shadow: 'shadow-pink-200 dark:shadow-pink-500/10',
        iconBg: 'bg-pink-200 dark:bg-pink-500/15'
    },
};

// Icon text colors - ✅ Enhanced for Light Mode contrast
const iconTextColors: Record<IconColorVariant, string> = {
    teal: 'text-teal-600 dark:text-teal-400',
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    orange: 'text-orange-600 dark:text-orange-400',
    red: 'text-red-600 dark:text-red-400',
    purple: 'text-purple-600 dark:text-purple-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    pink: 'text-pink-600 dark:text-pink-400',
};

export const StatCard: React.FC<StatCardProps> = ({ 
    count, 
    value,
    label, 
    icon, 
    iconColor = 'teal',
    lastUpdate,
    trend,
    status = 'normal',
    compact = false,
    pulse = false,
    urgency
}) => {
    const displayValue = count !== undefined ? count : (value !== undefined ? value : 0);
    const isStringValue = typeof displayValue === 'string';
    
    const config = gradientConfigs[iconColor];
    const textColor = iconTextColors[iconColor];
    
    // Status override for icon color - ✅ Enhanced for Light Mode
    const effectiveTextColor = status === 'success' ? 'text-green-600 dark:text-green-400' :
                               status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                               status === 'error' ? 'text-red-600 dark:text-red-400' :
                               textColor;
    
    // ✅ Urgency-based pulse colors (premium visual feedback)
    const urgencyConfig = {
        low: { ring: 'ring-green-500/30', pulse: 'animate-pulse-slow' },
        medium: { ring: 'ring-yellow-500/40', pulse: 'animate-pulse' },
        high: { ring: 'ring-orange-500/50', pulse: 'animate-pulse-fast' },
        critical: { ring: 'ring-red-500/60', pulse: 'animate-heartbeat' }
    };
    const urgencyStyle = urgency ? urgencyConfig[urgency] : null;
    
    // Handle icon rendering
    let iconElement: React.ReactNode = null;
    if (icon) {
        if (React.isValidElement(icon)) {
            iconElement = React.cloneElement(icon as React.ReactElement<any>, {
                className: compact ? 'w-4 h-4' : 'w-5 h-5'
            });
        } else if (typeof icon === 'function' || typeof icon === 'object') {
            const IconComponent = icon as React.ComponentType<{ className?: string }>;
            iconElement = <IconComponent className={compact ? 'w-4 h-4' : 'w-5 h-5'} />;
        }
    }

    // Parse trend
    const isPositiveTrend = trend?.startsWith('+');
    const hasTrend = trend && trend.replace(/[+%]/g, '');
    
    return (
        <div 
            className={`
                group relative overflow-hidden 
                rounded-md sm:rounded-lg lg:rounded-xl
                bg-gradient-to-br ${config.gradient}
                border ${config.border}
                backdrop-blur-sm
                shadow-sm ${config.shadow}
                transition-all duration-300 ease-out
                hover:scale-[1.02] hover:shadow-lg dark:hover:shadow-lg
                p-1.5 sm:p-2.5 lg:p-3
                ${compact ? 'min-w-0' : ''}
                ${pulse || urgencyStyle ? 'ring-2 ' + (urgencyStyle?.ring || 'ring-teal-500/30') : ''}
                ${urgencyStyle?.pulse || (pulse ? 'animate-pulse-subtle' : '')}
            `}
        >
            {/* Subtle shine effect on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </div>
            
            <div className="relative flex items-center gap-1.5 sm:gap-2 lg:gap-3">
                {/* Icon - Super compact on mobile, grows on larger screens */}
                {iconElement && (
                    <div className={`
                        w-6 h-6 sm:w-7 sm:h-7 lg:w-9 lg:h-9
                        rounded sm:rounded-md lg:rounded-lg ${config.iconBg}
                        flex items-center justify-center flex-shrink-0
                        transition-transform duration-300 group-hover:scale-110
                    `}>
                        <span className={`${effectiveTextColor} [&>svg]:w-3 [&>svg]:h-3 sm:[&>svg]:w-3.5 sm:[&>svg]:h-3.5 lg:[&>svg]:w-4 lg:[&>svg]:h-4`}>
                            {iconElement}
                        </span>
                    </div>
                )}
                
                {/* Content - Readable on all screens */}
                <div className="flex-1 min-w-0">
                    {/* Value - Clear and Bold */}
                    <div className={`
                        ${isStringValue 
                            ? 'text-xs sm:text-sm lg:text-base' 
                            : 'text-lg sm:text-xl lg:text-2xl'
                        } 
                        font-bold text-slate-800 dark:text-white tracking-tight truncate leading-none
                    `}>
                        {typeof displayValue === 'number' 
                            ? displayValue.toLocaleString() 
                            : displayValue
                        }
                    </div>
                    
                    {/* Label - Readable! Minimum 11px */}
                    <div className="text-[11px] sm:text-xs lg:text-sm text-slate-600 dark:text-slate-400 truncate mt-0.5 leading-tight font-medium">
                        {label}
                    </div>
                </div>
                
                {/* Trend indicator - Hidden on small screens */}
                {hasTrend && (
                    <div className={`
                        hidden md:flex items-center gap-0.5 text-[10px] font-semibold
                        ${isPositiveTrend ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}
                    `}>
                        {isPositiveTrend ? (
                            <TrendingUp className="w-2.5 h-2.5" />
                        ) : (
                            <TrendingDown className="w-2.5 h-2.5" />
                        )}
                        <span>{trend}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// Memoize to prevent unnecessary re-renders
export default memo(StatCard, (prevProps, nextProps) => {
    const prevValue = prevProps.count !== undefined ? prevProps.count : prevProps.value;
    const nextValue = nextProps.count !== undefined ? nextProps.count : nextProps.value;
    
    return (
        prevValue === nextValue &&
        prevProps.status === nextProps.status &&
        prevProps.trend === nextProps.trend &&
        prevProps.iconColor === nextProps.iconColor &&
        prevProps.compact === nextProps.compact
    );
});
