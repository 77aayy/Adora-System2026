/**
 * Super Admin Master Access Page
 * Phase 3: Security & Master Access
 * 
 * Features:
 * - Read-only view of all tenants
 * - Emergency Reset capabilities
 * - Support-level access to troubleshoot
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import {
    Shield, Building2, Users, Eye, RefreshCw, Key, Lock,
    AlertTriangle, CheckCircle, XCircle, Loader2, Search,
    ChevronRight, Clock, User, Settings, Database, Unlock
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '../../components/common/PageTransition';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { logger } from '../../services/loggerService';

// ============================================================
// HELPER: Safe Date Conversion (handles Firestore Timestamps)
// ============================================================
const toSafeDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    if (dateValue instanceof Timestamp) return dateValue.toDate();
    if (typeof dateValue?.toDate === 'function') return dateValue.toDate();
    if (dateValue instanceof Date) return dateValue;
    return new Date(dateValue);
};

// ============================================================
// TYPES
// ============================================================

interface TenantInfo {
    id: string;
    tenantName: string;
    managerName: string;
    managerCode: string;
    status: 'active' | 'suspended' | 'expired';
    licenseExpiry: Date;
    branchCount: number;
    employeeCount: number;
    lastActivity: Date;
    firebaseProject?: string;
}

interface AuditLog {
    id: string;
    action: string;
    tenantId: string;
    performedBy: string;
    timestamp: Date;
    details: string;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const SuperAdminMasterAccess: React.FC = () => {
    const { user } = useAuth();
    const { success, error } = useUX();

    // State
    const [loading, setLoading] = useState(true);
    const [tenants, setTenants] = useState<TenantInfo[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<TenantInfo | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

    // Load tenants
    useEffect(() => {
        const loadTenants = async () => {
            try {
                if (!db) {
                    setLoading(false);
                    return;
                }

                const managersRef = collection(db, 'users');
                const q = query(managersRef, where('role', '==', 'manager'));
                const snapshot = await getDocs(q);

                const tenantsData: TenantInfo[] = await Promise.all(
                    snapshot.docs.map(async (docSnap) => {
                        const data = docSnap.data();
                        
                        // Get branch count
                        let branchCount = 0;
                        let employeeCount = 0;
                        
                        if (data.tenantId) {
                            try {
                                const branchesRef = collection(db, `tenants/${data.tenantId}/branches`);
                                const branchesSnap = await getDocs(branchesRef);
                                branchCount = branchesSnap.size;

                                const employeesRef = collection(db, 'users');
                                const empQuery = query(employeesRef, 
                                    where('tenantId', '==', data.tenantId),
                                    where('role', '==', 'employee')
                                );
                                const empSnap = await getDocs(empQuery);
                                employeeCount = empSnap.size;
                            } catch (err) {
                                logger.warn('Error counting branches/employees:', err, 'SuperAdminMasterAccess');
                            }
                        }

                        return {
                            id: docSnap.id,
                            tenantName: data.tenantName || data.name || 'غير محدد',
                            managerName: data.name || 'غير محدد',
                            managerCode: data.code || 'N/A',
                            status: data.status || 'active',
                            licenseExpiry: data.licenseExpiryDate?.toDate() || new Date(),
                            branchCount,
                            employeeCount,
                            lastActivity: data.lastLogin?.toDate() || new Date(),
                            firebaseProject: data.firebaseConfig?.projectId
                        };
                    })
                );

                setTenants(tenantsData);
            } catch (err) {
                logger.error('Error loading tenants:', err, 'SuperAdminMasterAccess');
                error('فشل في تحميل بيانات المستأجرين');
            } finally {
                setLoading(false);
            }
        };

        loadTenants();
    }, [error]);

    // Filter tenants
    const filteredTenants = tenants.filter(tenant =>
        tenant.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.managerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.managerCode.includes(searchTerm)
    );

    // Emergency Reset Password
    const handleEmergencyReset = async () => {
        if (!selectedTenant) return;
        
        setResetting(true);
        try {
            // Generate random PIN
            const newPin = Math.floor(1000 + Math.random() * 9000).toString();
            
            // Update manager's code
            const managerRef = doc(db!, 'users', selectedTenant.id);
            await updateDoc(managerRef, {
                code: newPin,
                passwordResetAt: Timestamp.now(),
                passwordResetBy: user?.id
            });

            // Log audit
            if (db) {
                await import('firebase/firestore').then(({ addDoc }) => {
                    addDoc(collection(db!, 'audit_logs'), {
                        action: 'EMERGENCY_PASSWORD_RESET',
                        tenantId: selectedTenant.id,
                        performedBy: user?.id,
                        performedByName: user?.name,
                        timestamp: Timestamp.now(),
                        details: `Emergency reset for tenant: ${selectedTenant.tenantName}`
                    });
                });
            }

            success(`تم إعادة تعيين كلمة المرور. الكود الجديد: ${newPin}`);
            setShowResetModal(false);
            
            // Refresh tenants
            const updatedTenants = tenants.map(t => 
                t.id === selectedTenant.id ? { ...t, managerCode: newPin } : t
            );
            setTenants(updatedTenants);
            setSelectedTenant({ ...selectedTenant, managerCode: newPin });

        } catch (err) {
            logger.error('Error resetting password:', err, 'SuperAdminMasterAccess');
            error('فشل في إعادة تعيين كلمة المرور');
        } finally {
            setResetting(false);
        }
    };

    // Status badge component
    const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
        const config = {
            active: { bg: 'bg-green-500/20', text: 'text-green-400', label: t('common.active') || 'نشط' },
            suspended: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'موقوف' },
            expired: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'منتهي' }
        }[status] || { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'غير معروف' };

        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                {config.label}
            </span>
        );
    };

    if (loading) {
        return (
            <PageTransition>
                <div className="min-h-screen flex items-center justify-center"
                    style={{ background: 'var(--theme-gradient-page)' }}>
                    <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
                </div>
            </PageTransition>
        );
    }

    return (
        <PageTransition>
            <div className="min-h-screen p-4 md:p-6"
                style={{ background: 'var(--theme-gradient-page)' }}>
                
                {/* Header */}
                <FlexibleHeader
                    icon={<Shield className="w-7 h-7 text-red-400" />}
                    title="Master Access"
                    subtitle="وصول الدعم الفني - للقراءة فقط"
                    iconBgClass="bg-red-500/20"
                    className="mb-6"
                />

                {/* Security Warning */}
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 mb-6 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-red-400">⚠️ تحذير أمني</p>
                        <p className="text-xs text-red-300/80 mt-1">
                            هذه الصفحة للدعم الفني فقط. جميع العمليات يتم تسجيلها في سجل التدقيق.
                            استخدم هذه الصلاحيات بحذر.
                        </p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="بحث بالاسم أو الكود..."
                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl pr-10 pl-4 py-3 text-white focus:outline-none focus:border-teal-500/50"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Tenants List */}
                    <div className="lg:col-span-1 space-y-3">
                        <h3 className="text-sm font-bold text-white/60 mb-3 flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            المستأجرين ({filteredTenants.length})
                        </h3>

                        <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
                            {filteredTenants.map(tenant => (
                                <button
                                    key={tenant.id}
                                    onClick={() => setSelectedTenant(tenant)}
                                    className={`w-full p-4 rounded-xl text-right transition-all ${
                                        selectedTenant?.id === tenant.id
                                            ? 'bg-teal-500/20 border border-teal-500/50'
                                            : 'bg-slate-800/50 border border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <StatusBadge status={tenant.status} />
                                        <span className="font-bold text-white">{tenant.tenantName}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-white/60">
                                        <span>{tenant.branchCount} فروع</span>
                                        <span className="font-mono">{tenant.managerCode}</span>
                                    </div>
                                </button>
                            ))}

                            {filteredTenants.length === 0 && (
                                <div className="text-center py-8 text-white/40">
                                    لا توجد نتائج
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tenant Details */}
                    <div className="lg:col-span-2">
                        {selectedTenant ? (
                            <div className="p-6 rounded-2xl bg-slate-800/50 border border-white/10">
                                {/* Tenant Header */}
                                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                                    <div>
                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                            <Building2 className="w-5 h-5 text-teal-400" />
                                            {selectedTenant.tenantName}
                                        </h2>
                                        <p className="text-sm text-white/60 mt-1">
                                            مدير: {selectedTenant.managerName}
                                        </p>
                                    </div>
                                    <StatusBadge status={selectedTenant.status} />
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="p-4 rounded-xl bg-white/5">
                                        <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
                                            <Key className="w-4 h-4" />
                                            كود المدير
                                        </div>
                                        <p className="text-lg font-mono font-bold text-teal-400">
                                            {selectedTenant.managerCode}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-xl bg-white/5">
                                        <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
                                            <Building2 className="w-4 h-4" />
                                            الفروع
                                        </div>
                                        <p className="text-lg font-bold text-white">
                                            {selectedTenant.branchCount}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-xl bg-white/5">
                                        <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
                                            <Users className="w-4 h-4" />
                                            الموظفين
                                        </div>
                                        <p className="text-lg font-bold text-white">
                                            {selectedTenant.employeeCount}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-xl bg-white/5">
                                        <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
                                            <Clock className="w-4 h-4" />
                                            انتهاء الرخصة
                                        </div>
                                        <p className="text-sm font-bold text-white">
                                            {toSafeDate(selectedTenant.licenseExpiry).toLocaleDateString('ar-EG')}
                                        </p>
                                    </div>
                                </div>

                                {/* Firebase Project Info */}
                                {selectedTenant.firebaseProject && (
                                    <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 mb-6">
                                        <div className="flex items-center gap-2 text-orange-400 text-sm">
                                            <Database className="w-4 h-4" />
                                            <span className="font-medium">Firebase Project:</span>
                                            <span className="font-mono">{selectedTenant.firebaseProject}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Last Activity */}
                                <div className="p-4 rounded-xl bg-white/5 mb-6">
                                    <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
                                        <Clock className="w-4 h-4" />
                                        آخر نشاط
                                    </div>
                                    <p className="text-sm text-white">
                                        {selectedTenant.lastActivity.toLocaleString('ar-EG')}
                                    </p>
                                </div>

                                {/* Emergency Actions */}
                                <div className="border-t border-white/10 pt-4">
                                    <h4 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        إجراءات الطوارئ
                                    </h4>

                                    <button
                                        onClick={() => setShowResetModal(true)}
                                        className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex items-center gap-2 text-sm font-medium"
                                    >
                                        <Unlock className="w-4 h-4" />
                                        إعادة تعيين كلمة المرور
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-12 rounded-2xl bg-slate-800/50 border border-white/10 text-center">
                                <Eye className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                <p className="text-white/40">اختر مستأجر لعرض تفاصيله</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Reset Password Modal */}
                {showResetModal && selectedTenant && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-red-500/30">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="w-8 h-8 text-red-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">
                                    تأكيد إعادة تعيين كلمة المرور
                                </h3>
                                <p className="text-sm text-white/60">
                                    سيتم إنشاء كود جديد للمدير: <strong className="text-white">{selectedTenant.managerName}</strong>
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-6">
                                <p className="text-xs text-amber-400">
                                    ⚠️ هذا الإجراء سيتم تسجيله في سجل التدقيق ولا يمكن التراجع عنه.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowResetModal(false)}
                                    disabled={resetting}
                                    className="flex-1 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleEmergencyReset}
                                    disabled={resetting}
                                    className="flex-1 py-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    {resetting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Unlock className="w-5 h-5" />
                                            تأكيد
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default SuperAdminMasterAccess;
