/**
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
    MapPin, Phone, Truck, ChevronRight, X, Plus, Minus,
    QrCode, // ✅ QR icon for QR requests
    Smartphone, // ✅ Alternative QR icon
    BookOpen, // ✅ General instructions icon
    ArrowLeftRight // ✅ Room transfer icon
} from 'lucide-react';
import { HeaderButton } from '../../components/common/HeaderButton';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
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
import { ReadReceipt } from '../../components/shared/ReadReceipt';
import { MobileMenu } from '../../components/common/MobileMenu';
import { StatCard } from '../../components/common/StatCard';
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

type TabType = 'rooms' | 'requests' | 'luggage';

// ============================================================
// CONSTANTS
// ============================================================

const REQUEST_TYPE_LABELS: Record<string, string> = {
    luggage_up: 'صعود أمتعة',
    luggage_down: 'نزول أمتعة',
    cart: 'عربة',
    escort: 'مرافقة'
};

const LOCATION_LABELS: Record<string, string> = {
    lobby: 'اللوبي',
    room: 'الغرفة',
    storage: 'المخزن',
    vehicle: 'السيارة'
};

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
    const [step, setStep] = useState<'room' | 'details'>('room');
    const [roomNumber, setRoomNumber] = useState('');
    const [guestName, setGuestName] = useState('');
    const [adults, setAdults] = useState(1);
    const [children, setChildren] = useState(0);
    const [notes, setNotes] = useState('');
    const [showFloorSelector, setShowFloorSelector] = useState(false);
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
                message: `⚠️ انتبه! قرار إداري: لا تستوعب هذه الغرفة (${roomCapacity.type}) أكثر من ${maxAdults} بالغين و ${maxChildren} أطفال`
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
            setShowFloorSelector(false);
        }
    }, [isOpen]);

    const handleRoomSelect = (room: string) => {
        // ✅ Check if room has active card
        if (activeRoomNumbers.has(room)) {
            haptic('error');
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
                            {/* Open Floor Selector Button */}
                            <button
                                onClick={() => setShowFloorSelector(true)}
                                className="adora-card w-full py-4 rounded-xl hover:opacity-80 transition-colors flex items-center justify-center gap-2"
                            >
                                <DoorOpen className="w-5 h-5 text-green-400" />
                                <span className="text-white font-medium">اختر الغرفة حسب الدور</span>
                            </button>

                            {/* Or direct input */}
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={roomNumber}
                                    onChange={(e) => setRoomNumber(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && roomNumber && !roomHasActiveCard) {
                                            handleRoomSelect(roomNumber);
                                        }
                                    }}
                                    placeholder="أو اكتب رقم الغرفة مباشرة"
                                    className={`input text-center text-lg ${roomHasActiveCard ? 'border-red-500 border-2' : ''}`}
                                />
                                
                                {/* ⚠️ Active Card Warning */}
                                {roomHasActiveCard && (
                                    <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50">
                                        <div className="flex items-center gap-2 text-red-400">
                                            <AlertCircle className="w-5 h-5" />
                                            <div>
                                                <p className="font-bold text-sm">لا يمكن إدخال هذه الغرفة!</p>
                                                <p className="text-xs text-red-300">الغرفة {roomNumber} لها كارت نشط - يجب تسجيل الخروج أولاً</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* ✅ زر تأكيد منفصل وواضح */}
                                <button
                                    onClick={() => roomNumber && !roomHasActiveCard && handleRoomSelect(roomNumber)}
                                    disabled={!roomNumber || roomHasActiveCard}
                                    className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                                        roomNumber && !roomHasActiveCard
                                            ? 'adora-btn-primary' 
                                            : 'adora-btn-ghost cursor-not-allowed opacity-50'
                                    }`}
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    تأكيد رقم الغرفة
                                </button>
                            </div>

                            {/* Floor Room Selector Modal - Only show available rooms */}
                            <FloorRoomSelector
                                rooms={availableRooms}
                                selectedRoom={roomNumber}
                                onSelect={handleRoomSelect}
                                isOpen={showFloorSelector}
                                onClose={() => setShowFloorSelector(false)}
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
                                        <span>نوع الغرفة: <strong>{roomCapacity.type}</strong></span>
                                        <span className="mx-2">|</span>
                                        <span>الاستيعاب: {roomCapacity.adults} بالغين، {roomCapacity.children} أطفال</span>
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
                                    <label className="block text-sm text-white/60 mb-2">الأطفال</label>
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
                                                ⚠️ سيتم تسجيل هذا التجاوز في سجلك
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
                                    placeholder="أي ملاحظات إضافية..."
                                    className="adora-input w-full p-3 rounded-xl resize-none"
                                    rows={2}
                                />
                            </div>

                            {/* Reception Employee Selection */}
                            {receptionEmployees.length > 0 && (
                                <div>
                                    <label className="block text-sm text-white/60 mb-2">موظف الاستقبال (اختياري)</label>
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
                        <p className="text-center adora-text-tertiary text-sm">اضغط على رقم الغرفة للمتابعة</p>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setStep('room')}
                                className="adora-btn-ghost flex-1 py-3 rounded-xl font-medium transition-all"
                            >
                                رجوع
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-teal-600 text-white font-bold hover:shadow-lg hover:shadow-primary-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <UserPlus className="w-5 h-5" />
                                تسجيل الدخول
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
    const brandName = useBrandName();

    // State
    const [roomCards, setRoomCards] = useState<RoomCard[]>([]);
    const [requests, setRequests] = useState<BellmanRequest[]>([]);
    const [luggage, setLuggage] = useState<LuggageItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTab, setCurrentTab] = useState<TabType>('requests');
    const [showCheckinModal, setShowCheckinModal] = useState(false);
    const [showShiftNotes, setShowShiftNotes] = useState(false);
    const [showProcurement, setShowProcurement] = useState(false);
    const [showTeam, setShowTeam] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showGeneralInstructions, setShowGeneralInstructions] = useState(false); // ✅ General instructions modal
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
    
    // ✅ Branch Location Warning State
    const [showLocationWarning, setShowLocationWarning] = useState(false);
    const [locationWarningData, setLocationWarningData] = useState<any>(null);
    
    // ✅ Onboarding Tour
    const { showTour, steps: tourSteps, closeTour, completeTour } = useOnboardingTour('bellman');

    // ✅ Read tab from URL query (?tab=requests|rooms|luggage)
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { useSearchParams } = require('react-router-dom');
        const [searchParams] = useSearchParams();
        useEffect(() => {
            const tab = (searchParams.get('tab') || '').toLowerCase();
            if (tab === 'requests' || tab === 'rooms' || tab === 'luggage') {
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
        const unsubscribeRoomCards = subscribeToActiveRoomCards((cards: RoomCard[]) => {
            setRoomCards(cards);
            setLoading(false);
        }, tenantId); // ✅ Pass tenantId

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

    // Active requests - filter to only show bellman's requests
    const activeRequests = useMemo(() => {
        const now = new Date();
        
        // ✅ Helper: Check if scheduled request should be shown (only if scheduledDate <= now)
        const isScheduledRequestVisible = (r: any): boolean => {
            const scheduledDateTime = r.scheduledDate || r.scheduledAt;
            if (!scheduledDateTime) return true; // Not scheduled - always visible
            
            const scheduledTime = scheduledDateTime?.toDate?.() || new Date(scheduledDateTime);
            // Show only if scheduled time has passed (including now)
            return scheduledTime <= now;
        };
        
        return requests.filter(r => {
            // ✅ Scheduled requests: Show only if scheduledDate <= now
            if (!isScheduledRequestVisible(r)) return false;
            
            // Filter by status
            if (r.status === 'COMPLETED') return false;

            // Show if currentDepartment is bellman or legacy (no currentDepartment)
            if (r.currentDepartment && r.currentDepartment !== 'bellman') {
                return false; // Belongs to another department
            }

            return true;
        });
    }, [requests]);

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
            error('بيانات الفرع غير متوفرة. يرجى تسجيل الخروج والدخول مرة أخرى.');
            return;
        }

        try {
            await checkIn({
                roomNumber: data.roomNumber,
                guestName: data.guestName || `نزيل - ${data.roomNumber}`,
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
                        notes: `تجاوز الاستيعاب: أدخل ${data.adults} بالغين و ${data.children} أطفال بينما القرار الإداري ${data.capacityLimit.adults} بالغين و ${data.capacityLimit.children} أطفال`
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

            success('تم تسجيل الدخول بنجاح');
            
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

            success('تم تسجيل الخروج بنجاح');
        } catch (err: any) {
            console.error('Checkout error:', {
                code: err?.code,
                message: err?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || err?.message
            });
            error('فشل تسجيل الخروج');
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
                        notes: `طلب فحص - مغادرة نزيل (من البيلمان)`,
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

            success('تم بدء الطلب');
        } catch (err: any) {
            console.error('Error starting request:', {
                code: err?.code,
                message: err?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || err?.message
            });
            error('فشل بدء الطلب');
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

            success('تم إتمام الطلب بنجاح');
        } catch (err: any) {
            console.error('Error completing request:', {
                code: err?.code,
                message: err?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || err?.message
            });
            error('فشل إتمام الطلب');
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
                <AdoraLoader size="lg" message="جاري تحميل البيانات..." />
            </div>
        );
    }

    return (
        <PageTransition>
            {/* Manager Announcement Banner */}
            <ManagerAnnouncementBanner department="bellman" />
            
        <div className="min-h-screen p-2 xs:p-3 sm:p-4 md:p-5 lg:p-6 pb-16 sm:pb-20 md:pb-24 overflow-x-hidden transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
            {/* Flexible Header */}
            <FlexibleHeader
                title="البيلمان"
                titleIcon={<Bell className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 flex-shrink-0" />}
                showGreeting={true}
                brandName={brandName}
                subtitle={undefined}
                actions={[
                    {
                        id: 'instructions',
                        icon: <BookOpen className="w-5 h-5" />,
                        label: 'تعليمات عامة',
                        onClick: () => setShowGeneralInstructions(true),
                        variant: 'primary'
                    },
                    {
                        id: 'history',
                        icon: <History className="w-5 h-5" />,
                        label: 'سجل العمليات',
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
                        label: 'المشتريات',
                        onClick: () => setShowProcurement(true)
                    },
                    {
                        id: 'logout',
                        icon: <LogOut className="w-5 h-5" />,
                        label: 'تسجيل خروج',
                        onClick: logout,
                        variant: 'danger'
                    }
                ]}
            />
            
            {/* Golden Alert - Broadcast Messages */}
            <div className="mb-4">
                <GoldenAlertDisplay department="bellman" />
            </div>

            {/* ✅ Room Transfer Notifications */}
            <div className="flex justify-end mb-3">
                <TransferNotificationBadge department="bellman" />
            </div>

            {/* Challenge Timeline */}
            <ChallengeTimeline />

            {/* Stats - Unified Style */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={occupiedRoomNumbers.length}
                        label="🚪 غرف مشغولة"
                        icon={DoorOpen}
                        iconColor="purple"
                        status="normal"
                        lastUpdate="تم التحديث الآن"
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={activeRequests.length}
                        label="🔔 طلبات نشطة"
                        icon={Bell}
                        iconColor="orange"
                        status={activeRequests.length > 10 ? 'warning' : 'normal'}
                        lastUpdate="تم التحديث الآن"
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={luggage.filter(l => l.status !== 'delivered').length}
                        label="🧳 أمتعة معلقة"
                        icon={Package}
                        iconColor="blue"
                        status={luggage.filter(l => l.status !== 'delivered').length > 5 ? 'warning' : 'normal'}
                        lastUpdate="تم التحديث الآن"
                    />
                </div>
            </div>

            {/* Quick Actions - Premium Hero Button */}
            <div className="mb-6">
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
                                <h3 className="text-lg sm:text-xl font-bold adora-text-primary mb-1 group-hover:text-green-400 transition-colors">تسجيل دخول نزيل</h3>
                                <p className="adora-text-tertiary text-sm">إجراء عملية تسكين جديدة للغرف</p>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-green-500/20 transition-colors" style={{ background: 'var(--theme-bg-tertiary)' }}>
                            <Plus className="w-6 h-6 adora-text-tertiary group-hover:text-green-400 transition-colors" />
                        </div>
                    </div>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto">
                {[
                    { key: 'requests', label: 'الطلبات', count: activeRequests.length },
                    { key: 'rooms', label: 'الغرف', count: occupiedRoomNumbers.length },
                    { key: 'luggage', label: 'الأمتعة', count: luggage.filter(l => l.status !== 'delivered').length }
                ].map(tab => {
                    // Subtle glow for requests tab when there are pending requests
                    const hasNewRequests = tab.key === 'requests' && tab.count > 0 && currentTab !== 'requests';

                    return (
                        <button
                            key={tab.key}
                            onClick={() => setCurrentTab(tab.key as TabType)}
                            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${currentTab === tab.key
                                ? 'bg-purple-500 text-white'
                                : hasNewRequests
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                                    : 'adora-btn-ghost'
                                }`}
                        >
                            {/* Small dot indicator for new requests */}
                            {hasNewRequests && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
                            )}
                            {tab.label}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${currentTab === tab.key
                                ? 'bg-white/20'
                                : hasNewRequests
                                    ? 'bg-green-500 text-white'
                                    : 'adora-card'
                                }`}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            <div className="space-y-3">
                {currentTab === 'rooms' && (
                    <>
                        {roomCards.filter(r => r.status === 'active').length === 0 ? (
                            <div className="adora-card p-12 text-center">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <DoorOpen className="w-8 h-8" style={{ color: 'var(--theme-text-tertiary)' }} />
                                </div>
                                <p className="adora-text-tertiary">لا توجد غرف مشغولة حالياً</p>
                            </div>
                        ) : (
                            roomCards.filter(r => r.status === 'active').map(room => (
                                <RoomCardItem
                                    key={room.id}
                                    room={room}
                                    onCheckout={() => handleCheckout(room)}
                                    onTransfer={() => {
                                        setTransferRoom(room);
                                        setShowTransferModal(true);
                                    }}
                                />
                            ))
                        )}
                    </>
                )}

                {currentTab === 'requests' && (
                    <>
                        {activeRequests.length === 0 ? (
                            <div className="adora-card p-12 text-center">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <Bell className="w-8 h-8" style={{ color: 'var(--theme-text-tertiary)' }} />
                                </div>
                                <p className="adora-text-tertiary">لا توجد طلبات نشطة</p>
                            </div>
                        ) : (
                            activeRequests.map(request => (
                                <div key={request.id} className="adora-card p-4" onClick={() => handleBellmanCardClick(request.id)}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                <span className="text-lg font-bold text-white">{request.roomNumber}</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-white font-medium">
                                                        {REQUEST_TYPE_LABELS[request.requestType || ''] || 'طلب بيلمان'}
                                                    </p>
                                                    {/* ✅ QR Badge - Show if request is from QR */}
                                                    {(request as any).source === 'QR' && (
                                                        <span className="px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold flex items-center gap-1 flex-shrink-0">
                                                            <QrCode className="w-3 h-3" />
                                                            <span>QR</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                    <p className="text-white/50 text-sm">{request.guestName || 'نزيل'}</p>
                                                    {/* ✅ Guest Info - Show identity/phone if available */}
                                                    {(request as any).guestIdentity && (
                                                        <span className="adora-text-tertiary text-xs">
                                                            • {(request as any).guestIdentity}
                                                        </span>
                                                    )}
                                                    {(request as any).guestPhone && (
                                                        <span className="adora-text-tertiary text-xs">
                                                            • {(request as any).guestPhone}
                                                        </span>
                                                    )}
                                                    <ReadReceipt request={request as any} size="sm" showPopup={false} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {request.needsCart && (
                                                <span className="px-2 py-1 rounded-lg bg-orange-500/20 text-orange-400 text-xs">
                                                    🛒 عربة
                                                </span>
                                            )}
                                            {(request as any).guestsInRoom && (
                                                <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-xs">
                                                    👥 بالغرفة
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Created By Info */}
                                    {(request as any).createdBy?.name && (
                                        <div className="mb-3 px-3 py-2 rounded-lg adora-card">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="adora-text-tertiary">من:</span>
                                                <span className="text-cyan-400 font-medium">{(request as any).createdBy.name}</span>
                                            </div>
                                            {request.notes && (
                                                <p className="text-white/60 text-xs mt-1">{request.notes}</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        {request.status === 'CONFIRMED' && (
                                            <button
                                                onClick={() => handleStartRequest(request.id)}
                                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium flex items-center justify-center gap-2"
                                            >
                                                <Play className="w-5 h-5" />
                                                بدء
                                            </button>
                                        )}
                                        {request.status === 'IN_PROGRESS' && (
                                            <button
                                                onClick={() => handleCompleteRequest(request)}
                                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-teal-600 text-white font-medium flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle2 className="w-5 h-5" />
                                                إتمام
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </>
                )}

                {currentTab === 'luggage' && (
                    <>
                        {luggage.filter(l => l.status !== 'delivered').length === 0 ? (
                            <div className="glass-card p-12 text-center">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                                    <Package className="w-8 h-8 text-white/20" />
                                </div>
                                <p className="text-white/40">لا توجد أمتعة معلقة</p>
                            </div>
                        ) : (
                            luggage.filter(l => l.status !== 'delivered').map(item => (
                                <div key={item.id} className="glass-card p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                                <Package className="w-6 h-6 text-orange-400" />
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">غرفة {item.roomNumber}</p>
                                                <p className="text-white/50 text-sm">{item.itemCount} قطعة • {LOCATION_LABELS[item.location]}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded-lg text-xs ${item.status === 'stored' ? 'bg-blue-500/20 text-blue-400' :
                                            item.status === 'received' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-green-500/20 text-green-400'
                                            }`}>
                                            {item.status === 'stored' ? 'مخزن' : item.status === 'received' ? 'مستلم' : 'سلّم'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </>
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
                        label: 'سجل العمليات',
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
                        label: 'المشتريات',
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
