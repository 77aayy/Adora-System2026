/**
 * Branch Setup Wizard
 * Unified wizard for creating and configuring a new branch
 * Adora Hotel Management System V3
 * 
 * Features:
 * - 4-step wizard flow
 * - Progress tracking with state persistence
 * - Resume incomplete setups
 * - Real-time validation
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Building2,
    Layers,
    DoorOpen,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    X,
    Plus,
    Trash2,
    Save,
    AlertTriangle,
    Loader2,
    Sparkles,
    Settings,
    Play,
    Edit2
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { addRoomType, getRoomTypes, RoomTypeConfig } from '../../services/pricingRulesService';
import { addRoom, createRoomBatch } from '../../services/roomService';
import { haptic, playSound } from '../../utils/uxEffects';
import { logger } from '../../services/loggerService';
// ✅ Architecture: Use services instead of direct Firebase calls
import { createBranch, updateBranch } from '../../services/branchService';
import { Timestamp } from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

interface WizardState {
    currentStep: number;
    branchId: string | null;
    branchData: {
        name: string;
        code: string;
        location: string;
    };
    roomTypes: RoomTypeConfig[];
    rooms: Array<{
        number: string;
        floor: number;
        type: string;
    }>;
    isComplete: boolean;
    startedAt: string;
    lastUpdatedAt: string;
}

interface BranchSetupWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: (branchId: string) => void;
    resumeState?: WizardState | null;
}

// ============================================================
// CONSTANTS
// ============================================================

const STEPS = [
    { id: 1, title: 'بيانات الفرع', description: 'أدخل اسم وبيانات الفرع', icon: Building2 },
    { id: 2, title: 'أنواع الغرف', description: 'حدد أنواع الغرف وأسعارها', icon: Layers },
    { id: 3, title: 'إضافة الغرف', description: 'أضف الغرف للفرع', icon: DoorOpen },
    { id: 4, title: 'التفعيل', description: 'راجع وفعّل الفرع', icon: CheckCircle },
];

const STORAGE_KEY = 'adora_branch_setup_wizard';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const generateBranchCode = (): string => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

const saveWizardState = (state: WizardState) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        logger.error('Error saving wizard state', e, 'BranchSetupWizard');
    }
};

const loadWizardState = (): WizardState | null => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        logger.error('Error loading wizard state', e, 'BranchSetupWizard');
        return null;
    }
};

const clearWizardState = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        logger.error('Error clearing wizard state', e, 'BranchSetupWizard');
    }
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const BranchSetupWizard: React.FC<BranchSetupWizardProps> = ({
    isOpen,
    onClose,
    onComplete,
    resumeState
}) => {
    const { tenantId } = useTenant();
    const { user } = useAuth();

    // Initialize state
    const initialState: WizardState = useMemo(() => ({
        currentStep: 1,
        branchId: null,
        branchData: {
            name: '',
            code: generateBranchCode(),
            location: ''
        },
        roomTypes: [],
        rooms: [],
        isComplete: false,
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString()
    }), []);

    const [state, setState] = useState<WizardState>(resumeState || initialState);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showResumePrompt, setShowResumePrompt] = useState(false);

    // Check for saved state on mount
    useEffect(() => {
        if (isOpen && !resumeState) {
            const saved = loadWizardState();
            if (saved && !saved.isComplete) {
                setShowResumePrompt(true);
            }
        }
    }, [isOpen, resumeState]);

    // Auto-save state on changes
    useEffect(() => {
        if (isOpen && state.branchData.name) {
            saveWizardState({
                ...state,
                lastUpdatedAt: new Date().toISOString()
            });
        }
    }, [state, isOpen]);

    // Calculate progress percentage
    const progressPercentage = useMemo(() => {
        let progress = 0;
        
        // Step 1: Branch data (25%)
        if (state.branchData.name) progress += 25;
        
        // Step 2: Room types (25%)
        if (state.roomTypes.length > 0) progress += 25;
        
        // Step 3: Rooms (25%)
        if (state.rooms.length > 0) progress += 25;
        
        // Step 4: Activation (25%)
        if (state.isComplete) progress += 25;
        
        return progress;
    }, [state]);

    // Navigation handlers
    const canGoNext = useMemo(() => {
        switch (state.currentStep) {
            case 1:
                return state.branchData.name.trim().length >= 2;
            case 2:
                return state.roomTypes.length > 0;
            case 3:
                return state.rooms.length > 0;
            case 4:
                return true;
            default:
                return false;
        }
    }, [state]);

    const handleNext = async () => {
        if (!canGoNext) return;
        setError(null);
        setIsLoading(true);

        try {
            // Step-specific logic
            if (state.currentStep === 1 && !state.branchId) {
                // Create branch in Firestore
                if (!tenantId) throw new Error('لم يتم تحديد المؤسسة');
                
                // ✅ Architecture: Use service instead of direct Firebase call
                // ✅ Null Safety: Check required params
                if (!tenantId) {
                    throw new Error('لم يتم تحديد المؤسسة');
                }

                const result = await createBranch(tenantId, {
                    name: state.branchData.name,
                    code: state.branchData.code,
                    location: state.branchData.location,
                    status: 'setup_incomplete',
                    createdBy: user?.id || 'system',
                    settings: {
                        allowNegativeInventory: false,
                        requireManagerApproval: true
                    }
                } as any);

                if (!result.success || !result.branchId) {
                    throw new Error(result.error || 'Failed to create branch');
                }

                const branchRef = { id: result.branchId };

                setState(prev => ({
                    ...prev,
                    branchId: branchRef.id,
                    currentStep: prev.currentStep + 1
                }));
                
                haptic('success');
            } else if (state.currentStep === 2) {
                // Save room types to Firestore
                if (!tenantId || !state.branchId) throw new Error('لم يتم تحديد الفرع');
                
                for (const type of state.roomTypes) {
                    if (!type.id) {
                        await addRoomType(tenantId, state.branchId, {
                            name: type.name,
                            basePrice: type.basePrice,
                            seasonalPrice: type.seasonalPrice,
                            maxOccupancy: type.maxOccupancy,
                            bookingRate: type.bookingRate || 45,
                            active: true
                        });
                    }
                }
                
                // Reload types with IDs
                const savedTypes = await getRoomTypes(tenantId, state.branchId);
                setState(prev => ({
                    ...prev,
                    roomTypes: savedTypes,
                    currentStep: prev.currentStep + 1
                }));
                
                haptic('success');
            } else if (state.currentStep === 3) {
                // Save rooms to Firestore
                if (!tenantId || !state.branchId) throw new Error('لم يتم تحديد الفرع');
                
                for (const room of state.rooms) {
                    await addRoom({
                        number: room.number,
                        floor: room.floor,
                        type: room.type as any,
                        status: 'available',
                        branchId: state.branchId,
                        tenantId
                    });
                }
                
                setState(prev => ({
                    ...prev,
                    currentStep: prev.currentStep + 1
                }));
                
                haptic('success');
            } else {
                setState(prev => ({
                    ...prev,
                    currentStep: prev.currentStep + 1
                }));
            }
        } catch (err: any) {
            logger.error('Wizard step error', err, 'BranchSetupWizard');
            setError(err.message || 'حدث خطأ غير متوقع');
            haptic('error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        if (state.currentStep > 1) {
            setState(prev => ({
                ...prev,
                currentStep: prev.currentStep - 1
            }));
        }
    };

    const handleActivate = async () => {
        setIsLoading(true);
        setError(null);

        try {
            if (!tenantId || !state.branchId) throw new Error('لم يتم تحديد الفرع');

            // ✅ Architecture: Use service instead of direct Firebase call
            // ✅ Null Safety: Check required params
            if (!tenantId || !state.branchId) {
                throw new Error('لم يتم تحديد الفرع');
            }

            const result = await updateBranch(tenantId, state.branchId, {
                status: 'active',
                setupCompletedAt: Timestamp.now() as any
            } as any);

            if (!result.success) {
                throw new Error(result.error || 'Failed to activate branch');
            }

            setState(prev => ({
                ...prev,
                isComplete: true
            }));

            clearWizardState();
            haptic('success');
            playSound('success');

            onComplete?.(state.branchId);
            
            // Show success and close after delay
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err: any) {
            logger.error('Activation error', err, 'BranchSetupWizard');
            setError(err.message || 'فشل في تفعيل الفرع');
            haptic('error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResume = () => {
        const saved = loadWizardState();
        if (saved) {
            setState(saved);
        }
        setShowResumePrompt(false);
    };

    const handleStartFresh = () => {
        clearWizardState();
        setState(initialState);
        setShowResumePrompt(false);
    };

    const handleClose = () => {
        // Save state before closing if in progress
        if (state.branchData.name && !state.isComplete) {
            saveWizardState(state);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.85)' }}
        >
            <div 
                className="w-full max-w-md sm:max-w-lg lg:max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
                style={{ 
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
            >
                {/* Resume Prompt Modal */}
                {showResumePrompt && (
                    <ResumePromptModal
                        onResume={handleResume}
                        onStartFresh={handleStartFresh}
                    />
                )}

                {/* Header with Progress */}
                <div 
                    className="relative px-6 py-4"
                    style={{ 
                        background: 'linear-gradient(135deg, var(--theme-accent-teal) 0%, var(--theme-accent-cyan) 100%)'
                    }}
                >
                    {/* Close Button */}
                    <button
                        onClick={handleClose}
                        className="absolute top-4 left-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>

                    <div className="text-center text-white">
                        <h2 className="text-xl font-bold mb-1">معالج إعداد الفرع</h2>
                        <p className="text-white/80 text-sm">اتبع الخطوات لإنشاء وتجهيز فرعك الجديد</p>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-white/80 text-xs">التقدم</span>
                            <span className="text-white font-bold text-sm">{progressPercentage}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-white rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Steps Navigation */}
                <div 
                    className="px-6 py-3 flex items-center justify-center gap-2 border-b"
                    style={{ 
                        background: 'var(--theme-bg-secondary)',
                        borderColor: 'var(--theme-border-primary)'
                    }}
                >
                    {STEPS.map((step, index) => {
                        const StepIcon = step.icon;
                        const isActive = state.currentStep === step.id;
                        const isCompleted = state.currentStep > step.id;
                        
                        return (
                            <React.Fragment key={step.id}>
                                <div 
                                    className={`
                                        flex items-center gap-2 px-3 py-2 rounded-lg transition-all
                                        ${isActive ? 'bg-teal-500/20 text-teal-600' : 
                                          isCompleted ? 'text-teal-500' : 
                                          'text-slate-400'}
                                    `}
                                >
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center
                                        ${isActive ? 'bg-teal-500 text-white' : 
                                          isCompleted ? 'bg-teal-500/20 text-teal-500' : 
                                          'bg-slate-200 dark:bg-slate-700'}
                                    `}>
                                        {isCompleted ? (
                                            <CheckCircle className="w-5 h-5" />
                                        ) : (
                                            <StepIcon className="w-4 h-4" />
                                        )}
                                    </div>
                                    <div className="hidden sm:block">
                                        <div className={`text-sm font-medium ${isActive ? 'text-teal-600 dark:text-teal-400' : ''}`}>
                                            {step.title}
                                        </div>
                                    </div>
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div className={`w-8 h-0.5 ${isCompleted ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Step Content */}
                    {state.currentStep === 1 && (
                        <Step1BranchInfo 
                            data={state.branchData}
                            onChange={(data) => setState(prev => ({ ...prev, branchData: data }))}
                        />
                    )}

                    {state.currentStep === 2 && (
                        <Step2RoomTypes 
                            types={state.roomTypes}
                            onChange={(types) => setState(prev => ({ ...prev, roomTypes: types }))}
                        />
                    )}

                    {state.currentStep === 3 && (
                        <Step3AddRooms 
                            rooms={state.rooms}
                            roomTypes={state.roomTypes}
                            onChange={(rooms) => setState(prev => ({ ...prev, rooms: rooms }))}
                        />
                    )}

                    {state.currentStep === 4 && (
                        <Step4Activation 
                            state={state}
                            isComplete={state.isComplete}
                        />
                    )}
                </div>

                {/* Footer with Navigation */}
                <div 
                    className="px-6 py-4 flex items-center justify-between border-t"
                    style={{ 
                        background: 'var(--theme-bg-secondary)',
                        borderColor: 'var(--theme-border-primary)'
                    }}
                >
                    <button
                        onClick={handleBack}
                        disabled={state.currentStep === 1 || isLoading}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                            ${state.currentStep === 1 
                                ? 'opacity-50 cursor-not-allowed text-slate-400' 
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}
                        `}
                    >
                        <ChevronRight className="w-5 h-5" />
                        <span>السابق</span>
                    </button>

                    <div className="text-sm text-slate-500">
                        الخطوة {state.currentStep} من {STEPS.length}
                    </div>

                    {state.currentStep < 4 ? (
                        <button
                            onClick={handleNext}
                            disabled={!canGoNext || isLoading}
                            className={`
                                flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all
                                ${!canGoNext || isLoading
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-500/20'}
                            `}
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span>التالي</span>
                                    <ChevronLeft className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleActivate}
                            disabled={isLoading || state.isComplete}
                            className={`
                                flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all
                                ${state.isComplete
                                    ? 'bg-green-500 text-white' 
                                    : isLoading
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-500/20'}
                            `}
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : state.isComplete ? (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    <span>تم التفعيل!</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5" />
                                    <span>تفعيل الفرع</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================
// RESUME PROMPT MODAL
// ============================================================

const ResumePromptModal: React.FC<{
    onResume: () => void;
    onStartFresh: () => void;
}> = ({ onResume, onStartFresh }) => (
    <div 
        className="absolute inset-0 z-10 flex items-center justify-center"
        style={{ background: 'rgba(0, 0, 0, 0.85)' }}
    >
        <div 
            className="max-w-md p-6 rounded-2xl text-center"
            style={{ 
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
        >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                يوجد إعداد غير مكتمل
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--theme-text-secondary)' }}>
                لديك إعداد فرع سابق لم يكتمل. هل تريد المتابعة من حيث توقفت؟
            </p>
            <div className="flex gap-3">
                <button
                    onClick={onStartFresh}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    البدء من جديد
                </button>
                <button
                    onClick={onResume}
                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 transition-colors"
                >
                    استئناف
                </button>
            </div>
        </div>
    </div>
);

// ============================================================
// STEP 1: BRANCH INFO
// ============================================================

const Step1BranchInfo: React.FC<{
    data: WizardState['branchData'];
    onChange: (data: WizardState['branchData']) => void;
}> = ({ data, onChange }) => (
    <div className="space-y-6">
        <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center">
                <Building2 className="w-10 h-10 text-teal-500" />
            </div>
            <h3 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                بيانات الفرع الأساسية
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
                أدخل اسم الفرع وبياناته الأساسية
            </p>
        </div>

        <div className="max-w-md mx-auto space-y-4">
            {/* Branch Name */}
            <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                    اسم الفرع <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={data.name}
                    onChange={(e) => onChange({ ...data, name: e.target.value })}
                    placeholder="مثال: فرع الكورنيش"
                    className="w-full px-4 py-3 rounded-xl border-2 transition-all focus:ring-2 focus:ring-teal-500/20"
                    style={{
                        background: 'var(--theme-bg-tertiary)',
                        borderColor: 'var(--theme-border-primary)',
                        color: 'var(--theme-text-primary)'
                    }}
                />
            </div>

            {/* Branch Code (Auto-generated) */}
            <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                    كود الفرع
                    <span className="text-xs font-normal text-slate-400 mr-2">(يُستخدم لتسجيل الدخول)</span>
                </label>
                <div className="relative">
                    <input
                        type="text"
                        value={data.code}
                        onChange={(e) => onChange({ ...data, code: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                        placeholder="كود رقمي من 4 أرقام"
                        className="w-full px-4 py-3 rounded-xl border-2 transition-all focus:ring-2 focus:ring-teal-500/20"
                        style={{
                            background: 'var(--theme-bg-tertiary)',
                            borderColor: 'var(--theme-border-primary)',
                            color: 'var(--theme-text-primary)'
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => onChange({ ...data, code: generateBranchCode() })}
                        className="absolute left-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs bg-teal-500/10 text-teal-600 rounded-lg hover:bg-teal-500/20 transition-colors"
                    >
                        توليد تلقائي
                    </button>
                </div>
            </div>

            {/* Location (Optional) */}
            <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                    الموقع
                    <span className="text-xs font-normal text-slate-400 mr-2">(اختياري)</span>
                </label>
                <input
                    type="text"
                    value={data.location}
                    onChange={(e) => onChange({ ...data, location: e.target.value })}
                    placeholder="مثال: شارع الملك فهد، جدة"
                    className="w-full px-4 py-3 rounded-xl border-2 transition-all focus:ring-2 focus:ring-teal-500/20"
                    style={{
                        background: 'var(--theme-bg-tertiary)',
                        borderColor: 'var(--theme-border-primary)',
                        color: 'var(--theme-text-primary)'
                    }}
                />
            </div>
        </div>
    </div>
);

// ============================================================
// STEP 2: ROOM TYPES
// ============================================================

const Step2RoomTypes: React.FC<{
    types: RoomTypeConfig[];
    onChange: (types: RoomTypeConfig[]) => void;
}> = ({ types, onChange }) => {
    const [newType, setNewType] = useState({
        name: '',
        basePrice: 0,
        maxOccupancy: 2
    });

    const handleAdd = () => {
        if (!newType.name || newType.basePrice <= 0) return;
        
        onChange([
            ...types,
            {
                id: '', // Will be assigned by Firestore
                name: newType.name,
                basePrice: newType.basePrice,
                maxOccupancy: newType.maxOccupancy,
                active: true
            }
        ]);
        
        setNewType({ name: '', basePrice: 0, maxOccupancy: 2 });
    };

    const handleRemove = (index: number) => {
        onChange(types.filter((_, i) => i !== index));
    };

    const presetTypes = [
        { name: 'غرفة عادية', basePrice: 200, maxOccupancy: 2 },
        { name: 'غرفة توأم', basePrice: 250, maxOccupancy: 2 },
        { name: 'غرفة كينج', basePrice: 300, maxOccupancy: 2 },
        { name: 'ستوديو', basePrice: 350, maxOccupancy: 3 },
        { name: 'جناح (غرفة وصالة)', basePrice: 450, maxOccupancy: 4 },
        { name: 'جناح كبير (غرفتين وصالة)', basePrice: 600, maxOccupancy: 6 },
        { name: 'VIP', basePrice: 800, maxOccupancy: 4 },
    ];

    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <Layers className="w-10 h-10 text-purple-500" />
                </div>
                <h3 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                    أنواع الغرف والأسعار
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
                    حدد أنواع الغرف المتاحة وأسعارها الأساسية
                </p>
            </div>

            {/* Quick Add Presets */}
            <div 
                className="p-4 rounded-xl"
                style={{ background: 'var(--theme-bg-secondary)' }}
            >
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    إضافة سريعة (اختر من القائمة)
                </h4>
                <div className="flex flex-wrap gap-2">
                    {presetTypes.map((preset) => {
                        const alreadyAdded = types.some(t => t.name === preset.name);
                        return (
                            <button
                                key={preset.name}
                                onClick={() => !alreadyAdded && onChange([...types, { ...preset, id: '', active: true }])}
                                disabled={alreadyAdded}
                                className={`
                                    px-3 py-1.5 rounded-lg text-sm transition-all
                                    ${alreadyAdded 
                                        ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 cursor-default' 
                                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-slate-600 dark:text-slate-300'}
                                `}
                            >
                                {alreadyAdded && <CheckCircle className="w-3 h-3 inline ml-1" />}
                                {preset.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Added Types List */}
            {types.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                        الأنواع المضافة ({types.length})
                    </h4>
                    {types.map((type, index) => (
                        <div 
                            key={index}
                            className="p-4 rounded-xl flex items-center justify-between"
                            style={{ 
                                background: 'var(--theme-bg-secondary)',
                                border: '1px solid var(--theme-border-primary)'
                            }}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                                    <DoorOpen className="w-5 h-5 text-teal-500" />
                                </div>
                                <div>
                                    <div className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                        {type.name}
                                    </div>
                                    <div className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                        السعر: {type.basePrice} ر.س | السعة: {type.maxOccupancy} أشخاص
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleRemove(index)}
                                className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Custom Type Form */}
            <div 
                className="p-4 rounded-xl"
                style={{ 
                    background: 'var(--theme-bg-secondary)',
                    border: '1px solid var(--theme-border-primary)'
                }}
            >
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
                    <Plus className="w-4 h-4" />
                    إضافة نوع مخصص
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                        <input
                            type="text"
                            value={newType.name}
                            onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                            placeholder="اسم النوع"
                            className="w-full px-4 py-2 rounded-lg border"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: 'var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        />
                    </div>
                    <div>
                        <input
                            type="number"
                            value={newType.basePrice || ''}
                            onChange={(e) => setNewType({ ...newType, basePrice: Number(e.target.value) })}
                            placeholder="السعر"
                            className="w-full px-4 py-2 rounded-lg border"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: 'var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        />
                    </div>
                    <div>
                        <button
                            onClick={handleAdd}
                            disabled={!newType.name || newType.basePrice <= 0}
                            className={`
                                w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2
                                ${!newType.name || newType.basePrice <= 0
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-teal-500 text-white hover:bg-teal-600'}
                            `}
                        >
                            <Plus className="w-4 h-4" />
                            إضافة
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// STEP 3: ADD ROOMS
// ============================================================

const Step3AddRooms: React.FC<{
    rooms: WizardState['rooms'];
    roomTypes: RoomTypeConfig[];
    onChange: (rooms: WizardState['rooms']) => void;
}> = ({ rooms, roomTypes, onChange }) => {
    const [mode, setMode] = useState<'single' | 'batch'>('batch');
    const [singleRoom, setSingleRoom] = useState({ number: '', floor: 1, type: '' });
    const [batchConfig, setBatchConfig] = useState({
        floor: 1,
        startNumber: 101,
        endNumber: 110,
        type: ''
    });

    // Set default type if types available
    useEffect(() => {
        if (roomTypes.length > 0 && !singleRoom.type) {
            setSingleRoom(prev => ({ ...prev, type: roomTypes[0].name }));
            setBatchConfig(prev => ({ ...prev, type: roomTypes[0].name }));
        }
    }, [roomTypes]);

    const handleAddSingle = () => {
        if (!singleRoom.number || !singleRoom.type) return;
        
        onChange([...rooms, { ...singleRoom }]);
        setSingleRoom({ number: '', floor: singleRoom.floor, type: singleRoom.type });
    };

    const handleAddBatch = () => {
        if (!batchConfig.type || batchConfig.startNumber >= batchConfig.endNumber) return;
        
        const newRooms: WizardState['rooms'] = [];
        for (let num = batchConfig.startNumber; num <= batchConfig.endNumber; num++) {
            newRooms.push({
                number: num.toString(),
                floor: batchConfig.floor,
                type: batchConfig.type
            });
        }
        
        onChange([...rooms, ...newRooms]);
        setBatchConfig(prev => ({
            ...prev,
            floor: prev.floor + 1,
            startNumber: (prev.floor + 1) * 100 + 1,
            endNumber: (prev.floor + 1) * 100 + 10
        }));
    };

    const handleRemoveRoom = (index: number) => {
        onChange(rooms.filter((_, i) => i !== index));
    };

    const handleClearAll = () => {
        onChange([]);
    };

    // Group rooms by floor for display
    const roomsByFloor = useMemo(() => {
        const grouped: Record<number, typeof rooms> = {};
        rooms.forEach(room => {
            if (!grouped[room.floor]) grouped[room.floor] = [];
            grouped[room.floor].push(room);
        });
        return grouped;
    }, [rooms]);

    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                    <DoorOpen className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                    إضافة الغرف
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
                    أضف الغرف بشكل فردي أو دفعة واحدة
                </p>
            </div>

            {/* Mode Toggle */}
            <div className="flex justify-center gap-2">
                <button
                    onClick={() => setMode('single')}
                    className={`
                        px-4 py-2 rounded-lg font-medium transition-all
                        ${mode === 'single' 
                            ? 'bg-teal-500 text-white' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}
                    `}
                >
                    إضافة فردية
                </button>
                <button
                    onClick={() => setMode('batch')}
                    className={`
                        px-4 py-2 rounded-lg font-medium transition-all
                        ${mode === 'batch' 
                            ? 'bg-teal-500 text-white' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}
                    `}
                >
                    إضافة دفعة
                </button>
            </div>

            {/* Add Form */}
            <div 
                className="p-4 rounded-xl"
                style={{ 
                    background: 'var(--theme-bg-secondary)',
                    border: '1px solid var(--theme-border-primary)'
                }}
            >
                {mode === 'single' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                رقم الغرفة
                            </label>
                            <input
                                type="text"
                                value={singleRoom.number}
                                onChange={(e) => setSingleRoom({ ...singleRoom, number: e.target.value })}
                                placeholder="101"
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)'
                                }}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                الدور
                            </label>
                            <input
                                type="number"
                                value={singleRoom.floor}
                                onChange={(e) => setSingleRoom({ ...singleRoom, floor: Number(e.target.value) })}
                                min={0}
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)'
                                }}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                النوع
                            </label>
                            <select
                                value={singleRoom.type}
                                onChange={(e) => setSingleRoom({ ...singleRoom, type: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)'
                                }}
                            >
                                <option value="">اختر النوع</option>
                                {roomTypes.map((type, idx) => (
                                    <option key={idx} value={type.name}>{type.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={handleAddSingle}
                                disabled={!singleRoom.number || !singleRoom.type}
                                className="w-full px-4 py-2 rounded-lg bg-teal-500 text-white hover:bg-teal-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                إضافة
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                    الدور
                                </label>
                                <input
                                    type="number"
                                    value={batchConfig.floor}
                                    onChange={(e) => setBatchConfig({ ...batchConfig, floor: Number(e.target.value) })}
                                    min={0}
                                    className="w-full px-4 py-2 rounded-lg border"
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        borderColor: 'var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)'
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                    من رقم
                                </label>
                                <input
                                    type="number"
                                    value={batchConfig.startNumber}
                                    onChange={(e) => setBatchConfig({ ...batchConfig, startNumber: Number(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border"
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        borderColor: 'var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)'
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                    إلى رقم
                                </label>
                                <input
                                    type="number"
                                    value={batchConfig.endNumber}
                                    onChange={(e) => setBatchConfig({ ...batchConfig, endNumber: Number(e.target.value) })}
                                    className="w-full px-4 py-2 rounded-lg border"
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        borderColor: 'var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)'
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                    النوع
                                </label>
                                <select
                                    value={batchConfig.type}
                                    onChange={(e) => setBatchConfig({ ...batchConfig, type: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border"
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        borderColor: 'var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)'
                                    }}
                                >
                                    <option value="">اختر النوع</option>
                                    {roomTypes.map((type, idx) => (
                                        <option key={idx} value={type.name}>{type.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleAddBatch}
                                    disabled={!batchConfig.type || batchConfig.startNumber >= batchConfig.endNumber}
                                    className="w-full px-4 py-2 rounded-lg bg-teal-500 text-white hover:bg-teal-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    إضافة {batchConfig.endNumber - batchConfig.startNumber + 1} غرفة
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-center" style={{ color: 'var(--theme-text-secondary)' }}>
                            سيتم إضافة غرف من {batchConfig.startNumber} إلى {batchConfig.endNumber} في الدور {batchConfig.floor}
                        </p>
                    </div>
                )}
            </div>

            {/* Rooms Preview */}
            {rooms.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                            الغرف المضافة ({rooms.length} غرفة)
                        </h4>
                        <button
                            onClick={handleClearAll}
                            className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                        >
                            <Trash2 className="w-3 h-3" />
                            مسح الكل
                        </button>
                    </div>
                    
                    <div 
                        className="max-h-64 overflow-y-auto rounded-xl p-4 space-y-4"
                        style={{ 
                            background: 'var(--theme-bg-secondary)',
                            border: '1px solid var(--theme-border-primary)'
                        }}
                    >
                        {Object.entries(roomsByFloor)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([floor, floorRooms]) => (
                                <div key={floor}>
                                    <div className="text-xs font-medium mb-2 text-teal-600">
                                        الدور {floor} ({floorRooms.length} غرفة)
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {floorRooms.map((room, idx) => (
                                            <div 
                                                key={idx}
                                                className="group relative px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"
                                                style={{ 
                                                    background: 'var(--theme-bg-tertiary)',
                                                    color: 'var(--theme-text-primary)'
                                                }}
                                            >
                                                <span className="font-medium">{room.number}</span>
                                                <span className="text-xs opacity-60">{room.type}</span>
                                                <button
                                                    onClick={() => handleRemoveRoom(rooms.indexOf(room))}
                                                    className="opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs transition-opacity"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// STEP 4: ACTIVATION & REVIEW
// ============================================================

const Step4Activation: React.FC<{
    state: WizardState;
    isComplete: boolean;
}> = ({ state, isComplete }) => {
    // Group rooms by floor for summary
    const roomsByFloor = useMemo(() => {
        const grouped: Record<number, number> = {};
        state.rooms.forEach(room => {
            grouped[room.floor] = (grouped[room.floor] || 0) + 1;
        });
        return grouped;
    }, [state.rooms]);

    const floorCount = Object.keys(roomsByFloor).length;

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                    isComplete 
                        ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20' 
                        : 'bg-gradient-to-br from-amber-500/20 to-orange-500/20'
                }`}>
                    {isComplete ? (
                        <CheckCircle className="w-10 h-10 text-green-500" />
                    ) : (
                        <Settings className="w-10 h-10 text-amber-500" />
                    )}
                </div>
                <h3 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                    {isComplete ? 'تم تفعيل الفرع بنجاح!' : 'مراجعة وتفعيل'}
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
                    {isComplete 
                        ? 'الفرع جاهز للعمل الآن' 
                        : 'راجع البيانات ثم اضغط "تفعيل الفرع" للبدء'}
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Branch Info Card */}
                <div 
                    className="p-4 rounded-xl"
                    style={{ 
                        background: 'var(--theme-bg-secondary)',
                        border: '1px solid var(--theme-border-primary)'
                    }}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-teal-500" />
                        </div>
                        <div className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                            بيانات الفرع
                        </div>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span style={{ color: 'var(--theme-text-secondary)' }}>الاسم:</span>
                            <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                {state.branchData.name}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span style={{ color: 'var(--theme-text-secondary)' }}>الكود:</span>
                            <span className="font-medium font-mono" style={{ color: 'var(--theme-text-primary)' }}>
                                {state.branchData.code}
                            </span>
                        </div>
                        {state.branchData.location && (
                            <div className="flex justify-between">
                                <span style={{ color: 'var(--theme-text-secondary)' }}>الموقع:</span>
                                <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                    {state.branchData.location}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Room Types Card */}
                <div 
                    className="p-4 rounded-xl"
                    style={{ 
                        background: 'var(--theme-bg-secondary)',
                        border: '1px solid var(--theme-border-primary)'
                    }}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Layers className="w-5 h-5 text-purple-500" />
                        </div>
                        <div className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                            أنواع الغرف
                        </div>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="text-2xl font-bold text-purple-500">{state.roomTypes.length}</div>
                        <div style={{ color: 'var(--theme-text-secondary)' }}>
                            {state.roomTypes.slice(0, 3).map(t => t.name).join('، ')}
                            {state.roomTypes.length > 3 && ` (+${state.roomTypes.length - 3})`}
                        </div>
                    </div>
                </div>

                {/* Rooms Card */}
                <div 
                    className="p-4 rounded-xl"
                    style={{ 
                        background: 'var(--theme-bg-secondary)',
                        border: '1px solid var(--theme-border-primary)'
                    }}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <DoorOpen className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                            الغرف
                        </div>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="text-2xl font-bold text-blue-500">{state.rooms.length}</div>
                        <div style={{ color: 'var(--theme-text-secondary)' }}>
                            {floorCount} أدوار
                        </div>
                    </div>
                </div>
            </div>

            {/* Activation Features */}
            {!isComplete && (
                <div 
                    className="p-4 rounded-xl"
                    style={{ 
                        background: 'var(--theme-bg-secondary)',
                        border: '1px solid var(--theme-border-primary)'
                    }}
                >
                    <h4 className="font-medium mb-4 flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        سيتم تفعيل الميزات التالية تلقائياً:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                            { icon: '🏨', text: 'ظهور الغرف في الصفحة الرئيسية' },
                            { icon: '🔄', text: 'نظام الأدوار للفرز والتنظيم' },
                            { icon: '🔔', text: 'الربط مع البيلمان والاستقبال' },
                            { icon: '🔧', text: 'الربط مع قسم الصيانة' },
                            { icon: '🧹', text: 'الربط مع الهاوس كيبنج' },
                            { icon: '📊', text: 'التقارير والإحصائيات' },
                        ].map((feature, idx) => (
                            <div 
                                key={idx}
                                className="flex items-center gap-3 p-3 rounded-lg"
                                style={{ background: 'var(--theme-bg-tertiary)' }}
                            >
                                <span className="text-xl">{feature.icon}</span>
                                <span className="text-sm" style={{ color: 'var(--theme-text-primary)' }}>
                                    {feature.text}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Success Animation */}
            {isComplete && (
                <div className="text-center py-8">
                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600">
                        <CheckCircle className="w-6 h-6" />
                        <span className="font-medium">تم إعداد الفرع بنجاح!</span>
                    </div>
                    <p className="mt-4 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                        جاري إغلاق المعالج... يمكنك الآن إدارة الفرع من لوحة التحكم
                    </p>
                </div>
            )}
        </div>
    );
};

export default BranchSetupWizard;
