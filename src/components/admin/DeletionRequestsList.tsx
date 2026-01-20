import React, { useMemo } from 'react';
// Force Reload Fix: 2026-01-07
import { Trash2, XCircle, CheckCircle } from 'lucide-react';
import { useRequests } from '../../hooks/useRequests';
import { Request } from '../../types';
import { deleteRequest } from '../../services/requestService';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useUX } from '../../hooks/useUX';
import { useTranslation } from 'react-i18next';

export const DeletionRequestsList: React.FC = () => {
    const { requests } = useRequests();
    const { showSuccess, showError } = useUX();
    const { t } = useTranslation();

    // Filter requests that have pending deletion requests
    const deletionRequests = useMemo(() => {
        return requests.filter(r => r.deletionRequest);
    }, [requests]);

    if (deletionRequests.length === 0) return null;

    const handleApprove = async (req: Request) => {
        if (!confirm(t('admin.approveDeleteConfirm') || 'هل أنت متأكد من الموافقة على الحذف؟ (سيتم أرشفة الطلب ولن يظهر في القوائم النشطة)')) return;
        try {
            // ✅ ARCHITECTURAL FIX: Use Service Layer (Soft Delete) instead of direct Hard Delete
            // This preserves linkage to Inventory/Points logs.
            await deleteRequest(req.id);
            showSuccess(t('admin.archiveSuccess') || 'تمت الأرشفة بنجاح');
        } catch (error) {
            console.error(error);
            showError(t('admin.archiveError') || 'حدث خطأ أثناء الأرشفة');
        }
    };

    const handleReject = async (req: Request) => {
        if (!db) return;
        try {
            // Remove the deletionRequest field to "Reject"
            await updateDoc(doc(db, 'requests', req.id), {
                deletionRequest: deleteField()
            });
            showSuccess(t('admin.rejectDeleteSuccess') || 'تم رفض طلب الحذف');
        } catch (error) {
            console.error(error);
            showError(t('common.error') || 'حدث خطأ');
        }
    };

    return (
        <div className="mb-6 animate-fade-in-up">
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-red-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <Trash2 className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">{t('admin.pendingDeletionRequests') || 'طلبات الحذف المعلقة'}</h3>
                            <p className="text-red-300/60 text-sm">{t('admin.pendingDeletionCount', { count: deletionRequests.length }) || `يوجد ${deletionRequests.length} طلبات بانتظار الموافقة`}</p>
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-white/5">
                    {deletionRequests.map(req => (
                        <div key={req.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-4">
                                <span className="text-xl font-bold text-white/40">#{req.roomNumber}</span>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-medium">
                                            {req.type === 'cleaning' ? (t('departments.housekeeping') || 'تنظيف') :
                                                req.type === 'maintenance' ? (t('departments.maintenance') || 'صيانة') :
                                                    req.type === 'bellman' ? (t('departments.bellman') || 'حامل حقائب') : (t('common.request') || 'طلب')}
                                        </span>
                                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-white/60">
                                            {req.guestName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-red-400">
                                            {t('common.by') || 'بواسطة'}: {req.deletionRequest?.requestedBy}
                                        </span>
                                        <span className="text-xs text-white/20">•</span>
                                        <span className="text-xs text-white/40">
                                            {req.deletionRequest?.reason || (t('admin.noReason') || 'لا يوجد سبب')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleReject(req)}
                                    className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                                    title={t('common.reject') || 'رفض'}
                                >
                                    <XCircle className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleApprove(req)}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium text-sm"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    {t('admin.approveAndDelete') || 'موافقة وحذف'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
