/**
 * Owner Control Panel
 * "The God Mode" - Manage Licenses & Tenants
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Crown, UserPlus, Users, Building2, Trash2, Edit,
    Save, X, RefreshCw, LogOut, Eye, EyeOff, Check,
    Calendar, Clock, Pause, Play, AlertTriangle, Key, Shield, ArrowRight, LayoutDashboard, CheckCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { StatCard } from '../../components/common/StatCard';
import { responsiveClasses } from '../../utils/mobileOptimization';
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
    getDeletedManagers
} from '../../services/ownerService';
import { executeDeepAudit } from '../../services/deepAuditService';
import { collection, getDocs, query, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { haptic, playSound } from '../../utils/uxEffects';
import { logger } from '../../services/loggerService';
import { auth } from '../../services/firebase';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { UnifiedModal, ModalActions } from '../../components/common/UnifiedModal';

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
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditStatus, setAuditStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [auditProgress, setAuditProgress] = useState<string>('');
    const [showAuditChoiceModal, setShowAuditChoiceModal] = useState(false);
    const [showPurgeConfirmModal, setShowPurgeConfirmModal] = useState(false);
    const [resetCode, setResetCode] = useState('');

    // Manual init not needed - relying on useAuth
    // User role check handles redirection

    // Check if user is owner - CRITICAL: Must wait for authReady
    useEffect(() => {
        if (!authReady) {
            return; // Still loading
        }

        if (!user) {
            // No user - redirect to login
            navigate('/login', { replace: true });
            return;
        }

        if (user.role !== 'owner') {
            // Not owner - redirect to home
            navigate('/', { replace: true });
            return;
        }

        // User is owner - safe to proceed
    }, [user, authReady, navigate]);

    // Load managers and branches - CRITICAL: Must wait for authReady AND user confirmation
    useEffect(() => {
        // ✅ Gate: Wait for Auth Ready AND confirm user is owner
        if (authReady && user?.role === 'owner') {
            loadData();
        }
    }, [authReady, user]);

    // ✅ CRITICAL: Show loading while auth is not ready OR user is not confirmed owner
    if (!authReady) {
        return (
            <div className="min-h-screen flex items-center justify-center transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
                <AdoraLoader size="lg" message="جاري تحميل بيانات المستخدم..." />
            </div>
        );
    }

    // ✅ CRITICAL: Show loading if user is not owner (redirecting)
    if (!user || user.role !== 'owner') {
        return (
            <div className="min-h-screen flex items-center justify-center transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
                <AdoraLoader size="lg" message="جاري التحقق من الصلاحيات..." />
            </div>
        );
    }

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
                    logger.warn(`License Alert [${manager.name}]`, notification.message, 'OwnerPanel');
                }
            });

            // Mock branches for now or load from structure if needed
            // setBranches([...]); 
        } catch (error: any) {
            logger.error('Error loading owner data', error, 'OwnerPanel');
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
            logger.error('Error creating manager', error, 'OwnerPanel');
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
                logger.error('Error deleting manager', err, 'OwnerPanel');
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
                logger.error('Error restoring manager', err, 'OwnerPanel');
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
                logger.error('Error toggling license', error, 'OwnerPanel');
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
                logger.error('Error renewing license', error, 'OwnerPanel');
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
                logger.info('Syncing permissions', { uid: auth.currentUser.uid }, 'OwnerPanel');
                await saveUserBinding(auth.currentUser.uid, user.tenantId, user.role);
                haptic('success');
                success('تم تحديث الصلاحيات بنجاح');
            } else {
                error('لم يتم العثور على جلسة نشطة');
            }
        } catch (err) {
            logger.error('Sync failed', err, 'OwnerPanel');
            error('فشل التحديث');
        } finally {
            setDataLoading(false);
        }
    };

    const handlePurgeSystem = async () => {
        logger.info('Purge System (Nuclear Mode) button clicked', null, 'OwnerPanel');
        
        // ✅ CRITICAL: Validate user before proceeding
        if (!authReady) {
            error('⏳ يرجى الانتظار حتى يتم تحميل بيانات المستخدم...');
            return;
        }

        if (!user) {
            logger.error('No user found', null, 'OwnerPanel');
            error('⚠️ خطأ تقني: لم يتم التعرف على المستخدم. يرجى تسجيل الخروج والدخول مرة أخرى.');
            return;
        }

        if (user.role !== 'owner') {
            logger.error('User is not owner', null, 'OwnerPanel');
            error('⚠️ خطأ: هذه العملية متاحة للمالك فقط.');
            return;
        }

        if (!user.id) {
            logger.error('No user ID found', null, 'OwnerPanel');
            error("⚠️ خطأ تقني: لم يتم التعرف على هوية المالك. يرجى تسجيل الخروج والدخول مرة أخرى.");
            return;
        }

        // 🧪 DEBUG LOGS
        const { auth } = await import('../../services/firebase');
        logger.info('Purge Request', { userId: user.id, firebaseUid: auth.currentUser?.uid }, 'OwnerPanel');

        // Show custom confirmation modal (wait for user confirmation)
        setShowPurgeConfirmModal(true);
        setResetCode('');
    };

    const handleConfirmPurge = async () => {
        // Validate RESET code
        if (resetCode.trim() !== 'RESET') {
            error('⚠️ لم تكتب الكلمة الصحيحة. يرجى كتابة (RESET) باللغة الإنجليزية.');
            return;
        }

        // Close modal
        setShowPurgeConfirmModal(false);
        setResetCode('');

        logger.info('User confirmed Purge System - starting', null, 'OwnerPanel');
        
        setDataLoading(true);
        setAuditLoading(true);
        setAuditStatus('loading');
        setAuditProgress('☢️ جاري المسح الكامل...');

        try {
            logger.info('Initializing Nuclear Purge via Deep Audit', null, 'OwnerPanel');
            setAuditProgress('🔥 جاري حذف جميع البيانات...');
            // ✅ MERGED: Use executeDeepAudit with nuclearMode=true
            const report = await executeDeepAudit({ nuclearMode: true, ownerId: user!.id });
            
            setAuditProgress('✅ اكتمل المسح بنجاح!');
            setAuditStatus('success');
            
            haptic('success');
            playSound('success');

            // Re-fetch all data to clear the UI
            await loadData();

            success(`✅ تم المسح الكامل بنجاح!\n\n🗑️ تم حذف: ${report.summary.totalDeleted} سجل\n✨ النظام الآن نظيف وجاهز للبدء من جديد`);

            // Forced reload to clear any cached states in services
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (err: any) {
            logger.error('Purge System error', err, 'OwnerPanel');
            logger.error('Error details', {
                message: err.message,
                code: err.code,
                stack: err.stack
            });
            const errorMsg = err.message || 'خطأ غير معروف';
            setAuditStatus('error');
            setAuditProgress('❌ فشل المسح');
            error(`❌ فشل المسح الكامل\n\n${errorMsg}\n\n💡 جرب زر "مزامنة الأمان" ثم أعد المحاولة`);
            haptic('error');
            playSound('error');
            
            // Reset status after 5 seconds
            setTimeout(() => {
                setAuditStatus('idle');
                setAuditProgress('');
            }, 5000);
        } finally {
            setDataLoading(false);
            setAuditLoading(false);
        }
    };

    const handleDeepAudit = async () => {
        logger.info('Deep Audit button clicked', null, 'OwnerPanel');
        
        // ✅ CRITICAL: Validate user before proceeding
        if (!authReady) {
            error('⏳ يرجى الانتظار حتى يتم تحميل بيانات المستخدم...');
            return;
        }

        if (!user) {
            logger.error('No user found', null, 'OwnerPanel');
            error('⚠️ خطأ تقني: لم يتم التعرف على المستخدم. يرجى تسجيل الخروج والدخول مرة أخرى.');
            return;
        }

        if (user.role !== 'owner') {
            logger.error('User is not owner', null, 'OwnerPanel');
            error('⚠️ خطأ: هذه العملية متاحة للمالك فقط.');
            return;
        }

        if (!user.id) {
            logger.error('No user ID found', null, 'OwnerPanel');
            error('⚠️ خطأ تقني: لم يتم التعرف على هوية المالك.');
            return;
        }

        logger.info('User ID found', { userId: user.id }, 'OwnerPanel');

        const confirm1 = window.confirm(
            '🔍 Deep Audit Protocol\n\n' +
            'سيتم فحص النظام بالكامل (Firestore, Auth, Storage) وحذف أي بيانات تجريبية.\n\n' +
            'هل أنت متأكد؟'
        );
        if (!confirm1) {
            logger.info('User cancelled Deep Audit', null, 'OwnerPanel');
            return;
        }

        logger.info('User confirmed Deep Audit - starting', null, 'OwnerPanel');
        setAuditLoading(true);
        setAuditStatus('loading');
        setAuditProgress('🔍 جاري فحص Firestore...');

        try {
            logger.info('Starting Deep Audit Protocol', null, 'OwnerPanel');
            
            setAuditProgress('📊 جاري فحص Firestore...');
            const report = await executeDeepAudit();
            setAuditProgress('✅ اكتمل الفحص بنجاح!');

            // Log audit report
            logger.info('DEEP AUDIT REPORT - TOTAL PURGE', {
                firestore: {
                    tenantsScanned: report.firestore.tenantsScanned,
                    documentsDeleted: report.firestore.documentsDeleted,
                    managersDeleted: report.firestore.managersDeleted,
                    branchesDeleted: report.firestore.branchesDeleted,
                    orphanedDocuments: report.firestore.orphanedDocuments.length,
                    errors: report.firestore.errors.length,
                },
                auth: {
                    usersScanned: report.auth.usersScanned,
                    orphanedUids: report.auth.orphanedUids.length,
                    usersDeleted: report.auth.usersDeleted,
                    errors: report.auth.errors.length,
                },
                storage: {
                    pathsScanned: report.storage.pathsScanned.length,
                    filesFound: report.storage.filesFound.length,
                    filesDeleted: report.storage.filesDeleted,
                    errors: report.storage.errors.length,
                },
                summary: {
                    totalDeleted: report.summary.totalDeleted,
                    managersDeleted: report.firestore.managersDeleted,
                    branchesDeleted: report.firestore.branchesDeleted,
                    isSterile: report.summary.isSterile,
                    status: report.summary.status
                }
            }, 'OwnerPanel');

            // Display status with enhanced notifications
            if (report.summary.status === 'STERILE') {
                logger.info('System Status: 100% Sterile', null, 'OwnerPanel');
                setAuditStatus('success');
                success(
                    `✅ تم الفحص بنجاح!\n\n` +
                    `📊 الحالة: النظام نظيف 100%\n` +
                    `🗑️ تم حذف: ${report.summary.totalDeleted} عنصر\n` +
                    `👥 المدراء المحذوفين: ${report.firestore.managersDeleted}\n` +
                    `🏢 الفروع المحذوفة: ${report.firestore.branchesDeleted}\n\n` +
                    `✨ النظام جاهز للإعداد من جديد`
                );
            } else if (report.summary.status === 'CONTAMINATED') {
                logger.warn('System Status: CONTAMINATED', null, 'OwnerPanel');
                setAuditStatus('error');
                error(`⚠️ اكتمل الفحص مع تحذيرات\n\nتم حذف ${report.summary.totalDeleted} عنصر، لكن لا يزال هناك بيانات في النظام`);
            } else {
                logger.error('System Status: ERROR', null, 'OwnerPanel');
                const totalErrors = report.firestore.errors.length + report.auth.errors.length + report.storage.errors.length;
                setAuditStatus('error');
                error(`❌ فشل الفحص\n\nعدد الأخطاء: ${totalErrors}\n\nراجع Console للتفاصيل`);
                if (totalErrors > 0) {
                    const errorDetails = [
                        ...report.firestore.errors.slice(0, 3),
                        ...report.auth.errors.slice(0, 2),
                        ...report.storage.errors.slice(0, 2)
                    ].join('\n');
                    alert(`❌ Deep Audit فشل:\n\nعدد الأخطاء: ${totalErrors}\n\nالأخطاء:\n${errorDetails}\n\nتفاصيل إضافية في Console.`);
                }
            }

            haptic('success');
            playSound('success');
            
            // Reset status after 3 seconds
            setTimeout(() => {
                setAuditStatus('idle');
                setAuditProgress('');
            }, 3000);

        } catch (err: any) {
            logger.error('Deep Audit error', err, 'OwnerPanel');
            logger.error('Error details', {
                message: err.message,
                code: err.code,
                name: err.name,
                stack: err.stack
            });
            
            const errorMsg = err.message || 'خطأ غير معروف';
            const errorCode = err.code || '';
            
            setAuditStatus('error');
            setAuditProgress('❌ فشل العملية');
            
            // Check for permission errors
            if (errorCode === 'permission-denied' || errorMsg.includes('permission') || errorMsg.includes('Access denied')) {
                error(`❌ فشل الفحص - صلاحيات غير كافية\n\n${errorMsg}\n\n💡 الحل:\n1. تأكد إنك Owner\n2. جرب زر "مزامنة الأمان"\n3. تحقق من Firebase Security Rules`);
                alert(`❌ Deep Audit فشل - صلاحيات غير كافية:\n\n${errorMsg}\n\nالحل:\n1. تأكد إنك Owner\n2. جرب زر "مزامنة الأمان"\n3. تحقق من Firebase Security Rules\n\nتفاصيل في Console.`);
            } else {
                error(`❌ فشل الفحص\n\n${errorMsg}\n\nراجع Console للتفاصيل`);
                alert(`❌ Deep Audit فشل:\n\n${errorMsg}\n\nتفاصيل إضافية في Console.`);
            }
            
            haptic('error');
            playSound('error');
            
            // Reset status after 5 seconds
            setTimeout(() => {
                setAuditStatus('idle');
                setAuditProgress('');
            }, 5000);
        } finally {
            setAuditLoading(false);
            logger.info('Deep Audit handler finished', null, 'OwnerPanel');
        }
    };

    return (
        <div className="flex min-h-screen transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
            {/* ✅ ALWAYS VISIBLE SIDEBAR - Premium Professional Design */}
            <div className="desktop-sidebar-container flex-shrink-0 fixed top-0 right-0 h-screen z-30">
                <aside id="admin-sidebar" className="h-full">
                    <AdminSidebar
                        isOwner={user?.role === 'owner'}
                    />
                </aside>
            </div>

            {/* Main Content Area - Adjusted for fixed sidebar */}
            <main className="flex-1 p-4 pb-24 lg:pt-4 pt-4 overflow-x-hidden min-w-0 flex flex-col" style={{ marginRight: '280px' }}>
                <div className="flex-1">
                    {/* ✅ Standard Header - Same as other pages */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center">
                                <Crown className="w-6 h-6 text-teal-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">لوحة المالك</h1>
                                <p className="text-sm text-white/60">التحكم الكامل في المنظومة والتراخيص</p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/owner-dashboard')}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30 hover:border-teal-500/50 transition-all"
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            <span className="text-sm font-medium">الرئيسية</span>
                        </button>
                    </div>

                    <div className="max-w-7xl mx-auto p-6 space-y-6">

                {/* Actions Bar - Mobile-First: Scrollable Horizontal */}
                {/* ✅ ORGANIZED: Main Actions First, Settings Second */}
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide mb-6">
                    {/* ============================================ */}
                    {/* 📋 MAIN ACTIONS (Primary Functions) */}
                    {/* ============================================ */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold shadow-lg hover:shadow-xl transition-all"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>إضافة مدير</span>
                    </button>

                    <button
                        onClick={handleSyncPermissions}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30 transition-all"
                        title="تحديث صلاحيات Cloud Firestore"
                    >
                        {dataLoading ? <AdoraLoaderInline size={14} /> : <RefreshCw className="w-4 h-4" />}
                        <span>مزامنة الأمان</span>
                    </button>

                    <button
                        onClick={() => setShowAuditChoiceModal(true)}
                        disabled={auditLoading || dataLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all relative overflow-hidden ${
                            auditStatus === 'loading' 
                                ? 'bg-blue-500/30 text-blue-300 border-blue-400/50 animate-pulse shadow-lg shadow-blue-500/30' 
                                : auditStatus === 'success'
                                ? 'bg-green-500/30 text-green-300 border-green-400/50 shadow-lg shadow-green-500/30'
                                : auditStatus === 'error'
                                ? 'bg-red-500/30 text-red-300 border-red-400/50 shadow-lg shadow-red-500/30'
                                : 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={auditProgress || "فحص شامل أو مسح كامل للنظام"}
                    >
                        {/* Pulsing ring animation when loading */}
                        {auditStatus === 'loading' && (
                            <span className="absolute inset-0 rounded-xl animate-ping bg-blue-500/20"></span>
                        )}
                        <div className="relative flex items-center gap-2">
                            {(auditLoading || dataLoading) ? (
                                <div className="flex items-center gap-2">
                                    <AdoraLoaderInline size={16} />
                                    <span className="text-xs font-medium animate-pulse">{auditProgress || 'جاري المعالجة...'}</span>
                                </div>
                            ) : auditStatus === 'success' ? (
                                <>
                                    <CheckCircle className="w-4 h-4 animate-bounce" />
                                    <span className="text-xs font-medium">✅ اكتمل</span>
                                </>
                            ) : auditStatus === 'error' ? (
                                <>
                                    <AlertTriangle className="w-4 h-4 animate-shake" />
                                    <span className="text-xs font-medium">❌ فشل</span>
                                </>
                            ) : (
                                <>
                                    <Shield className="w-4 h-4" />
                                    <span>🔍 فحص/مسح النظام</span>
                                </>
                            )}
                        </div>
                    </button>

                    <button
                        onClick={() => setShowDeletedManagers(!showDeletedManagers)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${showDeletedManagers
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                            }`}
                    >
                        {showDeletedManagers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span>{showDeletedManagers ? 'إخفاء المحذوفين' : 'سلة المهملات'}</span>
                    </button>

                    <button
                        onClick={logout}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-all border border-white/10"
                        title="تسجيل الخروج"
                    >
                        <LogOut className="w-4 h-4 flip-rtl" />
                    </button>
                </div>

            {/* Stats Overview - Mobile-First Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

            {/* Managers List - Mobile-First: Single column on mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                                <div key={manager.id} className="p-6 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all group">
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                                        <div className="flex gap-4 flex-1 min-w-0">
                                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xl font-bold text-white/20 flex-shrink-0">
                                                {manager.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
                                                    <span className="truncate">{manager.name}</span>
                                                    {licenseStatus === 'suspended' && (
                                                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs whitespace-nowrap">معلق</span>
                                                    )}
                                                </h3>
                                                <p className="text-sm text-white/40 mb-1 truncate">{manager.hotelName || 'فندق جديد'}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs px-2 py-1 rounded-lg bg-white/5 text-white/60">
                                                        كود: <span className="text-white font-mono">{manager.code}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Action Buttons - Always visible */}
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => handleToggleLicense(manager.id, manager.tenantId, licenseStatus)}
                                                className={`p-2 rounded-lg transition-colors ${licenseStatus === 'active'
                                                    ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                                                    : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                                    }`}
                                                title={licenseStatus === 'active' ? 'تجميد الترخيص' : 'تنشيط الترخيص'}
                                            >
                                                {licenseStatus === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                            </button>

                                            <button
                                                onClick={() => handleRenewLicense(manager.id, manager.tenantId)}
                                                className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                                title="تجديد الترخيص (سنة)"
                                            >
                                                <Calendar className="w-4 h-4" />
                                            </button>

                                            <button
                                                onClick={() => handleDeleteManager(manager.id, manager.tenantId)}
                                                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                                title="حذف (نقل للأرشيف)"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* License Info */}
                                    <div className="p-3 rounded-lg bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                                        <div className="flex items-center gap-2 text-sm text-white/60">
                                            <Clock className="w-4 h-4" />
                                            <span>ينتهي الترخيص في:</span>
                                        </div>
                                        <div className={`flex items-center gap-2 font-bold text-sm ${(remainingDays ?? 0) < 30 ? 'text-red-400' : 'text-green-400'}`}>
                                            {remainingDays ?? 0} يوم
                                            {(remainingDays ?? 0) < 30 && <AlertTriangle className="w-4 h-4" />}
                                        </div>
                                    </div>

                                    {/* Branch List Preview */}
                                    {(manager.branches?.length || 0) > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {manager.branches?.map(code => (
                                                <span key={code} className="text-xs px-2 py-1 rounded-lg bg-white/5 text-white/40">
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
                            <div key={manager.id} className="p-6 rounded-xl border border-red-500/20 bg-red-500/5 relative overflow-hidden">
                                <div className="absolute top-3 right-3 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg flex items-center gap-1">
                                    <Trash2 className="w-3 h-3" />
                                    <span>محذوف</span>
                                </div>
                                <div className="flex items-center justify-between">
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
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors text-sm font-bold"
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

                    {/* ✅ Audit Choice Modal - Premium Design */}
                    {showAuditChoiceModal && (
                        <div
                            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                            onClick={() => setShowAuditChoiceModal(false)}
                            style={{ background: 'rgba(0, 0, 0, 0.92)' }}
                        >
                            <div
                                className="relative w-full max-w-lg rounded-3xl p-6 sm:p-8 animate-scale-in shadow-2xl"
                                style={{
                                    background: 'var(--theme-bg-secondary)',
                                    border: '1px solid var(--theme-border-primary)'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                        <Shield className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">اختر نوع العملية</h3>
                                        <p className="text-sm text-white/60">اختر العملية المناسبة لنظامك</p>
                                    </div>
                                    <button
                                        onClick={() => setShowAuditChoiceModal(false)}
                                        className="ml-auto p-2 rounded-lg hover:bg-white/10 transition-colors"
                                    >
                                        <X className="w-5 h-5 text-white/60" />
                                    </button>
                                </div>

                                {/* Options */}
                                <div className="space-y-3 mb-6">
                                    {/* Deep Audit Option */}
                                    <button
                                        onClick={async () => {
                                            setShowAuditChoiceModal(false);
                                            await handleDeepAudit();
                                        }}
                                        disabled={auditLoading}
                                        className="w-full p-4 rounded-xl border-2 border-blue-500/30 bg-blue-500/10 hover:border-blue-500/50 hover:bg-blue-500/20 transition-all text-right disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                <Shield className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div className="flex-1 text-right">
                                                <h4 className="text-lg font-bold text-white mb-1">🔍 فحص شامل (Deep Audit)</h4>
                                                <p className="text-sm text-white/70 leading-relaxed">
                                                    فحص النظام بالكامل وحذف البيانات التجريبية فقط
                                                    <br />
                                                    <span className="text-green-400 font-semibold">✅ آمن - لا يحذف البيانات المهمة</span>
                                                </p>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Nuclear Purge Option */}
                                    <button
                                        onClick={async () => {
                                            setShowAuditChoiceModal(false);
                                            await handlePurgeSystem();
                                        }}
                                        disabled={dataLoading}
                                        className="w-full p-4 rounded-xl border-2 border-red-500/30 bg-red-500/10 hover:border-red-500/50 hover:bg-red-500/20 transition-all text-right disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                                <Trash2 className="w-5 h-5 text-red-400" />
                                            </div>
                                            <div className="flex-1 text-right">
                                                <h4 className="text-lg font-bold text-white mb-1">☢️ مسح كامل (Nuclear Purge)</h4>
                                                <p className="text-sm text-white/70 leading-relaxed">
                                                    مسح كافة البيانات للبدء من الصفر
                                                    <br />
                                                    <span className="text-red-400 font-semibold">⚠️ خطير - يحذف كل شيء ما عدا المالك</span>
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                {/* Footer Info */}
                                <div className="pt-4 border-t border-white/10">
                                    <p className="text-xs text-white/50 text-center">
                                        💡 نصيحة: استخدم "فحص شامل" للتنظيف الآمن، و"مسح كامل" فقط عند الحاجة للبدء من الصفر
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ✅ Purge Confirmation Modal - Custom Themed */}
                    {showPurgeConfirmModal && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
                            onClick={() => setShowPurgeConfirmModal(false)}
                        >
                            {/* Backdrop */}
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                            {/* Modal Content */}
                            <div
                                className="relative w-full max-w-lg rounded-3xl p-6 sm:p-8 animate-modal-in shadow-2xl"
                                style={{
                                    background: 'var(--theme-bg-secondary)',
                                    border: '1px solid var(--theme-border-primary)'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                                        <AlertTriangle className="w-6 h-6 text-red-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-white">⚠️ تحذير شديد: مسح كامل للنظام</h3>
                                        <p className="text-sm text-white/60">عملية لا يمكن التراجع عنها</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowPurgeConfirmModal(false);
                                            setResetCode('');
                                        }}
                                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                    >
                                        <X className="w-5 h-5 text-white/60" />
                                    </button>
                                </div>

                                {/* Warning Content */}
                                <div className="mb-6 space-y-4">
                                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                                        <p className="text-white/90 leading-relaxed mb-3">
                                            أنت على وشك <span className="font-bold text-red-400">مسح كافة بيانات النظام</span> للبدء من جديد.
                                        </p>
                                        <div className="space-y-2 text-sm text-white/70">
                                            <p className="flex items-start gap-2">
                                                <span className="text-red-400 mt-1">•</span>
                                                <span>سيتم حذف جميع <strong>المشتركين</strong> (Managers) وبياناتهم</span>
                                            </p>
                                            <p className="flex items-start gap-2">
                                                <span className="text-red-400 mt-1">•</span>
                                                <span>سيتم حذف جميع <strong>الفروع</strong> (Branches) و<strong>الغرف</strong> (Rooms)</span>
                                            </p>
                                            <p className="flex items-start gap-2">
                                                <span className="text-red-400 mt-1">•</span>
                                                <span>سيتم حذف جميع <strong>الطلبات</strong> (Requests) و<strong>السجلات</strong></span>
                                            </p>
                                            <p className="flex items-start gap-2">
                                                <span className="text-red-400 mt-1">•</span>
                                                <span>سيتم حذف جميع <strong>المستخدمين</strong> (Users) ما عدا حساب المالك</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* RESET Code Input */}
                                    <div>
                                        <label className="block text-sm font-medium text-white/80 mb-2">
                                            لتأكيد المسح الشامل، اكتب كلمة <span className="font-bold text-red-400">RESET</span> باللغة الإنجليزية:
                                        </label>
                                        <input
                                            type="text"
                                            value={resetCode}
                                            onChange={(e) => setResetCode(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && resetCode.trim() === 'RESET') {
                                                    handleConfirmPurge();
                                                }
                                            }}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-red-500/50 focus:bg-white/10 transition-all text-center font-mono text-lg tracking-wider"
                                            placeholder="اكتب RESET هنا"
                                            autoFocus
                                        />
                                        {resetCode && resetCode.trim() !== 'RESET' && (
                                            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />
                                                الكلمة غير صحيحة. يجب أن تكون بالضبط: <strong>RESET</strong>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Footer - Action Buttons with Clear Explanations */}
                                <div className="pt-4 border-t border-white/10">
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        {/* Cancel Button */}
                                        <button
                                            onClick={() => {
                                                setShowPurgeConfirmModal(false);
                                                setResetCode('');
                                            }}
                                            className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/20 text-white font-medium transition-all flex items-center justify-center gap-2"
                                        >
                                            <X className="w-4 h-4" />
                                            <span>إلغاء</span>
                                            <span className="text-xs text-white/50">(لا شيء سيحدث)</span>
                                        </button>

                                        {/* Confirm Button */}
                                        <button
                                            onClick={handleConfirmPurge}
                                            disabled={resetCode.trim() !== 'RESET' || auditLoading}
                                            className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                        >
                                            {auditLoading ? (
                                                <>
                                                    <AdoraLoaderInline size={16} />
                                                    <span>جاري المسح...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Trash2 className="w-4 h-4" />
                                                    <span>تأكيد المسح الكامل</span>
                                                    <span className="text-xs opacity-80">(لا يمكن التراجع)</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-white/40 text-center mt-3">
                                        💡 <strong>زر الإلغاء:</strong> يغلق النافذة دون تنفيذ أي عملية
                                        <br />
                                        ⚠️ <strong>زر التأكيد:</strong> يبدأ المسح الكامل فوراً - لا يمكن التراجع بعد الضغط
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

// ============================================================
// ADD MANAGER MODAL
// ============================================================

interface AddManagerModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const AddManagerModal: React.FC<AddManagerModalProps> = ({ onClose, onSuccess }) => {
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
                logger.warn('Silent PIN check failed', err, 'OwnerPanel');
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
            logger.error('Branch PIN check error', err, 'OwnerPanel');
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
        <div className={`fixed inset-0 bg-black/90 flex items-center justify-center z-50 ${responsiveClasses.container} overflow-y-auto`}>
            <div className={`${responsiveClasses.modalMedium} ${responsiveClasses.cardRounded} bg-white/10 backdrop-blur-xl border border-white/20 overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col my-auto shadow-2xl`}>
                {/* Header - Mobile-First */}
                <div className={`flex items-center justify-between ${responsiveClasses.cardPadding} border-b border-white/10 flex-shrink-0`}>
                    <div className={`flex items-center ${responsiveClasses.gridGapSmall} min-w-0 flex-1`}>
                        <div className={`${responsiveClasses.iconButton} ${responsiveClasses.cardRounded} bg-yellow-500/20 flex items-center justify-center flex-shrink-0`}>
                            <UserPlus className={`${responsiveClasses.iconMedium} text-yellow-400`} />
                        </div>
                        <h3 className={`${responsiveClasses.headerTitle} text-white truncate`}>إضافة مدير جديد</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className={`${responsiveClasses.iconButton} ${responsiveClasses.cardRounded} bg-white/10 flex items-center justify-center text-white/60 hover:text-white ${responsiveClasses.touch} flex-shrink-0`}
                    >
                        <X className={responsiveClasses.iconMedium} />
                    </button>
                </div>

                {/* Content - Mobile-First Scrollable */}
                <div className={`${responsiveClasses.cardPadding} ${responsiveClasses.gridGap} overflow-y-auto flex-1`}>
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

                {/* Footer - Mobile-First */}
                <div className={`${responsiveClasses.cardPadding} border-t border-white/10 flex-shrink-0`}>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || branchCodes.length === 0 || code.length !== 4}
                        className={`${responsiveClasses.touch} w-full py-3 sm:py-4 ${responsiveClasses.cardRounded} bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-yellow-500/20 transition-all ${responsiveClasses.buttonText}`}
                    >
                        {loading ? (
                            <AdoraLoaderInline size={20} />
                        ) : (
                            <>
                                <Save className={responsiveClasses.iconMedium} />
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
