/**
 * Professional Stat Card Component
 * Modern, clean stat card design inspired by professional apps
 * Adora Hotel Management System V2
 */

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface ProfessionalStatCardProps {
    title: string;
    value: string | number;
    change?: number; // Percentage change
    trend?: 'up' | 'down';
    icon?: LucideIcon;
    iconColor?: string;
    iconBg?: string;
    gradient?: string;
    className?: string;
    onClick?: () => void;
}

export const ProfessionalStatCard: React.FC<ProfessionalStatCardProps> = ({
    title,
    value,
    change,
    trend,
    icon: Icon,
    iconColor = 'text-primary-400',
    iconBg = 'bg-primary-500/20',
    gradient = 'from-primary-500/20 to-primary-600/10',
    className = '',
    onClick,
}) => {
    const formattedValue = typeof value === 'number' ? value.toLocaleString('ar-SA') : value;
    const changeColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400';
    const changeBg = trend === 'up' ? 'bg-green-500/20' : trend === 'down' ? 'bg-red-500/20' : 'bg-gray-500/20';

    return (
        <div
            className={`
                pro-card stat-card-pro
                ${onClick ? 'cursor-pointer pro-card-interactive' : ''}
                ${className}
            `}
            onClick={onClick}
        >
            {/* Icon */}
            {Icon && (
                <div className={`stat-card-pro-icon ${iconBg}`}>
                    <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Label */}
                <p className="stat-card-pro-label">{title}</p>

                {/* Value */}
                <p className="stat-card-pro-value mt-1">{formattedValue}</p>

                {/* Change */}
                {change !== undefined && (
                    <div className={`stat-card-pro-change mt-2 ${changeColor} ${changeBg}`}>
                        {trend === 'up' && <TrendingUp className="w-3 h-3" />}
                        {trend === 'down' && <TrendingDown className="w-3 h-3" />}
                        <span className="text-xs font-semibold">
                            {trend === 'up' ? '+' : ''}{change}%
                        </span>
                    </div>
                )}
            </div>

            {/* Gradient Accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} rounded-full blur-3xl opacity-50 -z-10`} />
        </div>
    );
};

export default ProfessionalStatCard;
