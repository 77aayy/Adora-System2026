/**
 * Compact Request Card Component
 * Mobile-First with Essential Info
 * Extracted from ReceptionDashboard for better code splitting
 */

import React, { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Sparkles, Check, Eye, User, DoorOpen, MessageSquare, 
    ArrowRightLeft, QrCode 
} from 'lucide-react';
import { ServiceRequest } from '../../types/request';
import { getDeptName } from '../../utils/departmentUtils';
import type { QuickAction } from '../../utils/quickActionsConfig';
import type { StatusConfig } from '../../utils/statusConfig';

interface CompactRequestCardProps {
    request: ServiceRequest;
    onView: () => void;
    onQuickAction?: (action: 'confirm' | 'complete') => void;
    quickActions: QuickAction[];
    serviceNames: Record<string, string>;
    statusConfig: StatusConfig;
}

// ✅ PERFORMANCE: Memoized to prevent unnecessary re-renders
export const CompactRequestCard: React.FC<CompactRequestCardProps> = React.memo(({ 
    request, 
    onView, 
    onQuickAction, 
    quickActions, 
    serviceNames, 
    statusConfig 
}) => {
    const { t } = useTranslation();
    const serviceConfig = quickActions.find(a => a.type === request.type);
    
    // Calculate time ago
    const timeAgo = useMemo(() => {
        if (!request.createdAt) return '';
        const date = request.createdAt.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return t('reception.timeAgo.now');
        if (diff < 60) return `${diff}${t('reception.timeAgo.minutes')}`;
        if (diff < 1440) return `${Math.floor(diff / 60)}${t('reception.timeAgo.hours')}`;
        return `${Math.floor(diff / 1440)}${t('reception.timeAgo.days')}`;
    }, [request.createdAt, t]);
    
    const isUrgent = request.priority === 'urgent' || request.isEmergency;
    const isDelayed = request.status !== 'COMPLETED' && request.createdAt && 
        (Date.now() - (request.createdAt.toDate ? request.createdAt.toDate() : new Date(request.createdAt)).getTime()) > 30 * 60000;
    const isQR = request.source === 'QR';
    // ✅ Reception Alert: Turquoise border when action required
    const isActionRequiredByReception = (request as any).isActionRequiredByReception || false;
    
    return (
        <div
            onClick={onView}
            className={`
                p-3 rounded-xl cursor-pointer
                transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]
                adora-card border shadow-sm
                ${isActionRequiredByReception ? 'border-teal-500 ring-2 ring-teal-500/30 reception-alert-pulse' : ''}
                ${isUrgent ? 'border-red-500/50 ring-1 ring-red-500/30' : ''}
                ${!isActionRequiredByReception && !isUrgent ? 'adora-border' : ''}
                ${isDelayed ? 'border-orange-500/50 ring-1 ring-orange-500/30' : ''}
                ${isQR ? 'border-teal-500/50' : ''}
            `}
        >
            {/* Row 1: Room + Service + Status */}
            <div className="flex items-center gap-2 mb-2">
                {/* Service Icon */}
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 ${serviceConfig?.bgColor || 'adora-bg-tertiary'} flex items-center justify-center`}>
                    <span className={`${serviceConfig?.color || 'adora-text-tertiary'} scale-[0.6]`}>
                        {serviceConfig?.icon ? <serviceConfig.icon className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    </span>
                </div>
                
                {/* Room & Service */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-base font-bold adora-text-primary">{t('reception.room.roomShort')}{request.roomNumber}</span>
                        {isUrgent && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                        {isQR && (
                            <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-600 dark:text-teal-400 text-[9px] font-bold flex items-center gap-0.5">
                                <QrCode className="w-2.5 h-2.5" /> QR
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] adora-text-secondary">{serviceNames[request.type] || request.type}</p>
                </div>
                
                {/* Time & Status */}
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        request.status === 'COMPLETED' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                        request.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                        request.status === 'CONFIRMED' ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400' :
                        'bg-orange-500/20 text-orange-600 dark:text-orange-400'
                    }`}>
                        {request.status === 'COMPLETED' ? t('reception.statusLabels.completed') :
                         request.status === 'IN_PROGRESS' ? t('reception.statusLabels.inProgressShort') :
                         request.status === 'CONFIRMED' ? t('reception.statusLabels.confirmed') : t('reception.statusLabels.newShort')}
                    </div>
                    <span className="text-[10px] adora-text-disabled">{timeAgo}</span>
                </div>
            </div>
            
            {/* Row 2: Guest Info (for QR requests) */}
            {isQR && (request.guestIdentity || request.guestPhone || request.guestName) && (
                <div className="flex items-center gap-2 mb-2 p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
                    <User className="w-3 h-3 text-teal-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-[10px] text-teal-700 dark:text-teal-300">
                        <span className="font-bold">{request.guestName || t('reception.guest.guest')}</span>
                        {request.guestIdentity && <span className="mr-2">• {t('reception.guest.identity')}: {request.guestIdentity}</span>}
                        {request.guestPhone && <span className="mr-2">• {t('reception.guest.phone')}: {request.guestPhone}</span>}
                    </div>
                </div>
            )}
            
            {/* Row 3: Guest Status */}
            {request.guestStatus && (
                <div className={`flex items-center gap-1.5 mb-2 p-1.5 rounded-lg text-[10px] font-medium ${
                    request.guestStatus === 'in' 
                        ? 'bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20' 
                        : 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20'
                }`}>
                    {request.guestStatus === 'in' ? (
                        <><User className="w-3 h-3" /> {t('reception.guestInRoom')}</>
                    ) : (
                        <><DoorOpen className="w-3 h-3" /> {t('reception.roomEmpty')}</>
                    )}
                </div>
            )}
            
            {/* Row 4: Notes (truncated) */}
            {request.notes && request.notes.trim() && (
                <div className="flex items-start gap-1.5 mb-2 p-1.5 rounded-lg bg-slate-500/10 border border-slate-500/20">
                    <MessageSquare className="w-3 h-3 adora-text-secondary flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] adora-text-secondary line-clamp-2">{request.notes}</p>
                </div>
            )}
            
            {/* Row 5: Department Tracking */}
            {request.currentDepartment && request.currentDepartment !== 'reception' && (
                <div className="flex items-center gap-1.5 mb-2 text-[10px] adora-text-tertiary">
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>{t('reception.currentlyIn')}: {getDeptName(request.currentDepartment, t)}</span>
                </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t adora-border">
                {/* Quick Confirm (for pending) */}
                {(request.status === 'PENDING' || request.status === 'PENDING_RECEPTION') && onQuickAction && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onQuickAction('confirm'); }}
                        className="flex-1 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-teal-600 transition-colors"
                    >
                        <Check className="w-3 h-3" /> {t('reception.confirm')}
                    </button>
                )}
                
                {/* View Details */}
                <button
                    onClick={(e) => { e.stopPropagation(); onView(); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center gap-1 adora-bg-tertiary adora-text-secondary hover:adora-bg-secondary transition-colors ${
                        (request.status === 'PENDING' || request.status === 'PENDING_RECEPTION') ? '' : 'flex-1 justify-center'
                    }`}
                >
                    <Eye className="w-3 h-3" /> {t('reception.details')}
                </button>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // ✅ PERFORMANCE: Optimized comparison - only re-render if critical data changes
    const prev = prevProps.request;
    const next = nextProps.request;
    
    // Check if handlers changed (reference equality)
    if (prevProps.onView !== nextProps.onView || 
        prevProps.onQuickAction !== nextProps.onQuickAction) {
        return false; // Re-render needed
    }
    
    // Check if request ID changed (different request)
    if (prev.id !== next.id) {
        return false; // Re-render needed
    }
    
    // Check critical fields that affect UI
    return (
        prev.status === next.status &&
        prev.currentDepartment === next.currentDepartment &&
        prev.priority === next.priority &&
        prev.isEmergency === next.isEmergency &&
        prev.source === next.source &&
        prev.roomNumber === next.roomNumber &&
        prev.type === next.type &&
        prev.notes === next.notes &&
        prev.guestStatus === next.guestStatus &&
        prev.guestName === next.guestName &&
        prev.guestPhone === next.guestPhone &&
        prev.guestIdentity === next.guestIdentity &&
        // Only check createdAt if it's a Timestamp (not a Date)
        (prev.createdAt?.toDate?.()?.getTime() || prev.createdAt) === 
        (next.createdAt?.toDate?.()?.getTime() || next.createdAt)
    );
});

CompactRequestCard.displayName = 'CompactRequestCard';
