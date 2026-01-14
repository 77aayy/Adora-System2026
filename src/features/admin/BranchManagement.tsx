/**
 * Branch Management Component
 * Adora Hotel Management System V3
 * 
 * SaaS Model Implementation:
 * - Tenant Admin (Hotel Manager) has FULL control.
 * - SaaS Limits (Max Branches) are strictly enforced.
 * - Branch Codes are 4-digit numeric, managed by Tenant Admin.
 * - Soft Delete 'Kill Switch' logic enabled.
 */

import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, Wand2, AlertCircle, X, Building2, DoorOpen, Layers, Save, RefreshCw } from 'lucide-react';
import {
    addDoc,
    updateDoc,
    doc,
    collection,
    onSnapshot,
    Timestamp,
    setDoc, // ✅ Added setDoc for specific ID creation
    deleteDoc
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useTenantBranches } from '../../hooks/useTenantData';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { haptic, playSound } from '../../utils/uxEffects';
import { SkeletonCard, SkeletonStats } from '../../components/shared/Skeleton';
import { cancelAllActiveRequestsByBranch } from '../../services/requestService';
import { BranchSetupWizard } from './BranchSetupWizard';
import { subscribeToRooms, updateRoom, deleteRoom, addRoom } from '../../services/roomService';
import { Room } from '../../types';


