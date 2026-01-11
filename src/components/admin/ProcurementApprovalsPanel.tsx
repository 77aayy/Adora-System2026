/**
 * Procurement Approvals Panel
 * Shows pending procurement requests for manager approval
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { Package, Check, X, Clock, AlertCircle, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { subscribeToPendingApprovals, approveProcurement, rejectProcurement, ProcurementRequest } from '../../services/procurementService';

export const ProcurementApprovalsPanel: React.FC = () => {
    const { user, branchId, tenantId } = useAuth();
    const { success, error, haptic } = useUX();
    const [pendingRequests, setPendingRequests] = useState<ProcurementRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        if (!branchId || !tenantId || !user || (user.role !== 'manager' && user.role !== 'owner')) {
            setLoading(false);
            return;
        }

        // ✅ SaaS: Subscribe to pending approvals with tenantId as first parameter
        const unsubscribe = subscribeToPendingApprovals(tenantId, branchId, (requests) => {
            setPendingRequests(requests);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [branchId, tenantId, user]);

    const handleApprove = async (requestId: string) => {
        if (!user || !tenantId) return;
        try {
            await approveProcurement(requestId, user.id, user.name, tenantId);
            haptic('success');
            success('تم تعميد الطلب بنجاح');
        } catch (err) {
            console.error('Error approving procurement:', err);
            error('فشل تعميد الطلب');
        }
    };

    const handleReject = async (requestId: string) => {
        if (!user || !tenantId || !rejectReason.trim()) {
            error('يرجى إدخال سبب الرفض');
            return;
        }
        try {
            await rejectProcurement(requestId, user.id, user.name, rejectReason, tenantId);
            haptic('medium');
            success('تم رفض الطلب');
            setRejectingId(null);
            setRejectReason('');
        } catch (err) {
            console.error('Error rejecting procurement:', err);
            error('فشل رفض الطلب');
        }
    };

    if (loading) {
        return (
            <div className="glass-card p-6 text-center">
                <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
        );
    }

    if (pendingRequests.length === 0) {
        return null; // Don't show if no pending requests
    }

    return (
        <div className="glass-card p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                        <Package className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">طلبات المشتريات المعلقة</h3>
                        <p className="text-sm text-white/60">{pendingRequests.length} طلب بانتظار الموافقة</p>
                    </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold border border-yellow-500/30">
                    {pendingRequests.length}
                </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
                {pendingRequests.map(request => (
                    <div
                        key={request.id}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                    >
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-white font-medium">{request.department}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
                                        <Clock className="w-3 h-3 inline mr-1" />
                                        بانتظار الموافقة
                                    </span>
                                </div>
                                <div className="text-white/60 text-sm mb-2">
                                    <User className="w-3 h-3 inline mr-1" />
                                    {request.requestedBy.name}
                                </div>
                                <div className="space-y-1">
                                    {request.items.map((item, idx) => (
                                        <div key={idx} className="text-white/80 text-sm">
                                            • {item.itemName} × {item.quantity}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => handleApprove(request.id)}
                                className="flex-1 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 font-medium flex items-center justify-center gap-2 transition-all"
                            >
                                <Check className="w-4 h-4" />
                                تعميد
                            </button>
                            <button
                                onClick={() => setRejectingId(request.id)}
                                className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium flex items-center justify-center gap-2 transition-all"
                            >
                                <X className="w-4 h-4" />
                                رفض
                            </button>
                        </div>

                        {/* Reject Reason Modal */}
                        {rejectingId === request.id && (
                            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="سبب الرفض..."
                                    className="w-full p-2 rounded-lg bg-white/10 text-white placeholder-white/40 border border-white/10 resize-none mb-2"
                                    rows={2}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleReject(request.id)}
                                        className="flex-1 py-2 rounded-lg bg-red-500 text-white font-medium"
                                    >
                                        تأكيد الرفض
                                    </button>
                                    <button
                                        onClick={() => {
                                            setRejectingId(null);
                                            setRejectReason('');
                                        }}
                                        className="px-4 py-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20"
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
