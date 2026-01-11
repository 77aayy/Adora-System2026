import React from 'react';
import {
    Clock,
    CheckCircle,
    PlayCircle,
    XCircle,
    Wrench,
    User,
    DoorOpen,
    Sparkles,
    BellRing,
    Package,
    ShoppingCart,
    Users,
    PauseCircle,
    Repeat,
    Calendar,
    AlertTriangle
} from 'lucide-react';
import { Request, RequestStatus } from '../../types';

// ============================================================
// TYPES
// ============================================================

type ViewMode = 'guest' | 'reception' | 'housekeeping' | 'maintenance' | 'bellman';

interface UnifiedRequestCardProps {
    request: Request;
    viewMode: ViewMode;
    onAction: (action: string) => void;
    isDelayed?: boolean;
    // ✅ Smart Features (Phase 10)
    isGhostOrder?: boolean; // Scenario 1: Pulsing Red Alert
    isPotentialDuplicate?: boolean; // Scenario 2: Yellow Warning
    onMove?: () => void; // Added for room move
}

// ============================================================
// STATUS CONFIGURATION
// ============================================================

const statusConfig: Record<RequestStatus, {
    label: string;
    labelAr: string;
    badgeClass: string;
    icon: React.ReactNode;
}> = {
    [RequestStatus.PENDING_RECEPTION]: {
        label: 'Pending',
        labelAr: 'بانتظار التأكيد',
        badgeClass: 'badge-pending',
        icon: <Clock className="w-3.5 h-3.5" />,
    },
    [RequestStatus.CONFIRMED]: {
        label: 'Confirmed',
        labelAr: 'تم التأكيد',
        badgeClass: 'badge-confirmed',
        icon: <CheckCircle className="w-3.5 h-3.5" />,
    },
    [RequestStatus.IN_PROGRESS]: {
        label: 'In Progress',
        labelAr: 'قيد التنفيذ',
        badgeClass: 'badge-progress',
        icon: <PlayCircle className="w-3.5 h-3.5" />,
    },
    [RequestStatus.WAITING_PARTS]: {
        label: 'Waiting for Parts',
        labelAr: 'بانتظار قطع',
        badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/50',
        icon: <PauseCircle className="w-3.5 h-3.5" />,
    },
    [RequestStatus.COMPLETED]: {
        label: 'Completed',
        labelAr: 'مكتمل',
        badgeClass: 'badge-completed',
        icon: <CheckCircle className="w-3.5 h-3.5" />,
    },
    [RequestStatus.MAINTENANCE_PENDING]: {
        label: 'Maintenance',
        labelAr: 'بانتظار الصيانة',
        badgeClass: 'badge-maintenance',
        icon: <Wrench className="w-3.5 h-3.5" />,
    },
    [RequestStatus.PENDING_HOUSEKEEPING]: {
        label: 'Pending Inspection',
        labelAr: 'بانتظار الفحص',
        badgeClass: 'badge-maintenance',
        icon: <Sparkles className="w-3.5 h-3.5" />,
    },
    [RequestStatus.PENDING_MAINTENANCE]: {
        label: 'Maintenance Pending',
        labelAr: 'صيانة معلقة',
        badgeClass: 'bg-rose-500/20 text-rose-400 border border-rose-500/50',
        icon: <Wrench className="w-3.5 h-3.5" />,
    },
    [RequestStatus.CANCELLED]: {
        label: 'Cancelled',
        labelAr: 'ملغي',
        badgeClass: 'badge-cancelled',
        icon: <XCircle className="w-3.5 h-3.5" />,
    },
    [RequestStatus.SCHEDULED]: {
        label: 'Scheduled',
        labelAr: 'مجدول',
        badgeClass: 'bg-purple-500/20 text-purple-400 border border-purple-500/50',
        icon: <Calendar className="w-3.5 h-3.5" />,
    },
    [RequestStatus.NEEDS_INSPECTION]: {
        label: 'Needs Inspection',
        labelAr: 'يحتاج فحص',
        badgeClass: 'bg-orange-500/20 text-orange-400 border border-orange-500/50',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
};

// ============================================================
// REQUEST TYPE ICONS
// ============================================================

const requestTypeIcons: Record<Request['type'], React.ReactNode> = {
    cleaning: <Sparkles className="w-5 h-5 text-blue-400" />,
    maintenance: <Wrench className="w-5 h-5 text-orange-400" />,
    amenities: <Package className="w-5 h-5 text-purple-400" />,
    bellman: <BellRing className="w-5 h-5 text-yellow-400" />,
    vip_service: <Sparkles className="w-5 h-5 text-amber-400" />,
    other: <Package className="w-5 h-5 text-gray-400" />,
};

// ============================================================
// COMPONENT
// ============================================================

export const UnifiedRequestCard: React.FC<UnifiedRequestCardProps> = ({
    request,
    viewMode,
    onAction,
    isDelayed,
    isGhostOrder,
    isPotentialDuplicate,
    onMove,
}) => {
    const statusInfo = statusConfig[request.status];

    // Format timestamp
    const formatTime = (date: Date) => {
        return new Intl.DateTimeFormat('ar-SA', {
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    // Determine which action buttons to show based on viewMode and status
    const renderActionButtons = () => {
        // Guest view - no action buttons
        if (viewMode === 'guest') {
            return null;
        }

        // Reception view
        if (viewMode === 'reception') {
            if (request.status === RequestStatus.PENDING_RECEPTION) {
                return (
                    <div className="flex gap-2 w-full">
                        <button
                            onClick={() => onAction('confirm')}
                            className="btn-primary flex-1"
                        >
                            <CheckCircle className="w-4 h-4" />
                            تأكيد الطلب
                        </button>
                        {/* 🏨 Room Move Action */}
                        {onMove && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onMove();
                                }}
                                className="p-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors"
                                title="نقل النزيل (تحويل الغرفة)"
                            >
                                <Repeat className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                );
            }
        }

        // Housekeeping view
        if (viewMode === 'housekeeping') {
            if (request.status === RequestStatus.CONFIRMED) {
                return (
                    <button
                        onClick={() => onAction('start_cleaning')}
                        className="btn-primary w-full"
                    >
                        <PlayCircle className="w-4 h-4" />
                        بدء التنظيف
                    </button>
                );
            }
            if (request.status === RequestStatus.IN_PROGRESS) {
                return (
                    <button
                        onClick={() => onAction('complete')}
                        className="btn-success w-full"
                    >
                        <CheckCircle className="w-4 h-4" />
                        إنهاء التنظيف
                    </button>
                );
            }
        }

        // Maintenance view
        if (viewMode === 'maintenance') {
            if (request.status === RequestStatus.MAINTENANCE_PENDING) {
                return (
                    <button
                        onClick={() => onAction('start_maintenance')}
                        className="btn-primary w-full"
                    >
                        <Wrench className="w-4 h-4" />
                        بدء الصيانة
                    </button>
                );
            }
            if (request.status === RequestStatus.IN_PROGRESS) {
                return (
                    <button
                        onClick={() => onAction('complete')}
                        className="btn-success w-full"
                    >
                        <CheckCircle className="w-4 h-4" />
                        إنهاء الصيانة
                    </button>
                );
            }
        }

        // Bellman view
        if (viewMode === 'bellman') {
            if (request.status === RequestStatus.CONFIRMED) {
                return (
                    <button
                        onClick={() => onAction('start_delivery')}
                        className="btn-primary w-full"
                    >
                        <PlayCircle className="w-4 h-4" />
                        بدء التوصيل
                    </button>
                );
            }
            if (request.status === RequestStatus.IN_PROGRESS) {
                return (
                    <button
                        onClick={() => onAction('complete')}
                        className="btn-success w-full"
                    >
                        <CheckCircle className="w-4 h-4" />
                        تم التوصيل
                    </button>
                );
            }
        }

        return null;
    };

    return (
        <div className="glass-card group animate-fade-in">
            {/* Header: Room Number & Status */}
            <div className="flex items-start justify-between mb-4">
                {/* Room Info */}
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center">
                        <DoorOpen className="w-6 h-6 text-primary-400" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white">
                            {request.roomNumber}
                        </h3>
                        <div className="flex items-center gap-1.5 text-white/60 text-sm">
                            <User className="w-3.5 h-3.5" />
                            {request.guestName}
                        </div>
                    </div>
                </div>

                {/* Status Badge */}
                <div className="flex flex-col items-end gap-1">
                    {/* 👻 Scenario 1: Ghost Order Alert */}
                    {isGhostOrder && (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-red-600 animate-pulse text-white text-xs font-bold rounded-full border border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.7)]">
                            <Repeat className="w-3.5 h-3.5" />
                            النزيل غادر!
                        </span>
                    )}

                    {/* 🔁 Scenario 2: Duplicate Alert */}
                    {isPotentialDuplicate && (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-[10px] rounded border border-yellow-500/30">
                            <Repeat className="w-3 h-3" />
                            مكرر محتمل
                        </span>
                    )}

                    <span className={`badge ${isDelayed ? 'bg-red-500/20 text-red-400 border border-red-500/50' : statusInfo.badgeClass}`}>
                        {isDelayed ? (
                            <>
                                <Clock className="w-3.5 h-3.5 animate-pulse" />
                                <span>متأخر</span>
                            </>
                        ) : (
                            <>
                                {statusInfo.icon}
                                {statusInfo.labelAr}
                            </>
                        )}
                    </span>
                </div>
            </div>

            {/* Request Type & Details */}
            <div className="flex items-center gap-2 mb-3 text-white/80">
                {requestTypeIcons[request.type]}
                <span className="text-sm capitalize">
                    {request.type === 'cleaning' && 'تنظيف'}
                    {request.type === 'maintenance' && 'صيانة'}
                    {request.type === 'amenities' && 'مستلزمات'}
                    {request.type === 'bellman' && 'بيلمان'}
                    {request.type === 'vip_service' && 'خدمة VIP'}
                    {request.type === 'other' && 'أخرى'}
                </span>

                {/* Bellman Specific Indicators (Human Logic) */}
                {request.type === 'bellman' && (
                    <div className="flex items-center gap-1.5 mr-auto pl-2 border-r border-white/10 pr-2">
                        {request.needsCart && (
                            <span className="p-1 rounded bg-amber-500/20 text-amber-400" title="يحتاج عربة">
                                <ShoppingCart className="w-3.5 h-3.5" />
                            </span>
                        )}
                        {request.guestsInRoom && (
                            <span className="p-1 rounded bg-purple-500/20 text-purple-400" title="الضيوف في الغرفة">
                                <Users className="w-3.5 h-3.5" />
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Timeline */}
            <div className="flex items-center gap-2 text-white/50 text-xs mb-4">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTime(request.timestamp)}</span>
                {request.assignedTo && (
                    <>
                        <span className="mx-1">•</span>
                        <User className="w-3.5 h-3.5" />
                        <span>{request.assignedTo}</span>
                    </>
                )}
            </div>

            {/* Action Buttons */}
            {renderActionButtons()}
        </div>
    );
};

export default UnifiedRequestCard;
