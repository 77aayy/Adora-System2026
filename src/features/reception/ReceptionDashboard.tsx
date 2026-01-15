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
import { TrendingUp, TrendingDown, User } from 'lucide-react';
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
    CalendarClock, // ✅ Scheduled requests icon
    ArrowRightLeft, // ✅ Department transfer icon
    Zap, // ✅ Quick Actions header icon
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
import { useTranslation } from 'react-i18next';
import { db } from '../../services/firebase';
import {
    collection, query, where, onSnapshot, doc, updateDoc,
    addDoc, Timestamp, orderBy, getDocs, getDoc, increment, deleteDoc, limit, deleteField,
    FieldPath
} from 'firebase/firestore';

// Shared Components
import { ShiftNotes } from '../../components/shared/ShiftNotes';
import { PointsTracker } from '../../components/shared/PointsTracker';
import { ProcurementCartWizard } from '../../components/shared/ProcurementCartWizard';
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
import { SmartBranchSetupWizard } from '../admin/SmartBranchSetupWizard'; // ✅ Smart setup wizard for new managers
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
    currentDepartment: 'reception' | 'housekeeping' | 'maintenance' | 'bellman' | 'coffee_shop';
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
type TabType = 'new' | 'in_progress' | 'completed'; // ✅ Unified tabs

// ============================================================
// CONSTANTS
// ============================================================

// ✅ THEME-AWARE: Using CSS Variables for consistent Light/Dark styling
// Note: QUICK_ACTIONS, SERVICE_NAMES, and STATUS_CONFIG are now defined inside the component to use t()

// ============================================================
// HELPER COMPONENTS
// ============================================================

// Stats Card - MOVED TO: components/common/StatCard.tsx
// Using centralized version for consistency (supports both 'color' and 'bgColor' props)

