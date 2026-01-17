/**
 * Owner Control Panel
 * "The God Mode" - Manage Licenses & Tenants
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Crown, UserPlus, Users, Building2, Trash2, Edit,
    Save, X, RefreshCw, LogOut, Eye, EyeOff, Check,
    Calendar, Clock, Pause, Play, AlertTriangle, Key
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { StatCard } from '../../components/common/StatCard';
import {
    User,
} from '../../types';
import {
    createManager,
    getAllManagers,
    isPinAvailable,
    suggestUniquePin,
    getRemainingLicenseDays,
    toggleLicenseStatus,
    renewLicense,
    checkLicenseExpiryNotifications,
    softDeleteManager,
    restoreManager,
    getDeletedManagers,
    purgeAllSystemData
} from '../../services/ownerService';
import { collection, getDocs, query, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { haptic, playSound } from '../../utils/uxEffects';

// ============================================================
// TYPES
// ============================================================

interface Branch {
    id: string;
    name: string;
    code: string;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const OwnerPanel: React.FC = () => {
    const navigate = useNavigate();
    // ✅ Auth Context - Strict Readiness
    const { user, authReady, logout } = useAuth();
    const { success, error } = useUX();

    const [managers, setManagers] = useState<User[]>([]);
    const [deletedManagers, setDeletedManagers] = useState<any[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeletedManagers, setShowDeletedManagers] = useState(false);

    // Manual init not needed - relying on useAuth
    // User role check handles redirection

    // Check if user is owner
    useEffect(() => {
        if (authReady && user?.role !== 'owner') {
            navigate('/');
        }
    }, [user, authReady, navigate]);

    // Load managers and branches
    useEffect(() => {
        // ✅ Gate: Wait for Auth Ready
        if (authReady && user?.role === 'owner') {
            loadData();
        }
    }, [authReady, user]);



    const loadData = async () => {
        setDataLoading(true);
        try {
            // Load managers (only active, not deleted)
            const managersData = await getAllManagers();
            const activeManagers = managersData.filter(m => (m.status as string) !== 'deleted');
            setManagers(activeManagers);

            // ✅ Load deleted managers
            const deletedData = await getDeletedManagers();
            setDeletedManagers(deletedData);

            // ✅ Check for license expiry notifications
            activeManagers.forEach(manager => {
                const notification = checkLicenseExpiryNotifications((manager as any).licenseExpiry);
                if (notification) {
                    // Logic to show notification if needed (e.g., console warn for now)
                    console.warn(`License Alert [${manager.name}]:`, notification.message);
                }
            });

            // Mock branches for now or load from structure if needed
            // setBranches([...]); 
        } catch (error) {
            console.error('Error loading owner data:', error);
        } finally {
            setDataLoading(false);
        }
    };

    const handleCreateManager = async (data: any) => {
        try {
            await createManager(data);
            loadData();
            setShowAddModal(false);
            haptic('success');
            playSound('success');
            success('تم إنشاء المدير بنجاح');
        } catch (error: any) {
            console.error('Error creating manager:', error);
            haptic('error');
            error('حدث خطأ أثناء إنشاء المدير');
        }
    };

    const handleDeleteManager = async (managerId: string, tenantId?: string) => {
        // 🛡️ SECURITY: Prevent Self-Deletion
        if (user?.id === managerId) {
            haptic('error');
            error('⚠️ إجراء مرفوض: لا يمكنك حذف حسابك الشخصي!');
            return;
        }

        const confirmMsg = tenantId
            ? 'هل أنت متأكد من حذف هذا المدير؟ سيتم نقل البيانات للأرشيف ويمكن استعادتها خلال 7 أيام.'
            : '⚠️ هذا المدير لا يملك معرف مستأجر (بيانات قديمة). هل تريد حذفه نهائياً؟';

        if (window.confirm(confirmMsg)) {
            setDataLoading(true); // Prevent interaction
            try {
                // ✅ Pass tenantId optionally
                await softDeleteManager(managerId, tenantId);
                await loadData(); // Reload to update lists
                haptic('success');
                playSound('success');
                success('تم حذف المدير بنجاح ونقله للأرشيف');
            } catch (err: any) {
                console.error('Error deleting manager:', err);
                haptic('error');
                error('فشل الحذف: ' + (err.message || 'خطأ في الاتصال'));
            } finally {
                setDataLoading(false);
            }
        }
    };

    const handleRestoreManager = async (managerId: string) => {
        if (window.confirm('هل أنت متأكد من استعادة هذا المدير؟')) {
            try {
                await restoreManager(managerId);
                loadData(); // Reload to update lists
                haptic('success');
                playSound('success');
            } catch (err) {
                console.error('Error restoring manager:', err);
                haptic('error');
            }
        }
    };

    const handleToggleLicense = async (managerId: string, tenantId: string | undefined, currentStatus: string) => {
        if (!tenantId) {
            alert('خطأ: لم يتم العثور على معرف المستأجر');
            return;
        }
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        const action = newStatus === 'active' ? 'تنشيط' : 'إيقاف';

        if (window.confirm(`هل أنت متأكد من ${action} ترخيص هذا المدير؟`)) {
            try {
                await toggleLicenseStatus(managerId, tenantId, newStatus === 'suspended');
                loadData();
                haptic('success');
            } catch (error) {
                console.error('Error toggling license:', error);
                haptic('error');
            }
        }
    };

    const handleRenewLicense = async (managerId: string, tenantId: string | undefined) => {
        if (!tenantId) {
            alert('خطأ: لم يتم العثور على معرف المستأجر');
            return;
        }
        if (window.confirm('هل أنت متأكد من تجديد الترخيص لمدة عام إضافي؟')) {
            try {
                await renewLicense(managerId, tenantId);
                loadData();
                haptic('success');
                playSound('success');
            } catch (error) {
                console.error('Error renewing license:', error);
                haptic('error');
            }
        }
    };

    const handleSyncPermissions = async () => {
        if (!user?.tenantId || !user?.role) {
            error('بيانات المستخدم غير مكتملة');
            return;
        }

        try {
            setDataLoading(true);
            // Re-import dynamic to ensure latest
            const { auth } = await import('../../services/firebase');
            const { saveUserBinding } = await import('../../services/userService');

            if (auth.currentUser) {
                console.log("Syncing permissions for UID:", auth.currentUser.uid);
                await saveUserBinding(auth.currentUser.uid, user.tenantId, user.role);
                haptic('success');
                success('تم تحديث الصلاحيات بنجاح');
            } else {
                error('لم يتم العثور على جلسة نشطة');
            }
        } catch (err) {
            console.error('Sync failed:', err);
            error('فشل التحديث');
        } finally {
            setDataLoading(false);
        }
    };

    const handlePurgeSystem = async () => {
        // 🧪 DEBUG LOGS
        const { auth } = await import('../../services/firebase');
        console.log("Purge Request - User Obj:", user);
        console.log("Purge Request - Firebase UID:", auth.currentUser?.uid);

        if (!user?.id) {
            alert("⚠️ خطأ تقني: لم يتم التعرف على هوية المالك. يرجى تسجيل الخروج والدخول مرة أخرى.");
            return;
        }

        const confirm1 = window.confirm('⚠️ تحذير شديد: أنت على وشك مسح كافة بيانات النظام (المشتركين، الغرف، الطلبات، المستأجرين) للبدء من جديد. هل أنت متأكد؟');
        if (!confirm1) return;

        const confirm2 = window.prompt('لتأكيد المسح الشامل، يرجى كتابة كلمة (RESET) باللغة الإنجليزية:');
        if (confirm2 !== 'RESET') {
            alert('تم إلغاء العملية. لم تكتب الكلمة الصحيحة.');
            return;
        }

        setDataLoading(true);
        try {
            console.log("🔥 Initializing Nuclear Purge...");
            const result = await purgeAllSystemData(user.id);
            haptic('success');
            playSound('success');

            // Re-fetch all data to clear the UI
            await loadData();

            success(`✅ تم مسح النظام بنجاح. تم حذف ${result.deletedCount} سجل.`);

            // Forced reload to clear any cached states in services
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (err: any) {
            console.error('Purge error:', err);
            error('فشل مسح النظام: ' + (err.message || 'خطأ غير معروف'));
            alert('فشل المسح: ' + (err.message || 'خطأ في الاتصال بقاعدة البيانات. ربما بسبب ضعف الصلاحيات. جرب زر "تحديث الصلاحيات".'));
        } finally {
            setDataLoading(false);
        }
    };

    return (
        <div className="bg-[#0F172A] min-h-screen text-white p-4 lg:p-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-teal-500/20 border border-white/10">
                        <Crown className="w-9 h-9 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                            لوحة المالك
                        </h1>
                        <p className="text-white/40 text-sm font-medium">التحكم الكامل في المنظومة والتراخيص</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <button
                        onClick={() => setShowDeletedManagers(!showDeletedManagers)}
                        className={`flex-1 lg:flex-none px-5 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all font-bold text-sm ${showDeletedManagers
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-lg shadow-red-500/10'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'
                            }`}
                    >
                        {showDeletedManagers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span>{showDeletedManagers ? 'إخفاء المحذوفين' : 'سلة المهملات'}</span>
                    </button>

                    <button
                        onClick={handleSyncPermissions}
                        className="flex-1 lg:flex-none px-5 py-3 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-teal-500/5"
                        title="تحديث صلاحيات Cloud Firestore"
                    >
                        {dataLoading ? <AdoraLoaderInline size={16} /> : <RefreshCw className="w-4 h-4" />}
                        <span>مزامنة الأمان</span>
                    </button>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="w-full lg:w-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold shadow-xl shadow-primary-500/20 hover:shadow-primary-500/40 active:scale-95 transition-all flex items-center justify-center gap-2 border border-primary-400/20"
                    >
                        <UserPlus className="w-5 h-5" />
                        إضافة مدير
                    </button>

                    <button
                        onClick={handlePurgeSystem}
                        className="px-4 py-3 rounded-2xl bg-red-600/10 text-red-400 border border-red-500/10 hover:bg-red-600/20 transition-all flex items-center justify-center gap-2 text-xs font-black shadow-lg shadow-red-500/5 group"
                        title="مسح كافة البيانات للبدء من الصفر"
                    >
                        <Trash2 className="w-4 h-4 group-hover:animate-bounce" />
                        <span className="hidden sm:inline">تهيئة النظام خارق</span>
                    </button>

                    <button
                        onClick={logout}
                        className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-all border border-white/5"
                    >
                        <LogOut className="w-5 h-5 flip-rtl" />
                    </button>
                </div>
            </div>

            {/* Stats Overview - Unified Style like Owner Dashboard */}
            <div 
                className="grid mb-10"
                style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '24px',
                    padding: '24px',
                }}
            >
                <div className="stat-card-pro-compact">
                    <StatCard
                        icon={Users}
                        iconColor="blue"
                        label="👥 إجمالي المدراء"
                        count={managers.length}
                        lastUpdate="تم التحديث الآن"
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        icon={Building2}
                        iconColor="green"
                        label="🏢 إجمالي الفروع"
                        count={managers.reduce((acc, m) => acc + (m.branches?.length || (m as any).maxBranches || 0), 0)}
                        lastUpdate="تم التحديث الآن"
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        icon={Crown}
                        iconColor="yellow"
                        label="👑 نسخة النظام"
                        value="V3.0 Pro"
                        lastUpdate="تم التحديث الآن"
                    />
                </div>
            </div>

            {/* Managers List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {dataLoading ? (
                    <div className="col-span-full flex justify-center py-20">
                        <AdoraLoader size="md" message="جاري تحميل البيانات..." />
                    </div>
                ) : managers.length === 0 && !showDeletedManagers ? (
                    <div className="col-span-full text-center py-20 text-white/30">
                        <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>لا يوجد مدراء حالياً</p>
                    </div>
                ) : (
                    <>
                        {/* Active Managers */}
                        {!showDeletedManagers && managers.map((manager) => {
                            const remainingDays = getRemainingLicenseDays((manager as any).licenseExpiry);
                            const licenseStatus = (manager as any).licenseStatus || 'active';

                            return (
                                <div key={manager.id} className="glass-card p-5 rounded-2xl group border border-white/5 hover:border-white/10 transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex gap-4">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-2xl font-bold text-white/20">
                                                {manager.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                                    {manager.name}
                                                    {licenseStatus === 'suspended' && (
                                                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">معلق</span>
                                                    )}
                                                </h3>
                                                <p className="text-white/40 text-sm mb-1">{manager.hotelName || 'فندق جديد'}</p>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="px-2 py-1 rounded-lg bg-white/5 text-white/60">
                                                        كود: <span className="text-white font-mono">{manager.code}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* License Controls */}
                                            <button
                                                onClick={() => handleToggleLicense(manager.id, manager.tenantId, licenseStatus)}
                                                className={`p-2 rounded-xl transition-colors ${licenseStatus === 'active'
                                                    ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                                                    : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                                    }`}
                                                title={licenseStatus === 'active' ? 'تجميد الترخيص' : 'تنشيط الترخيص'}
                                            >
                                                {licenseStatus === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                            </button>

                                            <button
                                                onClick={() => handleRenewLicense(manager.id, manager.tenantId)}
                                                className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                                                title="تجديد الترخيص (سنة)"
                                            >
                                                <Calendar className="w-4 h-4" />
                                            </button>

                                            <button
                                                onClick={() => handleDeleteManager(manager.id, manager.tenantId)}
                                                className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                                title="حذف (نقل للأرشيف)"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* License Info */}
                                    <div className="bg-black/20 rounded-xl p-3 flex justify-between items-center text-sm mb-3">
                                        <div className="flex items-center gap-2 text-white/60">
                                            <Clock className="w-4 h-4" />
                                            <span>ينتهي الترخيص في:</span>
                                        </div>
                                        <div className={`flex items-center gap-2 font-bold ${(remainingDays ?? 0) < 30 ? 'text-red-400' : 'text-green-400'}`}>
                                            {remainingDays ?? 0} يوم
                                            {(remainingDays ?? 0) < 30 && <AlertTriangle className="w-4 h-4" />}
                                        </div>
                                    </div>

                                    {/* Branch List Preview */}
                                    {(manager.branches?.length || 0) > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {manager.branches?.map(code => (
                                                <span key={code} className="text-xs px-2 py-1 rounded bg-white/5 text-white/40">
                                                    فرع {code}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Deleted Managers Section */}
                        {showDeletedManagers && deletedManagers.map((manager) => (
                            <div key={manager.id} className="glass-card p-5 rounded-2xl border border-red-500/10 bg-red-500/5 relative overflow-hidden">
                                <div className="absolute top-2 left-2 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg flex items-center gap-1">
                                    <Trash2 className="w-3 h-3" />
                                    <span>محذوف</span>
                                </div>
                                <div className="flex items-center justify-between mt-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/40">
                                            <Users className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{manager.name}</p>
                                            <p className="text-sm text-white/40">{manager.hotelName || 'غير محدد'}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRestoreManager(manager.id)}
                                        className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors flex items-center gap-2 text-xs font-bold"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        استعادة
                                    </button>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Add Manager Modal */}
            {
                showAddModal && (
                    <AddManagerModal
                        onClose={() => setShowAddModal(false)}
                        onSuccess={() => {
                            setShowAddModal(false);
                            loadData();
                        }}
                    />
                )
            }
        </div >
    );
};

// ============================================================
// ADD MANAGER MODAL
// ============================================================

const AddManagerModal: React.FC<{
    onClose: () => void;
    onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [hotelName, setHotelName] = useState('');
    const [branchCodes, setBranchCodes] = useState<Array<{ code: string; name: string }>>([]); // ✅ Code + Name
    const [currentBranchCode, setCurrentBranchCode] = useState('');
    const [currentBranchName, setCurrentBranchName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // ✅ Auth Context - Single Source of Truth
    const { user, authReady, tenantId, role } = useAuth();

    // ✅ Proactive Uniqueness Warning
    const [conflictingCodes, setConflictingCodes] = useState<Set<string>>(new Set());
    const [checkingCodes, setCheckingCodes] = useState(false);

    // ✅ Handle code input (Format only)
    const handleCodeChange = async (newCode: string) => {
        setCode(newCode);
        setError('');

        if (newCode.length === 4) {
            setCheckingCodes(true);
            try {
                const available = await isPinAvailable(newCode, { authReady, user: user as any });
                if (!available) {
                    setConflictingCodes(prev => new Set(prev).add(newCode));
                    setError(`تحذير: الكود ${newCode} مستخدم بالفعل في النظام.`);
                } else {
                    setConflictingCodes(prev => {
                        const next = new Set(prev);
                        next.delete(newCode);
                        return next;
                    });
                }
            } catch (err) {
                console.warn('Silent PIN check failed:', err);
            } finally {
                setCheckingCodes(false);
            }
        }
    };

    // Note: PIN Availability Check is moved to handleSubmit (Option A - Best Practice)
    // This avoids premature Firestore queries and permission errors during typing.

    // ✅ Add branch
    const handleAddBranch = async () => {
        if (!currentBranchCode.trim() || !currentBranchName.trim()) {
            return;
        }

        const bCode = currentBranchCode.trim();

        if (bCode.length < 1 || bCode.length > 4 || !/^\d+$/.test(bCode)) {
            setError('كود الفرع يجب أن يكون بين 1 و 4 أرقام');
            return;
        }

        if (branchCodes.some(b => b.code === bCode)) {
            setError('كود الفرع موجود بالفعل في قائمتك');
            return;
        }

        if (bCode === code) {
            setError('كود الفرع يجب أن يختلف عن كود المدير الرئيسي');
            return;
        }

        setLoading(true);
        setCheckingCodes(true);
        try {
            const available = await isPinAvailable(bCode, { authReady, user: user as any });
            if (!available) {
                setError(`تحذير: كود الفرع ${bCode} مستخدم بالفعل في مؤسسة أخرى.`);
                setConflictingCodes(prev => new Set(prev).add(bCode));
                setLoading(false);
                setCheckingCodes(false);
                return;
            }

            setBranchCodes([...branchCodes, {
                code: bCode,
                name: currentBranchName.trim()
            }]);
            setCurrentBranchCode('');
            setCurrentBranchName('');
            setError('');

            setConflictingCodes(prev => {
                const next = new Set(prev);
                next.delete(bCode);
                return next;
            });
        } catch (err) {
            console.error('Branch PIN check error:', err);
        } finally {
            setLoading(false);
        }
    };

    // ✅ Remove branch
    const handleRemoveBranch = (codeToRemove: string) => {
        setBranchCodes(branchCodes.filter(c => c.code !== codeToRemove));
        setConflictingCodes(prev => {
            const next = new Set(prev);
            next.delete(codeToRemove);
            return next;
        });
    };

    const handleSubmit = async () => {
        // 1. Basic Validation
        if (code.length !== 4 || !/^\d+$/.test(code)) {
            setError('كود المدير يجب أن يكون 4 أرقام');
            return;
        }

        if (branchCodes.length === 0) {
            setError('يجب إضافة كود فرع واحد على الأقل');
            return;
        }

        if (conflictingCodes.has(code)) {
            setError('كود المدير مستخدم بالفعل. يرجى اختيار كود آخر.');
            return;
        }

        // 2. Auth Check
        if (!authReady || !user) {
            setError('النظام غير جاهز (Auth Not Ready)');
            return;
        }

        // 3. Final Availability Check
        setLoading(true);
        try {
            // Check master pin
            const masterAvailable = await isPinAvailable(code, { authReady, user: user as any });
            if (!masterAvailable) {
                setError('كود المدير مستخدم بالفعل');
                setLoading(false);
                return;
            }

            // Check all branch codes one last time
            for (const b of branchCodes) {
                const bAvailable = await isPinAvailable(b.code, { authReady, user: user as any });
                if (!bAvailable) {
                    setError(`كود الفرع ${b.code} (${b.name}) أصبح مستخدماً الآن من شخص آخر.`);
                    setLoading(false);
                    return;
                }
            }

            // 4. Create Manager
            // Convert to map for service
            const branchNamesMap: Record<string, string> = {};
            branchCodes.forEach(b => {
                branchNamesMap[b.code] = b.name;
            });

            await createManager({
                name: name.trim() || 'مدير جديد',
                code,
                hotelName: hotelName.trim() || undefined,
                maxBranches: branchCodes.length,
                branchCodes: branchCodes.map(b => b.code),
                branchNames: branchNamesMap,
            });

            haptic('success');
            playSound('success');
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'حدث خطأ');
            haptic('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="glass-card w-full max-w-md rounded-3xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                            <UserPlus className="w-5 h-5 text-yellow-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white">إضافة مدير جديد</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4 overflow-y-auto">
                    {/* Name (Optional) */}
                    <div>
                        <label className="block text-sm text-white/60 mb-2">اسم المدير (اختياري)</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="input"
                            placeholder="مثال: محمد أحمد"
                        />
                    </div>

                    {/* Code */}
                    <div>
                        <label className="block text-sm text-white/60 mb-2">كود المدير (4 أرقام) *</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={code}
                                onChange={e => handleCodeChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                className={`input text-center text-2xl tracking-widest pr-10 ${conflictingCodes.has(code) ? 'border-yellow-500/50 text-yellow-500' : ''}`}
                                placeholder="0000"
                                maxLength={4}
                            />
                            {checkingCodes && (
                                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                    <AdoraLoaderInline size={16} />
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-white/40 mt-1">كود الدخول الخاص بالمدير</p>
                        {error && (error.includes(code) || error.includes('المدير')) && (
                            <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {error}
                            </p>
                        )}
                    </div>

                    {/* Hotel Name */}
                    <div>
                        <label className="block text-sm text-white/60 mb-2">اسم الفندق / البراند</label>
                        <input
                            type="text"
                            value={hotelName}
                            onChange={e => setHotelName(e.target.value)}
                            className="input"
                            placeholder="مثال: سلسلة فنادق الأهرام"
                        />
                    </div>

                    {/* ✅ Branch Codes & Names */}
                    <div>
                        <label className="block text-sm text-white/60 mb-2">الفروع (الكود + الاسم) *</label>
                        <div className="flex flex-col gap-2 mb-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={currentBranchCode}
                                    onChange={e => setCurrentBranchCode(e.target.value.replace(/\D/g, ''))}
                                    className={`input w-24 text-center ${conflictingCodes.has(currentBranchCode) ? 'border-yellow-500/50 text-yellow-500' : ''}`}
                                    placeholder="الكود"
                                />
                                <input
                                    type="text"
                                    value={currentBranchName}
                                    onChange={e => setCurrentBranchName(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddBranch()}
                                    className="input flex-1"
                                    placeholder="اسم الفرع (مثل: فرع وسط البلد)"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleAddBranch}
                                disabled={loading || !currentBranchCode.trim() || !currentBranchName.trim()}
                                className="w-full py-2 rounded-xl bg-primary-500 text-white font-medium disabled:opacity-50 hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
                            >
                                {loading && checkingCodes ? <AdoraLoaderInline size={16} /> : <span>إضافة للترخيص ➕</span>}
                            </button>
                        </div>

                        {/* List of Added Branches */}
                        <div className="space-y-2">
                            {branchCodes.length > 0 ? (
                                branchCodes.map((branch) => (
                                    <div
                                        key={branch.code}
                                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 rounded-lg bg-primary-500/20 text-primary-400 text-xs flex items-center justify-center font-bold">
                                                {branch.code}
                                            </span>
                                            <span className="text-sm text-white font-medium">{branch.name}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveBranch(branch.code)}
                                            className="text-red-400 hover:text-red-300 p-1"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center text-center h-64 text-white/20">
                                    <Key className="w-16 h-16 mb-4 opacity-20" />
                                    <p className="font-bold">الكود (4 أرقام) سيظهر هنا</p>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-white/40 mt-2">
                            عدد الفروع في العقد: <span className="text-white font-bold">{branchCodes.length}</span>
                        </p>
                    </div>

                    {/* General Errors (Branch Related or System) */}
                    {error && !error.includes(code) && !error.includes('المدير') && (
                        <p className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg flex items-center justify-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 flex-shrink-0">
                    <button
                        onClick={handleSubmit}
                        disabled={loading || branchCodes.length === 0 || code.length !== 4}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-yellow-500/20 transition-all"
                    >
                        {loading ? (
                            <AdoraLoaderInline size={20} />
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                حفظ وإنشاء الحساب
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OwnerPanel;
