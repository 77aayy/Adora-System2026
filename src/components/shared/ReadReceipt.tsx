/**
 * Read Receipt Component
 * WhatsApp-style read receipts for requests
 * ✓ (gray) = sent, ✓✓ (gray) = delivered, ✓✓ (blue) = read
 * Adora Hotel Management System V2
 */

import React, { useState } from 'react';
import { Check, CheckCheck, X, Clock, Users } from 'lucide-react';
import { Request } from '../../types/request';
import { useTranslation } from 'react-i18next';
import { getReadStatus, getViewers, ReadReceiptStatus } from '../../services/requestService';

// ============================================================
// TYPES
// ============================================================

interface ReadReceiptProps {
    request: Request;
    showPopup?: boolean; // هل يظهر popup عند الضغط
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

interface ViewersPopupProps {
    isOpen: boolean;
    onClose: () => void;
    request: Request;
}

// ============================================================
// STATUS CONFIG
// ============================================================

const STATUS_CONFIG: Record<ReadReceiptStatus, {
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    label: string;
}> = {
    sent: {
        icon: <Check className="w-4 h-4" />,
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/10',
        label: 'مُرسل',
    },
    delivered: {
        icon: <CheckCheck className="w-4 h-4" />,
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/10',
        label: 'وصل',
    },
    read: {
        icon: <CheckCheck className="w-4 h-4" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        label: 'مشاهد',
    },
};

// ============================================================
// VIEWERS POPUP
// ============================================================

const ViewersPopup: React.FC<ViewersPopupProps> = ({ isOpen, onClose, request }) => {
    const viewers = getViewers(request);

    if (!isOpen) return null;

    const getDeptName = (dept: string): string => {
        const names: Record<string, string> = {
            bellman: 'البيلمان',
            housekeeping: 'الهاوس كيبنج',
            maintenance: 'الصيانة',
            reception: 'الاستقبال',
            procurement: 'المشتريات',
        };
        return names[dept] || dept;
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" style={{ backdropFilter: 'none' }}
            onClick={onClose}
        >
            <div
                className="glass-card w-full max-w-sm max-h-[60vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <CheckCheck className="w-5 h-5 text-blue-400" />
                        <span className="font-bold text-white">من شاهد الطلب</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10">
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                <div className="p-4">
                    {viewers.length === 0 ? (
                        <div className="text-center py-6">
                            <Clock className="w-10 h-10 text-white/20 mx-auto mb-2" />
                            <p className="text-white/40">لم يشاهد أحد هذا الطلب بعد</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                            {viewers.map((viewer, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <Users className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div>
                                            <span className="text-white font-medium block">{viewer.userName}</span>
                                            <span className="text-xs text-white/50">{getDeptName(viewer.department)}</span>
                                        </div>
                                    </div>
                                    <span className="text-xs text-white/40">
                                        {viewer.viewedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 text-center text-sm text-white/50">
                        <CheckCheck className="w-4 h-4 inline text-blue-400" />
                        {' '}{viewers.length} شاهد الطلب
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ReadReceipt: React.FC<ReadReceiptProps> = ({
    request,
    showPopup = true,
    size = 'md',
    className = '',
}) => {
    const [popupOpen, setPopupOpen] = useState(false);
    const status = getReadStatus(request);
    const config = STATUS_CONFIG[status];
    const viewers = getViewers(request);

    const sizeClasses = {
        sm: 'text-xs gap-0.5',
        md: 'text-sm gap-1',
        lg: 'text-base gap-1.5',
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (showPopup && viewers.length > 0) {
            setPopupOpen(true);
        }
    };

    return (
        <>
            <div
                onClick={handleClick}
                className={`
                    inline-flex items-center ${sizeClasses[size]} ${config.color}
                    ${showPopup && viewers.length > 0 ? 'cursor-pointer hover:opacity-80' : ''}
                    ${className}
                `}
                title={config.label}
            >
                {config.icon}
                {viewers.length > 0 && (
                    <span className="text-xs">{viewers.length}</span>
                )}
            </div>

            {showPopup && (
                <ViewersPopup
                    isOpen={popupOpen}
                    onClose={() => setPopupOpen(false)}
                    request={request}
                />
            )}
        </>
    );
};

// ============================================================
// STATUS LABEL COMPONENT
// ============================================================

interface RequestStatusLabelProps {
    request: Request;
    showReceipt?: boolean;
}

export const RequestStatusLabel: React.FC<RequestStatusLabelProps> = ({
    request,
    showReceipt = true,
}) => {
    const { t } = useTranslation();
    const status = getReadStatus(request);
    const config = STATUS_CONFIG[status];

    // Get status text based on request status
    const getStatusText = (): string => {
        switch (request.status) {
            case 'PENDING_RECEPTION':
                return t('reception.statusLabels.pendingReception') || 'بانتظار التأكيد';
            case 'CONFIRMED':
                return t('reception.statusLabels.confirmed') || 'تم التأكيد';
            case 'IN_PROGRESS':
            case 'CLEANING_IN_PROGRESS':
            case 'MAINTENANCE_IN_PROGRESS':
                return t('common.inProgress') || 'قيد التنفيذ';
            case 'COMPLETED':
                return t('common.completed') || 'مكتمل';
            case 'CANCELLED':
                return t('common.cancelled') || 'ملغي';
            default:
                return t('common.inProgress') || 'قيد المعالجة';
        }
    };

    return (
        <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs ${config.bgColor} ${config.color}`}>
                {getStatusText()}
            </span>
            {showReceipt && <ReadReceipt request={request} size="sm" />}
        </div>
    );
};

export default ReadReceipt;