// ✅ COMPACT Request Card - Mobile-First with Essential Info
// Shows: Room, Service, Guest Status, QR Info, Notes, Time
const CompactRequestCard: React.FC<{
    request: ServiceRequest;
    onView: () => void;
    onQuickAction?: (action: 'confirm' | 'complete') => void;
    quickActions: QuickAction[];
    serviceNames: Record<string, string>;
    statusConfig: typeof STATUS_CONFIG;
}> = ({ request, onView, onQuickAction, quickActions, serviceNames, statusConfig }) => {
    const { t } = useTranslation();
    const serviceConfig = quickActions.find(a => a.type === request.type);
    
    // ✅ Department names helper using t()
    const getDeptName = useCallback((dept: string): string => {
        const deptMap: Record<string, string> = {
            'reception': t('departments.reception'),
            'housekeeping': t('departments.housekeeping'),
            'maintenance': t('departments.maintenance'),
            'bellman': t('departments.bellman'),
            'coffee_shop': t('departments.coffeeshop'),
            'coffeeshop': t('departments.coffeeshop'),
            'procurement': t('departments.procurement')
        };
        return deptMap[dept] || dept;
    }, [t]);
    
    // Calculate time ago
    const timeAgo = useMemo(() => {
        if (!request.createdAt) return '';
        const date = request.createdAt.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return t('reception.timeAgo.now');
        if (diff < 60) return `${diff}${t('reception.timeAgo.minutes')}`;
        if (diff < 1440) return `${Math.floor(diff / 60)}${t('reception.timeAgo.hours')}`;
        return `${Math.floor(diff / 1440)}${t('reception.timeAgo.days')}`;
    }, [request.createdAt, t]);
    
    const isUrgent = request.priority === 'urgent' || request.isEmergency;
    const isDelayed = request.status !== 'COMPLETED' && request.createdAt && 
        (Date.now() - (request.createdAt.toDate ? request.createdAt.toDate() : new Date(request.createdAt)).getTime()) > 30 * 60000;
    const isQR = request.source === 'QR';
    
    return (
        <div
            onClick={onView}
            className={`
                p-3 rounded-xl cursor-pointer
                transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]
                adora-card border shadow-sm
                ${isUrgent ? 'border-red-500/50 ring-1 ring-red-500/30' : 'adora-border'}
                ${isDelayed ? 'border-orange-500/50 ring-1 ring-orange-500/30' : ''}
                ${isQR ? 'border-teal-500/50' : ''}
            `}
        >
            {/* Row 1: Room + Service + Status */}
            <div className="flex items-center gap-2 mb-2">
                {/* Service Icon */}
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 ${serviceConfig?.bgColor || 'adora-bg-tertiary'} flex items-center justify-center`}>
                    <span className={`${serviceConfig?.color || 'adora-text-tertiary'} scale-[0.6]`}>
                        {serviceConfig?.icon || <Sparkles className="w-4 h-4" />}
                    </span>
                </div>
                
                {/* Room & Service */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-base font-bold adora-text-primary">{t('reception.room.roomShort')}{request.roomNumber}</span>
                        {isUrgent && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                        {isQR && (
                            <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-600 dark:text-teal-400 text-[9px] font-bold flex items-center gap-0.5">
                                <QrCode className="w-2.5 h-2.5" /> QR
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] adora-text-secondary">{serviceNames[request.type] || request.type}</p>
                </div>
                
                {/* Time & Status */}
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        request.status === 'COMPLETED' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                        request.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                        request.status === 'CONFIRMED' ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400' :
                        'bg-orange-500/20 text-orange-600 dark:text-orange-400'
                    }`}>
                        {request.status === 'COMPLETED' ? t('reception.statusLabels.completed') :
                         request.status === 'IN_PROGRESS' ? t('reception.statusLabels.inProgressShort') :
                         request.status === 'CONFIRMED' ? t('reception.statusLabels.confirmed') : t('reception.statusLabels.newShort')}
                    </div>
                    <span className="text-[10px] adora-text-disabled">{timeAgo}</span>
                </div>
            </div>
            
            {/* Row 2: Guest Info (for QR requests) */}
            {isQR && (request.guestIdentity || request.guestPhone || request.guestName) && (
                <div className="flex items-center gap-2 mb-2 p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
                    <User className="w-3 h-3 text-teal-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-[10px] text-teal-700 dark:text-teal-300">
                        <span className="font-bold">{request.guestName || t('reception.guest.guest')}</span>
                        {request.guestIdentity && <span className="mr-2">• {t('reception.guest.identity')}: {request.guestIdentity}</span>}
                        {request.guestPhone && <span className="mr-2">• {t('reception.guest.phone')}: {request.guestPhone}</span>}
                    </div>
                </div>
            )}
            
            {/* Row 3: Guest Status (داخل/خارج الغرفة) */}
            {request.guestStatus && (
                <div className={`flex items-center gap-1.5 mb-2 p-1.5 rounded-lg text-[10px] font-medium ${
                    request.guestStatus === 'in' 
                        ? 'bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20' 
                        : 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20'
                }`}>
                    {request.guestStatus === 'in' ? (
                        <><User className="w-3 h-3" /> {t('reception.guestInRoom')}</>
                    ) : (
                        <><DoorOpen className="w-3 h-3" /> {t('reception.roomEmpty')}</>
                    )}
                </div>
            )}
            
            {/* Row 4: Notes (truncated) */}
            {request.notes && request.notes.trim() && (
                <div className="flex items-start gap-1.5 mb-2 p-1.5 rounded-lg bg-slate-500/10 border border-slate-500/20">
                    <MessageSquare className="w-3 h-3 adora-text-secondary flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] adora-text-secondary line-clamp-2">{request.notes}</p>
                </div>
            )}
            
            {/* Row 5: Department Tracking */}
            {request.currentDepartment && request.currentDepartment !== 'reception' && (
                <div className="flex items-center gap-1.5 mb-2 text-[10px] adora-text-tertiary">
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>{t('reception.currentlyIn')}: {getDeptName(request.currentDepartment)}</span>
                </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t adora-border">
                {/* Quick Confirm (for pending) */}
                {(request.status === 'PENDING' || request.status === 'PENDING_RECEPTION') && onQuickAction && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onQuickAction('confirm'); }}
                        className="flex-1 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-teal-600 transition-colors"
                    >
                        <Check className="w-3 h-3" /> {t('reception.confirm')}
                    </button>
                )}
                
                {/* View Details */}
                <button
                    onClick={(e) => { e.stopPropagation(); onView(); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center gap-1 adora-bg-tertiary adora-text-secondary hover:adora-bg-secondary transition-colors ${
                        (request.status === 'PENDING' || request.status === 'PENDING_RECEPTION') ? '' : 'flex-1 justify-center'
                    }`}
                >
                    <Eye className="w-3 h-3" /> {t('reception.details')}
                </button>
            </div>
        </div>
    );
};

// Request Card - Full version for expanded view (kept for compatibility)
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
    const { t, i18n } = useTranslation();
    const StatusIcon = STATUS_CONFIG[request.status]?.icon || AlertCircle;
    const statusConfig = STATUS_CONFIG[request.status];

    // ✅ Calculate last action and time ago
    const { lastActionText, timeAgo } = useMemo(() => {
        // Helper to format time ago
        const getTimeAgo = (timestamp: any): string => {
            if (!timestamp) return '';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const diff = Math.floor((Date.now() - date.getTime()) / 60000);
            if (diff < 1) return t('reception.timeAgo.now');
            if (diff < 60) return `${diff} ${t('reception.timeAgo.minutes')}`;
            if (diff < 1440) return `${Math.floor(diff / 60)} ${t('reception.timeAgo.hours')}`;
            return `${Math.floor(diff / 1440)} ${t('reception.timeAgo.days')}`;
        };

        // ✅ Helper to get department name using t() (inside useMemo, so can use t directly)
        const getDeptName = (dept: string): string => {
            const deptMap: Record<string, string> = {
                'reception': t('departments.reception'),
                'housekeeping': t('departments.housekeeping'),
                'maintenance': t('departments.maintenance'),
                'bellman': t('departments.bellman'),
                'coffee_shop': t('departments.coffeeshop'),
                'coffeeshop': t('departments.coffeeshop'),
                'procurement': t('departments.procurement')
            };
            return deptMap[dept] || dept;
        };

        // 1. Check departmentHistory for last transfer/action
        if (request.departmentHistory && request.departmentHistory.length > 0) {
            const history = request.departmentHistory;
            const lastEntry = history[history.length - 1];
            
            if (lastEntry.enteredAt) {
                const timeAgoStr = getTimeAgo(lastEntry.enteredAt);
                if (lastEntry.department) {
                    return {
                        lastActionText: `${t('reception.sentTo')} ${getDeptName(lastEntry.department)}`,
                        timeAgo: timeAgoStr
                    };
                }
            }
            
            if (lastEntry.exitedAt) {
                const timeAgoStr = getTimeAgo(lastEntry.exitedAt);
                if (lastEntry.nextDepartment) {
                    return {
                        lastActionText: `${t('reception.sentFrom')} ${getDeptName(lastEntry.department || '')} ${t('reception.to')} ${getDeptName(lastEntry.nextDepartment)}`,
                        timeAgo: timeAgoStr
                    };
                }
            }
        }

        // 2. Check timeline for status changes
        if (request.timeline) {
            if (request.timeline.completed && request.status === 'COMPLETED') {
                return {
                    lastActionText: t('reception.completed'),
                    timeAgo: getTimeAgo(request.timeline.completed)
                };
            }
            if (request.timeline.started && request.status === 'IN_PROGRESS') {
                return {
                    lastActionText: t('reception.started'),
                    timeAgo: getTimeAgo(request.timeline.started)
                };
            }
            if (request.timeline.confirmed && request.status === 'CONFIRMED') {
                return {
                    lastActionText: t('reception.confirmed'),
                    timeAgo: getTimeAgo(request.timeline.confirmed)
                };
            }
        }

        // 3. Check currentDepartment to determine current location
        if (request.currentDepartment && request.currentDepartment !== request.originDepartment) {
            return {
                lastActionText: `${t('reception.currentlyIn')} ${getDeptName(request.currentDepartment)}`,
                timeAgo: getTimeAgo(request.createdAt)
            };
        }

        // 4. Fallback to createdAt
        return {
            lastActionText: t('reception.created'),
            timeAgo: getTimeAgo(request.createdAt)
        };
    }, [request.departmentHistory, request.timeline, request.currentDepartment, request.originDepartment, request.status, request.createdAt, t]);

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
                adora-request-card-v2
                group
                ${isUrgent ? 'urgent' : ''}
                ${isDelayed ? 'delayed' : ''}
                ${request.type === 'coffee' && request.status === 'COMPLETED' && request.currentDepartment === 'reception' 
                    ? 'adora-coffee-delivered' 
                    : ''}
            `}
            onClick={handleClick}
        >
            {/* Soft Background Glow - Theme Aware */}
            <div className="
                absolute -top-16 -right-16
                w-32 h-32
                rounded-full
                blur-3xl
                opacity-0
                group-hover:opacity-100
                transition-opacity duration-500
            " style={{ background: 'linear-gradient(135deg, rgba(var(--theme-primary-500-rgb, 13, 148, 136), 0.06) 0%, rgba(var(--theme-primary-400-rgb, 45, 212, 191), 0.04) 100%)' }} />
            {/* Header - Mobile Optimized - Theme Aware */}
            <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="text-2xl sm:text-3xl font-semibold adora-text-primary tracking-tight">{t('reception.room.roomShort')}{request.roomNumber}</span>
                    {isUrgent && (
                        <span className="adora-badge adora-badge-red text-xs font-bold">
                            {t('reception.urgent')}
                        </span>
                    )}
                    {isDelayed && (
                        <span className="adora-badge adora-badge-orange text-xs font-bold animate-pulse">
                            {t('reception.delayed')}
                        </span>
                    )}
                    {/* ☕ Coffee Shop Completion Badge */}
                    {request.type === 'coffee' && request.status === 'COMPLETED' && request.currentDepartment === 'reception' && (
                        <span className="adora-badge adora-badge-yellow text-xs font-bold">
                            ☕ {t('reception.delivered')}
                        </span>
                    )}
                    {/* ✅ Emergency Request Badge */}
                    {request.isEmergency && (
                        <span className="adora-badge adora-badge-red text-xs font-bold animate-pulse">
                            🔴 {t('reception.emergencyRequest')}
                        </span>
                    )}
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${statusConfig.bg} adora-border flex-shrink-0 shadow-sm`}>
                    <StatusIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${statusConfig.color}`} />
                    <span className={`text-xs sm:text-sm font-semibold ${statusConfig.color} hidden sm:inline`}>{statusConfig.label}</span>
                </div>
            </div>

            {/* Content - Mobile Optimized - Theme Aware */}
            <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-[1.25rem] flex-shrink-0 ${QUICK_ACTIONS.find(a => a.type === request.type)?.bgColor || 'adora-bg-tertiary'} flex items-center justify-center relative shadow-sm adora-border transition-all duration-300 group-hover:scale-105`}>
                    <span className={QUICK_ACTIONS.find(a => a.type === request.type)?.color}>
                        {QUICK_ACTIONS.find(a => a.type === request.type)?.icon || <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 adora-text-tertiary" />}
                    </span>
                    {/* ✅ QR Badge - Show if request is from QR */}
                    {request.source === 'QR' && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 shadow-lg" style={{ background: 'var(--theme-primary-500)', borderColor: 'var(--theme-bg-secondary)' }}>
                            <QrCode className="w-3 h-3 text-white" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="adora-text-primary font-medium text-sm sm:text-base truncate tracking-wide">{SERVICE_NAMES[request.type]}</p>
                        {/* ✅ QR Badge - Text version */}
                        {request.source === 'QR' && (
                            <span className="adora-badge adora-badge-teal text-xs font-bold flex items-center gap-1 flex-shrink-0">
                                <Smartphone className="w-3 h-3" />
                                <span className="hidden sm:inline">QR</span>
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="adora-text-secondary text-xs sm:text-sm truncate">{request.guestName || t('reception.guest.guest')}</p>
                        {/* ✅ Guest Info - Show identity/phone if available */}
                        {(request.guestIdentity || request.guestPhone) && (
                            <span className="adora-text-disabled text-xs sm:text-xs flex items-center gap-1">
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
                        <span className="adora-text-tertiary text-xs sm:text-xs whitespace-nowrap text-right leading-tight max-w-[120px] sm:max-w-none">{lastActionText}</span>
                        {/* WhatsApp-style read receipt */}
                        <ReadReceipt request={request as any} size="sm" showPopup={false} />
                    </div>
                    <span className="adora-text-disabled text-xs sm:text-sm whitespace-nowrap font-medium">{t('reception.since')} {timeAgo}</span>
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

            {/* ⚠️ SMART ALERT: Room Mismatch - Theme Aware */}
            {potentialMismatch && (
                <div className="mb-3 adora-info-box orange animate-pulse">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs font-bold">{t('reception.roomMismatchAlert')}</p>
                        <p className="text-xs opacity-80">
                            {t('reception.guestRegisteredIn')} <b>{potentialMismatch}</b>. {t('reception.wantToTransferRequest')}
                        </p>
                    </div>
                    {onMove && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onMove(); }}
                            className="adora-btn adora-btn-warning adora-btn-sm"
                        >
                            {t('reception.transferRequest')}
                        </button>
                    )}
                </div>
            )}

            {/* 🗑️ DELETION REQUEST ALERT - Theme Aware */}
            {request.deletionRequest && (
                <div className="mb-3 adora-info-box red animate-pulse">
                    <Trash2 className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs font-bold">{t('reception.pendingDeletion')}</p>
                        <p className="text-xs opacity-60">{t('reception.by')}: {request.deletionRequest.requestedBy}</p>
                    </div>
                    {/* If Manager, show Approval Badge */}
                    {['manager', 'admin', 'owner'].includes(userRole || '') && (
                        <span className="adora-badge adora-badge-red text-xs">
                            {t('reception.approvalRequired')}
                        </span>
                    )}
                </div>
            )}

            {/* ✅ QR Request Info - Theme Aware */}
            {request.source === 'QR' && request.status === 'PENDING_RECEPTION' && (
                <div className="mb-3 adora-info-box teal">
                    <QrCode className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs font-bold">{t('reception.qrRequestNeedsConfirmTitle')}</p>
                        <p className="text-xs opacity-80 mt-0.5">
                            {t('reception.guestLabel')} <b>{request.guestName || t('reception.guestNotSpecified')}</b>
                            {request.guestIdentity && ` • ${t('reception.identityLabel')} ${request.guestIdentity}`}
                            {request.guestPhone && ` • ${t('reception.phoneLabel')} ${request.guestPhone}`}
                        </p>
                        <p className="text-xs opacity-60 mt-1">
                            {t('reception.pleaseVerify')}
                        </p>
                    </div>
                </div>
            )}

            {/* ✅ Inspection Results - Theme Aware */}
            {request.inspectionResult && (request.inspectionResult === 'damages' || request.inspectionResult === 'missing_items') && request.inspectionPhoto && (
                <div className="mb-3 adora-info-box orange" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <p className="text-xs font-bold">
                            {request.inspectionResult === 'damages' ? `⚠️ ${t('reception.damagesInRoom')}` : `📦 ${t('reception.lostItemsInRoom')}`}
                        </p>
                    </div>
                    <img 
                        src={request.inspectionPhoto} 
                        alt={request.inspectionResult === 'damages' ? t('reception.damagePhoto') : t('reception.lostPhoto')}
                        className="w-full h-32 sm:h-40 object-cover rounded-lg mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(request.inspectionPhoto, '_blank');
                        }}
                    />
                    {request.inspectionNotes && (
                        <p className="text-xs opacity-80 mt-1">{request.inspectionNotes}</p>
                    )}
                </div>
            )}

            {/* ✅ Minibar Consumption - Theme Aware */}
            {request.minibarConsumption && request.minibarConsumption.length > 0 && (
                <div className="mb-3 adora-info-box green" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div className="flex items-center gap-2 mb-1.5">
                        <ShoppingCart className="w-4 h-4" />
                        <p className="text-xs font-bold">{t('reception.minibarConsumption')}</p>
                        {request.minibarTotal && (
                            <span className="mr-auto text-xs font-bold">{t('reception.total')}: {request.minibarTotal} {t('currency.sar')}</span>
                        )}
                    </div>
                    <div className="space-y-1">
                        {request.minibarConsumption.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs opacity-80">
                                <span>{item.productName}</span>
                                <span>{item.quantity} × {item.pricePerUnit} {t('reception.sarCurrency')} = {item.total} {t('reception.sarCurrency')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ✅ Lost Items Card - Theme Aware */}
            {(request as any).isLostItemsCard && (request as any).lostItemsStatus === 'open' && onArchive && (
                <div className="mb-3 adora-info-box purple">
                    <Package className="w-5 h-5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs font-bold">{t('reception.lostFoundCardOpen')}</p>
                        <p className="text-xs opacity-60">{t('reception.readyForArchive')}</p>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onArchive(); }}
                        className="adora-btn adora-btn-sm"
                        style={{ background: 'linear-gradient(135deg, var(--theme-accent-purple) 0%, var(--theme-accent-purple-dark) 100%)', color: 'white' }}
                    >
                        <Archive className="w-4 h-4" />
                        {t('reception.transferRequest')} {t('common.to')} {t('common.archive')}
                    </button>
                </div>
            )}

            {/* 📝 NOTES & ADDITIONAL INFO - Always visible if exists */}
            {request.notes && request.notes.trim() && (
                <div className="mb-3 adora-info-box slate">
                    <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-xs font-bold mb-1">{t('reception.requestNotes')}</p>
                        <p className="text-sm opacity-90 leading-relaxed whitespace-pre-wrap">{request.notes}</p>
                    </div>
                </div>
            )}

            {/* 🛒 Cart/Amenities Request - Theme Aware */}
            {request.needsCart && (
                <div className="mb-3 adora-info-box blue">
                    <ShoppingCart className="w-4 h-4 flex-shrink-0" />
                    <p className="text-xs font-bold">{t('reception.needsCleaningCart')}</p>
                </div>
            )}

            {/* 👥 Guest Status - Theme Aware */}
            {request.guestStatus && (
                <div className={`mb-3 adora-info-box ${request.guestStatus === 'in' ? 'green' : 'orange'}`}>
                    <User className="w-4 h-4 flex-shrink-0" />
                    <p className="text-xs font-bold">
                        {request.guestStatus === 'in' ? `✅ ${t('reception.guestInRoom')}` : `🚪 ${t('reception.roomEmpty')}`}
                    </p>
                </div>
            )}

            {/* 📍 Current Department Tracking - Theme Aware */}
            {request.currentDepartment && request.currentDepartment !== 'reception' && (
                <div className="mb-3 adora-info-box cyan">
                    <ArrowRightLeft className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs font-bold">{t('reception.currentlyIn')}: {(() => {
                            const deptNames: Record<string, string> = {
                                housekeeping: `${t('departments.housekeeping')} 🧹`,
                                maintenance: `${t('departments.maintenance')} 🔧`,
                                bellman: `${t('departments.bellman')} 🛎️`,
                                coffee_shop: `${t('departments.coffeeshop')} ☕`
                            };
                            return deptNames[request.currentDepartment] || request.currentDepartment;
                        })()}</p>
                        {request.assignedTo?.name && (
                            <p className="text-xs opacity-70 mt-0.5">{t('reception.responsible')} {request.assignedTo.name}</p>
                        )}
                    </div>
                </div>
            )}

            {/* 📅 Scheduled Request - Theme Aware */}
            {request.scheduledAt && (
                <div className="mb-3 adora-info-box purple">
                    <CalendarClock className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs font-bold">{t('reception.priority.scheduled')} {t('common.request')}</p>
                        <p className="text-xs opacity-70">
                            {(() => {
                                const date = request.scheduledAt.toDate ? request.scheduledAt.toDate() : new Date(request.scheduledAt);
                                const locale = i18n.language === 'ar' ? 'ar-SA' : i18n.language === 'hi' ? 'hi-IN' : i18n.language === 'bn' ? 'bn-BD' : 'en-US';
                                return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
                            })()}
                        </p>
                    </div>
                </div>
            )}

            {/* Actions - Mobile Optimized - Theme Aware */}
            <div className="flex gap-1.5 sm:gap-2">
                {(request.status === 'PENDING' || request.status === 'PENDING_RECEPTION') && onConfirm && (
                    <div className="flex gap-1.5 sm:gap-2 flex-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                            className="adora-btn adora-btn-success flex-1 py-4 sm:py-5 text-base sm:text-lg rounded-[1.5rem] group"
                        >
                            <Check className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 group-hover:scale-105" />
                            <span>{t('reception.confirmButton')}</span>
                        </button>
                        {onMove && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onMove(); }}
                                className="adora-btn px-3 rounded-xl"
                                style={{ background: 'var(--theme-accent-orange-light)', color: 'var(--theme-accent-orange)' }}
                                title={t('reception.transferRequest')}
                            >
                                <Repeat className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
                {(request.status === 'CONFIRMED' || request.status === 'IN_PROGRESS') && onComplete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onComplete(); }}
                        className="adora-btn flex-1 py-4 sm:py-5 text-sm sm:text-base rounded-[1.5rem] group"
                        style={{ background: 'linear-gradient(135deg, var(--theme-accent-blue) 0%, var(--theme-accent-blue-dark) 100%)', color: 'white', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)' }}
                    >
                        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 group-hover:scale-105" />
                        <span>{t('reception.completeButton')}</span>
                    </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onView?.(); }}
                    className="adora-btn adora-btn-secondary py-2.5 sm:py-2 px-3 sm:px-4 rounded-xl"
                >
                    <Eye className="w-4 h-4" />
                </button>
                {/* ✅ Delete/Request Deletion Button - Theme Aware */}
                {!request.deletionRequest && (
                    <>
                        {/* Manager/Admin/Owner: Direct Delete */}
                        {['manager', 'admin', 'owner'].includes(userRole || '') && onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="adora-btn py-2.5 sm:py-2 px-3 sm:px-4 rounded-xl"
                                style={{ background: 'var(--theme-accent-red-light)', color: 'var(--theme-accent-red)' }}
                                title={t('reception.deleteRequest')}
                            >
                                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        )}
                        {/* Regular Employees: Request Deletion */}
                        {!['manager', 'admin', 'owner'].includes(userRole || '') && onRequestDeletion && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRequestDeletion(); }}
                                className="adora-btn py-2.5 sm:py-2 px-3 sm:px-4 rounded-xl"
                                style={{ background: 'var(--theme-accent-orange-light)', color: 'var(--theme-accent-orange)' }}
                                title={t('reception.requestDeletion')}
                            >
                                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="hidden sm:inline text-xs font-medium">{t('reception.requestDeletionShort')}</span>
                            </button>
                        )}
                    </>
                )}
                {/* Manager: Approve/Reject Deletion Request */}
                {request.deletionRequest && ['manager', 'admin', 'owner'].includes(userRole || '') && onDelete && (
                    <div className="flex gap-1.5">
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            className="adora-btn px-3 py-2 rounded-xl"
                            style={{ background: 'var(--theme-accent-red-light)', color: 'var(--theme-accent-red)' }}
                            title={t('reception.approveDeletion')}
                        >
                            <CheckCircle className="w-4 h-4" />
                        </button>
                        {onRequestDeletion && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRequestDeletion(); }}
                                className="adora-btn adora-btn-secondary px-3 py-2 rounded-xl"
                                title={t('reception.rejectDeletion')}
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

// ✅ Lost & Found Modal - Display and Manage Lost Items with Tabs
const LostFoundModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    branchId: string;
    tenantId: string;
    userId: string;
    userName: string;
}> = ({ isOpen, onClose, branchId, tenantId, userId, userName }) => {
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language;
    const { success, error } = useUX();
    const [items, setItems] = useState<LostFoundItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'active' | 'log'>('active');

    useEffect(() => {
        if (!isOpen) return;
        const unsubscribe = subscribeToLostFound(branchId, (data) => {
            setItems(data);
            setLoading(false);
        });
        return unsubscribe;
    }, [isOpen, branchId]);

    // ✅ Filter items based on tab
    const activeItems = useMemo(() => items.filter(i => i.status === 'found' || i.status === 'claimed'), [items]);
    const logItems = useMemo(() => items.filter(i => i.status === 'returned' || i.status === 'disposed'), [items]);

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
                        description: `${t('reception.lostFoundDeliverySuccess').split(' ')[0]}: ${item.description}`,
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

            success(t('reception.lostFoundDeliverySuccess'));
        } catch (err: any) {
            console.error('Error returning item:', err);
            error(t('reception.lostFoundDeliveryFailed') + ' ' + (err.message || t('reception.unknownError')));
        }
    };

    // ✅ Format date with dynamic locale based on current language
    const formatDate = useCallback((timestamp: any): string => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const locale = currentLanguage === 'ar' ? 'ar-SA' : currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'bn' ? 'bn-BD' : 'en-US';
        return date.toLocaleString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }, [currentLanguage]);

    // ✅ Get time ago using t() with interpolation
    const getTimeAgo = useCallback((timestamp: any): string => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return t('reception.nowTime');
        if (diff < 60) return t('reception.minutesAgo', { minutes: diff });
        if (diff < 1440) return t('reception.hoursAgo', { hours: Math.floor(diff / 60) });
        return t('reception.daysAgo', { days: Math.floor(diff / 1440) });
    }, [t]);

    if (!isOpen) return null;

    return (
        <div className="adora-modal-backdrop">
            <div className="adora-modal-v2 w-full max-w-md sm:max-w-lg lg:max-w-2xl max-h-[90vh]">
                {/* Header */}
                <div className="adora-modal-header-v2">
                    <div className="flex items-center gap-3">
                        <div className="adora-modal-icon" style={{ background: 'var(--theme-accent-purple-light)', color: 'var(--theme-accent-purple)' }}>
                            <Package className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="adora-modal-title-v2">{t('reception.lostAndFound')}</h2>
                            <p className="adora-modal-subtitle">{t('reception.lostAndFound')} {t('reception.inspection')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="adora-modal-close-v2">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-white/10">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'active'
                                ? 'bg-teal-500 text-white shadow-md'
                                : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/20'
                        }`}
                    >
                        {t('reception.activeTab')} ({activeItems.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('log')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'log'
                                ? 'bg-teal-500 text-white shadow-md'
                                : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/20'
                        }`}
                    >
                        {t('reception.logTab')} ({logItems.length})
                    </button>
                </div>

                {/* Content */}
                <div className="adora-modal-body-v2">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <AdoraLoader size="md" message={t('reception.loading')} />
                        </div>
                    ) : (activeTab === 'active' ? activeItems : logItems).length === 0 ? (
                        <div className="adora-empty">
                            <div className="adora-empty-icon">
                                <Package className="w-8 h-8" />
                            </div>
                            <p className="adora-empty-description">
                                {activeTab === 'active' ? t('reception.noActiveLostItems') : t('reception.logEmpty')}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 3xl:gap-12">
                            {(activeTab === 'active' ? activeItems : logItems).map(item => (
                                <div key={item.id} className="adora-card p-5 sm:p-6 hover:shadow-lg transition-all duration-200 group">
                                    {/* Header */}
                                    <div className="flex items-start gap-4 mb-4">
                                        {item.imageUrl ? (
                                            <img
                                                src={item.imageUrl}
                                                alt={item.description}
                                                className="w-16 h-16 rounded-xl object-cover"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl adora-bg-tertiary flex items-center justify-center text-2xl">
                                                📦
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <p className="adora-text-primary font-medium text-sm mb-1">{item.description}</p>
                                            <p className="adora-text-tertiary text-xs">{t('reception.roomLabel')} {item.roomNumber || '-'}</p>
                                        </div>
                                        <span className={`adora-badge ${
                                            item.status === 'found' ? 'adora-badge-blue' :
                                            item.status === 'claimed' ? 'adora-badge-yellow' :
                                            item.status === 'returned' ? 'adora-badge-green' :
                                            'adora-badge-teal'
                                        } text-xs font-bold`}>
                                            {item.status === 'found' ? t('reception.foundStatus') :
                                             item.status === 'claimed' ? t('reception.claimedStatus') :
                                             item.status === 'returned' ? t('reception.returnedStatus') : t('reception.disposedStatus')}
                                        </span>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-2 mb-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="adora-text-tertiary">{t('reception.foundDate')}</span>
                                            <span className="adora-text-secondary">{formatDate(item.createdAt)}</span>
                                        </div>
                                        {item.foundBy && (
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="adora-text-tertiary">{t('reception.foundBy')}</span>
                                                <span className="adora-text-secondary">{item.foundBy.name}</span>
                                            </div>
                                        )}
                                        {item.returnedBy && item.returnedAt && (
                                            <div className="adora-info-box green" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.25rem' }}>
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="font-bold">{t('reception.returnedLabel')}</span>
                                                    <span className="opacity-80">{formatDate(item.returnedAt)}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="opacity-60">{t('reception.returnedBy')}</span>
                                                    <span className="opacity-80">{item.returnedBy.name}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs mt-1">
                                                    <span className="opacity-60">{t('reception.timeLabel')}</span>
                                                    <span className="opacity-80">{getTimeAgo(item.returnedAt)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {item.status !== 'returned' && item.status !== 'disposed' && (
                                        <button
                                            onClick={() => handleReturnItem(item.id)}
                                            className="adora-btn adora-btn-primary w-full"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            {t('reception.returnItemButton')}
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
    quickActions: QuickAction[];
    serviceNames: Record<string, string>;
    statusConfig: typeof STATUS_CONFIG;
}> = ({ request, isOpen, onClose, branchId, quickActions, serviceNames, statusConfig }) => {
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language;
    
    if (!isOpen || !request) return null;

    // ✅ Department names helper using t() with useMemo
    const getDeptName = useCallback((dept: string): string => {
        const deptMap: Record<string, string> = {
            'reception': t('departments.reception'),
            'housekeeping': t('departments.housekeeping'),
            'maintenance': t('departments.maintenance'),
            'bellman': t('departments.bellman'),
            'coffee_shop': t('departments.coffeeshop'),
            'coffeeshop': t('departments.coffeeshop'),
            'procurement': t('departments.procurement')
        };
        return deptMap[dept] || dept;
    }, [t]);

    // ✅ Format time with dynamic locale based on current language
    const formatTime = useCallback((timestamp: any): string => {
        if (!timestamp) return t('reception.notSpecifiedTime');
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const locale = currentLanguage === 'ar' ? 'ar-SA' : currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'bn' ? 'bn-BD' : 'en-US';
        return date.toLocaleString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }, [t, currentLanguage]);

    // ✅ Get time ago using t() with interpolation
    const getTimeAgo = useCallback((timestamp: any): string => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return t('reception.nowTime');
        if (diff < 60) return t('reception.minutesAgo', { minutes: diff });
        if (diff < 1440) return t('reception.hoursAgo', { hours: Math.floor(diff / 60) });
        return t('reception.daysAgo', { days: Math.floor(diff / 1440) });
    }, [t]);

    // ✅ Build timeline from departmentHistory and timeline using t()
    const timelineEvents: Array<{ action: string; time: any; department?: string; by?: string }> = useMemo(() => {
        const events: Array<{ action: string; time: any; department?: string; by?: string }> = [];
        
        // 1. Created
        if (request.createdAt) {
            events.push({
                action: t('reception.requestCreated'),
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
                    events.push({
                        action: `${t('reception.sentToDepartment')} ${getDeptName(entry.department)}`,
                        time: entry.enteredAt,
                        department: getDeptName(entry.department),
                        by: entry.handledBy?.name
                    });
                }
                // When request exited/left this department
                if (entry.exitedAt) {
                    const nextDept = entry.nextDepartment 
                        ? `${t('reception.toDepartment')} ${getDeptName(entry.nextDepartment)}` 
                        : t('reception.fromDepartment');
                    events.push({
                        action: `${t('reception.sentFrom')} ${getDeptName(entry.department)} ${nextDept}`,
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
                events.push({
                    action: t('reception.requestConfirmed'),
                    time: request.timeline.confirmed,
                    by: request.confirmedBy?.name
                });
            }
            if (request.timeline.started) {
                events.push({
                    action: t('reception.requestStarted'),
                    time: request.timeline.started,
                    by: request.assignedTo?.name || (request as any).startedBy
                });
            }
            if (request.timeline.completed) {
                events.push({
                    action: t('reception.requestCompleted'),
                    time: request.timeline.completed,
                    by: request.completedBy?.name
                });
            }
        }
        
        return events;
    }, [request, t, getDeptName]);

    // ✅ Sort by time (newest first)
    const sortedTimelineEvents = useMemo(() => {
        return [...timelineEvents].sort((a, b) => {
            const aTime = a.time?.toDate ? a.time.toDate().getTime() : new Date(a.time).getTime();
            const bTime = b.time?.toDate ? b.time.toDate().getTime() : new Date(b.time).getTime();
            return bTime - aTime;
        });
    }, [timelineEvents]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200" style={{ backdropFilter: 'none' }}>
            <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${quickActions.find(a => a.type === request.type)?.bgColor || 'bg-white/10'} flex items-center justify-center`}>
                            {quickActions.find(a => a.type === request.type)?.icon || <Sparkles className="w-6 h-6 text-white/60" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{t('common.details')} {t('common.request')}</h2>
                            <p className="text-sm text-white/60">{t('reception.room.room')} {request.roomNumber} - {serviceNames[request.type]}</p>
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
                                <p className="text-white/60 text-sm mb-1">{t('reception.statusLabel')}</p>
                                <p className="text-white font-medium">{statusConfig[request.status]?.label || request.status}</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/60 text-sm mb-1">{t('forms.priority')}</p>
                                <p className="text-white font-medium">{request.priority === 'urgent' ? t('reception.urgent') : t('reception.priority.normal')}</p>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-white/5 rounded-xl">
                            <p className="text-white/60 text-sm mb-1">{t('reception.currentDepartment')}</p>
                            <p className="text-white font-medium">{request.currentDepartment ? getDeptName(request.currentDepartment) : t('reception.notSpecified')}</p>
                        </div>

                        {request.guestName && (
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/60 text-sm mb-1">{t('reception.guestNameLabel')}</p>
                                <p className="text-white font-medium">{request.guestName}</p>
                                {request.guestIdentity && (
                                    <p className="text-white/70 text-xs mt-1">{t('reception.identityLabelDetail')} {request.guestIdentity}</p>
                                )}
                                {request.guestPhone && (
                                    <p className="text-white/70 text-xs mt-1">{t('reception.phoneLabelDetail')} {request.guestPhone}</p>
                                )}
                            </div>
                        )}

                        {request.notes && (
                            <div className="p-4 bg-white/5 rounded-xl">
                                <p className="text-white/60 text-sm mb-1">{t('reception.notesLabel')}</p>
                                <p className="text-white">{request.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Timeline */}
                    <div className="border-t border-white/10 pt-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            {t('reception.operationsHistoryFull')}
                        </h3>
                        <div className="space-y-4">
                            {sortedTimelineEvents.length > 0 ? (
                                sortedTimelineEvents.map((event, index) => (
                                    <div key={index} className="flex gap-4">
                                        <div className="flex flex-col items-center pt-1">
                                            <div className="w-3 h-3 rounded-full bg-primary-500 ring-2 ring-primary-500/30" />
                                            {index < sortedTimelineEvents.length - 1 && (
                                                <div className="w-0.5 h-full bg-white/10 min-h-[60px] mt-1" />
                                            )}
                                        </div>
                                        <div className="flex-1 pb-4">
                                            <p className="text-white font-medium text-sm">{event.action}</p>
                                            {event.department && (
                                                <p className="text-white/60 text-xs mt-0.5">📍 {t('reception.inDepartment')} {event.department}</p>
                                            )}
                                            {event.by && (
                                                <p className="text-white/70 text-xs mt-1">{t('reception.byUser')} {event.by}</p>
                                            )}
                                            <p className="text-white/70 text-xs mt-1.5 flex items-center gap-2">
                                                <Clock className="w-3 h-3" />
                                                {formatTime(event.time)}
                                            </p>
                                            <p className="text-white/70 text-xs mt-0.5">{getTimeAgo(event.time)}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 bg-white/5 rounded-xl text-center">
                                    <p className="text-white/70 text-sm">{t('reception.noOperationsRecorded')}</p>
                                    <p className="text-white/70 text-xs mt-1">{t('reception.createdAt')} {formatTime(request.createdAt)}</p>
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
                                {t('reception.inspectionResult')}
                            </h3>
                            <div className="space-y-4">
                                <div className="p-4 bg-white/5 rounded-xl">
                                    <p className="text-white/60 text-sm mb-1">{t('reception.statusLabel')}</p>
                                    <p className="text-white font-medium">
                                        {request.inspectionResult === 'clean' && `✅ ${t('reception.roomComplete')}`}
                                        {request.inspectionResult === 'damages' && `⚠️ ${t('reception.roomWithDamages')}`}
                                        {request.inspectionResult === 'missing_items' && `📦 ${t('reception.roomWithMissingItems')}`}
                                    </p>
                                </div>

                                {/* Inspection Photo */}
                                {request.inspectionPhoto && (request.inspectionResult === 'damages' || request.inspectionResult === 'missing_items') && (
                                    <div className="p-4 bg-white/5 rounded-xl">
                                        <p className="text-white/60 text-sm mb-3">
                                            {request.inspectionResult === 'damages' ? t('reception.damagePhoto') : t('reception.lostPhoto')}
                                        </p>
                                        <img 
                                            src={request.inspectionPhoto} 
                                            alt={request.inspectionResult === 'damages' ? t('reception.damagePhoto') : t('reception.lostPhoto')}
                                            className="w-full h-64 object-contain rounded-xl cursor-pointer hover:opacity-80 transition-opacity bg-white/5 p-2"
                                            onClick={() => window.open(request.inspectionPhoto, '_blank')}
                                        />
                                    </div>
                                )}

                                {/* Inspection Notes */}
                                {request.inspectionNotes && (
                                    <div className="p-4 bg-white/5 rounded-xl">
                                        <p className="text-white/60 text-sm mb-1">{t('reception.inspectionNotes')}</p>
                                        <p className="text-white">{request.inspectionNotes}</p>
                                    </div>
                                )}

                                {/* Inspected By */}
                                {request.inspectedBy?.name && (
                                    <div className="p-4 bg-white/5 rounded-xl">
                                        <p className="text-white/60 text-sm mb-1">{t('reception.inspectedBy')}</p>
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
                                {t('reception.minibarConsumptionTitle')}
                            </h3>
                            <div className="space-y-2">
                                {request.minibarConsumption.map((item, idx) => (
                                    <div key={idx} className="p-4 bg-white/5 rounded-xl flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-medium">{item.productName}</p>
                                            <p className="text-white/60 text-sm">{t('reception.quantityLabel')} {item.quantity} × {item.pricePerUnit} {t('reception.sarCurrency')}</p>
                                        </div>
                                        <p className="text-green-400 font-bold text-lg">{item.total} {t('reception.sarCurrency')}</p>
                                    </div>
                                ))}
                                {request.minibarTotal && (
                                    <div className="p-4 bg-gradient-to-r from-green-500/20 to-primary-500/20 border border-green-500/30 rounded-xl flex items-center justify-between mt-4">
                                        <p className="text-white font-bold">{t('reception.totalLabel')}</p>
                                        <p className="text-green-400 font-bold text-xl">{request.minibarTotal} {t('reception.sarCurrency')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Additional Info */}
                    {(request as any).afterPhoto && (
                        <div className="border-t border-white/10 pt-6">
                            <h3 className="text-lg font-bold text-white mb-4">{t('reception.afterWorkPhotos')}</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <img 
                                    src={(request as any).afterPhoto} 
                                    alt={t('reception.afterWorkAlt')}
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
                        {t('reception.viewRoomHistory')}
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
                    >
                        {t('reception.closeButton')}
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
    serviceNames: Record<string, string>;
}> = ({ isOpen, onClose, selectedType, onSubmit, rooms, requests, serviceNames }) => {
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language;
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
                                    description: data.notes || t('reception.noDescriptionFallback'),
                                    date: date.toLocaleDateString(currentLanguage === 'ar' ? 'ar-EG' : currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'bn' ? 'bn-BD' : 'en-US') + ' ' + date.toLocaleTimeString(currentLanguage === 'ar' ? 'ar-EG' : currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'bn' ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
                                    department: data.emergencyTargetDepartment || t('reception.departmentNotSpecified')
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
    }, [roomNumber, selectedType, serviceNames, t, currentLanguage]);

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
            setValidationError(t('reception.pleaseEnterProblemDetails'));
            haptic('error');
            return;
        }

        // ✅ REQUIRE NOTES AND DEPARTMENT FOR EMERGENCY/OTHER
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

    // ✅ Define QUICK_ACTIONS inside QuickCreateModal (local to this component) - BEFORE return statement
    const QUICK_ACTIONS_LOCAL: QuickAction[] = useMemo(() => [
        { type: 'cleaning', icon: <Sparkles className="w-6 h-6" />, label: t('reception.quickActionLabels.cleaning'), color: 'adora-service-housekeeping', bgColor: 'adora-service-bg-housekeeping' },
        { type: 'maintenance', icon: <Wrench className="w-6 h-6" />, label: t('reception.quickActionLabels.maintenance'), color: 'adora-service-maintenance', bgColor: 'adora-service-bg-maintenance' },
        { type: 'bellman', icon: <Bell className="w-6 h-6" />, label: t('reception.quickActionLabels.bellman'), color: 'adora-service-bellman', bgColor: 'adora-service-bg-bellman' },
        { type: 'coffee', icon: <Coffee className="w-6 h-6" />, label: t('reception.quickActionLabels.coffee'), color: 'adora-service-coffee', bgColor: 'adora-service-bg-coffee' },
        { type: 'inspection', icon: <Eye className="w-6 h-6" />, label: t('reception.quickActionLabels.inspection'), color: 'adora-service-inspection', bgColor: 'adora-service-bg-inspection' },
        { type: 'other', icon: <AlertTriangle className="w-6 h-6" />, label: t('reception.quickActionLabels.other'), color: 'adora-service-emergency', bgColor: 'adora-service-bg-emergency' },
    ], [t]);

    if (!isOpen || !selectedType) return null;

    const action = QUICK_ACTIONS_LOCAL.find(a => a.type === selectedType);

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
                            {/* Manual Room Input - First */}
                            {/* ⚠️ Real-time Warning (Above Input) */}
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

                            {/* ℹ️ History Warning */}
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

                            {/* Manual Room Input with Confirm Button */}
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={roomNumber}
                                    onChange={(e) => setRoomNumber(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && roomNumber) {
                                            handleRoomSelect(roomNumber);
                                        }
                                    }}
                                    placeholder={t('reception.enterRoomNumber')}
                                    className={`input text-center text-xl font-bold transition-all ${activeStats.activeRequest && selectedType !== 'coffee'
                                        ? 'border-orange-500/50 focus:border-orange-500 focus:ring-orange-500/20'
                                        : ''
                                        }`}
                                    autoFocus
                                />
                                {/* ✅ زر تأكيد واضح ودائم */}
                                <button
                                    onClick={() => roomNumber && handleRoomSelect(roomNumber)}
                                    disabled={!roomNumber}
                                    className={`w-full py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                                        roomNumber 
                                            ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/40 active:scale-[0.98]'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                    }`}
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    {t('reception.confirmRoomNumber')}
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="flex items-center gap-2 text-white/70">
                                <div className="flex-1 h-px bg-white/10"></div>
                                <span className="text-xs">{t('reception.orSelectFromList')}</span>
                                <div className="flex-1 h-px bg-white/10"></div>
                            </div>

                            {/* Floor Selector Button */}
                            <button
                                onClick={() => setShowFloorSelector(true)}
                                className="w-full py-3.5 rounded-2xl pro-card hover:bg-white/15 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold"
                            >
                                <Building2 className="w-4 h-4 text-primary-400" />
                                <span className="text-white/80">{t('reception.selectRoomByFloor')}</span>
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

                            {/* Scheduled DateTime Picker */}
                            {priority === 'scheduled' && (
                                <div className="space-y-2">
                                    <label className="block text-sm text-white/60">{t('reception.scheduledTime.after')}</label>
                                    {/* Quick Time Buttons */}
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
                                    {/* Show selected time */}
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
                                        <span className="text-sm font-medium">{t('bellman.cart')}</span>
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
                                    <span className="text-sm font-medium">{t('reception.guestsInRoomButton')}</span>
                                </button>
                            </div>

                            {/* ✅ Emergency Request - Department Selection */}
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

                            {/* ✅ Previous Emergency Requests Warning */}
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

                            {/* Notes */}
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
                                {t('reception.backButton')}
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold hover:shadow-lg hover:shadow-primary-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <Send className="w-5 h-5" />
                                {t('reception.createRequestButton')}
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
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { success, error, haptic, playSound } = useUX();
    const brandName = useBrandName();

    // ✅ THEME-AWARE: Using CSS Variables for consistent Light/Dark styling
    const QUICK_ACTIONS: QuickAction[] = useMemo(() => [
        { type: 'cleaning', icon: <Sparkles className="w-6 h-6" />, label: t('reception.quickActionLabels.cleaning'), color: 'adora-service-housekeeping', bgColor: 'adora-service-bg-housekeeping' },
        { type: 'maintenance', icon: <Wrench className="w-6 h-6" />, label: t('reception.quickActionLabels.maintenance'), color: 'adora-service-maintenance', bgColor: 'adora-service-bg-maintenance' },
        { type: 'bellman', icon: <Bell className="w-6 h-6" />, label: t('reception.quickActionLabels.bellman'), color: 'adora-service-bellman', bgColor: 'adora-service-bg-bellman' },
        { type: 'coffee', icon: <Coffee className="w-6 h-6" />, label: t('reception.quickActionLabels.coffee'), color: 'adora-service-coffee', bgColor: 'adora-service-bg-coffee' },
        { type: 'inspection', icon: <Eye className="w-6 h-6" />, label: t('reception.quickActionLabels.inspection'), color: 'adora-service-inspection', bgColor: 'adora-service-bg-inspection' },
        { type: 'other', icon: <AlertTriangle className="w-6 h-6" />, label: t('reception.quickActionLabels.other'), color: 'adora-service-emergency', bgColor: 'adora-service-bg-emergency' },
    ], [t]);

    const SERVICE_NAMES: Record<string, string> = useMemo(() => ({
        cleaning: t('reception.serviceNames.cleaning'),
        maintenance: t('reception.serviceNames.maintenance'),
        bellman: t('reception.serviceNames.bellman'),
        coffee: t('reception.serviceNames.coffee'),
        laundry: t('reception.serviceNames.laundry'),
        minibar: t('reception.serviceNames.minibar'),
        inspection: t('reception.serviceNames.inspection'),
        extension: t('reception.serviceNames.extension'),
        other: t('reception.serviceNames.other')
    }), [t]);

    // ✅ THEME-AWARE: Using CSS Variables for consistent Light/Dark styling
    const STATUS_CONFIG = useMemo(() => ({
        PENDING: { label: t('reception.statusLabels.pending'), color: 'adora-status-pending', bg: 'adora-status-bg-pending', icon: AlertCircle },
        PENDING_RECEPTION: { label: t('reception.statusLabels.pendingReception'), color: 'adora-status-warning', bg: 'adora-status-bg-warning', icon: AlertCircle },
        CONFIRMED: { label: t('reception.statusLabels.confirmed'), color: 'adora-status-confirmed', bg: 'adora-status-bg-confirmed', icon: Check },
        IN_PROGRESS: { label: t('reception.statusLabels.inProgress'), color: 'adora-status-progress', bg: 'adora-status-bg-progress', icon: Clock },
        COMPLETED: { label: t('reception.statusLabels.completed'), color: 'adora-status-success', bg: 'adora-status-bg-success', icon: CheckCircle2 },
        WAITING_PARTS: { label: t('reception.statusLabels.waitingParts'), color: 'adora-status-danger', bg: 'adora-status-bg-danger', icon: Wrench },
        NEEDS_INSPECTION: { label: t('reception.statusLabels.needsInspection'), color: 'adora-status-progress', bg: 'adora-status-bg-progress', icon: Eye },
        SCHEDULED: { label: t('reception.statusLabels.scheduled'), color: 'adora-status-confirmed', bg: 'adora-status-bg-confirmed', icon: Calendar }
    }), [t]);

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
    const [currentTab, setCurrentTab] = useState<TabType>('new');
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
    
    // ✅ NEW: First-Time Setup - Check if rooms exist
    const [showSetupPrompt, setShowSetupPrompt] = useState(false);
    const [hasCompletedSetup, setHasCompletedSetup] = useState(true); // Assume true until checked

    // ✅ Read tab from URL query (?tab=pending|active|completed)
    // Applies on initial load and when query changes
    try {
        // Import inside file scope to avoid SSR issues
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
            
            // ✅ NEW: Check if rooms exist for first-time setup
            setHasCompletedSetup(updatedRooms.length > 0);

            // ✅ Populating Active Room Details for Smart Detection
            const details: Record<string, { guestId: string; guestName: string }> = {};
            updatedRooms.forEach(r => {
                if (r.status === 'occupied' && r.currentGuestId) {
                    details[r.number] = { guestId: r.currentGuestId, guestName: t('reception.currentGuest') };
                }
            });
            setActiveRoomDetails(details);
        });

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
    }, [branchId, tenantId, t]);



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
            new: newRequests.sort(sortByDate),
            in_progress: inProgressRequests.sort(sortByDate),
            completed: completedRequests.sort(sortByDate)
        };
    }, [requests]);

    // Current list (filtered by search)
    const currentRequests = useMemo(() => {
        let list: ServiceRequest[];
        switch (currentTab) {
            case 'new': list = groupedRequests.new; break;
            case 'in_progress': list = groupedRequests.in_progress; break;
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
        const firstPending = groupedRequests.new.find(
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
    }, [groupedRequests.new, activeNotifications, tenantId]);

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
                throw new Error(t('reception.mustLoginFirst'));
            }

            // ✅ Determine which department should handle this request
            const getDepartment = (type: string, emergencyDept?: string): 'reception' | 'housekeeping' | 'maintenance' | 'bellman' | 'coffee_shop' | 'procurement' => {
                // ✅ Emergency/Other requests use the selected department
                if (type === 'other' && emergencyDept) {
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
                        // ✅ FIXED: Coffee requests go to coffee_shop department!
                        return 'coffee_shop';
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
                    error(t('reception.maxServiceRequestsExceeded'));
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
                guestName: t('reception.requestFromReception'),
                needsCart: data.needsCart || false,
                guestsInRoom: data.guestsInRoom || false,
                guestStatus: data.guestsInRoom ? 'in' : 'out', // ✅ Convert guestsInRoom to guestStatus for display
                createdBy: {
                    id: user.id,
                    name: user.name || t('reception.unknownUser')
                },
                confirmedBy: {
                    id: user.id,
                    name: user.name || t('reception.unknownUser')
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
                isPotentialDuplicate: isDuplicate,
                
                // ✅ Workflow fields for Smart Department Tracking
                workflow: {
                    originDept: 'reception',
                    targetDept: getDepartment(data.type, data.emergencyTargetDepartment),
                    currentHolder: getDepartment(data.type, data.emergencyTargetDepartment),
                    workflowStatus: 'NEW',
                    sentAt: Timestamp.now(),
                    isLocked: true,
                    lockedBy: getDepartment(data.type, data.emergencyTargetDepartment),
                    journey: [{
                        department: 'reception',
                        action: 'created',
                        timestamp: Timestamp.now(),
                        userId: user.id,
                        userName: user.name || t('reception.userLabel')
                    }, {
                        department: 'reception',
                        action: 'sent',
                        timestamp: Timestamp.now(),
                        userId: user.id,
                        userName: user.name || t('reception.userLabel'),
                        notes: `${t('reception.sentToDepartmentNote')} ${getDepartment(data.type, data.emergencyTargetDepartment)}`
                    }]
                }
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

            success(isDuplicate ? t('reception.requestCreatedDuplicate') : t('reception.requestCreatedSuccess'));
            setShowCreateModal(false);
        } catch (err: any) {
            console.error('Error creating request:', {
                code: err?.code,
                message: err?.message?.replace(/Request ID: [a-f0-9-]+/gi, ''),
                data: data
            });
            // Show more specific error message
            const errorMessage = err?.message?.includes('permission')
                ? t('reception.noPermissionToCreate')
                : err?.message?.includes('network') || err?.message?.includes('offline')
                    ? t('reception.checkInternetConnection')
                    : t('reception.requestCreationFailed') + ' ' + (err?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || t('reception.unknownError'));
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
                    notes: t('reception.cleaningAfterInspection', { room: requestData.roomNumber }),
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
                    await awardPoints(tenantId || 'default', user.id, 5, t('reception.confirmInspectionRoom'));
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
                        t('reception.confirmedFromReceptionQR')
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
                    await awardPoints(tenantId || 'default', user.id, 5, t('reception.confirmQRRequest'));
                }

                success(t('reception.requestConfirmedAutoTransfer'));
                haptic('success');
                playSound('success');
                return;
            }

            // Normal confirmation for other requests
            await updateDoc(requestRef, {
                status: 'CONFIRMED',
                confirmedBy: { id: user?.id || '', name: user?.name || t('reception.unknownUser') },
                confirmedAt: Timestamp.now()
            });

            // Award points (updates both personal and team points)
            if (user?.id) {
                await awardPoints(tenantId || 'default', user.id, 5, t('reception.confirmRequestLabel'));
            }

            success(t('reception.requestConfirmedSuccess'));
        } catch (err) {
            console.error('Error confirming:', err);
            error(t('reception.requestConfirmFailed'));
        }
    };

    const handleCompleteRequest = async (requestId: string) => {
        try {
            await updateDoc(doc(db, 'requests', requestId), {
                status: 'COMPLETED',
                completedAt: Timestamp.now(),
                currentDepartment: 'reception' // Return to reception for final review
            });

            success(t('reception.requestCompletedSuccess'));
        } catch (err) {
            console.error('Error completing:', err);
            error(t('reception.requestCompleteFailed'));
        }
    };

    // ✅ Confirm completion and close the request circle
    const handleConfirmCompletion = async (requestId: string) => {
        try {
            const { confirmCompletion } = await import('../../services/requestService');
            await confirmCompletion(requestId, user?.id || '', user?.name || '', 'reception');
            success(t('reception.requestClosedAndCompleted'));
            haptic('success');
            playSound('success');
        } catch (err) {
            console.error('Error confirming completion:', err);
            error(t('reception.requestCloseFailed'));
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
            success(t('reception.requestDeletedSuccess'));
        } catch (err: any) {
            console.error('❌ Delete failed:', err);
            const errorMsg = err?.code === 'permission-denied'
                ? t('reception.noPermissionToDelete')
                : t('reception.requestDeleteFailed') + ' ' + (err?.message || t('reception.unknownError'));
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
            error(t('reception.cannotTransferToSameRoom'));
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
                throw new Error(t('reception.currentRoomNotFound'));
            }

            const oldRoomData = roomSnap.docs[0].data();
            const guestId = oldRoomData.currentGuestId;
            // ✅ Use branchId from AuthContext (already defined above)

            if (!guestId) {
                // If no guest ID (maybe manual request?), we just move the request? 
                // No, "Room Move" implies moving a guest.
                error(t('reception.noGuestRegistered'));
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
                selectedTransferRequest.guestName || t('reception.guestLabelFallback')
            );

            success(t('reception.transferSuccess', { guestName: selectedTransferRequest.guestName, roomNumber: targetRoomNumber }));
            setTransferModalOpen(false);
            setSelectedTransferRequest(null);

        } catch (err) {
            console.error('Transfer failed:', err);
            error(t('reception.transferFailed') + ' ' + (err as any).message);
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
            success(t('reception.deletionRequestSent'));
            haptic('success');
        } catch (err) {
            console.error('Error requesting deletion:', err);
            error(t('reception.deletionRequestSendFailed'));
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
            success(t('reception.deletionRequestRejected'));
            haptic('success');
        } catch (err) {
            console.error('Error rejecting deletion:', err);
            error(t('reception.deletionRequestRejectFailed'));
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
                error(t('reception.requestNotFound'));
                return;
            }

            const requestData = requestSnap.data();

            // ✅ Create Lost & Found item
            const { addLostFoundItem } = await import('../../services/lostFoundService');
            
            await addLostFoundItem(
                {
                    type: 'found',
                    category: 'other', // Default category
                    description: requestData.inspectionNotes || t('reception.lostItemsFromRoom', { room: requestData.roomNumber }),
                    location: t('reception.roomNumber', { room: requestData.roomNumber }),
                    roomNumber: requestData.roomNumber,
                    guestName: requestData.guestName || null,
                    storageLocation: t('reception.receptionStorage'),
                    notes: t('reception.autoTransferFromInspection', { notes: requestData.inspectionNotes || '' }),
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

            success(t('reception.lostFoundArchivedSuccess'));
            haptic('success');
        } catch (err: any) {
            console.error('Error archiving to Lost & Found:', err);
            error(t('reception.lostFoundArchiveFailed') + ' ' + (err.message || t('reception.unknownError')));
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
                title: t('reception.highDemandTitle'),
                description: t('reception.occupancyRateAdvice', { rate: Math.round(occupancyRate) }),
                action: t('reception.applyPriceIncrease')
            };
        }

        // 📉 Low Demand Night Rule (After 10 PM)
        if (currentHour >= 22 && occupancyRate < 40) {
            return {
                type: 'price' as const,
                title: t('reception.lateNightDealTitle'),
                description: t('reception.lateNightDealDescription', { rate: Math.round(occupancyRate) }),
                action: t('reception.enableEveningDiscount')
            };
        }

        return null;
    }, [rooms, t]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center theme-page">
            <AdoraLoader size="lg" message={t('reception.loadingData')} />
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
                            success(t('reception.openingPriceSettings'));
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
                            success(t('reception.transferSuggested', { from, to }));
                        }}
                    />
                </div>
            )}

            {/* Flexible Header - Actions Only (Greeting in main header) */}
            <FlexibleHeader
                title={t('reception.receptionTitle')}
                showGreeting={false}
                brandName={brandName}
                subtitle={null}
                actions={[
                    {
                        id: 'history',
                        icon: <History className="w-5 h-5" />,
                        label: t('reception.operationsHistory'),
                        onClick: () => setShowHistory(true),
                        variant: 'primary'
                    },
                    {
                        id: 'shiftNotes',
                        icon: <MessageSquare className="w-5 h-5" />,
                        label: t('reception.roomNotes'),
                        onClick: () => setShowShiftNotes(true)
                    },
                    {
                        id: 'procurement',
                        icon: <ShoppingCart className="w-5 h-5" />,
                        label: t('reception.procurement'),
                        onClick: () => setShowProcurement(true)
                    },
                    {
                        id: 'lostFound',
                        icon: <Package className="w-5 h-5" />,
                        label: t('reception.lostFound'),
                        onClick: () => setShowLostFound(true)
                    },
                    {
                        id: 'instructions',
                        icon: <BookOpen className="w-5 h-5" />,
                        label: t('reception.generalInstructions'),
                        onClick: () => setShowGeneralInstructions(true),
                        variant: 'primary'
                    },
                    {
                        id: 'whatsapp',
                        icon: <MessageCircle className="w-5 h-5" />,
                        label: t('reception.whatsappMessages'),
                        onClick: () => setShowWhatsAppModal(true),
                        variant: 'primary'
                    },
                    {
                        id: 'support',
                        icon: <MessageSquare className="w-5 h-5" />,
                        label: t('reception.technicalSupport'),
                        onClick: () => setShowSupportTicket(true),
                        variant: 'warning'
                    },
                    {
                        id: 'logout',
                        icon: <LogOut className="w-5 h-5" />,
                        label: t('auth.logout'),
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

            {/* Stats - Mobile-First Responsive Cards */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 lg:gap-3 mb-4">
                <StatCard
                    count={groupedRequests.new.length}
                    label={t('reception.newTab')}
                    icon={AlertCircle}
                    iconColor="orange"
                    status={groupedRequests.new.length > 10 ? 'warning' : 'normal'}
                />
                <StatCard
                    count={groupedRequests.in_progress.length}
                    label={t('reception.inProgressTab')}
                    icon={Clock}
                    iconColor="blue"
                    status={groupedRequests.in_progress.length > 15 ? 'warning' : 'normal'}
                />
                <StatCard
                    count={groupedRequests.completed.length}
                    label={t('reception.completedTab')}
                    icon={CheckCircle2}
                    iconColor="green"
                    status="success"
                    trend="+12%"
                />
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

            {/* ⚡ Quick Actions - CORE MOTOR OF RECEPTION - Mobile First */}
            <div className="mb-4 sm:mb-6 lg:mb-8 adora-quick-actions-section p-3 sm:p-4 lg:p-6" data-tour="quick-actions">
                {/* Section Header - Compact on Mobile */}
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--theme-primary-500), var(--theme-primary-600))' }}>
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm sm:text-lg lg:text-xl font-bold adora-text-primary">{t('reception.quickCreateTitle')}</h2>
                        <p className="text-xs sm:text-xs adora-text-tertiary hidden sm:block">{t('reception.quickCreateDescription')}</p>
                    </div>
                </div>
                
                {/* Action Buttons Grid - Mobile First: 3 columns on mobile */}
                <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
                    {QUICK_ACTIONS.map(action => (
                        <button
                            key={action.type}
                            onClick={() => handleQuickAction(action.type)}
                            className="adora-quick-action group flex flex-col items-center p-2 sm:p-3"
                        >
                            {/* Icon Container - Small on Mobile */}
                            <div className={`
                                w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14
                                rounded-xl sm:rounded-2xl
                                flex items-center justify-center
                                ${action.bgColor}
                                transition-all duration-300
                                group-hover:scale-110
                                shadow-sm sm:shadow-md
                            `}>
                                <span className={action.color}>
                                    {React.cloneElement(action.icon as React.ReactElement, {
                                        className: 'w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7'
                                    })}
                                </span>
                            </div>
                            
                            {/* Label - Small on Mobile */}
                            <span className="text-xs sm:text-xs lg:text-sm font-semibold sm:font-bold adora-text-primary text-center mt-1.5 sm:mt-2 leading-tight">
                                {action.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Room Search Filter - Theme-Aware */}
            <div className="mb-3 sm:mb-4">
                <div className="relative" data-tour="search-box">
                    <input
                        type="text"
                        value={roomSearchQuery}
                        onChange={(e) => setRoomSearchQuery(e.target.value)}
                        placeholder={t('reception.searchByRoomNumber')}
                        className="w-full sm:w-64 px-3 sm:px-4 py-2 pr-10 
                                   bg-slate-100 dark:bg-white/10 
                                   border border-slate-300 dark:border-white/10 
                                   rounded-lg sm:rounded-xl 
                                   text-slate-800 dark:text-white 
                                   placeholder:text-slate-400 dark:placeholder:text-white/70 
                                   focus:outline-none focus:ring-2 focus:ring-teal-500/50
                                   text-sm sm:text-base"
                    />
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400 dark:text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {roomSearchQuery && (
                        <button
                            onClick={() => setRoomSearchQuery('')}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-300 dark:bg-white/20 flex items-center justify-center text-slate-600 dark:text-white/60 hover:bg-slate-400 dark:hover:bg-white/30"
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs - Mobile First + Theme Aware */}
            <div className="flex gap-1 sm:gap-2 mb-3 sm:mb-4 overflow-x-auto pb-1 -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-hide" data-tour="tabs">
                {useMemo(() => [
                    { key: 'new', label: t('reception.newTab'), count: groupedRequests.new.length, activeClass: 'bg-orange-500 text-white shadow-orange-500/25', inactiveClass: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400' },
                    { key: 'in_progress', label: t('reception.inProgressTab'), count: groupedRequests.in_progress.length, activeClass: 'bg-blue-500 text-white shadow-blue-500/25', inactiveClass: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' },
                    { key: 'completed', label: t('reception.completedTab'), count: groupedRequests.completed.length, activeClass: 'bg-green-500 text-white shadow-green-500/25', inactiveClass: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' }
                ], [t, groupedRequests.new.length, groupedRequests.in_progress.length, groupedRequests.completed.length]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setCurrentTab(tab.key as TabType)}
                        className={`
                            flex items-center gap-1 sm:gap-1.5 
                            px-2.5 sm:px-4 py-1.5 sm:py-2 
                            rounded-lg sm:rounded-xl 
                            whitespace-nowrap transition-all 
                            active:scale-95 touch-manipulation flex-shrink-0
                            text-xs sm:text-sm font-medium
                            ${currentTab === tab.key
                                ? `${tab.activeClass} shadow-lg`
                                : `${tab.inactiveClass} hover:opacity-80`
                            }
                        `}
                    >
                        <span>{tab.label}</span>
                        <span className={`
                            px-1.5 sm:px-2 py-0.5 rounded-full text-xs sm:text-xs font-bold
                            ${currentTab === tab.key 
                                ? 'bg-white/25' 
                                : 'bg-current/20'
                            }
                        `}>
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
                            {t('reception.confirmTransfer')}
                        </h2>

                        <div className="space-y-4">
                            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                <p className="text-white/60 text-sm mb-1">{t('reception.currentRoom')}</p>
                                <p className="text-xl font-bold text-white">{t('reception.roomNumber', { room: selectedTransferRequest.roomNumber })}</p>
                                <p className="text-white/70 text-xs mt-1">{selectedTransferRequest.guestName}</p>
                            </div>

                            <div>
                                <label className="block text-white/70 text-sm mb-2">{t('reception.toNewRoom')}</label>
                                <input
                                    type="text"
                                    value={targetRoomNumber}
                                    onChange={(e) => setTargetRoomNumber(e.target.value)}
                                    placeholder={t('reception.newRoomNumberPlaceholder')}
                                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition-colors text-center text-lg font-bold"
                                    autoFocus
                                />
                            </div>

                            <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                                <p className="text-orange-400 text-xs flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>
                                        {t('reception.transferDescription')}
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
                                        {t('reception.confirmTransfer')}
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
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Requests List - COMPACT GRID for Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {currentRequests.length === 0 ? (
                    <div className="col-span-full adora-card p-6 text-center rounded-xl">
                        <div className="w-12 h-12 rounded-full adora-bg-tertiary flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 className="w-6 h-6 adora-text-disabled" />
                        </div>
                        <p className="text-sm adora-text-secondary">{t('reception.noRequestsInList')}</p>
                    </div>
                ) : (
                    currentRequests.map(request => (
                        <CompactRequestCard
                            quickActions={QUICK_ACTIONS}
                            serviceNames={SERVICE_NAMES}
                            statusConfig={STATUS_CONFIG}
                            key={request.id}
                            request={request}
                            onView={() => setSelectedRequest(request)}
                            onQuickAction={
                                (request.status === 'PENDING' || request.status === 'PENDING_RECEPTION')
                                    ? (action) => {
                                        if (action === 'confirm') handleConfirmRequest(request.id);
                                    }
                                    : undefined
                            }
                        />
                    ))
                )}
            </div>

            {/* Modals */}
            <QuickCreateModal
                serviceNames={SERVICE_NAMES}
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                selectedType={selectedType}
                onSubmit={handleCreateRequest}
                rooms={rooms}
                requests={requests}
            />

            <ShiftNotes isOpen={showShiftNotes} onClose={() => setShowShiftNotes(false)} />
            <ProcurementCartWizard isOpen={showProcurement} onClose={() => setShowProcurement(false)} department="reception" tenantId={tenantId || ''} />
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
                            label: t('reception.operationsHistory'),
                            icon: <History className="w-5 h-5" />,
                            onClick: () => setShowHistory(true),
                            color: 'text-blue-400'
                        },
                        {
                            id: 'shift-notes',
                            label: t('reception.roomNotes'),
                            icon: <MessageSquare className="w-5 h-5" />,
                            onClick: () => setShowShiftNotes(true),
                            color: 'text-white/60'
                        },
                        {
                            id: 'team',
                            label: t('reception.team'),
                            icon: <Users className="w-5 h-5" />,
                            onClick: () => setShowTeam(true),
                            color: 'text-white/60'
                        },
                        {
                            id: 'procurement',
                            label: t('reception.procurement'),
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
                quickActions={QUICK_ACTIONS}
                serviceNames={SERVICE_NAMES}
                statusConfig={STATUS_CONFIG}
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
                            <h3 className="text-xl font-bold text-white text-center mb-2">{t('reception.deleteRequestConfirm')}</h3>
                            <p className="text-white/60 text-center mb-6 text-sm">
                                {t('reception.deleteRequestConfirmDesc')}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirmation(null)}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-colors font-medium text-sm"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-medium text-sm shadow-lg shadow-red-500/20"
                                >
                                    {t('reception.deleteRequest')}
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
                    branchName={branchId || t('reception.branchLabel')}
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
                branchName={branchId || t('reception.branchLabel')}
                branchNumber={branchId || ''}
                rooms={rooms}
            />

            {/* ✅ Smart Branch Setup Wizard - First-Time Setup */}
            <SmartBranchSetupWizard
                isOpen={showSetupPrompt}
                onClose={() => setShowSetupPrompt(false)}
                onComplete={(newBranchId) => {
                    setShowSetupPrompt(false);
                    // Refresh rooms after setup completes
                    window.location.reload();
                }}
                isFirstTime={!hasCompletedSetup}
            />

            {/* ✅ Onboarding Tour */}
            <TourGuide
                steps={tourSteps}
                isOpen={showTour}
                onClose={() => {
                    closeTour();
                    // Show setup prompt if no rooms after tour
                    if (!hasCompletedSetup) {
                        setTimeout(() => setShowSetupPrompt(true), 500);
                    }
                }}
                onComplete={() => {
                    completeTour();
                    // Show setup prompt if no rooms after tour
                    if (!hasCompletedSetup) {
                        setTimeout(() => setShowSetupPrompt(true), 500);
                    }
                }}
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
                title={t('reception.chatBoxTitle')}
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
