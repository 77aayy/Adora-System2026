/**
 * Progress Bar Component
 * Visual progress indicators for long operations
 * Adora Hotel Management System V2
 */

import React from 'react';

interface ProgressBarProps {
    progress: number; // 0-100
    label?: string;
    showPercentage?: boolean;
    color?: 'primary' | 'success' | 'warning' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    animated?: boolean;
    className?: string;
}

const colorClasses = {
    primary: 'bg-primary-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
};

const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
    progress,
    label,
    showPercentage = false,
    color = 'primary',
    size = 'md',
    animated = true,
    className = '',
}) => {
    const clampedProgress = Math.max(0, Math.min(100, progress));

    return (
        <div className={`w-full ${className}`}>
            {/* Label and Percentage */}
            {(label || showPercentage) && (
                <div className="flex items-center justify-between mb-2">
                    {label && (
                        <span className="text-sm text-white/60 font-medium">{label}</span>
                    )}
                    {showPercentage && (
                        <span className="text-sm text-white/40 font-mono">
                            {Math.round(clampedProgress)}%
                        </span>
                    )}
                </div>
            )}

            {/* Progress Bar */}
            <div
                className={`w-full ${sizeClasses[size]} bg-white/10 rounded-full overflow-hidden`}
            >
                <div
                    className={`${colorClasses[color]} h-full rounded-full transition-all duration-500 ease-out ${
                        animated ? 'animate-pulse-glow' : ''
                    }`}
                    style={{
                        width: `${clampedProgress}%`,
                        transition: animated
                            ? 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                            : 'width 0.3s ease-out',
                    }}
                />
            </div>
        </div>
    );
};

/**
 * Circular Progress Indicator
 */
interface CircularProgressProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
    color?: 'primary' | 'success' | 'warning' | 'danger';
    showPercentage?: boolean;
    className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
    progress,
    size = 64,
    strokeWidth = 6,
    color = 'primary',
    showPercentage = true,
    className = '',
}) => {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (clampedProgress / 100) * circumference;

    const colorMap = {
        primary: '#14b8a6',
        success: '#22c55e',
        warning: '#eab308',
        danger: '#ef4444',
    };

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`}>
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background Circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress Circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={colorMap[color]}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                />
            </svg>
            {showPercentage && (
                <span className="absolute text-sm font-bold text-white">
                    {Math.round(clampedProgress)}%
                </span>
            )}
        </div>
    );
};

export default ProgressBar;
