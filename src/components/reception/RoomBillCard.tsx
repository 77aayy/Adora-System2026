/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Room Bill Card
 * 
 * ✅ Features:
 * - Shows pending/confirmed amounts
 * - Transaction list
 * - Confirm/Cancel actions
 * - Quick checkout summary
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Receipt,
    Check,
    X,
    Clock,
    DollarSign,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Loader2,
    CreditCard,
    Home
} from 'lucide-react';
import {
    RoomBillSummary,
    FinancialTransaction,
    getRoomBillSummary,
    confirmTransaction,
    cancelTransaction
} from '../../services/financialTrackingService';
import { useAuth } from '../../context/AuthContext';
import { haptic, playSound } from '../../utils/uxEffects';

// ============================================================
// TYPES
// ============================================================

interface RoomBillCardProps {
    tenantId: string;
    branchId: string;
    roomNumber: string;
    currency?: string;
    onUpdate?: () => void;
}

// ============================================================
// TRANSACTION ITEM
// ============================================================

interface TransactionItemProps {
    transaction: FinancialTransaction;
    currency: string;
    onConfirm: () => void;
    onCancel: () => void;
    processing: boolean;
}

const TransactionItem: React.FC<TransactionItemProps & { t: (key: string) => string }> = ({
    transaction,
    currency,
    onConfirm,
    onCancel,
    processing,
    t
}) => {
    const getTypeIcon = () => {
        switch (transaction.type) {
            case 'room_service': return '🍽️';
            case 'minibar': return '🥤';
            case 'laundry': return '🧺';
            default: return '📋';
        }
    };

    const getStatusBadge = () => {
        switch (transaction.status) {
            case 'pending':
                return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">{t('roomBill.pending')}</span>;
            case 'confirmed':
                return <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">✓ {t('roomBill.confirmed')}</span>;
            case 'paid':
                return <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">✓ {t('roomBill.paid')}</span>;
            case 'cancelled':
                return <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">{t('roomBill.cancelled')}</span>;
        }
    };

    return (
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
            <span className="text-2xl">{getTypeIcon()}</span>
            
            <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{transaction.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    {getStatusBadge()}
                    <span className="text-white/40 text-xs">
                        {transaction.createdAt?.toDate().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>

            <div className="text-left">
                <p className="text-white font-bold">
                    {transaction.amount.toFixed(2)} {currency}
                </p>
            </div>

            {transaction.status === 'pending' && (
                <div className="flex gap-1">
                    <button
                        onClick={onConfirm}
                        disabled={processing}
                        className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 
                                   transition-colors disabled:opacity-50"
                        title={t('roomBill.confirm')}
                    >
                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={processing}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 
                                   transition-colors disabled:opacity-50"
                        title={t('roomBill.cancel')}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const RoomBillCard: React.FC<RoomBillCardProps> = ({
    tenantId,
    branchId,
    roomNumber,
    currency = 'SAR',
    onUpdate
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    
    const [billSummary, setBillSummary] = useState<RoomBillSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);

    // ============================================================
    // LOAD DATA
    // ============================================================

    useEffect(() => {
        loadBillSummary();
    }, [tenantId, branchId, roomNumber]);

    const loadBillSummary = async () => {
        setLoading(true);
        try {
            const summary = await getRoomBillSummary(tenantId, branchId, roomNumber);
            setBillSummary(summary);
        } catch (error) {
            console.error('Error loading bill summary:', error);
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // ACTIONS
    // ============================================================

    const handleConfirm = async (transactionId: string) => {
        if (!user) return;
        setProcessing(transactionId);
        haptic('medium');

        try {
            await confirmTransaction(tenantId, branchId, transactionId, user.name);
            await loadBillSummary();
            playSound('success');
            onUpdate?.();
        } catch (error) {
            console.error('Error confirming transaction:', error);
        } finally {
            setProcessing(null);
        }
    };

    const handleCancel = async (transactionId: string) => {
        const reason = prompt(t('roomBill.cancelReason'));
        if (!reason) return;
        
        setProcessing(transactionId);
        haptic('light');

        try {
            await cancelTransaction(tenantId, branchId, transactionId, reason);
            await loadBillSummary();
            onUpdate?.();
        } catch (error) {
            console.error('Error cancelling transaction:', error);
        } finally {
            setProcessing(null);
        }
    };

    // ============================================================
    // RENDER
    // ============================================================

    if (loading) {
        return (
            <div className="bg-slate-900 rounded-xl border border-white/10 p-4 animate-pulse">
                <div className="h-6 bg-white/10 rounded w-1/3 mb-2"></div>
                <div className="h-8 bg-white/10 rounded w-1/2"></div>
            </div>
        );
    }

    if (!billSummary || (billSummary.totalAmount === 0 && billSummary.transactions.length === 0)) {
        return (
            <div className="bg-slate-900 rounded-xl border border-white/10 p-4 text-center text-white/40">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>{t('roomBill.noExpenses')}</p>
            </div>
        );
    }

    const pendingCount = billSummary.transactions.filter(t => t.status === 'pending').length;

    return (
        <div className="bg-slate-900 rounded-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div 
                className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center">
                    <Home className="w-6 h-6 text-teal-400" />
                </div>

                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-white font-bold">{t('roomBill.room')} {roomNumber}</h3>
                        {pendingCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold">
                                {pendingCount} {t('roomBill.pending')}
                            </span>
                        )}
                    </div>
                    {billSummary.guestName && (
                        <p className="text-white/50 text-sm">{billSummary.guestName}</p>
                    )}
                </div>

                <div className="text-left">
                    <p className="text-white font-bold text-lg">
                        {billSummary.totalAmount.toFixed(2)} {currency}
                    </p>
                    <p className="text-white/40 text-xs">{t('roomBill.totalBill')}</p>
                </div>

                {expanded ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
            </div>

            {/* Summary Stats */}
            {expanded && (
                <>
                    <div className="px-4 pb-4 grid grid-cols-3 gap-3">
                        <div className="bg-amber-500/10 rounded-lg p-3 text-center">
                            <Clock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                            <p className="text-amber-400 font-bold">{billSummary.pendingAmount.toFixed(2)}</p>
                            <p className="text-white/40 text-xs">{t('roomBill.pending')}</p>
                        </div>
                        <div className="bg-green-500/10 rounded-lg p-3 text-center">
                            <Check className="w-5 h-5 text-green-400 mx-auto mb-1" />
                            <p className="text-green-400 font-bold">{billSummary.confirmedAmount.toFixed(2)}</p>
                            <p className="text-white/40 text-xs">{t('roomBill.confirmed')}</p>
                        </div>
                        <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                            <CreditCard className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                            <p className="text-blue-400 font-bold">{billSummary.paidAmount.toFixed(2)}</p>
                            <p className="text-white/40 text-xs">{t('roomBill.paid')}</p>
                        </div>
                    </div>

                    {/* Transactions List */}
                    <div className="border-t border-white/10 p-4 space-y-2 max-h-80 overflow-y-auto">
                        {billSummary.transactions.length === 0 ? (
                            <p className="text-center text-white/40 py-4">{t('roomBill.noTransactions')}</p>
                        ) : (
                            billSummary.transactions.map(transaction => (
                                <TransactionItem
                                    key={transaction.id}
                                    transaction={transaction}
                                    currency={currency}
                                    onConfirm={() => handleConfirm(transaction.id!)}
                                    onCancel={() => handleCancel(transaction.id!)}
                                    processing={processing === transaction.id}
                                    t={t}
                                />
                            ))
                        )}
                    </div>

                    {/* Checkout Button */}
                    {billSummary.confirmedAmount > 0 && (
                        <div className="p-4 border-t border-white/10">
                            <button
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 
                                           text-white font-bold flex items-center justify-center gap-2
                                           hover:from-teal-400 hover:to-cyan-400 transition-all"
                            >
                                <CreditCard className="w-5 h-5" />
                                {t('roomBill.settleAccount')} ({billSummary.confirmedAmount.toFixed(2)} {currency})
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default RoomBillCard;
