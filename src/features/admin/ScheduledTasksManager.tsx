/**
 * Scheduled Tasks Manager
 * Replaces Exceptions Dashboard
 * Allows scheduling tasks for various departments (Housekeeping, Maintenance, etc.)
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar,
    Clock,
    Plus,
    Trash2,
    CheckCircle,
    RotateCw,
    AlertCircle,
    Search,
    Filter,
    ArrowRight,
    LayoutGrid, // ✅ Added for Room Selector
    Edit // ✅ Added for Edit button
} from 'lucide-react';
// ✅ Architecture: Firebase imports removed - using services instead
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { useTenantRooms } from '../../hooks/useTenantData'; // ✅ Added for room data
import { FloorRoomSelector } from '../../components/shared/FloorRoomSelector'; // ✅ Added Room Selector
import { logger } from '../../services/loggerService';
import { formatDateGregorianEn, formatTimeGregorianEn } from '../../utils/dateUtils';

// ============================================================
// TYPES
// ============================================================

// ✅ Types: Use shared types from scheduledTasksService

// ============================================================
// HELPERS
// ============================================================

const getDepartmentLabel = (dept: TaskDepartment) => {
    const labels: Record<TaskDepartment, string> = {
        housekeeping: 'للنظافة',
        maintenance: 'للصيانة',
        reception: 'للاستقبال',
        bellman: 'للبيلمان',
        procurement: 'للمشتريات'
    };
    return labels[dept];
};

const getFrequencyLabel = (freq: TaskFrequency) => {
    const labels: Record<TaskFrequency, string> = {
        once: 'مرة واحدة',
        daily: 'يومي',
        weekly: 'أسبوعي',
        monthly: 'شهري'
    };
    return labels[freq];
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ScheduledTasksManager: React.FC = () => {
    const { user } = useAuth();
    const { success, error, haptic } = useUX();
    
    // ✅ Feature Gate: Check if scheduled tasks feature is enabled
    const { isEnabled: isScheduledTasksEnabled } = useFeatureGate('scheduledTasks');
    
    const [tasks, setTasks] = useState<ScheduledTaskType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingTask, setEditingTask] = useState<ScheduledTaskType | null>(null); // ✅ Edit mode

    // Filters
    const [deptFilter, setDeptFilter] = useState<TaskDepartment | 'all'>('all');
    const [freqFilter, setFreqFilter] = useState<TaskFrequency | 'all'>('all');

    const branchId = useMemo(() => (user as any)?.branch || 'default', [user]);
    
    // Load Tasks
    useEffect(() => {
        // ✅ Skip if feature is disabled
        if (!isScheduledTasksEnabled) {
            setLoading(false);
            return;
        }

        // ✅ Null Safety: Check required params
        if (!branchId || !tenantId) {
            logger.warn('ScheduledTasksManager: Missing branchId or tenantId', null, 'ScheduledTasksManager');
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'scheduled_tasks'),
            where('tenantId', '==', tenantId), // ✅ Added Tenant Isolation
            where('branchId', '==', branchId),
            where('status', '==', 'active')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ScheduledTaskType[];

            // Sort client-side to avoid index issues initially
            data.sort((a, b) => {
                const dateA = a.nextRun?.toDate() || new Date();
                const dateB = b.nextRun?.toDate() || new Date();
                return dateA.getTime() - dateB.getTime();
            });

            setTasks(data);
            setLoading(false);
        });

        return unsubscribe;
    }, [branchId, user, isScheduledTasksEnabled]);

    // Delete Task
    const handleDelete = async (id: string) => {
        // ✅ Null Safety: Check required params
        if (!tenantId) {
            logger.warn('Cannot delete task: Missing tenantId', null, 'ScheduledTasksManager');
            return;
        }

        if (!window.confirm(t('admin.scheduledTasks.deleteConfirm') || 'هل أنت متأكد من حذف هذه المهمة المجدولة؟')) return;
        
        try {
            // ✅ Architecture: Use service instead of direct Firebase call
            const result = await deleteScheduledTask(id);
            if (result.success) {
                haptic('success');
                success(t('admin.scheduledTasks.deleteSuccess') || 'تم حذف المهمة');
            } else {
                throw new Error(result.error || 'Failed to delete task');
            }
        } catch (err: any) {
            logger.error('Error deleting scheduled task', err, 'ScheduledTasksManager');
            error(t('admin.scheduledTasks.deleteError') || 'فشل الحذف');
        }
    };

    const filteredTasks = tasks.filter(t => {
        if (deptFilter !== 'all' && t.department !== deptFilter) return false;
        if (freqFilter !== 'all' && t.frequency !== freqFilter) return false;
        return true;
    });

    // ✅ Hide component if feature is disabled (after all hooks)
    if (!isScheduledTasksEnabled) {
        return (
            <div className="rounded-2xl transition-colors duration-300 p-12 text-center" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-white/20" />
                </div>
                <p className="text-white/40">المهام المجدولة غير مفعلة حالياً</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Calendar className="w-8 h-8 text-primary-400" />
                        جدولة المهام الإدارية
                    </h2>
                    <p className="text-white/60 mt-1">
                        جدولة مهام تلقائية للأقسام (صيانة، نظافة، استقبال، ...)
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary flex items-center gap-2 px-6 py-3"
                >
                    <Plus className="w-5 h-5" />
                    مهمة جديدة
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 overflow-x-auto pb-2">
                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                    <Filter className="w-4 h-4 text-white/40 mr-2" />
                    <select
                        value={deptFilter}
                        onChange={(e) => setDeptFilter(e.target.value as any)}
                        className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all appearance-none cursor-pointer transition-colors duration-300"
                        style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-secondary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; }}
                    >
                        <option value="all">كل الأقسام</option>
                        <option value="maintenance">الصيانة</option>
                        <option value="housekeeping">النظافة</option>
                        <option value="reception">الاستقبال</option>
                        <option value="bellman">البيلمان</option>
                        <option value="procurement">المشتريات</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                    <RotateCw className="w-4 h-4 text-white/40 mr-2" />
                    <select
                        value={freqFilter}
                        onChange={(e) => setFreqFilter(e.target.value as any)}
                        className="bg-transparent text-white text-sm outline-none cursor-pointer [&>option]:bg-slate-800"
                    >
                        <option value="all">كل التكرارات</option>
                        <option value="once">مرة واحدة</option>
                        <option value="daily">يومي</option>
                        <option value="weekly">أسبوعي</option>
                        <option value="monthly">شهري</option>
                    </select>
                </div>
            </div>

            {/* Tasks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTasks.map(task => (
                    <div key={task.id} className="rounded-2xl transition-colors duration-300 p-5 group hover:border-primary-500/30 transition-all" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${task.department === 'maintenance' ? 'bg-orange-500/20 text-orange-400' :
                                    task.department === 'housekeeping' ? 'bg-cyan-500/20 text-cyan-400' :
                                        task.department === 'reception' ? 'bg-blue-500/20 text-blue-400' :
                                            task.department === 'procurement' ? 'bg-green-500/20 text-green-400' :
                                                'bg-purple-500/20 text-purple-400'
                                    }`}>
                                    {getDepartmentLabel(task.department)}
                                </span>
                                <span className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs">
                                    {getFrequencyLabel(task.frequency)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setEditingTask(task)}
                                    className="text-white/20 hover:text-blue-400 transition-colors"
                                    title="تعديل المهمة"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(task.id)}
                                    className="text-white/20 hover:text-red-400 transition-colors"
                                    title="حذف المهمة"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-white mb-2">{task.title}</h3>
                        {task.description && (
                            <p className="text-white/60 text-sm mb-4 line-clamp-2">{task.description}</p>
                        )}
                        {task.targetId && (
                            <div className="mb-4 text-xs bg-white/5 inline-block px-2 py-1 rounded text-white/70">
                                الهدف: {task.targetId}
                            </div>
                        )}

                        <div className="flex items-center gap-2 text-sm text-primary-400 bg-primary-500/10 p-3 rounded-xl mt-auto">
                            <Clock className="w-4 h-4" />
                            <span>الموعد القادم: </span>
                            <span className="font-bold font-mono">
                                {task.nextRun ? formatDateGregorianEn(task.nextRun.toDate()) + ' ' + formatTimeGregorianEn(task.nextRun.toDate(), { showSeconds: false }) : ''}
                            </span>
                        </div>
                    </div>
                ))}

                {filteredTasks.length === 0 && (
                    <div className="col-span-full py-12 text-center text-white/30 border-2 border-dashed border-white/10 rounded-2xl">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>لا توجد مهام مجدولة</p>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {(showAddModal || editingTask) && (
                <AddTaskModal
                    onClose={() => {
                        setShowAddModal(false);
                        setEditingTask(null);
                    }}
                    branchId={branchId}
                    userId={user?.id || 'admin'}
                    editingTask={editingTask || undefined} // ✅ Pass editing task if exists
                />
            )}
        </div>
    );
};

// ============================================================
// ADD TASK MODAL
// ============================================================

const AddTaskModal: React.FC<{
    onClose: () => void;
    branchId: string;
    userId: string;
    editingTask?: ScheduledTaskType; // ✅ Optional editing task
}> = ({ onClose, branchId, userId, editingTask }) => {
    const { user } = useAuth();
    const { tenantId } = useTenant();
    const { t } = useTranslation();
    const { success, error, haptic } = useUX();
    const [loading, setLoading] = useState(false);

    // Form State - Initialize with editingTask if exists
    const [title, setTitle] = useState(editingTask?.title || '');
    const [description, setDescription] = useState(editingTask?.description || '');
    const [department, setDepartment] = useState<TaskDepartment>(editingTask?.department || 'maintenance');
    const [frequency, setFrequency] = useState<TaskFrequency>(editingTask?.frequency || 'once');
    
    // ✅ Initialize scheduled date/time from editingTask
    const getInitialDate = () => {
        if (editingTask?.nextRun) {
            const date = editingTask.nextRun.toDate();
            return date.toISOString().split('T')[0];
        }
        return '';
    };
    const getInitialTime = () => {
        if (editingTask?.nextRun) {
            const date = editingTask.nextRun.toDate();
            return date.toTimeString().slice(0, 5); // HH:MM format
        }
        return '';
    };
    
    const [scheduledDate, setScheduledDate] = useState(getInitialDate()); // YYYY-MM-DD
    const [scheduledTime, setScheduledTime] = useState(getInitialTime()); // HH:MM
    const [targetId, setTargetId] = useState(editingTask?.targetId || ''); // E.g. Room Number

    // Room Selector State
    const { rooms } = useTenantRooms(); // Fetch rooms
    const [showRoomSelector, setShowRoomSelector] = useState(false);
    const roomNumbers = useMemo(() => rooms.map(r => r.number), [rooms]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // ✅ Null Safety: Check required params
        if (!tenantId || !branchId) {
            logger.warn('Cannot save task: Missing tenantId or branchId', null, 'ScheduledTasksManager');
            error(t('admin.scheduledTasks.missingParams') || 'يرجى التأكد من تسجيل الدخول');
            return;
        }

        if (!title || !scheduledDate || !scheduledTime) {
            error(t('admin.scheduledTasks.requiredFields') || 'يرجى تعبئة الحقول المطلوبة');
            return;
        }

        setLoading(true);
        try {
            // Combine Date & Time
            const nextRun = new Date(`${scheduledDate}T${scheduledTime}`);

            if (editingTask) {
                // ✅ Architecture: Use service instead of direct Firebase call
                const result = await updateScheduledTask(editingTask.id, {
                    title,
                    description,
                    department,
                    frequency,
                    nextRun: Timestamp.fromDate(nextRun),
                    scheduledFor: Timestamp.fromDate(nextRun),
                    targetId
                } as Partial<ScheduledTaskType>);

                if (result.success) {
                    haptic('success');
                    success(t('admin.scheduledTasks.updateSuccess') || 'تم تحديث المهمة المجدولة بنجاح');
                    onClose();
                } else {
                    throw new Error(result.error || 'Failed to update task');
                }
            } else {
                // ✅ Architecture: Use service instead of direct Firebase call
                const result = await createScheduledTask({
                    title,
                    description,
                    department,
                    frequency,
                    nextRun: Timestamp.fromDate(nextRun),
                    scheduledFor: Timestamp.fromDate(nextRun),
                    targetId,
                    branchId,
                    tenantId,
                    createdBy: userId
                } as Omit<ScheduledTaskType, 'id' | 'createdAt' | 'status'>);

                if (result.success) {
                    haptic('success');
                    success(t('admin.scheduledTasks.createSuccess') || 'تمت جدولة المهمة بنجاح');
                    onClose();
                } else {
                    throw new Error(result.error || 'Failed to create task');
                }
            }
        } catch (err: any) {
            logger.error('Error saving scheduled task', err, 'ScheduledTasksManager');
            error(t('admin.scheduledTasks.saveError') || 'حدث خطأ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'none' }}>
            <div className="rounded-2xl transition-colors duration-300 w-full max-w-lg overflow-hidden animate-scaleIn" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="font-bold text-white">{editingTask ? 'تعديل مهمة مجدولة' : 'إضافة مهمة مجدولة'}</h3>
                    <button onClick={onClose} className="text-white/60 hover:text-white">
                        <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm text-white/70 mb-1">عنوان المهمة *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="input transition-colors duration-300"
                            style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                            placeholder="مثال: صيانة دورية للمكيفات"
                            required
                        />
                    </div>

                    {/* Department & Frequency */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-white/70 mb-1">القسم المسؤول</label>
                            <select
                                value={department}
                                onChange={(e) => setDepartment(e.target.value as TaskDepartment)}
                                className="input transition-colors duration-300"
                                style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                            >
                                <option value="maintenance">الصيانة</option>
                                <option value="housekeeping">النظافة</option>
                                <option value="reception">الاستقبال</option>
                                <option value="bellman">البيلمان</option>
                                <option value="procurement">المشتريات</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-white/70 mb-1">التكرار</label>
                            <select
                                value={frequency}
                                onChange={(e) => setFrequency(e.target.value as TaskFrequency)}
                                className="input transition-colors duration-300"
                                style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                            >
                                <option value="once">مرة واحدة</option>
                                <option value="daily">يومي</option>
                                <option value="weekly">أسبوعي</option>
                                <option value="monthly">شهري</option>
                            </select>
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-white/70 mb-1">التاريخ *</label>
                            <input
                                type="date"
                                value={scheduledDate}
                                onChange={(e) => setScheduledDate(e.target.value)}
                                className="input bg-slate-800/50 border-white/10 text-white [color-scheme:dark]"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-white/70 mb-1">الوقت *</label>
                            <input
                                type="time"
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                className="input bg-slate-800/50 border-white/10 text-white [color-scheme:dark]"
                                required
                            />
                        </div>
                    </div>

                    {/* Target ID (Room) with Visual Selector */}
                    <div>
                        <label className="block text-sm text-white/70 mb-1">الغرفة / الهدف (اختياري)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={targetId}
                                onChange={(e) => setTargetId(e.target.value)}
                                className="input flex-1 bg-slate-800/50 border-white/10 text-white placeholder-white/30"
                                placeholder="اكتب أو اختر..."
                            />
                            <button
                                type="button"
                                onClick={() => setShowRoomSelector(true)}
                                className="px-3 bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors text-white"
                                title="اختر من القائمة"
                            >
                                <LayoutGrid className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm text-white/70 mb-1">تفاصيل إضافية</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="input min-h-[80px] bg-slate-800/50 border-white/10 text-white placeholder-white/30"
                            placeholder="اكتب تفاصيل المهمة..."
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full py-3 mt-4"
                    >
                        {loading ? 'جاري الحفظ...' : editingTask ? 'حفظ التعديلات' : 'حفظ الجدول'}
                    </button>
                </form>
            </div>

            {/* Room Selector Modal */}
            <FloorRoomSelector
                isOpen={showRoomSelector}
                onClose={() => setShowRoomSelector(false)}
                rooms={roomNumbers}
                selectedRoom={targetId}
                onSelect={(room) => setTargetId(room)}
            />
        </div>
    );
};
