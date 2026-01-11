/**
 * Animated Charts Component
 * Beautiful, interactive charts with smooth animations
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface ChartData {
    label: string;
    value: number;
    color: string;
    icon?: string;
}

interface AnimatedChartProps {
    data: ChartData[];
    type: 'bar' | 'donut' | 'progress' | 'wave';
    title: string;
    subtitle?: string;
    height?: number;
    animate?: boolean;
    showTrend?: boolean;
    previousTotal?: number;
}

// ============================================================
// ANIMATED BAR CHART
// ============================================================

const AnimatedBarChart: React.FC<{ data: ChartData[]; height: number; animate: boolean }> = ({
    data,
    height,
    animate,
}) => {
    const [progress, setProgress] = useState(0);
    const maxValue = Math.max(...data.map(d => d.value), 1);

    useEffect(() => {
        if (animate) {
            const timer = setTimeout(() => setProgress(1), 100);
            return () => clearTimeout(timer);
        } else {
            setProgress(1);
        }
    }, [animate, data]);

    return (
        <div className="flex items-end gap-3 justify-center" style={{ height }}>
            {data.map((item, index) => {
                const barHeight = (item.value / maxValue) * height * progress;
                return (
                    <div key={index} className="flex flex-col items-center gap-2">
                        <span
                            className="text-sm font-bold transition-all duration-500"
                            style={{
                                color: item.color,
                                opacity: progress,
                                transform: `translateY(${(1 - progress) * 20}px)`
                            }}
                        >
                            {Math.round(item.value * progress)}
                        </span>
                        <div
                            className="rounded-t-xl transition-all duration-700 ease-out relative overflow-hidden"
                            style={{
                                width: '48px',
                                height: barHeight,
                                background: `linear-gradient(180deg, ${item.color}, ${item.color}88)`,
                                boxShadow: `0 0 20px ${item.color}40`,
                            }}
                        >
                            {/* Shimmer effect */}
                            <div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                style={{
                                    animation: 'shimmer 2s infinite',
                                    transform: 'skewX(-20deg)',
                                }}
                            />
                        </div>
                        <span className="text-xs text-white/60 text-center">
                            {item.icon && <span className="mr-1">{item.icon}</span>}
                            {item.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// ============================================================
// ANIMATED DONUT CHART
// ============================================================

const AnimatedDonutChart: React.FC<{ data: ChartData[]; animate: boolean }> = ({
    data,
    animate,
}) => {
    const [progress, setProgress] = useState(0);
    const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
    const radius = 80;
    const strokeWidth = 20;
    const circumference = 2 * Math.PI * radius;

    useEffect(() => {
        if (animate) {
            const timer = setTimeout(() => setProgress(1), 100);
            return () => clearTimeout(timer);
        } else {
            setProgress(1);
        }
    }, [animate, data]);

    let currentOffset = 0;

    return (
        <div className="relative flex items-center justify-center">
            <svg width="200" height="200" viewBox="0 0 200 200">
                {data.map((item, index) => {
                    const percentage = item.value / total;
                    const strokeLength = percentage * circumference * progress;
                    const offset = currentOffset;
                    currentOffset += percentage * circumference;

                    return (
                        <circle
                            key={index}
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="none"
                            stroke={item.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${strokeLength} ${circumference}`}
                            strokeDashoffset={-offset}
                            strokeLinecap="round"
                            style={{
                                transition: 'stroke-dasharray 1s ease-out, stroke-dashoffset 1s ease-out',
                                filter: `drop-shadow(0 0 8px ${item.color}60)`,
                            }}
                            transform="rotate(-90 100 100)"
                        />
                    );
                })}
                {/* Center glow */}
                <circle
                    cx="100"
                    cy="100"
                    r={radius - strokeWidth}
                    fill="rgba(255,255,255,0.02)"
                />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">
                    {Math.round(total * progress)}
                </span>
                <span className="text-xs text-white/60">إجمالي</span>
            </div>
        </div>
    );
};

// ============================================================
// ANIMATED PROGRESS BARS
// ============================================================

const AnimatedProgressBars: React.FC<{ data: ChartData[]; animate: boolean }> = ({
    data,
    animate,
}) => {
    const [progress, setProgress] = useState(0);
    const maxValue = Math.max(...data.map(d => d.value), 1);

    useEffect(() => {
        if (animate) {
            const timer = setTimeout(() => setProgress(1), 100);
            return () => clearTimeout(timer);
        } else {
            setProgress(1);
        }
    }, [animate, data]);

    return (
        <div className="space-y-4 w-full">
            {data.map((item, index) => {
                const percentage = (item.value / maxValue) * 100 * progress;
                return (
                    <div key={index} className="space-y-1">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-white/80 flex items-center gap-2">
                                {item.icon && <span>{item.icon}</span>}
                                {item.label}
                            </span>
                            <span
                                className="text-sm font-bold"
                                style={{ color: item.color }}
                            >
                                {Math.round(item.value * progress)}
                            </span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                                style={{
                                    width: `${percentage}%`,
                                    background: `linear-gradient(90deg, ${item.color}88, ${item.color})`,
                                    boxShadow: `0 0 10px ${item.color}40`,
                                }}
                            >
                                {/* Pulse animation */}
                                <div
                                    className="absolute inset-0 bg-white/20"
                                    style={{
                                        animation: 'pulse 2s infinite',
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ============================================================
// WAVE CHART (ANIMATED AREA)
// ============================================================

const WaveChart: React.FC<{ data: ChartData[]; animate: boolean }> = ({
    data,
    animate,
}) => {
    const [progress, setProgress] = useState(0);
    const maxValue = Math.max(...data.map(d => d.value), 1);

    useEffect(() => {
        if (animate) {
            const timer = setTimeout(() => setProgress(1), 100);
            return () => clearTimeout(timer);
        } else {
            setProgress(1);
        }
    }, [animate, data]);

    const width = 300;
    const height = 120;
    const padding = 10;

    const points = data.map((item, index) => ({
        x: padding + (index / (data.length - 1)) * (width - 2 * padding),
        y: height - padding - (item.value / maxValue) * (height - 2 * padding) * progress,
    }));

    // Create smooth curve path
    const createPath = () => {
        if (points.length < 2) return '';

        let path = `M ${points[0].x} ${points[0].y}`;

        for (let i = 0; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            const midX = (current.x + next.x) / 2;

            path += ` Q ${current.x} ${current.y}, ${midX} ${(current.y + next.y) / 2}`;
        }

        path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;

        return path;
    };

    const linePath = createPath();
    const areaPath = `${linePath} L ${width - padding} ${height} L ${padding} ${height} Z`;

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            <defs>
                <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                </linearGradient>
            </defs>
            <path
                d={areaPath}
                fill="url(#waveGradient)"
                style={{ transition: 'all 1s ease-out' }}
            />
            <path
                d={linePath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinecap="round"
                style={{
                    transition: 'all 1s ease-out',
                    filter: 'drop-shadow(0 0 8px #3b82f680)',
                }}
            />
            {/* Data points */}
            {points.map((point, index) => (
                <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth="2"
                    style={{
                        transition: 'all 1s ease-out',
                        opacity: progress,
                    }}
                />
            ))}
        </svg>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const AnimatedChart: React.FC<AnimatedChartProps> = ({
    data,
    type,
    title,
    subtitle,
    height = 200,
    animate = true,
    showTrend = false,
    previousTotal = 0,
}) => {
    const currentTotal = data.reduce((sum, d) => sum + d.value, 0);
    const trend = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    const getTrendIcon = () => {
        if (trend > 0) return <TrendingUp className="w-4 h-4 text-emerald-400" />;
        if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-400" />;
        return <Minus className="w-4 h-4 text-white/40" />;
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-lg">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    {subtitle && (
                        <p className="text-sm text-white/50 mt-1">{subtitle}</p>
                    )}
                </div>
                {showTrend && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5">
                        {getTrendIcon()}
                        <span className={`text-sm font-medium ${trend > 0 ? 'text-emerald-400' :
                                trend < 0 ? 'text-red-400' : 'text-white/40'
                            }`}>
                            {Math.abs(trend).toFixed(1)}%
                        </span>
                    </div>
                )}
            </div>

            {/* Chart */}
            <div className="flex items-center justify-center">
                {type === 'bar' && (
                    <AnimatedBarChart data={data} height={height} animate={animate} />
                )}
                {type === 'donut' && (
                    <AnimatedDonutChart data={data} animate={animate} />
                )}
                {type === 'progress' && (
                    <AnimatedProgressBars data={data} animate={animate} />
                )}
                {type === 'wave' && (
                    <WaveChart data={data} animate={animate} />
                )}
            </div>

            {/* Legend */}
            {(type === 'donut' || type === 'bar') && (
                <div className="flex flex-wrap justify-center gap-4 mt-6">
                    {data.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: item.color }}
                            />
                            <span className="text-xs text-white/60">{item.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* CSS Animations */}
            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%) skewX(-20deg); }
                    100% { transform: translateX(200%) skewX(-20deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 0; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
};

export default AnimatedChart;
