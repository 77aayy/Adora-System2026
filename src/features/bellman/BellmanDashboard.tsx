/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Modern Bellman Dashboard V2
 * Built from scratch with best UX practices
 * Adora Hotel Management System
 * 
 * Features:
 * - Guest check-in/check-out flow
 * - Luggage tracking
 * - Service requests handling
 * - Real-time room status
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    UserPlus, LogOut, Users, DoorOpen, Clock, Package,
    Star, MessageSquare, History, ShoppingCart,
    Bell, Check, CheckCircle2, CheckCircle, AlertCircle, Play, Search,
    MapPin, Phone, Truck, ChevronRight, X, Plus, Minus, Eye,
    QrCode, // ✅ QR icon for QR requests
    Smartphone, // ✅ Alternative QR icon
    BookOpen, // ✅ General instructions icon
    ArrowLeftRight, // ✅ Room transfer icon
    Headphones // ✅ Support ticket icon
} from 'lucide-react';
import { HeaderButton } from '../../components/common/HeaderButton';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useTranslation } from 'react-i18next';
import { haptic, playSound } from '../../utils/uxEffects';
import { db } from '../../services/firebase';
import {
    collection, query, where, onSnapshot, doc, updateDoc,
    addDoc, Timestamp, orderBy, getDocs, increment
} from 'firebase/firestore';

// Services
import { checkIn, checkOut, subscribeToActiveRoomCards } from '../../services/roomCardService';
import { subscribeToRooms } from '../../services/roomService'; // ✅ Added import
import * as ShiftNotesService from '../../services/shiftNotesService';

// Shared Components
import { ShiftNotes } from '../../components/shared/ShiftNotes';
import { PointsTracker } from '../../components/shared/PointsTracker';
import { ProcurementCartWizard } from '../../components/shared/ProcurementCartWizard';
import { TeamMembers } from '../../components/shared/TeamMembers';
import { FloorRoomSelector } from '../../components/shared/FloorRoomSelector';
import { UnifiedRoomInput } from '../../components/shared/UnifiedRoomInput';
// ✅ Room Transfer Components
import { RoomTransferModal } from '../../components/guest/RoomTransferModal';
import { TransferNotificationBadge } from '../../components/guest/TransferNotificationBadge';
import { UnifiedHistoryModal } from '../../components/shared/UnifiedHistoryModal';
import { PointsNotification } from '../../components/shared/PointsNotification';
import { GoldenAlertDisplay } from '../../components/shared/GoldenAlert';
import { BranchLocationWarning } from '../../components/auth/BranchLocationWarning';
import { checkBranchLocation } from '../../services/branchLocationService';
import { ManagerAnnouncementBanner } from '../../components/shared/ManagerAnnouncementBanner'; // ✅ Manager announcements banner
import { GeneralInstructionsView } from '../../components/shared/GeneralInstructionsView'; // ✅ General instructions view
import { SupportTicketModal } from '../../components/shared/SupportTicketModal'; // ✅ Support ticket modal
import { ReadReceipt } from '../../components/shared/ReadReceipt';
import { MobileMenu } from '../../components/common/MobileMenu';
import { StatCard } from '../../components/common/StatCard';
import { UnifiedRequestTabs } from '../../components/shared/UnifiedRequestTabs'; // ✅ Unified tabs
import { AdoraLoader } from '../../components/common/AdoraLoader';
import { awardPoints, awardPerformancePoints } from '../../services/pointsService';
import { markAsViewed } from '../../services/requestService';
import { useOnboardingTour } from '../../hooks/useOnboardingTour'; // ✅ Onboarding tour
import { TourGuide } from '../../components/shared/TourGuide'; // ✅ Tour guide component
// DeveloperSignature is now in GlobalFooter (App.tsx)
import { ChallengeTimeline } from '../../components/features/ChallengeTimeline';
import { useBrandName } from '../../hooks/useBrandName';

// Types
import { RoomCard } from '../../types';

// ============================================================
// TYPES
// ============================================================

interface BellmanRequest {
    id: string;
    type: 'bellman';
    status: 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED';
    roomNumber: string;
    guestName?: string;
    requestType?: 'luggage_up' | 'luggage_down' | 'cart' | 'escort';
    priority: 'normal' | 'urgent';
    needsCart?: boolean;
    notes?: string;
    createdAt: any;
    startedAt?: any;
    completedAt?: any;
    // Department tracking
    currentDepartment?: 'bellman' | 'reception';
}

interface LuggageItem {
    id: string;
    roomNumber: string;
    itemCount: number;
    description: string;
    location: 'lobby' | 'room' | 'storage' | 'vehicle';
    status: 'received' | 'stored' | 'delivered' | 'returned';
    receivedAt: any;
}

type TabType = 'new' | 'in_progress' | 'completed';

// ============================================================
// CONSTANTS
// ============================================================

// REQUEST_TYPE_LABELS and LOCATION_LABELS will be created inside component to use t()

// ============================================================
// HELPER COMPONENTS
// ============================================================

// Stat Card - MOVED TO: components/common/StatCard.tsx
// Using centralized version for consistency across dashboards

