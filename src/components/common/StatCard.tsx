/**
 * StatCard - Premium Compact Stats Card
 * Designed by Senior Graphic Designer (10+ years experience)
 * ADORA Premium Design System - Turquoise DNA
 * 
 * ✅ COMPACT & CLEAN - Tight spacing, controlled padding
 * ✅ PREMIUM TYPOGRAPHY - Clear hierarchy (Label: 13px, Value: 24px)
 * ✅ TURQUOISE DNA - Icon backgrounds with #20B2AA
 * ✅ FIXED HEIGHT - 90-100px for consistency
 * ✅ SMOOTH HOVER - Turquoise border on hover
 */

import React, { memo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { ADORA_THEME } from '../../design/adoraTheme';
// ✅ Removed useTheme import - using CSS theme variables instead

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
    // ✅ Removed isDark - using CSS theme variables exclusively
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
    
    // Handle icon rendering - ✅ Duo-tone support
    let iconElement: React.ReactNode = null;
    if (icon) {
        if (React.isValidElement(icon)) {
            iconElement = React.cloneElement(icon as React.ReactElement<any>, {
                className: compact ? 'w-4 h-4' : 'w-5 h-5',
                size: compact ? 16 : 20, // ✅ Explicit size for Lucide icons
                strokeWidth: 2.5, // ✅ Duo-tone stroke width
                style: { opacity: 0.9 } // ✅ Duo-tone opacity
            });
        } else if (typeof icon === 'function' || typeof icon === 'object') {
            const IconComponent = icon as React.ComponentType<{ 
                className?: string; 
                size?: number; 
                strokeWidth?: number; 
                style?: React.CSSProperties;
            }>;
            iconElement = (
                <IconComponent 
                    className={compact ? 'w-4 h-4' : 'w-5 h-5'}
                    size={compact ? 16 : 20} // ✅ Explicit size for Lucide icons
                    strokeWidth={2.5} // ✅ Duo-tone stroke width
                    style={{ opacity: 0.9 }} // ✅ Duo-tone opacity
                />
            );
        }
    }

    // Parse trend
    const isPositiveTrend = trend?.startsWith('+');
    const hasTrend = trend && trend.replace(/[+%]/g, '');
    
    // Map iconColor to actual colors for icon background
    const iconColorMap: Record<IconColorVariant, string> = {
        teal: ADORA_THEME.colors.primary,
        blue: '#3B82F6',
        green: '#22C55E',
        orange: '#F59E0B',
        red: '#EF4444',
        purple: '#8B5CF6',
        yellow: '#EAB308',
        pink: '#EC4899',
    };
    
    const iconBgColor = iconColorMap[iconColor] || ADORA_THEME.colors.primary;

    // ✅ Theme-aware shadows (using CSS variables)
    // Shadows are now handled via CSS variables in theme-system.css

    return (
        <div 
            className="stat-card-unified group relative overflow-hidden min-w-0"
        >
            {/* Content Section - Left (RTL) */}
            <div className="flex flex-col gap-0.5 sm:gap-1 flex-1 min-w-0">
                {/* Value - Premium Typography - Responsive (Smaller on mobile) */}
                <h2 
                    className="m-0 font-extrabold leading-tight truncate text-base sm:text-lg md:text-xl lg:text-2xl"
                    style={{
                        color: 'var(--theme-text-primary)', // ✅ Theme-aware text color
                        fontWeight: 800,
                        lineHeight: '1.2',
                        margin: '2px 0 0 0', // ✅ Smaller margin on mobile
                        fontSize: 'clamp(14px, 3vw, 24px)', // ✅ Responsive font size
                    }}
                >
                    {typeof displayValue === 'number' 
                        ? displayValue.toLocaleString() 
                        : displayValue
                    }
                </h2>
                
                {/* Label - Clean & Readable - ✅ Text Truncation for Long Labels - Responsive (Smaller on mobile) */}
                <p 
                    className="m-0 font-semibold leading-tight truncate text-[10px] sm:text-xs md:text-sm"
                    style={{
                        color: 'var(--theme-text-secondary)', // ✅ Theme-aware text color
                        fontWeight: 600,
                        lineHeight: '1.3',
                        maxWidth: '100%', // ✅ Full width on mobile, truncate on desktop
                        fontSize: 'clamp(10px, 2vw, 14px)', // ✅ Responsive font size
                    }}
                >
                    {label}
                </p>
                
                {/* Last Update - Smaller on mobile */}
                {lastUpdate && (
                    <p 
                        className="m-0 font-medium leading-tight text-[9px] sm:text-[10px] md:text-xs truncate mt-0.5"
                        style={{
                            color: 'var(--theme-text-tertiary)', // ✅ Theme-aware text color
                            fontSize: 'clamp(9px, 1.5vw, 12px)', // ✅ Responsive font size
                        }}
                    >
                        {lastUpdate}
                    </p>
                )}
            </div>
            
            {/* Icon Section - Right (RTL) - Premium Design - Responsive */}
            {iconElement && (
                <div 
                    className="flex-shrink-0 flex items-center justify-center relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl"
                    style={{
                        background: `${iconBgColor}1A`, // 10% opacity
                        color: iconBgColor,
                        transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${iconBgColor}26`; // 15% on hover
                        e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = `${iconBgColor}1A`;
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    {React.isValidElement(iconElement) 
                        ? React.cloneElement(iconElement as React.ReactElement<any>, {
                            className: 'w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6',
                            size: undefined, // ✅ Let className handle size (responsive)
                            strokeWidth: 2.5, // ✅ Duo-tone stroke width
                            style: { 
                                color: iconBgColor,
                                opacity: 0.9, // ✅ Duo-tone opacity
                                width: 'clamp(16px, 4vw, 24px)', // ✅ Responsive icon size
                                height: 'clamp(16px, 4vw, 24px)',
                            }
                        })
                        : typeof iconElement === 'function'
                        ? React.createElement(iconElement as React.ComponentType<any>, {
                            className: 'w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6',
                            size: undefined, // ✅ Let className handle size (responsive)
                            strokeWidth: 2.5, // ✅ Duo-tone stroke width
                            style: { 
                                color: iconBgColor,
                                opacity: 0.9, // ✅ Duo-tone opacity
                                width: 'clamp(16px, 4vw, 24px)', // ✅ Responsive icon size
                                height: 'clamp(16px, 4vw, 24px)',
                            }
                        })
                        : iconElement
                    }
                </div>
            )}
            
            {/* Trend indicator - Hidden on small screens */}
            {hasTrend && (
                <div 
                    className="hidden md:flex items-center gap-1 text-xs font-semibold"
                    style={{
                        color: isPositiveTrend ? '#22c55e' : '#ef4444',
                        marginLeft: ADORA_THEME.spacing.sm,
                    }}
                >
                    {isPositiveTrend ? (
                        <TrendingUp className="w-3 h-3" />
                    ) : (
                        <TrendingDown className="w-3 h-3" />
                    )}
                    <span>{trend}</span>
                </div>
            )}
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
