/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Maintenance Dashboard - COMPLETE Implementation
 * All 54 functions from legacy maintenance.js
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Wrench, LogOut as LogOutIcon, ShoppingCart,
    Users, MessageSquare, History, Camera, AlertTriangle,
    CheckCircle, Clock, Play, PauseCircle, PlayCircle, X, Image, Trash2,
    DollarSign, Zap, Activity, Building2, Settings, Eye,
    QrCode, // ✅ QR icon for QR requests
    Smartphone, // ✅ Alternative QR icon
    BookOpen, // ✅ General instructions icon
    Headphones // ✅ Support ticket icon
} from 'lucide-react';
import { HeaderButton } from '../../components/common/HeaderButton';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { ResponsiveActionBar } from '../../components/common/ResponsiveActionBar'; // ✅ Unified responsive actions
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useTranslation } from 'react-i18next';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, Timestamp, orderBy, getDocs, arrayUnion, Unsubscribe } from 'firebase/firestore';
import { logger } from '../../services/loggerService'; // ✅ Adora Premium: Structured logging
import { useSmartAgent } from '../../hooks/useSmartAgent';
import { useOnboardingTour } from '../../hooks/useOnboardingTour'; // ✅ Onboarding tour
import { TourGuide } from '../../components/shared/TourGuide'; // ✅ Tour guide component
// DeveloperSignature is now in GlobalFooter (App.tsx)
import VoiceInputButton from '../../components/shared/VoiceInputButton';

// Shared Components
import { ProcurementCartWizard } from '../../components/shared/ProcurementCartWizard';
import { PointsTracker } from '../../components/shared/PointsTracker';
import { ShiftNotes } from '../../components/shared/ShiftNotes';
import { HistoryFilter } from '../../components/shared/HistoryFilter';
import { TeamMembers } from '../../components/shared/TeamMembers';
import { UnifiedHistoryModal } from '../../components/shared/UnifiedHistoryModal';
import { useTenant } from '../../context/TenantContext'; // ✅ Added import
import { useTenantBranches } from '../../hooks/useTenantData'; // ✅ Added for approvedRoomTypes
import { GoldenAlertDisplay } from '../../components/shared/GoldenAlert';
import { ReadReceipt } from '../../components/shared/ReadReceipt';
import { MobileMenu } from '../../components/common/MobileMenu';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { UnifiedRequestCard } from '../../components/cards/UnifiedRequestCard';
import { markAsViewed, transferRequestToDepartment } from '../../services/requestService'; // ✅ Add transferRequestToDepartment
import { PointsNotification } from '../../components/shared/PointsNotification';
import { BranchLocationWarning } from '../../components/auth/BranchLocationWarning';
import { checkBranchLocation } from '../../services/branchLocationService';
import { uploadMaintenancePhoto } from '../../services/storageService'; // ✅ Add uploadMaintenancePhoto for ImgBB
import { ManagerAnnouncementBanner } from '../../components/shared/ManagerAnnouncementBanner'; // ✅ Manager announcements banner
import { UnifiedRequestTabs } from '../../components/shared/UnifiedRequestTabs'; // ✅ Unified tabs
import { GeneralInstructionsView } from '../../components/shared/GeneralInstructionsView'; // ✅ General instructions view
import { SupportTicketModal } from '../../components/shared/SupportTicketModal'; // ✅ Support ticket modal
import { TransferNotificationBadge } from '../../components/guest/TransferNotificationBadge'; // ✅ Room transfer notifications
import { useBrandName } from '../../hooks/useBrandName';
import { ChallengeTimeline } from '../../components/features/ChallengeTimeline'; // ✅ Commitment Timeline

// Creative Dashboard Components
import { TaskProgress } from '../../components/dashboard';
import { StatCard } from '../../components/common/StatCard';

// ============================================================
// TYPES
// ============================================================

interface MaintenanceRequest {
    id: string;
    type: string;
    serviceType: string;
    status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED';
    roomNumber: string;
    maintenanceType?: string;
    description?: string;
    priority?: 'low' | 'normal' | 'urgent';
    beforePhoto?: string;
    afterPhoto?: string;
    estimatedCost?: number;
    actualCost?: number;
    createdAt: Timestamp | { toDate: () => Date } | Date;
    timeline?: {
        confirmed?: Timestamp | { toDate: () => Date } | Date;
        started?: Timestamp | { toDate: () => Date } | Date;
        completed?: Timestamp | { toDate: () => Date } | Date;
    };
    // Department tracking
    currentDepartment?: 'maintenance' | 'reception' | 'housekeeping';
    [key: string]: unknown;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const MaintenanceDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { success, error, haptic } = useUX();
    const { t } = useTranslation();
    const { tenantId, setTenant } = useTenant(); // ✅ Use Tenant Context - moved early
    const brandName = useBrandName();

    // State
    const [currentTab, setCurrentTab] = useState<'new' | 'in_progress' | 'completed'>('new'); // ✅ Unified tabs
    const [loading, setLoading] = useState(true);
    
    // ✅ FAST UI: Force show page after 2 seconds max
    useEffect(() => {
        const fastUITimeout = setTimeout(() => {
            if (loading) {
                logger.info('Fast UI: Showing Maintenance page now', undefined, 'MaintenanceDashboard');
                setLoading(false);
            }
        }, 2000);
        return () => clearTimeout(fastUITimeout);
    }, [loading]);

