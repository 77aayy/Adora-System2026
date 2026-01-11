/**
 * Operations Quick-View Bar (شريط العمليات الذكي)
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
import {
    Inbox,
    ArrowRightLeft,
    Wrench,
    CheckCircle2,
    Clock,
    User,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    X,
    Phone,
    MessageSquare,
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

const STAGES: StageConfig[] = [
    {
        key: 'new',
        label: 'طلب جديد',
        icon: <Inbox className="w-4 h-4" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        borderColor: 'border-blue-500/30'
    },
    {
        key: 'assigning',
        label: 'قيد التوجيه',
        icon: <ArrowRightLeft className="w-4 h-4" />,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        borderColor: 'border-amber-500/30'
    },
    {
        key: 'in_progress',
        label: 'جاري التنفيذ',
        icon: <Wrench className="w-4 h-4" />,
        color: 'text-teal-400',
        bgColor: 'bg-teal-500/20',
        borderColor: 'border-teal-500/30'
    },
    {
        key: 'awaiting_confirmation',
        label: 'انتظار التأكيد',
        icon: <CheckCircle2 className="w-4 h-4" />,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        borderColor: 'border-purple-500/30'
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
const getRemainingTime = (request: ActiveRequest): string => {
    const startTime = request.startedAt || request.acceptedAt || request.createdAt;
    if (!startTime) return '-';

    const elapsed = getElapsedMinutes(startTime);
    const expected = request.expectedDuration || 30;
    const remaining = expected - elapsed;

    if (remaining <= 0) return 'متأخر!';
    return `${remaining} د متبقية`;
};

// ============================================================
// ROOM CHIP COMPONENT (with Tooltip)
// ============================================================

interface RoomChipProps {
    request: ActiveRequest;
    onClick?: () => void;
}

const RoomChip: React.FC<RoomChipProps> = ({ request, onClick }) => {
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
                            غرفة {request.roomNumber}
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
                            <span>العامل: {request.assignedToName}</span>
                        </div>
                    )}

                    {/* Timeline Mini */}
                    <div className="bg-slate-900/50 rounded-lg p-2 mb-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className={`font-bold ${
                                urgency === 'critical' ? 'text-red-400' :
                                urgency === 'warning' ? 'text-amber-400' : 'text-teal-400'
                            }`}>
                                {getRemainingTime(request)}
                            </span>
                            <div className="flex items-center gap-1 text-slate-400">
                                <Clock className="w-3 h-3" />
                                <span>مضى: {elapsed}</span>
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
                            عرض
                        </button>
                        <button className="flex-1 flex items-center justify-center gap-1 
                                           py-1.5 rounded-lg bg-slate-700 text-white text-xs
                                           hover:bg-slate-600 transition-colors">
                            <Phone className="w-3 h-3" />
                            اتصال
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

const StageCard: React.FC<StageCardProps> = ({ stage, requests, onRequestClick }) => {
    const criticalCount = requests.filter(r => getUrgencyLevel(r) === 'critical').length;
    const warningCount = requests.filter(r => getUrgencyLevel(r) === 'warning').length;

    return (
        <div className={`
            flex-shrink-0 min-w-[180px] max-w-[280px]
            rounded-xl border ${stage.borderColor} ${stage.bgColor}
            p-3 transition-all duration-300
            ${criticalCount > 0 ? 'ring-2 ring-red-500/50' : ''}
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
                        <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-xs font-bold animate-pulse">
                            {criticalCount}!
                        </span>
                    )}
                    {warningCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-xs font-bold">
                            {warningCount}
                        </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-slate-700 text-white text-xs font-bold">
                        {requests.length}
                    </span>
                </div>
            </div>

            {/* Room Chips */}
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto scrollbar-thin">
                {requests.length === 0 ? (
                    <span className="text-xs text-slate-500 italic">لا يوجد طلبات</span>
                ) : (
                    requests.map(request => (
                        <RoomChip
                            key={request.id}
                            request={request}
                            onClick={() => onRequestClick?.(request)}
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
    const [requests, setRequests] = useState<ActiveRequest[]>([]);
    const [isExpanded, setIsExpanded] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    // ============================================================
    // REAL-TIME LISTENER
    // ============================================================

    useEffect(() => {
        if (!tenantId || !branchId) return;

        // Listen to active requests
        const requestsRef = collection(db, `tenants/${tenantId}/branches/${branchId}/requests`);
        const q = query(
            requestsRef,
            where('status', 'in', ['pending', 'assigned', 'in_progress', 'awaiting_confirmation']),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const activeRequests: ActiveRequest[] = snapshot.docs.map(doc => {
                const data = doc.data();
                
                // Map status to stage
                let stage: ActiveRequest['stage'] = 'new';
                if (data.status === 'assigned') stage = 'assigning';
                else if (data.status === 'in_progress') stage = 'in_progress';
                else if (data.status === 'awaiting_confirmation') stage = 'awaiting_confirmation';

                return {
                    id: doc.id,
                    roomNumber: data.roomNumber || data.room || '-',
                    guestName: data.guestName,
                    type: data.type || data.requestType || 'other',
                    stage,
                    assignedTo: data.assignedTo,
                    assignedToName: data.assignedToName || data.workerName,
                    createdAt: data.createdAt,
                    acceptedAt: data.acceptedAt,
                    startedAt: data.startedAt,
                    expectedDuration: data.expectedDuration || 30,
                    notes: data.notes || data.description,
                    priority: data.priority || 'normal'
                };
            });

            setRequests(activeRequests);
        }, (error) => {
            console.error('Error listening to requests:', error);
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
    // SCROLL HANDLERS
    // ============================================================

    const scrollLeft = () => {
        scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
    };

    const scrollRight = () => {
        scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
    };

    // ============================================================
    // RENDER
    // ============================================================

    if (!isExpanded) {
        // Collapsed view - just show summary
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className={`
                    w-full flex items-center justify-between
                    px-4 py-2 rounded-xl
                    bg-slate-800/50 border border-slate-700
                    hover:bg-slate-800 transition-colors
                    ${className}
                `}
            >
                <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-sm">📊 شريط العمليات</span>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">
                            {stats.total} طلب
                        </span>
                        {stats.critical > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                                {stats.critical} متأخر!
                            </span>
                        )}
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
        );
    }

    return (
        <div className={`
            rounded-xl border border-slate-700
            bg-gradient-to-r from-slate-800/80 to-slate-900/80
            backdrop-blur-sm overflow-hidden
            ${className}
        `}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                    <span className="text-white font-bold text-sm">📊 شريط العمليات</span>
                    
                    {/* Quick Stats */}
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-xs">
                            {stats.total} طلب نشط
                        </span>
                        {stats.critical > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {stats.critical} متأخر
                            </span>
                        )}
                        {stats.vip > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center gap-1">
                                ⭐ {stats.vip} VIP
                            </span>
                        )}
                    </div>
                </div>

                {/* Collapse Button */}
                <button
                    onClick={() => setIsExpanded(false)}
                    className="p-1 rounded hover:bg-slate-700 transition-colors"
                >
                    <X className="w-4 h-4 text-slate-400" />
                </button>
            </div>

            {/* Stages Container */}
            <div className="relative px-2 py-3">
                {/* Scroll Left Button */}
                <button
                    onClick={scrollLeft}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10
                               w-8 h-8 rounded-full bg-slate-800/90 border border-slate-600
                               flex items-center justify-center
                               hover:bg-slate-700 transition-colors shadow-lg"
                >
                    <ChevronLeft className="w-4 h-4 text-white" />
                </button>

                {/* Scrollable Stages */}
                <div
                    ref={scrollRef}
                    className="flex gap-3 overflow-x-auto scrollbar-hide px-6"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {STAGES.map(stage => (
                        <StageCard
                            key={stage.key}
                            stage={stage}
                            requests={requestsByStage[stage.key] || []}
                            onRequestClick={onRequestClick}
                        />
                    ))}
                </div>

                {/* Scroll Right Button */}
                <button
                    onClick={scrollRight}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10
                               w-8 h-8 rounded-full bg-slate-800/90 border border-slate-600
                               flex items-center justify-center
                               hover:bg-slate-700 transition-colors shadow-lg"
                >
                    <ChevronRight className="w-4 h-4 text-white" />
                </button>
            </div>

            {/* Flow Arrow Visualization */}
            <div className="px-4 pb-2">
                <div className="flex items-center justify-center gap-1 text-slate-500 text-xs">
                    <span className="text-blue-400">📥 جديد</span>
                    <span>→</span>
                    <span className="text-amber-400">🔃 توجيه</span>
                    <span>→</span>
                    <span className="text-teal-400">🛠️ تنفيذ</span>
                    <span>→</span>
                    <span className="text-purple-400">✅ تأكيد</span>
                    <span>→</span>
                    <span className="text-green-400">🎉 إغلاق</span>
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
