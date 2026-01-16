/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Room Transfer Modal Component
 * Extracted from ReceptionDashboard for better code organization
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Repeat, AlertCircle, X } from 'lucide-react';
import { ServiceRequest } from '../../../types/request';
import { AdoraLoaderInline } from '../../common/AdoraLoader';

interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: ServiceRequest | null;
    targetRoomNumber: string;
    setTargetRoomNumber: (room: string) => void;
    isTransferring: boolean;
    onConfirm: () => void;
    onReset: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
    isOpen,
    onClose,
    request,
    targetRoomNumber,
    setTargetRoomNumber,
    isTransferring,
    onConfirm,
    onReset
}) => {
    const { t } = useTranslation();
    
    // ✅ UX: Smooth fade-in animation
    const [isVisible, setIsVisible] = React.useState(false);
    
    React.useEffect(() => {
        if (isOpen && request) {
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
        }
    }, [isOpen, request]);

    if (!isOpen || !request) return null;

    return (
        <div 
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 transition-opacity duration-300 ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ backdropFilter: 'none' }}
        >
            <div 
                className={`w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative transition-all duration-300 ${
                    isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
                }`}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5 text-white/60" />
                </button>

                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Repeat className="w-6 h-6 text-orange-400" />
                    {t('reception.confirmTransfer')}
                </h2>

                <div className="space-y-4">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-white/60 text-sm mb-1">{t('reception.currentRoom')}</p>
                        <p className="text-xl font-bold text-white">{t('reception.roomNumber', { room: request.roomNumber })}</p>
                        <p className="text-white/70 text-xs mt-1">{request.guestName}</p>
                    </div>

                    <div>
                        <label className="block text-white/70 text-sm mb-2">{t('reception.toNewRoom')}</label>
                        <input
                            type="text"
                            value={targetRoomNumber}
                            onChange={(e) => setTargetRoomNumber(e.target.value)}
                            placeholder={t('reception.newRoomNumberPlaceholder')}
                            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition-colors text-center text-lg font-bold"
                            autoFocus
                        />
                    </div>

                    <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                        <p className="text-orange-400 text-xs flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>
                                {t('reception.transferDescription')}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onConfirm}
                        disabled={!targetRoomNumber || isTransferring}
                        className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isTransferring ? (
                            <AdoraLoaderInline size={20} />
                        ) : (
                            <>
                                <Repeat className="w-5 h-5" />
                                {t('reception.confirmTransfer')}
                            </>
                        )}
                    </button>
                            <button
                        onClick={() => {
                            onClose();
                            onReset();
                        }}
                        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};
