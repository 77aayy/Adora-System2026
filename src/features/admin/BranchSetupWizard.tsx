/**
 * Branch Setup Wizard - Compact & Responsive
 * Fixed-height modal with glassmorphism design
 * Adora Hotel Management System V3
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
    AlertTriangle,
    Loader2,
    Sparkles,
    Settings,
    Play,
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useTenantBranches } from '../../hooks/useTenantData';
import { useTranslation } from 'react-i18next';
import { addRoomType, getRoomTypes, RoomTypeConfig } from '../../services/pricingRulesService';
import { addRoom } from '../../services/roomService';
import { haptic, playSound } from '../../utils/uxEffects';
import { logger } from '../../services/loggerService';
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
    { id: 1, title: 'بيانات الفرع', icon: Building2 },
    { id: 2, title: 'أنواع الغرف', icon: Layers },
    { id: 3, title: 'إضافة الغرف', icon: DoorOpen },
    { id: 4, title: 'التفعيل', icon: CheckCircle },
];

const ADORA_TURQUOISE = '#40E0D0';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Generate a unique branch code (1-4 digits) that is not already used
 * Uses random generation to avoid predictable patterns
 */
const generateBranchCode = (usedCodes: string[]): string => {
    const maxAttempts = 1000; // Limit attempts to avoid infinite loops
    const usedSet = new Set(usedCodes); // Use Set for O(1) lookup
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let code: string;
        
        // Randomly choose code length (weighted toward shorter codes)
        const lengthChoice = Math.random();
        
        if (lengthChoice < 0.3) {
            // 30% chance: 1 digit (1-9)
            code = String(Math.floor(1 + Math.random() * 9));
        } else if (lengthChoice < 0.6) {
            // 30% chance: 2 digits (10-99)
            code = String(Math.floor(10 + Math.random() * 90));
        } else if (lengthChoice < 0.85) {
            // 25% chance: 3 digits (100-999)
            code = String(Math.floor(100 + Math.random() * 900));
        } else {
            // 15% chance: 4 digits (1000-9999)
            code = String(Math.floor(1000 + Math.random() * 9000));
        }
        
        // Check if code is not used
        if (!usedSet.has(code)) {
            return code;
        }
    }
    
    // Fallback: Sequential search starting from random position
    const startNum = Math.floor(1 + Math.random() * 9998);
    for (let i = 0; i < 9999; i++) {
        const num = ((startNum + i - 1) % 9999) + 1;
        const code = String(num);
        if (!usedSet.has(code)) {
            return code;
        }
    }
    
    // Last resort: random 4-digit (might conflict, but unlikely)
    return String(Math.floor(1000 + Math.random() * 9000));
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
    const { t } = useTranslation();
    const { tenantId, tenantInfo } = useTenant();
    const { user } = useAuth();
    const { branches } = useTenantBranches();

    // Get license info
    const maxBranches = (tenantInfo as any)?.maxBranches || (user?.role === 'owner' ? 999 : 1);
    const activeBranches = useMemo(() => {
        return branches.filter((b: any) => b.status !== 'scheduled_for_deletion');
    }, [branches]);
    const usedBranchesCount = activeBranches.length;
    const remainingLicenses = maxBranches - usedBranchesCount;

    // Get used branch codes
    const usedCodes = useMemo(() => {
        return branches.map(b => b.code).filter(Boolean) as string[];
    }, [branches]);

    const initialState: WizardState = useMemo(() => ({
        currentStep: 1,
        branchId: null,
        branchData: {
            name: '',
            code: generateBranchCode(usedCodes),
            location: ''
        },
        roomTypes: [],
        rooms: [],
        isComplete: false,
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString()
    }), [usedCodes]);

    const [state, setState] = useState<WizardState>(resumeState || initialState);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Calculate progress percentage
    const progressPercentage = useMemo(() => {
        let progress = 0;
        if (state.branchData.name) progress += 25;
        if (state.roomTypes.length > 0) progress += 25;
        if (state.rooms.length > 0) progress += 25;
        if (state.isComplete) progress += 25;
        return progress;
    }, [state]);

    // Navigation handlers
    const canGoNext = useMemo(() => {
        switch (state.currentStep) {
            case 1: 
                // Check license limit for managers
                if (user?.role !== 'owner' && remainingLicenses <= 0) {
                    return false;
                }
                return state.branchData.name.trim().length >= 2;
            case 2: return state.roomTypes.length > 0;
            case 3: return state.rooms.length > 0;
            case 4: return true;
            default: return false;
        }
    }, [state, remainingLicenses, user?.role]);

    const handleNext = async () => {
        if (!canGoNext) return;
        setError(null);
        setIsLoading(true);

        try {
            if (state.currentStep === 1 && !state.branchId) {
                if (!tenantId) throw new Error('لم يتم تحديد المؤسسة');
                
                // Check license limit (only for managers, not owner)
                if (user?.role !== 'owner' && remainingLicenses <= 0) {
                    throw new Error(`عفواً، لقد وصلت للحد الأقصى للفروع (${maxBranches}). يرجى التواصل مع المالك لزيادة عدد التراخيص.`);
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

                setState(prev => ({
                    ...prev,
                    branchId: result.branchId,
                    currentStep: prev.currentStep + 1
                }));
                
                haptic('success');
            } else if (state.currentStep === 2) {
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
                
                const savedTypes = await getRoomTypes(tenantId, state.branchId);
                setState(prev => ({
                    ...prev,
                    roomTypes: savedTypes,
                    currentStep: prev.currentStep + 1
                }));
                
                haptic('success');
            } else if (state.currentStep === 3) {
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

            haptic('success');
            playSound('success');
            onComplete?.(state.branchId);
            
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

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 flex items-center justify-center p-2 sm:p-4"
            style={{ 
                background: 'var(--theme-bg-overlay)',
                backdropFilter: 'blur(8px)',
                zIndex: 9999,
            }}
        >
            {/* Fixed-height modal with glassmorphism */}
            <div 
                className="w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col"
                style={{ 
                    height: '90vh',
                    maxHeight: '700px',
                    background: 'var(--theme-bg-secondary)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    border: `1px solid ${ADORA_TURQUOISE}40`,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    zIndex: 9999,
                }}
            >
                {/* Header */}
                <div 
                    className="flex-shrink-0 px-4 sm:px-6 py-4 border-b"
                    style={{ borderColor: `${ADORA_TURQUOISE}40` }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-bold" style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: 'var(--theme-text-primary)' }}>
                            معالج إعداد الفرع
                        </h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                            style={{ 
                                color: 'var(--theme-text-primary)',
                                background: 'var(--theme-bg-tertiary)',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--theme-bg-elevated)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--theme-bg-tertiary)'}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Compact Horizontal Stepper (Desktop) / Circular Progress (Mobile) */}
                    <div className="hidden sm:flex items-center justify-between gap-2">
                        {STEPS.map((step, index) => {
                            const StepIcon = step.icon;
                            const isActive = state.currentStep === step.id;
                            const isCompleted = state.currentStep > step.id;
                            
                            return (
                                <React.Fragment key={step.id}>
                                    <div 
                                        className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all"
                                        style={{
                                            background: isActive ? `${ADORA_TURQUOISE}20` : 'transparent',
                                        }}
                                    >
                                        <div 
                                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                            style={{
                                                background: isActive || isCompleted ? ADORA_TURQUOISE : 'var(--theme-bg-tertiary)',
                                                color: isActive || isCompleted ? '#fff' : 'var(--theme-text-secondary)',
                                            }}
                                        >
                                            {isCompleted ? (
                                                <CheckCircle className="w-4 h-4" />
                                            ) : (
                                                <StepIcon className="w-3 h-3" />
                                            )}
                                        </div>
                                        <span 
                                            className="text-xs font-medium truncate"
                                            style={{
                                                color: isActive || isCompleted ? ADORA_TURQUOISE : 'var(--theme-text-secondary)',
                                            }}
                                        >
                                            {step.title}
                                        </span>
                                    </div>
                                    {index < STEPS.length - 1 && (
                                        <div 
                                            className="w-4 h-0.5"
                                            style={{
                                                background: isCompleted ? ADORA_TURQUOISE : 'var(--theme-border-primary)',
                                            }}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Circular Progress Mini-Indicator (Mobile) */}
                    <div className="sm:hidden flex items-center justify-center gap-2">
                        <div 
                            className="relative w-10 h-10 rounded-full flex items-center justify-center"
                            style={{
                                background: `conic-gradient(${ADORA_TURQUOISE} ${progressPercentage * 3.6}deg, var(--theme-border-primary) 0deg)`,
                            }}
                        >
                            <div className="absolute inset-1 rounded-full" style={{ background: 'var(--theme-bg-secondary)' }} />
                            <span className="relative text-xs font-bold z-10" style={{ color: 'var(--theme-text-primary)' }}>{state.currentStep}/{STEPS.length}</span>
                        </div>
                        <span className="text-sm" style={{ fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)', color: 'var(--theme-text-primary)' }}>
                            {STEPS.find(s => s.id === state.currentStep)?.title}
                        </span>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4" style={{ minHeight: 0 }}>
                    {error && (
                        <div className="mb-3 p-3 rounded-lg flex items-center gap-2" style={{ 
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}>
                            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            <span className="text-sm text-red-400">{error}</span>
                        </div>
                    )}

                    {/* Step Content */}
                    {state.currentStep === 1 && (
                        <Step1BranchInfo 
                            data={state.branchData}
                            onChange={(data) => setState(prev => ({ ...prev, branchData: data }))}
                            usedCodes={usedCodes}
                            generateCode={() => generateBranchCode(usedCodes)}
                            maxBranches={maxBranches}
                            usedBranchesCount={usedBranchesCount}
                            remainingLicenses={remainingLicenses}
                            isOwner={user?.role === 'owner'}
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

                {/* Sticky Footer with Navigation Buttons */}
                <div 
                    className="flex-shrink-0 px-4 sm:px-6 py-3 flex items-center justify-between border-t gap-2"
                    style={{ 
                        borderColor: `${ADORA_TURQUOISE}40`,
                        background: 'var(--theme-bg-secondary)',
                    }}
                >
                    <button
                        onClick={handleBack}
                        disabled={state.currentStep === 1 || isLoading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            background: state.currentStep === 1 ? 'transparent' : 'var(--theme-bg-tertiary)',
                            color: state.currentStep === 1 ? 'var(--theme-text-disabled)' : 'var(--theme-text-primary)',
                            border: state.currentStep === 1 ? 'none' : `1px solid var(--theme-border-primary)`,
                        }}
                    >
                        <ChevronRight className="w-4 h-4" />
                        <span className="hidden sm:inline" style={{ fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)' }}>السابق</span>
                    </button>

                    <span className="text-xs" style={{ fontSize: 'clamp(0.7rem, 1.2vw, 0.75rem)', color: 'var(--theme-text-secondary)' }}>
                        {state.currentStep} / {STEPS.length}
                    </span>

                    {state.currentStep < 4 ? (
                        <button
                            onClick={handleNext}
                            disabled={!canGoNext || isLoading}
                            className="flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                background: !canGoNext || isLoading ? 'var(--theme-bg-tertiary)' : ADORA_TURQUOISE,
                                color: !canGoNext || isLoading ? 'var(--theme-text-disabled)' : '#fff',
                                fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                            }}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <span>التالي</span>
                                    <ChevronLeft className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleActivate}
                            disabled={isLoading || state.isComplete}
                            className="flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                background: state.isComplete ? '#10b981' : isLoading ? 'var(--theme-bg-tertiary)' : '#10b981',
                                color: state.isComplete || !isLoading ? '#fff' : 'var(--theme-text-disabled)',
                                fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                            }}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : state.isComplete ? (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    <span>تم التفعيل!</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" />
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
// STEP 1: BRANCH INFO
// ============================================================

const Step1BranchInfo: React.FC<{
    data: WizardState['branchData'];
    onChange: (data: WizardState['branchData']) => void;
    usedCodes: string[];
    generateCode: () => string;
    maxBranches: number;
    usedBranchesCount: number;
    remainingLicenses: number;
    isOwner?: boolean;
}> = ({ data, onChange, usedCodes, generateCode, maxBranches, usedBranchesCount, remainingLicenses, isOwner }) => (
    <div className="space-y-4">
        <div className="text-center mb-4">
            <Building2 className="w-12 h-12 mx-auto mb-2" style={{ color: ADORA_TURQUOISE }} />
                <h3 className="font-bold mb-1" style={{ fontSize: 'clamp(1rem, 2vw, 1.125rem)', color: 'var(--theme-text-primary)' }}>
                    بيانات الفرع الأساسية
                </h3>
        </div>

        {/* License Info Card */}
        {!isOwner && (
            <div 
                className="p-3 rounded-lg border"
                style={{ 
                    background: remainingLicenses > 0 ? `${ADORA_TURQUOISE}10` : 'rgba(239, 68, 68, 0.1)',
                    borderColor: remainingLicenses > 0 ? `${ADORA_TURQUOISE}30` : 'rgba(239, 68, 68, 0.3)',
                }}
            >
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                        التراخيص المتاحة:
                    </span>
                    <span 
                        className="text-sm font-bold"
                        style={{ 
                            color: remainingLicenses > 0 ? ADORA_TURQUOISE : '#ef4444'
                        }}
                    >
                        {usedBranchesCount} / {maxBranches}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div 
                        className="flex-1 h-2 rounded-full overflow-hidden"
                        style={{ background: 'var(--theme-bg-tertiary)' }}
                    >
                        <div 
                            className="h-full rounded-full transition-all"
                            style={{
                                width: `${(usedBranchesCount / maxBranches) * 100}%`,
                                background: remainingLicenses > 0 ? ADORA_TURQUOISE : '#ef4444',
                            }}
                        />
                    </div>
                    <span 
                        className="text-xs font-medium whitespace-nowrap"
                        style={{ 
                            color: remainingLicenses > 0 ? 'var(--theme-text-secondary)' : '#ef4444'
                        }}
                    >
                        {remainingLicenses > 0 ? `متبقي ${remainingLicenses}` : 'لا يوجد تراخيص'}
                    </span>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Branch Name */}
            <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--theme-text-primary)' }}>
                    اسم الفرع <span className="text-red-400">*</span>
                </label>
                <input
                    type="text"
                    value={data.name}
                    onChange={(e) => onChange({ ...data, name: e.target.value })}
                    placeholder="مثال: فرع الكورنيش"
                    className="w-full px-3 py-2.5 rounded-lg border transition-all focus:ring-2 focus:ring-teal-500/20"
                    style={{
                        background: 'var(--theme-bg-tertiary)',
                        borderColor: `${ADORA_TURQUOISE}40`,
                        color: 'var(--theme-text-primary)',
                        fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                    }}
                />
            </div>

            {/* Branch Code */}
            <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--theme-text-primary)' }}>
                    كود الفرع
                </label>
                <input
                    type="text"
                    value={data.code}
                    onChange={(e) => onChange({ ...data, code: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="من 1 إلى 4 أرقام"
                    className="w-full px-3 py-2.5 rounded-lg border transition-all focus:ring-2 focus:ring-teal-500/20 font-mono"
                    style={{
                        background: 'var(--theme-bg-tertiary)',
                        borderColor: `${ADORA_TURQUOISE}40`,
                        color: 'var(--theme-text-primary)',
                        fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                    }}
                />
                <button
                    type="button"
                    onClick={() => onChange({ ...data, code: generateCode() })}
                    className="mt-1.5 w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                    style={{
                        background: `${ADORA_TURQUOISE}15`,
                        color: ADORA_TURQUOISE,
                        border: `1px solid ${ADORA_TURQUOISE}30`,
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${ADORA_TURQUOISE}25`;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = `${ADORA_TURQUOISE}15`;
                    }}
                >
                    <Sparkles className="w-3 h-3" />
                    اقتراح كود غير مستخدم
                </button>
            </div>

            {/* Location */}
            <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--theme-text-primary)' }}>
                    الموقع <span className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>(اختياري)</span>
                </label>
                <input
                    type="text"
                    value={data.location}
                    onChange={(e) => onChange({ ...data, location: e.target.value })}
                    placeholder="شارع الملك فهد، جدة"
                    className="w-full px-3 py-2.5 rounded-lg border transition-all focus:ring-2 focus:ring-teal-500/20"
                    style={{
                        background: 'var(--theme-bg-tertiary)',
                        borderColor: `${ADORA_TURQUOISE}40`,
                        color: 'var(--theme-text-primary)',
                        fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
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
                id: '',
                name: newType.name,
                basePrice: newType.basePrice,
                maxOccupancy: newType.maxOccupancy,
                active: true
            }
        ]);
        
        setNewType({ name: '', basePrice: 0, maxOccupancy: 2 });
    };

    const presetTypes = [
        { name: 'غرفة عادية', basePrice: 200, maxOccupancy: 2 },
        { name: 'غرفة توأم', basePrice: 250, maxOccupancy: 2 },
        { name: 'غرفة كينج', basePrice: 300, maxOccupancy: 2 },
        { name: 'ستوديو', basePrice: 350, maxOccupancy: 3 },
        { name: 'جناح', basePrice: 450, maxOccupancy: 4 },
        { name: 'VIP', basePrice: 800, maxOccupancy: 4 },
    ];

    return (
        <div className="space-y-4">
            <div className="text-center mb-4">
                <Layers className="w-12 h-12 mx-auto mb-2" style={{ color: ADORA_TURQUOISE }} />
                <h3 className="font-bold mb-1" style={{ fontSize: 'clamp(1rem, 2vw, 1.125rem)', color: 'var(--theme-text-primary)' }}>
                    أنواع الغرف والأسعار
                </h3>
            </div>

            {/* Quick Presets */}
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(64, 224, 208, 0.2)' }}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--theme-text-primary)' }}>إضافة سريعة:</p>
                <div className="flex flex-wrap gap-2">
                    {presetTypes.map((preset) => {
                        const alreadyAdded = types.some(t => t.name === preset.name);
                        return (
                            <button
                                key={preset.name}
                                onClick={() => !alreadyAdded && onChange([...types, { ...preset, id: '', active: true }])}
                                disabled={alreadyAdded}
                                className="px-2.5 py-1.5 rounded-lg text-xs transition-all disabled:opacity-50"
                                style={{
                                    background: alreadyAdded ? `${ADORA_TURQUOISE}30` : 'rgba(255, 255, 255, 0.05)',
                                    color: alreadyAdded ? ADORA_TURQUOISE : 'var(--theme-text-primary)',
                                    border: `1px solid ${alreadyAdded ? ADORA_TURQUOISE : `${ADORA_TURQUOISE}40`}`,
                                }}
                            >
                                {preset.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Custom Type Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(64, 224, 208, 0.2)' }}>
                <input
                    type="text"
                    value={newType.name}
                    onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                    placeholder="اسم النوع"
                    className="px-3 py-2 rounded-lg border"
                    style={{
                        background: 'var(--theme-bg-tertiary)',
                        borderColor: `${ADORA_TURQUOISE}40`,
                        color: 'var(--theme-text-inverse)',
                        fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                    }}
                />
                <input
                    type="number"
                    value={newType.basePrice || ''}
                    onChange={(e) => setNewType({ ...newType, basePrice: Number(e.target.value) })}
                    placeholder="السعر"
                    className="px-3 py-2 rounded-lg border"
                    style={{
                        background: 'var(--theme-bg-tertiary)',
                        borderColor: `${ADORA_TURQUOISE}40`,
                        color: 'var(--theme-text-inverse)',
                        fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                    }}
                />
                <input
                    type="number"
                    value={newType.maxOccupancy || ''}
                    onChange={(e) => setNewType({ ...newType, maxOccupancy: Number(e.target.value) })}
                    placeholder="السعة"
                    className="px-3 py-2 rounded-lg border"
                    style={{
                        background: 'var(--theme-bg-tertiary)',
                        borderColor: `${ADORA_TURQUOISE}40`,
                        color: 'var(--theme-text-inverse)',
                        fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                    }}
                />
                <button
                    onClick={handleAdd}
                    disabled={!newType.name || newType.basePrice <= 0}
                    className="px-3 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                        background: !newType.name || newType.basePrice <= 0 ? 'rgba(255, 255, 255, 0.05)' : ADORA_TURQUOISE,
                        color: 'var(--theme-text-inverse)',
                        fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                    }}
                >
                    <Plus className="w-4 h-4" />
                    إضافة
                </button>
            </div>

            {/* Types List */}
            {types.length > 0 && (
                <div className="space-y-2">
                    {types.map((type, index) => (
                        <div 
                            key={index}
                            className="p-3 rounded-lg flex items-center justify-between"
                            style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(64, 224, 208, 0.2)' }}
                        >
                            <div>
                                <div className="font-medium" style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1rem)', color: 'var(--theme-text-primary)' }}>
                                    {type.name}
                                </div>
                                <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                                    {type.basePrice} ر.س | {type.maxOccupancy} أشخاص
                                </div>
                            </div>
                            <button
                                onClick={() => onChange(types.filter((_, i) => i !== index))}
                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                                style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
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

    return (
        <div className="space-y-4">
            <div className="text-center mb-4">
                <DoorOpen className="w-12 h-12 mx-auto mb-2" style={{ color: ADORA_TURQUOISE }} />
                <h3 className="font-bold mb-1" style={{ fontSize: 'clamp(1rem, 2vw, 1.125rem)', color: 'var(--theme-text-primary)' }}>
                    إضافة الغرف
                </h3>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2">
                <button
                    onClick={() => setMode('single')}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                        background: mode === 'single' ? ADORA_TURQUOISE : 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--theme-text-inverse)',
                    }}
                >
                    فردية
                </button>
                <button
                    onClick={() => setMode('batch')}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                        background: mode === 'batch' ? ADORA_TURQUOISE : 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--theme-text-inverse)',
                    }}
                >
                    دفعة
                </button>
            </div>

            {/* Form */}
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(64, 224, 208, 0.2)' }}>
                {mode === 'single' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                            type="text"
                            value={singleRoom.number}
                            onChange={(e) => setSingleRoom({ ...singleRoom, number: e.target.value })}
                            placeholder="رقم الغرفة"
                            className="px-3 py-2 rounded-lg border"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: `${ADORA_TURQUOISE}40`,
                                color: 'var(--theme-text-inverse)',
                                fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                            }}
                        />
                        <input
                            type="number"
                            value={singleRoom.floor}
                            onChange={(e) => setSingleRoom({ ...singleRoom, floor: Number(e.target.value) })}
                            placeholder="الدور"
                            className="px-3 py-2 rounded-lg border"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: `${ADORA_TURQUOISE}40`,
                                color: 'var(--theme-text-inverse)',
                                fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                            }}
                        />
                        <select
                            value={singleRoom.type}
                            onChange={(e) => setSingleRoom({ ...singleRoom, type: e.target.value })}
                            className="px-3 py-2 rounded-lg border sm:col-span-2"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: `${ADORA_TURQUOISE}40`,
                                color: 'var(--theme-text-inverse)',
                                fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                            }}
                        >
                            <option value="">اختر النوع</option>
                            {roomTypes.map((type, idx) => (
                                <option key={idx} value={type.name}>{type.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleAddSingle}
                            disabled={!singleRoom.number || !singleRoom.type}
                            className="sm:col-span-2 px-3 py-2 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            style={{
                                background: !singleRoom.number || !singleRoom.type ? 'rgba(255, 255, 255, 0.05)' : ADORA_TURQUOISE,
                                color: 'var(--theme-text-inverse)',
                                fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                            }}
                        >
                            <Plus className="w-4 h-4" />
                            إضافة
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <input
                            type="number"
                            value={batchConfig.floor}
                            onChange={(e) => setBatchConfig({ ...batchConfig, floor: Number(e.target.value) })}
                            placeholder="الدور"
                            className="px-3 py-2 rounded-lg border"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: `${ADORA_TURQUOISE}40`,
                                color: 'var(--theme-text-inverse)',
                                fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                            }}
                        />
                        <input
                            type="number"
                            value={batchConfig.startNumber}
                            onChange={(e) => setBatchConfig({ ...batchConfig, startNumber: Number(e.target.value) })}
                            placeholder={t('common.from') || 'من'}
                            className="px-3 py-2 rounded-lg border"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: `${ADORA_TURQUOISE}40`,
                                color: 'var(--theme-text-inverse)',
                                fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                            }}
                        />
                        <input
                            type="number"
                            value={batchConfig.endNumber}
                            onChange={(e) => setBatchConfig({ ...batchConfig, endNumber: Number(e.target.value) })}
                            placeholder={t('common.to') || 'إلى'}
                            className="px-3 py-2 rounded-lg border"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: `${ADORA_TURQUOISE}40`,
                                color: 'var(--theme-text-inverse)',
                                fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                            }}
                        />
                        <select
                            value={batchConfig.type}
                            onChange={(e) => setBatchConfig({ ...batchConfig, type: e.target.value })}
                            className="px-3 py-2 rounded-lg border"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: `${ADORA_TURQUOISE}40`,
                                color: 'var(--theme-text-inverse)',
                                fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                            }}
                        >
                            <option value="">النوع</option>
                            {roomTypes.map((type, idx) => (
                                <option key={idx} value={type.name}>{type.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleAddBatch}
                            disabled={!batchConfig.type || batchConfig.startNumber >= batchConfig.endNumber}
                            className="px-3 py-2 rounded-lg font-medium transition-all disabled:opacity-50 text-xs"
                            style={{
                                background: !batchConfig.type || batchConfig.startNumber >= batchConfig.endNumber ? 'rgba(255, 255, 255, 0.05)' : ADORA_TURQUOISE,
                                color: 'var(--theme-text-inverse)',
                            }}
                        >
                            إضافة {batchConfig.endNumber - batchConfig.startNumber + 1}
                        </button>
                    </div>
                )}
            </div>

            {/* Rooms Preview */}
            {rooms.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>{rooms.length} غرفة</span>
                        <button
                            onClick={() => onChange([])}
                            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                            <Trash2 className="w-3 h-3" />
                            مسح الكل
                        </button>
                    </div>
                    <div 
                        className="max-h-48 overflow-y-auto p-3 rounded-lg space-y-2"
                        style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(64, 224, 208, 0.2)' }}
                    >
                        {rooms.map((room, idx) => (
                            <div 
                                key={idx}
                                className="flex items-center justify-between p-2 rounded"
                                style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                            >
                                <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                    {room.number} - {room.type} (د{room.floor})
                                </span>
                                <button
                                    onClick={() => onChange(rooms.filter((_, i) => i !== idx))}
                                    className="text-red-400 hover:text-red-300"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// STEP 4: ACTIVATION
// ============================================================

const Step4Activation: React.FC<{
    state: WizardState;
    isComplete: boolean;
}> = ({ state, isComplete }) => (
    <div className="space-y-4">
        <div className="text-center mb-4">
            {isComplete ? (
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
            ) : (
                <Settings className="w-12 h-12 mx-auto mb-2" style={{ color: ADORA_TURQUOISE }} />
            )}
            <h3 className="font-bold mb-1" style={{ fontSize: 'clamp(1rem, 2vw, 1.125rem)', color: 'var(--theme-text-primary)' }}>
                {isComplete ? 'تم تفعيل الفرع!' : 'مراجعة وتفعيل'}
            </h3>
        </div>

        {/* Summary Cards - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(64, 224, 208, 0.2)' }}>
                <div className="text-xs text-xs mb-1">الاسم</div>
                <div className="font-medium text-primary" style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1rem)' }}>
                    {state.branchData.name}
                </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(64, 224, 208, 0.2)' }}>
                <div className="text-xs text-xs mb-1">الكود</div>
                <div className="font-medium font-mono text-primary" style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1rem)' }}>
                    {state.branchData.code}
                </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(64, 224, 208, 0.2)' }}>
                <div className="text-xs text-xs mb-1">أنواع الغرف</div>
                <div className="font-medium text-primary" style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1rem)' }}>
                    {state.roomTypes.length}
                </div>
            </div>
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(64, 224, 208, 0.2)' }}>
                <div className="text-xs text-xs mb-1">عدد الغرف</div>
                <div className="font-medium text-primary" style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1rem)' }}>
                    {state.rooms.length}
                </div>
            </div>
        </div>

        {isComplete && (
            <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium" style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1rem)' }}>تم الإعداد بنجاح!</span>
                </div>
            </div>
        )}
    </div>
);

export default BranchSetupWizard;
