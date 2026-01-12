/**
 * Modern Reception Dashboard V2
 * Built from scratch with best UX practices
 * Adora Hotel Management System
 * 
 * Features:
 * - Hybrid view (tabs for mobile, overview for desktop)
 * - Quick action buttons for fast request creation
 * - Smart notifications based on priority
 * - Real-time updates
 * - Minimal clicks to complete tasks
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    Calendar,
    DoorOpen,
    Wrench,
    BellRing,
    Coffee,
    Shirt,
    Home,
    X,
    Send,
    AlertCircle,
    CalendarCheck,
    Play,
    CheckCircle,
    Building2,
    Trash2,
    History,
    ShoppingCart,
    MessageSquare,
    LogOut,
    CheckCircle2,
    Sparkles,
    Bell,
    Check,
    Clock,

    Eye,
    Repeat,
    QrCode, // ✅ QR icon for QR requests
    Smartphone, // ✅ Alternative QR icon
    Archive, // ✅ Archive icon for lost items
    Package, // ✅ Package icon for lost items
    AlertTriangle, // ✅ Emergency/Other requests icon
    BookOpen, // ✅ General instructions icon
    MessageCircle // ✅ WhatsApp icon
} from 'lucide-react';
import { HeaderButton } from '../../components/common/HeaderButton';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { haptic, playSound } from '../../utils/uxEffects';
import { usei18n } from '../../i18n/i18nContext';
import { db } from '../../services/firebase';
import {
    collection, query, where, onSnapshot, doc, updateDoc,
    addDoc, Timestamp, orderBy, getDocs, getDoc, increment, deleteDoc, limit, deleteField,
    FieldPath
} from 'firebase/firestore';

// Shared Components
import { ShiftNotes } from '../../components/shared/ShiftNotes';
import { PointsTracker } from '../../components/shared/PointsTracker';
import { ProcurementCart } from '../../components/shared/ProcurementCart';
import { VoiceInputButton } from '../../components/shared/VoiceInputButton'; // ✅ Import
import { ReceptionVerificationPanel } from '../../components/shared/ReceptionVerificationPanel'; // 🆕 Guest Verification

import { subscribeToRooms } from '../../services/roomService';
import { subscribeToEmployees } from '../../services/employeeService'; // Assuming this exists or userService
import { FloorRoomSelector } from '../../components/shared/FloorRoomSelector';
import { SmartInsight } from '../../components/shared/SmartInsight'; // 🧠 Smart Genius Insight
import { RoomHistoryModal } from '../../components/shared/RoomHistoryModal';
import { UnifiedHistoryModal } from '../../components/shared/UnifiedHistoryModal';
import { ReadReceipt, RequestStatusLabel } from '../../components/shared/ReadReceipt';
import { GoldenAlertDisplay } from '../../components/shared/GoldenAlert';
import { ChallengeTimeline } from '../../components/features/ChallengeTimeline';
import { MobileMenu } from '../../components/common/MobileMenu';
import { StatCard } from '../../components/common/StatCard';
import { TeamMembers } from '../../components/shared/TeamMembers';
import { awardPoints } from '../../services/pointsService';
import { markAsViewed, markAsDelivered } from '../../services/requestService';
import { subscribeToLostFound, returnItem, LostFoundItem } from '../../services/lostFoundService'; // ✅ Lost & Found imports
import { useSmartAgent } from '../../hooks/useSmartAgent';
import { useOnboardingTour } from '../../hooks/useOnboardingTour';
import { OverflowAlert } from '../../components/shared/OverflowAlert'; // 🔄 Overflow Alert // ✅ Onboarding tour
import { TourGuide } from '../../components/shared/TourGuide'; // ✅ Tour guide component
import { SupportTicketModal } from '../../components/shared/SupportTicketModal'; // ✅ Support ticket modal
import { RequestTimer } from '../../components/shared/RequestTimer'; // ✅ Request timer
import { ManagerAnnouncementBanner } from '../../components/shared/ManagerAnnouncementBanner'; // ✅ Manager announcements banner
import { GeneralInstructionsView } from '../../components/shared/GeneralInstructionsView'; // ✅ General instructions view
import { WhatsAppMessageModal } from '../../components/shared/WhatsAppMessageModal'; // ✅ WhatsApp message modal
import { TransferNotificationBadge } from '../../components/guest/TransferNotificationBadge'; // ✅ Room transfer notifications
import { OperationsQuickView } from '../../components/reception/OperationsQuickView'; // 📊 Operations Quick-View Bar
import { ChatInbox } from '../../components/reception/ChatInbox'; // 💬 Chat Inbox
import { BottleneckAlert } from '../../components/reception/BottleneckAlert'; // ⚠️ Bottleneck Alert
import { PendingCoffeeOrders } from '../../components/reception/PendingCoffeeOrders'; // ☕ Coffee Orders
import { RoomBillCard } from '../../components/reception/RoomBillCard'; // 💰 Room Bill
import { isRequestDelayed } from './receptionAdvancedFeatures';
import { loadBranchSettings } from '../dashboard/dashboardAdvancedFeatures';
import { PointsNotification } from '../../components/shared/PointsNotification';
import { useBrandName } from '../../hooks/useBrandName';
// DeveloperSignature is now in GlobalFooter (App.tsx)
import { BranchLocationWarning } from '../../components/auth/BranchLocationWarning';
import { checkBranchLocation } from '../../services/branchLocationService';

// ============================================================
// TYPES
// ============================================================

interface ServiceRequest {
    id: string;
    type: 'cleaning' | 'maintenance' | 'bellman' | 'coffee' | 'laundry' | 'minibar' | 'inspection' | 'extension' | 'other';
    status: 'PENDING' | 'PENDING_RECEPTION' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_INSPECTION' | 'SCHEDULED' | 'WAITING_PARTS';
    roomNumber: string;
    guestName?: string;
    guestPhone?: string; // ✅ Guest phone number (for QR requests)
    priority: 'normal' | 'urgent' | 'scheduled';
    notes?: string;
    createdAt: any;
    confirmedAt?: any;
    completedAt?: any;
    createdBy?: { id: string; name: string };
    confirmedBy?: { id: string; name: string };
    assignedTo?: { id: string; name: string };
    completedBy?: { id: string; name: string };
    // Department tracking - which department currently owns this request
    currentDepartment: 'reception' | 'housekeeping' | 'maintenance' | 'bellman';
    originDepartment?: 'reception'; // Where request was created
    // Inspection-specific
    serviceType?: string;
    source?: 'bellman_checkout' | 'reception_direct' | 'QR';
    roomCardId?: string;
    guestsInRoom?: boolean;
    guestCount?: { adults: number; children: number };
    // ✅ SaaS & Advanced Features
    deletionRequest?: {
        requestedBy: string;
        requestedAt: any;
        reason?: string;
    };
    guestIdentity?: string;
    // ✅ Scheduling
    scheduledDate?: any; // Timestamp - when the request should appear
    scheduledAt?: any; // Timestamp - alias for scheduledDate (for backward compatibility)
    // ✅ Request Journey Tracking
    timeline?: {
        created?: any;
        confirmed?: any;
        started?: any;
        completed?: any;
    };
    departmentHistory?: Array<{
        department: string;
        status: string;
        enteredAt: any;
        exitedAt?: any;
        handledBy?: {
            id: string;
            name: string;
        };
        notes?: string;
        nextDepartment?: string;
    }>;
    // ✅ Inspection Results
    inspectionResult?: 'clean' | 'damages' | 'missing_items';
    inspectionPhoto?: string; // ✅ ImgBB URL for inspection photo (damages/missing items)
    inspectionNotes?: string;
    inspectedBy?: { id: string; name: string };
    minibarConsumption?: Array<{
        productId: string;
        productName: string;
        quantity: number;
        pricePerUnit: number;
        total: number;
    }>;
    minibarTotal?: number;
    // ✅ Emergency Request Fields
    isEmergency?: boolean; // Flag to identify emergency/other requests
    emergencyStatus?: 'pending' | 'acknowledged' | 'in_progress' | 'completed'; // Status tracking
    acknowledgedBy?: { id: string; name: string } | null;
    acknowledgedAt?: any | null;
    emergencyTargetDepartment?: string; // Which department should handle this
    // Additional fields for compatibility
    [key: string]: any;
}

interface QuickAction {
    type: ServiceRequest['type'];
    icon: React.ReactNode;
    label: string;
    color: string;
    bgColor: string;
}

type ViewMode = 'cards' | 'list' | 'timeline';
type TabType = 'pending' | 'active' | 'completed';

// ============================================================
// CONSTANTS
// ============================================================

const QUICK_ACTIONS: QuickAction[] = [
    { type: 'cleaning', icon: <Sparkles className="w-6 h-6" />, label: 'تنظيف', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    { type: 'maintenance', icon: <Wrench className="w-6 h-6" />, label: 'صيانة', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    { type: 'bellman', icon: <Bell className="w-6 h-6" />, label: 'بيلمان', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    { type: 'coffee', icon: <Coffee className="w-6 h-6" />, label: 'مشروبات', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
    { type: 'inspection', icon: <Eye className="w-6 h-6" />, label: 'فحص غرفة', color: 'text-green-400', bgColor: 'bg-green-500/20' }, // ✅ Add inspection QuickAction
    { type: 'other', icon: <AlertTriangle className="w-6 h-6" />, label: 'طلبات أخرى', color: 'text-red-400', bgColor: 'bg-red-500/20' }, // ✅ Emergency/Other requests
];

const SERVICE_NAMES: Record<string, string> = {
    cleaning: 'تنظيف',
    maintenance: 'صيانة',
    bellman: 'بيلمان',
    coffee: 'مشروبات',
    laundry: 'غسيل',
    minibar: 'ميني بار',
    inspection: 'فحص غرفة',
    extension: 'تمديد الإقامة',
    other: 'طلب طارئ'
};

const STATUS_CONFIG = {
    PENDING: { label: 'جديد', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: AlertCircle },
    PENDING_RECEPTION: { label: 'بانتظار التأكيد', color: 'text-orange-400', bg: 'bg-orange-500/20', icon: AlertCircle },
    CONFIRMED: { label: 'مؤكد', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Check },
    IN_PROGRESS: { label: 'قيد التنفيذ', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Clock },
    COMPLETED: { label: 'مكتمل', color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle2 },
    WAITING_PARTS: { label: 'بانتظار قطع', color: 'text-red-400', bg: 'bg-red-500/20', icon: Wrench },
    NEEDS_INSPECTION: { label: 'يحتاج فحص', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Eye },
    SCHEDULED: { label: 'مجدول', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Calendar }
};

// ============================================================
// HELPER COMPONENTS
// ============================================================

// Stats Card - MOVED TO: components/common/StatCard.tsx
// Using centralized version for consistency (supports both 'color' and 'bgColor' props)

// Request Card - Compact and info-rich
const RequestCard: React.FC<{
    request: ServiceRequest;
    onConfirm?: () => void;
    onConfirmCompletion?: () => void; // ✅ For completed requests - close the circle
    onView?: () => void;
    onComplete?: () => void;
    onDelete?: () => void;
    onRequestDeletion?: () => void; // ✅ For non-managers to request deletion
    onMove?: () => void;
    onArchive?: () => void; // ✅ Archive lost items to Lost & Found
    userId?: string;
    userName?: string;
    userRole?: string;
    potentialMismatch?: string; // ✅ Room number if guest is found elsewhere
}> = ({ request, onConfirm, onConfirmCompletion, onView, onComplete, onDelete, onRequestDeletion, onMove, onArchive, userId, userName, userRole, potentialMismatch }) => {
    const StatusIcon = STATUS_CONFIG[request.status]?.icon || AlertCircle;
    const statusConfig = STATUS_CONFIG[request.status];

    // ✅ Calculate last action and time ago
    const { lastActionText, timeAgo } = useMemo(() => {
        // Helper to format time ago
        const getTimeAgo = (timestamp: any): string => {
            if (!timestamp) return '';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const diff = Math.floor((Date.now() - date.getTime()) / 60000);
            if (diff < 1) return 'الآن';
            if (diff < 60) return `${diff} د`;
            if (diff < 1440) return `${Math.floor(diff / 60)} س`;
            return `${Math.floor(diff / 1440)} ي`;
        };

        // Helper to get department name in Arabic
        const getDeptName = (dept: string): string => {
            const names: Record<string, string> = {
                'reception': 'الاستقبال',
                'housekeeping': 'الهاوس كيبنج',
                'maintenance': 'الصيانة',
                'bellman': 'البيلمان'
            };
            return names[dept] || dept;
        };

        // 1. Check departmentHistory for last transfer/action
        if (request.departmentHistory && request.departmentHistory.length > 0) {
            const history = request.departmentHistory;
            const lastEntry = history[history.length - 1];
            
            if (lastEntry.enteredAt) {
                const timeAgoStr = getTimeAgo(lastEntry.enteredAt);
                if (lastEntry.department) {
                    return {
                        lastActionText: `تم إرساله إلى ${getDeptName(lastEntry.department)}`,
                        timeAgo: timeAgoStr
                    };
                }
            }
            
            if (lastEntry.exitedAt) {
                const timeAgoStr = getTimeAgo(lastEntry.exitedAt);
                if (lastEntry.nextDepartment) {
                    return {
                        lastActionText: `تم إرساله من ${getDeptName(lastEntry.department || '')} إلى ${getDeptName(lastEntry.nextDepartment)}`,
                        timeAgo: timeAgoStr
                    };
                }
            }
        }

        // 2. Check timeline for status changes
        if (request.timeline) {
            if (request.timeline.completed && request.status === 'COMPLETED') {
                return {
                    lastActionText: 'تم الإكمال',
                    timeAgo: getTimeAgo(request.timeline.completed)
                };
            }
            if (request.timeline.started && request.status === 'IN_PROGRESS') {
                return {
                    lastActionText: 'تم البدء',
                    timeAgo: getTimeAgo(request.timeline.started)
                };
            }
            if (request.timeline.confirmed && request.status === 'CONFIRMED') {
                return {
                    lastActionText: 'تم التأكيد',
                    timeAgo: getTimeAgo(request.timeline.confirmed)
                };
            }
        }

        // 3. Check currentDepartment to determine current location
        if (request.currentDepartment && request.currentDepartment !== request.originDepartment) {
            return {
                lastActionText: `حالياً في ${getDeptName(request.currentDepartment)}`,
                timeAgo: getTimeAgo(request.createdAt)
            };
        }

        // 4. Fallback to createdAt
        return {
            lastActionText: 'تم الإنشاء',
            timeAgo: getTimeAgo(request.createdAt)
        };
    }, [request.departmentHistory, request.timeline, request.currentDepartment, request.originDepartment, request.status, request.createdAt]);

    const isUrgent = request.priority === 'urgent';
    const isDelayed = useMemo(() => {
        if (!request.createdAt || request.status === 'COMPLETED') return false;
        const created = request.createdAt.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
        const expectedMinutes = request.type === 'bellman' ? 15 : request.type === 'coffee' ? 20 : 30;
        return (Date.now() - created.getTime()) / 60000 > expectedMinutes;
    }, [request]);

    // Handle click with markAsViewed
    const handleClick = async () => {
        // Mark as viewed when clicked
        if (userId && userName && request.id) {
            try {
                await markAsViewed(request.id, userId, userName, 'reception');
            } catch (e) {
                // Silent fail - don't block UI
            }
        }
        // Call original onView (now opens Request Details Modal)
        if (onView) onView();
    };

    return (
        <div
            className={`
                relative
                overflow-hidden
                rounded-[2rem]
                p-5 sm:p-6 md:p-7
                
                bg-gradient-to-br from-white/6 via-white/4 to-white/3
                border border-white/10
                shadow-[0_2px_12px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)]
                transition-all duration-300 ease-out
                cursor-pointer
                touch-manipulation
                group
                hover:shadow-[0_4px_20px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]
                hover:border-primary-500/25
                hover:-translate-y-1
                hover:scale-[1.005]
                active:scale-[0.99]
                ${isUrgent ? 'ring-1 ring-red-500/40 shadow-red-500/15' : ''}
                ${isDelayed ? 'ring-1 ring-orange-500/40 shadow-orange-500/15' : ''}
                ${request.type === 'coffee' && request.status === 'COMPLETED' && request.currentDepartment === 'reception' 
                    ? 'ring-2 ring-amber-500/50 shadow-amber-500/20 bg-gradient-to-br from-amber-900/20 via-amber-800/10 to-amber-700/5' 
                    : ''}
            `}
            onClick={handleClick}
        >
            {/* Soft Background Glow - Very Subtle */}
            <div className="
                absolute -top-16 -right-16
                w-32 h-32
                rounded-full
                bg-gradient-to-br from-primary-500/6 to-primary-400/4
                blur-3xl
                opacity-0
                group-hover:opacity-100
                transition-opacity duration-500
            " />
            {/* Header - Mobile Optimized */}
            <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="text-2xl sm:text-3xl font-semibold text-white/95 tracking-tight">غ.{request.roomNumber}</span>
                    {isUrgent && (
                        <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">
                            عاجل
                        </span>
                    )}
                    {isDelayed && (
                        <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold animate-pulse">
                            متأخر
                        </span>
                    )}
                    {/* ☕ Coffee Shop Completion Badge */}
                    {request.type === 'coffee' && request.status === 'COMPLETED' && request.currentDepartment === 'reception' && (
                        <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40">
                            ☕ تم التوصيل
                        </span>
                    )}
                    {/* ✅ Emergency Request Badge */}
                    {request.isEmergency && (
                        <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-red-500/30 text-red-300 text-xs font-bold animate-pulse border border-red-500/50">
                            🔴 طلب طارئ
                        </span>
                    )}
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${statusConfig.bg} border border-white/10 flex-shrink-0 shadow-sm`}>
                    <StatusIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${statusConfig.color}`} />
                    <span className={`text-xs sm:text-sm font-semibold ${statusConfig.color} hidden sm:inline`}>{statusConfig.label}</span>
                </div>
            </div>

            {/* Content - Mobile Optimized */}
            <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-[1.25rem] flex-shrink-0 ${QUICK_ACTIONS.find(a => a.type === request.type)?.bgColor || 'bg-white/10'} flex items-center justify-center relative shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-white/8 transition-all duration-300 group-hover:scale-105`}>
                    {QUICK_ACTIONS.find(a => a.type === request.type)?.icon || <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white/60" />}
                    {/* ✅ QR Badge - Show if request is from QR */}
                    {request.source === 'QR' && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg">
                            <QrCode className="w-3 h-3 text-white" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-white/95 font-medium text-sm sm:text-base truncate tracking-wide">{SERVICE_NAMES[request.type]}</p>
                        {/* ✅ QR Badge - Text version */}
                        {request.source === 'QR' && (
                            <span className="px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center gap-1 flex-shrink-0">
                                <Smartphone className="w-3 h-3" />
                                <span className="hidden sm:inline">QR</span>
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white/65 text-xs sm:text-sm truncate">{request.guestName || 'نزيل'}</p>
                        {/* ✅ Guest Info - Show identity/phone if available */}
                        {(request.guestIdentity || request.guestPhone) && (
                            <span className="text-white/30 text-[10px] sm:text-xs flex items-center gap-1">
                                {request.guestIdentity && <span>• {request.guestIdentity}</span>}
                                {request.guestPhone && <span>• {request.guestPhone}</span>}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {/* Request Timer */}
                    {request.status !== 'COMPLETED' && request.createdAt && (
                        <RequestTimer
                            createdAt={request.createdAt}
                            targetCompletionTime={request.targetCompletionTime}
                            delayThreshold={
                                request.type === 'bellman' ? 15 :
                                request.type === 'coffee' ? 20 :
                                request.type === 'maintenance' ? 45 :
                                30 // Default for cleaning/other
                            }
                        />
                    )}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
                        <span className="text-white/60 text-[10px] sm:text-xs whitespace-nowrap text-right leading-tight max-w-[120px] sm:max-w-none">{lastActionText}</span>
                        {/* WhatsApp-style read receipt */}
                        <ReadReceipt request={request as any} size="sm" showPopup={false} />
                    </div>
                    <span className="text-white/40 text-xs sm:text-sm whitespace-nowrap font-medium">منذ {timeAgo}</span>
                </div>
            </div>

            {/* ⚠️ SMART ALERT: Room Mismatch Logic */}
            {(() => {
                // This logic needs access to 'rooms' which isn't passed to RequestCard currently.
                // We should pass a 'mismatchRoom' prop if detected by dashboard.
                // Assuming we pass it or handle it inside Dashboard.
                // Let's rely on `isMismatch` passed from parent.
                return null;
            })()}
            {/* We will implement the actual detection in the parent component and pass a prop */}

            {/* ⚠️ SMART ALERT: Room Mismatch */}
            {potentialMismatch && (
                <div className="mb-3 p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-start gap-2 animate-pulse">
                    <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-orange-300 text-xs font-bold">تنبيه: محتمل اختلاف الغرفة</p>
                        <p className="text-orange-400/80 text-[10px]">
                            النزيل مسجل حالياً في غرفة <b>{potentialMismatch}</b>. هل تريد نقل الطلب؟
                        </p>
                    </div>
                    {onMove && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onMove(); }}
                            className="mr-auto px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded shadow-sm"
                        >
                            نقل
                        </button>
                    )}
                </div>
            )}

            {/* 🗑️ DELETION REQUEST ALERT */}
            {request.deletionRequest && (
                <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-red-400" />
                        <div>
                            <p className="text-red-300 text-xs font-bold">طلب حذف معلق</p>
                            <p className="text-red-400/60 text-[10px]">بواسطة: {request.deletionRequest.requestedBy}</p>
                        </div>
                    </div>
                    {/* If Manager, show Approval Badge */}
                    {['manager', 'admin', 'owner'].includes(userRole || '') && (
                        <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full">
                            مطلوب الموافقة
                        </span>
                    )}
                </div>
            )}

            {/* ✅ QR Request Info - Show guest verification info */}
            {request.source === 'QR' && request.status === 'PENDING_RECEPTION' && (
                <div className="mb-3 p-2 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-start gap-2">
                    <QrCode className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-teal-300 text-xs font-bold">طلب من QR - يحتاج تأكيد</p>
                        <p className="text-teal-400/80 text-[10px] mt-0.5">
                            النزيل: <b>{request.guestName || 'غير محدد'}</b>
                            {request.guestIdentity && ` • هوية: ${request.guestIdentity}`}
                            {request.guestPhone && ` • جوال: ${request.guestPhone}`}
                        </p>
                        <p className="text-teal-400/60 text-[10px] mt-1">
                            يرجى التحقق من البيانات والتأكيد قبل إرسال الطلب للقسم المختص
                        </p>
                    </div>
                </div>
            )}

            {/* ✅ Inspection Results - Show photo for damages/missing items */}
            {request.inspectionResult && (request.inspectionResult === 'damages' || request.inspectionResult === 'missing_items') && request.inspectionPhoto && (
                <div className="mb-3 p-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                        <p className="text-orange-300 text-xs font-bold">
                            {request.inspectionResult === 'damages' ? '⚠️ تلفيات في الغرفة' : '📦 مفقودات من الغرفة'}
                        </p>
                    </div>
                    <img 
                        src={request.inspectionPhoto} 
                        alt={request.inspectionResult === 'damages' ? 'صورة التلفيات' : 'صورة المفقودات'}
                        className="w-full h-32 sm:h-40 object-cover rounded-lg mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                            e.stopPropagation();
                            // Open image in fullscreen/modal
                            window.open(request.inspectionPhoto, '_blank');
                        }}
                    />
                    {request.inspectionNotes && (
                        <p className="text-orange-400/80 text-[10px] mt-1">{request.inspectionNotes}</p>
                    )}
                </div>
            )}

            {/* ✅ Minibar Consumption - Show on card */}
            {request.minibarConsumption && request.minibarConsumption.length > 0 && (
                <div className="mb-3 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center gap-2 mb-1.5">
                        <ShoppingCart className="w-4 h-4 text-green-400" />
                        <p className="text-green-300 text-xs font-bold">استهلاك الميني بار</p>
                        {request.minibarTotal && (
                            <span className="mr-auto text-green-400 text-xs font-bold">الإجمالي: {request.minibarTotal} ر.س</span>
                        )}
                    </div>
                    <div className="space-y-1">
                        {request.minibarConsumption.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[10px] text-green-400/80">
                                <span>{item.productName}</span>
                                <span>{item.quantity} × {item.pricePerUnit} ر.س = {item.total} ر.س</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ✅ Lost Items Card - Archive Button */}
            {(request as any).isLostItemsCard && (request as any).lostItemsStatus === 'open' && onArchive && (
                <div className="mb-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-purple-400" />
                            <div>
                                <p className="text-purple-300 text-xs font-bold">كارت مفقودات مفتوح</p>
                                <p className="text-purple-400/60 text-[10px]">جاهز للنقل للأرشيف</p>
                            </div>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onArchive(); }}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold text-sm flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/30 active:scale-95 transition-all"
                        >
                            <Archive className="w-4 h-4" />
                            نقل للأرشيف
                        </button>
                    </div>
                </div>
            )}

            {/* Actions - Mobile Optimized */}
            <div className="flex gap-1.5 sm:gap-2">
                {(request.status === 'PENDING' || request.status === 'PENDING_RECEPTION') && onConfirm && (
                    <div className="flex gap-1.5 sm:gap-2 flex-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                            className="
                                relative
                                overflow-hidden
                                flex-1 
                                py-4 sm:py-5 px-6 sm:px-7 
                                rounded-[1.5rem]
                                bg-gradient-to-r from-green-500/95 via-emerald-500/95 to-green-600/95 
                                text-white font-semibold text-base sm:text-lg 
                                flex items-center justify-center gap-3 sm:gap-4 
                                shadow-[0_2px_12px_rgba(34,197,94,0.25),0_1px_4px_rgba(34,197,94,0.15)]
                                hover:shadow-[0_4px_20px_rgba(34,197,94,0.35),0_2px_8px_rgba(34,197,94,0.2)]
                                hover:scale-[1.01]
                                active:scale-[0.99]
                                transition-all duration-300 ease-out
                                touch-manipulation
                                group
                            "
                        >
                            <Check className="w-5 h-5 sm:w-6 sm:h-6 relative z-10 transition-transform duration-300 group-hover:scale-105" />
                            <span className="relative z-10">تأكيد</span>
                        </button>
                        {onMove && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onMove(); }}
                                className="px-3 rounded-xl bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-all touch-manipulation flex items-center justify-center"
                                title="نقل النزيل"
                            >
                                <Repeat className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
                {(request.status === 'CONFIRMED' || request.status === 'IN_PROGRESS') && onComplete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onComplete(); }}
                        className="
                            relative
                            overflow-hidden
                            flex-1 
                            py-4 sm:py-5 px-5 sm:px-6 
                            rounded-[1.5rem]
                            bg-gradient-to-r from-blue-500/95 via-indigo-500/95 to-blue-600/95 
                            text-white font-semibold text-sm sm:text-base 
                            flex items-center justify-center gap-3 sm:gap-3.5 
                            shadow-[0_2px_12px_rgba(59,130,246,0.25),0_1px_4px_rgba(59,130,246,0.15)]
                            hover:shadow-[0_4px_20px_rgba(59,130,246,0.35),0_2px_8px_rgba(59,130,246,0.2)]
                            hover:scale-[1.01]
                            active:scale-[0.99]
                            transition-all duration-300 ease-out
                            touch-manipulation
                            group
                        "
                    >
                        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 relative z-10 transition-transform duration-300 group-hover:scale-105" />
                        <span className="relative z-10">إتمام</span>
                    </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onView?.(); }}
                    className="py-2.5 sm:py-2 px-3 sm:px-4 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 active:scale-95 transition-all touch-manipulation"
                >
                    <Eye className="w-4 h-4" />
                </button>
                {/* ✅ Delete/Request Deletion Button */}
                {!request.deletionRequest && (
                    // Only show delete button if there's no pending deletion request
                    <>
                        {/* Manager/Admin/Owner: Direct Delete */}
                        {['manager', 'admin', 'owner'].includes(userRole || '') && onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="py-2.5 sm:py-2 px-3 sm:px-4 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all touch-manipulation flex items-center gap-1.5"
                                title="حذف الطلب"
                            >
                                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        )}
                        {/* Regular Employees: Request Deletion */}
                        {!['manager', 'admin', 'owner'].includes(userRole || '') && onRequestDeletion && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRequestDeletion(); }}
                                className="py-2.5 sm:py-2 px-3 sm:px-4 rounded-xl bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 active:scale-95 transition-all touch-manipulation flex items-center gap-1.5"
                                title="طلب حذف (يرسل للمدير)"
                            >
                                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="hidden sm:inline text-xs font-medium">طلب حذف</span>
                            </button>
                        )}
                    </>
                )}
                {/* Manager: Approve/Reject Deletion Request */}
                {request.deletionRequest && ['manager', 'admin', 'owner'].includes(userRole || '') && onDelete && (
                    <div className="flex gap-1.5">
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            className="px-3 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 active:scale-95 transition-all touch-manipulation flex items-center gap-1"
                            title="موافقة على الحذف"
                        >
                            <CheckCircle className="w-4 h-4" />
                        </button>
                        {onRequestDeletion && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRequestDeletion(); }}
                                className="px-3 py-2 rounded-xl bg-white/10 text-white/60 hover:bg-white/20 active:scale-95 transition-all touch-manipulation"
                                title="رفض طلب الحذف"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ✅ Lost & Found Modal - Display and Manage Lost Items
const LostFoundModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    branchId: string;
    tenantId: string;
    userId: string;
    userName: string;
}> = ({ isOpen, onClose, branchId, tenantId, userId, userName }) => {
    const { success, error } = useUX();
    const [items, setItems] = useState<LostFoundItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        const unsubscribe = subscribeToLostFound(branchId, (data) => {
            setItems(data);
            setLoading(false);
        });
        return unsubscribe;
    }, [isOpen, branchId]);

    const handleReturnItem = async (itemId: string) => {
        try {
            await returnItem(itemId, { id: userId, name: userName });
            
            // ✅ Create Live Feed entry for return
            try {
                const item = items.find(i => i.id === itemId);
                if (item) {
                    await addDoc(collection(db, 'live_feed'), {
                        type: 'missing_items_returned',
                        branchId: branchId,
                        tenantId: tenantId,
                        roomNumber: item.roomNumber || '',
                        description: `تم تسليم المفقودات: ${item.description}`,
                        photoUrl: item.imageUrl || null,
                        returnedBy: { id: userId, name: userName },
                        createdAt: Timestamp.now(),
                        status: 'returned',
                        itemId: itemId
                    });
                }
            } catch (e) {
                console.warn('Failed to create live feed entry:', e);
            }

            success('تم تسليم المفقودات بنجاح');
        } catch (err: any) {
            console.error('Error returning item:', err);
            error('فشل تسليم المفقودات: ' + (err.message || 'خطأ غير معروف'));
        }
    };

    const formatDate = (timestamp: any): string => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTimeAgo = (timestamp: any): string => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return 'الآن';
        if (diff < 60) return `منذ ${diff} دقيقة`;
        if (diff < 1440) return `منذ ${Math.floor(diff / 60)} ساعة`;
        return `منذ ${Math.floor(diff / 1440)} يوم`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'none' }}>
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Package className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">المفقودات والموجودات</h2>
                            <p className="text-white/60 text-sm">جميع العناصر المفقودة من فحص الغرف</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <AdoraLoader size="md" message="جاري التحميل..." />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-12">
                            <Package className="w-16 h-16 text-white/20 mx-auto mb-4" />
                            <p className="text-white/40">لا توجد مفقودات مسجلة</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 3xl:gap-12">
                            {items.map(item => (
                                <div key={item.id} className="pro-card p-5 sm:p-6 rounded-2xl hover:shadow-xl hover:shadow-primary-500/20 transition-all duration-200 group">
                                    {/* Header */}
                                    <div className="flex items-start gap-4 mb-4">
                                        {item.imageUrl ? (
                                            <img
                                                src={item.imageUrl}
                                                alt={item.description}
                                                className="w-16 h-16 rounded-xl object-cover"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
                                                📦
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <p className="text-white font-medium text-sm mb-1">{item.description}</p>
                                            <p className="text-white/50 text-xs">غرفة {item.roomNumber || '-'}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                            item.status === 'found' ? 'bg-blue-500/20 text-blue-400' :
                                            item.status === 'claimed' ? 'bg-yellow-500/20 text-yellow-400' :
                                            item.status === 'returned' ? 'bg-green-500/20 text-green-400' :
                                            'bg-gray-500/20 text-gray-400'
                                        }`}>
                                            {item.status === 'found' ? 'موجود' :
                                             item.status === 'claimed' ? 'مطالب به' :
                                             item.status === 'returned' ? 'تم التسليم' : 'تم التخلص'}
                                        </span>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-2 mb-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-white/60">تاريخ العثور:</span>
                                            <span className="text-white/80">{formatDate(item.createdAt)}</span>
                                        </div>
                                        {item.foundBy && (
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-white/60">وجدها:</span>
                                                <span className="text-white/80">{item.foundBy.name}</span>
                                            </div>
                                        )}
                                        {item.returnedBy && item.returnedAt && (
                                            <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="text-green-400 font-bold">تم التسليم</span>
                                                    <span className="text-green-400/80">{formatDate(item.returnedAt)}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-green-400/60">بواسطة:</span>
                                                    <span className="text-green-400/80">{item.returnedBy.name}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs mt-1">
                                                    <span className="text-green-400/60">الوقت:</span>
                                                    <span className="text-green-400/80">{getTimeAgo(item.returnedAt)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {item.status !== 'returned' && item.status !== 'disposed' && (
                                        <button
                                            onClick={() => handleReturnItem(item.id)}
                                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-green-500/30 active:scale-95 transition-all"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            تم التسليم
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ✅ Request Details Modal - Rich Information Display
const RequestDetailsModal: React.FC<{
    request: ServiceRequest | null;
    isOpen: boolean;
    onClose: () => void;
    branchId: string;
}> = ({ request, isOpen, onClose, branchId }) => {
    if (!isOpen || !request) return null;

    const getDeptName = (dept: string): string => {
        const names: Record<string, string> = {
            'reception': 'الاستقبال',
            'housekeeping': 'الهاوس كيبنج',
            'maintenance': 'الصيانة',
            'bellman': 'البيلمان'
        };
        return names[dept] || dept;
    };

    const formatTime = (timestamp: any): string => {
        if (!timestamp) return 'غير محدد';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTimeAgo = (timestamp: any): string => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return 'الآن';
        if (diff < 60) return `منذ ${diff} دقيقة`;
        if (diff < 1440) return `منذ ${Math.floor(diff / 60)} ساعة`;
        return `منذ ${Math.floor(diff / 1440)} يوم`;
    };

    // Build timeline from departmentHistory and timeline
    const timelineEvents: Array<{ action: string; time: any; department?: string; by?: string }> = [];
    
    // 1. Created
    if (request.createdAt) {
        timelineEvents.push({
            action: 'تم إنشاء الطلب',
            time: request.createdAt,
            department: request.originDepartment ? getDeptName(request.originDepartment) : undefined,
            by: request.createdBy?.name
        });
    }

    // 2. Department History - Build complete journey
    if (request.departmentHistory && request.departmentHistory.length > 0) {
        request.departmentHistory.forEach((entry: any, index: number) => {
            // When request entered this department
            if (entry.enteredAt) {
                timelineEvents.push({
                    action: `تم إرساله إلى ${getDeptName(entry.department)}`,
                    time: entry.enteredAt,
                    department: getDeptName(entry.department),
                    by: entry.handledBy?.name
                });
            }
            // When request exited/left this department
            if (entry.exitedAt) {
                const nextDept = entry.nextDepartment ? `إلى ${getDeptName(entry.nextDepartment)}` : 'من';
                timelineEvents.push({
                    action: `تم إرساله ${nextDept} ${getDeptName(entry.department)}`,
                    time: entry.exitedAt,
                    department: getDeptName(entry.department),
                    by: entry.handledBy?.name
                });
            }
        });
    }

    // 3. Timeline events
    if (request.timeline) {
        if (request.timeline.confirmed) {
            timelineEvents.push({
                action: 'تم التأكيد',
                time: request.timeline.confirmed,
                by: request.confirmedBy?.name
            });
        }
        if (request.timeline.started) {
            timelineEvents.push({
                action: 'تم البدء',
                time: request.timeline.started,
                by: request.assignedTo?.name || (request as any).startedBy
            });
        }
        if (request.timeline.completed) {
            timelineEvents.push({
                action: 'تم الإكمال',
                time: request.timeline.completed,
                by: request.completedBy?.name
            });
        }
    }

    // Sort by time (newest first)
    timelineEvents.sort((a, b) => {
        const aTime = a.time?.toDate ? a.time.toDate().getTime() : new Date(a.time).getTime();
        const bTime = b.time?.toDate ? b.time.toDate().getTime() : new Date(b.time).getTime();
        return bTime - aTime;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200" style={{ backdropFilter: 'none' }}>
            <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${QUICK_ACTIONS.find(a => a.type === request.type)?.bgColor || 'bg-white/10'} flex items-center justify-center`}>
                            {QUICK_ACTIONS.find(a => a.type === request.type)?.icon || <Sparkles className="w-6 h-6 text-white/60" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">تفاصيل الطلب</h2>
                            <p className="text-sm text-white/60">غرفة {request.roomNumber} - {SERVICE_NAMES[request.type]}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Basic Info */}
                    <div className="space-y-4 mb-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/60 text-sm mb-1">الحالة</p>
                                <p className="text-white font-medium">{STATUS_CONFIG[request.status]?.label || request.status}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/60 text-sm mb-1">الأولوية</p>
                                <p className="text-white font-medium">{request.priority === 'urgent' ? 'عاجل' : 'عادي'}</p>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-white/5 rounded-xl">
                            <p className="text-white/60 text-sm mb-1">القسم الحالي</p>
                            <p className="text-white font-medium">{request.currentDepartment ? getDeptName(request.currentDepartment) : 'غير محدد'}</p>
                        </div>

                        {request.guestName && (
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/60 text-sm mb-1">اسم النزيل</p>
                                <p className="text-white font-medium">{request.guestName}</p>
                                {request.guestIdentity && (
                                    <p className="text-white/40 text-xs mt-1">الهوية: {request.guestIdentity}</p>
                                )}
                                {request.guestPhone && (
                                    <p className="text-white/40 text-xs mt-1">الجوال: {request.guestPhone}</p>
                                )}
                            </div>
                        )}

                        {request.notes && (
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/60 text-sm mb-1">ملاحظات</p>
                                <p className="text-white">{request.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Timeline */}
                    <div className="border-t border-white/10 pt-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            سجل العمليات والتتبع الكامل
                        </h3>
                        <div className="space-y-4">
                            {timelineEvents.length > 0 ? (
                                timelineEvents.map((event, index) => (
                                    <div key={index} className="flex gap-4">
                                        <div className="flex flex-col items-center pt-1">
                                            <div className="w-3 h-3 rounded-full bg-primary-500 ring-2 ring-primary-500/30" />
                                            {index < timelineEvents.length - 1 && (
                                                <div className="w-0.5 h-full bg-white/10 min-h-[60px] mt-1" />
                                            )}
                                        </div>
                                        <div className="flex-1 pb-4">
                                            <p className="text-white font-medium text-sm">{event.action}</p>
                                            {event.department && (
                                                <p className="text-white/60 text-xs mt-0.5">📍 في {event.department}</p>
                                            )}
                                            {event.by && (
                                                <p className="text-white/40 text-[11px] mt-1">👤 بواسطة: {event.by}</p>
                                            )}
                                            <p className="text-white/40 text-[11px] mt-1.5 flex items-center gap-2">
                                                <Clock className="w-3 h-3" />
                                                {formatTime(event.time)}
                                            </p>
                                            <p className="text-white/30 text-[10px] mt-0.5">{getTimeAgo(event.time)}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 bg-white/5 rounded-xl text-center">
                                    <p className="text-white/40 text-sm">لا توجد عمليات مسجلة</p>
                                    <p className="text-white/30 text-xs mt-1">تم الإنشاء: {formatTime(request.createdAt)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* ✅ Inspection Results */}
                    {request.inspectionResult && (
                        <div className="border-t border-white/10 pt-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                {request.inspectionResult === 'clean' && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                                {(request.inspectionResult === 'damages' || request.inspectionResult === 'missing_items') && <AlertCircle className="w-5 h-5 text-orange-400" />}
                                نتيجة الفحص
                            </h3>
                            <div className="space-y-4">
                                <div className="p-4 bg-white/5 rounded-xl">
                                    <p className="text-white/60 text-sm mb-1">الحالة</p>
                                    <p className="text-white font-medium">
                                        {request.inspectionResult === 'clean' && '✅ الغرفة كاملة - جاهزة'}
                                        {request.inspectionResult === 'damages' && '⚠️ الغرفة بها تلفيات'}
                                        {request.inspectionResult === 'missing_items' && '📦 الغرفة بها مفقودات'}
                                    </p>
                                </div>

                                {/* Inspection Photo */}
                                {request.inspectionPhoto && (request.inspectionResult === 'damages' || request.inspectionResult === 'missing_items') && (
                                    <div className="p-4 bg-white/5 rounded-xl">
                                        <p className="text-white/60 text-sm mb-3">
                                            {request.inspectionResult === 'damages' ? 'صورة التلفيات' : 'صورة المفقودات'}
                                        </p>
                                        <img 
                                            src={request.inspectionPhoto} 
                                            alt={request.inspectionResult === 'damages' ? 'صورة التلفيات' : 'صورة المفقودات'}
                                            className="w-full h-64 object-contain rounded-xl cursor-pointer hover:opacity-80 transition-opacity bg-white/5 p-2"
                                            onClick={() => window.open(request.inspectionPhoto, '_blank')}
                                        />
                                    </div>
                                )}

                                {/* Inspection Notes */}
                                {request.inspectionNotes && (
                                    <div className="p-4 bg-white/5 rounded-xl">
                                        <p className="text-white/60 text-sm mb-1">ملاحظات الفحص</p>
                                        <p className="text-white">{request.inspectionNotes}</p>
                                    </div>
                                )}

                                {/* Inspected By */}
                                {request.inspectedBy?.name && (
                                    <div className="p-4 bg-white/5 rounded-xl">
                                        <p className="text-white/60 text-sm mb-1">تم الفحص بواسطة</p>
                                        <p className="text-white font-medium">{request.inspectedBy.name}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ✅ Minibar Consumption */}
                    {request.minibarConsumption && request.minibarConsumption.length > 0 && (
                        <div className="border-t border-white/10 pt-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-green-400" />
                                استهلاك الميني بار
                            </h3>
                            <div className="space-y-2">
                                {request.minibarConsumption.map((item, idx) => (
                                    <div key={idx} className="p-4 bg-white/5 rounded-xl flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-medium">{item.productName}</p>
                                            <p className="text-white/60 text-sm">الكمية: {item.quantity} × {item.pricePerUnit} ر.س</p>
                                        </div>
                                        <p className="text-green-400 font-bold text-lg">{item.total} ر.س</p>
                                    </div>
                                ))}
                                {request.minibarTotal && (
                                    <div className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl flex items-center justify-between mt-4">
                                        <p className="text-white font-bold">الإجمالي</p>
                                        <p className="text-green-400 font-bold text-xl">{request.minibarTotal} ر.س</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Additional Info */}
                    {(request as any).afterPhoto && (
                        <div className="border-t border-white/10 pt-6">
                            <h3 className="text-lg font-bold text-white mb-4">صور بعد العمل</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <img 
                                    src={(request as any).afterPhoto} 
                                    alt="بعد العمل" 
                                    className="w-full h-32 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => window.open((request as any).afterPhoto, '_blank')}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex gap-3">
                    <button
                        onClick={() => {
                            // Open room history
                            window.location.href = `#room-history-${request.roomNumber}`;
                        }}
                        className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                    >
                        عرض تاريخ الغرفة
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
                    >
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
};

// Quick Create Modal
const QuickCreateModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    selectedType: ServiceRequest['type'] | null;
    onSubmit: (data: { roomNumber: string; type: string; priority: 'normal' | 'urgent'; notes: string; needsCart?: boolean; guestsInRoom?: boolean }) => void;
    rooms: { floor: number; rooms: string[] }[];
    requests: ServiceRequest[]; // Current active requests to check for duplicates
}> = ({ isOpen, onClose, selectedType, onSubmit, rooms, requests }) => {
    const [step, setStep] = useState<'room' | 'details'>('room');
    const [selectedRoom, setSelectedRoom] = useState('');
    const [priority, setPriority] = useState<'normal' | 'urgent' | 'scheduled'>('normal');
    const [notes, setNotes] = useState('');
    const [roomNumber, setRoomNumber] = useState('');
    const [showFloorSelector, setShowFloorSelector] = useState(false);
    const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
    // Bellman-specific options
    const [needsCart, setNeedsCart] = useState(false);
    const [guestsInRoom, setGuestsInRoom] = useState(false);
    // Scheduling
    // Scheduling
    const [scheduledDateTime, setScheduledDateTime] = useState('');
    const [lastRequest, setLastRequest] = useState<{ type: string; date: string; time: string } | null>(null);
    // ✅ Emergency Request - Department Selection
    const [emergencyTargetDepartment, setEmergencyTargetDepartment] = useState<string>('');
    const [previousEmergencyRequests, setPreviousEmergencyRequests] = useState<Array<{ description: string; date: string; department: string }>>([]);
    // ✅ Validation Error (replaces native alert)
    const [validationError, setValidationError] = useState<string | null>(null);

    // ✅ Fetch Last Request Info (Debounced)
    useEffect(() => {
        if (!roomNumber || roomNumber.length < 3) {
            setLastRequest(null);
            setPreviousEmergencyRequests([]);
            return;
        }

        const fetchLastRequest = async () => {
            try {
                // Query for the specific room, ordered by date descending, limit 1
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
                        setLastRequest({
                            type: SERVICE_NAMES[data.type] || data.type,
                            date: date.toLocaleDateString('ar-EG'),
                            time: date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                        });
                    }
                } else {
                    setLastRequest(null);
                }

                // ✅ Fetch previous emergency requests for smart reminder
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
                                // Only show if still active (not completed)
                                const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                                previous.push({
                                    description: data.notes || 'لا يوجد وصف',
                                    date: date.toLocaleDateString('ar-EG') + ' ' + date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                                    department: data.emergencyTargetDepartment || 'غير محدد'
                                });
                            }
                        });
                        setPreviousEmergencyRequests(previous);
                    } catch (err) {
                        // Index might not exist, ignore
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

        const timer = setTimeout(fetchLastRequest, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [roomNumber, selectedType]);

    // ✅ Calculate Blocked Rooms (Real-time)
    const activeStats = useMemo(() => {
        if (!selectedType) return { blockedRooms: [], activeRequest: null };

        const activeReqs = requests.filter(r =>
            r.status === 'CONFIRMED' || r.status === 'IN_PROGRESS' || r.status === 'NEEDS_INSPECTION' || r.status === 'SCHEDULED' || r.status === 'PENDING'
        );

        // Get active request for CURRENTLY typed room (for text warning)
        // ONLY show warning if type matches (or if it's a conflict we care about)
        const currentActiveInfo = roomNumber
            ? activeReqs.find(r => r.roomNumber === roomNumber && r.type === selectedType)
            : null;

        // Calculate blocked rooms for selector
        const blocked: string[] = [];

        // Group by room to count stats efficiently
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
                // Determine if blocked for coffee (>= 5 requests)
                if (stats.coffee >= 5) blocked.push(room);
            } else {
                // Determine if blocked for other types:
                // BLOCK only if there is already a request of the SAME type
                if (stats.sameType > 0) blocked.push(room);
            }
        });

        return { blockedRooms: blocked, activeRequest: currentActiveInfo };
    }, [requests, selectedType, roomNumber]);

    useEffect(() => {
        if (isOpen) {
            setStep('room');
            setSelectedRoom('');
            setRoomNumber(''); // Clear manual room input
            setPriority('normal');
            setNotes('');
            setSelectedFloor(rooms[0]?.floor || null);
            // Cart is pre-selected for bellman (can be toggled off)
            setNeedsCart(selectedType === 'bellman');
            setGuestsInRoom(false);
            setScheduledDateTime('');
            // ✅ Reset emergency department for 'other' type
            setEmergencyTargetDepartment(selectedType === 'other' ? '' : '');
            setPreviousEmergencyRequests([]);
            // ✅ Clear validation error when modal opens
            setValidationError(null);
        }
    }, [isOpen, rooms, selectedType]);

    const handleRoomSelect = (room: string) => {
        setSelectedRoom(room);
        setStep('details');
        haptic('light');
    };

    const handleSubmit = () => {
        if (!selectedRoom || !selectedType) return;

        // ✅ REQUIRE NOTES FOR MAINTENANCE (with inline error state)
        if (selectedType === 'maintenance' && !notes.trim()) {
            setValidationError('الرجاء كتابة تفاصيل المشكلة (مطلوب للصيانة)');
            haptic('error');
            return;
        }

        // ✅ REQUIRE NOTES AND DEPARTMENT FOR EMERGENCY/OTHER
        if (selectedType === 'other') {
            if (!notes.trim()) {
                setValidationError('الرجاء كتابة وصف الطلب');
                haptic('error');
                return;
            }
            if (!emergencyTargetDepartment) {
                setValidationError('الرجاء اختيار القسم المرسل إليه');
                haptic('error');
                return;
            }
        }
        
        // Clear validation error on successful submit
        setValidationError(null);

        // Build scheduled datetime if priority is scheduled
        let scheduledAt: Date | undefined;
        if (priority === 'scheduled' && scheduledDateTime) {
            scheduledAt = new Date(scheduledDateTime);
        }
        onSubmit({
            roomNumber: selectedRoom,
            type: selectedType,
            priority: priority as any,
            notes,
            needsCart,
            guestsInRoom,
            scheduledAt,
            // ✅ Emergency request data
            emergencyTargetDepartment: selectedType === 'other' ? emergencyTargetDepartment : undefined
        } as any);
        onClose();
    };

    if (!isOpen || !selectedType) return null;

    const action = QUICK_ACTIONS.find(a => a.type === selectedType);

    return (
        <div className="pro-modal-backdrop flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="pro-modal w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="pro-modal-header">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${action?.bgColor} flex items-center justify-center`}>
                            {action?.icon}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">طلب {action?.label}</h3>
                            <p className="text-sm text-white/50">
                                {step === 'room' ? 'اختر الغرفة' : `غرفة ${selectedRoom}`}
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
                            {/* Manual Room Input - First */}
                            {/* ⚠️ Real-time Warning (Above Input) */}
                            {activeStats.activeRequest && selectedType !== 'coffee' && (
                                <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 shadow-lg shadow-orange-500/5">
                                        <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                                        <span className="text-xs text-orange-300 font-medium">
                                            يوجد طلب {SERVICE_NAMES[activeStats.activeRequest.type] || 'نشط'} قيد التنفيذ
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* ℹ️ History Warning */}
                            {!activeStats.activeRequest && lastRequest && (
                                <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/5">
                                        <History className="w-3.5 h-3.5 text-blue-400" />
                                        <div className="text-xs text-blue-300 font-medium flex gap-1">
                                            <span>آخر طلب: {lastRequest.type}</span>
                                            <span className="opacity-60">|</span>
                                            <span>{lastRequest.date}</span>
                                            <span className="opacity-60">|</span>
                                            <span>{lastRequest.time}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Manual Room Input - First */}
                            <div className="relative">
                                <input
                                    type="text"
                                    value={roomNumber}
                                    onChange={(e) => setRoomNumber(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && roomNumber) {
                                            handleRoomSelect(roomNumber);
                                        }
                                    }}
                                    placeholder="اكتب رقم الغرفة"
                                    className={`input text-center text-lg transition-all ${activeStats.activeRequest && selectedType !== 'coffee'
                                        ? 'border-orange-500/50 focus:border-orange-500 focus:ring-orange-500/20'
                                        : ''
                                        }`}
                                    autoFocus
                                />
                                {roomNumber && !activeStats.activeRequest && (
                                    <button
                                        onClick={() => handleRoomSelect(roomNumber)}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium"
                                    >
                                        تأكيد
                                    </button>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="flex items-center gap-2 text-white/30">
                                <div className="flex-1 h-px bg-white/10"></div>
                                <span className="text-xs">أو اختر من القائمة</span>
                                <div className="flex-1 h-px bg-white/10"></div>
                            </div>

                            {/* Floor Selector Button */}
                            <button
                                onClick={() => setShowFloorSelector(true)}
                                className="w-full py-3.5 rounded-2xl pro-card hover:bg-white/15 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold"
                            >
                                <Building2 className="w-4 h-4 text-primary-400" />
                                <span className="text-white/80">اختر الغرفة حسب الدور</span>
                            </button>

                            {/* Floor Room Selector Modal */}
                            <FloorRoomSelector
                                rooms={rooms.flatMap(f => f.rooms)}
                                selectedRoom={selectedRoom}
                                onSelect={handleRoomSelect}
                                isOpen={showFloorSelector}
                                onClose={() => setShowFloorSelector(false)}
                                blockedRooms={activeStats.blockedRooms}
                            />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Priority */}
                            <div>
                                <label className="block text-sm text-white/60 mb-2">الأولوية</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPriority('normal')}
                                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${priority === 'normal'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                                            }`}
                                    >
                                        عادي
                                    </button>
                                    <button
                                        onClick={() => setPriority('urgent')}
                                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${priority === 'urgent'
                                            ? 'bg-red-500 text-white'
                                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                                            }`}
                                    >
                                        🔥 عاجل
                                    </button>
                                    <button
                                        onClick={() => setPriority('scheduled')}
                                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${priority === 'scheduled'
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                                            }`}
                                    >
                                        📅 مجدول
                                    </button>
                                </div>
                            </div>

                            {/* Scheduled DateTime Picker */}
                            {priority === 'scheduled' && (
                                <div className="space-y-2">
                                    <label className="block text-sm text-white/60">موعد التنفيذ بعد</label>
                                    {/* Quick Time Buttons */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { label: '30 د', minutes: 30 },
                                            { label: '1 س', minutes: 60 },
                                            { label: '2 س', minutes: 120 },
                                            { label: '3 س', minutes: 180 },
                                            { label: '4 س', minutes: 240 },
                                            { label: '5 س', minutes: 300 },
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
                                    {/* Show selected time */}
                                    {scheduledDateTime && (
                                        <div className="text-center text-sm text-primary-400 py-2 bg-primary-500/10 rounded-lg">
                                            {new Date(scheduledDateTime).toLocaleString('ar-SA', {
                                                weekday: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    )}
                                    {/* Custom datetime option */}
                                    <input
                                        type="datetime-local"
                                        value={scheduledDateTime}
                                        onChange={(e) => setScheduledDateTime(e.target.value)}
                                        className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                    />
                                </div>
                            )}

                            {/* Bellman Options: Cart \u0026 Guest In Room */}
                            <div className="flex gap-2">
                                {/* Cart - Only for Bellman */}
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
                                        <span className="text-sm font-medium">عربة</span>
                                    </button>
                                )}
                                {/* Guest In Room - For All */}
                                <button
                                    type="button"
                                    onClick={() => setGuestsInRoom(!guestsInRoom)}
                                    className={`flex-1 py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${guestsInRoom
                                        ? 'bg-purple-500/20 border border-purple-500/50 text-purple-400'
                                        : 'bg-white/10 border border-white/10 text-white/60 hover:bg-white/20'
                                        }`}
                                >
                                    <span>👥</span>
                                    <span className="text-sm font-medium">بالغرفة</span>
                                </button>
                            </div>

                            {/* ✅ Emergency Request - Department Selection */}
                            {selectedType === 'other' && (
                                <div>
                                    <label className="block text-sm text-white/60 mb-2">اختر القسم المرسل إليه *</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'housekeeping', label: 'الهاوس كيبنج', icon: '🧹' },
                                            { key: 'maintenance', label: 'الصيانة', icon: '🔧' },
                                            { key: 'bellman', label: 'البيلمان', icon: '🚪' },
                                            { key: 'coffee_shop', label: 'الكوفي شوب', icon: '☕' },
                                            { key: 'procurement', label: 'المشتريات', icon: '🛒' }
                                        ].map(dept => (
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

                            {/* ✅ Previous Emergency Requests Warning */}
                            {selectedType === 'other' && previousEmergencyRequests.length > 0 && (
                                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle className="w-4 h-4 text-orange-400" />
                                        <p className="text-orange-300 text-xs font-bold">طلبات طارئة سابقة لنفس الغرفة</p>
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

                            {/* Notes */}
                            <div>
                                <label className="block text-sm text-white/60 mb-2">
                                    {selectedType === 'maintenance' ? 'وصف المشكلة (مطلوب) *' : 
                                     selectedType === 'other' ? 'وصف الطلب (مطلوب) *' : 
                                     'ملاحظات (اختياري)'}
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder={selectedType === 'other' ? 'مثال: النزيل يرغب في منشفتين...' : 'أي تفاصيل إضافية...'}
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
    <p className="text-center text-white/40 text-sm">اضغط على رقم الغرفة للمتابعة</p>
) : (
    <>
        {/* ✅ Validation Error Display (replaces native alert) */}
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
                                رجوع
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold hover:shadow-lg hover:shadow-primary-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <Send className="w-5 h-5" />
                                إنشاء الطلب
                            </button>
                        </div>
                    </>
                )}
                </div>
            </div>
        </div >
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ReceptionDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { success, error, haptic, playSound } = useUX();
    const brandName = useBrandName();

    // Voice Agent
    const {
        processCommand,
        // 🛡️ Error Recovery
        errorCount,
        isFallbackMode,
        lastError,
        retryLastCommand,
        resetErrors
    } = useSmartAgent({
        context: 'reception',
        schema: {
            action: "CREATE_SERVICE_REQUEST",
            description: "Create a new service request (cleaning, maintenance, bellman, etc.)",
            properties: {
                roomNumber: { type: "string", description: "The room number mentioned" },
                type: {
                    type: "string",
                    enum: ["cleaning", "maintenance", "bellman", "coffee", "laundry", "minibar", "extension"],
                    description: "The type of request"
                },
                priority: {
                    type: "string",
                    enum: ["normal", "urgent"],
                    description: "Priority of the request"
                },
                notes: { type: "string", description: "Additional details about the request" }
            },
            required: ["roomNumber", "type"]
        },
        onSuccess: (action, params) => {
            console.log("AI Action Success:", action, params);
            haptic('success');
            // Additional fallback: if it's a known UI update needed
            if (action === 'UPDATE_STATUS') {
                // UI might need refresh or feedback
            }
        }
    });

    // Track previous count to prevent stale closure notification loops
    const prevPendingCount = useRef(0);

    // State
    const [requests, setRequests] = useState<ServiceRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTab, setCurrentTab] = useState<TabType>('pending');
    const [selectedType, setSelectedType] = useState<ServiceRequest['type'] | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showShiftNotes, setShowShiftNotes] = useState(false);
    const [showProcurement, setShowProcurement] = useState(false);
    
    // ✅ FAST UI: Force show page after 2 seconds max
    useEffect(() => {
        const fastUITimeout = setTimeout(() => {
            if (loading) {
                console.log('⚡ Fast UI: Showing Reception page now');
                setLoading(false);
            }
        }, 2000);
        return () => clearTimeout(fastUITimeout);
    }, [loading]);
    const [showSupportTicket, setShowSupportTicket] = useState(false); // ✅ Support ticket modal
    const [showLostFound, setShowLostFound] = useState(false); // ✅ Lost & Found modal
    const [showGeneralInstructions, setShowGeneralInstructions] = useState(false); // ✅ General instructions modal
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false); // ✅ WhatsApp message modal
    const [showChatInbox, setShowChatInbox] = useState(false); // 💬 Chat Inbox modal
    const [showTeam, setShowTeam] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [rooms, setRooms] = useState<{ floor: number; rooms: string[] }[]>([]);
    const [activeRoomDetails, setActiveRoomDetails] = useState<Record<string, { guestId: string; guestName: string }>>({}); // ✅ For Mismatch Detection
    const [teamMembers, setTeamMembers] = useState<any[]>([]); // ✅ Added state
    const [roomHistoryRoom, setRoomHistoryRoom] = useState<string | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null); // ✅ For Request Details Modal
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    // State for delete confirmation
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; show: boolean } | null>(null);
    const [executionTimes, setExecutionTimes] = useState<any>(null); // ✅ For delayed logic
    // Room search filter
    const [roomSearchQuery, setRoomSearchQuery] = useState('');
    
    // ✅ Points Notification State
    const [activeNotifications, setActiveNotifications] = useState<Set<string>>(new Set());
    const [notificationRequest, setNotificationRequest] = useState<ServiceRequest | null>(null);
    
    // ✅ Branch Location Warning State
    const [showLocationWarning, setShowLocationWarning] = useState(false);
    
    // ✅ Onboarding Tour
    const { showTour, steps: tourSteps, closeTour, completeTour } = useOnboardingTour('reception');
    const [locationWarningData, setLocationWarningData] = useState<any>(null);

    // ✅ Read tab from URL query (?tab=pending|active|completed)
    // Applies on initial load and when query changes
    try {
        // Import inside file scope to avoid SSR issues
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { useSearchParams } = require('react-router-dom');
        const [searchParams] = useSearchParams();
        useEffect(() => {
            const tab = (searchParams.get('tab') || '').toLowerCase();
            if (tab === 'pending' || tab === 'active' || tab === 'completed') {
                setCurrentTab(tab as TabType);
            }
        }, [searchParams]);
    } catch {}

    // ✅ FIX: Use branchId from AuthContext (updates when manager switches branches)
    const { branchId: authBranchId } = useAuth();
    const branchId = authBranchId || (user as any)?.branchId || (user as any)?.branch;
    const tenantId = (user as any)?.tenantId;

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

    // ✅ Subscribe to Rooms & Employees
    // ✅ Subscribe to Rooms & Employees
    useEffect(() => {
        if (!branchId) return;

        // Load Settings for Delays
        loadBranchSettings(tenantId || 'default', branchId).then(settings => {
            if (settings?.executionTimes) {
                setExecutionTimes(settings.executionTimes);
            }
        });

        // Subscribe to rooms (Grouped for Modal)
        const unsubRooms = subscribeToRooms(branchId, (updatedRooms) => {
            const grouped = updatedRooms.reduce((acc, room) => {
                const floor = room.floor;
                if (!acc[floor]) acc[floor] = [];
                acc[floor].push(room.number);
                return acc;
            }, {} as Record<number, string[]>);

            const formatted = Object.entries(grouped).map(([floor, roomList]) => ({
                floor: parseInt(floor),
                rooms: roomList.sort()
            })).sort((a, b) => a.floor - b.floor);

            setRooms(formatted);

            // ✅ Populating Active Room Details for Smart Detection
            const details: Record<string, { guestId: string; guestName: string }> = {};
            updatedRooms.forEach(r => {
                if (r.status === 'occupied' && r.currentGuestId) {
                    details[r.number] = { guestId: r.currentGuestId, guestName: 'نزيل حالي' };
                }
            });
            setActiveRoomDetails(details);
        }, tenantId);

        // Subscribe to employees (Reception & Bellman)
        const unsubTeam = subscribeToEmployees((allEmployees) => {
            const relevant = allEmployees.filter(e =>
                e.department === 'reception' || e.department === 'bellman'
            );
            setTeamMembers(relevant);
        });

        return () => {
            unsubRooms();
            unsubTeam();
        };
    }, [branchId]);



    // ✅ Unified Tab Logic - All Departments Use Same Structure
    const groupedRequests = useMemo(() => {
        const department = 'reception'; // Current department
        const now = new Date();
        
        // ✅ Helper: Check if scheduled request should be shown (only if scheduledDate <= now)
        const isScheduledRequestVisible = (r: ServiceRequest): boolean => {
            // Check both scheduledDate and scheduledAt for compatibility
            const scheduledDateTime = (r as any).scheduledDate || (r as any).scheduledAt;
            if (!scheduledDateTime) return true; // Not scheduled - always visible
            
            const scheduledTime = scheduledDateTime?.toDate?.() || new Date(scheduledDateTime);
            // Show only if scheduled time has passed (including now)
            return scheduledTime <= now;
        };
        
        // ✅ Tab 1: NEW - Requests created or transferred TO this department
        // Includes: requests currently in this department (new or transferred)
        const newRequests = requests.filter(r => {
            // ✅ Scheduled requests: Show only if scheduledDate <= now
            if (!isScheduledRequestVisible(r)) return false;
            
            // ⭐ CRITICAL: Maintenance requests should NOT appear in "NEW" tab if they're in maintenance/housekeeping department
            // They should go through: Reception → Maintenance → Housekeeping → Reception
            if (r.type === 'maintenance' && r.currentDepartment && r.currentDepartment !== 'reception') {
                return false; // Hide maintenance requests that are in maintenance or housekeeping departments
            }
            
            // Always show inspection requests to reception
            if (r.type === 'inspection' && r.currentDepartment === department) return true;
            
            // ✅ Show QR requests waiting for confirmation (PENDING_RECEPTION)
            if (r.source === 'QR' && r.status === 'PENDING_RECEPTION' && r.currentDepartment === department) return true;
            
            // Show if currently in this department (not completed yet)
            if (r.currentDepartment === department && r.status !== 'COMPLETED') return true;
            
            // For legacy requests without currentDepartment, show if origin matches
            if (!r.currentDepartment && r.originDepartment === department && r.status !== 'COMPLETED') return true;
            
            return false;
        });

        // ✅ Tab 2: IN PROGRESS - Requests that LEFT this department to another
        // Shows: requests originated from this department but now in another department
        const inProgressRequests = requests.filter(r => {
            // ✅ Scheduled requests: Show only if scheduledDate <= now
            if (!isScheduledRequestVisible(r)) return false;
            
            // Must have originated from this department
            const originatedFromThis = r.originDepartment === department || 
                                     (r.departmentHistory && r.departmentHistory.some((h: any) => h.department === department));
            
            if (!originatedFromThis) return false;
            
            // Currently in a different department (or no currentDepartment for legacy)
            const inDifferentDept = r.currentDepartment && r.currentDepartment !== department;
            const legacyCheck = !r.currentDepartment && r.status !== 'COMPLETED';
            
            // Not completed yet
            if (r.status === 'COMPLETED') return false;
            
            return inDifferentDept || legacyCheck;
        });

        // ✅ Tab 3: COMPLETED - Completed requests that need confirmation
        // Shows: completed requests that came from or are in this department (awaiting confirmation)
        const completedRequests = requests.filter(r => {
            if (r.status !== 'COMPLETED') return false;
            
            // Show if originated from this department OR currently in this department
            const originatedFromThis = r.originDepartment === department || 
                                     (r.departmentHistory && r.departmentHistory.some((h: any) => h.department === department));
            const currentlyInThis = r.currentDepartment === department;
            
            return originatedFromThis || currentlyInThis;
        });

        // Sort by creation date (newest first)
        const sortByDate = (a: ServiceRequest, b: ServiceRequest) => {
            const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
            const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
            return bTime - aTime;
        };

        return {
            pending: newRequests.sort(sortByDate),
            active: inProgressRequests.sort(sortByDate),
            completed: completedRequests.sort(sortByDate)
        };
    }, [requests]);

    // Current list (filtered by search)
    const currentRequests = useMemo(() => {
        let list: ServiceRequest[];
        switch (currentTab) {
            case 'pending': list = groupedRequests.pending; break;
            case 'active': list = groupedRequests.active; break;
            case 'completed': list = groupedRequests.completed; break;
            default: list = [];
        }
        // Apply room search filter
        if (roomSearchQuery.trim()) {
            const query = roomSearchQuery.trim().toLowerCase();
            list = list.filter(r => r.roomNumber?.toLowerCase().includes(query));
        }
        return list;
    }, [currentTab, groupedRequests, roomSearchQuery]);

    // ✅ Show Points Notification for new PENDING_RECEPTION or CONFIRMED requests
    useEffect(() => {
        // Find first PENDING_RECEPTION or CONFIRMED request that hasn't been notified yet
        const firstPending = groupedRequests.pending.find(
            req => (req.status === 'PENDING_RECEPTION' || req.status === 'CONFIRMED') && !activeNotifications.has(req.id)
        );

        if (firstPending && tenantId) {
            // Mark as notified
            setActiveNotifications(prev => new Set(prev).add(firstPending.id));
            // Show notification
            setNotificationRequest(firstPending);
            
            // Auto-dismiss after 3 seconds
            const timer = setTimeout(() => {
                setNotificationRequest(null);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [groupedRequests.pending, activeNotifications, tenantId]);

    // ============================================================
    // DATA LOADING
    // ============================================================

    useEffect(() => {
        if (!user || !branchId) return;

        // Rooms are handled by the real-time subscription in the first useEffect


        // Subscribe to requests with fallback for missing index
        const requestsRef = collection(db, 'requests');

        // Try with orderBy first, fallback to simple query if index not ready
        const trySubscribe = (useOrderBy: boolean) => {
            const constraints = [where('branch', '==', branchId)];
            if (tenantId) constraints.push(where('tenantId', '==', tenantId));

            const q = useOrderBy
                ? query(requestsRef, ...constraints, orderBy('createdAt', 'desc'))
                : query(requestsRef, ...constraints);

            return onSnapshot(q,
                (snapshot) => {
                    let loadedRequests: ServiceRequest[] = [];
                    snapshot.forEach(doc => {
                        loadedRequests.push({ id: doc.id, ...doc.data() } as ServiceRequest);
                    });

                    // Sort manually if we couldn't use orderBy
                    if (!useOrderBy) {
                        loadedRequests = loadedRequests.sort((a, b) => {
                            const aTime = a.createdAt?.toDate?.() || new Date(0);
                            const bTime = b.createdAt?.toDate?.() || new Date(0);
                            return bTime.getTime() - aTime.getTime();
                        });
                    }

                    setRequests(loadedRequests);
                    setLoading(false);

                    // Play sound for new pending requests
                    const newPendingCount = loadedRequests.filter(r => r.status === 'PENDING').length;

                    if (newPendingCount > prevPendingCount.current) {
                        playSound('notification');
                        haptic('medium');
                    }
                    prevPendingCount.current = newPendingCount;
                },
                (error) => {
                    console.error('Query error:', error);
                    // If index error, try without orderBy
                    if (useOrderBy && error.code === 'failed-precondition') {
                        console.warn('Index not ready, using fallback query');
                        trySubscribe(false);
                    } else {
                        setLoading(false);
                    }
                }
            );
        };

        const unsubscribe = trySubscribe(true);
        return () => unsubscribe();
    }, [user, branchId]);

    // ============================================================
    // ACTIONS
    // ============================================================

    const handleQuickAction = (type: ServiceRequest['type']) => {
        setSelectedType(type);
        setShowCreateModal(true);
        haptic('light');
    };

    const handleCreateRequest = async (data: { roomNumber: string; type: string; priority: 'normal' | 'urgent' | 'scheduled'; notes: string; needsCart?: boolean; guestsInRoom?: boolean; scheduledAt?: Date; emergencyTargetDepartment?: string }) => {
        try {
            // ✅ Validate user exists
            if (!user || !user.id) {
                throw new Error('يجب تسجيل الدخول أولاً');
            }

            // ✅ Determine which department should handle this request
            const getDepartment = (type: string, emergencyDept?: string): 'reception' | 'housekeeping' | 'maintenance' | 'bellman' | 'coffee_shop' | 'procurement' => {
                // ✅ Emergency/Other requests use the selected department
                if (type === 'other' && emergencyDept) {
                    // Map coffee_shop to housekeeping for now (or create separate department later)
                    if (emergencyDept === 'coffee_shop') return 'housekeeping';
                    return emergencyDept as any;
                }

                switch (type) {
                    case 'cleaning':
                    case 'laundry':
                    case 'minibar':
                        return 'housekeeping';
                    case 'maintenance':
                        return 'maintenance';
                    case 'bellman':
                        return 'bellman';
                    case 'coffee':
                        // ✅ FIX: Assign coffee requests to housekeeping (or create 'kitchen' department in future)
                        return 'housekeeping';
                    case 'inspection':
                        return 'housekeeping';
                    case 'extension':
                        // Extension requests stay with reception for handling
                        return 'reception';
                    default:
                        // Unknown request types default to reception for triage
                        console.warn(`Unknown request type: ${type}, defaulting to reception`);
                        return 'reception';
                }
            };

            // ✅ RULE: Duplication Prevention (Scenario 2 - Option B: Notify Only)
            // Check for active requests for this room
            const activeRequests = requests.filter(r =>
                r.roomNumber === data.roomNumber &&
                r.id && // Valid ID
                ['CONFIRMED', 'IN_PROGRESS', 'NEEDS_INSPECTION', 'SCHEDULED', 'PENDING'].includes(r.status)
            );

            // Special handling for Service requests (Coffee/Food) - Allow up to 5
            if (data.type === 'coffee') {
                const serviceCount = activeRequests.filter(r => r.type === 'coffee').length;
                if (serviceCount >= 5) {
                    error('لقد تجاوزت الحد الأقصى لطلبات الخدمات لهذه الغرفة (5 طلبات)');
                    haptic('error');
                    throw new Error('Max service requests reached');
                }
            }

            // Check for potential duplicate (same type)
            const isDuplicate = activeRequests.some(r => r.type === data.type);
            if (isDuplicate) {
                // Option B: Notify Only (We just flag it, logic handles the UI warning)
                // We could show a confirm dialog here if we really wanted, but "Notify" usually implies visual tagging.
                // Let's just proceed and tag it.
            }

            // ✅ Prepare request data
            const requestData: any = {
                type: data.type,
                serviceType: data.type,
                roomNumber: data.roomNumber,
                priority: data.priority || 'normal', // ✅ Always include priority
                notes: data.notes || '',
                status: data.priority === 'scheduled' ? 'SCHEDULED' as const : 'CONFIRMED' as const,
                branch: branchId,
                guestName: 'طلب من الاستقبال',
                needsCart: data.needsCart || false,
                guestsInRoom: data.guestsInRoom || false,
                guestStatus: data.guestsInRoom ? 'in' : 'out', // ✅ Convert guestsInRoom to guestStatus for display
                createdBy: {
                    id: user.id,
                    name: user.name || 'مستخدم غير معروف'
                },
                confirmedBy: {
                    id: user.id,
                    name: user.name || 'مستخدم غير معروف'
                },
                originDepartment: 'reception',
                tenantId: tenantId,
                currentDepartment: getDepartment(data.type, data.emergencyTargetDepartment),
                createdAt: Timestamp.now(),
                confirmedAt: Timestamp.now(),
                timeline: {
                    created: Timestamp.now(),
                    confirmed: Timestamp.now()
                },
                // 🛑 Scenario 2: Duplicate Flag
                isPotentialDuplicate: isDuplicate
            };

            // ✅ Emergency Request Fields
            if (data.type === 'other') {
                requestData.isEmergency = true;
                requestData.emergencyStatus = 'pending';
                requestData.emergencyTargetDepartment = data.emergencyTargetDepartment;
            }

            // ✅ Only add scheduledDate/scheduledAt if they exist (Firestore doesn't accept undefined)
            if (data.scheduledAt) {
                requestData.scheduledDate = Timestamp.fromDate(data.scheduledAt);
                requestData.scheduledAt = Timestamp.fromDate(data.scheduledAt); // Keep for backward compatibility
            }

            // ✅ Debug log for owner
            if (user.id === 'owner') {
                console.log('🔑 Owner creating request:', {
                    requestData,
                    branchId,
                    user
                });
            }

            // ✅ Add request with proper department assignment
            await addDoc(collection(db, 'requests'), requestData);

            // ✅ FIX: Auto-check daily attendance when employee creates a request
            if (tenantId && user?.id) {
                try {
                    const { checkDailyAttendance } = await import('../../services/challengeService');
                    // Fire and forget - don't block request creation if attendance check fails
                    checkDailyAttendance(tenantId, user.id).catch(err => {
                        console.warn('Failed to check daily attendance after request creation:', err);
                    });
                } catch (err) {
                    console.warn('Could not load challengeService for attendance check:', err);
                }
            }

            success(isDuplicate ? 'تم إنشاء الطلب (ملاحظة: يوجد طلب مماثل مفتوح)' : 'تم إنشاء الطلب بنجاح');
            setShowCreateModal(false);
        } catch (err: any) {
            console.error('Error creating request:', {
                code: err?.code,
                message: err?.message?.replace(/Request ID: [a-f0-9-]+/gi, ''),
                data: data
            });
            // Show more specific error message
            const errorMessage = err?.message?.includes('permission')
                ? 'ليس لديك صلاحية لإنشاء الطلب'
                : err?.message?.includes('network') || err?.message?.includes('offline')
                    ? 'تحقق من الاتصال بالإنترنت'
                    : 'فشل إنشاء الطلب: ' + (err?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || 'خطأ غير معروف');
            error(errorMessage);
        }
    };

    const handleConfirmRequest = async (requestId: string) => {
        try {
            const requestRef = doc(db, 'requests', requestId);
            const requestSnap = await getDocs(query(collection(db, 'requests'), where('__name__', '==', requestId)));

            if (requestSnap.empty) return;

            const requestData = requestSnap.docs[0].data();

            // ⭐ Check if this is an inspection request
            if (requestData.type === 'inspection' && requestData.source === 'bellman_checkout') {
                // Auto-create cleaning request after confirming inspection receipt
                const cleaningRequestData: any = {
                    type: 'cleaning',
                    cleaningType: 'post_inspection',
                    status: 'CONFIRMED',
                    roomNumber: requestData.roomNumber,
                    guestName: requestData.guestName || '',
                    priority: 'normal' as const,
                    currentDepartment: 'housekeeping',
                    originDepartment: 'reception',
                    notes: `تنظيف بعد الفحص - غرفة ${requestData.roomNumber}`,
                    createdAt: Timestamp.now(),
                    createdBy: { id: user?.id || '', name: user?.name || 'Unknown' },
                    linkedInspectionId: requestId,
                    minibarConsumption: requestData.minibarConsumption || [],
                    minibarTotal: requestData.minibarTotal || 0,
                    branch: branchId, // ✅ Add branch
                    tenantId: tenantId // ✅ Add tenantId
                };
                
                // ✅ Only add optional fields if they exist
                if (requestData.inspectionResult) {
                    cleaningRequestData.inspectionResult = requestData.inspectionResult;
                }
                
                await addDoc(collection(db, 'requests'), cleaningRequestData);

                // Mark inspection as confirmed
                await updateDoc(requestRef, {
                    status: 'COMPLETED',
                    confirmedAt: Timestamp.now(),
                    confirmedBy: { id: user?.id || '', name: user?.name || 'Unknown' },
                    currentDepartment: 'reception'
                });

                // Award points (updates both personal and team points)
                if (user?.id) {
                    await awardPoints('default', user.id, 5, 'تأكيد فحص غرفة');
                }

                haptic('success');
                playSound('success');
                return;
            }

            // ✅ QR Request Confirmation - Transfer to appropriate department
            if (requestData.source === 'QR' && requestData.status === 'PENDING_RECEPTION') {
                // Import transferRequestToDepartment
                const { transferRequestToDepartment } = await import('../../services/requestService');
                
                // Determine target department based on request type
                const getTargetDepartment = (type: string): string => {
                    switch (type) {
                        case 'cleaning': return 'housekeeping';
                        case 'maintenance': return 'maintenance';
                        case 'bellman': return 'bellman';
                        case 'room_service':
                        case 'coffee': return 'coffee_shop'; // ✅ Transfer to Coffee Shop
                        case 'minibar': return 'reception'; // Minibar stays in reception
                        case 'extension': return 'reception'; // Reception handles extensions
                        default: return 'reception';
                    }
                };

                const targetDepartment = getTargetDepartment(requestData.type || requestData.serviceType);

                // Mark as confirmed in reception
                await updateDoc(requestRef, {
                    status: 'CONFIRMED',
                    confirmedBy: { id: user?.id || '', name: user?.name || '' },
                    confirmedAt: Timestamp.now()
                });

                // Transfer to target department using unified service
                if (targetDepartment !== 'reception') {
                    // Only transfer if not staying in reception
                    await transferRequestToDepartment(
                        requestId,
                        'reception',
                        targetDepartment,
                        user?.id || '',
                        user?.name || '',
                        'CONFIRMED' as any,
                        'تم التأكيد من الاستقبال - طلب من QR'
                    );
                } else {
                    // Update department history for reception-only requests
                    const departmentHistory = requestData.departmentHistory || [];
                    if (departmentHistory.length > 0) {
                        const lastEntry = departmentHistory[departmentHistory.length - 1];
                        lastEntry.status = 'CONFIRMED';
                        lastEntry.handledBy = { id: user?.id || '', name: user?.name || '' };
                        lastEntry.exitedAt = Timestamp.now();
                    }
                    await updateDoc(requestRef, {
                        departmentHistory,
                        currentDepartment: 'reception'
                    });
                }

                // Award points
                if (user?.id) {
                    await awardPoints('default', user.id, 5, 'تأكيد طلب QR');
                }

                success('تم تأكيد الطلب وتحويله تلقائياً للقسم المختص');
                haptic('success');
                playSound('success');
                return;
            }

            // Normal confirmation for other requests
            await updateDoc(requestRef, {
                status: 'CONFIRMED',
                confirmedBy: { id: user?.id || '', name: user?.name || 'Unknown' },
                confirmedAt: Timestamp.now()
            });

            // Award points (updates both personal and team points)
            if (user?.id) {
                await awardPoints('default', user.id, 5, 'تأكيد طلب');
            }

            success('تم تأكيد الطلب بنجاح');
        } catch (err) {
            console.error('Error confirming:', err);
            error('فشل تأكيد الطلب');
        }
    };

    const handleCompleteRequest = async (requestId: string) => {
        try {
            await updateDoc(doc(db, 'requests', requestId), {
                status: 'COMPLETED',
                completedAt: Timestamp.now(),
                currentDepartment: 'reception' // Return to reception for final review
            });

            success('تم إتمام الطلب بنجاح');
        } catch (err) {
            console.error('Error completing:', err);
            error('فشل إتمام الطلب');
        }
    };

    // ✅ Confirm completion and close the request circle
    const handleConfirmCompletion = async (requestId: string) => {
        try {
            const { confirmCompletion } = await import('../../services/requestService');
            await confirmCompletion(requestId, user?.id || '', user?.name || '', 'reception');
            success('تم تأكيد الإغلاق وإتمام الطلب');
            haptic('success');
            playSound('success');
        } catch (err) {
            console.error('Error confirming completion:', err);
            error('فشل تأكيد الإغلاق');
        }
    };

    const confirmDelete = async () => {
        if (!deleteConfirmation?.id) return;

        const requestId = deleteConfirmation.id;
        setDeleteConfirmation(null); // Close modal immediately for better UX

        try {
            console.log('🗑️ Attempting to delete request:', requestId);
            await deleteDoc(doc(db, 'requests', requestId));
            console.log('✅ Delete successful');
            success('تم حذف الطلب بنجاح');
        } catch (err: any) {
            console.error('❌ Delete failed:', err);
            const errorMsg = err?.code === 'permission-denied'
                ? 'ليس لديك صلاحية لحذف هذا الطلب.'
                : `فشل حذف الطلب: ${err?.message || 'خطأ غير معروف'}`;
            error(errorMsg);
        }
    };

    const handleDeleteRequest = (requestId: string) => {
        setDeleteConfirmation({ id: requestId, show: true });
    };

    // ============================================================
    // ROOM TRANSFER LOGIC
    // ============================================================

    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [selectedTransferRequest, setSelectedTransferRequest] = useState<ServiceRequest | null>(null);
    const [targetRoomNumber, setTargetRoomNumber] = useState('');
    const [isTransferring, setIsTransferring] = useState(false);

    const handleTransferRequest = (request: ServiceRequest) => {
        setSelectedTransferRequest(request);
        setTransferModalOpen(true);
        setTargetRoomNumber('');
    };

    const confirmTransfer = async () => {
        if (!selectedTransferRequest || !targetRoomNumber) return;

        // Room number validation (basic)
        if (targetRoomNumber === selectedTransferRequest.roomNumber) {
            error('لا يمكن النقل لنفس الغرفة');
            haptic('error');
            return;
        }

        setIsTransferring(true);
        try {
            // Import dynamically to avoid circle deps if any (though roomService is safe)
            const { transferGuest } = await import('../../services/roomService');

            // We need guestId. Reception requests might not have it strictly typed, 
            // but we can try to find it or query room.
            // For now, we assume we move based on Room Number and Request Context.

            // CRITICAL: We need the GUEST ID to move them.
            // If request doesn't have it, we must fetch from Room.
            // ... Fetching room data ...
            const roomsRef = collection(db, 'rooms');
            // We can't query by ID easily without helper.
            // Let's rely on transferGuest to do the heavy lifting, 
            // BUT transferGuest needs guestId.
            // Let's fetch the OLD room to get the guestId.

            // WAIT - Logic gap: Reception Dashboard has requests, not full room objects.
            // We need to fetch the Guest ID from the Old Room.

            // 1. Get Old Room Data to find currentGuestId
            const { getRoomStats } = await import('../../services/roomService'); // Just for imports
            // Actually let's just query the doc directly for speed
            // We need docId... assume standard format or query?
            // Safer to query request's room.

            // Let's query room by number & branch
            const roomsQuery = query(
                collection(db, 'rooms'),
                where('number', '==', selectedTransferRequest.roomNumber),
                where('branchId', '==', (user as any)?.branch || 'default')
            );
            const roomSnap = await getDocs(roomsQuery);

            if (roomSnap.empty) {
                throw new Error('الغرفة الحالية غير موجودة');
            }

            const oldRoomData = roomSnap.docs[0].data();
            const guestId = oldRoomData.currentGuestId;
            // ✅ Use branchId from AuthContext (already defined above)

            if (!guestId) {
                // If no guest ID (maybe manual request?), we just move the request? 
                // No, "Room Move" implies moving a guest.
                error('لا يوجد نزيل مسجل في هذه الغرفة للنقل');
                haptic('error');
                setIsTransferring(false);
                return;
            }

            // 2. Execute Transfer
            // ✅ FIX: transferGuest needs tenantId as first parameter
            await transferGuest(
                tenantId || '',
                branchId,
                selectedTransferRequest.roomNumber,
                targetRoomNumber,
                guestId,
                selectedTransferRequest.guestName || 'نزيل'
            );

            success(`تم نقل النزيل ${selectedTransferRequest.guestName} إلى غرفة ${targetRoomNumber} بنجاح`);
            setTransferModalOpen(false);
            setSelectedTransferRequest(null);

        } catch (err) {
            console.error('Transfer failed:', err);
            error('فشل عملية النقل: ' + (err as any).message);
        } finally {
            setIsTransferring(false);
        }
    };

    // ============================================================
    // SMART MISMATCH & GHOST ORDER DETECTION (Scenarios 1 & 2)
    // ============================================================

    const checkRequestMismatch = (request: ServiceRequest): string | undefined => {
        // Only check if we have guest identity and room details loaded
        if (!request.guestIdentity || Object.keys(activeRoomDetails).length === 0) return undefined;

        // 1. Check who is legally in the requested room
        const roomOwner = activeRoomDetails[request.roomNumber];

        // If room is empty or has different guest, we might have a problem
        if (!roomOwner || roomOwner.guestId !== request.guestIdentity) {
            // 2. DETECTIVE MODE: Where is this guest actually?
            // Search all occupied rooms for this guestIdentity
            const actualRoom = Object.entries(activeRoomDetails).find(([_, details]) =>
                details.guestId === request.guestIdentity
            );

            if (actualRoom) {
                // Found them! They are in a different room.
                return actualRoom[0]; // Return the actual room number
            }
        }
        return undefined;
    };

    // 👻 Scenario 1: Ghost Order Detector
    const checkGhostOrder = (request: ServiceRequest): boolean => {
        // Check 1: Is the room currently occupied?
        const isOccupied = activeRoomDetails[request.roomNumber];

        // Check 2: Is the request still active?
        const isActive = ['CONFIRMED', 'IN_PROGRESS', 'PENDING', 'PENDING_RECEPTION'].includes(request.status);

        // If Room is Empty (checked out) BUT Request is Active -> GHOST ORDER! 👻
        if (!isOccupied && isActive) {
            return true;
        }
        return false;
    };

    // ============================================================
    // DELETION WORKFLOW (Scenario 3)
    // ============================================================

    // 1. Staff Requests Deletion
    const handleRequestDeletion = async (requestId: string) => {
        try {
            await updateDoc(doc(db, 'requests', requestId), {
                deletionRequest: {
                    requestedBy: user?.name || 'Unknown',
                    requestedById: user?.id || '',
                    requestedAt: Timestamp.now(),
                    reason: 'Requested by staff' // Can be enhanced with input
                }
            });
            success('تم إرسال طلب الحذف للمدير للموافقة');
            haptic('success');
        } catch (err) {
            console.error('Error requesting deletion:', err);
            error('فشل إرسال طلب الحذف');
            haptic('error');
        }
    };

    // 2. Manager Approves Deletion (Permanently Delete)
    const handleApproveDeletion = async (requestId: string) => {
        try {
            await deleteDoc(doc(db, 'requests', requestId));
            haptic('success');
            setDeleteConfirmation({ id: '', show: false }); // Close modal if open
        } catch (error) {
            console.error('Error approving deletion:', error);
            haptic('error');
        }
    };

    // 3. Manager Rejects Deletion (Remove Flag)
    const handleRejectDeletion = async (requestId: string) => {
        try {
            await updateDoc(doc(db, 'requests', requestId), {
                deletionRequest: deleteField() // Remove the field
            });
            success('تم رفض طلب الحذف');
            haptic('success');
        } catch (err) {
            console.error('Error rejecting deletion:', err);
            error('فشل رفض طلب الحذف');
            haptic('error');
        }
    };

    // ============================================================
    // LOST ITEMS ARCHIVE (Scenario 4)
    // ============================================================

    // ✅ Archive lost items from inspection to Lost & Found
    const handleArchiveToLostFound = async (requestId: string) => {
        try {
            // Get request data
            const requestRef = doc(db, 'requests', requestId);
            const requestSnap = await getDoc(requestRef);
            
            if (!requestSnap.exists()) {
                error('الطلب غير موجود');
                return;
            }

            const requestData = requestSnap.data();

            // ✅ Create Lost & Found item
            const { addLostFoundItem } = await import('../../services/lostFoundService');
            
            await addLostFoundItem(
                {
                    type: 'found',
                    category: 'other', // Default category
                    description: requestData.inspectionNotes || `مفقودات من غرفة ${requestData.roomNumber}`,
                    location: `غرفة ${requestData.roomNumber}`,
                    roomNumber: requestData.roomNumber,
                    guestName: requestData.guestName || null,
                    storageLocation: 'خزنة الاستقبال',
                    notes: `نقل تلقائي من فحص الغرفة. ${requestData.inspectionNotes || ''}`,
                    branch: branchId,
                    foundBy: { id: user?.id || '', name: user?.name || '' }
                },
                undefined, // No file upload
                requestData.inspectionPhoto || undefined // ✅ Use existing photo URL from inspection
            );

            // ✅ Update request: mark as archived
            await updateDoc(requestRef, {
                lostItemsStatus: 'archived',
                archivedAt: Timestamp.now(),
                archivedBy: { id: user?.id || '', name: user?.name || '' }
            });

            // ✅ Update Live Feed: mark as archived
            try {
                const liveFeedQuery = query(
                    collection(db, 'live_feed'),
                    where('requestId', '==', requestId),
                    where('type', '==', 'missing_items_found'),
                    limit(1)
                );
                const liveFeedSnap = await getDocs(liveFeedQuery);
                if (!liveFeedSnap.empty) {
                    await updateDoc(doc(db, 'live_feed', liveFeedSnap.docs[0].id), {
                        archived: true,
                        archivedAt: Timestamp.now(),
                        archivedBy: { id: user?.id || '', name: user?.name || '' }
                    });
                }
            } catch (e) {
                console.warn('Failed to update live feed:', e);
            }

            success('تم نقل المفقودات للأرشيف بنجاح');
            haptic('success');
        } catch (err: any) {
            console.error('Error archiving to Lost & Found:', err);
            error('فشل نقل المفقودات للأرشيف: ' + (err.message || 'خطأ غير معروف'));
            haptic('error');
        }
    };

    // ============================================================
    // RENDER
    // ============================================================

    // 🧠 GENIUS: Smart Occupancy & Pricing Logic
    const pricingInsight = useMemo(() => {
        const allRooms = rooms.flatMap(r => r.rooms);
        const total = allRooms.length;
        if (total === 0) return null;

        const occupied = allRooms.filter(r => (r as any).status === 'occupied').length;
        const occupancyRate = (occupied / total) * 100;
        const currentHour = new Date().getHours();

        // 💰 High Demand Rule
        if (occupancyRate > 90) {
            return {
                type: 'price' as const,
                title: 'طلب مرتفع جداً (High Demand)',
                description: `نسبة الإشغال ${Math.round(occupancyRate)}%. يُنصح برفع سعر الغرف المتبقية بنسبة 15-20% لتعظيم الربح.`,
                action: 'تطبيق زيادة السعر'
            };
        }

        // 📉 Low Demand Night Rule (After 10 PM)
        if (currentHour >= 22 && occupancyRate < 40) {
            return {
                type: 'price' as const,
                title: 'فرصة بيع مسائي (Late Night Deal)',
                description: `الساعة متأخرة والإشغال ${Math.round(occupancyRate)}% فقط. يُنصح بتقديم خصم "Last Minute" بنسبة 10% لجذب المارة.`,
                action: 'تفعيل خصم مسائي'
            };
        }

        return null;
    }, [rooms]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center theme-page">
            <AdoraLoader size="lg" message="جاري تحميل البيانات..." />
        </div>
    );

    return (
        <PageTransition>
            {/* Manager Announcement Banner */}
            <ManagerAnnouncementBanner department="reception" />
            
            <div className="min-h-screen pb-20 sm:pb-0 relative overflow-x-hidden transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
            {/* 🧠 Smart Genius Insight (Top of Dashboard) */}
            {pricingInsight && (
                <div className="px-4 pt-4 sm:px-6 max-w-7xl mx-auto animate-in slide-in-from-top-4 duration-700">
                    <SmartInsight
                        type={pricingInsight.type}
                        title={pricingInsight.title}
                        description={pricingInsight.description}
                        actionLabel={pricingInsight.action}
                        onAction={() => {
                            success('جاري فتح إعدادات الأسعار...');
                            navigate('/dashboard/settings');
                        }}
                        autoExpand={true}
                    />
                </div>
            )}

            {/* 🔄 Overflow Alert - تنبيه ضغط العمل */}
            {tenantId && branchId && (
                <div className="px-4 pt-4 sm:px-6 max-w-7xl mx-auto">
                    <OverflowAlert
                        tenantId={tenantId}
                        branchId={branchId}
                        onReroute={(from, to) => {
                            success(`تم اقتراح تحويل الطلبات من ${from} إلى ${to}`);
                        }}
                    />
                </div>
            )}

            {/* Flexible Header */}
            <FlexibleHeader
                title="الاستقبال"
                showGreeting={true}
                brandName={brandName}
                subtitle={<PointsTracker employeeId={user?.id || ''} inline showHistory />}
                actions={[
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
                        id: 'lostFound',
                        icon: <Package className="w-5 h-5" />,
                        label: 'المفقودات',
                        onClick: () => setShowLostFound(true)
                    },
                    {
                        id: 'instructions',
                        icon: <BookOpen className="w-5 h-5" />,
                        label: 'تعليمات عامة',
                        onClick: () => setShowGeneralInstructions(true),
                        variant: 'primary'
                    },
                    {
                        id: 'whatsapp',
                        icon: <MessageCircle className="w-5 h-5" />,
                        label: 'رسائل WhatsApp',
                        onClick: () => setShowWhatsAppModal(true),
                        variant: 'primary'
                    },
                    {
                        id: 'support',
                        icon: <MessageSquare className="w-5 h-5" />,
                        label: 'دعم فني',
                        onClick: () => setShowSupportTicket(true),
                        variant: 'warning'
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

            {/* Challenge Timeline */}
            <ChallengeTimeline />

            {/* Golden Alert - Broadcast Messages */}
            <GoldenAlertDisplay department="reception" />

            {/* ✅ Room Transfer Notifications */}
            <div className="flex justify-end mb-3">
                <TransferNotificationBadge department="reception" />
            </div>

            {/* 📊 Operations Quick-View Bar (شريط العمليات الذكي) */}
            {tenantId && branchId && (
                <div className="px-4 sm:px-6 mb-4 max-w-7xl mx-auto">
                    <OperationsQuickView
                        tenantId={tenantId}
                        branchId={branchId}
                        onRequestClick={(request) => {
                            // Find the full request and show details
                            const fullRequest = requests.find(r => r.id === request.id);
                            if (fullRequest) {
                                setSelectedRequest(fullRequest);
                            }
                        }}
                    />
                </div>
            )}

            {/* ⚠️ Bottleneck Alert (تنبيه التراكم) */}
            {tenantId && branchId && (
                <div className="px-4 sm:px-6 mb-4 max-w-7xl mx-auto">
                    <BottleneckAlert
                        tenantId={tenantId}
                        branchId={branchId}
                        onDepartmentClick={(dept) => {
                            console.log(`📞 Calling department: ${dept}`);
                            // Could trigger a phone call or notification
                        }}
                    />
                </div>
            )}

            {/* ☕ Pending Coffee Orders (طلبات الكوفي المعلقة) */}
            {tenantId && branchId && (
                <div className="px-4 sm:px-6 mb-4 max-w-7xl mx-auto">
                    <PendingCoffeeOrders
                        tenantId={tenantId}
                        branchId={branchId}
                    />
                </div>
            )}

            {/* ✅ Points Notification - Show for active PENDING_RECEPTION or CONFIRMED requests */}
            {notificationRequest && tenantId && (
                <PointsNotification
                    requestId={notificationRequest.id}
                    requestType={notificationRequest.type || 'cleaning'}
                    department="reception"
                    createdAt={notificationRequest.createdAt}
                    tenantId={tenantId}
                    onDismiss={() => setNotificationRequest(null)}
                />
            )}

            {/* Stats - Enterprise Primary Status Cards (Type A) - Unified Style */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={groupedRequests.pending.length}
                        label="🆕 جديد"
                        icon={AlertCircle}
                        iconColor="orange"
                        status={groupedRequests.pending.length > 10 ? 'warning' : 'normal'}
                        lastUpdate={groupedRequests.pending.length > 0 ? 'آخر تحديث: الآن' : undefined}
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={groupedRequests.active.length}
                        label="⏳ قيد التنفيذ"
                        icon={Clock}
                        iconColor="blue"
                        status={groupedRequests.active.length > 15 ? 'warning' : 'normal'}
                        lastUpdate={groupedRequests.active.length > 0 ? 'آخر تحديث: الآن' : undefined}
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={groupedRequests.completed.length}
                        label="✅ مكتمل"
                        icon={CheckCircle2}
                        iconColor="green"
                        status="success"
                        lastUpdate={groupedRequests.completed.length > 0 ? 'آخر تحديث: الآن' : undefined}
                        trend="+12%"
                    />
                </div>
            </div>

            {/* 🆕 Guest Verification Panel */}
            {user?.id && user?.name && (
                <ReceptionVerificationPanel
                    branchId={branchId}
                    tenantId={tenantId || 'default'}
                    userId={user.id}
                    userName={user.name}
                />
            )}

            {/* Quick Actions - Enterprise Type C: Execution Cards */}
            <div className="mb-6 sm:mb-8 lg:mb-12" data-tour="quick-actions">
                <h2 className="text-xs sm:text-sm text-white/50 font-normal uppercase tracking-wider mb-3 sm:mb-4 px-2">إنشاء طلب سريع</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-9 gap-3 sm:gap-4">
                    {QUICK_ACTIONS.map(action => (
                        <button
                            key={action.type}
                            onClick={() => handleQuickAction(action.type)}
                            className="
                                pro-card-action
                                flex flex-col items-center justify-center
                                gap-3
                                p-4 sm:p-5
                                touch-manipulation
                            "
                        >
                            {/* Icon - Monotone, Small, Not Decorative */}
                            <div className="
                                w-10 h-10
                                rounded-md
                                flex items-center justify-center
                                bg-white/3
                                border border-white/5
                            ">
                                {React.cloneElement(action.icon as React.ReactElement, {
                                    className: 'w-5 h-5 text-white/60'
                                })}
                            </div>
                            
                            {/* Label - Direct, No Numbers */}
                            <span className="text-xs sm:text-sm font-medium text-white/70 text-center uppercase tracking-wide">
                                {action.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Room Search Filter */}
            <div className="mb-3 sm:mb-4">
                <div className="relative" data-tour="search-box">
                    <input
                        type="text"
                        value={roomSearchQuery}
                        onChange={(e) => setRoomSearchQuery(e.target.value)}
                        placeholder="بحث برقم الغرفة..."
                        className="w-full sm:w-64 px-4 py-2 pr-10 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    />
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {roomSearchQuery && (
                        <button
                            onClick={() => setRoomSearchQuery('')}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white/60 hover:bg-white/30"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs - Mobile Optimized */}
            <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4 overflow-x-auto pb-1 -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-hide" data-tour="tabs">
                {[
                    { key: 'pending', label: 'جديد', count: groupedRequests.pending.length, color: 'yellow' },
                    { key: 'active', label: 'قيد التنفيذ', count: groupedRequests.active.length, color: 'blue' },
                    { key: 'completed', label: 'مكتمل', count: groupedRequests.completed.length, color: 'green' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setCurrentTab(tab.key as TabType)}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl whitespace-nowrap transition-all active:scale-95 touch-manipulation flex-shrink-0 ${currentTab === tab.key
                            ? `bg-${tab.color}-500 text-white shadow-lg shadow-${tab.color}-500/25`
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}
                    >
                        <span className="text-sm sm:text-base font-medium">{tab.label}</span>
                        <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-bold ${currentTab === tab.key ? 'bg-white/20' : `bg-${tab.color}-500/30 text-${tab.color}-400`
                            }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Room Transfer Modal */}
            {transferModalOpen && selectedTransferRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in" style={{ backdropFilter: 'none' }}>
                    <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Repeat className="w-6 h-6 text-orange-400" />
                            نقل النزيل (تحويل غرفة)
                        </h2>

                        <div className="space-y-4">
                            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                <p className="text-white/60 text-sm mb-1">الغرفة الحالية</p>
                                <p className="text-xl font-bold text-white">غرفة {selectedTransferRequest.roomNumber}</p>
                                <p className="text-white/40 text-xs mt-1">{selectedTransferRequest.guestName}</p>
                            </div>

                            <div>
                                <label className="block text-white/70 text-sm mb-2">إلى الغرفة الجديدة</label>
                                <input
                                    type="text"
                                    value={targetRoomNumber}
                                    onChange={(e) => setTargetRoomNumber(e.target.value)}
                                    placeholder="رقم الغرفة الجديدة (مثلاً 202)"
                                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition-colors text-center text-lg font-bold"
                                    autoFocus
                                />
                            </div>

                            <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                                <p className="text-orange-400 text-xs flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>
                                        سيتم نقل الطلبات الشخصية تلقائياً، وإنشاء طلبات "نقل أمتعة" و "تنظيف خروج".
                                    </span>
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={confirmTransfer}
                                disabled={!targetRoomNumber || isTransferring}
                                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isTransferring ? (
                                    <AdoraLoaderInline size={20} />
                                ) : (
                                    <>
                                        <Repeat className="w-5 h-5" />
                                        تأكيد النقل
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setTransferModalOpen(false);
                                    setSelectedTransferRequest(null);
                                    setTargetRoomNumber('');
                                }}
                                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Requests List */}
            <div className="space-y-3">
                {currentRequests.length === 0 ? (
                    <div className="pro-card p-12 sm:p-16 md:p-20 text-center rounded-3xl">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-primary-500/20 to-primary-600/10 flex items-center justify-center mx-auto mb-6 shadow-lg">
                            <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-primary-400/60" />
                        </div>
                        <p className="text-lg sm:text-xl text-white/50 font-medium">لا توجد طلبات في هذه القائمة</p>
                    </div>
                ) : (
                    currentRequests.map(request => (
                        <RequestCard
                            key={request.id}
                            request={request}
                            onConfirm={request.status === 'PENDING' || request.status === 'PENDING_RECEPTION' ? () => handleConfirmRequest(request.id) : undefined}
                            onConfirmCompletion={
                                // ✅ Show confirm completion button for completed requests in "completed" tab
                                currentTab === 'completed' && request.status === 'COMPLETED' && request.currentDepartment === 'reception'
                                    ? () => handleConfirmCompletion(request.id)
                                    : undefined
                            }
                            onComplete={
                                // ⭐ CRITICAL: Don't show "Complete" button for maintenance requests
                                // Maintenance requests must go through: Reception → Maintenance → Housekeeping → Reception
                                // Only show Complete if:
                                // 1. Task is owned by Reception (e.g. extension, coffee, etc.) AND currentDepartment === 'reception'
                                // 2. OR User is manager/owner AND it's NOT a maintenance request in maintenance/housekeeping
                                // Maintenance requests should only be completed after returning from Housekeeping inspection
                                (request.type === 'maintenance' && request.currentDepartment !== 'reception')
                                    ? undefined // Hide Complete button for maintenance requests in maintenance/housekeeping departments
                                    : (
                                        (request.currentDepartment === 'reception' && request.type !== 'maintenance') ||
                                        ((user?.role === 'manager' || user?.role === 'owner') && request.type !== 'maintenance')
                                    ) && ['CONFIRMED', 'IN_PROGRESS'].includes(request.status)
                                        ? () => handleCompleteRequest(request.id)
                                        : undefined
                            }
                            onView={() => setSelectedRequest(request)}
                            userId={user?.id}
                            userName={user?.name}
                            userRole={user?.role}
                            onDelete={
                                // ✅ Manager/Admin/Owner: Direct delete (approve if deletion request exists)
                                ['manager', 'admin', 'owner'].includes(user?.role || '')
                                    ? () => setDeleteConfirmation({ id: request.id, show: true })
                                    : undefined
                            }
                            onRequestDeletion={
                                // ✅ Regular employees: Request deletion
                                !['manager', 'admin', 'owner'].includes(user?.role || '') && !request.deletionRequest
                                    ? () => {
                                        if (window.confirm('هل أنت متأكد من طلب حذف هذا الطلب؟ سيتم إرسال طلب للمدير للموافقة.')) {
                                            handleRequestDeletion(request.id);
                                        }
                                    }
                                    // ✅ Manager: Reject deletion request
                                    : request.deletionRequest && ['manager', 'admin', 'owner'].includes(user?.role || '')
                                        ? () => handleRejectDeletion(request.id)
                                        : undefined
                            }
                            onMove={
                                ['reception', 'front_desk', 'manager', 'owner', 'admin'].includes(user?.role || '') &&
                                    request.status === 'PENDING_RECEPTION'
                                    ? () => handleTransferRequest(request)
                                    : undefined
                            }
                            onArchive={
                                // ✅ Archive button for lost items cards
                                (request as any).isLostItemsCard && (request as any).lostItemsStatus === 'open'
                                    ? () => handleArchiveToLostFound(request.id)
                                    : undefined
                            }
                        />
                    ))
                )}
            </div>

            {/* Modals */}
            <QuickCreateModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                selectedType={selectedType}
                onSubmit={handleCreateRequest}
                rooms={rooms}
                requests={requests}
            />

            <ShiftNotes isOpen={showShiftNotes} onClose={() => setShowShiftNotes(false)} />
            <ProcurementCart isOpen={showProcurement} onClose={() => setShowProcurement(false)} department="reception" />
            <TeamMembers isOpen={showTeam} onClose={() => setShowTeam(false)} department="reception" />
            <UnifiedHistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} defaultDepartment="all" />
            
            {/* ✅ Lost & Found Modal */}
            <LostFoundModal
                isOpen={showLostFound}
                onClose={() => setShowLostFound(false)}
                branchId={branchId}
                tenantId={tenantId || ''}
                userId={user?.id || ''}
                userName={user?.name || ''}
            />

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

            {/* ✅ Request Details Modal */}
            <RequestDetailsModal
                request={selectedRequest}
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
                branchId={branchId}
            />

            {/* Room History Modal */}
            <RoomHistoryModal
                hotelId="default"
                branchId={branchId}
                roomNumber={roomHistoryRoom || ''}
                isOpen={!!roomHistoryRoom}
                onClose={() => setRoomHistoryRoom(null)}
            />
            {/* Delete Confirmation Modal */}
            {
                deleteConfirmation?.show && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200" style={{ backdropFilter: 'none' }}>
                        <div className="bg-gray-900/90 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4 mx-auto">
                                <Trash2 className="w-6 h-6 text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white text-center mb-2">حذف الطلب؟</h3>
                            <p className="text-white/60 text-center mb-6 text-sm">
                                هل أنت متأكد من حذف هذا الطلب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirmation(null)}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-colors font-medium text-sm"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-medium text-sm shadow-lg shadow-red-500/20"
                                >
                                    حذف نهائي
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* 🎤 Smart Voice FAB (Fixed Position) - Verified */}
            <VoiceInputButton
                onResult={processCommand}
                isFallbackMode={isFallbackMode}
                errorCount={errorCount}
                lastError={lastError}
                onRetry={retryLastCommand}
                onResetErrors={resetErrors}
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

            {/* Support Ticket Modal */}
            {showSupportTicket && (
                <SupportTicketModal
                    isOpen={showSupportTicket}
                    onClose={() => setShowSupportTicket(false)}
                    branchId={branchId}
                    branchName={branchId || 'الفرع'}
                />
            )}

            {/* General Instructions Modal */}
            <GeneralInstructionsView
                department="reception"
                isOpen={showGeneralInstructions}
                onClose={() => setShowGeneralInstructions(false)}
            />

            {/* WhatsApp Message Modal */}
            <WhatsAppMessageModal
                isOpen={showWhatsAppModal}
                onClose={() => setShowWhatsAppModal(false)}
                branchId={branchId}
                branchName={branchId || 'الفرع'}
                branchNumber={branchId || ''}
                rooms={rooms}
            />

            {/* ✅ Onboarding Tour */}
            <TourGuide
                steps={tourSteps}
                isOpen={showTour}
                onClose={closeTour}
                onComplete={completeTour}
            />

            {/* 💬 Chat Inbox Modal */}
            {showChatInbox && tenantId && branchId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                    <div className="w-full max-w-5xl">
                        <div className="flex justify-end mb-2">
                            <button 
                                onClick={() => setShowChatInbox(false)}
                                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                            >
                                ✕
                            </button>
                        </div>
                        <ChatInbox
                            tenantId={tenantId}
                            branchId={branchId}
                        />
                    </div>
                </div>
            )}

            {/* 💬 Floating Chat Button */}
            <button
                onClick={() => setShowChatInbox(true)}
                className="fixed bottom-20 left-4 z-40 p-4 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500
                           shadow-lg shadow-teal-500/30 hover:scale-110 transition-all"
                title="صندوق الشات"
            >
                <MessageCircle className="w-6 h-6 text-white" />
            </button>

            {/* 📝 Developer Signature */}
            {/* Developer Signature is in GlobalFooter (App.tsx) */}
        </div>
        </PageTransition>
    );
};

export default ReceptionDashboard;