// Room Card Component
const RoomCardItem: React.FC<{
    room: RoomCard;
    onCheckout: () => void;
    onTransfer: () => void; // ✅ New prop for room transfer
}> = ({ room, onCheckout, onTransfer }) => {
    const stayDuration = useMemo(() => {
        if (!room.checkInTime) return '';
        const checkedIn = room.checkInTime instanceof Date ? room.checkInTime : (room.checkInTime as any).toDate ? (room.checkInTime as any).toDate() : new Date(room.checkInTime as any);
        const diff = Math.floor((Date.now() - checkedIn.getTime()) / (1000 * 60 * 60));
        if (diff < 24) return `${diff} ساعة`;
        return `${Math.floor(diff / 24)} يوم`;
    }, [room.checkInTime]);

    return (
        <div className="adora-card p-4 hover:scale-[1.02] transition-all">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--theme-accent-purple) 0%, var(--theme-accent-indigo) 100%)', opacity: 0.9 }}>
                        <span className="text-2xl font-bold text-white">{room.roomNumber}</span>
                    </div>
                    <div>
                        <p className="adora-text-primary font-medium">{room.guestName}</p>
                        <div className="flex items-center gap-2 adora-text-secondary text-sm">
                            <span>👨 {room.adults}</span>
                            {room.children > 0 && <span>👶 {room.children}</span>}
                            {room.needsCart && <span>🛒</span>}
                        </div>
                    </div>
                </div>
                <div className="text-left">
                    <p className="adora-text-tertiary text-sm">{stayDuration}</p>
                </div>
            </div>

            {room.notes && (
                <p className="adora-text-secondary text-sm mb-3 p-2 rounded-lg" style={{ background: 'var(--theme-bg-tertiary)' }}>
                    💬 {room.notes}
                </p>
            )}

            {/* ✅ Action Buttons Row */}
            <div className="flex gap-2">
                <button
                    onClick={onTransfer}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 font-medium flex items-center justify-center gap-2 hover:bg-amber-500/30 transition-all"
                >
                    <ArrowLeftRight className="w-4 h-4" />
                    نقل
                </button>
                <button
                    onClick={onCheckout}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-orange-500/25 transition-all"
                >
                    <LogOut className="w-5 h-5" />
                    خروج
                </button>
            </div>
        </div>
    );
};

