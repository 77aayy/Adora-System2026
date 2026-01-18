/**
 * Chart Components for Analytics
 * Using Chart.js for interactive charts
 * ✅ CRITICAL FIX: Lazy import to prevent "Cannot access X before initialization" error
 */

import React, { useMemo, lazy, Suspense } from 'react';

// ✅ SOLUTION: Lazy import chart.js components to break circular dependency
// Registration happens inside the lazy component to ensure proper initialization order
const Chart = lazy(async () => {
    const chartjs = await import('chart.js');
    const reactChartjs2 = await import('react-chartjs-2');
    
    // Register Chart.js components
    chartjs.Chart.register(
        chartjs.CategoryScale,
        chartjs.LinearScale,
        chartjs.PointElement,
        chartjs.LineElement,
        chartjs.BarElement,
        chartjs.ArcElement,
        chartjs.Title,
        chartjs.Tooltip,
        chartjs.Legend,
        chartjs.Filler
    );
    
    return { default: reactChartjs2.Line };
});

const BarChartComponent = lazy(async () => {
    const reactChartjs2 = await import('react-chartjs-2');
    return { default: reactChartjs2.Bar };
});

const DoughnutChartComponent = lazy(async () => {
    const reactChartjs2 = await import('react-chartjs-2');
    return { default: reactChartjs2.Doughnut };
});

// ✅ Loading fallback for lazy-loaded charts
const ChartLoader = () => (
    <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
    </div>
);

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
            <Suspense fallback={<ChartLoader />}>
                <Chart data={chartData} options={defaultOptions} />
            </Suspense>
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
            <Suspense fallback={<ChartLoader />}>
                <BarChartComponent data={chartData} options={defaultOptions} />
            </Suspense>
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
            <Suspense fallback={<ChartLoader />}>
                <DoughnutChartComponent data={chartData} options={defaultOptions} />
            </Suspense>
        </div>
    );
};
