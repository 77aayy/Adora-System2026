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
import { useTranslation } from 'react-i18next';

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
// STATUS CONFIGURATION - Will be created with useMemo inside component
// ============================================================

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
    const { t } = useTranslation();
    const statusConfig = React.useMemo<Record<RequestStatus, {
        label: string;
        labelAr: string;
        badgeClass: string;
        icon: React.ReactNode;
    }>>(() => ({
        [RequestStatus.PENDING_RECEPTION]: {
            label: 'Pending',
            labelAr: t('reception.statusLabels.pendingReception') || 'بانتظار التأكيد',
            badgeClass: 'badge-pending',
            icon: <Clock className="w-3.5 h-3.5" />,
        },
        [RequestStatus.CONFIRMED]: {
            label: 'Confirmed',
            labelAr: t('reception.statusLabels.confirmed') || 'تم التأكيد',
            badgeClass: 'badge-confirmed',
            icon: <CheckCircle className="w-3.5 h-3.5" />,
        },
        [RequestStatus.IN_PROGRESS]: {
            label: 'In Progress',
            labelAr: t('reception.statusLabels.inProgress') || 'قيد التنفيذ',
            badgeClass: 'badge-progress',
            icon: <PlayCircle className="w-3.5 h-3.5" />,
        },
        [RequestStatus.WAITING_PARTS]: {
            label: 'Waiting for Parts',
            labelAr: t('reception.statusLabels.waitingParts') || 'بانتظار قطع',
            badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/50',
            icon: <PauseCircle className="w-3.5 h-3.5" />,
        },
        [RequestStatus.COMPLETED]: {
            label: 'Completed',
            labelAr: t('reception.statusLabels.completed') || 'مكتمل',
            badgeClass: 'badge-completed',
            icon: <CheckCircle className="w-3.5 h-3.5" />,
        },
        [RequestStatus.MAINTENANCE_PENDING]: {
            label: 'Maintenance',
            labelAr: t('maintenance.statusLabels.pending') || 'بانتظار الصيانة',
            badgeClass: 'badge-maintenance',
            icon: <Wrench className="w-3.5 h-3.5" />,
        },
        [RequestStatus.PENDING_HOUSEKEEPING]: {
            label: 'Pending Inspection',
            labelAr: t('reception.statusLabels.needsInspection') || 'بانتظار الفحص',
            badgeClass: 'badge-maintenance',
            icon: <Sparkles className="w-3.5 h-3.5" />,
        },
        [RequestStatus.PENDING_MAINTENANCE]: {
            label: 'Maintenance Pending',
            labelAr: t('maintenance.statusLabels.pending') || 'صيانة معلقة',
            badgeClass: 'bg-rose-500/20 text-rose-400 border border-rose-500/50',
            icon: <Wrench className="w-3.5 h-3.5" />,
        },
        [RequestStatus.CANCELLED]: {
            label: 'Cancelled',
            labelAr: t('common.cancelled') || 'ملغي',
            badgeClass: 'badge-cancelled',
            icon: <XCircle className="w-3.5 h-3.5" />,
        },
        [RequestStatus.SCHEDULED]: {
            label: 'Scheduled',
            labelAr: t('reception.statusLabels.scheduled') || 'مجدول',
            badgeClass: 'bg-purple-500/20 text-purple-400 border border-purple-500/50',
            icon: <Calendar className="w-3.5 h-3.5" />,
        },
        [RequestStatus.NEEDS_INSPECTION]: {
            label: 'Needs Inspection',
            labelAr: t('reception.statusLabels.needsInspection') || 'يحتاج فحص',
            badgeClass: 'bg-orange-500/20 text-orange-400 border border-orange-500/50',
            icon: <AlertTriangle className="w-3.5 h-3.5" />,
        },
    }), [t]);
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

        // Compact button styles
        const btnPrimary = "flex-1 py-1.5 px-2 rounded-lg bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1";
        const btnSuccess = "flex-1 py-1.5 px-2 rounded-lg bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1";
        const btnSecondary = "py-1.5 px-2 rounded-lg text-xs font-medium adora-bg-tertiary adora-text-secondary flex items-center gap-1";

        // Reception view
        if (viewMode === 'reception') {
            if (request.status === RequestStatus.PENDING_RECEPTION) {
                return (<>
                    <button onClick={() => onAction('confirm')} className={btnPrimary}>
                        <CheckCircle className="w-3 h-3" /> {t('common.confirm') || 'تأكيد'}
                    </button>
                    {onMove && (
                        <button onClick={(e) => { e.stopPropagation(); onMove(); }} className={btnSecondary} title={t('common.move') || 'نقل'}>
                            <Repeat className="w-3 h-3" />
                        </button>
                    )}
                </>);
            }
        }

        // Housekeeping view
        if (viewMode === 'housekeeping') {
            if (request.status === RequestStatus.CONFIRMED) {
                return <button onClick={() => onAction('start_cleaning')} className={btnPrimary}>
                    <PlayCircle className="w-3 h-3" /> بدء
                </button>;
            }
            if (request.status === RequestStatus.IN_PROGRESS) {
                return <button onClick={() => onAction('complete')} className={btnSuccess}>
                    <CheckCircle className="w-3 h-3" /> إنهاء
                </button>;
            }
        }

        // Maintenance view
        if (viewMode === 'maintenance') {
            if (request.status === RequestStatus.MAINTENANCE_PENDING) {
                return <button onClick={() => onAction('start_maintenance')} className={btnPrimary}>
                    <Wrench className="w-3 h-3" /> بدء
                </button>;
            }
            if (request.status === RequestStatus.IN_PROGRESS) {
                return <button onClick={() => onAction('complete')} className={btnSuccess}>
                    <CheckCircle className="w-3 h-3" /> إنهاء
                </button>;
            }
        }

        // Bellman view
        if (viewMode === 'bellman') {
            if (request.status === RequestStatus.CONFIRMED) {
                return <button onClick={() => onAction('start_delivery')} className={btnPrimary}>
                    <PlayCircle className="w-3 h-3" /> بدء
                </button>;
            }
            if (request.status === RequestStatus.IN_PROGRESS) {
                return <button onClick={() => onAction('complete')} className={btnSuccess}>
                    <CheckCircle className="w-3 h-3" /> تم
                </button>;
            }
        }

        return null;
    };

    // Get type label
    const getTypeLabel = () => {
        const labels: Record<string, string> = {
            cleaning: 'تنظيف', maintenance: 'صيانة', amenities: 'مستلزمات',
            bellman: 'بيلمان', vip_service: 'VIP', other: 'أخرى'
        };
        return labels[request.type] || 'أخرى';
    };

    return (
        <div className={`
            p-3 rounded-xl cursor-pointer transition-all duration-200
            hover:scale-[1.01] active:scale-[0.99] adora-card border shadow-sm
            ${isDelayed ? 'border-red-500/50 ring-1 ring-red-500/30' : 'adora-border'}
            ${isGhostOrder ? 'ring-2 ring-red-500 animate-pulse' : ''}
        `}>
            {/* Row 1: Room + Type + Status */}
            <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-lg flex-shrink-0 bg-primary-500/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-400">{request.roomNumber}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] adora-text-secondary">{getTypeLabel()}</span>
                        {isGhostOrder && <span className="text-[9px] text-red-500 font-bold">النزيل غادر!</span>}
                        {isPotentialDuplicate && <span className="text-[9px] text-yellow-500">مكرر؟</span>}
                    </div>
                    <p className="text-[10px] adora-text-tertiary truncate">{request.guestName}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        isDelayed ? 'bg-red-500/20 text-red-500' : statusInfo?.badgeClass || 'bg-gray-500/20 text-gray-400'
                    }`}>
                        {isDelayed ? t('common.delayed') || 'متأخر' : statusInfo?.labelAr || t('common.new') || 'جديد'}
                    </span>
                    <span className="text-[10px] adora-text-disabled">{formatTime(request.timestamp)}</span>
                </div>
            </div>

            {/* Row 2: Bellman Indicators */}
            {request.type === 'bellman' && (request.needsCart || request.guestsInRoom) && (
                <div className="flex items-center gap-2 mb-2 text-[10px]">
                    {request.needsCart && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500">
                            <ShoppingCart className="w-3 h-3" /> عربة
                        </span>
                    )}
                    {request.guestsInRoom && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-500">
                            <Users className="w-3 h-3" /> موجودين
                        </span>
                    )}
                </div>
            )}

            {/* Row 3: Actions */}
            <div className="flex gap-2 pt-2 border-t adora-border">
                {renderActionButtons()}
            </div>
        </div>
    );
};

export default UnifiedRequestCard;
