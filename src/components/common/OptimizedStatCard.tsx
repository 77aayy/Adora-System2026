/**
 * Optimized StatCard Component
 * Memoized version of StatCard for better performance
 * Adora Hotel Management System V3
 */

import React, { memo } from 'react';
import { StatCard } from './StatCard';

interface StatCardProps {
    count?: number;
    value?: number | string;
    label: string | React.ReactNode;
    icon: React.ReactNode | React.ComponentType<any>;
    bgColor?: string;
    color?: string;
    lastUpdate?: string;
    trend?: string;
    status?: 'normal' | 'warning' | 'success' | 'error';
}

/**
 * Optimized StatCard with React.memo
 * Only re-renders when props change
 */
export const OptimizedStatCard = memo<StatCardProps>(
    StatCard,
    (prevProps, nextProps) => {
        // Custom comparison function
        return (
            prevProps.count === nextProps.count &&
            prevProps.value === nextProps.value &&
            prevProps.label === nextProps.label &&
            prevProps.lastUpdate === nextProps.lastUpdate &&
            prevProps.trend === nextProps.trend &&
            prevProps.status === nextProps.status
        );
    }
);

OptimizedStatCard.displayName = 'OptimizedStatCard';
