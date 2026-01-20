/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
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
import { subscribeToActiveRoomCards } from '../../services/roomCardService'; // ✅ For occupancy calculation
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
import { markAsViewed, markAsDelivered, subscribeToRequests } from '../../services/requestService';
// ✅ Lost & Found imports - MOVED TO: components/reception/modals/LostFoundModal.tsx
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
import { ServiceRequest } from '../../types/request';
import { getDeptName } from '../../utils/departmentUtils';
import { formatDateTimeWithLocale, getTimeAgo } from '../../utils/dateUtils';
import { useReceptionActions } from '../../hooks/useReceptionActions';
import { ReceptionStats } from '../../components/reception/ReceptionStats';
import { RequestList } from '../../components/reception/RequestList';
import { QuickActionsSection } from '../../components/reception/QuickActionsSection';
import { LoadingSkeleton } from '../../components/reception/LoadingSkeleton';
import { getQuickActions } from '../../utils/quickActionsConfig';
import { getServiceNames } from '../../utils/serviceNamesConfig';
import { getReceptionStatusConfig } from '../../utils/statusConfig';
import type { StatusConfig } from '../../utils/statusConfig';
import { useReceptionContext } from '../../context/ReceptionContext';
import { useReceptionLogic } from '../../hooks/useReceptionLogic';

// ============================================================
// TYPES - Using centralized types from @/types/request
// ============================================================

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

// ✅ PERFORMANCE: Lazy load components for better code splitting
import { CompactRequestCard } from '../../components/reception/CompactRequestCard';

// Lazy load modals
const RequestDetailsModal = React.lazy(() => import('../../components/reception/RequestDetailsModal').then(m => ({ default: m.RequestDetailsModal })));
const QuickCreateModal = React.lazy(() => import('../../components/reception/QuickCreateModal').then(m => ({ default: m.QuickCreateModal })));
import { LostFoundModal, TransferModal } from '../../components/reception/modals';

// ✅ Modals extracted to: components/reception/modals/

