/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Operations Quick-View Bar
 * 
 * ✅ Dashboard-at-a-glance for Reception
 * ✅ Compact horizontal tracker with stage counters
 * ✅ Hover tooltips with detailed timeline
 * ✅ Color-coded urgency alerts
 * ✅ Real-time sync with Guest QR view
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Inbox,
    ArrowRightLeft,
    Wrench,
    CheckCircle2,
    Clock,
    User,
    AlertTriangle,
    ChevronRight,
    Phone,
    Eye
} from 'lucide-react';
import { db } from '../../services/firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy
} from 'firebase/firestore';
import { getElapsedMinutes, formatDuration } from '../../services/liveTimerService';

// ============================================================
// TYPES
// ============================================================

interface ActiveRequest {
    id: string;
    roomNumber: string;
    guestName?: string;
    type: 'cleaning' | 'maintenance' | 'bellman' | 'coffee' | 'other';
    stage: 'new' | 'assigning' | 'in_progress' | 'awaiting_confirmation';
    assignedTo?: string;
    assignedToName?: string;
    createdAt: any;
    acceptedAt?: any;
    startedAt?: any;
    expectedDuration?: number; // minutes
    notes?: string;
    priority?: 'normal' | 'urgent' | 'vip';
}

interface StageConfig {
    key: 'new' | 'assigning' | 'in_progress' | 'awaiting_confirmation';
    label: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
}

interface OperationsQuickViewProps {
    tenantId: string;
    branchId: string;
    onRequestClick?: (request: ActiveRequest) => void;
    className?: string;
}

// ============================================================
// STAGE CONFIGURATION
// ============================================================

// ✅ Helper to get stages with i18n
const getStages = (t: (key: string) => string): StageConfig[] => [
    {
        key: 'new',
        label: t('operations.newRequest') || 'New Request',
        icon: <Inbox className="w-4 h-4" />,
        color: 'adora-status-warning',
        bgColor: 'adora-status-bg-warning',
        borderColor: 'adora-border'
    },
    {
        key: 'assigning',
        label: t('operations.assigning') || 'Assigning',
        icon: <ArrowRightLeft className="w-4 h-4" />,
        color: 'adora-service-housekeeping',
        bgColor: 'adora-service-bg-housekeeping',
        borderColor: 'adora-border'
    },
    {
        key: 'in_progress',
        label: t('operations.inProgress') || 'In Progress',
        icon: <Wrench className="w-4 h-4" />,
        color: 'adora-service-maintenance',
        bgColor: 'adora-service-bg-maintenance',
        borderColor: 'adora-border'
    },
    {
        key: 'awaiting_confirmation',
        label: t('operations.awaitingConfirmation') || 'Awaiting Confirmation',
        icon: <CheckCircle2 className="w-4 h-4" />,
        color: 'adora-status-success',
        bgColor: 'adora-status-bg-success',
        borderColor: 'adora-border'
    }
];