export const BranchManagement: React.FC = () => {
    const { user } = useAuth();
    // In this SaaS model, the person accessing this Admin page IS the Tenant Manager/Owner
    // So we don't restrict actions based on 'isOwner' flag from role, 
    // but rather assume authorization is handled by the Route Guard.

    const tenantContext = useTenant();
    const { tenantId, setTenant } = tenantContext;

    // ✅ FORCE SYNC: If Owner, ensure Tenant Context is 'system-owner'
    // This fixes the list not updating because the hook was looking at null
    useEffect(() => {
        if (user?.role === 'owner' && tenantId !== 'system-owner') {
            setTenant('system-owner');
        }
    }, [user, tenantId, setTenant]);

    // Use tenant-scoped branches hook
    // Note: The hook will re-run automatically when setTenant updates the context
    const { branches: tenantBranches, loading } = useTenantBranches();

    // SaaS Limit Check
    // Handle case where tenantInfo might be null initially for system-owner
    const MAX_BRANCHES = (tenantContext?.tenantInfo as any)?.maxBranches || (user?.role === 'owner' ? 999 : 3);

    // Filter active vs deleted branches
    const activeBranches = tenantBranches.filter((b: any) => b.status !== 'scheduled_for_deletion');
    const deletedBranches = tenantBranches.filter((b: any) => b.status === 'scheduled_for_deletion');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingBranch, setEditingBranch] = useState<any>(null);
    const [showSetupWizard, setShowSetupWizard] = useState(false);

    // ✅ Undo Toast State (Previously Missing)
    const [selectedBranch, setSelectedBranch] = useState<any>(null);
    const [deletedBranchId, setDeletedBranchId] = useState<string | null>(null);
    const [showUndoToast, setShowUndoToast] = useState(false);
    const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    // Check for incomplete setup in localStorage
    const [hasIncompleteSetup, setHasIncompleteSetup] = useState(false);
    useEffect(() => {
        const saved = localStorage.getItem('adora_branch_setup_wizard');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                setHasIncompleteSetup(!data.isComplete && data.branchData?.name);
            } catch (e) {
                setHasIncompleteSetup(false);
            }
        }
    }, [showSetupWizard]);

    // 🔢 Calculate Remaining days for soft-deleted branches
    const getRemainingDays = (deletedAt: any) => {
        if (!deletedAt) return 0;
        const date = deletedAt.toDate ? deletedAt.toDate() : new Date(deletedAt);
        const diff = new Date().getTime() - date.getTime();
        const daysPassed = Math.floor(diff / (1000 * 60 * 60 * 24));
        return Math.max(0, 7 - daysPassed);
    };

    // ✅ SaaS Provisioning: Setup a specific assigned branch slot
    const handleSetupBranch = async (data: { name: string; location: string }, targetCode: string) => {
        try {
            if (!tenantId) return;

            // 🛡️ Security: Verify this code is in their license
            const allowedCodes = (tenantContext?.tenantInfo as any)?.branchCodes || [];
            if (user?.role !== 'owner' && !allowedCodes.includes(targetCode)) {
                alert('عفواً، هذا الكود غير مدرج في ترخيصك الحالي.');
                return;
            }

            // ✅ ID is deterministic based on code (standardization)
            const branchId = `branch-${targetCode}`;
            const branchesCollection = collection(db, `tenants/${tenantId}/branches`);
            const branchRef = doc(branchesCollection, branchId);

            await setDoc(branchRef, {
                name: data.name,
                code: targetCode, // Locked
                location: data.location,
                status: 'active',
                createdAt: Timestamp.now(),
                createdBy: user?.id,
                settings: { workingHours: '24/7' }
            });

            haptic('success');
            playSound('success');
            setEditingBranch(null); // Close modal
        } catch (error) {
            console.error('Error setting up branch:', error);
            haptic('error');
            alert('حدث خطأ في إعداد الفرع');
        }
    };

    const handleUpdateBranch = async (branchId: string, data: { name: string; code: string; location: string }) => {
        try {
            if (!tenantId) return;

            // 🛡️ Validity Check
            if (!/^\d{4}$/.test(data.code)) {
                alert('عفواً، كود الفرع يجب أن يتكون من 4 أرقام فقط.');
                return;
            }

            const branchRef = doc(db, `tenants/${tenantId}/branches`, branchId);

            await updateDoc(branchRef, {
                name: data.name,
                code: data.code,
                location: data.location
            });

            haptic('success');
            playSound('success');
            setEditingBranch(null);
        } catch (error) {
            console.error('Error updating branch:', error);
            haptic('error');
        }
    };

    const handleRestoreBranch = async (branch: any) => {
        if (!tenantId) return;
        if (!confirm('هل تريد استعادة هذا الفرع؟')) return;

        try {
            const branchRef = doc(db, `tenants/${tenantId}/branches`, branch.id);

            await updateDoc(branchRef, {
                status: 'active',
                deletedAt: null
            });
            haptic('success');
            playSound('success');
        } catch (error) {
            console.error('Error restoring branch:', error);
            haptic('error');
            alert('حدث خطأ في استعادة الفرع');
        }
    };

    // ✅ UNDO LOGIC: 5 Seconds Grace Period
    const handleDeleteClick = (branch: any) => {
        setEditingBranch(null); // Close other modes
        setSelectedBranch(branch); // Track for potential undo

        // 1. Immediate UI Feedback (Soft Delete)
        // We do this by calling the actual delete function, but we wrap it to handle the "Undo" flow
        handleDeleteBranch(branch.id, branch.name);
    };

    const handleDeleteBranch = async (branchId: string, branchName: string) => {
        if (!tenantId) return;

        // Skip confirm dialog for better UX if using UndoToast
        // if (!confirm(...)) return; 

        try {
            const branchRef = doc(db, `tenants/${tenantId}/branches`, branchId);

            await updateDoc(branchRef, {
                status: 'scheduled_for_deletion',
                deletedAt: Timestamp.now()
            });

            // ✅ CASCADING CLEANUP: Cancel all pending requests for this branch
            // This ensures "Project remains clean" after deletion
            if (tenantId && user) {
                await cancelAllActiveRequestsByBranch(
                    tenantId,
                    branchId,
                    user.id,
                    user.name || 'Admin',
                    `تم إلغاء الطلبات آلياً بسبب حذف الفرع [${branchName}]`
                );
            }

            // Timer to "finalize" (visual only, as data is already soft deleted)
            const timer = setTimeout(() => {
                setShowUndoToast(false);
                setDeletedBranchId(null);
            }, 5000);
            setUndoTimer(timer);

        } catch (error) {
            console.error('Error deleting branch:', error);
            haptic('error');
        }
    };

    const handleUndoDelete = async () => {
        if (!deletedBranchId) return;

        try {
            if (undoTimer) clearTimeout(undoTimer);

            const branchRef = doc(db, `tenants/${tenantId}/branches`, deletedBranchId);
            await updateDoc(branchRef, {
                status: 'active',
                deletedAt: null
            });

            playSound('success');
            setShowUndoToast(false);
            setDeletedBranchId(null);
        } catch (error) {
            console.error('Error restoring branch:', error);
        }
    };

    // ✅ Handle Create Branch (Owner/Manual)
    const handleCreateBranch = async (data: any) => {
        if (!tenantId) return;

        // 🛡️ SaaS Limit Enforcement
        if (activeBranches.length >= MAX_BRANCHES) {
            alert(`عفواً، لقد وصلت للحد الأقصى للفروع (${MAX_BRANCHES}). يرجى ترقية الباقة لزيادة العدد.`);
            return;
        }

        try {
            await addDoc(collection(db, `tenants/${tenantId}/branches`), {
                ...data,
                status: 'active',
                createdAt: Timestamp.now(),
                settings: {
                    allowNegativeInventory: false,
                    requireManagerApproval: true
                }
            });
            haptic('success');
            playSound('success');
            setShowCreateModal(false);
        } catch (error) {
            console.error('Error creating branch:', error);
            haptic('error');
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                {/* Skeleton Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-white/10 animate-pulse" />
                        <div>
                            <div className="h-8 w-48 bg-white/10 rounded animate-pulse mb-2" />
                            <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Skeleton Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-2xl p-6" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                            <SkeletonCard hasAvatar={false} hasImage={false} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shadow-lg shadow-green-500/5">
                        <MapPin className="w-8 h-8 text-green-400" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-extrabold text-white tracking-tight">إدارة الفروع</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">حالة الباقة:</span>
                            <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-primary-400 font-mono">
                                {activeBranches.length} / {MAX_BRANCHES}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Setup Wizard Button */}
                <div className="flex flex-col sm:flex-row gap-2">
                    {/* Incomplete Setup Alert */}
                    {hasIncompleteSetup && (
                        <button
                            onClick={() => setShowSetupWizard(true)}
                            className="w-full sm:w-auto px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-600 dark:text-amber-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all"
                        >
                            <AlertCircle className="w-4 h-4" />
                            <span>استئناف إعداد الفرع</span>
                        </button>
                    )}

                    {/* Main Add Button - Wizard Style */}
                    <button
                        onClick={() => setShowSetupWizard(true)}
                        className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-2xl text-white font-bold shadow-xl shadow-teal-500/20 hover:shadow-teal-500/40 active:scale-95 transition-all flex items-center justify-center gap-2 border border-teal-400/20"
                    >
                        <Wand2 className="w-5 h-5" />
                        <span>إضافة فرع جديد</span>
                    </button>

                    {/* Owner Only: Quick Add (Old Modal) */}
                {user?.role === 'owner' && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                            className="w-full sm:w-auto px-4 py-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-purple-500/20 transition-all"
                    >
                            <Plus className="w-4 h-4" />
                            <span>إضافة سريعة</span>
                    </button>
                )}
                </div>
            </div>


            {/* SaaS Slots Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* 1. Render Active Branches First */}
                {
                    activeBranches.map((branch: any) => (
                        <div key={branch.id} className="rounded-2xl p-6 relative overflow-hidden group" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-green-500/20 to-transparent rounded-bl-full -mr-8 -mt-8"></div>

                            <div className="flex items-start justify-between mb-3 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center shadow-lg shadow-green-500/10">
                                        <MapPin className="w-6 h-6 text-green-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{branch.name}</h3>
                                        <p className="text-sm text-white/60">{branch.location || 'لا يوجد موقع'}</p>
                                        <div className="mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 w-fit">
                                            <span className="text-[10px] text-white/40 uppercase tracking-wider">كود:</span>
                                            <code className="text-xs text-green-400 font-mono tracking-wide">
                                                {branch.code}
                                            </code>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-4 relative z-10">
                                <button
                                    onClick={() => setEditingBranch(branch)}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all border border-blue-500/10"
                                >
                                    <Edit2 className="w-4 h-4" />
                                    <span className="text-sm">تعديل</span>
                                </button>
                                <button
                                    onClick={() => handleDeleteClick(branch)}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all font-medium border border-red-500/10"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span className="text-sm">إيقاف</span>
                                </button>
                            </div>
                        </div>
                    ))
                }

                {/* 2. Render Empty Slots (Based on License) */}
                {
                    (() => {
                        const assignedCodes = (tenantContext?.tenantInfo as any)?.branchCodes || [];
                        const activeCodes = activeBranches.map((b: any) => b.code);

                        // Filter codes that don't have an active branch yet (but are assigned)
                        const emptySlots = assignedCodes.filter((code: string) => !activeCodes.includes(code));
                        const branchNames = (tenantContext?.tenantInfo as any)?.branchNames || {};

                        return emptySlots.map((code: string) => (
                            <div key={`slot-${code}`} className="rounded-2xl p-6 border-2 border-dashed flex flex-col items-center justify-center text-center opacity-70 hover:opacity-100 transition-all cursor-pointer mr-4" style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)' }}
                                onClick={() => setEditingBranch({ code, isNew: true, name: branchNames[code] || '' })}
                            >
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <Plus className="w-6 h-6 text-white/40" />
                                </div>
                                <h3 className="text-lg font-bold text-white/60">مكان شاغر</h3>
                                <p className="text-xs text-white/30 mb-2">مخصص للفرع كود: {code}</p>
                                <span className="px-3 py-1 rounded-full bg-primary-500/20 text-primary-400 text-xs font-bold">
                                    اضغط للإعداد
                                </span>
                            </div>
                        ));
                    })()
                }
            </div >

            {/* 🗑️ Trash Bin (Soft Deleted Branches) */}
            {
                deletedBranches.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-white/10">
                        <h3 className="text-lg font-bold text-white/60 mb-4 flex items-center gap-2">
                            <Trash2 className="w-5 h-5 text-red-400" />
                            سلة المحذوفات (تحذف نهائياً بعد 7 أيام)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75 grayscale hover:grayscale-0 transition-all">
                            {deletedBranches.map((branch: any) => {
                                const remainingDays = getRemainingDays(branch.deletedAt);
                                return (
                                    <div key={branch.id} className="rounded-2xl p-6 border border-red-500/20 relative overflow-hidden group" style={{ background: 'var(--theme-bg-secondary)' }}>
                                        {/* Background Icon */}
                                        <div className="absolute -right-4 -top-4 text-red-500/10 rotate-12 pointer-events-none group-hover:text-red-500/20 transition-colors">
                                            <Trash2 className="w-24 h-24" />
                                        </div>

                                        <div className="relative z-10">
                                            <h3 className="text-lg font-bold text-white/60 line-through decoration-red-500/50">{branch.name}</h3>
                                            <div className="mt-2 text-red-400 text-sm font-medium flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                                سيتم الحذف خلال {remainingDays} أيام
                                            </div>

                                            <button
                                                onClick={() => handleRestoreBranch(branch)}
                                                className="mt-4 w-full py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all font-medium"
                                            >
                                                استعادة الفرع
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            }

            {/* Create Branch Modal */}
            {
                showCreateModal && (
                    <BranchModal
                        onClose={() => setShowCreateModal(false)}
                        onSubmit={handleCreateBranch}
                        title="إضافة فرع جديد"
                    />
                )
            }

            {/* Edit Branch Modal - Use Enhanced for existing, Simple for new */}
            {editingBranch && editingBranch.isNew && (
                <BranchModal
                    initialData={editingBranch}
                    onClose={() => setEditingBranch(null)}
                    onSubmit={(data) => handleSetupBranch(data, editingBranch.code)}
                    title="إعداد الفرع الجديد"
                />
            )}
            
            {/* ✅ Enhanced Edit Modal for existing branches - allows room management */}
            {editingBranch && !editingBranch.isNew && tenantId && (
                <EnhancedBranchEditModal
                    branch={editingBranch}
                    tenantId={tenantId}
                    onClose={() => setEditingBranch(null)}
                    onSave={(data) => handleUpdateBranch(editingBranch.id, data)}
                />
            )}

            {/* ✅ Undo Toast (Previously Missing UI) */}
            {
                showUndoToast && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
                        <div className="flex items-center gap-4 px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl">
                            <span className="text-white/80 text-sm">تم حذف الفرع</span>
                            <button
                                onClick={handleUndoDelete}
                                className="px-4 py-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all font-medium text-sm"
                            >
                                تراجع
                            </button>
                        </div>
                    </div>
                )
            }

            {/* 🧙 Branch Setup Wizard */}
            <BranchSetupWizard
                isOpen={showSetupWizard}
                onClose={() => setShowSetupWizard(false)}
                onComplete={(branchId) => {
                    console.log('Branch setup complete:', branchId);
                    haptic('success');
                    playSound('success');
                }}
            />
        </div >
    );
};

// ============================================================
// ENHANCED BRANCH EDIT MODAL
// Allows managing branch info, rooms, and floors
// ============================================================
interface EnhancedBranchEditModalProps {
    branch: any;
    tenantId: string;
    onClose: () => void;
    onSave: (data: any) => void;
}

const EnhancedBranchEditModal: React.FC<EnhancedBranchEditModalProps> = ({ branch, tenantId, onClose, onSave }) => {
    const [activeTab, setActiveTab] = useState<'info' | 'rooms'>('info');
    const [name, setName] = useState(branch?.name || '');
    const [location, setLocation] = useState(branch?.location || '');
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [newRoomNumber, setNewRoomNumber] = useState('');
    const [newRoomFloor, setNewRoomFloor] = useState(1);
    const [saving, setSaving] = useState(false);
    const [showAddRoom, setShowAddRoom] = useState(false);

    // Subscribe to rooms for this branch
    useEffect(() => {
        if (!branch?.id || !tenantId) return;

        setLoadingRooms(true);
        const unsubscribe = subscribeToRooms(branch.id, (fetchedRooms) => {
            setRooms(fetchedRooms);
            setLoadingRooms(false);
        }, tenantId);

        return () => unsubscribe();
    }, [branch?.id, tenantId]);

    // Get unique floors
    const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);

    const handleSaveInfo = async () => {
        setSaving(true);
        try {
            await onSave({ name, location });
            haptic('success');
            playSound('success');
        } catch (error) {
            console.error('Error saving branch info:', error);
            haptic('error');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateRoom = async (room: Room, updates: Partial<Room>) => {
        if (!tenantId || !branch?.id) return;

        try {
            // If room number is changing, we need to delete old and create new
            if (updates.number && updates.number !== room.number) {
                // Delete old room
                await deleteRoom(tenantId, branch.id, room.number);
                // Create new room with new number
                await addRoom({
                    ...room,
                    ...updates,
                    tenantId,
                    branchId: branch.id,
                });
            } else {
                // Just update the existing room
                await updateRoom(tenantId, branch.id, room.number, updates);
            }
            haptic('success');
            setEditingRoom(null);
        } catch (error) {
            console.error('Error updating room:', error);
            haptic('error');
        }
    };

    const handleDeleteRoom = async (room: Room) => {
        if (!tenantId || !branch?.id) return;
        if (!confirm(`هل أنت متأكد من حذف الغرفة ${room.number}؟`)) return;

        try {
            await deleteRoom(tenantId, branch.id, room.number);
            haptic('success');
        } catch (error) {
            console.error('Error deleting room:', error);
            haptic('error');
        }
    };

    const handleAddRoom = async () => {
        if (!tenantId || !branch?.id || !newRoomNumber) return;

        try {
            await addRoom({
                number: newRoomNumber,
                floor: newRoomFloor,
                branchId: branch.id,
                tenantId,
                status: 'available',
                type: 'standard',
            });
            haptic('success');
            setNewRoomNumber('');
            setShowAddRoom(false);
        } catch (error) {
            console.error('Error adding room:', error);
            haptic('error');
        }
    };

    const tabs = [
        { id: 'info', label: 'معلومات الفرع', icon: Building2 },
        { id: 'rooms', label: `الغرف (${rooms.length})`, icon: DoorOpen },
    ];

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.6)' }}
        >
            <div 
                className="w-full max-w-md sm:max-w-lg lg:max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
                style={{ 
                    background: 'var(--theme-bg-primary)',
                    border: '1px solid var(--theme-border-primary)'
                }}
            >
                {/* Header */}
                <div 
                    className="relative px-6 py-4 flex items-center justify-between"
                    style={{ 
                        background: 'linear-gradient(135deg, #2DD4BF 0%, #14B8A6 100%)'
                    }}
                >
                    <div className="text-white">
                        <h2 className="text-xl font-bold">تعديل الفرع</h2>
                        <p className="text-white/80 text-sm">{branch?.name} - كود: {branch?.code}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Tabs */}
                <div 
                    className="px-6 py-3 flex items-center gap-2 border-b"
                    style={{ 
                        background: 'var(--theme-bg-secondary)',
                        borderColor: 'var(--theme-border-primary)'
                    }}
                >
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium
                                    ${isActive 
                                        ? 'bg-teal-500 text-white' 
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }
                                `}
                                style={{ color: isActive ? 'white' : 'var(--theme-text-primary)' }}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                    {/* Info Tab */}
                    {activeTab === 'info' && (
                        <div className="space-y-4">
                            <div>
                                <label 
                                    className="block text-sm font-medium mb-2"
                                    style={{ color: 'var(--theme-text-secondary)' }}
                                >
                                    اسم الفرع
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="مثال: فرع الكورنيش"
                                    className="w-full px-4 py-3 rounded-xl transition-all"
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        border: '1px solid var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)',
                                    }}
                                />
                            </div>

                            <div>
                                <label 
                                    className="block text-sm font-medium mb-2"
                                    style={{ color: 'var(--theme-text-secondary)' }}
                                >
                                    كود الفرع
                                </label>
                                <div 
                                    className="w-full px-4 py-3 rounded-xl font-mono text-center opacity-50"
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        border: '1px solid var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)',
                                    }}
                                >
                                    {branch?.code || '---'}
                                </div>
                                <p className="text-xs mt-1" style={{ color: 'var(--theme-text-tertiary)' }}>
                                    لا يمكن تعديل الكود
                                </p>
                            </div>

                            <div>
                                <label 
                                    className="block text-sm font-medium mb-2"
                                    style={{ color: 'var(--theme-text-secondary)' }}
                                >
                                    الموقع
                                </label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="مثال: شارع الكورنيش، جدة"
                                    className="w-full px-4 py-3 rounded-xl transition-all"
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        border: '1px solid var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)',
                                    }}
                                />
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleSaveInfo}
                                    disabled={saving}
                                    className="w-full px-4 py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all"
                                    style={{
                                        background: 'linear-gradient(135deg, #2DD4BF 0%, #14B8A6 100%)',
                                        opacity: saving ? 0.7 : 1,
                                    }}
                                >
                                    {saving ? (
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Save className="w-5 h-5" />
                                    )}
                                    حفظ التغييرات
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Rooms Tab */}
                    {activeTab === 'rooms' && (
                        <div className="space-y-4">
                            {/* Add Room Button */}
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                                    إدارة الغرف
                                </h3>
                                <button
                                    onClick={() => setShowAddRoom(true)}
                                    className="px-4 py-2 rounded-lg text-white font-medium flex items-center gap-2"
                                    style={{ background: 'linear-gradient(135deg, #2DD4BF 0%, #14B8A6 100%)' }}
                                >
                                    <Plus className="w-4 h-4" />
                                    إضافة غرفة
                                </button>
                            </div>

                            {/* Add Room Form */}
                            {showAddRoom && (
                                <div 
                                    className="p-4 rounded-xl"
                                    style={{ 
                                        background: 'var(--theme-bg-tertiary)',
                                        border: '1px solid var(--theme-border-primary)'
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <label className="block text-sm mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                                رقم الغرفة
                                            </label>
                                            <input
                                                type="text"
                                                value={newRoomNumber}
                                                onChange={(e) => setNewRoomNumber(e.target.value)}
                                                placeholder="مثال: 101"
                                                className="w-full px-3 py-2 rounded-lg"
                                                style={{
                                                    background: 'var(--theme-bg-secondary)',
                                                    border: '1px solid var(--theme-border-primary)',
                                                    color: 'var(--theme-text-primary)',
                                                }}
                                            />
                                        </div>
                                        <div className="w-32">
                                            <label className="block text-sm mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                                الدور
                                            </label>
                                            <input
                                                type="number"
                                                value={newRoomFloor}
                                                onChange={(e) => setNewRoomFloor(Number(e.target.value))}
                                                min={1}
                                                className="w-full px-3 py-2 rounded-lg"
                                                style={{
                                                    background: 'var(--theme-bg-secondary)',
                                                    border: '1px solid var(--theme-border-primary)',
                                                    color: 'var(--theme-text-primary)',
                                                }}
                                            />
                                        </div>
                                        <div className="flex gap-2 pt-5">
                                            <button
                                                onClick={handleAddRoom}
                                                className="px-4 py-2 rounded-lg text-white font-medium"
                                                style={{ background: '#2DD4BF' }}
                                            >
                                                إضافة
                                            </button>
                                            <button
                                                onClick={() => setShowAddRoom(false)}
                                                className="px-4 py-2 rounded-lg"
                                                style={{ 
                                                    background: 'var(--theme-bg-secondary)',
                                                    color: 'var(--theme-text-primary)'
                                                }}
                                            >
                                                إلغاء
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {loadingRooms ? (
                                <div className="text-center py-8">
                                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: '#2DD4BF' }} />
                                    <p style={{ color: 'var(--theme-text-secondary)' }}>جاري تحميل الغرف...</p>
                                </div>
                            ) : rooms.length === 0 ? (
                                <div 
                                    className="text-center py-8 rounded-xl"
                                    style={{ 
                                        background: 'var(--theme-bg-tertiary)',
                                        border: '2px dashed var(--theme-border-primary)'
                                    }}
                                >
                                    <DoorOpen className="w-12 h-12 mx-auto mb-2" style={{ color: 'var(--theme-text-tertiary)' }} />
                                    <p style={{ color: 'var(--theme-text-secondary)' }}>لا توجد غرف مضافة</p>
                                </div>
                            ) : (
                                /* Rooms grouped by floor */
                                <div className="space-y-4">
                                    {floors.map(floor => (
                                        <div key={floor}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Layers className="w-4 h-4" style={{ color: '#2DD4BF' }} />
                                                <h4 className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                    الدور {floor}
                                                </h4>
                                                <span 
                                                    className="px-2 py-0.5 rounded-full text-xs"
                                                    style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-text-secondary)' }}
                                                >
                                                    {rooms.filter(r => r.floor === floor).length} غرف
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                {rooms.filter(r => r.floor === floor).map(room => (
                                                    <div
                                                        key={room.number}
                                                        className="p-3 rounded-xl flex items-center justify-between group"
                                                        style={{
                                                            background: 'var(--theme-bg-secondary)',
                                                            border: '1px solid var(--theme-border-primary)'
                                                        }}
                                                    >
                                                        {editingRoom?.number === room.number ? (
                                                            <RoomEditForm
                                                                room={room}
                                                                onSave={(updates) => handleUpdateRoom(room, updates)}
                                                                onCancel={() => setEditingRoom(null)}
                                                            />
                                                        ) : (
                                                            <>
                                                                <div>
                                                                    <span 
                                                                        className="font-bold"
                                                                        style={{ color: 'var(--theme-text-primary)' }}
                                                                    >
                                                                        {room.number}
                                                                    </span>
                                                                    <span 
                                                                        className="text-xs block"
                                                                        style={{ color: 'var(--theme-text-tertiary)' }}
                                                                    >
                                                                        {room.type || 'standard'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => setEditingRoom(room)}
                                                                        className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-500"
                                                                    >
                                                                        <Edit2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteRoom(room)}
                                                                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <p 
                                className="text-xs mt-4 p-3 rounded-lg"
                                style={{ 
                                    background: 'var(--theme-bg-tertiary)',
                                    color: 'var(--theme-text-secondary)'
                                }}
                            >
                                💡 <strong>ملاحظة:</strong> أي تغييرات على الغرف ستنعكس فوراً في جميع الأقسام (الاستقبال، البيلمان، الصيانة، إلخ)
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Room Edit Form Component
const RoomEditForm: React.FC<{
    room: Room;
    onSave: (updates: Partial<Room>) => void;
    onCancel: () => void;
}> = ({ room, onSave, onCancel }) => {
    const [number, setNumber] = useState(room.number);
    const [floor, setFloor] = useState(room.floor);

    return (
        <div className="flex items-center gap-2 w-full">
            <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="w-16 px-2 py-1 rounded text-sm"
                style={{
                    background: 'var(--theme-bg-tertiary)',
                    border: '1px solid var(--theme-border-primary)',
                    color: 'var(--theme-text-primary)',
                }}
            />
            <input
                type="number"
                value={floor}
                onChange={(e) => setFloor(Number(e.target.value))}
                className="w-12 px-2 py-1 rounded text-sm"
                style={{
                    background: 'var(--theme-bg-tertiary)',
                    border: '1px solid var(--theme-border-primary)',
                    color: 'var(--theme-text-primary)',
                }}
            />
            <button
                onClick={() => onSave({ number, floor })}
                className="p-1 rounded text-green-500 hover:bg-green-500/20"
            >
                ✓
            </button>
            <button
                onClick={onCancel}
                className="p-1 rounded text-red-500 hover:bg-red-500/20"
            >
                ✗
            </button>
        </div>
    );
};

// ============================================================
// SIMPLE BRANCH MODAL (for new branch creation)
// ============================================================
interface BranchModalProps {
    initialData?: any;
    onClose: () => void;
    onSubmit: (data: any) => void;
    title: string;
}

const BranchModal: React.FC<BranchModalProps> = ({ initialData, onClose, onSubmit, title }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [code, setCode] = useState(initialData?.code || '');
    const [location, setLocation] = useState(initialData?.location || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ name, code, location });
    };

    return (
        <div 
            className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(0, 0, 0, 0.6)' }}
        >
            <div 
                className="rounded-2xl p-6 max-w-md w-full shadow-2xl"
                style={{ 
                    background: 'var(--theme-bg-primary)',
                    border: '1px solid var(--theme-border-primary)'
                }}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>{title}</h3>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>اسم الفرع</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="مثال: فرع الكورنيش"
                                className="w-full px-4 py-2.5 rounded-xl transition-colors"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    border: '1px solid var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)',
                                }}
                            />
                        </div>
                        <div className="w-1/3">
                            <label className="block text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>كود الفرع</label>
                            <div 
                                className="w-full px-4 py-2.5 rounded-xl font-mono text-center tracking-widest opacity-50 cursor-not-allowed"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    border: '1px solid var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)',
                                }}
                            >
                                {code || '---'}
                            </div>
                            <p className="text-[10px] text-center mt-1" style={{ color: 'var(--theme-text-tertiary)' }}>لا يمكن تعديل الكود</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>الموقع</label>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="مثال: شارع الكورنيش، جدة"
                            className="w-full px-4 py-2.5 rounded-xl transition-colors"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                border: '1px solid var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)',
                            }}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl transition-all font-medium"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                color: 'var(--theme-text-primary)',
                            }}
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 rounded-xl text-white transition-all font-medium"
                            style={{
                                background: 'linear-gradient(135deg, #2DD4BF 0%, #14B8A6 100%)',
                            }}
                        >
                            حفظ
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