// ✅ Modals are lazy-loaded for better performance

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ReceptionDashboard: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, logout, branchId: authBranchId } = useAuth();
    const { success, error, haptic, playSound } = useUX();
    const brandName = useBrandName();

    // ✅ FIX: Get branchId and tenantId early
    const branchId = authBranchId || (user as any)?.branchId || (user as any)?.branch;
    const tenantId = (user as any)?.tenantId;

    // ✅ Phase 4: Use ReceptionContext for all state management
    const {
        requests,
        setRequests,
        loading,
        setLoading,
        currentTab,
        setCurrentTab,
        roomSearchQuery,
        setRoomSearchQuery,
        selectedType,
        setSelectedType,
        showCreateModal,
        setShowCreateModal,
        selectedRequest,
        setSelectedRequest,
        transferModalOpen,
        setTransferModalOpen,
        selectedTransferRequest,
        setSelectedTransferRequest,
        targetRoomNumber,
        setTargetRoomNumber,
        showShiftNotes,
        setShowShiftNotes,
        showProcurement,
        setShowProcurement,
        showSupportTicket,
        setShowSupportTicket,
        showLostFound,
        setShowLostFound,
        showGeneralInstructions,
        setShowGeneralInstructions,
        showWhatsAppModal,
        setShowWhatsAppModal,
        showChatInbox,
        setShowChatInbox,
        showTeam,
        setShowTeam,
        showHistory,
        setShowHistory,
        showMobileMenu,
        setShowMobileMenu,
        showSetupPrompt,
        setShowSetupPrompt,
        hasCompletedSetup,
        setHasCompletedSetup,
        rooms,
        setRooms,
        activeRoomDetails,
        setActiveRoomDetails,
        activeRoomCards,
        setActiveRoomCards,
        teamMembers,
        setTeamMembers,
        roomHistoryRoom,
        setRoomHistoryRoom,
        activeNotifications,
        setActiveNotifications,
        notificationRequest,
        setNotificationRequest,
        showLocationWarning,
        setShowLocationWarning,
        locationWarningData,
        setLocationWarningData,
        executionTimes,
        setExecutionTimes
    } = useReceptionContext();

    // ✅ Centralized Configurations
    const QUICK_ACTIONS = useMemo(() => getQuickActions(t), [t]);
    const SERVICE_NAMES = useMemo(() => getServiceNames(t), [t]);
    const STATUS_CONFIG = useMemo(() => getReceptionStatusConfig(t), [t]);

    // ✅ Extracted Business Logic
    const {
        groupedRequests,
        currentRequests,
        tabDefinitions,
        checkRequestMismatch,
        handleTransferRequestUI,
        confirmTransfer
    } = useReceptionLogic({
        user: user || {},
        branchId: branchId || '',
        tenantId: tenantId || ''
    });

    // ✅ Phase 2: Use centralized actions hook
    const {
        handleConfirmRequest,
        handleCompleteRequest,
        handleConfirmCompletion,
        handleDeleteRequest,
        handleTransferRequest,
        handleCreateRequest: handleCreateRequestFromHook,
        isTransferring,
        deleteConfirmation: deleteConfirmationFromHook,
        setDeleteConfirmation: setDeleteConfirmationFromHook
    } = useReceptionActions({
        user,
        branchId: branchId || '',
        tenantId: tenantId || '',
        t,
        onSuccess: success,
        onError: error
    });

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

    // ✅ FIX: Fallback timeout only if data doesn't load after 5 seconds (prevents infinite loading)
    useEffect(() => {
        const fallbackTimeout = setTimeout(() => {
            if (loading && requests.length === 0) {
                console.warn('⚠️ Data loading timeout - showing page with empty state');
                setLoading(false);
            }
        }, 5000); // 5 seconds fallback (only if no data loaded)
        return () => clearTimeout(fallbackTimeout);
    }, [loading, requests.length, setLoading]);
    
    // ✅ Onboarding Tour
    const { showTour, steps: tourSteps, closeTour, completeTour } = useOnboardingTour('reception');

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

    // ✅ branchId and tenantId are now defined at the top of the component

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

        // ✅ Subscribe to Active Room Cards (for occupancy calculation)
        let unsubRoomCards: (() => void) | null = null;
        if (tenantId && branchId) {
            unsubRoomCards = subscribeToActiveRoomCards(
                (cards) => {
                    setActiveRoomCards(cards);
                },
                tenantId,
                branchId
            );
        }

        // Subscribe to rooms (Grouped for Modal)
        // ✅ FIX: Pass tenantId as required parameter
        if (!tenantId) {
            console.warn('⚠️ [ReceptionDashboard] Cannot subscribe to rooms: tenantId is missing');
            return;
        }
        
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
        }, tenantId); // ✅ CRITICAL: Pass tenantId as 3rd parameter (required)

        // ✅ Subscribe to employees (Reception & Bellman)
        // ✅ FIX: Pass tenantId for tenant isolation (required for SaaS)
        const unsubTeam = subscribeToEmployees((allEmployees) => {
            const relevant = allEmployees.filter(e =>
                e.department === 'reception' || e.department === 'bellman'
            );
            setTeamMembers(relevant);
        }, tenantId); // ✅ CRITICAL: Pass tenantId for tenant-scoped query

        return () => {
            unsubRooms();
            unsubTeam();
            if (unsubRoomCards) unsubRoomCards();
        };
    }, [branchId, tenantId, t]);



    // ✅ Business logic extracted to useReceptionLogic hook

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
        if (!user || !branchId) {
            // ✅ FIX: Set loading to false if user/branchId is missing
            setLoading(false);
            return;
        }

        // ✅ FIX: Ensure loading is true when starting to fetch
        setLoading(true);

        // Rooms are handled by the real-time subscription in the first useEffect


        // ✅ FIX: Use subscribeToRequests from requestService (Tenant-Scoped + Real-time)
        // This ensures proper Tenant Isolation and Security
        if (!tenantId) {
            console.warn('⚠️ [ReceptionDashboard] Cannot subscribe to requests: tenantId is missing');
            setLoading(false);
            return;
        }

        // ✅ Use subscribeToRequests (Tenant-Scoped Collection: tenants/${tenantId}/requests)
        const unsubscribe = subscribeToRequests(
            branchId,
            tenantId,
            (loadedRequests) => {
                // ✅ Map to ServiceRequest format (for compatibility)
                const mappedRequests: ServiceRequest[] = loadedRequests.map(req => ({
                    id: req.id,
                    type: req.type as any,
                    status: req.status as any,
                    roomNumber: req.roomNumber,
                    priority: req.priority as any,
                    isEmergency: req.priority === 'urgent' || req.priority === 'emergency',
                    source: req.source as any,
                    createdAt: req.createdAt,
                    currentDepartment: req.currentDepartment,
                    originDepartment: req.originDepartment,
                    guestName: req.guestName,
                    guestPhone: req.guestPhone,
                    guestIdentity: req.guestIdentity,
                    guestStatus: req.guestStatus as any,
                    notes: typeof req.notes === 'string' ? req.notes.substring(0, 100) : req.notes,
                    departmentHistory: req.departmentHistory,
                    scheduledAt: req.scheduledDate,
                    scheduledDate: req.scheduledDate
                } as ServiceRequest));

                setRequests(mappedRequests);
                setLoading(false);

                // Play sound for new pending requests
                const newPendingCount = mappedRequests.filter(r => r.status === 'PENDING' || r.status === 'PENDING_RECEPTION').length;
                if (newPendingCount > prevPendingCount.current) {
                    playSound('notification');
                    haptic('medium');
                }
                prevPendingCount.current = newPendingCount;
            },
            undefined, // status filter (undefined = all)
            100 // maxResults
        );
        
        return () => unsubscribe();
    }, [user, branchId, tenantId]);

    // ============================================================
    // ACTIONS
    // ============================================================

    const handleQuickAction = (type: ServiceRequest['type']) => {
        setSelectedType(type);
        setShowCreateModal(true);
        haptic('light');
    };

    // ✅ Wrapper to pass existing requests for duplication check
    // ✅ FIX: Add request deduplication guard to prevent double submission
    const [isCreatingRequest, setIsCreatingRequest] = React.useState(false);
    const handleCreateRequest = async (data: { roomNumber: string; type: string; priority: 'normal' | 'urgent' | 'scheduled'; notes: string; needsCart?: boolean; guestsInRoom?: boolean; scheduledAt?: Date; emergencyTargetDepartment?: string }) => {
        // ✅ FIX: Prevent double submission
        if (isCreatingRequest) {
            console.warn('⚠️ Request creation already in progress, ignoring duplicate call');
            return;
        }
        
        setIsCreatingRequest(true);
        try {
            await handleCreateRequestFromHook(data, requests);
            setShowCreateModal(false);
        } catch (err) {
            // Error already handled in hook
        } finally {
            setIsCreatingRequest(false);
        }
    };

    // ✅ Removed - using handlers from useReceptionActions hook

    const confirmDelete = async () => {
        if (!deleteConfirmationFromHook?.id) return;

        const requestId = deleteConfirmationFromHook.id;
        setDeleteConfirmationFromHook(null); // Close modal immediately for better UX

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

    // ✅ Removed - using handleDeleteRequest from hook
    const handleDeleteRequestUI = (requestId: string) => {
        setDeleteConfirmationFromHook({ id: requestId, show: true });
    };

    // ============================================================
    // ROOM TRANSFER LOGIC (UI State Only)
    // ============================================================
    // ✅ Transfer modal state is now in ReceptionContext

    // ✅ Transfer logic extracted to useReceptionLogic hook

    // ============================================================
    // SMART MISMATCH & GHOST ORDER DETECTION (Scenarios 1 & 2)
    // ============================================================

    // ✅ Mismatch detection logic extracted to useReceptionLogic hook

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
            setDeleteConfirmationFromHook(null); // Close modal if open
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
    // ✅ NEW LOGIC: Based on Active Room Cards (from Bellman) vs Total Rooms
    const pricingInsight = useMemo(() => {
        // إجمالي الغرف في الفرع
        const allRooms = rooms.flatMap(r => r.rooms);
        const totalRooms = allRooms.length;
        if (totalRooms === 0) return null;

        // عدد الغرف النشطة (Room Cards) من صفحة البيلمان
        const occupiedRooms = activeRoomCards.length;
        
        // حساب معدل الإشغال
        const occupancyRate = (occupiedRooms / totalRooms) * 100;
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
    }, [rooms, activeRoomCards, t]);

    if (loading) return (
        <div className="min-h-screen theme-page p-3 sm:p-4 lg:p-6">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
                {/* Stats Skeleton */}
                <LoadingSkeleton type="stats" count={3} />
                <div className="mt-6 mb-6">
                    {/* Actions Skeleton */}
                    <LoadingSkeleton type="actions" count={6} />
                </div>
                {/* Cards Skeleton */}
                <LoadingSkeleton type="card" count={6} />
            </div>
        </div>
    );

    return (
        <PageTransition>
            {/* Manager Announcement Banner */}
            <ManagerAnnouncementBanner department="reception" />
            
            <div className="min-h-screen pb-20 sm:pb-0 relative overflow-x-hidden transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
            {/* 🧠 Smart Genius Insight (Top of Dashboard) */}
            {pricingInsight && (
                <div className="px-4 pt-2 sm:pt-3 sm:px-6 max-w-7xl mx-auto animate-in slide-in-from-top-4 duration-700">
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
                <div className="px-3 sm:px-4 lg:px-6 pt-2 sm:pt-3 max-w-7xl mx-auto">
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
            <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                <ChallengeTimeline />
            </div>

            {/* Golden Alert - Broadcast Messages */}
            <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                <GoldenAlertDisplay department="reception" />
            </div>

            {/* ✅ Room Transfer Notifications */}
            <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                <div className="flex justify-end">
                    <TransferNotificationBadge department="reception" />
                </div>
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
                <div className="px-3 sm:px-4 lg:px-6 mb-3 sm:mb-4 max-w-7xl mx-auto">
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
                <div className="px-3 sm:px-4 lg:px-6 mb-3 sm:mb-4 max-w-7xl mx-auto">
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

            {/* Stats - Using ReceptionStats Component */}
            <ReceptionStats
                newCount={groupedRequests.new.length}
                inProgressCount={groupedRequests.in_progress.length}
                completedCount={groupedRequests.completed.length}
                t={t}
            />

            {/* 🆕 Guest Verification Panel */}
            {user?.id && user?.name && (
                <ReceptionVerificationPanel
                    branchId={branchId}
                    tenantId={tenantId || 'default'}
                    userId={user.id}
                    userName={user.name}
                />
            )}

            {/* ⚡ Quick Actions - CORE MOTOR OF RECEPTION */}
            <QuickActionsSection
                quickActions={QUICK_ACTIONS}
                onQuickAction={handleQuickAction}
            />

            {/* Room Search Filter - Theme-Aware */}
            <div className="px-3 sm:px-4 lg:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
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
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'var(--theme-text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {roomSearchQuery && (
                        <button
                            onClick={() => setRoomSearchQuery('')}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
                            style={{ 
                                background: 'var(--theme-bg-tertiary)', 
                                color: 'var(--theme-text-secondary)'
                            }}
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            {/* Request List - Using RequestList Component */}
            <RequestList
                requests={requests}
                currentTab={currentTab}
                onTabChange={(tab) => setCurrentTab(tab)}
                onRequestView={(request) => setSelectedRequest(request)}
                onRequestConfirm={handleConfirmRequest}
                roomSearchQuery={roomSearchQuery}
                quickActions={QUICK_ACTIONS}
                serviceNames={SERVICE_NAMES}
                statusConfig={STATUS_CONFIG}
                t={t}
            />

            {/* Room Transfer Modal */}
            <TransferModal
                isOpen={transferModalOpen}
                onClose={() => setTransferModalOpen(false)}
                request={selectedTransferRequest}
                targetRoomNumber={targetRoomNumber}
                setTargetRoomNumber={setTargetRoomNumber}
                isTransferring={isTransferring}
                onConfirm={confirmTransfer}
                onReset={() => {
                    setSelectedTransferRequest(null);
                    setTargetRoomNumber('');
                }}
            />

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

            {/* ✅ Request Details Modal - Lazy Loaded */}
            <React.Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"><AdoraLoader /></div>}>
                <RequestDetailsModal
                    request={selectedRequest}
                    isOpen={!!selectedRequest}
                    onClose={() => setSelectedRequest(null)}
                    branchId={branchId}
                    quickActions={QUICK_ACTIONS}
                    serviceNames={SERVICE_NAMES}
                    statusConfig={STATUS_CONFIG}
                />
            </React.Suspense>

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
                deleteConfirmationFromHook && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200" style={{ backdropFilter: 'none' }}>
                        <div className="bg-gray-900/90 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200 mx-2 sm:mx-0">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4 mx-auto">
                                <Trash2 className="w-6 h-6 text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold text-center mb-2" style={{ color: 'var(--theme-text-primary)' }}>{t('reception.deleteRequestConfirm')}</h3>
                            <p className="text-center mb-6 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                {t('reception.deleteRequestConfirmDesc')}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirmationFromHook(null)}
                                    className="flex-1 py-2.5 rounded-xl transition-colors font-medium text-sm"
                                    style={{ 
                                        background: 'var(--theme-bg-tertiary)', 
                                        color: 'var(--theme-text-primary)'
                                    }}
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
                steps={tourSteps && tourSteps.length > 0 ? tourSteps : []}
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
                                className="p-2 rounded-full transition-colors"
                                style={{ 
                                    background: 'var(--theme-bg-tertiary)', 
                                    color: 'var(--theme-text-primary)'
                                }}
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
                <MessageCircle className="w-6 h-6" style={{ color: 'var(--theme-text-inverse)' }} />
            </button>

            {/* 📝 Developer Signature */}
            {/* Developer Signature is in GlobalFooter (App.tsx) */}
        </div>
        </PageTransition>
    );
};

export default ReceptionDashboard;