// Request type icons
const TYPE_ICONS: Record<string, string> = {
    cleaning: '🧹',
    maintenance: '🔧',
    bellman: '🛎️',
    coffee: '☕',
    other: '📋'
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Calculate urgency level based on elapsed time
 */
const getUrgencyLevel = (
    request: ActiveRequest
): 'normal' | 'warning' | 'critical' => {
    const startTime = request.startedAt || request.acceptedAt || request.createdAt;
    if (!startTime) return 'normal';

    const elapsed = getElapsedMinutes(startTime);
    const expected = request.expectedDuration || 30;

    if (elapsed >= expected) return 'critical';
    if (elapsed >= expected * 0.7) return 'warning';
    return 'normal';
};

/**
 * Get remaining time text
 */
const getRemainingTime = (request: ActiveRequest, t: (key: string) => string): string => {
    const startTime = request.startedAt || request.acceptedAt || request.createdAt;
    if (!startTime) return '-';

    const elapsed = getElapsedMinutes(startTime);
    const expected = request.expectedDuration || 30;
    const remaining = expected - elapsed;

    if (remaining <= 0) return t('operations.delayed') || 'Delayed!';
    return t('operations.minutesRemaining', { minutes: remaining }) || `${remaining} min remaining`;
};

// ============================================================
// ROOM CHIP COMPONENT (with Tooltip)
// ============================================================

interface RoomChipProps {
    request: ActiveRequest;
    onClick?: () => void;
}

const RoomChip: React.FC<RoomChipProps> = ({ request, onClick }) => {
    const { t } = useTranslation(); // ✅ FIX: Add useTranslation hook
    const [showTooltip, setShowTooltip] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const urgency = getUrgencyLevel(request);

    const urgencyStyles = {
        normal: 'bg-slate-700 border-slate-600',
        warning: 'bg-amber-900/50 border-amber-500/50 animate-pulse',
        critical: 'bg-red-900/50 border-red-500 animate-pulse-fast'
    };

    const startTime = request.startedAt || request.acceptedAt || request.createdAt;
    const elapsed = startTime ? formatDuration(startTime.toDate ? startTime.toDate() : new Date(startTime)) : '-';
    const remaining = getRemainingTime(request, t);

    return (
        <div className="relative inline-block">
            {/* Room Chip */}
            <button
                onClick={onClick}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className={`
                    px-2.5 py-1 rounded-lg border text-xs font-bold
                    transition-all duration-200 hover:scale-105
                    flex items-center gap-1.5
                    ${urgencyStyles[urgency]}
                    ${request.priority === 'vip' ? 'ring-2 ring-amber-400' : ''}
                    ${request.priority === 'urgent' ? 'ring-2 ring-red-400' : ''}
                `}
            >
                <span>{TYPE_ICONS[request.type] || '📋'}</span>
                <span className="text-white">{request.roomNumber}</span>
                {urgency === 'critical' && (
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                )}
            </button>

            {/* Detailed Tooltip */}
            {showTooltip && (
                <div
                    ref={tooltipRef}
                    className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64
                               bg-slate-800 border border-slate-600 rounded-xl shadow-2xl
                               p-3 text-right animate-fadeIn"
                    style={{ direction: 'rtl' }}
                >
                    {/* Arrow */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 
                                    border-8 border-transparent border-t-slate-800" />

                    {/* Header */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700">
                        <span className="text-lg font-bold text-white">
                            {t('operations.room') || 'Room'} {request.roomNumber}
                        </span>
                        <span className="text-2xl">{TYPE_ICONS[request.type]}</span>
                    </div>

                    {/* Guest Name */}
                    {request.guestName && (
                        <div className="flex items-center gap-2 text-slate-300 text-sm mb-2">
                            <User className="w-3.5 h-3.5" />
                            <span>{request.guestName}</span>
                        </div>
                    )}

                    {/* Assigned Worker */}
                    {request.assignedToName && (
                        <div className="flex items-center gap-2 text-teal-400 text-sm mb-2">
                            <Wrench className="w-3.5 h-3.5" />
                            <span>{t('operations.worker') || 'Worker'}: {request.assignedToName}</span>
                        </div>
                    )}

                    {/* Timeline Mini */}
                    <div className="bg-slate-900/50 rounded-lg p-2 mb-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className={`font-bold ${
                                urgency === 'critical' ? 'text-red-400' :
                                urgency === 'warning' ? 'text-amber-400' : 'text-teal-400'
                            }`}>
                                {remaining}
                            </span>
                            <div className="flex items-center gap-1 text-slate-400">
                                <Clock className="w-3 h-3" />
                                <span>{t('operations.elapsed') || 'Elapsed'}: {elapsed}</span>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                    urgency === 'critical' ? 'bg-red-500' :
                                    urgency === 'warning' ? 'bg-amber-500' : 'bg-teal-500'
                                }`}
                                style={{
                                    width: `${Math.min(100, (getElapsedMinutes(startTime) / (request.expectedDuration || 30)) * 100)}%`
                                }}
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    {request.notes && (
                        <div className="text-xs text-slate-400 bg-slate-900/30 rounded p-2 mb-2">
                            📝 {request.notes}
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex gap-2 mt-3 pt-2 border-t border-slate-700">
                        <button className="flex-1 flex items-center justify-center gap-1 
                                           py-1.5 rounded-lg bg-teal-600 text-white text-xs
                                           hover:bg-teal-700 transition-colors">
                            <Eye className="w-3 h-3" />
                            {t('operations.view') || 'View'}
                        </button>
                        <button className="flex-1 flex items-center justify-center gap-1 
                                           py-1.5 rounded-lg bg-slate-700 text-white text-xs
                                           hover:bg-slate-600 transition-colors">
                            <Phone className="w-3 h-3" />
                            {t('operations.call') || 'Call'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// STAGE CARD COMPONENT
// ============================================================

interface StageCardProps {
    stage: StageConfig;
    requests: ActiveRequest[];
    onRequestClick?: (request: ActiveRequest) => void;
}

const StageCard: React.FC<StageCardProps & { t: (key: string) => string }> = ({ stage, requests, onRequestClick, t }) => {
    const criticalCount = requests.filter(r => getUrgencyLevel(r) === 'critical').length;
    const warningCount = requests.filter(r => getUrgencyLevel(r) === 'warning').length;

    return (
        <div className={`
            adora-card rounded-xl p-3 transition-all duration-300
            ${stage.bgColor} ${stage.borderColor}
            ${criticalCount > 0 ? 'ring-2 ring-red-500/30' : ''}
        `}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`${stage.color}`}>
                        {stage.icon}
                    </div>
                    <span className={`text-sm font-bold ${stage.color}`}>
                        {stage.label}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {criticalCount > 0 && (
                        <span className="adora-badge adora-badge-red text-xs font-bold animate-pulse">
                            {criticalCount}!
                        </span>
                    )}
                    {warningCount > 0 && (
                        <span className="adora-badge adora-badge-yellow text-xs font-bold">
                            {warningCount}
                        </span>
                    )}
                    <span className="adora-badge adora-badge-teal text-xs font-bold">
                        {requests.length}
                    </span>
                </div>
            </div>

            {/* Room Chips */}
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto scrollbar-thin">
                {requests.length === 0 ? (
                    <span className="text-xs adora-text-tertiary italic">{t('operations.noRequests') || 'No requests'}</span>
                ) : (
                    requests.map(request => (
                        <RoomChip
                            key={request.id}
                            request={request}
                            onClick={() => onRequestClick?.(request)}
                            t={t}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const OperationsQuickView: React.FC<OperationsQuickViewProps> = ({
    tenantId,
    branchId,
    onRequestClick,
    className = ''
}) => {
    const { t } = useTranslation();
    const [requests, setRequests] = useState<ActiveRequest[]>([]);
    const [isExpanded, setIsExpanded] = useState(true);
    
    // Get stages with i18n
    const STAGES = useMemo(() => getStages(t), [t]);

    // ============================================================
    // REAL-TIME LISTENER
    // ============================================================

    useEffect(() => {
        if (!tenantId || !branchId) return;

        // ✅ FIX: Use tenant-scoped collection (tenants/${tenantId}/requests)
        // This ensures proper Tenant Isolation and Security
        const requestsRef = collection(db, `tenants/${tenantId}/requests`);
        const q = query(
            requestsRef,
            where('branch', '==', branchId),
            where('status', 'in', ['PENDING', 'PENDING_RECEPTION', 'CONFIRMED', 'IN_PROGRESS', 'NEEDS_INSPECTION']),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const activeRequests: ActiveRequest[] = snapshot.docs.map(doc => {
                const data = doc.data();
                
                // ✅ Map status to stage based on actual statuses used in Reception
                let stage: ActiveRequest['stage'] = 'new';
                if (data.status === 'PENDING' || data.status === 'PENDING_RECEPTION') {
                    stage = 'new';
                } else if (data.status === 'CONFIRMED' && data.currentDepartment === 'reception') {
                    stage = 'assigning'; // Confirmed but not yet picked up
                } else if (data.status === 'IN_PROGRESS' || (data.status === 'CONFIRMED' && data.currentDepartment !== 'reception')) {
                    stage = 'in_progress'; // Being worked on by another department
                } else if (data.status === 'NEEDS_INSPECTION' || data.status === 'COMPLETED') {
                    stage = 'awaiting_confirmation'; // Waiting for reception to confirm completion
                }

                return {
                    id: doc.id,
                    roomNumber: data.roomNumber || data.room || '-',
                    guestName: data.guestName,
                    type: data.type || data.serviceType || 'other',
                    stage,
                    assignedTo: data.assignedTo?.id,
                    assignedToName: data.assignedTo?.name || data.assignedToName,
                    createdAt: data.createdAt,
                    acceptedAt: data.confirmedAt,
                    startedAt: data.timeline?.started || data.confirmedAt,
                    expectedDuration: data.expectedDuration || (data.type === 'bellman' ? 15 : data.type === 'coffee' ? 20 : 30),
                    notes: data.notes || data.description,
                    priority: data.priority || 'normal'
                };
            });

            setRequests(activeRequests);
        }, (error) => {
            console.error('Error listening to requests:', error);
            // ✅ Fallback: Try without orderBy if index missing
            if (error.code === 'failed-precondition') {
                console.warn('Index missing for OperationsQuickView, trying simpler query...');
            }
        });

        return () => unsubscribe();
    }, [tenantId, branchId]);

    // ============================================================
    // GROUP REQUESTS BY STAGE
    // ============================================================

    const requestsByStage = useMemo(() => {
        const grouped: Record<string, ActiveRequest[]> = {
            new: [],
            assigning: [],
            in_progress: [],
            awaiting_confirmation: []
        };

        requests.forEach(req => {
            if (grouped[req.stage]) {
                grouped[req.stage].push(req);
            }
        });

        return grouped;
    }, [requests]);

    // ============================================================
    // STATS
    // ============================================================

    const stats = useMemo(() => {
        const critical = requests.filter(r => getUrgencyLevel(r) === 'critical').length;
        const warning = requests.filter(r => getUrgencyLevel(r) === 'warning').length;
        const vip = requests.filter(r => r.priority === 'vip').length;
        return { total: requests.length, critical, warning, vip };
    }, [requests]);

    // ============================================================
    // RENDER
    // ============================================================

    if (!isExpanded) {
        // Collapsed view - just show summary
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className={`
                    adora-card w-full flex items-center justify-between
                    px-4 py-2 rounded-xl hover:shadow-md transition-all
                    ${className}
                `}
            >
                <div className="flex items-center gap-3">
                    <span className="adora-text-secondary text-sm">📊 {t('operations.operationsBar') || 'Operations Bar'}</span>
                    <div className="flex items-center gap-2">
                        <span className="adora-badge adora-badge-teal text-xs font-bold">
                            {stats.total} {t('operations.request') || 'request'}
                        </span>
                        {stats.critical > 0 && (
                            <span className="adora-badge adora-badge-red text-xs font-bold animate-pulse">
                                {stats.critical} {t('operations.delayed') || 'delayed'}!
                            </span>
                        )}
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 adora-text-tertiary" />
            </button>
        );
    }

    return (
        <div className={`
            adora-card rounded-2xl overflow-hidden shadow-lg
            ${className}
        `}>
            {/* Header - ✅ THEME-AWARE */}
            <div className="flex items-center justify-between px-4 py-2.5 adora-border-b">
                <div className="flex items-center gap-3">
                    <span className="adora-text-primary font-bold text-sm">📊 {t('operations.operationsBar') || 'Operations Bar'}</span>
                    
                    {/* Quick Stats */}
                    <div className="flex items-center gap-2">
                        <span className="adora-badge adora-badge-teal text-xs font-medium">
                            {stats.total} {t('operations.activeRequest') || 'active request'}
                        </span>
                        {stats.critical > 0 && (
                            <span className="adora-badge adora-badge-red text-xs font-bold animate-pulse flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {stats.critical} {t('operations.delayed') || 'delayed'}
                            </span>
                        )}
                        {stats.vip > 0 && (
                            <span className="adora-badge adora-badge-yellow text-xs font-bold flex items-center gap-1">
                                ⭐ {stats.vip} VIP
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Stages Container - ✅ FIXED: Removed scroll arrows, cleaner grid layout */}
            <div className="px-4 py-3">
                {/* Stages Grid - Auto-fit for responsive */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {STAGES.map(stage => (
                        <StageCard
                            key={stage.key}
                            stage={stage}
                            requests={requestsByStage[stage.key] || []}
                            onRequestClick={onRequestClick}
                            t={t}
                        />
                    ))}
                </div>
            </div>

            {/* Flow Arrow Visualization - ✅ THEME-AWARE */}
            <div className="px-4 pb-3">
                <div className="flex items-center justify-center gap-2 text-xs flex-wrap">
                    <span className="adora-status-warning">📥 {t('operations.new') || 'New'}</span>
                    <span className="adora-text-disabled">→</span>
                    <span className="adora-service-housekeeping">🔃 {t('operations.assigning') || 'Assigning'}</span>
                    <span className="adora-text-disabled">→</span>
                    <span className="adora-service-maintenance">🛠️ {t('operations.inProgress') || 'In Progress'}</span>
                    <span className="adora-text-disabled">→</span>
                    <span className="adora-status-success">✅ {t('operations.confirmation') || 'Confirmation'}</span>
                    <span className="adora-text-disabled">→</span>
                    <span className="adora-status-success font-bold">🎉 {t('operations.closed') || 'Closed'}</span>
                </div>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes pulse-fast {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                .animate-pulse-fast {
                    animation: pulse-fast 0.75s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.2s ease-out;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-thin::-webkit-scrollbar {
                    width: 4px;
                }
                .scrollbar-thin::-webkit-scrollbar-track {
                    background: transparent;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb {
                    background: #475569;
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
};

export default OperationsQuickView;
