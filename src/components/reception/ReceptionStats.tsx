/**
 * ReceptionStats Component
 * Memoized stats cards for Reception Dashboard
 * Adora Hotel Management System
 */

import React from 'react';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { StatCard } from '../common/StatCard';

export interface ReceptionStatsProps {
    newCount: number;
    inProgressCount: number;
    completedCount: number;
    t: (key: string) => string;
}

/**
 * Memoized stats component to prevent re-renders when request list updates
 */
export const ReceptionStats: React.FC<ReceptionStatsProps> = React.memo(({
    newCount,
    inProgressCount,
    completedCount,
    t
}) => {
    return (
        <div 
            className="max-w-7xl mx-auto mb-4"
            style={{
                padding: '24px', // ✅ Padding as per spec
            }}
        >
            <div 
                className="grid"
                style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', // ✅ Grid as per spec
                    gap: '24px', // ✅ Gap: 24px as per spec
                }}
            >
                <StatCard
                    count={newCount}
                    label={t('reception.newTab')}
                    icon={AlertCircle}
                    iconColor="orange"
                    status={newCount > 10 ? 'warning' : 'normal'}
                />
                <StatCard
                    count={inProgressCount}
                    label={t('reception.inProgressTab')}
                    icon={Clock}
                    iconColor="blue"
                    status={inProgressCount > 15 ? 'warning' : 'normal'}
                />
                <StatCard
                    count={completedCount}
                    label={t('reception.completedTab')}
                    icon={CheckCircle2}
                    iconColor="green"
                    status="success"
                    trend="+12%"
                />
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison: only re-render if counts change
    return (
        prevProps.newCount === nextProps.newCount &&
        prevProps.inProgressCount === nextProps.inProgressCount &&
        prevProps.completedCount === nextProps.completedCount
    );
});

ReceptionStats.displayName = 'ReceptionStats';
