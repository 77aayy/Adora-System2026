/**
 * Request Tabs Component
 * Reusable tabs for filtering requests: جارية / الكل / مكتملة
 * Adora Hotel Management System V2
 */

import React from 'react';
import { Clock, List, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ============================================================
// TYPES
// ============================================================

export type RequestTabType = 'active' | 'all' | 'completed';

interface RequestTabsProps {
    activeTab: RequestTabType;
    onTabChange: (tab: RequestTabType) => void;
    counts?: {
        active: number;
        all: number;
        completed: number;
    };
    className?: string;
}

// ============================================================
// COMPONENT
// ============================================================

export const RequestTabs: React.FC<RequestTabsProps> = ({
    activeTab,
    onTabChange,
    counts,
    className = '',
}) => {
    const { t } = useTranslation();
    const tabs: { key: RequestTabType; label: string; icon: React.ReactNode }[] = [
        { key: 'active', label: t('common.active') || 'جارية', icon: <Clock className="w-4 h-4" /> },
        { key: 'all', label: t('common.all') || 'الكل', icon: <List className="w-4 h-4" /> },
        { key: 'completed', label: t('common.completed') || 'مكتمل', icon: <CheckCircle className="w-4 h-4" /> },
    ];

    return (
        <div className={`flex bg-white/5 rounded-xl p-1 ${className}`}>
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    onClick={() => onTabChange(tab.key)}
                    className={`
                        flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                        text-sm font-medium transition-all duration-200
                        ${activeTab === tab.key
                            ? 'bg-white/10 text-white shadow-lg'
                            : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                        }
                    `}
                >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {counts && counts[tab.key] > 0 && (
                        <span className={`
                            px-1.5 py-0.5 rounded-full text-xs
                            ${activeTab === tab.key
                                ? 'bg-white/20 text-white'
                                : 'bg-white/10 text-white/60'
                            }
                        `}>
                            {counts[tab.key]}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
};

// ============================================================
// FILTER HELPER
// ============================================================

/**
 * Filter requests by tab type
 */
export function filterRequestsByTab<T extends { status: string }>(
    requests: T[],
    tab: RequestTabType,
    activeStatuses: string[] = ['PENDING', 'PENDING_RECEPTION', 'CONFIRMED', 'IN_PROGRESS', 'CLEANING_IN_PROGRESS', 'MAINTENANCE_IN_PROGRESS'],
    completedStatuses: string[] = ['COMPLETED']
): T[] {
    switch (tab) {
        case 'active':
            return requests.filter(r => activeStatuses.includes(r.status));
        case 'completed':
            return requests.filter(r => completedStatuses.includes(r.status));
        case 'all':
        default:
            return requests;
    }
}

/**
 * Get counts for tabs
 */
export function getTabCounts<T extends { status: string }>(
    requests: T[],
    activeStatuses: string[] = ['PENDING', 'PENDING_RECEPTION', 'CONFIRMED', 'IN_PROGRESS', 'CLEANING_IN_PROGRESS', 'MAINTENANCE_IN_PROGRESS'],
    completedStatuses: string[] = ['COMPLETED']
): { active: number; all: number; completed: number } {
    return {
        active: requests.filter(r => activeStatuses.includes(r.status)).length,
        completed: requests.filter(r => completedStatuses.includes(r.status)).length,
        all: requests.length,
    };
}

export default RequestTabs;
