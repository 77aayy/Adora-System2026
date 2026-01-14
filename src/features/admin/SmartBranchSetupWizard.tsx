/**
 * Smart Branch Setup Wizard
 * Intelligent wizard for new manager onboarding
 * Adora Hotel Management System V3
 * 
 * Flow: Welcome → Rooms (Batch) → Pricing → Employees (Optional) → Activation
 * 
 * Features:
 * - Smart Batch Entry (add entire floors at once)
 * - Room Edit Modal (modify after creation)
 * - Auto-detected room types from entries
 * - Advanced occupancy (adults + children)
 * - Auto-save & resume
 * - Mandatory flow (cannot skip)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Building2,
    DoorOpen,
    Layers,
    Users,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    X,
    Plus,
    Trash2,
    Edit2,
    Sparkles,
    Loader2,
    Save,
    AlertTriangle,
    Home,
    BedDouble,
    Baby,
    User,
    Banknote,
    Percent,
    Calendar,
    Play,
    Settings
} from 'lucide-react';
import { addDoc, collection, Timestamp, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { haptic, playSound } from '../../utils/uxEffects';

// ============================================================
// TYPES
// ============================================================

interface RoomEntry {
    id?: string;
    number: string;
    floor: number;
    type: string;
    adults: number;
    children: number;
    basePrice: number;
    seasonPrice: number;
    bookingRate: number;
}

interface RoomTypeConfig {
    name: string;
    count: number;
    adults: number;
    children: number;
    basePrice: number;
    seasonPrice: number;
    bookingRate: number;
}

interface EmployeeEntry {
    name: string;
    code: string;
    department: string;
    role: string;
}

interface WizardState {
    currentStep: number;
    branchId: string | null;
    branchData: {
        name: string;
        code: string;
        location: string;
    };
    rooms: RoomEntry[];
    roomTypes: RoomTypeConfig[];
    employees: EmployeeEntry[];
    isComplete: boolean;
    startedAt: string;
    lastUpdatedAt: string;
}

interface SmartBranchSetupWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: (branchId: string) => void;
    isFirstTime?: boolean; // Makes it mandatory (cannot close)
}

// ============================================================
// CONSTANTS
// ============================================================

const STEPS = [
    { id: 1, title: 'مرحباً', description: 'بيانات الفرع الأساسية', icon: Building2 },
    { id: 2, title: 'الغرف', description: 'أضف الغرف بالدُفعات', icon: DoorOpen },
    { id: 3, title: 'الأسعار', description: 'حدد أسعار كل نوع', icon: Banknote },
    { id: 4, title: 'الموظفين', description: 'أضف فريق العمل (اختياري)', icon: Users },
    { id: 5, title: 'التفعيل', description: 'راجع وابدأ العمل', icon: CheckCircle },
];

const STORAGE_KEY = 'adora_smart_branch_wizard';

const PRESET_ROOM_TYPES = [
    'غرفة عادية',
    'غرفة توأم',
    'غرفة ديلوكس',
    'سويت',
    'جناح',
    'VIP',
    'استوديو',
    'شاليه',
    'خيمة',
    'مكتب',
];

const DEPARTMENTS = [
    { id: 'reception', name: 'الاستقبال' },
    { id: 'housekeeping', name: 'الهاوس كيبنج' },
    { id: 'bellman', name: 'البيلمان' },
    { id: 'maintenance', name: 'الصيانة' },
    { id: 'procurement', name: 'المشتريات' },
    { id: 'coffeeshop', name: 'الكافي شوب' },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const generateBranchCode = (): string => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

const generateEmployeeCode = (): string => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

const saveWizardState = (state: WizardState) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Error saving wizard state:', e);
    }
};

const loadWizardState = (): WizardState | null => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
};

const clearWizardState = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error('Error clearing wizard state:', e);
    }
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const SmartBranchSetupWizard: React.FC<SmartBranchSetupWizardProps> = ({
    isOpen,
    onClose,
    onComplete,
    isFirstTime = false
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
        rooms: [],
        roomTypes: [],
        employees: [],
        isComplete: false,
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString()
    }), []);

    const [state, setState] = useState<WizardState>(initialState);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const [editingRoom, setEditingRoom] = useState<RoomEntry | null>(null);

    // Check for saved state on mount
    useEffect(() => {
        if (isOpen) {
            const saved = loadWizardState();
            if (saved && !saved.isComplete) {
                setShowResumePrompt(true);
            }
        }
    }, [isOpen]);

    // Auto-save state on changes
    useEffect(() => {
        if (isOpen && state.branchData.name) {
            saveWizardState({
                ...state,
                lastUpdatedAt: new Date().toISOString()
            });
        }
    }, [state, isOpen]);

    // Extract unique room types from rooms
    const extractedRoomTypes = useMemo(() => {
        const typeMap = new Map<string, RoomTypeConfig>();
        
        state.rooms.forEach(room => {
            if (!typeMap.has(room.type)) {
                typeMap.set(room.type, {
                    name: room.type,
                    count: 1,
                    adults: room.adults || 2,
                    children: room.children || 0,
                    basePrice: room.basePrice || 0,
                    seasonPrice: room.seasonPrice || 0,
                    bookingRate: room.bookingRate || 15
                });
            } else {
                const existing = typeMap.get(room.type)!;
                existing.count++;
            }
        });
        
        return Array.from(typeMap.values());
    }, [state.rooms]);

    // Sync extracted types to state when moving to pricing step
    useEffect(() => {
        if (state.currentStep === 3 && extractedRoomTypes.length > 0) {
            setState(prev => ({
                ...prev,
                roomTypes: extractedRoomTypes.map(et => {
                    // Preserve existing pricing if available
                    const existing = prev.roomTypes.find(rt => rt.name === et.name);
                    return existing ? { ...et, ...existing, count: et.count } : et;
                })
            }));
        }
    }, [state.currentStep, extractedRoomTypes.length]);

    // Calculate progress
    const progressPercentage = useMemo(() => {
        let progress = 0;
        if (state.branchData.name) progress += 20;
        if (state.rooms.length > 0) progress += 30;
        if (state.roomTypes.some(rt => rt.basePrice > 0)) progress += 30;
        if (state.isComplete) progress += 20;
        return progress;
    }, [state]);

    // Navigation validation
    const canGoNext = useMemo(() => {
        switch (state.currentStep) {
            case 1: return state.branchData.name.trim().length >= 2;
            case 2: return state.rooms.length > 0;
            case 3: return state.roomTypes.every(rt => rt.basePrice > 0);
            case 4: return true; // Employees are optional
            case 5: return true;
            default: return false;
        }
    }, [state]);

    // Handle next step
    const handleNext = async () => {
        if (!canGoNext) return;
        setError(null);
        setIsLoading(true);

        try {
            if (state.currentStep === 1 && !state.branchId) {
                // Create branch in Firestore
                if (!tenantId) throw new Error('لم يتم تحديد المؤسسة');
                
                const branchRef = await addDoc(collection(db, `tenants/${tenantId}/branches`), {
                    name: state.branchData.name,
                    code: state.branchData.code,
                    location: state.branchData.location,
                    status: 'setup_incomplete',
                    createdAt: Timestamp.now(),
                    createdBy: user?.id,
                    settings: {
                        allowNegativeInventory: false,
                        requireManagerApproval: true
                    }
                });

                setState(prev => ({
                    ...prev,
                    branchId: branchRef.id,
                    currentStep: prev.currentStep + 1
                }));
                
                haptic('success');
            } else if (state.currentStep === 2) {
                // Save rooms to Firestore
                if (!tenantId || !state.branchId) throw new Error('لم يتم تحديد الفرع');
                
                for (const room of state.rooms) {
                    if (!room.id) {
                        await addDoc(collection(db, `tenants/${tenantId}/branches/${state.branchId}/rooms`), {
                            number: room.number,
                            floor: room.floor,
                            type: room.type,
                            adults: room.adults || 2,
                            children: room.children || 0,
                            status: 'available',
                            createdAt: Timestamp.now()
                        });
                    }
                }
                
                setState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
                haptic('success');
            } else if (state.currentStep === 3) {
                // Save room types/pricing to Firestore
                if (!tenantId || !state.branchId) throw new Error('لم يتم تحديد الفرع');
                
                for (const roomType of state.roomTypes) {
                    await addDoc(collection(db, `tenants/${tenantId}/branches/${state.branchId}/roomTypes`), {
                        name: roomType.name,
                        basePrice: roomType.basePrice,
                        seasonalPrice: roomType.seasonPrice,
                        maxOccupancy: roomType.adults + roomType.children,
                        adults: roomType.adults,
                        children: roomType.children,
                        bookingRate: roomType.bookingRate,
                        active: true,
                        createdAt: Timestamp.now()
                    });
                }
                
                setState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
                haptic('success');
            } else if (state.currentStep === 4) {
                // Save employees to Firestore (if any)
                if (!tenantId || !state.branchId) throw new Error('لم يتم تحديد الفرع');
                
                for (const emp of state.employees) {
                    await addDoc(collection(db, `tenants/${tenantId}/users`), {
                        name: emp.name,
                        code: emp.code,
                        department: emp.department,
                        role: emp.role || 'employee',
                        branchId: state.branchId,
                        tenantId: tenantId,
                        status: 'active',
                        createdAt: Timestamp.now(),
                        createdBy: user?.id
                    });
                }
                
                setState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
                haptic('success');
            } else {
                setState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
            }
        } catch (err: any) {
            console.error('Wizard error:', err);
            setError(err.message || 'حدث خطأ غير متوقع');
            haptic('error');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle back
    const handleBack = () => {
        if (state.currentStep > 1) {
            setState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
        }
    };

    // Handle activation
    const handleActivate = async () => {
        if (!tenantId || !state.branchId) return;
        
        setIsLoading(true);
        try {
            // Update branch status to active
            await updateDoc(doc(db, `tenants/${tenantId}/branches/${state.branchId}`), {
                status: 'active',
                activatedAt: Timestamp.now(),
                setupCompleted: true
            });
            
            setState(prev => ({ ...prev, isComplete: true }));
            clearWizardState();
            
            haptic('success');
            playSound('success');
            
            onComplete?.(state.branchId);
        } catch (err: any) {
            console.error('Activation error:', err);
            setError(err.message);
            haptic('error');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle resume
    const handleResume = () => {
        const saved = loadWizardState();
        if (saved) {
            setState(saved);
        }
        setShowResumePrompt(false);
    };

    // Handle start fresh
    const handleStartFresh = () => {
        clearWizardState();
        setState(initialState);
        setShowResumePrompt(false);
    };

    // Handle close
    const handleClose = () => {
        if (isFirstTime && !state.isComplete) {
            // Cannot close during first-time setup
            return;
        }
        onClose();
    };

    // Update room type pricing
    const updateRoomTypePricing = (typeName: string, updates: Partial<RoomTypeConfig>) => {
        setState(prev => ({
            ...prev,
            roomTypes: prev.roomTypes.map(rt => 
                rt.name === typeName ? { ...rt, ...updates } : rt
            )
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div 
                className="w-full max-w-md sm:max-w-lg lg:max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl animate-in zoom-in-95"
                style={{ background: 'var(--theme-bg-primary)' }}
            >
                {/* Resume Prompt */}
                {showResumePrompt && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div 
                            className="w-full max-w-md p-6 rounded-2xl shadow-xl"
                            style={{ background: 'var(--theme-bg-secondary)' }}
                        >
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                                </div>
                                <h3 className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                    يوجد إعداد غير مكتمل
                                </h3>
                                <p className="text-sm mt-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                    هل تريد استكمال الإعداد السابق أم البدء من جديد؟
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleStartFresh}
                                    className="flex-1 px-4 py-3 rounded-xl font-medium transition-all"
                                    style={{ 
                                        background: 'var(--theme-bg-tertiary)',
                                        color: 'var(--theme-text-secondary)'
                                    }}
                                >
                                    البدء من جديد
                                </button>
                                <button
                                    onClick={handleResume}
                                    className="flex-1 px-4 py-3 rounded-xl font-medium text-white transition-all"
                                    style={{ background: 'linear-gradient(135deg, var(--theme-primary-500), var(--theme-primary-600))' }}
                                >
                                    استكمال
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div 
                    className="p-4 sm:p-6 flex items-center justify-between"
                    style={{ 
                        background: 'linear-gradient(135deg, var(--theme-primary-500), var(--theme-primary-600))',
                        borderBottom: '1px solid var(--theme-border-primary)'
                    }}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                            {React.createElement(STEPS[state.currentStep - 1].icon, { className: 'w-6 h-6 text-white' })}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">
                                {STEPS[state.currentStep - 1].title}
                            </h2>
                            <p className="text-sm text-white/70">
                                خطوة {state.currentStep} من {STEPS.length}
                            </p>
                        </div>
                    </div>
                    {!isFirstTime && (
                        <button
                            onClick={handleClose}
                            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="px-4 sm:px-6 py-3" style={{ background: 'var(--theme-bg-secondary)' }}>
                    <div className="flex items-center justify-between mb-2">
                        {STEPS.map((step, index) => (
                            <div 
                                key={step.id}
                                className={`flex items-center ${index < STEPS.length - 1 ? 'flex-1' : ''}`}
                            >
                                <div 
                                    className={`
                                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                                        ${state.currentStep > step.id 
                                            ? 'bg-teal-500 text-white' 
                                            : state.currentStep === step.id 
                                                ? 'bg-teal-500 text-white ring-4 ring-teal-500/30' 
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}
                                    `}
                                >
                                    {state.currentStep > step.id ? (
                                        <CheckCircle className="w-5 h-5" />
                                    ) : step.id}
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div 
                                        className={`
                                            flex-1 h-1 mx-2 rounded transition-all
                                            ${state.currentStep > step.id 
                                                ? 'bg-teal-500' 
                                                : 'bg-slate-200 dark:bg-slate-700'}
                                        `}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                        {STEPS.map(step => (
                            <span key={step.id} className="hidden sm:block">{step.title}</span>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
                    {error && (
                        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="font-medium">{error}</span>
                            </div>
                        </div>
                    )}

                    {state.currentStep === 1 && (
                        <Step1BranchInfo
                            data={state.branchData}
                            onChange={(data) => setState(prev => ({ ...prev, branchData: data }))}
                        />
                    )}

                    {state.currentStep === 2 && (
                        <Step2Rooms
                            rooms={state.rooms}
                            onChange={(rooms) => setState(prev => ({ ...prev, rooms }))}
                            onEditRoom={setEditingRoom}
                        />
                    )}

                    {state.currentStep === 3 && (
                        <Step3Pricing
                            roomTypes={state.roomTypes}
                            onChange={updateRoomTypePricing}
                        />
                    )}

                    {state.currentStep === 4 && (
                        <Step4Employees
                            employees={state.employees}
                            onChange={(employees) => setState(prev => ({ ...prev, employees }))}
                        />
                    )}

                    {state.currentStep === 5 && (
                        <Step5Summary
                            state={state}
                        />
                    )}
                </div>

                {/* Footer */}
                <div 
                    className="p-4 sm:p-6 flex items-center justify-between"
                    style={{ 
                        borderTop: '1px solid var(--theme-border-primary)',
                        background: 'var(--theme-bg-secondary)'
                    }}
                >
                    <button
                        onClick={handleBack}
                        disabled={state.currentStep === 1 || isLoading}
                        className={`
                            flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all
                            ${state.currentStep === 1 
                                ? 'opacity-0 pointer-events-none' 
                                : 'hover:bg-slate-100 dark:hover:bg-white/10'}
                        `}
                        style={{ color: 'var(--theme-text-secondary)' }}
                    >
                        <ChevronRight className="w-5 h-5" />
                        السابق
                    </button>

                    {state.currentStep < 5 ? (
                        <button
                            onClick={handleNext}
                            disabled={!canGoNext || isLoading}
                            className={`
                                flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-white transition-all
                                ${!canGoNext || isLoading 
                                    ? 'opacity-50 cursor-not-allowed' 
                                    : 'hover:scale-[1.02] active:scale-[0.98]'}
                            `}
                            style={{ background: 'linear-gradient(135deg, var(--theme-primary-500), var(--theme-primary-600))' }}
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {state.currentStep === 4 ? 'تخطي وتفعيل' : 'التالي'}
                                    <ChevronLeft className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleActivate}
                            disabled={isLoading}
                            className={`
                                flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all
                                ${isLoading ? 'opacity-50' : 'hover:scale-[1.02] active:scale-[0.98]'}
                            `}
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Play className="w-5 h-5" />
                                    تفعيل الفرع وبدء العمل
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Room Edit Modal */}
            {editingRoom && (
                <RoomEditModal
                    room={editingRoom}
                    onSave={(updated) => {
                        setState(prev => ({
                            ...prev,
                            rooms: prev.rooms.map(r => 
                                r.number === editingRoom.number && r.floor === editingRoom.floor
                                    ? updated
                                    : r
                            )
                        }));
                        setEditingRoom(null);
                    }}
                    onDelete={() => {
                        setState(prev => ({
                            ...prev,
                            rooms: prev.rooms.filter(r => 
                                !(r.number === editingRoom.number && r.floor === editingRoom.floor)
                            )
                        }));
                        setEditingRoom(null);
                    }}
                    onClose={() => setEditingRoom(null)}
                />
            )}
        </div>
    );
};

// ============================================================
// STEP 1: BRANCH INFO
// ============================================================

const Step1BranchInfo: React.FC<{
    data: WizardState['branchData'];
    onChange: (data: WizardState['branchData']) => void;
}> = ({ data, onChange }) => {
    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center">
                    <Building2 className="w-12 h-12 text-teal-500" />
                </div>
                <h3 className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                    مرحباً بك في أدورا! 🎉
                </h3>
                <p className="text-sm mt-2" style={{ color: 'var(--theme-text-secondary)' }}>
                    لنبدأ بإعداد فرعك الأول
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
                        placeholder="مثال: الفرع الرئيسي"
                        className="w-full px-4 py-3 rounded-xl border-2 transition-all focus:ring-2 focus:ring-teal-500/20"
                        style={{
                            background: 'var(--theme-bg-tertiary)',
                            borderColor: data.name ? 'var(--theme-primary-500)' : 'var(--theme-border-primary)',
                            color: 'var(--theme-text-primary)'
                        }}
                        autoFocus
                    />
                </div>

                {/* Branch Code */}
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                        كود الفرع
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={data.code}
                            onChange={(e) => onChange({ ...data, code: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border-2 transition-all"
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

                {/* Location */}
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                        الموقع <span className="text-xs font-normal text-slate-400">(اختياري)</span>
                    </label>
                    <input
                        type="text"
                        value={data.location}
                        onChange={(e) => onChange({ ...data, location: e.target.value })}
                        placeholder="مثال: شارع الملك فهد، جدة"
                        className="w-full px-4 py-3 rounded-xl border-2 transition-all"
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
};

// ============================================================
// STEP 2: ROOMS (SMART BATCH ENTRY)
// ============================================================

const Step2Rooms: React.FC<{
    rooms: RoomEntry[];
    onChange: (rooms: RoomEntry[]) => void;
    onEditRoom: (room: RoomEntry) => void;
}> = ({ rooms, onChange, onEditRoom }) => {
    const [batchConfig, setBatchConfig] = useState({
        floor: 1,
        startNumber: 101,
        endNumber: 110,
        type: 'غرفة عادية',
        customType: ''
    });
    const [showCustomType, setShowCustomType] = useState(false);

    // Group rooms by floor
    const roomsByFloor = useMemo(() => {
        const grouped = new Map<number, RoomEntry[]>();
        rooms.forEach(room => {
            if (!grouped.has(room.floor)) {
                grouped.set(room.floor, []);
            }
            grouped.get(room.floor)!.push(room);
        });
        return grouped;
    }, [rooms]);

    const handleAddBatch = () => {
        const type = showCustomType ? batchConfig.customType : batchConfig.type;
        if (!type || batchConfig.startNumber >= batchConfig.endNumber) return;

        const newRooms: RoomEntry[] = [];
        for (let num = batchConfig.startNumber; num <= batchConfig.endNumber; num++) {
            // Skip if room already exists
            if (rooms.some(r => r.number === num.toString() && r.floor === batchConfig.floor)) continue;
            
            newRooms.push({
                number: num.toString(),
                floor: batchConfig.floor,
                type: type,
                adults: 2,
                children: 0,
                basePrice: 0,
                seasonPrice: 0,
                bookingRate: 15
            });
        }

        onChange([...rooms, ...newRooms]);
        
        // Auto-advance to next floor
        setBatchConfig(prev => ({
            ...prev,
            floor: prev.floor + 1,
            startNumber: (prev.floor + 1) * 100 + 1,
            endNumber: (prev.floor + 1) * 100 + 10
        }));
        
        haptic('success');
    };

    const handleDeleteFloor = (floor: number) => {
        onChange(rooms.filter(r => r.floor !== floor));
        haptic('medium');
    };

    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                    <DoorOpen className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                    إضافة الغرف بالدُفعات
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
                    أضف طابق كامل دفعة واحدة
                </p>
            </div>

            {/* Batch Entry Form */}
            <div 
                className="p-4 rounded-xl"
                style={{ 
                    background: 'var(--theme-bg-secondary)',
                    border: '1px solid var(--theme-border-primary)'
                }}
            >
                <h4 className="font-medium mb-4 flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    إضافة سريعة
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {/* Floor */}
                    <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>الطابق</label>
                        <input
                            type="number"
                            value={batchConfig.floor}
                            onChange={(e) => setBatchConfig(prev => ({ ...prev, floor: Number(e.target.value) }))}
                            min={1}
                            className="w-full px-3 py-2 rounded-lg border text-center"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: 'var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        />
                    </div>

                    {/* Start Number */}
                    <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>من غرفة</label>
                        <input
                            type="number"
                            value={batchConfig.startNumber}
                            onChange={(e) => setBatchConfig(prev => ({ ...prev, startNumber: Number(e.target.value) }))}
                            className="w-full px-3 py-2 rounded-lg border text-center"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: 'var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        />
                    </div>

                    {/* End Number */}
                    <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>إلى غرفة</label>
                        <input
                            type="number"
                            value={batchConfig.endNumber}
                            onChange={(e) => setBatchConfig(prev => ({ ...prev, endNumber: Number(e.target.value) }))}
                            className="w-full px-3 py-2 rounded-lg border text-center"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: 'var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        />
                    </div>

                    {/* Type */}
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>النوع</label>
                        {showCustomType ? (
                            <input
                                type="text"
                                value={batchConfig.customType}
                                onChange={(e) => setBatchConfig(prev => ({ ...prev, customType: e.target.value }))}
                                placeholder="نوع مخصص"
                                className="w-full px-3 py-2 rounded-lg border"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)'
                                }}
                            />
                        ) : (
                            <select
                                value={batchConfig.type}
                                onChange={(e) => {
                                    if (e.target.value === '_custom_') {
                                        setShowCustomType(true);
                                    } else {
                                        setBatchConfig(prev => ({ ...prev, type: e.target.value }));
                                    }
                                }}
                                className="w-full px-3 py-2 rounded-lg border"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)'
                                }}
                            >
                                {PRESET_ROOM_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                                <option value="_custom_">+ نوع مخصص</option>
                            </select>
                        )}
                    </div>

                    {/* Add Button */}
                    <div className="col-span-2 sm:col-span-1 flex items-end">
                        <button
                            onClick={handleAddBatch}
                            className="w-full px-4 py-2 rounded-lg font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                            style={{ background: 'linear-gradient(135deg, var(--theme-primary-500), var(--theme-primary-600))' }}
                        >
                            <Plus className="w-4 h-4 inline ml-1" />
                            إضافة
                        </button>
                    </div>
                </div>

                {showCustomType && (
                    <button
                        onClick={() => {
                            setShowCustomType(false);
                            setBatchConfig(prev => ({ ...prev, customType: '' }));
                        }}
                        className="mt-2 text-xs text-teal-500 hover:underline"
                    >
                        العودة للقائمة
                    </button>
                )}
            </div>

            {/* Rooms Display */}
            {rooms.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                            الغرف المضافة ({rooms.length})
                        </h4>
                        <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                            اضغط على الغرفة للتعديل ✏️
                        </p>
                    </div>

                    {Array.from(roomsByFloor.entries()).sort((a, b) => a[0] - b[0]).map(([floor, floorRooms]) => (
                        <div 
                            key={floor}
                            className="p-4 rounded-xl"
                            style={{ 
                                background: 'var(--theme-bg-secondary)',
                                border: '1px solid var(--theme-border-primary)'
                            }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h5 className="font-medium flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
                                    <Home className="w-4 h-4" />
                                    الطابق {floor}
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600">
                                        {floorRooms.length} غرفة
                                    </span>
                                </h5>
                                <button
                                    onClick={() => handleDeleteFloor(floor)}
                                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    حذف الطابق
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {floorRooms.sort((a, b) => Number(a.number) - Number(b.number)).map(room => (
                                    <button
                                        key={room.number}
                                        onClick={() => onEditRoom(room)}
                                        className="px-3 py-2 rounded-lg text-sm transition-all hover:scale-105 hover:shadow-md"
                                        style={{ 
                                            background: 'var(--theme-bg-tertiary)',
                                            border: '1px solid var(--theme-border-primary)',
                                            color: 'var(--theme-text-primary)'
                                        }}
                                    >
                                        <div className="font-bold">{room.number}</div>
                                        <div className="text-xs opacity-60">{room.type}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {rooms.length === 0 && (
                <div className="text-center py-12">
                    <DoorOpen className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--theme-text-primary)' }} />
                    <p style={{ color: 'var(--theme-text-secondary)' }}>لم تتم إضافة أي غرف بعد</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--theme-text-tertiary)' }}>
                        استخدم النموذج أعلاه لإضافة الغرف بالدُفعات
                    </p>
                </div>
            )}
        </div>
    );
};

// ============================================================
// STEP 3: PRICING (FROM EXTRACTED TYPES)
// ============================================================

const Step3Pricing: React.FC<{
    roomTypes: RoomTypeConfig[];
    onChange: (typeName: string, updates: Partial<RoomTypeConfig>) => void;
}> = ({ roomTypes, onChange }) => {
    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                    <Banknote className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                    تسعير أنواع الغرف
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
                    حدد الأسعار والاستيعاب لكل نوع من الغرف المُضافة
                </p>
            </div>

            <div className="space-y-4">
                {roomTypes.map((roomType) => (
                    <div 
                        key={roomType.name}
                        className="p-4 rounded-xl"
                        style={{ 
                            background: 'var(--theme-bg-secondary)',
                            border: '1px solid var(--theme-border-primary)'
                        }}
                    >
                        {/* Type Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                                    <BedDouble className="w-5 h-5 text-teal-500" />
                                </div>
                                <div>
                                    <h4 className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {roomType.name}
                                    </h4>
                                    <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                                        {roomType.count} غرفة
                                    </p>
                                </div>
                            </div>
                            {roomType.basePrice > 0 && (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            )}
                        </div>

                        {/* Pricing Form */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {/* Base Price */}
                            <div>
                                <label className="block text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Banknote className="w-3 h-3" />
                                    السعر الأساسي
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={roomType.basePrice || ''}
                                        onChange={(e) => onChange(roomType.name, { basePrice: Number(e.target.value) })}
                                        placeholder="0"
                                        className="w-full px-3 py-2 rounded-lg border text-center"
                                        style={{
                                            background: 'var(--theme-bg-tertiary)',
                                            borderColor: 'var(--theme-border-primary)',
                                            color: 'var(--theme-text-primary)'
                                        }}
                                    />
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                        ر.س
                                    </span>
                                </div>
                            </div>

                            {/* Season Price */}
                            <div>
                                <label className="block text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Calendar className="w-3 h-3" />
                                    سعر الموسم
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={roomType.seasonPrice || ''}
                                        onChange={(e) => onChange(roomType.name, { seasonPrice: Number(e.target.value) })}
                                        placeholder="0"
                                        className="w-full px-3 py-2 rounded-lg border text-center"
                                        style={{
                                            background: 'var(--theme-bg-tertiary)',
                                            borderColor: 'var(--theme-border-primary)',
                                            color: 'var(--theme-text-primary)'
                                        }}
                                    />
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                        ر.س
                                    </span>
                                </div>
                            </div>

                            {/* Occupancy */}
                            <div>
                                <label className="block text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <User className="w-3 h-3" />
                                    بالغين
                                </label>
                                <select
                                    value={roomType.adults}
                                    onChange={(e) => onChange(roomType.name, { adults: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-lg border"
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        borderColor: 'var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)'
                                    }}
                                >
                                    {[1, 2, 3, 4, 5, 6].map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Children */}
                            <div>
                                <label className="block text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Baby className="w-3 h-3" />
                                    أطفال
                                </label>
                                <select
                                    value={roomType.children}
                                    onChange={(e) => onChange(roomType.name, { children: Number(e.target.value) })}
                                    className="w-full px-3 py-2 rounded-lg border"
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        borderColor: 'var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)'
                                    }}
                                >
                                    {[0, 1, 2, 3, 4].map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Booking Rate */}
                        <div className="mt-3">
                            <label className="block text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                <Percent className="w-3 h-3" />
                                نسبة البوكينج %
                            </label>
                            <input
                                type="range"
                                min="5"
                                max="50"
                                value={roomType.bookingRate}
                                onChange={(e) => onChange(roomType.name, { bookingRate: Number(e.target.value) })}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                <span>5%</span>
                                <span className="font-bold text-teal-500">{roomType.bookingRate}%</span>
                                <span>50%</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {roomTypes.length === 0 && (
                <div className="text-center py-12">
                    <Layers className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--theme-text-primary)' }} />
                    <p style={{ color: 'var(--theme-text-secondary)' }}>لا توجد أنواع غرف</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--theme-text-tertiary)' }}>
                        أضف غرف في الخطوة السابقة أولاً
                    </p>
                </div>
            )}
        </div>
    );
};

// ============================================================
// STEP 4: EMPLOYEES (OPTIONAL)
// ============================================================

const Step4Employees: React.FC<{
    employees: EmployeeEntry[];
    onChange: (employees: EmployeeEntry[]) => void;
}> = ({ employees, onChange }) => {
    const [newEmployee, setNewEmployee] = useState<EmployeeEntry>({
        name: '',
        code: generateEmployeeCode(),
        department: 'reception',
        role: 'employee'
    });

    const handleAdd = () => {
        if (!newEmployee.name) return;
        
        onChange([...employees, newEmployee]);
        setNewEmployee({
            name: '',
            code: generateEmployeeCode(),
            department: 'reception',
            role: 'employee'
        });
        
        haptic('success');
    };

    const handleRemove = (index: number) => {
        onChange(employees.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <Users className="w-10 h-10 text-purple-500" />
                </div>
                <h3 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                    إضافة الموظفين
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
                    يمكنك إضافة الموظفين الآن أو لاحقاً من لوحة التحكم
                </p>
            </div>

            {/* Add Employee Form */}
            <div 
                className="p-4 rounded-xl"
                style={{ 
                    background: 'var(--theme-bg-secondary)',
                    border: '1px solid var(--theme-border-primary)'
                }}
            >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {/* Name */}
                    <div className="sm:col-span-2">
                        <label className="block text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                            اسم الموظف
                        </label>
                        <input
                            type="text"
                            value={newEmployee.name}
                            onChange={(e) => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="أدخل اسم الموظف"
                            className="w-full px-4 py-2 rounded-lg border"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: 'var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        />
                    </div>

                    {/* Code */}
                    <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                            الكود
                        </label>
                        <input
                            type="text"
                            value={newEmployee.code}
                            onChange={(e) => setNewEmployee(prev => ({ ...prev, code: e.target.value }))}
                            className="w-full px-4 py-2 rounded-lg border text-center"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: 'var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        />
                    </div>

                    {/* Department */}
                    <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                            القسم
                        </label>
                        <select
                            value={newEmployee.department}
                            onChange={(e) => setNewEmployee(prev => ({ ...prev, department: e.target.value }))}
                            className="w-full px-4 py-2 rounded-lg border"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                borderColor: 'var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        >
                            {DEPARTMENTS.map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleAdd}
                    disabled={!newEmployee.name}
                    className={`
                        w-full mt-3 px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2
                        ${!newEmployee.name 
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' 
                            : 'text-white hover:scale-[1.02] active:scale-[0.98]'}
                    `}
                    style={newEmployee.name ? { background: 'linear-gradient(135deg, var(--theme-primary-500), var(--theme-primary-600))' } : {}}
                >
                    <Plus className="w-4 h-4" />
                    إضافة موظف
                </button>
            </div>

            {/* Employees List */}
            {employees.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                        الموظفين المضافين ({employees.length})
                    </h4>
                    {employees.map((emp, index) => (
                        <div 
                            key={index}
                            className="p-3 rounded-lg flex items-center justify-between"
                            style={{ 
                                background: 'var(--theme-bg-secondary)',
                                border: '1px solid var(--theme-border-primary)'
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <User className="w-5 h-5 text-purple-500" />
                                </div>
                                <div>
                                    <div className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                        {emp.name}
                                    </div>
                                    <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                                        {DEPARTMENTS.find(d => d.id === emp.department)?.name} • كود: {emp.code}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleRemove(index)}
                                className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 flex items-center justify-center"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="text-center p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                    💡 يمكنك تخطي هذه الخطوة وإضافة الموظفين لاحقاً من إعدادات الفرع
                </p>
            </div>
        </div>
    );
};

// ============================================================
// STEP 5: SUMMARY
// ============================================================

const Step5Summary: React.FC<{
    state: WizardState;
}> = ({ state }) => {
    const totalRooms = state.rooms.length;
    const typesCount = new Set(state.rooms.map(r => r.type)).size;
    const floorsCount = new Set(state.rooms.map(r => r.floor)).size;
    const avgPrice = state.roomTypes.length > 0 
        ? Math.round(state.roomTypes.reduce((sum, rt) => sum + rt.basePrice, 0) / state.roomTypes.length)
        : 0;

    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                    جاهز للتفعيل! 🎉
                </h3>
                <p className="text-sm mt-2" style={{ color: 'var(--theme-text-secondary)' }}>
                    راجع البيانات ثم اضغط على "تفعيل الفرع وبدء العمل"
                </p>
            </div>

            {/* Summary Card */}
            <div 
                className="p-6 rounded-2xl"
                style={{ 
                    background: 'var(--theme-bg-secondary)',
                    border: '1px solid var(--theme-border-primary)'
                }}
            >
                <div className="flex items-center gap-4 mb-6 pb-4" style={{ borderBottom: '1px solid var(--theme-border-primary)' }}>
                    <div className="w-14 h-14 rounded-xl bg-teal-500/10 flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-teal-500" />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                            {state.branchData.name}
                        </h4>
                        <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                            {state.branchData.location || 'بدون موقع محدد'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {/* Rooms */}
                    <div className="text-center p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                        <DoorOpen className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                        <div className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                            {totalRooms}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>غرفة</div>
                    </div>

                    {/* Types */}
                    <div className="text-center p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                        <Layers className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                        <div className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                            {typesCount}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>نوع</div>
                    </div>

                    {/* Floors */}
                    <div className="text-center p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                        <Home className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                        <div className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                            {floorsCount}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>طابق</div>
                    </div>

                    {/* Employees */}
                    <div className="text-center p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                        <Users className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <div className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                            {state.employees.length}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>موظف</div>
                    </div>
                </div>

                {/* Average Price */}
                {avgPrice > 0 && (
                    <div className="mt-4 p-4 rounded-xl text-center" style={{ background: 'linear-gradient(135deg, var(--theme-primary-500), var(--theme-primary-600))' }}>
                        <div className="text-white/70 text-sm">متوسط سعر الغرفة</div>
                        <div className="text-3xl font-bold text-white">{avgPrice} ر.س</div>
                    </div>
                )}
            </div>

            {/* Info Note */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                <p className="text-sm text-blue-700 dark:text-blue-400 text-center">
                    ℹ️ يمكنك تعديل جميع الإعدادات لاحقاً من لوحة التحكم
                </p>
            </div>
        </div>
    );
};

// ============================================================
// ROOM EDIT MODAL
// ============================================================

const RoomEditModal: React.FC<{
    room: RoomEntry;
    onSave: (room: RoomEntry) => void;
    onDelete: () => void;
    onClose: () => void;
}> = ({ room, onSave, onDelete, onClose }) => {
    const [editedRoom, setEditedRoom] = useState<RoomEntry>(room);
    const [showCustomType, setShowCustomType] = useState(!PRESET_ROOM_TYPES.includes(room.type));

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div 
                className="w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95"
                style={{ background: 'var(--theme-bg-primary)' }}
            >
                {/* Header */}
                <div 
                    className="p-4 flex items-center justify-between"
                    style={{ 
                        background: 'linear-gradient(135deg, var(--theme-primary-500), var(--theme-primary-600))'
                    }}
                >
                    <div className="flex items-center gap-3">
                        <Edit2 className="w-5 h-5 text-white" />
                        <span className="font-bold text-white">تعديل الغرفة {room.number}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        {/* Room Number */}
                        <div>
                            <label className="block text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                رقم الغرفة
                            </label>
                            <input
                                type="text"
                                value={editedRoom.number}
                                onChange={(e) => setEditedRoom(prev => ({ ...prev, number: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)'
                                }}
                            />
                        </div>

                        {/* Floor */}
                        <div>
                            <label className="block text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                الطابق
                            </label>
                            <input
                                type="number"
                                value={editedRoom.floor}
                                onChange={(e) => setEditedRoom(prev => ({ ...prev, floor: Number(e.target.value) }))}
                                min={1}
                                className="w-full px-3 py-2 rounded-lg border"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)'
                                }}
                            />
                        </div>
                    </div>

                    {/* Type */}
                    <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                            نوع الغرفة
                        </label>
                        {showCustomType ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={editedRoom.type}
                                    onChange={(e) => setEditedRoom(prev => ({ ...prev, type: e.target.value }))}
                                    className="flex-1 px-3 py-2 rounded-lg border"
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        borderColor: 'var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)'
                                    }}
                                />
                                <button
                                    onClick={() => setShowCustomType(false)}
                                    className="px-3 py-2 text-xs text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg"
                                >
                                    القائمة
                                </button>
                            </div>
                        ) : (
                            <select
                                value={editedRoom.type}
                                onChange={(e) => {
                                    if (e.target.value === '_custom_') {
                                        setShowCustomType(true);
                                    } else {
                                        setEditedRoom(prev => ({ ...prev, type: e.target.value }));
                                    }
                                }}
                                className="w-full px-3 py-2 rounded-lg border"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)'
                                }}
                            >
                                {PRESET_ROOM_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                                <option value="_custom_">+ نوع مخصص</option>
                            </select>
                        )}
                    </div>

                    {/* Occupancy */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                <User className="w-3 h-3" /> بالغين
                            </label>
                            <select
                                value={editedRoom.adults}
                                onChange={(e) => setEditedRoom(prev => ({ ...prev, adults: Number(e.target.value) }))}
                                className="w-full px-3 py-2 rounded-lg border"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)'
                                }}
                            >
                                {[1, 2, 3, 4, 5, 6].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                <Baby className="w-3 h-3" /> أطفال
                            </label>
                            <select
                                value={editedRoom.children}
                                onChange={(e) => setEditedRoom(prev => ({ ...prev, children: Number(e.target.value) }))}
                                className="w-full px-3 py-2 rounded-lg border"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)'
                                }}
                            >
                                {[0, 1, 2, 3, 4].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 flex gap-3" style={{ borderTop: '1px solid var(--theme-border-primary)' }}>
                    <button
                        onClick={onDelete}
                        className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        حذف
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-lg font-medium transition-all"
                        style={{ 
                            background: 'var(--theme-bg-tertiary)',
                            color: 'var(--theme-text-secondary)'
                        }}
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={() => onSave(editedRoom)}
                        className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition-all hover:scale-[1.02]"
                        style={{ background: 'linear-gradient(135deg, var(--theme-primary-500), var(--theme-primary-600))' }}
                    >
                        <Save className="w-4 h-4 inline ml-2" />
                        حفظ
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SmartBranchSetupWizard;
