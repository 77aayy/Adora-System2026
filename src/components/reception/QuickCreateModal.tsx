/**
 * Quick Create Modal Component
 * Extracted from ReceptionDashboard for better code splitting
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    X, Send, AlertCircle, History, CheckCircle, Building2
} from 'lucide-react';
import { ServiceRequest } from '../../types/request';
import { db } from '../../services/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { FloorRoomSelector } from '../shared/FloorRoomSelector';
import { UnifiedRoomInput } from '../shared/UnifiedRoomInput';
import { haptic } from '../../utils/uxEffects';
import { getQuickActions } from '../../utils/quickActionsConfig';
import type { QuickAction } from '../../utils/quickActionsConfig';

interface QuickCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedType: ServiceRequest['type'] | null;
    onSubmit: (data: { 
        roomNumber: string; 
        type: string; 
        priority: 'normal' | 'urgent' | 'scheduled'; 
        notes: string; 
        needsCart?: boolean; 
        guestsInRoom?: boolean;
        scheduledAt?: Date;
        emergencyTargetDepartment?: string;
    }) => Promise<void> | void; // ✅ FIX: Support both sync and async
    rooms: { floor: number; rooms: string[] }[];
    requests: ServiceRequest[];
    serviceNames: Record<string, string>;
}

export const QuickCreateModal: React.FC<QuickCreateModalProps> = ({ 
    isOpen, 
    onClose, 
    selectedType, 
    onSubmit, 
    rooms, 
    requests, 
    serviceNames 
}) => {
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language;
    const [step, setStep] = useState<'room' | 'details'>('room');
    const [selectedRoom, setSelectedRoom] = useState('');
    const [priority, setPriority] = useState<'normal' | 'urgent' | 'scheduled'>('normal');
    const [notes, setNotes] = useState('');
    const [roomNumber, setRoomNumber] = useState('');
    // ✅ REMOVED: showFloorSelector, selectedFloor - now handled by UnifiedRoomInput
    const [needsCart, setNeedsCart] = useState(false);
    const [guestsInRoom, setGuestsInRoom] = useState(false);
    const [scheduledDateTime, setScheduledDateTime] = useState('');
    const [lastRequest, setLastRequest] = useState<{ type: string; date: string; time: string } | null>(null);
    const [emergencyTargetDepartment, setEmergencyTargetDepartment] = useState<string>('');
    const [previousEmergencyRequests, setPreviousEmergencyRequests] = useState<Array<{ description: string; date: string; department: string }>>([]);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false); // ✅ FIX: Prevent double-submission

    // ✅ Fetch Last Request Info (Debounced)
    useEffect(() => {
        if (!roomNumber || roomNumber.length < 3) {
            setLastRequest(null);
            setPreviousEmergencyRequests([]);
            return;
        }

        const fetchLastRequest = async () => {
            try {
                const q = query(
                    collection(db, 'requests'),
                    where('roomNumber', '==', roomNumber),
                    orderBy('createdAt', 'desc'),
                    limit(1)
                );

                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const data = snapshot.docs[0].data();
                    if (data.createdAt) {
                        const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                        const locale = currentLanguage === 'ar' ? 'ar-EG' : currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'bn' ? 'bn-BD' : 'en-US';
                        setLastRequest({
                            type: serviceNames[data.type] || data.type,
                            date: date.toLocaleDateString(locale),
                            time: date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
                        });
                    }
                } else {
                    setLastRequest(null);
                }

                if (selectedType === 'other') {
                    const emergencyQuery = query(
                        collection(db, 'requests'),
                        where('roomNumber', '==', roomNumber),
                        where('isEmergency', '==', true),
                        orderBy('createdAt', 'desc'),
                        limit(5)
                    );
                    
                    try {
                        const emergencySnapshot = await getDocs(emergencyQuery);
                        const previous: Array<{ description: string; date: string; department: string }> = [];
                        emergencySnapshot.forEach(doc => {
                            const data = doc.data();
                            if (data.createdAt && data.status !== 'COMPLETED') {
                                const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                                previous.push({
                                    description: data.notes || t('reception.noDescriptionFallback'),
                                    date: date.toLocaleDateString(currentLanguage === 'ar' ? 'ar-EG' : currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'bn' ? 'bn-BD' : 'en-US') + ' ' + date.toLocaleTimeString(currentLanguage === 'ar' ? 'ar-EG' : currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
                                    department: data.emergencyTargetDepartment || t('reception.departmentNotSpecified')
                                });
                            }
                        });
                        setPreviousEmergencyRequests(previous);
                    } catch (err) {
                        setPreviousEmergencyRequests([]);
                    }
                } else {
                    setPreviousEmergencyRequests([]);
                }
            } catch (error) {
                console.error('Error fetching last request:', error);
                setLastRequest(null);
                setPreviousEmergencyRequests([]);
            }
        };

        const timer = setTimeout(fetchLastRequest, 500);
        return () => clearTimeout(timer);
    }, [roomNumber, selectedType, serviceNames, t, currentLanguage]);

    // ✅ Calculate Blocked Rooms (Real-time)
    const activeStats = useMemo(() => {
        if (!selectedType) return { blockedRooms: [], activeRequest: null };

        const activeReqs = requests.filter(r =>
            r.status === 'CONFIRMED' || r.status === 'IN_PROGRESS' || r.status === 'NEEDS_INSPECTION' || r.status === 'SCHEDULED' || r.status === 'PENDING'
        );

        const currentActiveInfo = roomNumber
            ? activeReqs.find(r => r.roomNumber === roomNumber && r.type === selectedType)
            : null;

        const blocked: string[] = [];
        const roomCounts: Record<string, { total: number, coffee: number, sameType: number }> = {};

        activeReqs.forEach(r => {
            if (!r.roomNumber) return;
            if (!roomCounts[r.roomNumber]) roomCounts[r.roomNumber] = { total: 0, coffee: 0, sameType: 0 };

            roomCounts[r.roomNumber].total++;
            if (r.type === 'coffee') roomCounts[r.roomNumber].coffee++;
            if (r.type === selectedType) roomCounts[r.roomNumber].sameType++;
        });

        Object.keys(roomCounts).forEach(room => {
            const stats = roomCounts[room];
            if (selectedType === 'coffee') {
                if (stats.coffee >= 5) blocked.push(room);
            } else {
                if (stats.sameType > 0) blocked.push(room);
            }
        });

        return { blockedRooms: blocked, activeRequest: currentActiveInfo };
    }, [requests, selectedType, roomNumber]);

    useEffect(() => {
        if (isOpen) {
            setStep('room');
            setSelectedRoom('');
            setRoomNumber('');
            setPriority('normal');
            setNotes('');
            // ✅ REMOVED: setSelectedFloor - now handled by UnifiedRoomInput
            setNeedsCart(selectedType === 'bellman');
            setGuestsInRoom(false);
            setScheduledDateTime('');
            setEmergencyTargetDepartment(selectedType === 'other' ? '' : '');
            setPreviousEmergencyRequests([]);
            setValidationError(null);
        }
    }, [isOpen, rooms, selectedType]);

    const handleRoomSelect = (room: string) => {
        // ✅ SECURITY: Validate that room exists in branch (MANDATORY - same logic as Bellman)
        const allRooms = rooms?.flatMap(f => f.rooms || []) || [];
        
        // ✅ CRITICAL: Must validate if rooms are loaded
        if (rooms && rooms.length > 0) {
            if (allRooms.length === 0) {
                // Rooms structure exists but no rooms in it
                setValidationError(t('reception.noRoomsInBranch') || 'لا توجد غرف في هذا الفرع. يرجى إضافة غرف أولاً.');
                haptic('error');
                return;
            }
            
            if (!allRooms.includes(room)) {
                setValidationError(t('reception.roomNotFoundInBranch', { room }) || `الغرفة رقم ${room} غير موجودة في هذا الفرع`);
                haptic('error');
                return;
            }
        } else {
            // Rooms not loaded yet - show warning but allow (will be validated on submit)
            console.warn('Rooms not loaded yet, allowing selection but will validate on submit');
        }
        
        setValidationError(null);
        setSelectedRoom(room);
        setStep('details');
        haptic('light');
    };

    const handleSubmit = async () => {
        if (!selectedRoom || !selectedType) return;
        
        // ✅ FIX: Prevent double-submission
        if (isSubmitting) {
            console.warn('⚠️ Request submission already in progress, ignoring duplicate click');
            return;
        }

        // ✅ SECURITY: MANDATORY validation - room MUST exist in branch before submitting
        const allRooms = rooms?.flatMap(f => f.rooms || []) || [];
        
        // ✅ CRITICAL: Must validate if rooms are loaded
        if (rooms && rooms.length > 0) {
            if (allRooms.length === 0) {
                setValidationError(t('reception.noRoomsInBranch') || 'لا توجد غرف في هذا الفرع. يرجى إضافة غرف أولاً.');
                haptic('error');
                setStep('room');
                return;
            }
            
            if (!allRooms.includes(selectedRoom)) {
                setValidationError(t('reception.roomNotFoundInBranch', { room: selectedRoom }) || `الغرفة رقم ${selectedRoom} غير موجودة في هذا الفرع. يرجى إدخال رقم غرفة صحيح.`);
                haptic('error');
                setStep('room');
                return;
            }
        } else {
            // Rooms not loaded - show error and prevent submission
            setValidationError(t('reception.roomsNotLoaded') || 'لم يتم تحميل بيانات الغرف بعد. يرجى الانتظار...');
            haptic('error');
            setStep('room');
            return;
        }

        // ✅ NEW: Check if room has active request of the SAME TYPE (prevent duplicates)
        if (activeStats.activeRequest) {
            const activeReq = activeStats.activeRequest;
            const requestTypeName = serviceNames[selectedType] || selectedType;
            setValidationError(
                t('reception.duplicateRequestSameType', { 
                    room: selectedRoom, 
                    type: requestTypeName 
                }) || 
                `يوجد طلب ${requestTypeName} نشط بالفعل للغرفة ${selectedRoom}. لا يمكن رفع طلب آخر من نفس النوع.`
            );
            haptic('error');
            setStep('room');
            return;
        }

        if (selectedType === 'maintenance' && !notes.trim()) {
            setValidationError(t('reception.pleaseEnterProblemDetails'));
            haptic('error');
            return;
        }

        if (selectedType === 'other') {
            if (!notes.trim()) {
                setValidationError(t('reception.pleaseEnterRequestDescription'));
                haptic('error');
                return;
            }
            if (!emergencyTargetDepartment) {
                setValidationError(t('reception.pleaseSelectTargetDepartment'));
                haptic('error');
                return;
            }
        }
        
        setValidationError(null);
        
        // ✅ FIX: Set submitting state to prevent double-click
        setIsSubmitting(true);

        let scheduledAt: Date | undefined;
        if (priority === 'scheduled' && scheduledDateTime) {
            scheduledAt = new Date(scheduledDateTime);
        }
        
        // ✅ FIX: Set submitting state immediately to prevent double-click
        setIsSubmitting(true);
        
        try {
            const result = onSubmit({
                roomNumber: selectedRoom,
                type: selectedType,
                priority: priority as any,
                notes,
                needsCart,
                guestsInRoom,
                scheduledAt,
                emergencyTargetDepartment: selectedType === 'other' ? emergencyTargetDepartment : undefined
            } as any);
            
            // ✅ FIX: Handle both sync and async onSubmit
            if (result instanceof Promise) {
                await result;
            }
            
            // Reset state after successful submission (modal will close)
            setIsSubmitting(false);
            onClose();
        } catch (error) {
            // Reset submitting state on error
            setIsSubmitting(false);
            throw error;
        }
    };

    const QUICK_ACTIONS_LOCAL: QuickAction[] = useMemo(() => getQuickActions(t), [t]);

    // ✅ UX: Smooth fade-in animation
    const [isVisible, setIsVisible] = React.useState(false);
    
    React.useEffect(() => {
        if (isOpen && selectedType) {
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
        }
    }, [isOpen, selectedType]);

    if (!isOpen || !selectedType) return null;

    const action = QUICK_ACTIONS_LOCAL.find(a => a.type === selectedType);

    return (
        <div 
            className={`pro-modal-backdrop flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-300 ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
        >
            <div 
                className={`pro-modal w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-hidden transition-all duration-300 ${
                    isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
                }`}
            >
                {/* Header */}
                <div className="pro-modal-header">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${action?.bgColor} flex items-center justify-center`}>
                            {action?.icon && <action.icon className="w-6 h-6" />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">{t('reception.createRequestTitle')} {action?.label}</h3>
                            <p className="text-sm text-white/50">
                                {step === 'room' ? t('reception.selectRoom') : t('reception.roomNumber', { room: selectedRoom })}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {step === 'room' ? (
                        <div className="space-y-3">
                            {activeStats.activeRequest && selectedType !== 'coffee' && (
                                <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 shadow-lg shadow-orange-500/5">
                                        <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                                        <span className="text-xs text-orange-300 font-medium">
                                            {t('reception.activeRequest', { type: serviceNames[activeStats.activeRequest.type] || t('common.status') })}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {!activeStats.activeRequest && lastRequest && (
                                <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/5">
                                        <History className="w-3.5 h-3.5 text-blue-400" />
                                        <div className="text-xs text-blue-300 font-medium flex gap-1">
                                            <span>{t('reception.lastRequestLabel')} {lastRequest.type}</span>
                                            <span className="opacity-60">|</span>
                                            <span>{lastRequest.date}</span>
                                            <span className="opacity-60">|</span>
                                            <span>{lastRequest.time}</span>
                                        </div>
                                    </div>
                                </div>
                            )}


                            {/* ✅ UNIFIED: Use UnifiedRoomInput component for consistent UX */}
                            <UnifiedRoomInput
                                value={roomNumber}
                                onChange={(newRoom) => {
                                    setRoomNumber(newRoom);
                                    setValidationError(null); // Clear error when room changes
                                }}
                                onConfirm={(confirmedRoom) => {
                                    // ✅ Validate room exists in branch
                                    const allRooms = rooms?.flatMap(f => f.rooms || []) || [];
                                    if (rooms && rooms.length > 0 && allRooms.length > 0 && !allRooms.includes(confirmedRoom)) {
                                        setValidationError(
                                            t('reception.roomNotFoundInBranch', { room: confirmedRoom }) || 
                                            `الغرفة رقم ${confirmedRoom} غير موجودة في هذا الفرع. يرجى إدخال رقم غرفة صحيح.`
                                        );
                                        haptic('error');
                                        return;
                                    }
                                    
                                    // ✅ Check if room has active request of the SAME TYPE
                                    const activeReqs = requests.filter(r =>
                                        (r.status === 'CONFIRMED' || r.status === 'IN_PROGRESS' || r.status === 'NEEDS_INSPECTION' || r.status === 'SCHEDULED' || r.status === 'PENDING') &&
                                        r.roomNumber === confirmedRoom &&
                                        r.type === selectedType
                                    );
                                    
                                    if (activeReqs.length > 0) {
                                        const requestTypeName = serviceNames[selectedType] || selectedType;
                                        setValidationError(
                                            t('reception.duplicateRequestSameType', { 
                                                room: confirmedRoom, 
                                                type: requestTypeName 
                                            }) || 
                                            `يوجد طلب ${requestTypeName} نشط بالفعل للغرفة ${confirmedRoom}. لا يمكن رفع طلب آخر من نفس النوع.`
                                        );
                                        haptic('error');
                                        return;
                                    }
                                    
                                    // Room is valid, proceed to details step
                                    setSelectedRoom(confirmedRoom);
                                    setStep('details');
                                    haptic('light');
                                }}
                                availableRooms={rooms?.flatMap(f => f.rooms || []) || []}
                                blockedRooms={activeStats.blockedRooms}
                                showFloorSelector={true}
                                showConfirmButton={true}
                                placeholder={t('reception.enterRoomNumber')}
                                error={validationError}
                                autoConfirmOnEnter={true}
                                validateRoom={(room) => {
                                    const allRooms = rooms?.flatMap(f => f.rooms || []) || [];
                                    if (rooms && rooms.length > 0 && allRooms.length > 0 && !allRooms.includes(room)) {
                                        return {
                                            valid: false,
                                            message: t('reception.roomNotFoundInBranch', { room }) || `Room ${room} does not exist in this branch.`
                                        };
                                    }
                                    
                                    // ✅ Check if room has active request of the SAME TYPE
                                    const activeReqs = requests.filter(r =>
                                        (r.status === 'CONFIRMED' || r.status === 'IN_PROGRESS' || r.status === 'NEEDS_INSPECTION' || r.status === 'SCHEDULED' || r.status === 'PENDING') &&
                                        r.roomNumber === room &&
                                        r.type === selectedType
                                    );
                                    
                                    if (activeReqs.length > 0) {
                                        const requestTypeName = serviceNames[selectedType] || selectedType;
                                        return {
                                            valid: false,
                                            message: t('reception.duplicateRequestSameType', { 
                                                room, 
                                                type: requestTypeName 
                                            }) || 
                                            `يوجد طلب ${requestTypeName} نشط بالفعل للغرفة ${room}. لا يمكن رفع طلب آخر من نفس النوع.`
                                        };
                                    }
                                    
                                    return { valid: true };
                                }}
                                className="mt-4"
                            />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-white/60 mb-2">{t('reception.priorityLabel')}</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPriority('normal')}
                                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${priority === 'normal'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                                            }`}
                                    >
                                        {t('reception.priority.normal')}
                                    </button>
                                    <button
                                        onClick={() => setPriority('urgent')}
                                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${priority === 'urgent'
                                            ? 'bg-red-500 text-white'
                                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                                            }`}
                                    >
                                        🔥 {t('reception.priority.urgent')}
                                    </button>
                                    <button
                                        onClick={() => setPriority('scheduled')}
                                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${priority === 'scheduled'
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                                            }`}
                                    >
                                        📅 {t('reception.priority.scheduled')}
                                    </button>
                                </div>
                            </div>

                            {priority === 'scheduled' && (
                                <div className="space-y-2">
                                    <label className="block text-sm text-white/60">{t('reception.scheduledTime.after')}</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { label: t('reception.scheduledTime.minutes30'), minutes: 30 },
                                            { label: t('reception.scheduledTime.hour1'), minutes: 60 },
                                            { label: t('reception.scheduledTime.hours2'), minutes: 120 },
                                            { label: t('reception.scheduledTime.hours3'), minutes: 180 },
                                            { label: t('reception.scheduledTime.hours4'), minutes: 240 },
                                            { label: t('reception.scheduledTime.hours5'), minutes: 300 },
                                        ].map(opt => {
                                            const targetTime = new Date(Date.now() + opt.minutes * 60000);
                                            const value = targetTime.toISOString().slice(0, 16);
                                            return (
                                                <button
                                                    key={opt.label}
                                                    type="button"
                                                    onClick={() => setScheduledDateTime(value)}
                                                    className={`py-2 rounded-lg text-sm font-medium transition-all ${scheduledDateTime === value
                                                        ? 'bg-primary-500 text-white'
                                                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                                                        }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {scheduledDateTime && (
                                        <div className="text-center text-sm text-primary-400 py-2 bg-primary-500/10 rounded-lg">
                                            {(() => {
                                                const locale = currentLanguage === 'ar' ? 'ar-SA' : currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'bn' ? 'bn-BD' : 'en-US';
                                                return new Date(scheduledDateTime).toLocaleString(locale, {
                                                    weekday: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                });
                                            })()}
                                        </div>
                                    )}
                                    <input
                                        type="datetime-local"
                                        value={scheduledDateTime}
                                        onChange={(e) => setScheduledDateTime(e.target.value)}
                                        className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                    />
                                </div>
                            )}

                            <div className="flex gap-2">
                                {selectedType === 'bellman' && (
                                    <button
                                        type="button"
                                        onClick={() => setNeedsCart(!needsCart)}
                                        className={`flex-1 py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${needsCart
                                            ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400'
                                            : 'bg-white/10 border border-white/10 text-white/60 hover:bg-white/20'
                                            }`}
                                    >
                                        <span>🛒</span>
                                        <span className="text-sm font-medium">{t('bellman.cart')}</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setGuestsInRoom(!guestsInRoom)}
                                    className={`flex-1 py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${guestsInRoom
                                        ? 'bg-purple-500/20 border border-purple-500/50 text-purple-400'
                                        : 'bg-white/10 border border-white/10 text-white/60 hover:bg-white/20'
                                        }`}
                                >
                                    <span>👥</span>
                                    <span className="text-sm font-medium">{t('reception.guestsInRoomButton')}</span>
                                </button>
                            </div>

                            {selectedType === 'other' && (
                                <div>
                                    <label className="block text-sm text-white/60 mb-2">{t('reception.selectTargetDepartment')}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {useMemo(() => [
                                            { key: 'housekeeping', label: t('reception.housekeepingLabel'), icon: '🧹' },
                                            { key: 'maintenance', label: t('reception.maintenanceLabel'), icon: '🔧' },
                                            { key: 'bellman', label: t('reception.bellmanLabel'), icon: '🚪' },
                                            { key: 'coffee_shop', label: t('reception.coffeeshopLabel'), icon: '☕' },
                                            { key: 'procurement', label: t('reception.procurementLabel'), icon: '🛒' }
                                        ], [t]).map(dept => (
                                            <button
                                                key={dept.key}
                                                type="button"
                                                onClick={() => setEmergencyTargetDepartment(dept.key)}
                                                className={`py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${emergencyTargetDepartment === dept.key
                                                    ? 'bg-primary-500 text-white border-2 border-primary-400'
                                                    : 'bg-white/10 border border-white/10 text-white/60 hover:bg-white/20'
                                                    }`}
                                            >
                                                <span className="text-lg">{dept.icon}</span>
                                                <span className="text-sm font-medium">{dept.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedType === 'other' && previousEmergencyRequests.length > 0 && (
                                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle className="w-4 h-4 text-orange-400" />
                                        <p className="text-orange-300 text-xs font-bold">{t('reception.previousEmergencyRequests')}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        {previousEmergencyRequests.map((prev, idx) => (
                                            <div key={idx} className="text-xs text-orange-400/80 bg-orange-500/5 p-2 rounded-lg">
                                                <p className="font-medium">{prev.description}</p>
                                                <p className="text-orange-400/60">{prev.date} → {prev.department}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm text-white/60 mb-2">
                                    {selectedType === 'maintenance' ? t('reception.problemDescriptionRequired') : 
                                     selectedType === 'other' ? t('reception.requestDescriptionRequired') : 
                                     t('reception.notesOptional')}
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder={selectedType === 'other' ? t('reception.examplePlaceholder') : t('reception.anyAdditionalDetails')}
                                    className="w-full p-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none"
                                    rows={3}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10">
                    {step === 'room' ? (
                        <p className="text-center text-white/70 text-sm">{t('reception.clickRoomToContinue')}</p>
                    ) : (
                        <>
                            {validationError && (
                                <div className="mb-3 p-3 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center gap-2 text-red-300 animate-shake">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-sm">{validationError}</span>
                                    <button 
                                        onClick={() => setValidationError(null)} 
                                        className="mr-auto text-red-400 hover:text-red-200"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setStep('room')}
                                    className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all"
                                >
                                    {t('reception.backButton')}
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting} // ✅ FIX: Disable button during submission
                                    className={`flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold hover:shadow-lg hover:shadow-primary-500/25 transition-all flex items-center justify-center gap-2 ${
                                        isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                >
                                    <Send className="w-5 h-5" />
                                    {isSubmitting ? t('reception.creating') || 'جاري الإنشاء...' : t('reception.createRequestButton')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
