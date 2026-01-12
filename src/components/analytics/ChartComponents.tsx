/**
 * Chart Components for Analytics
 * Using Chart.js for interactive charts
 * ✅ Fixed: Lazy registration to avoid initialization order issues
 */

import React, { useEffect, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// ✅ Lazy registration flag to prevent multiple registrations
let chartRegistered = false;

// ✅ Register Chart.js components lazily (only once)
const registerChartJS = () => {
    if (!chartRegistered) {
        ChartJS.register(
            CategoryScale,
            LinearScale,
            PointElement,
            LineElement,
            BarElement,
            ArcElement,
            Title,
            Tooltip,
            Legend,
            Filler
        );
        chartRegistered = true;
    }
};

// ============================================================
// CHART OPTIONS
// ============================================================

const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'top' as const,
            labels: {
                color: 'rgba(255, 255, 255, 0.8)',
                font: {
                    family: 'Tajawal, sans-serif'
                }
            }
        },
        tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: 'rgba(255, 255, 255, 1)',
            bodyColor: 'rgba(255, 255, 255, 0.8)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1
        }
    },
    scales: {
        x: {
            ticks: {
                color: 'rgba(255, 255, 255, 0.6)'
            },
            grid: {
                color: 'rgba(255, 255, 255, 0.05)'
            }
        },
        y: {
            ticks: {
                color: 'rgba(255, 255, 255, 0.6)'
            },
            grid: {
                color: 'rgba(255, 255, 255, 0.05)'
            }
        }
    }
};

// ============================================================
// LINE CHART
// ============================================================

interface LineChartProps {
    data: {
        labels: string[];
        datasets: Array<{
            label: string;
            data: number[];
            borderColor?: string;
            backgroundColor?: string;
            fill?: boolean;
        }>;
    };
    title?: string;
    height?: string;
}

export const LineChart: React.FC<LineChartProps> = ({ data, title, height = '300px' }) => {
    // ✅ Ensure Chart.js is registered before rendering
    useEffect(() => {
        registerChartJS();
    }, []);

    // ✅ Performance: Memoize chart data to avoid recalculation on every render
    const chartData = useMemo(() => ({
        labels: data.labels,
        datasets: data.datasets.map(dataset => ({
            ...dataset,
            borderColor: dataset.borderColor || 'rgb(20, 184, 166)',
            backgroundColor: dataset.backgroundColor || 'rgba(20, 184, 166, 0.1)',
            fill: dataset.fill ?? true,
            tension: 0.4
        }))
    }), [data.labels, data.datasets]);

    return (
        <div style={{ height }}>
            {title && (
                <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
            )}
            <Line data={chartData} options={defaultOptions} />
        </div>
    );
};

// ============================================================
// BAR CHART
// ============================================================

interface BarChartProps {
    data: {
        labels: string[];
        datasets: Array<{
            label: string;
            data: number[];
            backgroundColor?: string | string[];
        }>;
    };
    title?: string;
    height?: string;
}

export const BarChart: React.FC<BarChartProps> = ({ data, title, height = '300px' }) => {
    // ✅ Ensure Chart.js is registered before rendering
    useEffect(() => {
        registerChartJS();
    }, []);

    // ✅ Performance: Memoize chart data to avoid recalculation on every render
    const chartData = useMemo(() => ({
        labels: data.labels,
        datasets: data.datasets.map(dataset => ({
            ...dataset,
            backgroundColor: dataset.backgroundColor || [
                'rgba(20, 184, 166, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(168, 85, 247, 0.8)',
                'rgba(236, 72, 153, 0.8)',
                'rgba(251, 191, 36, 0.8)'
            ]
        }))
    }), [data.labels, data.datasets]);

    return (
        <div style={{ height }}>
            {title && (
                <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
            )}
            <Bar data={chartData} options={defaultOptions} />
        </div>
    );
};

// ============================================================
// DOUGHNUT CHART
// ============================================================

interface DoughnutChartProps {
    data: {
        labels: string[];
        datasets: Array<{
            data: number[];
            backgroundColor?: string[];
        }>;
    };
    title?: string;
    height?: string;
}

export const DoughnutChart: React.FC<DoughnutChartProps> = ({ data, title, height = '300px' }) => {
    // ✅ Ensure Chart.js is registered before rendering
    useEffect(() => {
        registerChartJS();
    }, []);

    // ✅ Performance: Memoize chart data to avoid recalculation on every render
    const chartData = useMemo(() => ({
        labels: data.labels,
        datasets: data.datasets.map(dataset => ({
            ...dataset,
            backgroundColor: dataset.backgroundColor || [
                'rgba(20, 184, 166, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(168, 85, 247, 0.8)',
                'rgba(236, 72, 153, 0.8)',
                'rgba(251, 191, 36, 0.8)'
            ]
        }))
    }), [data.labels, data.datasets]);

    return (
        <div style={{ height }}>
            {title && (
                <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
            )}
            <Doughnut data={chartData} options={defaultOptions} />
        </div>
    );
};
