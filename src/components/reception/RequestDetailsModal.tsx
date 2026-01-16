/**
 * Request Details Modal Component
 * Extracted from ReceptionDashboard for better code splitting
 */

import React, { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Clock, CheckCircle2, AlertCircle, ShoppingCart, Sparkles } from 'lucide-react';
import { ServiceRequest } from '../../types/request';
import { getDeptName } from '../../utils/departmentUtils';
import { formatDateTimeWithLocale, getTimeAgo } from '../../utils/dateUtils';
import type { QuickAction } from '../../utils/quickActionsConfig';
import type { StatusConfig } from '../../utils/statusConfig';

interface RequestDetailsModalProps {
    request: ServiceRequest | null;
    isOpen: boolean;
    onClose: () => void;
    branchId: string;
    quickActions: QuickAction[];
    serviceNames: Record<string, string>;
    statusConfig: StatusConfig;
}

export const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({ 
    request, 
    isOpen, 
    onClose, 
    branchId, 
    quickActions, 
    serviceNames, 
    statusConfig 
}) => {
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language;
    
    if (!isOpen || !request) return null;

    // ✅ UX: Smooth fade-in animation
    const [isVisible, setIsVisible] = React.useState(false);
    
    React.useEffect(() => {
        if (isOpen && request) {
            // Trigger animation after mount
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
        }
    }, [isOpen, request]);

    // ✅ Format time with dynamic locale - using centralized utility
    const formatTime = useCallback((timestamp: any): string => {
        return formatDateTimeWithLocale(timestamp, currentLanguage, t);
    }, [t, currentLanguage]);

    // ✅ Build timeline from departmentHistory and timeline using t()
    const timelineEvents: Array<{ action: string; time: any; department?: string; by?: string }> = useMemo(() => {
        const events: Array<{ action: string; time: any; department?: string; by?: string }> = [];
        
        // 1. Created
        if (request.createdAt) {
            events.push({
                action: t('reception.requestCreated'),
                time: request.createdAt,
                department: request.originDepartment ? getDeptName(request.originDepartment, t) : undefined,
                by: request.createdBy?.name
            });
        }

        // 2. Department History - Build complete journey
        if (request.departmentHistory && request.departmentHistory.length > 0) {
            request.departmentHistory.forEach((entry: any, index: number) => {
                // When request entered this department
                if (entry.enteredAt) {
                    events.push({
                        action: `${t('reception.sentToDepartment')} ${getDeptName(entry.department, t)}`,
                        time: entry.enteredAt,
                        department: getDeptName(entry.department, t),
                        by: entry.handledBy?.name
                    });
                }
                // When request exited/left this department
                if (entry.exitedAt) {
                    const nextDept = entry.nextDepartment 
                        ? `${t('reception.toDepartment')} ${getDeptName(entry.nextDepartment, t)}` 
                        : t('reception.fromDepartment');
                    events.push({
                        action: `${t('reception.sentFrom')} ${getDeptName(entry.department, t)} ${nextDept}`,
                        time: entry.exitedAt,
                        department: getDeptName(entry.department, t),
                        by: entry.handledBy?.name
                    });
                }
            });
        }

        // 3. Timeline events
        if (request.timeline) {
            if (request.timeline.confirmed) {
                events.push({
                    action: t('reception.requestConfirmed'),
                    time: request.timeline.confirmed,
                    by: request.confirmedBy?.name
                });
            }
            if (request.timeline.started) {
                events.push({
                    action: t('reception.requestStarted'),
                    time: request.timeline.started,
                    by: request.assignedTo?.name || (request as any).startedBy
                });
            }
            if (request.timeline.completed) {
                events.push({
                    action: t('reception.requestCompleted'),
                    time: request.timeline.completed,
                    by: request.completedBy?.name
                });
            }
        }
        
        return events;
    }, [request, t, getDeptName]);

    // ✅ Sort by time (newest first)
    const sortedTimelineEvents = useMemo(() => {
        return [...timelineEvents].sort((a, b) => {
            const aTime = a.time?.toDate ? a.time.toDate().getTime() : new Date(a.time).getTime();
            const bTime = b.time?.toDate ? b.time.toDate().getTime() : new Date(b.time).getTime();
            return bTime - aTime;
        });
    }, [timelineEvents]);

    return (
        <div 
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-opacity duration-300 ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ backdropFilter: 'none' }}
        >
            <div 
                className={`bg-slate-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl transition-all duration-300 ${
                    isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
                }`}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${quickActions.find(a => a.type === request.type)?.bgColor || 'bg-white/10'} flex items-center justify-center`}>
                            {(() => {
                                const action = quickActions.find(a => a.type === request.type);
                                const IconComponent = action?.icon || Sparkles;
                                return <IconComponent className="w-6 h-6 text-white/60" />;
                            })()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{t('common.details')} {t('common.request')}</h2>
                            <p className="text-sm text-white/60">{t('reception.room.room')} {request.roomNumber} - {serviceNames[request.type]}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Basic Info */}
                    <div className="space-y-4 mb-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/60 text-sm mb-1">{t('reception.statusLabel')}</p>
                                <p className="text-white font-medium">{statusConfig[request.status]?.label || request.status}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/60 text-sm mb-1">{t('forms.priority')}</p>
                                <p className="text-white font-medium">{request.priority === 'urgent' ? t('reception.urgent') : t('reception.priority.normal')}</p>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-white/5 rounded-xl">
                            <p className="text-white/60 text-sm mb-1">{t('reception.currentDepartment')}</p>
                            <p className="text-white font-medium">{request.currentDepartment ? getDeptName(request.currentDepartment, t) : t('reception.notSpecified')}</p>
                        </div>

                        {request.guestName && (
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/60 text-sm mb-1">{t('reception.guestNameLabel')}</p>
                                <p className="text-white font-medium">{request.guestName}</p>
                                {request.guestIdentity && (
                                    <p className="text-white/70 text-xs mt-1">{t('reception.identityLabelDetail')} {request.guestIdentity}</p>
                                )}
                                {request.guestPhone && (
                                    <p className="text-white/70 text-xs mt-1">{t('reception.phoneLabelDetail')} {request.guestPhone}</p>
                                )}
                            </div>
                        )}

                        {request.notes && (
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/60 text-sm mb-1">{t('reception.notesLabel')}</p>
                                <p className="text-white">{request.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Timeline */}
                    <div className="border-t border-white/10 pt-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            {t('reception.operationsHistoryFull')}
                        </h3>
                        <div className="space-y-4">
                            {sortedTimelineEvents.length > 0 ? (
                                sortedTimelineEvents.map((event, index) => (
                                    <div key={index} className="flex gap-4">
                                        <div className="flex flex-col items-center pt-1">
                                            <div className="w-3 h-3 rounded-full bg-primary-500 ring-2 ring-primary-500/30" />
                                            {index < sortedTimelineEvents.length - 1 && (
                                                <div className="w-0.5 h-full bg-white/10 min-h-[60px] mt-1" />
                                            )}
                                        </div>
                                        <div className="flex-1 pb-4">
                                            <p className="text-white font-medium text-sm">{event.action}</p>
                                            {event.department && (
                                                <p className="text-white/60 text-xs mt-0.5">📍 {t('reception.inDepartment')} {event.department}</p>
                                            )}
                                            {event.by && (
                                                <p className="text-white/70 text-xs mt-1">{t('reception.byUser')} {event.by}</p>
                                            )}
                                            <p className="text-white/70 text-xs mt-1.5 flex items-center gap-2">
                                                <Clock className="w-3 h-3" />
                                                {formatTime(event.time)}
                                            </p>
                                            <p className="text-white/70 text-xs mt-0.5">{getTimeAgo(event.time, t)}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 bg-white/5 rounded-xl text-center">
                                    <p className="text-white/70 text-sm">{t('reception.noOperationsRecorded')}</p>
                                    <p className="text-white/70 text-xs mt-1">{t('reception.createdAt')} {formatTime(request.createdAt, currentLanguage, t)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* ✅ Inspection Results */}
                    {request.inspectionResult && (
                        <div className="border-t border-white/10 pt-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                {request.inspectionResult === 'clean' && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                                {(request.inspectionResult === 'damages' || request.inspectionResult === 'missing_items') && <AlertCircle className="w-5 h-5 text-orange-400" />}
                                {t('reception.inspectionResult')}
                            </h3>
                            <div className="space-y-4">
                                <div className="p-4 bg-white/5 rounded-xl">
                                    <p className="text-white/60 text-sm mb-1">{t('reception.statusLabel')}</p>
                                    <p className="text-white font-medium">
                                        {request.inspectionResult === 'clean' && `✅ ${t('reception.roomComplete')}`}
                                        {request.inspectionResult === 'damages' && `⚠️ ${t('reception.roomWithDamages')}`}
                                        {request.inspectionResult === 'missing_items' && `📦 ${t('reception.roomWithMissingItems')}`}
                                    </p>
                                </div>

                                {/* Inspection Photo */}
                                {request.inspectionPhoto && (request.inspectionResult === 'damages' || request.inspectionResult === 'missing_items') && (
                                    <div className="p-4 bg-white/5 rounded-xl">
                                        <p className="text-white/60 text-sm mb-3">
                                            {request.inspectionResult === 'damages' ? t('reception.damagePhoto') : t('reception.lostPhoto')}
                                        </p>
                                        <img 
                                            src={request.inspectionPhoto} 
                                            alt={request.inspectionResult === 'damages' ? t('reception.damagePhoto') : t('reception.lostPhoto')}
                                            className="w-full h-64 object-contain rounded-xl cursor-pointer hover:opacity-80 transition-opacity bg-white/5 p-2"
                                            onClick={() => window.open(request.inspectionPhoto, '_blank')}
                                        />
                                    </div>
                                )}

                                {/* Inspection Notes */}
                                {request.inspectionNotes && (
                                    <div className="p-4 bg-white/5 rounded-xl">
                                        <p className="text-white/60 text-sm mb-1">{t('reception.inspectionNotes')}</p>
                                        <p className="text-white">{request.inspectionNotes}</p>
                                    </div>
                                )}

                                {/* Inspected By */}
                                {request.inspectedBy?.name && (
                                    <div className="p-4 bg-white/5 rounded-xl">
                                        <p className="text-white/60 text-sm mb-1">{t('reception.inspectedBy')}</p>
                                        <p className="text-white font-medium">{request.inspectedBy.name}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ✅ Minibar Consumption */}
                    {request.minibarConsumption && request.minibarConsumption.length > 0 && (
                        <div className="border-t border-white/10 pt-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-green-400" />
                                {t('reception.minibarConsumptionTitle')}
                            </h3>
                            <div className="space-y-2">
                                {request.minibarConsumption.map((item, idx) => (
                                    <div key={idx} className="p-4 bg-white/5 rounded-xl flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-medium">{item.productName}</p>
                                            <p className="text-white/60 text-sm">{t('reception.quantityLabel')} {item.quantity} × {item.pricePerUnit} {t('reception.sarCurrency')}</p>
                                        </div>
                                        <p className="text-green-400 font-bold text-lg">{item.total} {t('reception.sarCurrency')}</p>
                                    </div>
                                ))}
                                {request.minibarTotal && (
                                    <div className="p-4 bg-gradient-to-r from-green-500/20 to-primary-500/20 border border-green-500/30 rounded-xl flex items-center justify-between mt-4">
                                        <p className="text-white font-bold">{t('reception.totalLabel')}</p>
                                        <p className="text-green-400 font-bold text-xl">{request.minibarTotal} {t('reception.sarCurrency')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Additional Info */}
                    {(request as any).afterPhoto && (
                        <div className="border-t border-white/10 pt-6">
                            <h3 className="text-lg font-bold text-white mb-4">{t('reception.afterWorkPhotos')}</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <img 
                                    src={(request as any).afterPhoto} 
                                    alt={t('reception.afterWorkAlt')}
                                    className="w-full h-32 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => window.open((request as any).afterPhoto, '_blank')}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex gap-3">
                    <button
                        onClick={() => {
                            // Open room history
                            window.location.href = `#room-history-${request.roomNumber}`;
                        }}
                        className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                    >
                        {t('reception.viewRoomHistory')}
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
                    >
                        {t('reception.closeButton')}
                    </button>
                </div>
            </div>
        </div>
    );
};