// Check-in Modal with Occupancy Validation
const CheckinModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { 
        roomNumber: string; 
        guestName: string; 
        adults: number; 
        children: number; 
        needsCart: boolean; 
        notes: string; 
        assignedTo?: { id: string; name: string };
        exceededCapacity?: boolean; // ✅ Flag for capacity violation
        capacityLimit?: { adults: number; children: number }; // ✅ Admin limit
    }) => void;
    rooms: string[];
    receptionEmployees: any[];
    roomsCapacity: Map<string, { type: string; adults: number; children: number }>; // ✅ Room capacity data
    activeRoomCards: RoomCard[]; // ✅ Rooms with active cards (cannot check-in)
}> = ({ isOpen, onClose, onSubmit, rooms, receptionEmployees, roomsCapacity, activeRoomCards }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState<'room' | 'details'>('room');
    const [roomNumber, setRoomNumber] = useState('');
    const [guestName, setGuestName] = useState('');
    const [adults, setAdults] = useState(1);
    const [children, setChildren] = useState(0);
    const [notes, setNotes] = useState('');
    // ✅ REMOVED: showFloorSelector - now handled by UnifiedRoomInput
    const [selectedReceptionist, setSelectedReceptionist] = useState<{ id: string; name: string } | null>(null);

    // ✅ Get active room numbers (rooms with active cards)
    const activeRoomNumbers = useMemo(() => {
        return new Set(activeRoomCards.map(card => card.roomNumber));
    }, [activeRoomCards]);

    // ✅ Filter available rooms - remove rooms with active cards
    const availableRooms = useMemo(() => {
        return rooms.filter(room => !activeRoomNumbers.has(room));
    }, [rooms, activeRoomNumbers]);

    // ✅ Check if entered room has active card
    const roomHasActiveCard = useMemo(() => {
        return roomNumber ? activeRoomNumbers.has(roomNumber) : false;
    }, [roomNumber, activeRoomNumbers]);

    // ✅ Get room capacity for selected room
    const roomCapacity = useMemo(() => {
        if (!roomNumber) return null;
        return roomsCapacity.get(roomNumber);
    }, [roomNumber, roomsCapacity]);

    // ✅ Check if capacity is exceeded
    const capacityExceeded = useMemo(() => {
        if (!roomCapacity) return { exceeded: false, message: '' };
        
        const maxAdults = roomCapacity.adults || 2;
        const maxChildren = roomCapacity.children || 0;
        
        if (adults > maxAdults || children > maxChildren) {
            return {
                exceeded: true,
                message: t('bellman.capacityWarning', { type: roomCapacity.type, maxAdults, maxChildren })
            };
        }
        return { exceeded: false, message: '' };
    }, [roomCapacity, adults, children]);

    useEffect(() => {
        if (isOpen) {
            setStep('room');
            setRoomNumber('');
            setGuestName('');
            setAdults(1);
            setChildren(0);
            setNotes('');
            // ✅ REMOVED: setShowFloorSelector - now handled by UnifiedRoomInput
        }
    }, [isOpen]);

    const handleRoomSelect = (room: string) => {
        // ✅ SECURITY: Validate that room exists in branch (MANDATORY)
        if (!availableRooms.includes(room)) {
            // Room not in available rooms list
            haptic('error');
            error(t('reception.roomNotFoundInBranch', { room }) || `Room ${room} does not exist in this branch. Please select a room from the list.`);
            return; // Don't proceed
        }
        
        // ✅ Check if room has active card
        if (activeRoomNumbers.has(room)) {
            haptic('error');
            error(t('bellman.roomHasActiveCardDesc', { room }) || `Room ${room} has an active card - must check out first.`);
            return; // Don't proceed
        }
        setRoomNumber(room);
        setStep('details');
        haptic('light');
    };

    const handleSubmit = () => {
        if (!roomNumber) return;
        onSubmit({
            roomNumber,
            guestName,
            adults,
            children,
            needsCart: false,
            notes,
            assignedTo: selectedReceptionist || undefined,
            exceededCapacity: capacityExceeded.exceeded, // ✅ Flag violation
            capacityLimit: roomCapacity ? { adults: roomCapacity.adults, children: roomCapacity.children } : undefined
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ backdropFilter: 'none' }}>
            <div className="adora-modal w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <UserPlus className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">تسجيل دخول</h3>
                            <p className="text-sm text-white/50">
                                {step === 'room' ? 'اختر الغرفة' : `غرفة ${roomNumber}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="adora-btn-ghost w-10 h-10 rounded-xl flex items-center justify-center">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {step === 'room' ? (
                        <div className="space-y-4">
                            {/* ✅ UNIFIED: Use UnifiedRoomInput component for consistent UX */}
                            <UnifiedRoomInput
                                value={roomNumber}
                                onChange={setRoomNumber}
                                onConfirm={handleRoomSelect}
                                availableRooms={availableRooms}
                                activeRoomNumbers={activeRoomNumbers}
                                showFloorSelector={true}
                                showConfirmButton={true}
                                placeholder={t('bellman.orEnterRoomDirectly')}
                                autoConfirmOnEnter={true}
                                validateRoom={(room) => {
                                    if (!availableRooms.includes(room)) {
                                        return {
                                            valid: false,
                                            message: t('reception.roomNotFoundInBranch', { room }) || `Room ${room} does not exist in this branch.`
                                        };
                                    }
                                    return { valid: true };
                                }}
                            />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Room Selected Badge */}
                            <div className="bg-primary-500/20 border border-primary-500/30 rounded-xl p-3 text-center">
                                <span className="text-primary-400 text-sm">الغرفة المحددة:</span>
                                <span className="text-white text-2xl font-bold mr-2">{roomNumber}</span>
                            </div>

                            {/* ✅ Guest Name Input - Optional */}
                            {/* Removed: Guest name is not needed for check-in */}

                            {/* ✅ Room Capacity Info */}
                            {roomCapacity && (
                                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                    <p className="text-sm text-blue-400 flex items-center gap-2">
                                        <DoorOpen className="w-4 h-4" />
                                        <span>{t('bellman.roomType')} <strong>{roomCapacity.type}</strong></span>
                                        <span className="mx-2">|</span>
                                        <span>{t('bellman.capacity')} {t('bellman.capacityAdults', { adults: roomCapacity.adults })}, {t('bellman.capacityChildren', { children: roomCapacity.children })}</span>
                                    </p>
                                </div>
                            )}

                            {/* Adults & Children */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-white/60 mb-2">البالغين</label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setAdults(Math.max(1, adults - 1))}
                                            className="adora-btn-ghost w-10 h-10 rounded-xl flex items-center justify-center"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className={`text-2xl font-bold ${capacityExceeded.exceeded ? 'text-red-400' : 'text-white'}`}>{adults}</span>
                                        <button
                                            onClick={() => setAdults(adults + 1)}
                                            className="adora-btn-ghost w-10 h-10 rounded-xl flex items-center justify-center"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-white/60 mb-2">{t('bellman.children')}</label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setChildren(Math.max(0, children - 1))}
                                            className="adora-btn-ghost w-10 h-10 rounded-xl flex items-center justify-center"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className={`text-2xl font-bold ${capacityExceeded.exceeded ? 'text-red-400' : 'text-white'}`}>{children}</span>
                                        <button
                                            onClick={() => setChildren(children + 1)}
                                            className="adora-btn-ghost w-10 h-10 rounded-xl flex items-center justify-center"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* ⚠️ Capacity Exceeded Warning */}
                            {capacityExceeded.exceeded && (
                                <div className="p-4 rounded-xl bg-red-500/20 border-2 border-red-500/50 animate-pulse">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-bold text-red-400 mb-1">تجاوز الاستيعاب!</p>
                                            <p className="text-sm text-red-300">
                                                {capacityExceeded.message}
                                            </p>
                                            <p className="text-xs text-red-400/70 mt-2">
                                                {t('bellman.capacityExceededWarning')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="block text-sm text-white/60 mb-2">ملاحظات (اختياري)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder={t('bellman.additionalNotes')}
                                    className="adora-input w-full p-3 rounded-xl resize-none"
                                    rows={2}
                                />
                            </div>

                            {/* Reception Employee Selection */}
                            {receptionEmployees.length > 0 && (
                                <div>
                                    <label className="block text-sm text-white/60 mb-2">{t('bellman.receptionEmployee')}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {receptionEmployees.map((emp: any) => (
                                            <button
                                                key={emp.id}
                                                onClick={() => setSelectedReceptionist(
                                                    selectedReceptionist?.id === emp.id
                                                        ? null
                                                        : { id: emp.id, name: emp.name }
                                                )}
                                                className={`p-3 rounded-xl flex items-center gap-2 transition-all ${selectedReceptionist?.id === emp.id
                                                    ? 'bg-primary-500 text-white'
                                                    : 'adora-btn-ghost'
                                                    }`}
                                            >
                                                <Users className="w-4 h-4" />
                                                <span className="text-sm font-medium">{emp.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10">
                    {step === 'room' ? (
                        <p className="text-center adora-text-tertiary text-sm">{t('bellman.clickRoomToContinue')}</p>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setStep('room')}
                                className="adora-btn-ghost flex-1 py-3 rounded-xl font-medium transition-all"
                            >
                                {t('common.back')}
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-teal-600 text-white font-bold hover:shadow-lg hover:shadow-primary-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <UserPlus className="w-5 h-5" />
                                {t('bellman.checkIn')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const BellmanDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { success, error, haptic, playSound } = useUX();
    const { t } = useTranslation();
    const brandName = useBrandName();

    // State
    const [roomCards, setRoomCards] = useState<RoomCard[]>([]);
    const [requests, setRequests] = useState<BellmanRequest[]>([]);
    const [luggage, setLuggage] = useState<LuggageItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTab, setCurrentTab] = useState<TabType>('new');
    const [showCheckinModal, setShowCheckinModal] = useState(false);
    const [showShiftNotes, setShowShiftNotes] = useState(false);
    const [showProcurement, setShowProcurement] = useState(false);
    const [showTeam, setShowTeam] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showGeneralInstructions, setShowGeneralInstructions] = useState(false); // ✅ General instructions modal
    const [showSupportTicket, setShowSupportTicket] = useState(false); // ✅ Support ticket modal
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    // ✅ Room Transfer State
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferRoom, setTransferRoom] = useState<RoomCard | null>(null);
    
    // ✅ FAST UI: Force show page after 2 seconds max
    useEffect(() => {
        const fastUITimeout = setTimeout(() => {
            if (loading) {
                console.log('⚡ Fast UI: Showing Bellman page now');
                setLoading(false);
            }
        }, 2000);
        return () => clearTimeout(fastUITimeout);
    }, [loading]);
    const [availableRooms, setAvailableRooms] = useState<string[]>([]);
    const [roomsWithCapacity, setRoomsWithCapacity] = useState<Map<string, { type: string; adults: number; children: number }>>(new Map());
    const [receptionEmployees, setReceptionEmployees] = useState<any[]>([]);
    
    // ✅ Points Notification State
    const [activeNotifications, setActiveNotifications] = useState<Set<string>>(new Set());
    const [notificationRequest, setNotificationRequest] = useState<BellmanRequest | null>(null);

    // ✅ REQUEST_TYPE_LABELS and LOCATION_LABELS using t()
    const REQUEST_TYPE_LABELS = useMemo(() => ({
        luggage_up: t('bellman.requestTypeLabels.luggage_up'),
        luggage_down: t('bellman.requestTypeLabels.luggage_down'),
        cart: t('bellman.requestTypeLabels.cart'),
        escort: t('bellman.requestTypeLabels.escort')
    }), [t]);

    const LOCATION_LABELS = useMemo(() => ({
        lobby: t('bellman.locationLabels.lobby'),
        room: t('bellman.locationLabels.room'),
        storage: t('bellman.locationLabels.storage'),
        vehicle: t('bellman.locationLabels.vehicle')
    }), [t]);
    
    // ✅ Branch Location Warning State
    const [showLocationWarning, setShowLocationWarning] = useState(false);
    const [locationWarningData, setLocationWarningData] = useState<any>(null);
    
    // ✅ Onboarding Tour
    const { showTour, steps: tourSteps, closeTour, completeTour } = useOnboardingTour('bellman');

    // ✅ Read tab from URL query (?tab=new|in_progress|completed)
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { useSearchParams } = require('react-router-dom');
        const [searchParams] = useSearchParams();
        useEffect(() => {
            const tab = (searchParams.get('tab') || '').toLowerCase();
            if (tab === 'new' || tab === 'in_progress' || tab === 'completed') {
                setCurrentTab(tab as TabType);
            }
        }, [searchParams]);
    } catch {}

    // Branch and Tenant
    // ✅ FIX: Use branchId from AuthContext (updates when manager switches branches)
    const { branchId: authBranchId } = useAuth();
    const branchId = authBranchId || (user as any)?.branchId || (user as any)?.branch;
    const tenantId = useMemo(() => (user as any)?.tenantId, [user]); // ✅ Get tenantId

    // ✅ Check branch location on mount and branch change
    useEffect(() => {
        const checkLocation = async () => {
            if (!tenantId || !branchId || !user?.branches) return;
            
            try {
                const check = await checkBranchLocation(
                    tenantId,
                    branchId,
                    user.branches
                );
                
                if (!check.isAtBranch) {
                    setLocationWarningData(check);
                    setShowLocationWarning(true);
                }
            } catch (err) {
                console.error('Location check error:', err);
                // Fail open - allow access
            }
        };
        
        checkLocation();
    }, [tenantId, branchId, user?.branches]);

    // ============================================================
    // DATA LOADING
    // ============================================================

    useEffect(() => {
        if (!user || !branchId) return;

        // Subscribe to room cards
        // ✅ CRITICAL FIX: Pass branchId to prevent duplicate Room Cards from other branches
        const unsubscribeRoomCards = subscribeToActiveRoomCards((cards: RoomCard[]) => {
            setRoomCards(cards);
            setLoading(false);
        }, tenantId, branchId); // ✅ Pass both tenantId and branchId

        // Load available rooms - ✅ Fully Dynamic (No Fallback)
        // Subscribe to available rooms - ✅ Fully Dynamic (Real-time)
        const unsubscribeAvailableRooms = subscribeToRooms(branchId, (roomsData) => {
            const allRooms = roomsData.map(r => r.number);
            setAvailableRooms(allRooms);
            
            // ✅ Store room capacity info for occupancy validation
            const capacityMap = new Map<string, { type: string; adults: number; children: number }>();
            roomsData.forEach(r => {
                capacityMap.set(r.number, {
                    type: r.type || 'عادي',
                    adults: (r as any).adults || (r as any).maxOccupancy || 2,
                    children: (r as any).children || 0
                });
            });
            setRoomsWithCapacity(capacityMap);
        }, tenantId);

        // Load reception employees
        const loadReceptionEmployees = async () => {
            try {
                const employeesRef = collection(db, 'users');
                const empConstraints = [
                    where('role', '==', 'reception'),
                    where('status', '==', 'active'),
                    where('branch', '==', branchId)
                ];
                if (tenantId) empConstraints.push(where('tenantId', '==', tenantId));

                const qValid = query(employeesRef, ...empConstraints);
                const snapshot = await getDocs(qValid);
                const employees = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setReceptionEmployees(employees);
            } catch (error: any) {
                console.error('Error loading reception employees:', {
                    code: error?.code,
                    message: error?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || error?.message
                });
            }
        };

        loadReceptionEmployees();

        // Subscribe to bellman requests
        const requestsRef = collection(db, 'requests');
        // ✅ Fix: Remove orderBy to avoid composite index requirement
        const reqConstraints = [
            where('branch', '==', branchId),
            where('type', '==', 'bellman')
        ];
        if (tenantId) reqConstraints.push(where('tenantId', '==', tenantId));

        const reqQuery = query(requestsRef, ...reqConstraints);

        const unsubscribeRequests = onSnapshot(reqQuery, (snapshot) => {
            const loadedRequests: BellmanRequest[] = [];
            snapshot.forEach(doc => {
                loadedRequests.push({ id: doc.id, ...doc.data() } as BellmanRequest);
            });
            // ✅ Sort client-side
            loadedRequests.sort((a, b) => {
                const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
                const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
                return bTime - aTime;
            });
            setRequests(loadedRequests);
            setLoading(false);
        }, (error: any) => {
            console.error('Error loading bellman requests:', error);
            setLoading(false);
        });

        // Subscribe to luggage
        const luggageRef = collection(db, 'luggage');
        // ✅ Fix: No orderBy to remove index requirement
        const luggageConstraints = [where('branch', '==', branchId)];
        if (tenantId) luggageConstraints.push(where('tenantId', '==', tenantId));

        const luggageQuery = query(luggageRef, ...luggageConstraints);

        const unsubscribeLuggage = onSnapshot(luggageQuery, (snapshot) => {
            const loadedLuggage: LuggageItem[] = [];
            snapshot.forEach(doc => {
                loadedLuggage.push({ id: doc.id, ...doc.data() } as LuggageItem);
            });
            // ✅ Sort Manual
            loadedLuggage.sort((a, b) => {
                const aTime = a.receivedAt?.toDate?.()?.getTime() || 0;
                const bTime = b.receivedAt?.toDate?.()?.getTime() || 0;
                return bTime - aTime;
            });
            setLuggage(loadedLuggage);
            setLoading(false);
        }, (error: any) => {
            console.error('Error loading luggage:', {
                code: error?.code,
                message: error?.message,
            });
        });

        return () => {
            unsubscribeRoomCards();
            unsubscribeAvailableRooms();
            unsubscribeRequests();
            unsubscribeLuggage();
        };
    }, [user, branchId]);

    // Occupied rooms
    const occupiedRoomNumbers = useMemo(() => {
        return roomCards.filter(r => r.status === 'active').map(r => r.roomNumber);
    }, [roomCards]);

    // Free rooms
    const freeRooms = useMemo(() => {
        return availableRooms.filter(r => !occupiedRoomNumbers.includes(r));
    }, [availableRooms, occupiedRoomNumbers]);

    // ✅ Group requests by status (new/in_progress/completed)
    const groupedRequests = useMemo(() => {
        const now = new Date();
        
        // ✅ Helper: Check if scheduled request should be shown (only if scheduledDate <= now)
        const isScheduledRequestVisible = (r: any): boolean => {
            const scheduledDateTime = r.scheduledDate || r.scheduledAt;
            if (!scheduledDateTime) return true; // Not scheduled - always visible
            
            const scheduledTime = scheduledDateTime?.toDate?.() || new Date(scheduledDateTime);
            return scheduledTime <= now;
        };
        
        // Filter bellman-only requests
        const bellmanRequests = requests.filter(r => {
            if (!isScheduledRequestVisible(r)) return false;
            // Show if currentDepartment is bellman or legacy (no currentDepartment)
            if (r.currentDepartment && r.currentDepartment !== 'bellman') {
                return false;
            }
            return true;
        });
        
        return {
            new: bellmanRequests.filter(r => r.status === 'CONFIRMED'),
            in_progress: bellmanRequests.filter(r => r.status === 'IN_PROGRESS'),
            completed: bellmanRequests.filter(r => r.status === 'COMPLETED')
        };
    }, [requests]);
    
    // Active requests (for backward compatibility)
    const activeRequests = useMemo(() => {
        return [...groupedRequests.new, ...groupedRequests.in_progress];
    }, [groupedRequests]);

    // ✅ Show Points Notification for new CONFIRMED requests
    useEffect(() => {
        const firstConfirmed = activeRequests.find(
            req => req.status === 'CONFIRMED' && !activeNotifications.has(req.id)
        );

        if (firstConfirmed && tenantId) {
            setActiveNotifications(prev => new Set(prev).add(firstConfirmed.id));
            setNotificationRequest(firstConfirmed);
            
            const timer = setTimeout(() => {
                setNotificationRequest(null);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [activeRequests, activeNotifications, tenantId]);

    // ============================================================
    // ACTIONS
    // ============================================================

    const handleCheckin = async (data: { 
        roomNumber: string; 
        guestName: string; 
        adults: number; 
        children: number; 
        needsCart: boolean; 
        notes: string;
        exceededCapacity?: boolean;
        capacityLimit?: { adults: number; children: number };
    }) => {
        if (!tenantId || !branchId) {
            error(t('bellman.branchDataUnavailable'));
            return;
        }

        try {
            await checkIn({
                roomNumber: data.roomNumber,
                guestName: data.guestName || t('bellman.guestNamePlaceholder', { room: data.roomNumber }),
                adults: data.adults,
                children: data.children,
                needsCart: data.needsCart,
                notes: data.notes,
                createdBy: user?.id || ''
            }, tenantId);

            // ✅ Log capacity violation if exceeded
            if (data.exceededCapacity && data.capacityLimit) {
                try {
                    await addDoc(collection(db, `tenants/${tenantId}/branches/${branchId}/capacity_violations`), {
                        roomNumber: data.roomNumber,
                        employeeId: user?.id,
                        employeeName: user?.name,
                        department: 'bellman',
                        enteredAdults: data.adults,
                        enteredChildren: data.children,
                        limitAdults: data.capacityLimit.adults,
                        limitChildren: data.capacityLimit.children,
                        timestamp: Timestamp.now(),
                        notes: t('bellman.capacityExceededNote', { 
                            adults: data.adults, 
                            children: data.children, 
                            limitAdults: data.capacityLimit.adults, 
                            limitChildren: data.capacityLimit.children 
                        })
                    });
                    console.warn(`⚠️ Capacity violation logged for room ${data.roomNumber} by ${user?.name}`);
                } catch (logErr) {
                    console.error('Failed to log capacity violation:', logErr);
                }
            }

            // Award points (updates both personal and team points) - Non-blocking
            if (user?.id) {
                try {
                    await awardPoints(tenantId, user.id, 10, 'تسجيل دخول نزيل');
                } catch (e) {
                    console.warn('Failed to award checkin points:', e);
                }
            }

            success(t('bellman.checkInSuccess'));
            
            // ✅ Show warning after successful checkin if capacity was exceeded
            if (data.exceededCapacity) {
                setTimeout(() => {
                    error('⚠️ تم تسجيل تجاوز الاستيعاب في سجلك');
                }, 1000);
            }
        } catch (err: any) {
            console.error('Check-in error:', {
                code: err?.code,
                message: err?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || err?.message
            });
            error(err?.message || 'فشل تسجيل الدخول');
        }
    };

    const handleCheckout = async (roomCard: RoomCard) => {
        try {
            // CheckOut now creates inspection request automatically
            const inspectionId = await checkOut(
                roomCard.id,
                roomCard.roomNumber,
                user?.id,
                user?.name,
                undefined, // options
                tenantId // ✅ Pass tenantId
            );

            if (inspectionId) {
                console.log('✅ Inspection request created:', inspectionId);
            }

            // Archive shift notes for this room
            const session: ShiftNotesService.SessionContext = {
                // ✅ SaaS: Use tenantId as hotelId in shift notes service path
                hotelId: (user as any)?.tenantId || 'default',
                branchId: branchId
            };
            await ShiftNotesService.archiveRoomNotes(
                session,
                roomCard.roomNumber,
                { id: user?.id || '', name: user?.name || '' },
                roomCard.id
            );

            success(t('bellman.checkOutSuccess'));
        } catch (err: any) {
            console.error('Checkout error:', {
                code: err?.code,
                message: err?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || err?.message
            });
            error(t('bellman.checkOutFailed'));
        }
    };

    const handleStartRequest = async (requestId: string) => {
        try {
            // Get the request data first
            const requestsRef = collection(db, 'requests');
            const requestSnapshot = await getDocs(query(requestsRef, where('__name__', '==', requestId)));
            const requestData = requestSnapshot.empty ? null : requestSnapshot.docs[0].data();

            // Update request status to IN_PROGRESS
            await updateDoc(doc(db, 'requests', requestId), {
                status: 'IN_PROGRESS',
                startedAt: Timestamp.now(),
                startedBy: { id: user?.id, name: user?.name }
            });

            // If this is a luggage_down (checkout) request, create inspection for housekeeping
            if (requestData?.requestType === 'luggage_down' && requestData?.roomNumber) {
                try {
                    // Create inspection request for housekeeping
                    await addDoc(collection(db, 'requests'), {
                        type: 'cleaning',
                        serviceType: 'inspection',
                        requestType: 'inspection',
                        roomNumber: requestData.roomNumber,
                        branch: requestData.branch || branchId,
                        status: 'CONFIRMED',
                        currentDepartment: 'housekeeping',
                        source: 'bellman_checkout',
                        priority: 'normal',
                        cleaningType: 'checkout',
                        notes: t('bellman.inspectionRequestNote'),
                        createdAt: Timestamp.now(),

                        createdBy: { id: user?.id, name: user?.name },
                        timeline: { created: Timestamp.now() },
                        tenantId: tenantId // ✅ Add tenantId
                    });
                    
                    // ✅ FIX: Auto-check daily attendance when employee creates a request
                    if (tenantId && user?.id) {
                        try {
                            const { checkDailyAttendance } = await import('../../services/challengeService');
                            checkDailyAttendance(tenantId, user.id).catch(err => {
                                console.warn('Failed to check daily attendance:', err);
                            });
                        } catch (err) {
                            console.warn('Could not load challengeService:', err);
                        }
                    }
                    
                    console.log('✅ Created housekeeping inspection for room:', requestData.roomNumber);
                } catch (inspectionErr) {
                    console.warn('Could not create housekeeping inspection:', inspectionErr);
                }
            }

            success(t('bellman.requestStarted'));
        } catch (err: any) {
            console.error('Error starting request:', {
                code: err?.code,
                message: err?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || err?.message
            });
            error(t('bellman.requestStartFailed'));
        }
    };

    const handleCompleteRequest = async (request: BellmanRequest) => {
        try {
            const completedAt = Timestamp.now();
            await updateDoc(doc(db, 'requests', request.id), {
                status: 'COMPLETED',
                completedAt,
                completedBy: { id: user?.id, name: user?.name },
                currentDepartment: 'reception' // Return to reception
            });

            // Calculate duration (minutes)
            const startTime = request.startedAt || request.createdAt;
            const startMs = startTime?.toDate ? startTime.toDate().getTime() : new Date(startTime).getTime();
            const durationMinutes = Math.floor((completedAt.toDate().getTime() - startMs) / (1000 * 60));

            // Award points (Dynamic based on time)
            if (user?.id) {
                try {
                    const tenantId = (user as any)?.tenantId || 'default';
                    await awardPerformancePoints(
                        tenantId,
                        user.id,
                        'bellman',
                        'complete',
                        durationMinutes
                    );
                } catch (e) {
                    console.warn('Failed to award bellman points:', e);
                }
            }

            success(t('bellman.requestCompleted'));
        } catch (err: any) {
            console.error('Error completing request:', {
                code: err?.code,
                message: err?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || err?.message
            });
            error(t('bellman.requestCompleteFailed'));
        }
    };

    // Handle card click with markAsViewed
    const handleBellmanCardClick = async (requestId: string) => {
        if (user?.id && user?.name) {
            try {
                await markAsViewed(requestId, user.id, user.name, 'bellman');
            } catch (e) {
                // Silent fail
            }
        }
    };

    // ============================================================
    // RENDER
    // ============================================================

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center theme-page">
                <AdoraLoader size="lg" message={t('bellman.loadingData')} />
            </div>
        );
    }

    return (
        <PageTransition>
            {/* Manager Announcement Banner */}
            <ManagerAnnouncementBanner department="bellman" />
            
            {/* Spacer for UnifiedManagerHeader */}
            <div className="h-[88px] sm:h-[96px] lg:h-[92px]" />
            
            <div className="min-h-screen pb-4 sm:pb-0 relative overflow-x-hidden transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
            {/* Flexible Header - Actions Only (Greeting in UnifiedManagerHeader) */}
            <FlexibleHeader
                title={t('bellman.title')}
                titleIcon={<Bell className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 flex-shrink-0" />}
                showGreeting={false}
                brandName={brandName}
                subtitle={undefined}
                actions={[
                    {
                        id: 'history',
                        icon: <History className="w-5 h-5" />,
                        label: t('bellman.operationsHistory'),
                        onClick: () => setShowHistory(true),
                        variant: 'primary'
                    },
                    {
                        id: 'shiftNotes',
                        icon: <MessageSquare className="w-5 h-5" />,
                        label: 'ملاحظات الغرف',
                        onClick: () => setShowShiftNotes(true)
                    },
                    {
                        id: 'procurement',
                        icon: <ShoppingCart className="w-5 h-5" />,
                        label: t('bellman.procurement'),
                        onClick: () => setShowProcurement(true)
                    },
                    {
                        id: 'instructions',
                        icon: <BookOpen className="w-5 h-5" />,
                        label: t('bellman.generalInstructions'),
                        onClick: () => setShowGeneralInstructions(true),
                        variant: 'primary'
                    },
                    {
                        id: 'support',
                        icon: <Headphones className="w-5 h-5" />,
                        label: t('bellman.technicalSupport'),
                        onClick: () => setShowSupportTicket(true)
                    }
                ]}
            />
            
            {/* Golden Alert - Broadcast Messages */}
            <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                <GoldenAlertDisplay department="bellman" />
            </div>

            {/* ✅ Room Transfer Notifications */}
            <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                <div className="flex justify-end">
                    <TransferNotificationBadge department="bellman" />
                </div>
            </div>

            {/* Challenge Timeline */}
            <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                <ChallengeTimeline />
            </div>

            {/* Stats - Unified Style */}
            <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-4">
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={occupiedRoomNumbers.length}
                        label={t('bellman.occupiedRooms')}
                        icon={DoorOpen}
                        iconColor="purple"
                        status="normal"
                        lastUpdate={t('bellman.lastUpdate')}
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={activeRequests.length}
                        label={t('bellman.activeRequests')}
                        icon={Bell}
                        iconColor="orange"
                        status={activeRequests.length > 10 ? 'warning' : 'normal'}
                        lastUpdate={t('bellman.lastUpdate')}
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={luggage.filter(l => l.status !== 'delivered').length}
                        label={t('bellman.pendingLuggage')}
                        icon={Package}
                        iconColor="blue"
                        status={luggage.filter(l => l.status !== 'delivered').length > 5 ? 'warning' : 'normal'}
                        lastUpdate={t('bellman.lastUpdate')}
                    />
                </div>
            </div>

            {/* Quick Actions - Premium Hero Button */}
            <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-6">
                <button
                    onClick={() => setShowCheckinModal(true)}
                    className="w-full relative group overflow-hidden p-[1px] rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-500 via-green-500 to-teal-500 opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative bg-white dark:bg-gray-900/90 rounded-xl p-4 sm:p-5 flex items-center justify-between h-full shadow-lg border border-slate-200 dark:border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500/20 to-primary-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors border border-green-500/20">
                                <UserPlus className="w-7 h-7 text-green-400" />
                            </div>
                            <div className="text-right">
                                <h3 className="text-lg sm:text-xl font-bold adora-text-primary mb-1 group-hover:text-green-400 transition-colors">{t('bellman.registerGuest')}</h3>
                                <p className="adora-text-tertiary text-sm">{t('bellman.checkInDescription')}</p>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-green-500/20 transition-colors" style={{ background: 'var(--theme-bg-tertiary)' }}>
                            <Plus className="w-6 h-6 adora-text-tertiary group-hover:text-green-400 transition-colors" />
                        </div>
                    </div>
                </button>
            </div>

            {/* ✅ Unified Tabs - Same as Reception */}
            <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-4">
                <UnifiedRequestTabs
                    currentTab={currentTab}
                    onTabChange={(tab) => setCurrentTab(tab)}
                    newCount={groupedRequests.new.length}
                    inProgressCount={groupedRequests.in_progress.length}
                    completedCount={groupedRequests.completed.length}
                />
            </div>

            {/* ✅ Content - Unified Tabs (جديد / قيد التنفيذ / مكتمل) */}
            <div className="px-4 sm:px-6 max-w-7xl mx-auto space-y-3">
                {/* Render requests based on current tab */}
                {(() => {
                    const currentRequests = groupedRequests[currentTab] || [];
                    const emptyMessages = {
                        new: 'لا توجد طلبات جديدة',
                        in_progress: 'لا توجد طلبات قيد التنفيذ',
                        completed: 'لا توجد طلبات مكتملة'
                    };
                    const emptyIcons = {
                        new: Bell,
                        in_progress: Clock,
                        completed: CheckCircle
                    };
                    const EmptyIcon = emptyIcons[currentTab];

                    if (currentRequests.length === 0) {
                        return (
                            <div className="adora-card p-12 text-center">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <EmptyIcon className="w-8 h-8" style={{ color: 'var(--theme-text-tertiary)' }} />
                                </div>
                                <p className="adora-text-tertiary">{emptyMessages[currentTab]}</p>
                            </div>
                        );
                    }

                    return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                            {currentRequests.map(request => (
                                <div key={request.id} 
                                    className="p-3 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] adora-card border shadow-sm adora-border"
                                    onClick={() => handleBellmanCardClick(request.id)}>
                                    {/* Row 1: Room + Type + Status */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-10 h-10 rounded-lg flex-shrink-0 bg-blue-500/20 flex items-center justify-center">
                                            <span className="text-sm font-bold adora-text-primary">{request.roomNumber}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[10px] adora-text-secondary truncate">
                                                    {REQUEST_TYPE_LABELS[request.requestType || ''] || t('bellman.requestTypeDefault')}
                                                </span>
                                                {(request as any).source === 'QR' && <QrCode className="w-3 h-3 text-teal-500" />}
                                            </div>
                                            <p className="text-[10px] adora-text-tertiary truncate">{request.guestName || 'نزيل'}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                            <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                request.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-500' 
                                                : request.status === 'COMPLETED' ? 'bg-green-500/20 text-green-500'
                                                : 'bg-teal-500/20 text-teal-500'
                                            }`}>
                                                {request.status === 'IN_PROGRESS' ? t('bellman.statusLabels.inProgress') : request.status === 'COMPLETED' ? t('bellman.statusLabels.completed') : t('bellman.statusLabels.new')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Badges */}
                                    {(request.needsCart || (request as any).guestsInRoom) && (
                                        <div className="flex items-center gap-1.5 mb-2 text-[9px]">
                                            {request.needsCart && <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-500">🛒 عربة</span>}
                                            {(request as any).guestsInRoom && <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-500">👥 موجود</span>}
                                        </div>
                                    )}

                                    {/* Row 3: Notes (truncated) */}
                                    {request.notes && (
                                        <p className="text-[10px] adora-text-secondary line-clamp-1 mb-2 px-2 py-1 rounded adora-bg-tertiary">
                                            💬 {request.notes}
                                        </p>
                                    )}

                                    {/* Row 4: Actions - Only for new/in_progress */}
                                    {currentTab !== 'completed' && (
                                        <div className="flex gap-2 pt-2 border-t adora-border">
                                            {request.status === 'CONFIRMED' && (
                                                <button onClick={(e) => { e.stopPropagation(); handleStartRequest(request.id); }}
                                                    className="flex-1 py-1.5 px-2 rounded-lg bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                                                    <Play className="w-3 h-3" /> بدء
                                                </button>
                                            )}
                                            {request.status === 'IN_PROGRESS' && (
                                                <button onClick={(e) => { e.stopPropagation(); handleCompleteRequest(request); }}
                                                    className="flex-1 py-1.5 px-2 rounded-lg bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" /> إتمام
                                                </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); handleBellmanCardClick(request.id); }}
                                                className="py-1.5 px-3 rounded-lg text-xs font-medium adora-bg-tertiary adora-text-secondary flex items-center gap-1">
                                                <Eye className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    );
                })()}

                {/* ✅ Quick Access: Occupied Rooms Section */}
                {roomCards.filter(r => r.status === 'active').length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-sm font-bold adora-text-secondary mb-3 flex items-center gap-2">
                            <DoorOpen className="w-4 h-4" />
                            الغرف المشغولة ({roomCards.filter(r => r.status === 'active').length})
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {roomCards.filter(r => r.status === 'active').slice(0, 8).map(room => (
                                <div key={room.id} className="adora-card p-3 text-center">
                                    <span className="text-lg font-bold adora-text-primary">{room.roomNumber}</span>
                                            <p className="text-[10px] adora-text-tertiary truncate">{room.guestName || t('bellman.guestDefault')}</p>
                                    <div className="flex gap-1 mt-2">
                                        <button 
                                            onClick={() => handleCheckout(room)}
                                            className="flex-1 py-1 px-2 rounded bg-red-500/20 text-red-500 text-[10px] font-medium"
                                        >
                                            <LogOut className="w-3 h-3 inline mr-1" />خروج
                                        </button>
                                        <button 
                                            onClick={() => { setTransferRoom(room); setShowTransferModal(true); }}
                                            className="py-1 px-2 rounded bg-orange-500/20 text-orange-500 text-[10px]"
                                        >
                                            <ArrowLeftRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <CheckinModal
                isOpen={showCheckinModal}
                onClose={() => setShowCheckinModal(false)}
                onSubmit={handleCheckin}
                rooms={freeRooms}
                receptionEmployees={receptionEmployees}
                roomsCapacity={roomsWithCapacity}
                activeRoomCards={roomCards}
            />

            <ShiftNotes isOpen={showShiftNotes} onClose={() => setShowShiftNotes(false)} />
            <ProcurementCartWizard isOpen={showProcurement} onClose={() => setShowProcurement(false)} department="bellman" tenantId={tenantId || ''} />
            <TeamMembers isOpen={showTeam} onClose={() => setShowTeam(false)} department="bellman" />
            <UnifiedHistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} defaultDepartment="bellman" />

            {/* ✅ Room Transfer Modal */}
            {transferRoom && branchId && tenantId && (
                <RoomTransferModal
                    isOpen={showTransferModal}
                    onClose={() => {
                        setShowTransferModal(false);
                        setTransferRoom(null);
                    }}
                    currentRoom={transferRoom.roomNumber}
                    guestName={transferRoom.guestName}
                    guestIdentity={transferRoom.guestIdentity}
                    guestPhone={transferRoom.guestPhone}
                    branchId={branchId}
                    tenantId={tenantId}
                    onTransferComplete={(newRoom) => {
                        success(`✅ تم نقل الضيف بنجاح إلى الغرفة ${newRoom}`);
                    }}
                />
            )}

            {/* Mobile Menu */}
            <MobileMenu
                isOpen={showMobileMenu}
                onClose={() => setShowMobileMenu(false)}
                user={user || undefined}
                onLogout={logout}
                items={[
                    {
                        id: 'history',
                        label: t('bellman.operationsHistory'),
                        icon: <History className="w-5 h-5" />,
                        onClick: () => setShowHistory(true),
                        color: 'text-blue-400'
                    },
                    {
                        id: 'shift-notes',
                        label: 'ملاحظات الغرف',
                        icon: <MessageSquare className="w-5 h-5" />,
                        onClick: () => setShowShiftNotes(true),
                        color: 'text-white/60'
                    },
                    {
                        id: 'team',
                        label: 'الفريق',
                        icon: <Users className="w-5 h-5" />,
                        onClick: () => setShowTeam(true),
                        color: 'text-white/60'
                    },
                    {
                        id: 'procurement',
                        label: t('bellman.procurement'),
                        icon: <ShoppingCart className="w-5 h-5" />,
                        onClick: () => setShowProcurement(true),
                        color: 'text-white/60'
                    }
                ]}
            />

            {/* ✅ Branch Location Warning */}
            {showLocationWarning && locationWarningData && branchId && (
                <BranchLocationWarning
                    branchId={branchId}
                    onConfirm={() => {
                        setShowLocationWarning(false);
                        // Continue anyway
                    }}
                    onCancel={() => {
                        setShowLocationWarning(false);
                        navigate('/admin');
                    }}
                />
            )}

            {/* General Instructions Modal */}
            <GeneralInstructionsView
                department="bellman"
                isOpen={showGeneralInstructions}
                onClose={() => setShowGeneralInstructions(false)}
            />

            {/* Support Ticket Modal */}
            {showSupportTicket && (
                <SupportTicketModal
                    isOpen={showSupportTicket}
                    onClose={() => setShowSupportTicket(false)}
                    department="bellman"
                />
            )}

            {/* ✅ Onboarding Tour */}
            <TourGuide
                steps={tourSteps}
                isOpen={showTour}
                onClose={closeTour}
                onComplete={completeTour}
            />

            {/* 📝 Developer Signature */}
            {/* Developer Signature is in GlobalFooter (App.tsx) */}
        </div>
        </PageTransition>
    );
};

export default BellmanDashboard;
