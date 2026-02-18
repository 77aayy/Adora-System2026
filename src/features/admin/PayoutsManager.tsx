/**
 * Payouts Manager (Admin Command Center)
 * Handle employee point redemptions and financial settlements
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import {
    DollarSign, CheckCircle2, XCircle, Search, Filter,
    Download, ChevronRight, Clock, Users, Calendar, ArrowUpRight,
    Loader2, AlertCircle, TrendingUp, HandCoins
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { getPendingPayouts, approvePayout, rejectPayout } from '../../services/payoutService';
import { PayoutRequest } from '../../types';
import * as XLSX from 'xlsx';
import { logger } from '../../services/loggerService';
import { formatDateGregorianEn, formatDateTimeGregorianEn } from '../../utils/dateUtils';

export const PayoutsManager: React.FC = () => {
    const { user } = useAuth();
    const { tenantId } = useTenant();

    // State
    const [requests, setRequests] = useState<PayoutRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        loadRequests();
    }, [tenantId]);

    const loadRequests = async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const data = await getPendingPayouts(tenantId);
            setRequests(data);
        } catch (error) {
            logger.error('Error loading payout requests', error, 'PayoutsManager');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (requestId: string) => {
        if (!tenantId || !user?.id) return;
        setProcessingId(requestId);
        try {
            const res = await approvePayout(tenantId, requestId, user.id);
            if (res.success) {
                setRequests(prev => prev.filter(r => r.id !== requestId));
            } else {
                alert(res.error);
            }
        } catch (e) {
            logger.error('Error approving payout', e, 'PayoutsManager');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async () => {
        if (!tenantId || !user?.id || !showRejectModal || !rejectionReason) return;
        const requestId = showRejectModal;
        setProcessingId(requestId);
        try {
            const res = await rejectPayout(tenantId, requestId, user.id, rejectionReason);
            if (res.success) {
                setRequests(prev => prev.filter(r => r.id !== requestId));
                setShowRejectModal(null);
                setRejectionReason('');
            } else {
                alert(res.error);
            }
        } catch (e) {
            logger.error('Error approving payout', e, 'PayoutsManager');
        } finally {
            setProcessingId(null);
        }
    };

    const exportToExcel = () => {
        const dataToExport = requests.map(r => ({
            'رقم الطلب': r.id,
            'اسم الموظف': r.userName,
            'القسم': r.userDepartment,
            'عدد النقاط': r.pointsAmount,
            'القيمة المالية (SAR)': r.monetaryValue,
            'سعر الصرف': r.exchangeRate,
            'تاريخ الطلب': r.createdAt ? formatDateTimeGregorianEn((r.createdAt as any).toDate?.() || r.createdAt, { showSeconds: false }) : ''
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Payouts');
        XLSX.writeFile(wb, `Adora_Payouts_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filteredRequests = requests.filter(r =>
        r.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.userDepartment.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPoints = filteredRequests.reduce((sum, r) => sum + r.pointsAmount, 0);
    const totalSAR = filteredRequests.reduce((sum, r) => sum + r.monetaryValue, 0);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
                <p className="text-white/40 font-bold">جاري تحميل طلبات الصرف...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-dark p-6 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 blur-3xl -mr-12 -mt-12 transition-all duration-700 group-hover:bg-primary-500/20" />
                    <div className="flex items-center gap-4 relative">
                        <div className="w-12 h-12 rounded-2xl bg-primary-500/20 flex items-center justify-center">
                            <HandCoins className="w-6 h-6 text-primary-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">إجمالي المستحقات</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-white">{totalSAR.toLocaleString()}</span>
                                <span className="text-xs font-bold text-white/30 uppercase">SAR</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-dark p-6 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/10 blur-3xl -mr-12 -mt-12 transition-all duration-700 group-hover:bg-yellow-500/20" />
                    <div className="flex items-center gap-4 relative">
                        <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-yellow-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">نقاط قيد الانتظار</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-white">{totalPoints.toLocaleString()}</span>
                                <span className="text-xs font-bold text-orange-500/50 uppercase">Pts</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-dark p-6 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-3xl -mr-12 -mt-12 transition-all duration-700 group-hover:bg-blue-500/20" />
                    <div className="flex items-center gap-4 relative">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">عدد الطلبات</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-white">{filteredRequests.length}</span>
                                <span className="text-xs font-bold text-white/30 uppercase">طلبات</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="glass-dark p-4 rounded-3xl border border-white/5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                    <div className="relative flex-1">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input
                            type="text"
                            placeholder="بحث باسم الموظف أو القسم..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl pr-12 pl-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500/50 transition-all"
                        />
                    </div>
                    <button className="p-3 bg-white/5 rounded-2xl border border-white/5 text-white/40 hover:text-white transition-all">
                        <Filter className="w-5 h-5" />
                    </button>
                </div>

                <button
                    onClick={exportToExcel}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/20 hover:bg-emerald-500/30 transition-all font-bold text-sm"
                >
                    <Download className="w-4 h-4" />
                    تصدير ملف المسيرات (Excel)
                </button>
            </div>

            {/* Requests Table */}
            <div className="glass-dark rounded-[2.5rem] border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-widest">الموظف</th>
                                <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-widest text-center">النقاط</th>
                                <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-widest text-center">القيمة (SAR)</th>
                                <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-widest">التاريخ</th>
                                <th className="px-6 py-4 text-[10px] font-black text-white/30 uppercase tracking-widest text-left">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                                                <AlertCircle className="w-8 h-8 text-white/10" />
                                            </div>
                                            <p className="text-white/20 font-bold">لا توجد طلبات صرف معلقة حالياً</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-blue-500/20 flex items-center justify-center font-black text-primary-400 text-xs shadow-inner">
                                                    {req.userName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white group-hover:text-primary-400 transition-colors uppercase">{req.userName}</p>
                                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-tighter">{req.userDepartment}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-lg font-black text-yellow-500">{req.pointsAmount.toLocaleString()}</span>
                                            <p className="text-[9px] text-white/20 font-bold uppercase">Points</p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="inline-flex flex-col items-center bg-emerald-500/5 px-4 py-1.5 rounded-xl border border-emerald-500/10">
                                                <span className="text-md font-black text-emerald-400">{req.monetaryValue.toLocaleString()} ريال</span>
                                                <span className="text-[8px] text-white/20 uppercase tracking-widest">SAR Balance</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-white/40 font-bold tabular-nums">
                                            {req.createdAt ? formatDateGregorianEn((req.createdAt as any).toDate?.() || req.createdAt) : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleApprove(req.id)}
                                                    disabled={!!processingId}
                                                    className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center shadow-lg shadow-emerald-500/10 active:scale-90"
                                                >
                                                    {processingId === req.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                                </button>
                                                <button
                                                    onClick={() => setShowRejectModal(req.id)}
                                                    disabled={!!processingId}
                                                    className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shadow-lg shadow-red-500/10 active:scale-90"
                                                >
                                                    <XCircle className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 animate-fadeIn">
                    <div className="glass-dark w-full max-w-md rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl">
                        <div className="p-8">
                            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-6">
                                <AlertCircle className="w-10 h-10 text-red-500" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">رفض طلب الصرف</h3>
                            <p className="text-slate-600 dark:text-white/40 text-sm mb-6">سيتم إعادة النقاط تلقائياً لمحفظة الموظف. يرجى توضيح سبب الرفض.</p>

                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="مثال: البيانات المالية غير مكتملة، يرجى مراجعة الإدارة..."
                                className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/5 rounded-2xl p-4 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-red-500/50 h-32 resize-none"
                            ></textarea>

                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <button
                                    onClick={() => setShowRejectModal(null)}
                                    className="py-4 rounded-2xl bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-white/40 font-bold hover:bg-slate-300 dark:hover:bg-white/10 transition-all"
                                >
                                    تراجع
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={!rejectionReason || !!processingId}
                                    className="py-4 rounded-2xl bg-red-500 text-white font-black shadow-xl shadow-red-500/20 active:scale-95 transition-all"
                                >
                                    {processingId ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'تأكيد الرفض'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
