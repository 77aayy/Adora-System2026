/**
 * RequestList Component
 * Displays filtered and grouped requests with tabs
 * Adora Hotel Management System
 */

import React from 'react';
import { ServiceRequest } from '../../types/request';
import { CompactRequestCard } from './CompactRequestCard';
import { CheckCircle2 } from 'lucide-react';
import type { QuickAction } from '../../utils/quickActionsConfig';
import type { StatusConfig } from '../../utils/statusConfig';

export interface RequestListProps {
    requests: ServiceRequest[];
    currentTab: 'new' | 'in_progress' | 'completed';
    onTabChange: (tab: 'new' | 'in_progress' | 'completed') => void;
    onRequestView: (request: ServiceRequest) => void;
    onRequestConfirm?: (requestId: string) => void;
    roomSearchQuery: string;
    quickActions: QuickAction[];
    serviceNames: Record<string, string>;
    statusConfig: StatusConfig;
    t: (key: string) => string;
}

export const RequestList: React.FC<RequestListProps> = ({
    requests,
    currentTab,
    onTabChange,
    onRequestView,
    onRequestConfirm,
    roomSearchQuery,
    quickActions,
    serviceNames,
    statusConfig,
    t
}) => {
    // Filter requests by tab
    const filteredRequests = React.useMemo(() => {
        let list: ServiceRequest[];
        switch (currentTab) {
            case 'new':
                list = requests.filter(r => r.status === 'PENDING' || r.status === 'PENDING_RECEPTION');
                break;
            case 'in_progress':
                list = requests.filter(r => r.status === 'CONFIRMED' || r.status === 'IN_PROGRESS');
                break;
            case 'completed':
                list = requests.filter(r => r.status === 'COMPLETED');
                break;
            default:
                list = [];
        }

        // Apply room search filter
        if (roomSearchQuery.trim()) {
            const query = roomSearchQuery.trim().toLowerCase();
            list = list.filter(r => r.roomNumber?.toLowerCase().includes(query));
        }

        return list;
    }, [requests, currentTab, roomSearchQuery]);

    // Tab definitions
    const tabDefinitions = React.useMemo(() => [
        {
            key: 'new' as const,
            label: t('reception.newTab'),
            count: requests.filter(r => r.status === 'PENDING' || r.status === 'PENDING_RECEPTION').length,
            activeClass: 'bg-orange-500 text-white shadow-orange-500/25',
            inactiveClass: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
        },
        {
            key: 'in_progress' as const,
            label: t('reception.inProgressTab'),
            count: requests.filter(r => r.status === 'CONFIRMED' || r.status === 'IN_PROGRESS').length,
            activeClass: 'bg-blue-500 text-white shadow-blue-500/25',
            inactiveClass: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
        },
        {
            key: 'completed' as const,
            label: t('reception.completedTab'),
            count: requests.filter(r => r.status === 'COMPLETED').length,
            activeClass: 'bg-green-500 text-white shadow-green-500/25',
            inactiveClass: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
        }
    ], [requests, t]);

    return (
        <>
            {/* Tabs */}
            <div className="flex gap-2 sm:gap-3 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                {tabDefinitions.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => onTabChange(tab.key)}
                        className={`
                            px-3 sm:px-4 py-2 rounded-xl
                            whitespace-nowrap transition-all 
                            active:scale-95 touch-manipulation flex-shrink-0
                            text-xs sm:text-sm font-medium
                            ${currentTab === tab.key
                                ? `${tab.activeClass} shadow-lg`
                                : `${tab.inactiveClass} hover:opacity-80`
                            }
                        `}
                    >
                        <span>{tab.label}</span>
                        <span className={`
                            px-1.5 sm:px-2 py-0.5 rounded-full text-xs sm:text-xs font-bold
                            ${currentTab === tab.key 
                                ? 'bg-white/25' 
                                : 'bg-current/20'
                            }
                        `}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Requests List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredRequests.length === 0 ? (
                    <div className="col-span-full adora-card p-6 text-center rounded-xl">
                        <div className="w-12 h-12 rounded-full adora-bg-tertiary flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 className="w-6 h-6 adora-text-disabled" />
                        </div>
                        <p className="text-sm adora-text-secondary">{t('reception.noRequestsInList')}</p>
                    </div>
                ) : (
                    filteredRequests.map(request => (
                        <CompactRequestCard
                            key={request.id}
                            request={request}
                            onView={() => onRequestView(request)}
                            onQuickAction={
                                (request.status === 'PENDING' || request.status === 'PENDING_RECEPTION') && onRequestConfirm
                                    ? (action) => {
                                        if (action === 'confirm' && onRequestConfirm) {
                                            onRequestConfirm(request.id);
                                        }
                                    }
                                    : undefined
                            }
                            quickActions={quickActions}
                            serviceNames={serviceNames}
                            statusConfig={statusConfig}
                        />
                    ))
                )}
            </div>
        </>
    );
};