    // ✅ Read tab from URL query (?tab=active|completed)
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { useSearchParams } = require('react-router-dom');
        const [searchParams] = useSearchParams();
        useEffect(() => {
            const tab = (searchParams.get('tab') || '').toLowerCase();
            if (tab === 'new' || tab === 'in_progress' || tab === 'completed') {
                setCurrentTab(tab as 'new' | 'in_progress' | 'completed');
            }
        }, [searchParams]);
    } catch {}

    // Requests - ✅ Unified tabs (new, in_progress, completed)
    const [newRequests, setNewRequests] = useState<MaintenanceRequest[]>([]);
    const [inProgressRequests, setInProgressRequests] = useState<MaintenanceRequest[]>([]);
    const [completedRequests, setCompletedRequests] = useState<MaintenanceRequest[]>([]);
    
    // Legacy alias for compatibility
    const activeRequests = [...newRequests, ...inProgressRequests];

    // Current request modals
    const [currentStartRequest, setCurrentStartRequest] = useState<MaintenanceRequest | null>(null);
    const [currentCompleteRequest, setCurrentCompleteRequest] = useState<MaintenanceRequest | null>(null);

    // Start modal state
    const [beforePhoto, setBeforePhoto] = useState<string | null>(null);

    // Complete modal state
    const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
    const [afterPhotoFile, setAfterPhotoFile] = useState<File | null>(null); // ✅ Store File for upload
    const [uploadingPhoto, setUploadingPhoto] = useState(false); // ✅ Upload progress
    const [uploadProgress, setUploadProgress] = useState(0); // ✅ Upload progress percentage
    const [actualCost, setActualCost] = useState<number>(0);
    const [completionNotes, setCompletionNotes] = useState('');

    // Modals
    const [showProcurement, setShowProcurement] = useState(false);
    const [showShiftNotes, setShowShiftNotes] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showGeneralInstructions, setShowGeneralInstructions] = useState(false); // ✅ General instructions modal
    const [showSupportTicket, setShowSupportTicket] = useState(false); // ✅ Support ticket modal
    const [showTeam, setShowTeam] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    // Issue type filter ('all' = no filter)
    const [issueTypeFilter, setIssueTypeFilter] = useState<string>('all');
    
    // ✅ Points Notification State
    const [activeNotifications, setActiveNotifications] = useState<Set<string>>(new Set());
    const [notificationRequest, setNotificationRequest] = useState<MaintenanceRequest | null>(null);
    
    // ✅ Branch Location Warning State
    const [showLocationWarning, setShowLocationWarning] = useState(false);
    const [locationWarningData, setLocationWarningData] = useState<any>(null);
    
    // ✅ Onboarding Tour
    const { showTour, steps: tourSteps, closeTour, completeTour } = useOnboardingTour('maintenance');

    // Refs
    const beforePhotoRef = useRef<HTMLInputElement>(null);
    const afterPhotoRef = useRef<HTMLInputElement>(null);

    // Filtered requests based on issue type - ✅ Unified tabs
    const filteredNewRequests = useMemo(() => {
        if (issueTypeFilter === 'all') return newRequests;
        return newRequests.filter(r =>
            (r.maintenanceType || '').toLowerCase().includes(issueTypeFilter) ||
            (r.description || '').toLowerCase().includes(issueTypeFilter)
        );
    }, [newRequests, issueTypeFilter]);

    const filteredInProgressRequests = useMemo(() => {
        if (issueTypeFilter === 'all') return inProgressRequests;
        return inProgressRequests.filter(r =>
            (r.maintenanceType || '').toLowerCase().includes(issueTypeFilter) ||
            (r.description || '').toLowerCase().includes(issueTypeFilter)
        );
    }, [inProgressRequests, issueTypeFilter]);
    
    // Legacy alias for compatibility
    const filteredActiveRequests = [...filteredNewRequests, ...filteredInProgressRequests];

    const filteredCompletedRequests = useMemo(() => {
        if (issueTypeFilter === 'all') return completedRequests;
        return completedRequests.filter(r =>
            (r.maintenanceType || '').toLowerCase().includes(issueTypeFilter) ||
            (r.description || '').toLowerCase().includes(issueTypeFilter)
        );
    }, [completedRequests, issueTypeFilter]);

    // ✅ Show Points Notification for new CONFIRMED requests
    useEffect(() => {
        // Find first CONFIRMED request that hasn't been notified yet
        const firstConfirmed = filteredActiveRequests.find(
            req => req.status === 'CONFIRMED' && !activeNotifications.has(req.id)
        );

        if (firstConfirmed && tenantId) {
            // Mark as notified
            setActiveNotifications(prev => new Set(prev).add(firstConfirmed.id));
            // Show notification
            setNotificationRequest(firstConfirmed);
            
            // Auto-dismiss after 3 seconds
            const timer = setTimeout(() => {
                setNotificationRequest(null);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [filteredActiveRequests, activeNotifications, tenantId]);

    // ============================================================
    // INITIALIZATION
    // ============================================================

    // ✅ FIX: Use branchId from AuthContext (updates when manager switches branches)
    const { branchId: authBranchId } = useAuth();
    const branchId = authBranchId || (user as any)?.branchId || (user as any)?.branch;

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
                logger.error('Location check error', err, 'MaintenanceDashboard');
                // Fail open - allow access
            }
        };
        
        checkLocation();
    }, [tenantId, branchId, user?.branches]);

    useEffect(() => {
        if (!user || !branchId) return;

        // ✅ Auto-sync tenant if missing (Crucial for direct navigation)
        const userTenantId = (user as { tenantId?: string })?.tenantId;
        if (userTenantId && !tenantId) {
            logger.info('Syncing Tenant ID from Auth', { userTenantId }, 'MaintenanceDashboard');
            setTenant(userTenantId).catch((err) => {
                logger.error('Failed to sync tenant ID', err, 'MaintenanceDashboard');
            });
        }

        // ✅ ADORA SECURITY: Null safety check before subscription
        if (!db) {
            logger.error('Firebase not initialized - cannot listen to maintenance requests', undefined, 'MaintenanceDashboard');
            setLoading(false);
            return;
        }

        // ✅ FIX: Store unsubscribe function for cleanup
        const unsubscribe = listenToMaintenanceRequests();
        if (!unsubscribe) {
            logger.warn('Failed to create subscription - unsubscribe is null', undefined, 'MaintenanceDashboard');
            setLoading(false);
            return;
        }

        setLoading(false);
        logger.info('Maintenance page initialized', undefined, 'MaintenanceDashboard');
        
        // ✅ Cleanup on unmount to prevent memory leaks
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [user, tenantId, branchId]);

    // ============================================================
    // VOICE AGENT INTEGRATION
    // ============================================================
    const {
        isActive: isAgentActive,
        status: agentStatus,
        transcript,
        feedback,
        processCommand,
        // 🛡️ Error Recovery
        errorCount,
        isFallbackMode,
        lastError,
        retryLastCommand,
        resetErrors
    } = useSmartAgent({
        context: 'maintenance',
        schema: {
            action: "UPDATE_STATUS",
            description: "Update maintenance task status (Repair Finished/Started)",
            properties: {
                roomId: { type: "string", description: "The room number or ID" },
                status: { type: "string", enum: ["start", "complete"], description: "The action to perform" }
            }
        },
        onSuccess: (action, params) => {
            logger.info('AI Action Success (Maintenance)', { action, params }, 'MaintenanceDashboard');
            haptic('success');
            if (action === 'UPDATE_STATUS') {
                if (params.status === 'start') {
                    showStartModal(params.roomId);
                } else if (params.status === 'complete') {
                    showCompleteModal(params.roomId);
                }
            }
        }
    });

    // ============================================================
    // REALTIME LISTENERS
    // ============================================================

    const listenToMaintenanceRequests = (): Unsubscribe | null => {
        // ✅ ADORA SECURITY: Null safety check (MANDATORY per Adora Rules)
        if (!db) {
            logger.error('Firebase not initialized - cannot listen to maintenance requests', undefined, 'MaintenanceDashboard');
            return null;
        }

        const userTenantId = (user as { tenantId?: string })?.tenantId;

        if (!branchId) {
            logger.warn('Branch ID missing - cannot listen to maintenance requests', undefined, 'MaintenanceDashboard');
            return null;
        }

        // ✅ FIX: Use tenant-scoped collection (tenants/${tenantId}/requests)
        if (!userTenantId) {
            console.warn('⚠️ [MaintenanceDashboard] Cannot subscribe to requests: tenantId is missing');
            setNewRequests([]);
            setInProgressRequests([]);
            setCompletedRequests([]);
            return;
        }
        
        const requestsRef = collection(db, `tenants/${userTenantId}/requests`);

        // ✅ ADORA PREMIUM: Type-safe constraints (Zero `any` Policy)
        const constraints: Array<ReturnType<typeof where> | ReturnType<typeof orderBy>> = [
            where('branch', '==', branchId),
            where('type', '==', 'maintenance') // ✅ FIX: Use 'type' instead of 'serviceType'
        ];

        const q = query(
            requestsRef,
            ...constraints,
            orderBy('createdAt', 'desc')
        );

        // ✅ FIX: Store fallback unsubscribe to prevent multiple subscriptions
        let fallbackUnsubscribe: Unsubscribe | null = null;

        const unsubscribe = onSnapshot(q, (snapshot) => {
            processMaintenanceSnapshot(snapshot);
        }, (error) => {
            logger.error('Error listening to maintenance requests', error, 'MaintenanceDashboard');
            // Fallback without orderBy if index missing
            if (error.code === 'failed-precondition') {
                // ✅ FIX: Cleanup previous fallback subscription if exists
                if (fallbackUnsubscribe) {
                    fallbackUnsubscribe();
                }
                // ✅ FIX: Re-construct constraints for fallback (without orderBy)
                // Filter out orderBy by checking if it's a where constraint
                const fallbackConstraints = constraints.filter((c): c is ReturnType<typeof where> => {
                    // orderBy doesn't have 'fieldPath' property, where does
                    return 'fieldPath' in c || 'op' in c;
                });
                // ✅ FIX: Use tenant-scoped collection in fallback too
                const fallbackRequestsRef = collection(db, `tenants/${userTenantId}/requests`);
                const q2 = query(fallbackRequestsRef, ...fallbackConstraints);
                fallbackUnsubscribe = onSnapshot(q2, processMaintenanceSnapshot, (fallbackError) => {
                    logger.error('Error in fallback subscription', fallbackError, 'MaintenanceDashboard');
                });
            }
        });

        // ✅ Return cleanup function that handles both subscriptions
        return () => {
            unsubscribe();
            if (fallbackUnsubscribe) {
                fallbackUnsubscribe();
            }
        };
    };

    const processMaintenanceSnapshot = (snapshot: { forEach: (callback: (doc: { id: string; data: () => Record<string, unknown> }) => void) => void }, localSort = false) => {
        const newList: MaintenanceRequest[] = [];
        const inProgressList: MaintenanceRequest[] = [];
        const completed: MaintenanceRequest[] = [];
        const now = new Date();

        // ✅ Helper: Check if scheduled request should be shown (only if scheduledDate <= now)
        const isScheduledRequestVisible = (r: MaintenanceRequest): boolean => {
            const scheduledDateTime = r.scheduledDate || r.scheduledAt;
            if (!scheduledDateTime) return true; // Not scheduled - always visible
            
            const scheduledTime = scheduledDateTime?.toDate?.() || new Date(scheduledDateTime);
            // Show only if scheduled time has passed (including now)
            return scheduledTime <= now;
        };

        snapshot.forEach((doc: { id: string; data: () => Record<string, unknown> }) => {
            const request = { id: doc.id, ...doc.data() } as MaintenanceRequest;

            // ✅ Scheduled requests: Show only if scheduledDate <= now
            if (!isScheduledRequestVisible(request)) return;

            // Filter: only show requests visible to maintenance
            // Show if currentDepartment is maintenance, or if legacy (no currentDepartment)
            if (request.currentDepartment && request.currentDepartment !== 'maintenance') {
                return; // Skip - belongs to another department
            }

            if (request.status === 'COMPLETED') {
                if (isToday(request.timeline?.completed)) {
                    completed.push(request);
                }
            } else if (['CONFIRMED', 'SCHEDULED'].includes(request.status)) {
                // ✅ New tab: CONFIRMED requests waiting to start
                newList.push(request);
            } else if (['IN_PROGRESS', 'WAITING_PARTS'].includes(request.status)) {
                // ✅ In Progress tab: Actively being worked on
                inProgressList.push(request);
            }
        });

        // Sort by priority if local sort needed
        if (localSort) {
            const priorityOrder = { urgent: 0, normal: 1, low: 2 };
            newList.sort((a, b) => (priorityOrder[a.priority || 'normal'] || 1) - (priorityOrder[b.priority || 'normal'] || 1));
            inProgressList.sort((a, b) => (priorityOrder[a.priority || 'normal'] || 1) - (priorityOrder[b.priority || 'normal'] || 1));
        }

        setNewRequests(newList);
        setInProgressRequests(inProgressList);
        setCompletedRequests(completed);
    };

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    const isToday = (timestamp: Timestamp | { toDate: () => Date } | Date | null | undefined): boolean => {
        if (!timestamp) return false;
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const getTimeAgo = (timestamp: Timestamp | { toDate: () => Date } | Date | null | undefined): string => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 60000);
        if (diff < 1) return t('maintenance.timeAgo.now');
        if (diff < 60) return t('maintenance.timeAgo.minutesAgo', { minutes: diff });
        const hours = Math.floor(diff / 60);
        if (hours < 24) return t('maintenance.timeAgo.hoursAgo', { hours });
        return t('maintenance.timeAgo.daysAgo', { days: Math.floor(hours / 24) });
    };

    const getEstimatedCost = (maintenanceType: string): number => {
        const costs: Record<string, number> = {
            plumbing: 150,
            electrical: 200,
            ac: 250,
            furniture: 100,
            painting: 180,
            general: 100
        };
        return costs[maintenanceType] || 100;
    };

    const getPriorityLabel = (priority?: string): string => {
        switch (priority) {
            case 'urgent': return t('maintenance.priority.urgent');
            case 'low': return t('maintenance.priority.low');
            default: return t('maintenance.priority.normal');
        }
    };

    const getPriorityColor = (priority?: string): string => {
        switch (priority) {
            case 'urgent': return 'bg-red-500/20 text-red-400';
            case 'low': return 'bg-gray-500/20 text-gray-400';
            default: return 'bg-yellow-500/20 text-yellow-400';
        }
    };

    // ============================================================
    // START MODAL FUNCTIONS
    // ============================================================

    const showStartModal = (requestId: string) => {
        const request = activeRequests.find(r => r.id === requestId);
        if (request) {
            setCurrentStartRequest(request);
            setBeforePhoto(null);
        }
    };

    const closeStartModal = () => {
        setCurrentStartRequest(null);
        setBeforePhoto(null);
    };

    const handleBeforePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !currentStartRequest) return;

        // ✅ Show preview immediately
        const reader = new FileReader();
        reader.onload = (e) => {
            setBeforePhoto(e.target?.result as string);
        };
        reader.readAsDataURL(file);

        // ✅ Upload to ImgBB with compression
        try {
            const result = await uploadMaintenancePhoto(
                file,
                currentStartRequest.id,
                'before'
            );

            if (result.success && result.url) {
                // ✅ Replace preview with uploaded URL
                setBeforePhoto(result.url);
                success(t('maintenance.photoUpload.beforeUploaded'));
            } else {
                error(t('maintenance.uploadPhotoError', { error: result.error || t('maintenance.unknownError') }));
                setBeforePhoto(null);
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : t('maintenance.unknownError');
            logger.error('Before photo upload error', err, 'MaintenanceDashboard');
            error(t('maintenance.uploadPhotoError', { error: errorMessage }));
            setBeforePhoto(null);
        }
    };

    const removeBeforePhoto = () => {
        setBeforePhoto(null);
    };

    const confirmStart = async () => {
        if (!currentStartRequest) return;

        // ✅ ADORA SECURITY: Null safety check
        if (!db) {
            logger.error('Firebase not initialized - cannot start maintenance', undefined, 'MaintenanceDashboard');
            error(t('maintenance.workflow.startedFailed'));
            return;
        }

        try {
            const now = Timestamp.now();
            const updateData: Record<string, unknown> = {
                status: 'IN_PROGRESS',
                'timeline.started': now,
                startedBy: user?.id,
                estimatedCost: getEstimatedCost(currentStartRequest.maintenanceType || 'general'),
                
                // ✅ Workflow: Update status and add journey entry
                'workflow.workflowStatus': 'IN_PROGRESS',
                'workflow.startedAt': now
            };

            if (beforePhoto) {
                updateData.beforePhoto = beforePhoto;
            }

            await updateDoc(doc(db, 'requests', currentStartRequest.id), {
                ...updateData,
                'workflow.journey': arrayUnion({
                    department: 'maintenance',
                    action: 'started',
                    timestamp: now,
                    userId: user?.id || '',
                    userName: user?.name || '',
                    notes: t('maintenance.workflow.started')
                })
            });

            closeStartModal();
            await addPointToEmployee('start_maintenance', { roomNumber: currentStartRequest.roomNumber });

            // ✅ Auto-check daily attendance when employee starts maintenance
            if (tenantId && user?.id) {
                try {
                    const { checkDailyAttendance } = await import('../../services/challengeService');
                    checkDailyAttendance(tenantId, user.id).catch(err => {
                        logger.warn('Failed to check daily attendance', err, 'MaintenanceDashboard');
                    });
                } catch (err) {
                    logger.warn('Could not load challengeService', err, 'MaintenanceDashboard');
                }
            }

            success(t('maintenance.workflow.startedSuccess'));
        } catch (err) {
            logger.error('Error starting maintenance', err, 'MaintenanceDashboard');
            error(t('maintenance.workflow.startedFailed'));
        }
    };

    // ============================================================
    // COMPLETE MODAL FUNCTIONS
    // ============================================================

    const showCompleteModal = (requestId: string) => {
        const request = activeRequests.find(r => r.id === requestId);
        if (request) {
            setCurrentCompleteRequest(request);
            setAfterPhoto(null);
            setActualCost(0);
            setCompletionNotes('');
        }
    };

    const closeCompleteModal = () => {
        setCurrentCompleteRequest(null);
        setAfterPhoto(null);
        setAfterPhotoFile(null);
        setUploadingPhoto(false);
        setUploadProgress(0);
        setActualCost(0);
        setCompletionNotes('');
        // Reset file input
        if (afterPhotoRef.current) {
            afterPhotoRef.current.value = '';
        }
    };

    const handleAfterPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // ✅ Store file for upload
        setAfterPhotoFile(file);

        // ✅ Show preview immediately
        const reader = new FileReader();
        reader.onload = (e) => {
            setAfterPhoto(e.target?.result as string);
        };
        reader.readAsDataURL(file);

        // ✅ Upload to ImgBB with compression
        setUploadingPhoto(true);
        setUploadProgress(0);

        try {
            const result = await uploadMaintenancePhoto(
                file,
                currentCompleteRequest?.id || 'temp',
                'after',
                (progress) => {
                    setUploadProgress(progress.progress || 0);
                }
            );

            if (result.success && result.url) {
                // ✅ Replace preview with uploaded URL
                setAfterPhoto(result.url);
                setUploadProgress(100);
                success(t('maintenance.photoUpload.afterUploaded'));
            } else {
                error(t('maintenance.uploadPhotoError', { error: result.error || t('maintenance.unknownError') }));
                setAfterPhoto(null);
                setAfterPhotoFile(null);
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : t('maintenance.unknownError');
            logger.error('Upload error', err, 'MaintenanceDashboard');
            error(t('maintenance.uploadPhotoError', { error: errorMessage }));
            setAfterPhoto(null);
            setAfterPhotoFile(null);
        } finally {
            setUploadingPhoto(false);
            // Keep progress at 100 if successful, reset if failed
            setTimeout(() => {
                if (afterPhoto) {
                    setUploadProgress(0); // Reset progress bar
                }
            }, 2000);
        }
    };

    const removeAfterPhoto = () => {
        setAfterPhoto(null);
        setAfterPhotoFile(null);
        setUploadProgress(0);
        // Reset file input
        if (afterPhotoRef.current) {
            afterPhotoRef.current.value = '';
        }
    };

    const confirmComplete = async () => {
        if (!currentCompleteRequest) return;

        // ✅ ADORA SECURITY: Null safety check
        if (!db) {
            logger.error('Firebase not initialized - cannot complete maintenance', undefined, 'MaintenanceDashboard');
            error(t('maintenance.workflow.completedFailed'));
            return;
        }

        // ✅ MANDATORY: After Photo is required
        if (!afterPhoto) {
            error(t('maintenance.photoUpload.afterRequired'));
            return;
        }

        // ✅ Check if photo is still uploading
        if (uploadingPhoto) {
            error(t('maintenance.photoUpload.uploadWait'));
            return;
        }

        try {
            if (!tenantId) {
                error(t('maintenance.tenantIdRequired') || 'Tenant ID is required');
                return;
            }
            // ✅ Use transferRequestToDepartment to properly track the journey
            await transferRequestToDepartment(
                currentCompleteRequest.id,
                tenantId, // ✅ Pass tenantId as 2nd parameter
                'maintenance',
                'housekeeping',
                user?.id || '',
                user?.name || '',
                'NEEDS_INSPECTION' as any, // Status: Needs Inspection
                completionNotes ? t('maintenance.workflow.completedWithNotes', { notes: completionNotes }) : t('maintenance.workflow.completed')
            );

            // ✅ Update request with completion data and afterPhoto
            const updateData: Record<string, unknown> = {
                status: 'NEEDS_INSPECTION',
                'timeline.completed': Timestamp.now(),
                completedBy: { id: user?.id || '', name: user?.name || '' },
                completionNotes: completionNotes || null,
                afterPhoto: afterPhoto, // ✅ ImgBB URL
                maintenanceCompleted: true,
                requiresReinspection: true
            };

            await updateDoc(doc(db, 'requests', currentCompleteRequest.id), updateData);

            // ✅ Update linked cleaning request if exists
            if (currentCompleteRequest.linkedCleaningId) {
                const cleaningRef = doc(db, 'requests', currentCompleteRequest.linkedCleaningId);
                await updateDoc(cleaningRef, {
                    currentDepartment: 'housekeeping',
                    waitingForMaintenance: false,
                    maintenanceCompleted: true,
                    status: 'NEEDS_INSPECTION'
                });
            }

            // ✅ Update Room Status
            try {
                const { updateRoomStatus } = await import('../../services/roomService');
                if (tenantId && branchId) {
                    await updateRoomStatus(tenantId, branchId, currentCompleteRequest.roomNumber, 'cleaning');
                }
            } catch (err) {
                logger.warn('Could not auto-update room status', err, 'MaintenanceDashboard');
            }

            // ✅ Close modal (don't delete request - it's transferred to housekeeping)
            closeCompleteModal();
            
            // ✅ Award points (filter out undefined values)
            await addPointToEmployee('complete_maintenance', {
                roomNumber: currentCompleteRequest.roomNumber,
                ...(currentCompleteRequest.maintenanceType && { maintenanceType: currentCompleteRequest.maintenanceType })
            });
            
            success(t('maintenance.workflow.completedSentForInspection'));
            haptic('success');
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : t('common.error');
            logger.error('Error completing maintenance', err, 'MaintenanceDashboard');
            error(t('maintenance.workflow.completedFailed', { error: errorMessage }));
        }
    };

    // ============================================================
    // STATUS ACTIONS (HOLD / RESUME)
    // ============================================================

    const handleHoldRequest = async (request: MaintenanceRequest) => {
        // ✅ ADORA SECURITY: Null safety check
        if (!db) {
            logger.error('Firebase not initialized - cannot hold request', undefined, 'MaintenanceDashboard');
            error(t('maintenance.workflow.suspendedFailed'));
            return;
        }

        try {
            await updateDoc(doc(db, 'requests', request.id), {
                status: 'WAITING_PARTS',
                'timeline.pausedAt': Timestamp.now()
            });
            success(t('maintenance.workflow.suspended'));
        } catch (err) {
            logger.error('Error holding request', err, 'MaintenanceDashboard');
            error(t('maintenance.workflow.suspendedFailed'));
        }
    };

    const handleResumeRequest = async (request: MaintenanceRequest) => {
        // ✅ ADORA SECURITY: Null safety check
        if (!db) {
            logger.error('Firebase not initialized - cannot resume request', undefined, 'MaintenanceDashboard');
            error(t('maintenance.workflow.resumedFailed'));
            return;
        }

        try {
            await updateDoc(doc(db, 'requests', request.id), {
                status: 'IN_PROGRESS',
                'timeline.resumedAt': Timestamp.now() // Could be array for multiple pauses
            });
            success(t('maintenance.workflow.resumed'));
        } catch (err) {
            logger.error('Error resuming request', err, 'MaintenanceDashboard');
            error(t('maintenance.workflow.resumedFailed'));
        }
    };

    // ============================================================
    // ANALYTICS FUNCTIONS
    // ============================================================

    const getRoomMaintenanceHistory = async (roomNumber: string, limit = 10): Promise<MaintenanceRequest[]> => {
        // ✅ ADORA SECURITY: Null safety check
        if (!db) {
            logger.error('Firebase not initialized - cannot get room history', undefined, 'MaintenanceDashboard');
            return [];
        }

        try {
            // ✅ Use branchId from AuthContext (already defined above)
            if (!branchId) return [];
            const q = query(
                collection(db, 'requests'),
                where('branch', '==', branchId),
                where('roomNumber', '==', roomNumber),
                where('serviceType', '==', 'maintenance'),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.slice(0, limit).map(d => ({ id: d.id, ...d.data() } as MaintenanceRequest));
        } catch (error) {
            logger.error('Error getting room history', error, 'MaintenanceDashboard');
            return [];
        }
    };

    const analyzeRoomIssues = async (roomNumber: string): Promise<{ common: string[]; total: number }> => {
        const history = await getRoomMaintenanceHistory(roomNumber, 50);
        const issueCount: Record<string, number> = {};

        history.forEach(req => {
            const type = req.maintenanceType || 'general';
            issueCount[type] = (issueCount[type] || 0) + 1;
        });

        const sorted = Object.entries(issueCount).sort((a, b) => b[1] - a[1]);
        return {
            common: sorted.slice(0, 3).map(([type]) => type),
            total: history.length
        };
    };

    // ============================================================
    // POINTS SYSTEM
    // ============================================================

    const addPointToEmployee = async (action: string, details: Record<string, unknown> = {}) => {
        // ✅ ADORA SECURITY: Null safety check
        if (!db) {
            logger.error('Firebase not initialized - cannot add points', undefined, 'MaintenanceDashboard');
            return;
        }

        try {
            // ✅ Use branchId and tenantId from AuthContext (already defined above)
            if (!branchId || !tenantId) return;
            const hotelId = tenantId;

            let points = 0;
            switch (action) {
                case 'start_maintenance': points = 1; break;
                case 'complete_maintenance': points = 5; break;
                default: points = 1;
            }

            // ✅ SaaS FIX: Use 'tenants' collection
            await addDoc(collection(db, `tenants/${hotelId}/branches/${branchId}/points_history`), {
                employeeId: user?.id,
                action,
                points,
                details,
                createdAt: Timestamp.now()
            });
        } catch (error) {
            logger.error('Error adding points', error, 'MaintenanceDashboard');
        }
    };

    // ============================================================
    // TAB SWITCHING
    // ============================================================

    const switchTab = (tabName: 'new' | 'in_progress' | 'completed') => {
        setCurrentTab(tabName);
    };

    // ============================================================
    // EXPORT FUNCTIONS
    // ============================================================

    const exportMaintenanceDataToCSV = () => {
        const data = [...activeRequests, ...completedRequests];
        const headers = [
            t('maintenance.tableHeaders.room'),
            t('maintenance.tableHeaders.type'),
            t('maintenance.tableHeaders.status'),
            t('maintenance.tableHeaders.cost'),
            t('maintenance.tableHeaders.date')
        ];
        const rows = data.map(r => [
            r.roomNumber,
            r.maintenanceType || 'عام',
            r.status,
            r.actualCost || r.estimatedCost || 0,
            r.createdAt?.toDate?.()?.toLocaleDateString('ar-SA') || ''
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `maintenance_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // ============================================================
    // RENDERING
    // ============================================================

    // ============================================================
    // RENDERING
    // ============================================================

    const [selectedDetailRequest, setSelectedDetailRequest] = useState<MaintenanceRequest | null>(null);

    const handleCardClick = async (requestId: string) => {
        if (user?.id && user?.name && tenantId) {
            try {
                await markAsViewed(requestId, tenantId, user.id, user.name, 'maintenance');
            } catch (e) {
                // Silent fail
            }
        }
    };

    const renderMaintenanceCard = (request: MaintenanceRequest) => (
        <div key={request.id} className="adora-card p-3 sm:p-4 mb-2 sm:mb-3" onClick={() => handleCardClick(request.id)}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-lg font-bold text-white">غرفة {request.roomNumber}</h3>
                        {/* ✅ QR Badge - Show if request is from QR */}
                        {(request as any).source === 'QR' && (
                            <span className="px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold border border-teal-500/30 flex items-center gap-1">
                                <QrCode className="w-3 h-3" />
                                <span>QR</span>
                            </span>
                        )}
                        {/* ✅ Guest Status Badge - Always show */}
                        {request.guestStatus === 'in' ? (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-bold border border-purple-500/30 flex items-center gap-1">
                                🏠 نزيل داخل
                            </span>
                        ) : (
                            <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] font-bold border border-green-500/30 flex items-center gap-1">
                                🚪 نزيل خارج
                            </span>
                        )}
                        {/* ✅ Priority Badge - Always show */}
                        {request.priority === 'urgent' ? (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30 flex items-center gap-1">
                                🚨 عاجل
                            </span>
                        ) : (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/30 flex items-center gap-1">
                                ⏱️ عادي
                            </span>
                        )}
                    </div>
                    <p className="text-white/60 text-sm line-clamp-2">{request.notes || request.description || t('maintenance.defaultRequest')}</p>
                    {/* ✅ QR Badge - Show if request is from QR */}
                    {(request as any).source === 'QR' && (
                        <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold flex items-center gap-1">
                                <QrCode className="w-3 h-3" />
                                <span>{t('maintenance.qrRequest')}</span>
                            </span>
                            {(request as any).guestName && (
                                <span className="text-white/50 text-xs">
                                    {t('maintenance.guest')}: {(request as any).guestName}
                                    {(request as any).guestIdentity && ` • ${(request as any).guestIdentity}`}
                                    {(request as any).guestPhone && ` • ${(request as any).guestPhone}`}
                                </span>
                            )}
                        </div>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 adora-text-tertiary" />
                        <p className="adora-text-tertiary text-xs">{getTimeAgo(request.createdAt)}</p>
                        <ReadReceipt request={request as any} size="sm" showPopup={false} />
                    </div>
                </div>

                {/* Status Badge */}
                <div className="flex flex-col items-end gap-2 pl-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${request.status === 'IN_PROGRESS'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}>
                        {request.status === 'IN_PROGRESS' ? t('maintenance.statusLabels.inProgress') : t('maintenance.statusLabels.waiting')}
                    </span>

                    {/* View Details Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDetailRequest(request);
                        }}
                        className="adora-btn-ghost p-1.5 rounded-lg transition-all"
                        title="عرض التفاصيل"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex gap-2 border-t border-white/5 pt-3">
                {request.status === 'CONFIRMED' && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            showStartModal(request.id);
                        }}
                        className="flex-1 btn-primary py-2 text-sm flex items-center justify-center gap-2"
                    >
                        <Play className="w-4 h-4" />
                        بدء العمل
                    </button>
                )}
                {request.status === 'IN_PROGRESS' && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            showCompleteModal(request.id);
                        }}
                        className="flex-1 btn-success py-2 text-sm flex items-center justify-center gap-2"
                    >
                        <CheckCircle className="w-4 h-4" />
                        إتمام
                    </button>
                )}
            </div>
        </div>
    );

    // ============================================================
    // LOADING STATE
    // ============================================================

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center theme-page">
                <AdoraLoader size="lg" message={t('maintenance.loadingData')} />
            </div>
        );
    }

    // ============================================================
    // MAIN RENDER
    // ============================================================

    return (
        <PageTransition>
            {/* Manager Announcement Banner */}
            <ManagerAnnouncementBanner department="maintenance" />
            
            {/* Spacer for UnifiedManagerHeader */}
            <div className="h-[88px] sm:h-[96px] lg:h-[92px]" />
            
            <div className="min-h-screen pb-4 sm:pb-0 relative overflow-x-hidden transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
                {/* ✅ Unified Responsive Action Bar - Same Order as Reception */}
                <div className="px-3 sm:px-4 lg:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                    <ResponsiveActionBar
                    actions={[
                        {
                            id: 'history',
                            icon: <History className="w-5 h-5" />,
                            label: t('maintenance.operationsHistory'),
                            onClick: () => setShowHistory(true),
                        },
                        {
                            id: 'notes',
                            icon: <MessageSquare className="w-5 h-5" />,
                            label: t('maintenance.roomNotes'),
                            onClick: () => setShowShiftNotes(true),
                        },
                        {
                            id: 'procurement',
                            icon: <ShoppingCart className="w-5 h-5" />,
                            label: t('maintenance.procurement'),
                            onClick: () => setShowProcurement(true),
                        },
                        {
                            id: 'instructions',
                            icon: <BookOpen className="w-5 h-5" />,
                            label: t('maintenance.generalInstructions'),
                            onClick: () => setShowGeneralInstructions(true),
                        },
                        {
                            id: 'support',
                            icon: <Headphones className="w-5 h-5" />,
                            label: t('maintenance.technicalSupport'),
                            onClick: () => setShowSupportTicket(true),
                        },
                        ]}
                    />
                </div>

                {/* ✅ Challenge Timeline - شريط الالتزام */}
                <div className="px-3 sm:px-4 lg:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                    <ChallengeTimeline />
                </div>

                {/* Golden Alert - Broadcast Messages */}
                <div className="px-3 sm:px-4 lg:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                    <GoldenAlertDisplay department="maintenance" />
                </div>

                {/* ✅ Room Transfer Notifications */}
                <div className="px-3 sm:px-4 lg:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                    <div className="flex justify-end">
                        <TransferNotificationBadge department="maintenance" />
                    </div>
                </div>

                {/* ✅ Points Notification - Show for active CONFIRMED requests */}
                {notificationRequest && tenantId && (
                    <PointsNotification
                        requestId={notificationRequest.id}
                        requestType={notificationRequest.type || 'maintenance'}
                        department="maintenance"
                        createdAt={notificationRequest.createdAt}
                        tenantId={tenantId}
                        onDismiss={() => setNotificationRequest(null)}
                    />
                )}

                {/* Stats Cards - Unified Style - ✅ ADORA PREMIUM COMPACT DESIGN - Mobile Responsive */}
                <div 
                    className="max-w-7xl mx-auto mb-3 sm:mb-4 px-3 sm:px-4 lg:px-6"
                >
                    <div 
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-6"
                    >
                        <div className="stat-card-pro-compact">
                    <StatCard
                        count={activeRequests.filter(r => r.status === 'IN_PROGRESS').length}
                        label={`🔧 ${t('maintenance.inProgressLabel')}`}
                        icon={Activity}
                        iconColor="blue"
                        status="normal"
                        lastUpdate={t('maintenance.lastUpdate')}
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={activeRequests.filter(r => r.status === 'CONFIRMED').length}
                        label={t('maintenance.statusLabels.pending')}
                        icon={Clock}
                        iconColor="orange"
                        status={activeRequests.filter(r => r.status === 'CONFIRMED').length > 10 ? 'warning' : 'normal'}
                        lastUpdate={t('maintenance.lastUpdate')}
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={completedRequests.length}
                        label={t('maintenance.completedToday')}
                        icon={CheckCircle}
                        iconColor="green"
                        status="success"
                        lastUpdate={t('maintenance.lastUpdate')}
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={activeRequests.filter(r => r.priority === 'urgent').length}
                        label={t('maintenance.urgent')}
                        icon={AlertTriangle}
                        iconColor="red"
                        status={activeRequests.filter(r => r.priority === 'urgent').length > 0 ? 'error' : 'normal'}
                        lastUpdate={t('maintenance.lastUpdate')}
                        />
                    </div>
                </div>
            </div>

                {/* Progress Tracker */}
                <div className="px-3 sm:px-4 lg:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                <TaskProgress
                    completed={completedRequests.length}
                    total={activeRequests.length + completedRequests.length}
                    label="📊 إنجاز اليوم"
                    color="#F59E0B"
                    />
                </div>

                {/* ✅ Unified Tabs - Same as Reception */}
                <div className="px-3 sm:px-4 lg:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                    <UnifiedRequestTabs
                        currentTab={currentTab}
                        onTabChange={(tab) => switchTab(tab)}
                        newCount={filteredNewRequests.length}
                        inProgressCount={filteredInProgressRequests.length}
                        completedCount={filteredCompletedRequests.length}
                    />
                </div>

                {/* Issue Type Filter */}
                <div className="px-3 sm:px-4 lg:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -webkit-overflow-scrolling-touch">
                        <span className="adora-text-tertiary text-sm flex-shrink-0">{t('maintenance.issueType')}:</span>
                {[
                    { key: 'all', label: t('maintenance.all'), icon: '🔧' },
                    { key: 'كهرب', label: t('maintenance.categories.electrical'), icon: '⚡' },
                    { key: 'سباك', label: t('maintenance.categories.plumbing'), icon: '🚿' },
                    { key: 'تكييف', label: t('maintenance.categories.ac'), icon: '❄️' },
                    { key: 'نجار', label: t('maintenance.categories.carpentry'), icon: '🪚' },
                ].map((type) => (
                    <button
                        key={type.key}
                        onClick={() => {
                            setIssueTypeFilter(type.key);
                            haptic('light');
                        }}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex-shrink-0 flex items-center gap-1.5 ${issueTypeFilter === type.key
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                            : 'adora-card adora-text-secondary hover:opacity-80'
                            }`}
                    >
                            <span>{type.icon}</span>
                            <span>{type.label}</span>
                        </button>
                        ))}
                    </div>
                </div>

                {/* Content - ✅ Unified 3 tabs */}
                <div className="px-4 sm:px-6 max-w-7xl mx-auto space-y-4">
                    {currentTab === 'new' && filteredNewRequests.map(renderMaintenanceCard)}
                    {currentTab === 'in_progress' && filteredInProgressRequests.map(renderMaintenanceCard)}
                    {currentTab === 'completed' && filteredCompletedRequests.map(renderMaintenanceCard)}

                    {currentTab === 'new' && filteredNewRequests.length === 0 && (
                        <div className="text-center py-6 sm:py-8 lg:py-12 adora-text-tertiary text-sm sm:text-base">{t('maintenance.noNewRequests')}</div>
                    )}
                    {currentTab === 'in_progress' && filteredInProgressRequests.length === 0 && (
                        <div className="text-center py-6 sm:py-8 lg:py-12 adora-text-tertiary text-sm sm:text-base">{t('maintenance.noInProgressRequests')}</div>
                    )}
                    {currentTab === 'completed' && filteredCompletedRequests.length === 0 && (
                        <div className="text-center py-6 sm:py-8 lg:py-12 adora-text-tertiary text-sm sm:text-base">{t('maintenance.noCompletedRequests')}</div>
                    )}
                </div>

                {/* Details Modal */}
                <RequestDetailsModal
                    isOpen={!!selectedDetailRequest}
                    request={selectedDetailRequest}
                    onClose={() => setSelectedDetailRequest(null)}
                    branchId={user?.branchId || (user as any)?.branch}
                    tenantId={tenantId}
                />

                {/* Start Modal */}
                {currentStartRequest && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'none' }}>
                    {/* ✅ SOLID Modal - no glass effects */}
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg">
                        <div className="flex justify-between items-center p-4 border-b border-white/10">
                            <h2 className="text-xl font-bold text-white">{t('maintenance.startMaintenance', { roomNumber: currentStartRequest.roomNumber })}</h2>
                            <button onClick={closeStartModal} className="text-white/60 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Request Details */}
                            <div className="adora-card p-3 rounded-xl">
                                <p className="adora-text-secondary text-sm mb-1">{t('maintenance.maintenanceType')}</p>
                                <p className="text-white font-medium">{currentStartRequest.maintenanceType || t('maintenance.general')}</p>
                            </div>

                            <div className="adora-card p-3 rounded-xl">
                                <p className="adora-text-secondary text-sm mb-1">{t('common.description')}</p>
                                <p className="text-white">{currentStartRequest.description || t('maintenance.noDescription')}</p>
                            </div>

                            {/* Before Photo */}
                            <div>
                                <label className="block text-white/60 mb-2">{t('maintenance.photoUpload.beforeLabel')}</label>
                                {beforePhoto ? (
                                    <div className="relative">
                                        <img src={beforePhoto} alt="Before" className="w-full h-40 object-cover rounded-xl" />
                                        <button
                                            onClick={removeBeforePhoto}
                                            className="absolute top-2 right-2 bg-red-500 p-1 rounded-full"
                                        >
                                            <Trash2 className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => beforePhotoRef.current?.click()}
                                        className="adora-btn-ghost w-full py-8 border-2 border-dashed rounded-xl flex flex-col items-center gap-2"
                                        style={{ borderColor: 'var(--theme-border-secondary)' }}
                                    >
                                        <Camera className="w-8 h-8" />
                                        <span>التقاط صورة</span>
                                    </button>
                                )}
                                <input
                                    ref={beforePhotoRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleBeforePhoto}
                                    className="hidden"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10">
                            <button
                                onClick={confirmStart}
                                className="w-full btn-primary py-3"
                            >
                                بدء العمل
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ Complete Modal - Enhanced Design */}
            {currentCompleteRequest && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ backdropFilter: 'none' }}>
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                    <CheckCircle className="w-6 h-6 text-orange-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{t('maintenance.completeWork')}</h2>
                                    <p className="text-sm text-white/60">{t('common.room')} {currentCompleteRequest.roomNumber}</p>
                                </div>
                            </div>
                            <button 
                                onClick={closeCompleteModal} 
                                className="adora-btn-ghost w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content - Scrollable */}
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-4">
                            {/* Request Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="adora-card p-3 rounded-xl">
                                    <p className="adora-text-secondary text-xs mb-1">نوع الصيانة</p>
                                    <p className="text-white font-medium text-sm">{currentCompleteRequest.maintenanceType || 'عام'}</p>
                                </div>
                                <div className="adora-card p-3 rounded-xl">
                                    <p className="adora-text-secondary text-xs mb-1">{t('common.status')}</p>
                                    <p className={`font-medium text-sm ${currentCompleteRequest.priority === 'urgent' ? 'text-red-400' : 'text-blue-400'}`}>
                                        {currentCompleteRequest.priority === 'urgent' ? `🚨 ${t('maintenance.priority.urgent')}` : `⏱️ ${t('maintenance.priority.normal')}`}
                                    </p>
                                </div>
                            </div>

                            {/* Completion Notes */}
                            <div>
                                <label className="block text-white/70 text-sm mb-2 font-medium">{t('common.notes')} ({t('common.optional')})</label>
                                <textarea
                                    value={completionNotes}
                                    onChange={(e) => setCompletionNotes(e.target.value)}
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                    placeholder={t('maintenance.completionNotesPlaceholder')}
                                />
                            </div>

                            {/* ✅ After Photo - Enhanced with Upload Progress */}
                            <div>
                                <label className="block text-white/60 mb-2">
                                    صورة بعد الإصلاح <span className="text-red-400">*</span>
                                </label>
                                {afterPhoto ? (
                                    <div className="relative">
                                        <img 
                                            src={afterPhoto} 
                                            alt="After" 
                                            className="w-full h-40 object-cover rounded-xl border border-green-500/30"
                                        />
                                        <button
                                            onClick={removeAfterPhoto}
                                            disabled={uploadingPhoto}
                                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 p-1.5 rounded-full transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 className="w-4 h-4 text-white" />
                                        </button>
                                        {/* ✅ Upload Success Indicator */}
                                        {!uploadingPhoto && uploadProgress === 0 && (
                                            <div className="absolute bottom-2 left-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" />
                                                تم الرفع
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => afterPhotoRef.current?.click()}
                                        disabled={uploadingPhoto}
                                        className="w-full py-8 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center gap-2 text-white/40 hover:border-white/30 transition-colors disabled:opacity-50"
                                    >
                                        <Camera className="w-8 h-8" />
                                        <span>التقاط صورة</span>
                                        <span className="text-xs text-white/30">(إجباري)</span>
                                    </button>
                                )}
                                {/* ✅ Upload Progress Bar */}
                                {uploadingPhoto && (
                                    <div className="mt-2 space-y-1">
                                        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-white/60 text-center">
                                            جاري رفع الصورة... {Math.round(uploadProgress)}%
                                        </p>
                                    </div>
                                )}
                                <input
                                    ref={afterPhotoRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleAfterPhoto}
                                    disabled={uploadingPhoto}
                                    className="hidden"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10 flex gap-2">
                            <button
                                onClick={closeCompleteModal}
                                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={confirmComplete}
                                disabled={!afterPhoto || uploadingPhoto}
                                className="flex-1 bg-gradient-to-r from-primary-500 to-teal-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {uploadingPhoto ? (
                                    <>
                                        <AdoraLoaderInline size={16} />
                                        جاري الرفع...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        إتمام الصيانة
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                )}

                {/* Shared Modals */}
                <ProcurementCartWizard department="maintenance" tenantId={tenantId || ''} isOpen={showProcurement} onClose={() => setShowProcurement(false)} />
                <ShiftNotes isOpen={showShiftNotes} onClose={() => setShowShiftNotes(false)} />
                <UnifiedHistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} defaultDepartment="maintenance" />
                <TeamMembers isOpen={showTeam} onClose={() => setShowTeam(false)} department="maintenance" showPoints={true} />

                {/* 🎤 Smart Voice FAB (No Overlay) - Verified Fix */}
                <VoiceInputButton
                    onResult={processCommand}
                    isFallbackMode={isFallbackMode}
                    errorCount={errorCount}
                    lastError={lastError}
                    onRetry={retryLastCommand}
                    onResetErrors={resetErrors}
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
                        label: t('maintenance.operationsHistory'),
                        icon: <History className="w-5 h-5" />,
                        onClick: () => setShowHistory(true),
                        color: 'text-blue-400'
                    },
                    {
                        id: 'shift-notes',
                        label: t('maintenance.roomNotes'),
                        icon: <MessageSquare className="w-5 h-5" />,
                        onClick: () => setShowShiftNotes(true),
                        color: 'text-white/60'
                    },
                    {
                        id: 'team',
                        label: t('maintenance.team'),
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
                    },
                    {
                        id: 'instructions',
                        label: 'تعليمات عامة',
                        icon: <BookOpen className="w-5 h-5" />,
                        onClick: () => setShowGeneralInstructions(true),
                        color: 'text-white/60'
                    },
                    {
                        id: 'support',
                        label: t('maintenance.technicalSupport'),
                        icon: <Headphones className="w-5 h-5" />,
                        onClick: () => setShowSupportTicket(true),
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
                    department="maintenance"
                    isOpen={showGeneralInstructions}
                    onClose={() => setShowGeneralInstructions(false)}
                />

                {/* Support Ticket Modal */}
                {showSupportTicket && (
                    <SupportTicketModal
                        isOpen={showSupportTicket}
                        onClose={() => setShowSupportTicket(false)}
                        department="maintenance"
                    />
                )}

                {/* ✅ Onboarding Tour */}
                <TourGuide
                    steps={tourSteps && tourSteps.length > 0 ? tourSteps : []}
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

// ============================================================
// REQUEST DETAILS MODAL
// ============================================================

const RequestDetailsModal: React.FC<{
    isOpen: boolean;
    request: MaintenanceRequest | null;
    onClose: () => void;
    branchId?: string;
    tenantId?: string;
}> = ({ isOpen, request, onClose, branchId, tenantId }) => {
    const { branches } = useTenantBranches();
    const [roomInfo, setRoomInfo] = React.useState<{ type?: string; floor?: number } | null>(null);

    // ✅ Load room type from room data (uses approvedRoomTypes indirectly)
    React.useEffect(() => {
        if (isOpen && request && branchId && tenantId) {
            const loadRoomInfo = async () => {
                try {
                    const { getRooms } = await import('../../services/roomService');
                    const rooms = await getRooms(branchId, tenantId, 1000); // Get all rooms
                    const room = rooms.find(r => r.number === request.roomNumber);
                    
                    if (room) {
                        setRoomInfo({
                            type: room.type,
                            floor: room.floor
                        });
                    }
                } catch (err) {
                    logger.error('Error loading room info', err, 'MaintenanceDashboard');
                }
            };
            loadRoomInfo();
        } else {
            setRoomInfo(null);
        }
    }, [isOpen, request, branchId, tenantId]);

    if (!isOpen || !request) return null;

    // ✅ Get approved room types from branch (for validation)
    const currentBranch = branches.find(b => b.id === branchId);
    const approvedRoomTypes = (currentBranch as any)?.approvedRoomTypes as string[] | undefined;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'none' }}>
            <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b border-white/10">
                    <h2 className="text-xl font-bold text-white">تفاصيل الطلب</h2>
                    <button onClick={onClose} className="text-white/60 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Header Info */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                                <span className="text-xl font-bold text-cyan-400">{request.roomNumber}</span>
                            </div>
                            <div>
                                <h3 className="text-white font-bold">{request.maintenanceType || t('maintenance.generalMaintenance')}</h3>
                                {/* ✅ Room Type Display (from approvedRoomTypes) */}
                                {roomInfo?.type && (
                                    <p className="text-teal-400 text-xs mt-1">
                                        نوع الغرفة: {roomInfo.type}
                                        {approvedRoomTypes && approvedRoomTypes.includes(roomInfo.type) && (
                                            <span className="ml-1 text-green-400">✓</span>
                                        )}
                                    </p>
                                )}
                                {roomInfo?.floor && (
                                    <p className="text-white/50 text-xs mt-0.5">{t('maintenance.floor')}: {roomInfo.floor}</p>
                                )}
                                <p className="text-white/50 text-xs mt-1">{request.createdAt?.toDate?.().toLocaleString('ar-SA')}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {/* ✅ Priority Badge - Always show */}
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${request.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                {request.priority === 'urgent' ? `🚨 ${t('maintenance.urgent')}` : `⏱️ ${t('maintenance.normal')}`}
                            </span>
                            {/* ✅ Guest Status Badge - Always show */}
                            {request.guestStatus === 'in' ? (
                                <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
                                    🏠 {t('maintenance.guestIn')}
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
                                    🚪 {t('maintenance.guestOut')}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Description/Notes */}
                    <div className="adora-card p-4 rounded-xl">
                        <label className="block adora-text-secondary text-xs mb-2 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {t('maintenance.problemDescription')}
                        </label>
                        <p className="adora-text-primary leading-relaxed">
                            {request.notes || request.description || t('maintenance.noDescription')}
                        </p>
                    </div>

                    {/* Images */}
                    {request.damagePhoto && (
                        <div>
                            <label className="block adora-text-secondary text-xs mb-2">صورة المشكلة</label>
                            <img
                                src={request.damagePhoto}
                                alt="Damage"
                                className="w-full h-48 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ border: '1px solid var(--theme-border-primary)' }}
                                onClick={() => window.open(request.damagePhoto, '_blank')}
                            />
                        </div>
                    )}
                </div>

                <div className="p-4" style={{ borderTop: '1px solid var(--theme-border-primary)' }}>
                    <button onClick={onClose} className="adora-btn-secondary w-full py-3">
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaintenanceDashboard;
