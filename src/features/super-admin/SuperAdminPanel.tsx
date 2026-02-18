/**
 * Super Admin Panel
 * Control panel for system owner to manage hotel tenants
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import {
    Crown,
    Building2,
    Plus,
    Eye,
    PauseCircle,
    PlayCircle,
    Users,
    TrendingUp,
    LogOut,
    RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    createManager,
    toggleLicenseStatus,
} from '../../services/ownerService';
import { confirm as customConfirm } from '../../services/customConfirmService';
import { logger } from '../../services/loggerService';
import {
    collection,
    query,
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Tenant, TenantInfo } from '../../types/tenant';
import { haptic, playSound } from '../../utils/uxEffects';
import { formatDateGregorianEn } from '../../utils/dateUtils';

interface TenantWithId extends Tenant {
    id: string;
}

export const SuperAdminPanel: React.FC = () => {
    const navigate = useNavigate();
    const { user, authReady, logout } = useAuth();
    const { t } = useTranslation();

    const [tenants, setTenants] = useState<TenantWithId[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        suspended: 0
    });

    // ✅ Security Gate: Only Owner can access Super Admin
    useEffect(() => {
        if (authReady && user?.role !== 'owner') {
            navigate('/');
        }
    }, [user, authReady, navigate]);

    // Load all tenants
    useEffect(() => {
        const q = query(collection(db, 'tenants'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: TenantWithId[] = snapshot.docs.map(doc => ({
                id: doc.id,
                info: doc.data().info as TenantInfo
            } as TenantWithId));

            setTenants(data);
            setStats({
                total: data.length,
                active: data.filter(t => t.info.status === 'active').length,
                suspended: data.filter(t => t.info.status === 'suspended').length
            });
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleCreateHotel = async (data: {
        hotelName: string;
        managerName: string;
        plan: 'basic' | 'pro' | 'enterprise';
    }) => {
        try {
            // ✅ SaaS Architecture: Use Unified ownerService to prevent data orphans
            const managerCode = Math.floor(1000 + Math.random() * 9000).toString();

            await createManager({
                name: data.managerName,
                code: managerCode,
                hotelName: data.hotelName,
                maxBranches: data.plan === 'pro' ? 5 : (data.plan === 'enterprise' ? 100 : 1),
                branchCodes: ['01'], // Initial default branch
                branchNames: { '01': 'الفرع الرئيسي' }
            });

            haptic('success');
            playSound('success');
            setShowCreateModal(false);

            await customConfirm({
                title: 'تم إنشاء الفندق بنجاح!',
                message: `الفندق: ${data.hotelName}\nالمدير: ${data.managerName}\nرمز الدخول: ${managerCode}\n\nاحفظ هذا الرمز للمدير`,
                confirmText: t('common.ok'),
                showCancel: false,
                type: 'success'
            });

        } catch (error: any) {
            logger.error('Error creating hotel:', error, 'SuperAdminPanel');
            haptic('error');
            await customConfirm({
                title: t('common.error') || 'خطأ',
                message: error.message || 'حدث خطأ في إنشاء الفندق',
                confirmText: t('common.ok'),
                showCancel: false,
                type: 'danger'
            });
        }
    };

    const handleToggleStatus = async (tenantId: string, managerId: string, currentStatus: string) => {
        try {
            const isActive = currentStatus === 'active';
            await toggleLicenseStatus(managerId, tenantId, isActive); // If active, suspend it.

            haptic('success');
            playSound('notification');
        } catch (error) {
            logger.error('Error toggling status:', error, 'SuperAdminPanel');
            haptic('error');
        }
    };

    const planLabels = {
        basic: 'أساسي',
        pro: 'احترافي',
        enterprise: 'مؤسسي'
    };

    return (
        <div className="min-h-screen theme-page p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                            <Crown className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Super Admin</h1>
                            <p className="text-white/60">لوحة التحكم الرئيسية</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 transition-colors"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>

                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl text-white hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-lg"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="font-medium">إنشاء فندق جديد</span>
                        </button>

                        <button
                            onClick={logout}
                            className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Building2 className="w-8 h-8 text-blue-400" />
                            <span className="text-sm text-white/60">إجمالي الفنادق</span>
                        </div>
                        <p className="text-4xl font-bold text-white">{stats.total}</p>
                    </div>

                    <div className="glass rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <TrendingUp className="w-8 h-8 text-green-400" />
                            <span className="text-sm text-white/60">فنادق نشطة</span>
                        </div>
                        <p className="text-4xl font-bold text-green-400">{stats.active}</p>
                    </div>

                    <div className="glass rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <PauseCircle className="w-8 h-8 text-red-400" />
                            <span className="text-sm text-white/60">فنادق موقوفة</span>
                        </div>
                        <p className="text-4xl font-bold text-red-400">{stats.suspended}</p>
                    </div>
                </div>

                {/* Hotels List */}
                <div className="glass rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">الفنادق المسجلة</h2>

                    <div className="space-y-3">
                        {tenants.length === 0 ? (
                            <p className="text-center text-white/50 py-8">لا توجد فنادق مسجلة</p>
                        ) : (
                            tenants.map((tenant) => (
                                <div key={tenant.id} className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-all">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tenant.info.status === 'active'
                                                ? 'bg-green-500/20'
                                                : 'bg-red-500/20'
                                                }`}>
                                                <Building2 className={`w-6 h-6 ${tenant.info.status === 'active'
                                                    ? 'text-green-400'
                                                    : 'text-red-400'
                                                    }`} />
                                            </div>

                                            <div>
                                                <h3 className="text-lg font-bold text-white">{tenant.info.name}</h3>
                                                <p className="text-sm text-white/60">
                                                    المدير: {tenant.info.ownerName} •
                                                    الخطة: {planLabels[tenant.info.plan]} •
                                                    {tenant.info.status === 'active' ? ' نشط' : ' موقوف'}
                                                </p>
                                                <p className="text-xs text-white/40 mt-1">
                                                    تم الإنشاء: {formatDateGregorianEn(tenant.info.createdAt.toDate())}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Toggle Status */}
                                            <button
                                                onClick={() => handleToggleStatus(tenant.id, tenant.info.ownerId, tenant.info.status)}
                                                className={`p-3 rounded-xl transition-all ${tenant.info.status === 'active'
                                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                                    : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                                    }`}
                                                title={tenant.info.status === 'active' ? 'إيقاف' : 'تفعيل'}
                                            >
                                                {tenant.info.status === 'active' ? (
                                                    <PauseCircle className="w-5 h-5" />
                                                ) : (
                                                    <PlayCircle className="w-5 h-5" />
                                                )}
                                            </button>

                                            {/* View Details */}
                                            <button
                                                className="p-3 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all"
                                                title="عرض التفاصيل"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Create Hotel Modal */}
                {showCreateModal && (
                    <CreateHotelModal
                        onClose={() => setShowCreateModal(false)}
                        onSubmit={handleCreateHotel}
                    />
                )}
            </div>
        </div>
    );
};

// Create Hotel Modal Component
const CreateHotelModal: React.FC<{
    onClose: () => void;
    onSubmit: (data: any) => void;
}> = ({ onClose, onSubmit }) => {
    const [hotelName, setHotelName] = useState('');
    const [managerName, setManagerName] = useState('');
    const [plan, setPlan] = useState<'basic' | 'pro' | 'enterprise'>('pro');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ hotelName, managerName, plan });
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'none' }}>
            <div className="glass rounded-2xl p-6 max-w-md w-full">
                <div className="flex items-center gap-3 mb-6">
                    <Crown className="w-6 h-6 text-yellow-400" />
                    <h3 className="text-xl font-bold text-white">إنشاء فندق جديد</h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-white/60 mb-2">اسم الفندق</label>
                        <input
                            type="text"
                            value={hotelName}
                            onChange={(e) => setHotelName(e.target.value)}
                            required
                            placeholder="مثال: فندق الكورنيش"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-yellow-400"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-white/60 mb-2">اسم المدير</label>
                        <input
                            type="text"
                            value={managerName}
                            onChange={(e) => setManagerName(e.target.value)}
                            required
                            placeholder={t('common.exampleManagerName') || 'مثال: أحمد محمد'}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-yellow-400"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-white/60 mb-2">الخطة</label>
                        <select
                            value={plan}
                            onChange={(e) => setPlan(e.target.value as any)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-400"
                        >
                            <option value="basic">أساسي</option>
                            <option value="pro">احترافي</option>
                            <option value="enterprise">مؤسسي</option>
                        </select>
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mt-4">
                        <p className="text-sm text-yellow-400">
                            💡 سيتم إنشاء رمز دخول (PIN) تلقائي للمدير
                        </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl text-white hover:from-yellow-600 hover:to-yellow-700 transition-all font-medium"
                        >
                            إنشاء الفندق
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SuperAdminPanel;