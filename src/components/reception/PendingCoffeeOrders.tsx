/**
 * Pending Coffee Orders (للاستقبال)
 * قائمة طلبات الكوفي شوب المعلقة للموافقة
 * 
 * ✅ Features:
 * - Real-time order updates
 * - Approve/Reject actions
 * - Order details view
 * - SLA warnings
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import {
    Coffee,
    Check,
    X,
    Clock,
    Home,
    Phone,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Loader2,
    DollarSign
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
    CoffeeOrder,
    subscribeToPendingOrders,
    approveOrder,
    rejectOrder
} from '../../services/coffeeShopFlowService';
import { haptic, playSound } from '../../utils/uxEffects';

// ============================================================
// TYPES
// ============================================================

interface PendingCoffeeOrdersProps {
    tenantId: string;
    branchId: string;
    onUpdate?: () => void;
}

// ============================================================
// ORDER CARD
// ============================================================

interface OrderCardProps {
    order: CoffeeOrder;
    onApprove: () => void;
    onReject: (reason: string) => void;
    processing: boolean;
}

const OrderCard: React.FC<OrderCardProps> = ({
    order,
    onApprove,
    onReject,
    processing
}) => {
    const [expanded, setExpanded] = useState(false);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    // Calculate waiting time
    const waitingMinutes = order.createdAt 
        ? Math.floor((Date.now() - order.createdAt.toDate().getTime()) / 60000)
        : 0;
    const isWarning = waitingMinutes >= 3;
    const isCritical = waitingMinutes >= 5;

    const handleReject = () => {
        if (!rejectReason.trim()) return;
        onReject(rejectReason);
        setShowRejectDialog(false);
        setRejectReason('');
    };

    return (
        <div className={`
            bg-slate-800 rounded-xl border overflow-hidden transition-all
            ${isCritical ? 'border-red-500/50 bg-red-500/5 animate-pulse' :
              isWarning ? 'border-amber-500/30 bg-amber-500/5' :
              'border-white/10'}
        `}>
            {/* Header */}
            <div 
                className="p-4 flex items-center gap-3 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center
                    ${isCritical ? 'bg-red-500/20' : isWarning ? 'bg-amber-500/20' : 'bg-teal-500/20'}
                `}>
                    <Coffee className={`w-6 h-6 ${
                        isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-teal-400'
                    }`} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-white/40" />
                        <span className="text-white font-bold">غرفة {order.roomNumber}</span>
                        {order.priority === 'urgent' && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs animate-pulse">
                                عاجل!
                            </span>
                        )}
                    </div>
                    <p className="text-white/50 text-sm">
                        {order.items.length} أصناف • {order.totalAmount.toFixed(2)} ر.س
                    </p>
                </div>

                <div className={`flex items-center gap-1 text-sm ${
                    isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white/50'
                }`}>
                    <Clock className="w-4 h-4" />
                    <span>{waitingMinutes} د</span>
                    {isCritical && <AlertTriangle className="w-4 h-4 mr-1" />}
                </div>

                {expanded ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="px-4 pb-4 space-y-4">
                    {/* Guest Info */}
                    {(order.guestName || order.guestPhone) && (
                        <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                            {order.guestName && (
                                <span className="text-white/70">{order.guestName}</span>
                            )}
                            {order.guestPhone && (
                                <a 
                                    href={`tel:${order.guestPhone}`}
                                    className="flex items-center gap-1 text-teal-400 hover:text-teal-300"
                                >
                                    <Phone className="w-4 h-4" />
                                    <span>{order.guestPhone}</span>
                                </a>
                            )}
                        </div>
                    )}

                    {/* Items List */}
                    <div className="space-y-2">
                        {order.items.map((item, index) => (
                            <div 
                                key={index}
                                className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-white">{item.name}</span>
                                    <span className="text-white/40 text-sm">x{item.quantity}</span>
                                </div>
                                <span className="text-white/70">
                                    {(item.price * item.quantity).toFixed(2)} ر.س
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between p-3 bg-teal-500/10 rounded-lg">
                        <span className="text-white font-bold flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-teal-400" />
                            الإجمالي
                        </span>
                        <span className="text-teal-400 font-bold text-lg">
                            {order.totalAmount.toFixed(2)} ر.س
                        </span>
                    </div>

                    {/* Notes */}
                    {order.notes && (
                        <div className="p-3 bg-amber-500/10 rounded-lg">
                            <p className="text-amber-400 text-sm">{order.notes}</p>
                        </div>
                    )}

                    {/* Actions */}
                    {!showRejectDialog ? (
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowRejectDialog(true)}
                                disabled={processing}
                                className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-400 font-bold
                                           hover:bg-red-500/30 transition-colors disabled:opacity-50
                                           flex items-center justify-center gap-2"
                            >
                                <X className="w-5 h-5" />
                                رفض
                            </button>
                            <button
                                onClick={onApprove}
                                disabled={processing}
                                className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold
                                           hover:bg-green-600 transition-colors disabled:opacity-50
                                           flex items-center justify-center gap-2"
                            >
                                {processing ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Check className="w-5 h-5" />
                                )}
                                موافقة ✅
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="سبب الرفض..."
                                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                                           text-white placeholder:text-white/40 focus:outline-none focus:border-red-500/50"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowRejectDialog(false)}
                                    className="flex-1 py-2 rounded-xl bg-white/10 text-white/70
                                               hover:bg-white/20 transition-colors"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={!rejectReason.trim() || processing}
                                    className="flex-1 py-2 rounded-xl bg-red-500 text-white font-bold
                                               hover:bg-red-600 transition-colors disabled:opacity-50"
                                >
                                    تأكيد الرفض
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const PendingCoffeeOrders: React.FC<PendingCoffeeOrdersProps> = ({
    tenantId,
    branchId,
    onUpdate
}) => {
    const { user } = useAuth();
    const [orders, setOrders] = useState<CoffeeOrder[]>([]);
    const [processing, setProcessing] = useState<string | null>(null);

    // ============================================================
    // SUBSCRIPTION
    // ============================================================

    useEffect(() => {
        const unsubscribe = subscribeToPendingOrders(tenantId, branchId, (newOrders) => {
            setOrders(newOrders);
            if (newOrders.length > orders.length) {
                playSound('notification');
            }
        });

        return () => unsubscribe();
    }, [tenantId, branchId]);

    // ============================================================
    // ACTIONS
    // ============================================================

    const handleApprove = async (orderId: string) => {
        if (!user) return;
        setProcessing(orderId);
        haptic('success');

        try {
            await approveOrder(tenantId, branchId, orderId, user.id, user.name);
            playSound('success');
            onUpdate?.();
        } catch (error) {
            console.error('Error approving order:', error);
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (orderId: string, reason: string) => {
        if (!user) return;
        setProcessing(orderId);
        haptic('light');

        try {
            await rejectOrder(tenantId, branchId, orderId, user.id, user.name, reason);
            onUpdate?.();
        } catch (error) {
            console.error('Error rejecting order:', error);
        } finally {
            setProcessing(null);
        }
    };

    // ============================================================
    // RENDER
    // ============================================================

    if (orders.length === 0) {
        return null; // Don't show if no pending orders
    }

    return (
        <div className="bg-slate-900 rounded-2xl border border-amber-500/30 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-amber-900/30 to-orange-900/30 border-b border-amber-500/30
                           flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <Coffee className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold">☕ طلبات كوفي شوب</h3>
                        <p className="text-white/50 text-sm">تنتظر الموافقة</p>
                    </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-amber-500 text-white font-bold animate-pulse">
                    {orders.length}
                </span>
            </div>

            {/* Orders List */}
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {orders.map(order => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        onApprove={() => handleApprove(order.id!)}
                        onReject={(reason) => handleReject(order.id!, reason)}
                        processing={processing === order.id}
                    />
                ))}
            </div>
        </div>
    );
};

export default PendingCoffeeOrders;
