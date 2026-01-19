/**
 * Employees Manager
 * Admin interface for managing hotel staff
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Users,
    Plus,
    X,
    Trash2,
    RefreshCw,
    Star,
    Key,
    Phone,
    Sparkles,
    Wrench,
    BellRing,
    Shield,
    ShoppingCart,
    ChevronDown,
} from 'lucide-react';
import { User } from '../../types';
import {
    subscribeToEmployees,
    addEmployee,
    deleteEmployee,
    resetEmployeePoints,
    resetAllPoints,
    generatePinCode,
    updateEmployee,
} from '../../services/employeeService';
import { useTenantBranches } from '../../hooks/useTenantData';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoaderUnified';
import { MapPin, Check } from 'lucide-react';
import { useUX } from '../../hooks/useUX'; // ✅ Added useUX
import { EmployeesManagerHelp } from '../../components/common/ContextualHelp'; // ✅ Contextual Help
import { logger } from '../../services/loggerService';

// Department config - i18n-aware function
const getDepartments = (t: (key: string) => string): Array<{ value: string; label: string; icon: React.ReactNode; color: string }> => [
    { value: 'reception', label: t('departments.reception'), icon: <Phone className="w-5 h-5" />, color: 'bg-blue-500' },
    { value: 'housekeeping', label: t('departments.housekeeping'), icon: <Sparkles className="w-5 h-5" />, color: 'bg-purple-500' },
    { value: 'bellman', label: t('departments.bellman'), icon: <BellRing className="w-5 h-5" />, color: 'bg-yellow-500' },
    { value: 'maintenance', label: t('departments.maintenance'), icon: <Wrench className="w-5 h-5" />, color: 'bg-orange-500' },
    { value: 'procurement', label: t('departments.procurement'), icon: <ShoppingCart className="w-5 h-5" />, color: 'bg-indigo-500' },
    { value: 'admin', label: t('departments.admin'), icon: <Shield className="w-5 h-5" />, color: 'bg-primary-500' },
];

// ============================================================
// ADD EMPLOYEE MODAL
// ============================================================

interface AddEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { user } = useAuth(); // ✅ Get user context
    const { branches: availableBranches } = useTenantBranches();
    const { showSuccess, showError } = useUX(); // ✅ UX Hook
    
    // ✅ i18n: Get departments with translated labels
    const DEPARTMENTS = useMemo(() => getDepartments(t), [t]);
    const [formData, setFormData] = useState({
        name: '',
        department: 'reception', // Primary department (for backward compatibility)
        role: 'staff',
        code: '',
        allowedOffDays: 1, // Default 1 day off
    });
    const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>(['reception']); // ✅ NEW: Multiple departments

    // Toggle department selection
    const toggleDepartment = (deptValue: string) => {
        setSelectedDepartments(prev => {
            if (prev.includes(deptValue)) {
                // Keep at least one department
                if (prev.length === 1) return prev;
                return prev.filter(d => d !== deptValue);
            } else {
                return [...prev, deptValue];
            }
        });
        // Set primary department to first selected
        if (!selectedDepartments.includes(deptValue)) {
            setFormData(prev => ({ ...prev, department: deptValue }));
        }
    };
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGeneratingPin, setIsGeneratingPin] = useState(false);
    const [isCheckingCode, setIsCheckingCode] = useState(false);
    const [codeError, setCodeError] = useState<string | null>(null);
    const [suggestedCode, setSuggestedCode] = useState<string | null>(null);

    // Reset selected branches when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedBranches([]);
        }
    }, [isOpen]);

    // ✅ FIX: Manager CAN choose branches (from their licensed branches)
    // Manager can assign employees to any of their licensed branches
    useEffect(() => {
        if (isOpen && user?.role === 'manager') {
            // Pre-select the current active branch as default (optional UX improvement)
            const managerBranch = (user as any).branch || ((user as any).branches && (user as any).branches[0]);
            if (managerBranch && selectedBranches.length === 0) {
                setSelectedBranches([managerBranch]);
            }
        }
    }, [isOpen, user]);

    // Toggle branch selection - ✅ Manager CAN now toggle branches
    const toggleBranch = (branchId: string) => {
        // Manager can only select from their licensed branches (enforced by availableBranches)
        setSelectedBranches(prev =>
            prev.includes(branchId)
                ? prev.filter(id => id !== branchId)
                : [...prev, branchId]
        );
    };

    // ✅ Real-time code validation
    useEffect(() => {
        const checkCode = async () => {
            if (!formData.code || formData.code.length < 4) {
                setCodeError(null);
                setSuggestedCode(null);
                return;
            }

            setIsCheckingCode(true);
            try {
                const available = await isPinAvailable(formData.code, {
                    authReady: true,
                    user: user as any
                });

                if (!available) {
                    setCodeError(t('employees.codeInUse'));
                    // Generate suggested code
                    const suggested = await suggestUniquePin();
                    setSuggestedCode(suggested);
                } else {
                    setCodeError(null);
                    setSuggestedCode(null);
                }
            } catch (err) {
                logger.error('Error checking code', err, 'EmployeesManager');
                // Don't block on error, just log
            } finally {
                setIsCheckingCode(false);
            }
        };

        // Debounce: Check after 500ms of no typing
        const timeoutId = setTimeout(checkCode, 500);
        return () => clearTimeout(timeoutId);
    }, [formData.code, user]);

    if (!isOpen) return null;

    const handleGeneratePin = async () => {
        setIsGeneratingPin(true);
        try {
            const pin = await generatePinCode();
            setFormData({ ...formData, code: pin });
        } finally {
            setIsGeneratingPin(false);
        }
    };

    const handleSubmit = async () => {
        // Validation with Toasts
        if (!formData.name || !formData.code) {
            showError(t('employees.namePinRequired'));
            return;
        }

        // ✅ FIX: Enforce 4-digit PIN
        if (formData.code.length < 4) {
            showError(t('employees.pinMinLength'));
            return;
        }

        // ✅ Final check: Verify code is not duplicate
        if (codeError) {
            showError(t('employees.codeError'));
            return;
        }

        // Double-check code availability before submitting
        const available = await isPinAvailable(formData.code, {
            authReady: true,
            user: user as any
        });

        if (!available) {
            showError(t('employees.codeDuplicate'));
            const suggested = await suggestUniquePin();
            setSuggestedCode(suggested);
            return;
        }

        if (selectedBranches.length === 0) {
            showError(t('employees.selectOneBranch'));
            return;
        }

        if (selectedDepartments.length === 0) {
            showError(t('employees.selectOneDept'));
            return;
        }

        setIsSubmitting(true);
        try {
            const primaryDept = selectedDepartments[0] || formData.department;
            const id = `${primaryDept}-${Date.now()}`;
            await addEmployee({
                id,
                name: formData.name,
                code: formData.code,
                department: primaryDept, // Primary department (for backward compatibility)
                departments: selectedDepartments, // ✅ NEW: All allowed departments
                role: formData.role,
                points: 0,
                status: 'active',
                branches: selectedBranches, // ✅ Multiple branches support
                branch: selectedBranches[0], // For backward compatibility
                createdBy: user?.id,    // ✅ Track creator
                tenantId: (user as any)?.tenantId, // ✅ Pass tenantId
                challengeProgress: {
                    currentStreak: 0,
                    lastLoginDate: null,
                    claimedMilestones: [],
                    attendanceHistory: [],
                    allowedWeeklyOffDays: (formData as any).allowedOffDays || 1,
                    offDaysUsedThisWeek: 0
                }
            } as any);

            showSuccess(t('employees.addSuccess'));
            setFormData({ name: '', department: 'reception', role: 'staff', code: '', allowedOffDays: 1 } as any);
            setSelectedBranches([]);
            setSelectedDepartments(['reception']); // ✅ Reset departments
            onClose();
        } catch (err) {
            logger.error('Error adding employee', err, 'EmployeesManager');
            showError(t('employees.addError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90" style={{ backdropFilter: 'none' }} onClick={onClose} />
            <div className="relative w-full max-w-md glass rounded-3xl p-6 animate-slide-up">
                <button onClick={onClose} className="absolute top-4 left-4 w-10 h-10 rounded-full glass flex items-center justify-center text-white/70 hover:text-white">
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold text-white mb-6">{t('employees.addEmployee')}</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-white/70 mb-1">{t('employees.nameLabel')}</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="input"
                            placeholder={t('employees.namePlaceholder')}
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-white/70 mb-2">{t('employees.departmentsLabel')} <span className="text-xs text-white/40">({t('employees.departmentsHint')})</span></label>
                        <p className="text-xs text-white/40 mb-2">
                            {t('employees.departmentsDescription')}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {DEPARTMENTS.map((dept) => {
                                const isSelected = selectedDepartments.includes(dept.value);
                                return (
                                    <button
                                        key={dept.value}
                                        type="button"
                                        onClick={() => toggleDepartment(dept.value)}
                                        className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${isSelected
                                            ? 'border-primary-500 bg-primary-500/20 text-white'
                                            : 'border-white/20 text-white/60 hover:border-white/40'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary-500' : 'bg-white/10'}`}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        {dept.icon}
                                        <span className="text-sm">{dept.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {selectedDepartments.length > 0 && (
                            <p className="text-xs text-primary-400 mt-2">
                                ✓ تم اختيار {selectedDepartments.length} قسم {selectedDepartments.length > 1 ? '(متعدد الأقسام - يمكنه التنقل بينها)' : '(قسم واحد فقط)'}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm text-white/70 mb-1">رمز الدخول (PIN) *</label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                        setFormData({ ...formData, code: value });
                                    }}
                                    className={`input w-full ${codeError ? 'border-red-500 focus:border-red-500' : ''}`}
                                    placeholder={t('employees.pinPlaceholder')}
                                    maxLength={4}
                                />
                                {isCheckingCode && (
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <AdoraLoaderInline size={16} />
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleGeneratePin}
                                disabled={isGeneratingPin}
                                className="btn-secondary"
                            >
                                {isGeneratingPin ? (
                                    <AdoraLoaderInline size={20} />
                                ) : (
                                    <Key className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                        {codeError && (
                            <div className="mt-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                                <p className="text-sm text-red-400 mb-2">{codeError}</p>
                                {suggestedCode && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-white/60">كود مقترح:</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormData({ ...formData, code: suggestedCode });
                                                setCodeError(null);
                                                setSuggestedCode(null);
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-primary-500/20 border border-primary-500/50 text-primary-400 text-sm font-medium hover:bg-primary-500/30 transition-colors"
                                        >
                                            {suggestedCode} ← استخدام
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        {!codeError && formData.code.length === 4 && (
                            <p className="mt-2 text-xs text-green-400">✓ الكود متاح</p>
                        )}
                    </div>

                    {/* Attendance Exception Allowance */}
                    <div>
                        <label className="block text-sm text-white/70 mb-2">{t('employees.offDaysLabel')}</label>
                        <div className="flex gap-2">
                            {[1, 2, 4].map((days) => (
                                <button
                                    key={days}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, allowedOffDays: days } as any)}
                                    className={`flex-1 py-3 rounded-xl border transition-all font-bold ${(formData as any).allowedOffDays === days
                                        ? 'border-primary-500 bg-primary-500/20 text-white'
                                        : 'border-white/20 text-white/60 hover:border-white/40'
                                        }`}
                                >
                                    {days} {days === 1 ? t('employees.day') : t('employees.days')}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-white/40 mt-1.5 leading-relaxed">
                            {t('employees.offDaysDescription')}
                        </p>
                    </div>

                    {/* ✅ Multiple Branches Selection - Manager CAN select branches */}
                    <div>
                        <label className="block text-sm text-white/70 mb-2">{t('employees.branchesLabel')}</label>
                        {availableBranches.length === 0 ? (
                            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
                                {t('employees.branchesNoAvailable')}
                            </div>
                        ) : (
                            <>
                                <p className="text-xs text-white/40 mb-2">
                                    {t('employees.branchesHint')}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-white/5 rounded-xl border border-white/10">
                                    {availableBranches.map((branch) => {
                                        const isSelected = selectedBranches.includes(branch.id);
                                        return (
                                            <button
                                                key={branch.id}
                                                type="button"
                                                onClick={() => toggleBranch(branch.id)}
                                                className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${isSelected
                                                    ? 'border-primary-500 bg-primary-500/20 text-white'
                                                    : 'border-white/20 text-white/60 hover:border-white/40'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded flex items-center justify-center ${isSelected ? 'bg-primary-500' : 'bg-white/10'
                                                    }`}>
                                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <MapPin className="w-4 h-4" />
                                                <span className="text-sm flex-1 text-right">{branch.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                        {selectedBranches.length > 0 && (
                            <p className="text-xs text-primary-400 mt-2">
                                {selectedBranches.length > 1 
                                    ? t('employees.selectedBranchMultiple', { count: selectedBranches.length })
                                    : t('employees.selectedBranchSingle', { count: selectedBranches.length })
                                }
                            </p>
                        )}
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formData.name || !formData.code || selectedBranches.length === 0}
                        className="btn-primary w-full py-4"
                    >
                        {isSubmitting ? (
                            <AdoraLoaderInline size={20} />
                        ) : (
                            <>
                                <Plus className="w-5 h-5" />
                                {t('employees.addEmployee')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// EMPLOYEE CARD
// ============================================================

// ============================================================
// EMPLOYEE CARD (REDESIGNED)
// ============================================================

interface EmployeeCardProps {
    employee: User;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onResetPoints: () => void;
    onToggleStatus: () => void;
    onEdit: () => void;
    currentUserId?: string; // ✅ Current user ID to check if employee is self
    currentUserRole?: string; // ✅ Current user role
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({
    employee,
    isSelected,
    onSelect,
    onDelete,
    onResetPoints,
    onToggleStatus,
    onEdit,
    currentUserId,
    currentUserRole
}) => {
    const { t } = useTranslation();
    const { branches: availableBranches } = useTenantBranches();
    const DEPARTMENTS = useMemo(() => getDepartments(t), [t]);
    const dept = DEPARTMENTS.find(d => d.value === employee.department);
    const isInactive = employee.status !== 'active';
    
    // ✅ FIX: Prevent manager from editing/deleting/suspending themselves
    // Only owner can edit/delete managers
    const isSelf = currentUserId && employee.id === currentUserId;
    const isManager = employee.role === 'manager';
    const isCurrentUserManager = currentUserRole === 'manager';
    const canEditOrDelete = !isSelf || (isSelf && currentUserRole === 'owner');
    const showActions = canEditOrDelete && !(isManager && isCurrentUserManager && isSelf);
    
    // ✅ FIX: Prevent manager from suspending themselves
    const canToggleStatus = !(isSelf && isCurrentUserManager);

    // Get branch names
    const employeeBranches = (employee as any).branches || ((employee as any).branch ? [(employee as any).branch] : []);
    const branchNames = employeeBranches
        .map((branchId: string) => availableBranches.find(b => b.id === branchId)?.name || branchId)
        .join('، ');

    return (
        <div
            onClick={onSelect}
            className={`group relative overflow-hidden rounded-2xl transition-all duration-300 cursor-pointer
                ${isSelected
                    ? 'bg-primary-600/20 border-2 border-primary-500 shadow-[0_0_30px_rgba(59,130,246,0.2)]'
                    : 'glass border border-white/5 hover:border-white/20 hover:bg-white/5'
                }
                ${isInactive ? 'opacity-60 grayscale' : ''}
            `}
        >
            {/* Selection Checkbox - Smaller & Tigher */}
            <div className={`absolute top-3 right-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all z-20
                ${isSelected
                    ? 'bg-primary-500 border-primary-500 scale-110'
                    : 'border-white/20 bg-black/20 group-hover:border-white/40'
                }
            `}>
                {isSelected && <Check className="w-3 h-3 text-white p-0.5" strokeWidth={3} />}
            </div>

            {/* Actions Menu (Hover) - Adjusted pos */}
            {/* ✅ FIX: Hide edit/delete buttons for manager's own account */}
            {showActions && (
                <div className="absolute top-3 left-3 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 z-20">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-white flex items-center justify-center transition-colors"
                        title={t('employees.edit')}
                    >
                        <Wrench className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/40 text-red-500 dark:text-red-400 flex items-center justify-center transition-colors"
                        title={t('common.delete')}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
            
            {/* ✅ Badge: Manager account (only owner can edit) */}
            {isManager && currentUserRole === 'manager' && isSelf && (
                <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold z-10">
                    {t('employees.accountBadge')}
                </div>
            )}

            {/* Content - Compact Padding */}
            <div className="p-4 flex flex-col items-center text-center pt-8">
                {/* Avatar Circle - Smaller */}
                <div className={`w-16 h-16 rounded-full mb-3 flex items-center justify-center shadow-lg relative
                    ${dept?.color.replace('bg-', 'bg-') || 'bg-gray-500'} bg-opacity-20
                `}>
                    {/* Gradient Ring */}
                    <div className={`absolute inset-0 rounded-full border-2 border-dashed opacity-30 animate-spin-slow
                         ${dept?.color.replace('bg-', 'border-') || 'border-white'}
                    `} />

                    <span className="text-xl font-bold text-white uppercase">
                        {employee.name.charAt(0)}
                    </span>

                    {/* Status Dot */}
                    <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#0f172a]
                        ${isInactive ? 'bg-red-500' : 'bg-green-500'}
                    `} />
                </div>

                <h3 className="text-base font-bold text-white mb-0.5 group-hover:text-primary-400 transition-colors truncate w-full px-2">
                    {employee.name}
                </h3>

                <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border
                         ${dept?.color.replace('bg-', 'bg-').replace('500', '500/10') || 'bg-white/5'}
                         ${dept?.color.replace('bg-', 'border-').replace('500', '500/20') || 'border-white/10'}
                         ${dept?.color.replace('bg-', 'text-').replace('500', '400') || 'text-white/60'}
                    `}>
                        {dept?.label || employee.department}
                    </span>
                    {isInactive && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/10 border border-red-500/20 text-red-400">
                            {t('employees.inactive')}
                        </span>
                    )}
                    {(employee.challengeProgress?.allowedWeeklyOffDays ?? 1) > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400" title={t('employees.exemption')}>
                            {t('employees.exemption')}: {employee.challengeProgress?.allowedWeeklyOffDays ?? 1} {t('employees.day')}
                        </span>
                    )}
                </div>

                {/* Info Grid - Compact */}
                <div className="grid grid-cols-2 gap-2 w-full mt-1">
                    <div className="bg-white/5 rounded-lg p-1.5 flex flex-col items-center justify-center">
                        <span className="text-[9px] text-white/40">{t('employees.points')}</span>
                        <div className="flex items-center gap-1 text-yellow-400 font-bold text-xs">
                            <Star className="w-3 h-3 fill-yellow-400" />
                            {employee.points}
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-1.5 flex flex-col items-center justify-center">
                        <span className="text-[9px] text-white/40">PIN</span>
                        <div className="flex items-center gap-1 text-white/80 font-mono text-xs">
                            <Key className="w-3 h-3" />
                            {employee.code}
                        </div>
                    </div>
                </div>

                {/* Action Footer - Compact */}
                <div className="w-full mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                    {/* ✅ FIX: Hide suspend/activate button for manager's own account */}
                    {canToggleStatus ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
                            className={`text-[10px] font-medium transition-colors ${isInactive ? 'text-green-400 hover:text-green-300' : 'text-orange-400 hover:text-orange-300'}`}
                        >
                            {isInactive ? t('employees.activate') : t('employees.deactivate')}
                        </button>
                    ) : (
                        <span className="text-[10px] text-white/30">{t('employees.notAvailable')}</span>
                    )}

                    {employee.points > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onResetPoints(); }}
                            className="text-[10px] text-white/40 hover:text-white transition-colors"
                        >
                            {t('employees.resetPoints')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

import { useAuth } from '../../context/AuthContext'; // ✅ Added useAuth
import { isPinAvailable, suggestUniquePin } from '../../services/ownerService'; // ✅ For code validation

export const EmployeesManager: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useAuth(); // ✅ Get current user
    const tenantId = (user as any)?.tenantId;
    const { branches: availableBranches } = useTenantBranches();
    const DEPARTMENTS = useMemo(() => getDepartments(t), [t]);

    const [employees, setEmployees] = useState<User[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const { showSuccess, showError } = useUX();

    // ✅ Editing & Loading State (Restored)
    const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDept, setSelectedDept] = useState<string | 'all'>('all');
    const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');

    // ✅ Selection State
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

    const toggleSelection = (id: string) => {
        // ✅ FIX: Prevent manager from selecting themselves
        if (user?.role === 'manager' && user?.id === id) {
            showError('لا يمكنك تحديد حسابك الخاص.');
            return;
        }
        
        // ✅ FIX: Prevent manager from selecting other managers
        const employee = employees.find(emp => emp.id === id);
        if (user?.role === 'manager' && employee?.role === 'manager') {
            showError('لا يمكنك تحديد مدير آخر. فقط المالك يمكنه تحديد المديرين.');
            return;
        }
        
        setSelectedEmployeeIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (!confirm(t('employees.bulkDeleteConfirm', { count: selectedEmployeeIds.length }))) return;

        // ✅ FIX: Filter out managers from bulk delete if current user is manager
        const employeesToDelete = employees.filter(emp => selectedEmployeeIds.includes(emp.id));
        const managersInSelection = employeesToDelete.filter(emp => emp.role === 'manager');
        
        if (managersInSelection.length > 0 && user?.role === 'manager') {
            showError('لا يمكنك حذف المديرين. فقط المالك يمكنه حذف المديرين.');
            // Remove managers from selection
            const filteredIds = selectedEmployeeIds.filter(id => 
                !employeesToDelete.find(emp => emp.id === id && emp.role === 'manager')
            );
            setSelectedEmployeeIds(filteredIds);
            return;
        }
        
        // ✅ FIX: Prevent manager from deleting themselves in bulk delete
        if (selectedEmployeeIds.includes(user?.id || '')) {
            showError('لا يمكنك حذف حسابك الخاص.');
            setSelectedEmployeeIds(prev => prev.filter(id => id !== user?.id));
            return;
        }

        setLoading(true);
        try {
            for (const id of selectedEmployeeIds) {
                await deleteEmployee(id);
            }
            setSelectedEmployeeIds([]);
            showSuccess(t('employees.bulkDeleteSuccess'));
        } catch (e) {
            logger.error('Error', e, 'EmployeesManager');
            showError(t('employees.bulkDeleteError'));
        } finally {
            setLoading(false);
        }
    };

    // ✅ Helper to open edit modal
    const handleEditClick = (employee: User) => {
        // ✅ FIX: Prevent manager from editing themselves
        if (employee.role === 'manager' && user?.id === employee.id) {
            showError('لا يمكنك تعديل حسابك الخاص. يرجى التواصل مع المالك.');
            return;
        }
        
        // ✅ FIX: Prevent manager from editing other managers (only owner can)
        if (employee.role === 'manager' && user?.role === 'manager') {
            showError('لا يمكنك تعديل مدير آخر. فقط المالك يمكنه تعديل المديرين.');
            return;
        }
        
        setEditingEmployee(employee);
    };

    useEffect(() => {
        if (!tenantId) return;
        const unsub = subscribeToEmployees((data) => {
            setEmployees(data);
            setLoading(false);
        }, tenantId);
        return () => unsub();
    }, [tenantId]);

    // ✅ Branch Isolation Logic
    const filteredEmployees = employees.filter(emp => {
        // 1. Department Filter
        if (selectedDept !== 'all' && emp.department !== selectedDept) return false;

        // 2. Branch Filter
        // Parse Employee Branches
        const empBranches: string[] = (emp as any).branches || [(emp as any).branch].filter(Boolean);

        // Owner & Manager Logic: Can see all (within their scope), but respects the UI dropdown filter
        if (user?.role === 'owner' || user?.role === 'manager') {
            // First, apply Strict Isolation for Manager (Implicit via availableBranches but good to enforce)
            if (user.role === 'manager') {
                const userAny = user as any;
                const myBranchesIds = userAny.availableBranches
                    ? userAny.availableBranches.map((b: any) => b.id)
                    : (userAny.branches || [userAny.branch].filter(Boolean));

                // If the employee doesn't belong to ANY of my branches, hide them
                if (!empBranches.some(b => myBranchesIds.includes(b))) return false;
            }

            // Then apply UI Filter
            if (selectedBranchFilter !== 'all') {
                return empBranches.includes(selectedBranchFilter);
            }
            return true;
        }

        return false;
    });

    const handleDelete = async (id: string) => {
        // ✅ FIX: Prevent manager from deleting themselves
        const employeeToDelete = employees.find(emp => emp.id === id);
        if (employeeToDelete && employeeToDelete.role === 'manager' && user?.id === id) {
            showError('لا يمكنك حذف حسابك الخاص. يرجى التواصل مع المالك.');
            return;
        }
        
        // ✅ FIX: Prevent manager from deleting other managers (only owner can)
        if (employeeToDelete && employeeToDelete.role === 'manager' && user?.role === 'manager') {
            showError('لا يمكنك حذف مدير آخر. فقط المالك يمكنه حذف المديرين.');
            return;
        }
        
        if (confirm(t('employees.deleteConfirm'))) {
            await deleteEmployee(id);
        }
    };

    const handleResetAllPoints = async () => {
        if (confirm(t('employees.resetAllPointsConfirm'))) {
            await resetAllPoints();
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: string) => {
        // ✅ FIX: Prevent manager from suspending themselves
        if (user?.role === 'manager' && user.id === id) {
            alert(t('employees.cannotSuspendSelf') || 'لا يمكنك إيقاف حسابك الخاص. يرجى التواصل مع المالك.');
            return;
        }

        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        const actionText = newStatus === 'active' ? t('employees.activate') : t('employees.deactivate');

        if (confirm(t('employees.toggleStatusConfirm', { action: actionText }))) {
            await updateEmployee(id, { status: newStatus });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <AdoraLoader size="md" message={t('employees.loadingData')} />
            </div>
        );
    }

    return (
        <div className="relative min-h-[calc(100vh-100px)] animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 📍 Contextual Help */}
            <EmployeesManagerHelp />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">{t('employees.title')}</h1>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-bold">
                            <Users className="w-3.5 h-3.5" />
                            {t('employees.employeeCount', { count: filteredEmployees.length })}
                        </div>
                        {user?.role !== 'owner' && (
                            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-[10px] font-medium tracking-wide">
                                {t('employees.isolatedBranches')}
                            </div>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="w-full md:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold shadow-xl shadow-primary-500/20 hover:shadow-primary-500/40 active:scale-95 transition-all flex items-center justify-center gap-2 border border-primary-400/20"
                >
                    <Plus className="w-5 h-5" />
                    إضافة موظف جديد
                </button>
            </div>

            {/* Filters Section */}
            <div className="flex flex-col gap-6 mb-10 p-5 rounded-3xl border transition-colors duration-300" style={{ background: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-primary)' }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Department Filter */}
                    <div className="flex-1 overflow-x-auto pb-1 scrollbar-hide">
                        <div className="flex gap-2 min-w-max">
                            <button
                                onClick={() => setSelectedDept('all')}
                                className={`px-5 py-2.5 rounded-xl transition-all text-sm font-bold border ${selectedDept === 'all'
                                    ? 'bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-500/20'
                                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                {t('employees.all')}
                            </button>
                            {DEPARTMENTS.map((dept) => (
                                <button
                                    key={dept.value}
                                    onClick={() => setSelectedDept(dept.value)}
                                    className={`px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm font-bold border ${selectedDept === dept.value
                                        ? 'bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-500/20'
                                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {dept.icon}
                                    {dept.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ✅ Owner & Manager Branch Filter */}
                    {(user?.role === 'owner' || user?.role === 'manager') && (
                        <div className="relative group min-w-[220px]">
                            <select
                                value={selectedBranchFilter}
                                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                                className="w-full h-12 rounded-xl px-4 pl-10 text-sm font-medium focus:border-primary-500/50 outline-none appearance-none cursor-pointer transition-all shadow-inner"
                                style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-secondary)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; }}
                            >
                                <option value="all">{t('employees.allBranches')}</option>
                                {availableBranches.map(b => (
                                    <option key={b.id} value={b.id}>📍 {b.name}</option>
                                ))}
                            </select>
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-primary-400 transition-colors">
                                <ChevronDown className="w-4 h-4" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Employees Grid */}
            {filteredEmployees.length === 0 ? (
                <div className="glass rounded-3xl p-12 text-center border-dashed border-2 border-white/10">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Users className="w-10 h-10 text-white/30" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{t('employees.noEmployees')}</h3>
                    <p className="text-white/40 max-w-md mx-auto">
                        {selectedBranchFilter !== 'all'
                            ? t('employees.noEmployeesBranch')
                            : t('employees.noEmployeesMessage')}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-24">
                    {filteredEmployees.map((emp) => (
                        <EmployeeCard
                            key={emp.id}
                            employee={emp}
                            isSelected={selectedEmployeeIds.includes(emp.id)}
                            onSelect={() => toggleSelection(emp.id)}
                            onDelete={() => handleDelete(emp.id)}
                            onResetPoints={() => resetEmployeePoints(emp.id)}
                            onToggleStatus={() => handleToggleStatus(emp.id, emp.status)}
                            onEdit={() => handleEditClick(emp)}
                            currentUserId={user?.id}
                            currentUserRole={user?.role}
                        />
                    ))}
                </div>
            )}

            {/* ✅ Floating Action Bar */}
            {selectedEmployeeIds.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 rounded-2xl p-2 px-4 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 fade-in duration-300 transition-colors duration-300 bg-white dark:bg-slate-800" style={{ border: '1px solid var(--theme-border-primary)' }}>
                    <div className="flex items-center gap-2 px-2 border-l border-white/10 pl-4">
                        <span className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-xs font-bold text-white">
                            {selectedEmployeeIds.length}
                        </span>
                        <span className="text-white font-medium">{t('employees.selectedCount')}</span>
                    </div>

                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span>{t('employees.deleteSelected')}</span>
                    </button>

                    <button
                        onClick={() => setSelectedEmployeeIds([])}
                        className="p-2 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Add Modal */}
            <AddEmployeeModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />

            {/* ✅ Edit Modal */}
            {editingEmployee && (
                <EditEmployeeModal
                    isOpen={!!editingEmployee}
                    onClose={() => setEditingEmployee(null)}
                    employee={editingEmployee}
                />
            )}
        </div>
    );
};

// ============================================================
// EDIT EMPLOYEE MODAL
// ============================================================

interface EditEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: User;
}

const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({ isOpen, onClose, employee }) => {
    const { t } = useTranslation();
    const { user } = useAuth(); // ✅ Fix: Get user from context
    const { branches: availableBranches } = useTenantBranches();
    const { showError, showSuccess } = useUX(); // ✅ Get both showError and showSuccess
    const DEPARTMENTS = useMemo(() => getDepartments(t), [t]);
    
    // ✅ FIX: Check if manager is trying to edit themselves or another manager
    const isSelf = user?.id === employee.id;
    const isManager = employee.role === 'manager';
    const isCurrentUserManager = user?.role === 'manager';
    const canEdit = !(isManager && isCurrentUserManager); // Manager cannot edit managers
    
    const [formData, setFormData] = useState({
        name: employee.name,
        department: employee.department,
        role: employee.role,
        code: employee.code || '',
        allowedOffDays: employee.challengeProgress?.allowedWeeklyOffDays || 1,
    });
    // Initialize selected branches from employee data
    const initialBranches = (employee as any).branches || ((employee as any).branch ? [(employee as any).branch] : []);
    const [selectedBranches, setSelectedBranches] = useState<string[]>(initialBranches);

    // ✅ NEW: Initialize selected departments from employee data
    const initialDepartments = (employee as any).departments || [employee.department];
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>(initialDepartments);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Toggle department selection
    const toggleDepartment = (deptValue: string) => {
        setSelectedDepartments(prev => {
            if (prev.includes(deptValue)) {
                // Keep at least one department
                if (prev.length === 1) return prev;
                return prev.filter(d => d !== deptValue);
            } else {
                return [...prev, deptValue];
            }
        });
        // Set primary department to first selected
        if (!selectedDepartments.includes(deptValue)) {
            setFormData(prev => ({ ...prev, department: deptValue }));
        }
    };
    
    // ✅ FIX: Close modal if manager tries to edit themselves or another manager
    useEffect(() => {
        if (isOpen && isManager && isCurrentUserManager) {
            if (isSelf) {
                showError('لا يمكنك تعديل حسابك الخاص. يرجى التواصل مع المالك.');
            } else {
                showError('لا يمكنك تعديل مدير آخر. فقط المالك يمكنه تعديل المديرين.');
            }
            onClose();
        }
    }, [isOpen, isManager, isCurrentUserManager, isSelf, showError, onClose]);

    const toggleBranch = (branchId: string) => {
        // ✅ Managers CAN edit branches - this is a core feature
        setSelectedBranches(prev =>
            prev.includes(branchId)
                ? prev.filter(id => id !== branchId)
                : [...prev, branchId]
        );
    };

    const handleSubmit = async () => {
        // ✅ FIX: Prevent manager from editing managers
        if (isManager && isCurrentUserManager) {
            if (isSelf) {
                showError('لا يمكنك تعديل حسابك الخاص. يرجى التواصل مع المالك.');
            } else {
                showError('لا يمكنك تعديل مدير آخر. فقط المالك يمكنه تعديل المديرين.');
            }
            return;
        }
        
        if (!formData.name || !formData.code) return;
        if (selectedBranches.length === 0) {
            alert(t('employees.selectOneBranch'));
            return;
        }

        setIsSubmitting(true);
        try {
            // ✅ Don't update name and code - they are locked
            // ✅ Update department, departments, branches, and allowedWeeklyOffDays
            const primaryDept = selectedDepartments[0] || formData.department;
            const updates: any = {
                department: primaryDept, // Primary department (for backward compatibility)
                departments: selectedDepartments, // ✅ NEW: All allowed departments
                role: formData.role,
                branches: selectedBranches,
                branch: selectedBranches[0], // Backward compatibility
            };

            // ✅ Update challengeProgress.allowedWeeklyOffDays using dot notation
            // This is the correct way to update nested fields in Firestore
            const allowedOffDays = (formData as any).allowedOffDays || 1;
            
            // Get current challengeProgress or initialize it
            const currentChallengeProgress = (employee as any).challengeProgress || {
                currentStreak: 0,
                lastLoginDate: null,
                claimedMilestones: [],
                attendanceHistory: [],
                allowedWeeklyOffDays: 1,
                offDaysUsedThisWeek: 0
            };

            // Update the entire challengeProgress object with the new allowedWeeklyOffDays
            updates.challengeProgress = {
                ...currentChallengeProgress,
                allowedWeeklyOffDays: allowedOffDays
            };

            logger.info('Updating employee', {
                employeeId: employee.id,
                updates,
                allowedOffDays,
                currentChallengeProgress
            });

            await updateEmployee(employee.id, updates);
            
            // ✅ Success feedback
            showSuccess(t('employees.updateSuccess'));
            onClose();
        } catch (err) {
            logger.error('Error updating employee', err, 'EmployeesManager');
            showError(t('employees.updateError', { message: (err as any)?.message || '' }));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90" style={{ backdropFilter: 'none' }} onClick={onClose} />
            <div className="relative w-full max-w-md glass rounded-3xl p-6 animate-slide-up">
                <button onClick={onClose} className="absolute top-4 left-4 w-10 h-10 rounded-full glass flex items-center justify-center text-white/70 hover:text-white">
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold text-white mb-6">{t('employees.editEmployee')}</h2>

                <div className="space-y-4">
                    {/* ✅ Name field - LOCKED (readonly) */}
                    <div>
                        <label className="block text-sm text-white/70 mb-1 flex items-center gap-2">
                            {t('employees.nameLabel').replace(' *', '')}
                            <span className="text-xs text-white/40">{t('employees.nameLocked')}</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            readOnly
                            disabled
                            className="input bg-white/5 text-white/60 cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-white/70 mb-2">{t('employees.departmentsLabel')} <span className="text-xs text-white/40">({t('employees.departmentsHint')})</span></label>
                        <p className="text-xs text-white/40 mb-2">
                            {t('employees.departmentsDescription')}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {DEPARTMENTS.map((dept) => {
                                const isSelected = selectedDepartments.includes(dept.value);
                                return (
                                    <button
                                        key={dept.value}
                                        type="button"
                                        onClick={() => toggleDepartment(dept.value)}
                                        className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${isSelected
                                            ? 'border-primary-500 bg-primary-500/20 text-white'
                                            : 'border-white/20 text-white/60 hover:border-white/40'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary-500' : 'bg-white/10'}`}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        {dept.icon}
                                        <span className="text-sm">{dept.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {selectedDepartments.length > 0 && (
                            <p className="text-xs text-primary-400 mt-2">
                                {selectedDepartments.length > 1 
                                    ? t('employees.selectedDeptMultiple', { count: selectedDepartments.length })
                                    : t('employees.selectedDeptSingle', { count: selectedDepartments.length })
                                }
                            </p>
                        )}
                    </div>

                    {/* Attendance Exception Allowance */}
                    <div>
                        <label className="block text-sm text-white/70 mb-2">{t('employees.offDaysLabel')}</label>
                        <div className="flex gap-2">
                            {[1, 2, 4].map((days) => (
                                <button
                                    key={days}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, allowedOffDays: days } as any)}
                                    className={`flex-1 py-3 rounded-xl border transition-all font-bold ${(formData as any).allowedOffDays === days
                                        ? 'border-primary-500 bg-primary-500/20 text-white'
                                        : 'border-white/20 text-white/60 hover:border-white/40'
                                        }`}
                                >
                                    {days} {days === 1 ? t('employees.day') : t('employees.days')}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-white/40 mt-1.5 leading-relaxed">
                            {t('employees.offDaysDescriptionEdit')}
                        </p>
                    </div>

                    {/* ✅ PIN Code field - LOCKED (readonly) */}
                    <div>
                        <label className="block text-sm text-white/70 mb-1 flex items-center gap-2">
                            {t('employees.pinLabel')}
                            <span className="text-xs text-white/40">{t('employees.pinLocked')}</span>
                        </label>
                        <input
                            type="text"
                            value={formData.code}
                            readOnly
                            disabled
                            className="input font-mono bg-white/5 text-white/60 cursor-not-allowed"
                        />
                    </div>

                    {/* ✅ Branch selection - NOW ALLOWED FOR MANAGERS */}
                    <div>
                        <label className="block text-sm text-white/70 mb-2">{t('employees.editBranchesLabel')}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2">
                            {availableBranches.map((branch) => {
                                const isSelected = selectedBranches.includes(branch.id);
                                return (
                                    <button
                                        key={branch.id}
                                        type="button"
                                        onClick={() => toggleBranch(branch.id)}
                                        className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${isSelected
                                            ? 'border-primary-500 bg-primary-500/20 text-white'
                                            : 'border-white/20 text-white/60 hover:border-white/40'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded flex items-center justify-center ${isSelected ? 'bg-primary-500' : 'bg-white/10'
                                            }`}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <MapPin className="w-4 h-4" />
                                        <span className="text-sm flex-1 text-right">{branch.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-white/40 mt-1.5 leading-relaxed">
                            {t('employees.editBranchesHint')}
                        </p>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formData.name || !formData.code || selectedBranches.length === 0}
                        className="btn-primary w-full py-4"
                    >
                        {isSubmitting ? <AdoraLoaderInline size={20} /> : t('employees.saveChanges')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmployeesManager;
